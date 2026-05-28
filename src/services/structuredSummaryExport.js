import { listAllChannelVideos } from './libraryService';
import { parseStructuredSummary } from '../utils/structuredSummaryUtils';

export const STRUCTURED_SUMMARY_EXPORT_VERSION = 1;

export function buildStructuredSummariesExportPayload(videos, channels) {
  const channelMeta = new Map(
    (channels || []).map((c) => [c.youtubeChannelId, c])
  );

  const byChannelId = new Map();
  for (const video of videos || []) {
    const summary = parseStructuredSummary(video);
    if (!summary) continue;

    const channelId = video.channel?.youtubeChannelId || '';
    if (!channelId) continue;

    const row = {
      youtubeVideoId: video.youtubeVideoId,
      title: video.title,
      publishedAt: video.publishedAt,
      ...(video.structuredSummaryImportedAt
        ? { importedAt: video.structuredSummaryImportedAt }
        : {}),
      data: summary
    };

    const list = byChannelId.get(channelId) || [];
    list.push(row);
    byChannelId.set(channelId, list);
  }

  const channelRows = [...byChannelId.entries()]
    .map(([youtubeChannelId, summaries]) => {
      const meta = channelMeta.get(youtubeChannelId);
      summaries.sort(
        (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
      );
      return {
        youtubeChannelId,
        title: meta?.title || youtubeChannelId,
        summaries
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const summaryCount = channelRows.reduce(
    (total, channel) => total + channel.summaries.length,
    0
  );

  return {
    version: STRUCTURED_SUMMARY_EXPORT_VERSION,
    app: 'YTTranscripts',
    exportedAt: new Date().toISOString(),
    channelCount: channelRows.length,
    summaryCount,
    channels: channelRows
  };
}

export async function fetchStructuredSummaryVideosForChannels(channelIds) {
  const ids = [...new Set((channelIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];

  const batches = await Promise.all(
    ids.map((id) => listAllChannelVideos(id, 'downloaded', { fields: 'full' }))
  );
  return batches.flat();
}

export function downloadStructuredSummariesJson(payload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const date = new Date().toISOString().slice(0, 10);
  const count = payload.summaryCount || 0;
  const filename = `yttranscripts-structured-summaries-${count}-${date}.json`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export async function exportStructuredSummariesForChannels(channels) {
  const channelIds = (channels || []).map((c) => c.youtubeChannelId).filter(Boolean);
  if (!channelIds.length) {
    throw new Error('Select at least one channel to export.');
  }

  const videos = await fetchStructuredSummaryVideosForChannels(channelIds);
  const payload = buildStructuredSummariesExportPayload(videos, channels);

  if (payload.summaryCount === 0) {
    throw new Error('No structured summaries found for the selected channels.');
  }

  downloadStructuredSummariesJson(payload);
  return payload;
}
