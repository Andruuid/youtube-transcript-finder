import { prisma } from '../db/prismaClient.js';
import { analyzeTranscript } from './cryptoAiService.js';
import { selection, loadRows, videoWhere, calibrateChannel } from './cryptoDataService.js';
import { MODEL, PROMPT_VERSION, DAY, eligible, hashText, cryptoError } from './cryptoMath.js';
import { fetchChannelVideos, resolveChannel, fetchVideoDurationsByIds } from './youtubeCatalogService.js';
import { fetchAndPersistTranscript } from './transcriptService.js';
import { refreshPrices } from './cryptoPriceService.js';

let workerRunning = false;
let initialized = false;
const controllers = new Map();
// Serialize creation/resumption as well as execution; concurrent HTTP requests cannot race deduplication.
let mutationTail = Promise.resolve();
function exclusive(fn) {
  const next = mutationTail.then(fn, fn);
  mutationTail = next.catch(() => {});
  return next;
}
const blocking = ['queued', 'running'];
export function overlaps(a, b) { return a.channelIds.some(id => b.channelIds.includes(id)); }
export const pauseForError = (error) => ['PROVIDER_AUTH', 'PROVIDER_QUOTA', 'YOUTUBE_AUTH_REQUIRED', 'YOUTUBE_BLOCKED'].includes(error.code) || /quota|sign in|temporarily blocked|API key|cookie/i.test(error.message || '');

export async function jobDto(job) {
  const items = await prisma.cryptoJobItem.groupBy({ by: ['status'], where: { jobId: job.id }, _count: { _all: true } });
  const counts = Object.fromEntries(items.map(i => [i.status, i._count._all]));
  const errors = await prisma.cryptoJobItem.findMany({ where: { jobId: job.id, status: 'failed' }, select: { youtubeVideoId: true, error: true }, take: 10 });
  return { ...job, params: JSON.parse(job.paramsJson), checkpoint: JSON.parse(job.checkpointJson), counts, total: items.reduce((n, i) => n + i._count._all, 0), errors,
    paramsJson: undefined, checkpointJson: undefined };
}
export async function listJobs(channelIds) {
  const jobs = await prisma.cryptoJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return Promise.all(jobs.filter(j => j.kind === 'prices' || overlaps(JSON.parse(j.paramsJson), { channelIds })).slice(0, 12).map(jobDto));
}

export async function createJob(input) {
  return exclusive(async () => {
    const params = await selection(input);
    const kind = input.kind;
    if (!['analysis', 'calibration', 'history', 'prices'].includes(kind)) throw cryptoError('Unknown Crypto job type.');
    const persisted = { channelIds: params.channelIds, from: params.from, to: params.to };
    if (input.reprocessLegacy != null) {
      if (kind !== 'analysis' || typeof input.reprocessLegacy !== 'boolean') throw cryptoError('reprocessLegacy must be a boolean for analysis jobs.');
      persisted.reprocessLegacy = input.reprocessLegacy;
    }
    if (input.limit != null) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10000) throw cryptoError('Invalid analysis limit.');
      persisted.limit = input.limit;
    }
    const active = await prisma.cryptoJob.findMany({ where: { status: { in: blocking } } });
    const duplicate = active.find(j => kind === 'prices' ? j.kind === 'prices' : j.kind !== 'prices' && overlaps(JSON.parse(j.paramsJson), persisted));
    if (duplicate) return jobDto(duplicate);
    const job = await prisma.cryptoJob.create({ data: { kind, paramsJson: JSON.stringify(persisted), message: 'Queued' } });
    kickWorker();
    return jobDto(job);
  });
}

export async function controlJob(id, action) {
  return exclusive(async () => {
    const job = await prisma.cryptoJob.findUnique({ where: { id } });
    if (!job) throw cryptoError('Job not found.', 404);
    if (action === 'stop') {
      const updated = await prisma.cryptoJob.update({ where: { id }, data: { status: 'paused', message: 'Stopped. Saved results are preserved; resume when ready.' } });
      controllers.get(id)?.abort(new Error('Stopped by user'));
      return jobDto(updated);
    }
    if (!['resume', 'retry'].includes(action)) throw cryptoError('Unknown job action.');
    if (blocking.includes(job.status)) return jobDto(job);
    if (controllers.has(id)) throw cryptoError('The current item is stopping. Try again in a moment.', 409);
    const active = await prisma.cryptoJob.findMany({ where: { status: { in: blocking }, id: { not: id } } });
    if (active.some(j => job.kind === 'prices' ? j.kind === 'prices' : j.kind !== 'prices' && overlaps(JSON.parse(j.paramsJson), JSON.parse(job.paramsJson)))) throw cryptoError('Another job is active for this channel. Stop it or wait before resuming.', 409);
    await prisma.cryptoJobItem.updateMany({ where: { jobId: id, status: { in: action === 'retry' ? ['failed', 'running'] : ['running'] } }, data: { status: 'pending', error: null } });
    const updated = await prisma.cryptoJob.update({ where: { id }, data: { status: 'queued', message: 'Queued to resume' } });
    kickWorker();
    return jobDto(updated);
  });
}

