import {
  downloadTranscript,
  getChannelVideoTotal,
  listAllChannelVideos,
  syncChannel
} from './libraryService';

const YT_PAGE = 50;

/**
 * Pulls sequential YouTube catalog pages (50 ids max each) until the library has at least
 * `targetCount` rows for this channel, or the API returns no further page.
 */
export async function ensureCatalogDepth(
  channelInput,
  youtubeChannelId,
  targetCount,
  onProgress
) {
  let knownTotal = await getChannelVideoTotal(youtubeChannelId, 'all');
  if (knownTotal >= targetCount) {
    onProgress?.({
      step: 'catalog-skip',
      totalCount: knownTotal,
      message: `Already have ${knownTotal} video(s) in the library (target ${targetCount}). Skipping YouTube catalog pulls.`
    });
    return {
      totalCount: knownTotal,
      nextPageToken: null,
      syncedVideos: 0,
      channel: null
    };
  }

  let pageToken = '';
  let last = null;
  while (true) {
    last = await syncChannel(channelInput, YT_PAGE, pageToken);
    onProgress?.({
      step: 'catalog',
      syncedVideos: last.syncedVideos,
      totalCount: last.totalCount,
      hasMore: Boolean(last.nextPageToken),
      message: `Catalog page: added/updated ${last.syncedVideos} video row(s); ${last.totalCount} total in library.`
    });
    if ((last.totalCount ?? 0) >= targetCount) break;
    if (!last.nextPageToken) break;
    pageToken = last.nextPageToken;
  }
  return last;
}

export async function downloadMissingTranscriptsSequential(videos, onProgress) {
  let downloaded = 0;
  let skipped = 0;
  for (const v of videos) {
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
    await downloadTranscript(v.youtubeVideoId);
    downloaded += 1;
    onProgress?.({
      step: 'transcript',
      youtubeVideoId: v.youtubeVideoId,
      downloaded,
      skipped,
      message: `Downloaded transcript ${downloaded}: ${v.title || v.youtubeVideoId}`
    });
  }
  return { downloaded, skipped };
}

/**
 * 1) Ensures at least `targetCount` videos exist locally (newest-first via repeated sync).
 * 2) Among the newest `targetCount` rows, downloads transcripts only where missing.
 */
export async function syncCatalogThenFetchMissingTranscripts({
  channelInput,
  youtubeChannelId,
  targetCount,
  onProgress
}) {
  await ensureCatalogDepth(channelInput, youtubeChannelId, targetCount, onProgress);

  const all = await listAllChannelVideos(youtubeChannelId, 'all');
  const sorted = [...all].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );
  const slice = sorted.slice(0, Math.min(targetCount, sorted.length));
  const missing = slice.filter((v) => !v.hasTranscript).length;

  onProgress?.({
    step: 'transcript-batch-start',
    catalogVideosConsidered: slice.length,
    missingTranscripts: missing,
    message: `Fetching transcripts for ${missing} missing out of newest ${slice.length} video(s).`
  });

  const { downloaded, skipped } = await downloadMissingTranscriptsSequential(slice, onProgress);

  return {
    catalogVideosConsidered: slice.length,
    missingBeforeDownload: missing,
    transcriptsDownloaded: downloaded,
    transcriptsSkipped: skipped
  };
}
