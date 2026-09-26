import { createHash } from 'node:crypto';

export const MODEL = 'openai/gpt-6-luna';
export const PROMPT_VERSION = 'crypto-v3';
export const DAY = 86400000;
export const SERIES = ['overall', 'BTC', 'ETH', 'SOL'];
export const ASSETS = { BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD' };
export const hashText = (text) => createHash('sha256').update(String(text || '').trim()).digest('hex');
export const eligible = (video) => Number.isFinite(video.durationSeconds) && video.durationSeconds >= 180;
export const dayStart = (date) => Math.floor(new Date(date).getTime() / DAY) * DAY;
export const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function cryptoError(message, status = 400, code = 'CRYPTO_ERROR') {
  return Object.assign(new Error(message), { status, code });
}

export function parseSelection(input) {
  const raw = Array.isArray(input.channelIds) ? input.channelIds : String(input.channelIds || '').split(',');
  const channelIds = [...new Set(raw.filter(Boolean))];
  if (!channelIds.length || channelIds.length > 3 || channelIds.some(id => !/^UC[\w-]{22}$/.test(id))) {
    throw cryptoError('Select between 1 and 3 saved channels.');
  }
  const from = String(input.from || '2021-01-01');
  const to = String(input.to || new Date().toISOString().slice(0, 10));
  for (const d of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d) {
      throw cryptoError('Dates must be valid YYYY-MM-DD dates.');
    }
  }
  if (from < '2021-01-01' || from > to || to > new Date().toISOString().slice(0, 10)) throw cryptoError('Choose a date range from 2021 through today.');
  return { channelIds, from, to };
}

export function coverageHash(rows) {
  return hashText(rows.map(r => `${r.id}:${r.transcriptHash}`).sort().join('|'));
}

/** Only observations strictly before this publication can influence its baseline. */
export function calibratePoint(row, history, overrides = {}) {
  const time = new Date(row.publishedAt).getTime();
  const earlier = history.filter(r => r.channelId === row.channelId && r.result.relevant &&
    new Date(r.publishedAt).getTime() < time && new Date(r.publishedAt).getTime() >= time - 365 * DAY);
  return Object.fromEntries(SERIES.map(series => {
    const values = earlier.map(r => r.result.scores[series]).filter(Number.isFinite);
    const automatic = values.length >= 20 ? median(values) : null;
    const manual = Number.isFinite(overrides[series]) ? overrides[series] : null;
    const baseline = manual ?? automatic;
    const raw = row.result.scores[series];
    return [series, { raw, baseline, automatic, samples: values.length, manual: manual !== null,
      adjusted: baseline !== null && raw !== null ? Math.max(1, Math.min(10, raw - baseline + 5.5)) : null }];
  }));
}

export function outcome(publishedAt, asset, horizon, candles, now = Date.now()) {
  const start = dayStart(publishedAt) + DAY;
  const finish = start + horizon * DAY;
  if (finish > now) return { status: 'pending' };
  const byDay = candles instanceof Map ? candles : new Map(candles.filter(c => c.asset === asset).map(c => [dayStart(c.day), c]));
  const window = Array.from({ length: horizon }, (_, i) => byDay.get(start + i * DAY));
  if (window.some(c => !c) || !(window[0].open > 0)) return { status: 'unavailable' };
  const entry = window[0].open;
  return { status: 'complete', asset, entryDate: new Date(start).toISOString(), entry,
    exit: window.at(-1).close, returnPct: (window.at(-1).close / entry - 1) * 100,
    declinePct: Math.max(0, (1 - Math.min(...window.map(c => c.low)) / entry) * 100) };
}

export function scorecards(rows, candles, horizon = 30, series = 'overall', now = Date.now()) {
  const asset = series === 'overall' ? 'BTC' : series;
  const maps = Object.fromEntries(Object.keys(ASSETS).map(a => [a, new Map(candles.filter(c => c.asset === a).map(c => [dayStart(c.day), c]))]));
  return [...new Set(rows.map(r => r.channelId))].map(channelId => {
    const channelRows = rows.filter(r => r.channelId === channelId && r.result.relevant);
    const calls = [], warnings = [], sentiment = [];
    let pending = 0, unavailable = 0;
    for (const row of channelRows) {
      if (Number.isFinite(row.result.scores[series])) {
        const o = outcome(row.publishedAt, asset, horizon, maps[asset], now);
        if (o.status === 'complete') sentiment.push({ score: row.result.scores[series], ...o });
      }
      // One observation per video/asset/direction: repeated statements are not extra predictions.
      const unique = new Map(row.result.calls.filter(c => c.asset === series && !c.conditional && c.direction !== 'neutral')
        .map(c => [c.direction, c]));
      if (unique.size === 1) {
        const call = [...unique.values()][0];
        const o = outcome(row.publishedAt, asset, horizon, maps[asset], now);
        if (o.status === 'complete') calls.push({ ...o, hit: call.direction === 'bullish' ? o.returnPct > 0 : o.returnPct < 0 });
        else if (o.status === 'pending') pending++; else unavailable++;
      }
      if (row.result.actions.some(a => a.asset === series && !a.conditional && ['sell', 'take_profits', 'reduce_exposure'].includes(a.action))) {
        warnings.push({ analysisId: row.id, title: row.title, ...outcome(row.publishedAt, asset, horizon, maps[asset], now) });
      }
    }
    const completeWarnings = warnings.filter(w => w.status === 'complete');
    return { channelId, asset, samples: calls.length, pending, unavailable,
      hitRate: mean(calls.map(c => Number(c.hit))), alwaysBullish: mean(calls.map(c => Number(c.returnPct > 0))),
      averageReturn: mean(calls.map(c => c.returnPct)),
      sentiment: { samples: sentiment.length, averageReturn: mean(sentiment.map(c => c.returnPct)),
        bullishReturn: mean(sentiment.filter(c => c.score >= 7).map(c => c.returnPct)),
        bearishReturn: mean(sentiment.filter(c => c.score <= 4).map(c => c.returnPct)) },
      warnings, warningCount: warnings.length, warningSamples: completeWarnings.length,
      warningReturn: mean(completeWarnings.map(c => c.returnPct)), warningDecline: mean(completeWarnings.map(c => c.declinePct)) };
  });
}
