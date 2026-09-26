import { prisma } from '../db/prismaClient.js';
import { MODEL, PROMPT_VERSION, DAY, SERIES, eligible, hashText, coverageHash, calibratePoint, median, scorecards, parseSelection, cryptoError } from './cryptoMath.js';

export async function selection(input) {
  const params = parseSelection(input);
  const channels = await prisma.channel.findMany({ where: { youtubeChannelId: { in: params.channelIds } }, include: { cryptoSettings: true, cryptoCalibrations: { orderBy: { version: 'desc' }, take: 1 } } });
  if (channels.length !== params.channelIds.length) throw cryptoError('One or more selected channels are no longer saved.');
  return { ...params, channels };
}

export function videoWhere(params, includeHistory = false) {
  return { channel: { youtubeChannelId: { in: params.channelIds } }, publishedAt: {
    gte: new Date(includeHistory ? '2021-01-01' : params.from), lt: new Date(Date.parse(params.to) + DAY)
  } };
}

export async function loadRows(params, includeHistory = false) {
  const videos = await prisma.video.findMany({ where: videoWhere(params, includeHistory), orderBy: { publishedAt: 'asc' },
    include: { cryptoAnalyses: { where: { model: MODEL, promptVersion: PROMPT_VERSION }, orderBy: { createdAt: 'desc' } } } });
  return videos.map(video => {
    const transcriptHash = hashText(video.transcriptText);
    const analysis = eligible(video) && video.transcriptText?.trim() ? video.cryptoAnalyses.find(a => a.transcriptHash === transcriptHash) || null : null;
    return { video, analysis, ...(analysis ? { id: analysis.id, transcriptHash, channelId: video.channelId, youtubeVideoId: video.youtubeVideoId,
      title: video.title, publishedAt: video.publishedAt, result: JSON.parse(analysis.resultJson) } : {}) };
  });
}

export async function getCoverage(params, loaded) {
  const rows = loaded || await loadRows(params);
  const failures = await prisma.cryptoJobItem.findMany({ where: { status: 'failed', youtubeVideoId: { in: rows.map(r => r.video.youtubeVideoId) } }, select: { youtubeVideoId: true } });
  const failed = new Set(failures.map(f => f.youtubeVideoId));
  return params.channels.map(channel => {
    const items = rows.filter(r => r.video.channelId === channel.id);
    const downloaded = items.filter(r => r.video.transcriptText?.trim());
    const candidates = items.filter(r => eligible(r.video));
    return { channelId: channel.id, youtubeChannelId: channel.youtubeChannelId, title: channel.title,
      cataloged: items.length, downloaded: downloaded.length, eligible: candidates.length,
      analyzed: items.filter(r => r.analysis).length, relevant: items.filter(r => r.analysis?.relevant).length,
      irrelevant: items.filter(r => r.analysis && !r.analysis.relevant).length,
      failed: candidates.filter(r => !r.analysis && failed.has(r.video.youtubeVideoId)).length,
      missing: candidates.filter(r => !r.video.transcriptText?.trim()).length,
      unknownDuration: items.filter(r => r.video.durationSeconds === null).length,
      short: items.filter(r => r.video.durationSeconds !== null && !eligible(r.video)).length,
      pending: candidates.filter(r => r.video.transcriptText?.trim() && !r.analysis).length,
      earliest: items[0]?.video.publishedAt || null, latest: items.at(-1)?.video.publishedAt || null };
  });
}

export async function calibrateChannel(channelId) {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const params = { channelIds: [channel.youtubeChannelId], from: '2021-01-01', to: new Date().toISOString().slice(0, 10) };
  const rows = (await loadRows(params)).filter(r => r.analysis);
  if (!rows.some(r => r.result.relevant)) throw cryptoError('Analyze relevant saved transcripts before calibrating.');
  const last = await prisma.cryptoCalibration.findFirst({ where: { channelId }, orderBy: { version: 'desc' } });
  const recent = rows.filter(r => r.result.relevant && new Date(r.publishedAt).getTime() >= Date.now() - 365 * DAY);
  const profile = Object.fromEntries(SERIES.map(s => {
    const values = recent.map(r => r.result.scores[s]).filter(Number.isFinite);
    return [s, { samples: values.length, baseline: values.length >= 20 ? median(values) : null }];
  }));
  return prisma.cryptoCalibration.create({ data: { channelId, version: (last?.version || 0) + 1, coverageHash: coverageHash(rows), profileJson: JSON.stringify(profile) } });
}