async function updateMessage(id, message) { await prisma.cryptoJob.update({ where: { id }, data: { message } }); }

async function durations(params, signal) {
  const videos = await prisma.video.findMany({ where: { ...videoWhere(params), durationSeconds: null }, select: { id: true, youtubeVideoId: true } });
  for (let i = 0; i < videos.length; i += 50) {
    signal.throwIfAborted();
    const batch = videos.slice(i, i + 50);
    const found = await fetchVideoDurationsByIds(batch.map(v => v.youtubeVideoId));
    for (const video of batch) if (found.has(video.youtubeVideoId)) await prisma.video.update({ where: { id: video.id }, data: { durationSeconds: found.get(video.youtubeVideoId) } });
  }
}

async function addItems(jobId, videos) {
  for (const video of videos) await prisma.cryptoJobItem.upsert({ where: { jobId_youtubeVideoId: { jobId, youtubeVideoId: video.youtubeVideoId } },
    create: { jobId, youtubeVideoId: video.youtubeVideoId }, update: {} });
}

export function pageReachesStart(videos, from) {
  return videos.length > 0 && videos.every(v => new Date(v.publishedAt).getTime() < Date.parse(from));
}

async function importCatalog(job, params, signal) {
  const checkpoint = JSON.parse(job.checkpointJson);
  for (const channel of params.channels) {
    const state = checkpoint[channel.youtubeChannelId] || { pageToken: '', pages: 0, done: false };
    if (state.done) continue;
    let playlist = channel.uploadsPlaylistId;
    if (!playlist) {
      playlist = (await resolveChannel(channel.youtubeChannelId)).uploadsPlaylistId;
      await prisma.channel.update({ where: { id: channel.id }, data: { uploadsPlaylistId: playlist } });
    }
    while (!state.done) {
      signal.throwIfAborted();
      await updateMessage(job.id, `${channel.title} · catalog page ${state.pages + 1}`);
      let page;
      try { page = await fetchChannelVideos(playlist, 50, state.pageToken); }
      catch (error) {
        // YouTube page tokens can expire between runs. Restart the catalog scan;
        // video upserts and saved transcripts make replay safe.
        if (state.pageToken && /page.?token/i.test(error.message)) {
          state.pageToken = ''; state.pages = 0;
          checkpoint[channel.youtubeChannelId] = state;
          await prisma.cryptoJob.update({ where: { id: job.id }, data: { checkpointJson: JSON.stringify(checkpoint) } });
          continue;
        }
        throw error;
      }
      if (page.nextPageToken && page.nextPageToken === state.pageToken) throw cryptoError('YouTube returned a repeated page token. Resume the import later.', 502);
      for (const video of page.videos) {
        const data = { ...video, channelId: channel.id, publishedAt: new Date(video.publishedAt) };
        await prisma.video.upsert({ where: { youtubeVideoId: video.youtubeVideoId }, create: data, update: data });
      }
      state.pages++;
      state.done = !page.nextPageToken || pageReachesStart(page.videos, params.from);
      state.pageToken = page.nextPageToken || '';
      checkpoint[channel.youtubeChannelId] = state;
      await prisma.cryptoJob.update({ where: { id: job.id }, data: { checkpointJson: JSON.stringify(checkpoint) } });
    }
  }
}

