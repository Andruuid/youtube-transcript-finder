import { formatChannelThumbnailUrl } from '../services/channelThumbnailService.js';

/** Safe channel fields for nested video rows (no thumbnail BLOB). */
export function toChannelRef(channel) {
  if (!channel) return undefined;
  return {
    youtubeChannelId: channel.youtubeChannelId,
    title: channel.title,
    handle: channel.handle ?? null,
    thumbnailUrl: formatChannelThumbnailUrl(channel)
  };
}

/**
 * Lightweight video row for library lists (omits transcript bodies and summary blobs).
 * @param {object} video Prisma video + optional channel include
 * @param {object} [extra] e.g. { matchSource }
 */
export function toVideoListItem(video, extra = {}) {
  return {
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    channelId: video.channelId,
    title: video.title,
    description: video.description,
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnailUrl ?? null,
    durationSeconds: video.durationSeconds ?? null,
    hasTranscript: video.hasTranscript,
    hasStructuredSummary: !!(
      video.structuredSummaryImportedAt || video.structuredSummaryJson
    ),
    hasShortSummary: !!(video.sumShort && String(video.sumShort).trim()),
    hasLongSummary: !!(video.sumLong && String(video.sumLong).trim()),
    productName: video.productName ?? null,
    niche: video.niche ?? null,
    structuredSummaryImportedAt: video.structuredSummaryImportedAt ?? null,
    sumShortModel: video.sumShortModel ?? null,
    sumLongModel: video.sumLongModel ?? null,
    channel: toChannelRef(video.channel),
    ...extra
  };
}

/** Full video payload for modal, export, and bulk download. */
export function toVideoDetail(video, extra = {}) {
  return {
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    channelId: video.channelId,
    title: video.title,
    description: video.description,
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnailUrl ?? null,
    durationSeconds: video.durationSeconds ?? null,
    hasTranscript: video.hasTranscript,
    transcriptText: video.transcriptText ?? null,
    transcriptFetchedAt: video.transcriptFetchedAt ?? null,
    sumShort: video.sumShort ?? null,
    sumShortModel: video.sumShortModel ?? null,
    sumLong: video.sumLong ?? null,
    sumLongModel: video.sumLongModel ?? null,
    structuredSummaryJson: video.structuredSummaryJson ?? null,
    productName: video.productName ?? null,
    niche: video.niche ?? null,
    structuredSummaryImportedAt: video.structuredSummaryImportedAt ?? null,
    hasStructuredSummary: !!(
      video.structuredSummaryImportedAt || video.structuredSummaryJson
    ),
    hasShortSummary: !!(video.sumShort && String(video.sumShort).trim()),
    hasLongSummary: !!(video.sumLong && String(video.sumLong).trim()),
    channel: toChannelRef(video.channel),
    ...extra
  };
}

export function serializeVideoRows(videos, fields = 'list', extraById = new Map()) {
  const full = fields === 'full';
  return videos.map((video) => {
    const extra = extraById.get(video.youtubeVideoId) || extraById.get(video.id) || {};
    return full ? toVideoDetail(video, extra) : toVideoListItem(video, extra);
  });
}