export async function dashboard(input) {
  const params = await selection(input);
  const horizon = Number(input.horizon || 30);
  const series = input.series || 'overall';
  if (![7, 30, 90].includes(horizon) || !SERIES.includes(series)) throw cryptoError('Invalid horizon or sentiment series.');
  const all = await loadRows({ ...params, to: new Date().toISOString().slice(0, 10) }, true);
  const history = all.filter(r => r.analysis);
  const inRange = all.filter(r => r.video.publishedAt >= new Date(params.from) && r.video.publishedAt < new Date(Date.parse(params.to) + DAY));
  const profiles = params.channels.map(channel => {
    const profile = channel.cryptoCalibrations[0];
    return { channelId: channel.id, title: channel.title, version: profile?.version || null,
      createdAt: profile?.createdAt || null, stale: !!profile && profile.coverageHash !== coverageHash(history.filter(r => r.channelId === channel.id)),
      profile: profile ? JSON.parse(profile.profileJson) : null, overrides: JSON.parse(channel.cryptoSettings?.overridesJson || '{}') };
  });
  const rows = inRange.filter(r => r.analysis);
  const candles = await prisma.cryptoCandle.findMany({ where: { day: { gte: new Date(params.from), lt: new Date() } }, orderBy: { day: 'asc' } });
  const prices = Object.fromEntries(['BTC', 'ETH', 'SOL'].map(asset => {
    const assetCandles = candles.filter(c => c.asset === asset);
    return [asset, { source: 'Coinbase Exchange · USD · UTC daily candles', earliest: assetCandles[0]?.day || null,
      latest: assetCandles.at(-1)?.day || null, candles: assetCandles.filter(c => c.day < new Date(Date.parse(params.to) + DAY)) }];
  }));
  return { coverage: await getCoverage(params, inRange), profiles, prices,
    points: rows.filter(r => r.result.relevant).map(row => {
      const profile = profiles.find(p => p.channelId === row.channelId);
      return { id: row.id, channelId: row.channelId, youtubeVideoId: row.youtubeVideoId, title: row.title, publishedAt: row.publishedAt,
        scores: row.result.scores, confidence: row.result.confidence,
        warnings: row.result.actions.filter(a => !a.conditional && ['sell', 'take_profits', 'reduce_exposure'].includes(a.action)),
        calibration: profile.version || Object.keys(profile.overrides).length ? calibratePoint(row, history, profile.overrides) : null };
    }), scorecards: params.channels.map(c => scorecards(rows.filter(r => r.channelId === c.id), candles, horizon, series)[0] || { channelId: c.id, samples: 0, pending: 0, unavailable: 0, warnings: [], warningCount: 0, warningSamples: 0, sentiment: { samples: 0 } }),
    model: MODEL, promptVersion: PROMPT_VERSION };
}

export async function listAnalyses(input) {
  const params = await selection(input);
  const rows = (await loadRows(params)).filter(r => r.analysis).reverse();
  const filter = input.filter || 'all';
  const items = rows.filter(r => (filter === 'all' || (filter === 'relevant' ? r.result.relevant : filter === 'irrelevant' ? !r.result.relevant : r.result.actions.some(a => !a.conditional && ['sell', 'take_profits', 'reduce_exposure'].includes(a.action)))) &&
    (!input.search || `${r.title} ${r.result.summary}`.toLowerCase().includes(String(input.search).toLowerCase())));
  const skip = Math.max(0, Math.floor(Number(input.skip) || 0));
  const take = Math.min(100, Math.max(1, Math.floor(Number(input.take) || 20)));
  return { total: items.length, items: items.slice(skip, skip + take).map(({ video, analysis, ...row }) => ({ ...row, durationSeconds: video.durationSeconds })) };
}

export async function setOverrides(channelId, overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || Object.keys(overrides).some(s => !SERIES.includes(s) || !Number.isFinite(overrides[s]) || overrides[s] < 1 || overrides[s] > 10)) throw cryptoError('Baselines must be numbers between 1 and 10.');
  if (!await prisma.channel.findUnique({ where: { id: channelId } })) throw cryptoError('Channel not found.', 404);
  return prisma.cryptoChannelSettings.upsert({ where: { channelId }, create: { channelId, overridesJson: JSON.stringify(overrides) }, update: { overridesJson: JSON.stringify(overrides) } });
}