async function processItems(job, signal) {
  for (;;) {
    signal.throwIfAborted();
    const item = await prisma.cryptoJobItem.findFirst({ where: { jobId: job.id, status: 'pending' }, orderBy: { id: 'asc' } });
    if (!item) break;
    await prisma.cryptoJobItem.update({ where: { id: item.id }, data: { status: 'running', attempts: { increment: 1 }, error: null } });
    try {
      const video = await prisma.video.findUnique({ where: { youtubeVideoId: item.youtubeVideoId } });
      if (!video || !eligible(video)) {
        await prisma.cryptoJobItem.update({ where: { id: item.id }, data: { status: 'skipped', error: !video ? 'Video no longer saved' : 'Duration under 3 minutes or unknown' } });
        continue;
      }
      await updateMessage(job.id, `${job.kind === 'history' ? 'Downloading' : 'Analyzing'} · ${video.title}`);
      if (job.kind === 'history') {
        if (!video.transcriptText?.trim()) await fetchAndPersistTranscript(video.youtubeVideoId);
      } else {
        if (!video.transcriptText?.trim()) throw cryptoError('Transcript is missing. Import history or download it in Channel Monitor.', 400, 'MISSING_TRANSCRIPT');
        const key = { videoId: video.id, transcriptHash: hashText(video.transcriptText), model: MODEL, promptVersion: PROMPT_VERSION };
        const existing = await prisma.cryptoAnalysis.findUnique({ where: { videoId_transcriptHash_model_promptVersion: key } });
        if (!existing) {
          const result = await analyzeTranscript(video.transcriptText, { signal });
          signal.throwIfAborted();
          await prisma.cryptoAnalysis.upsert({ where: { videoId_transcriptHash_model_promptVersion: key },
            create: { ...key, channelId: video.channelId, relevant: result.relevant, resultJson: JSON.stringify(result) }, update: {} });
        }
      }
      await prisma.cryptoJobItem.update({ where: { id: item.id }, data: { status: 'complete' } });
    } catch (error) {
      const pause = signal.aborted || pauseForError(error);
      await prisma.cryptoJobItem.update({ where: { id: item.id }, data: { status: pause ? 'pending' : 'failed', error: String(error.message).slice(0, 1000) } });
      if (pause) throw error;
    }
  }
}

async function runJob(job, signal) {
  const params = await selection(JSON.parse(job.paramsJson));
  if (job.kind === 'prices') return refreshPrices({ signal, onProgress: message => updateMessage(job.id, message) });
  if (job.kind === 'calibration') {
    for (const channel of params.channels) { signal.throwIfAborted(); await calibrateChannel(channel.id); }
    return;
  }
  if (job.kind === 'history') await importCatalog(job, params, signal);
  await durations(params, signal);
  const rows = await loadRows(params);
  const reprocessLegacy = JSON.parse(job.paramsJson).reprocessLegacy === true;
  let candidates = rows.filter(r => eligible(r.video) && (job.kind === 'history' ? !r.video.transcriptText?.trim()
    : r.video.transcriptText?.trim() && (!r.analysis || (reprocessLegacy && r.analysis.promptVersion !== PROMPT_VERSION))));
  const limit = JSON.parse(job.paramsJson).limit;
  if (limit) {
    const existing = await prisma.cryptoJobItem.findMany({ where: { jobId: job.id }, select: { youtubeVideoId: true } });
    const existingIds = new Set(existing.map(i => i.youtubeVideoId));
    candidates = candidates.filter(r => !existingIds.has(r.video.youtubeVideoId)).slice(0, Math.max(0, limit - existing.length));
  }
  await addItems(job.id, candidates.map(r => r.video));
  await processItems(job, signal);
}

export function kickWorker() {
  if (workerRunning || !initialized) return;
  workerRunning = true;
  void (async () => {
    try {
      for (;;) {
        const job = await prisma.cryptoJob.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' } });
        if (!job) break;
        const controller = new AbortController();
        controllers.set(job.id, controller);
        const claimed = await prisma.cryptoJob.updateMany({ where: { id: job.id, status: 'queued' }, data: { status: 'running', message: 'Preparing' } });
        if (!claimed.count) { controllers.delete(job.id); continue; }
        try {
          await runJob(job, controller.signal);
          controller.signal.throwIfAborted();
          const failures = await prisma.cryptoJobItem.count({ where: { jobId: job.id, status: 'failed' } });
          await prisma.cryptoJob.updateMany({ where: { id: job.id, status: 'running' }, data: { status: failures ? 'partial' : 'complete', message: failures ? `Finished with ${failures} failed videos. Retry failed items when ready.` : 'Complete' } });
        } catch (error) {
          await prisma.cryptoJob.updateMany({ where: { id: job.id, status: 'running' }, data: { status: 'paused', message: String(error.message || error).slice(0, 1000) } });
        } finally { controllers.delete(job.id); }
      }
    } catch (error) { console.error('[crypto-worker]', error.message); }
    finally {
      workerRunning = false;
      // A job may have been inserted between the last empty query and releasing the worker.
      if (await prisma.cryptoJob.count({ where: { status: 'queued' } }).catch(() => 0)) kickWorker();
    }
  })();
}

export async function initializeCryptoWorker() {
  if (initialized) return;
  await prisma.cryptoJob.updateMany({ where: { status: 'running' }, data: { status: 'paused', message: 'Server restarted. Resume to continue from saved progress.' } });
  await prisma.cryptoJobItem.updateMany({ where: { status: 'running' }, data: { status: 'pending' } });
  initialized = true;
  kickWorker();
}
