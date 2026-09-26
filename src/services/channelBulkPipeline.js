import {
  downloadTranscript,
  listNewestChannelVideos,
  syncChannel
} from './libraryService';
import { isTranscriptAccessError } from '../utils/transcriptErrors';

const YT_PAGE = 50;

/**
 * Refreshes sequential uploads-playlist pages until the newest `targetCount`
 * catalog entries have been visited, or YouTube returns no further page.
 */
export async function ensureCatalogDepth(
  channelInput,
  youtubeChannelId,
  targetCount,
  onProgress,
  { signal, minDurationSeconds = 0 } = {}
) {
  let pageToken = '';
  let last = null;
  let catalogVideosVisited = 0;
  let eligibleVideosVisited = 0;
  const target = Math.max(Number(targetCount) || 1, 1);
  const minimumDuration = Math.max(
    Math.floor(Number(minDurationSeconds) || 0),
    0
  );
  while (eligibleVideosVisited < target) {
    throwIfAborted(signal);
    last = await syncChannel(channelInput, YT_PAGE, pageToken, {
      signal,
      minDurationSeconds: minimumDuration
    });
    catalogVideosVisited += last.syncedVideos || 0;
    eligibleVideosVisited +=
      typeof last.eligibleVideos === 'number'
        ? last.eligibleVideos
        : last.syncedVideos || 0;
    onProgress?.({
      step: 'catalog',
      syncedVideos: last.syncedVideos,
      totalCount: last.totalCount,
      catalogVideosVisited,
      eligibleVideosVisited,
      hasMore: Boolean(last.nextPageToken),
      message:
        minimumDuration > 0
          ? `Catalog: scanned ${catalogVideosVisited} upload(s); ${Math.min(
              eligibleVideosVisited,
              target
            )}/${target} meet the minimum length.`
          : `Catalog: scanned ${Math.min(catalogVideosVisited, target)}/${target} newest video(s); ${last.totalCount} total stored.`
    });
    if (!last.nextPageToken) break;
    pageToken = last.nextPageToken;
  }
  return {
    ...(last || {
      totalCount: 0,
      nextPageToken: null,
      syncedVideos: 0,
      channel: null
    }),
    catalogVideosVisited,
    eligibleVideosVisited
  };
}

function abortError() {
  const error = new Error('Collection stopped');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

export async function downloadMissingTranscriptsSequential(
  videos,
  onProgress,
  { signal } = {}
) {
  let downloaded = 0;
  let skipped = 0;
  /** @type {{ youtubeVideoId: string, title: string, message: string }[]} */
  const failures = [];
  for (const v of videos) {
    throwIfAborted(signal);
    if (v.hasTranscript) {
      skipped += 1;
      onProgress?.({
        step: 'transcript-skip',
        youtubeVideoId: v.youtubeVideoId,
        downloaded,
        skipped,
        message: `Skip (already in DB): ${v.title || v.youtubeVideoId}`
      });
      continue;
    }
    try {
      await downloadTranscript(v.youtubeVideoId, { signal });
      downloaded += 1;
      onProgress?.({
        step: 'transcript',
        youtubeVideoId: v.youtubeVideoId,
        downloaded,
        skipped,
        message: `Downloaded transcript ${downloaded}: ${v.title || v.youtubeVideoId}`
      });
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw abortError();
      }
      const message = err?.message || String(err);
      if (isTranscriptAccessError(err)) {
        err.message = `Stopped after saving ${downloaded} transcript(s). Remaining downloads were not attempted. ${message}`;
        throw err;
      }
      failures.push({
        youtubeVideoId: v.youtubeVideoId,
        title: v.title || '',
        message
      });
      onProgress?.({
        step: 'transcript-error',
        youtubeVideoId: v.youtubeVideoId,
        downloaded,
        skipped,
        failures: failures.length,
        message: `Skipped (error): ${v.youtubeVideoId} — ${message}`
      });
    }
  }
  return { downloaded, skipped, failures };
}

/**
 * 1) Ensures at least `targetCount` videos exist locally (newest-first via repeated sync).
 * 2) Applies the optional minimum duration before selecting the newest `targetCount` rows.
 * 3) Downloads transcripts only where missing.
 */
export async function syncCatalogThenFetchMissingTranscripts({
  channelInput,
  youtubeChannelId,
  targetCount,
  minDurationSeconds = 0,
  onProgress,
  signal
}) {
  await ensureCatalogDepth(
    channelInput,
    youtubeChannelId,
    targetCount,
    onProgress,
    { signal, minDurationSeconds }
  );

  throwIfAborted(signal);
  const slice = await listNewestChannelVideos(
    youtubeChannelId,
    targetCount,
    'all',
    { signal, minDurationSeconds }
  );
  const missing = slice.filter((v) => !v.hasTranscript).length;

  onProgress?.({
    step: 'transcript-batch-start',
    catalogVideosConsidered: slice.length,
    missingTranscripts: missing,
    message: `Fetching transcripts for ${missing} missing out of newest ${slice.length} video(s).`
  });

  const { downloaded, skipped, failures } = await downloadMissingTranscriptsSequential(
    slice,
    onProgress,
    { signal }
  );

  if (failures.length > 0) {
    onProgress?.({
      step: 'transcript-batch-summary',
      failures,
      message: `Finished with ${failures.length} transcript error(s); others succeeded.`
    });
  }

  return {
    catalogVideosConsidered: slice.length,
    missingBeforeDownload: missing,
    transcriptsDownloaded: downloaded,
    transcriptsSkipped: skipped,
    transcriptFailures: failures
  };
}
