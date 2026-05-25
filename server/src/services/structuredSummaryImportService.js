import { prisma } from '../db/prismaClient.js';

export function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filenameStem(filename) {
  const name = String(filename || '').trim();
  if (!name) return '';
  return name.replace(/\.json$/i, '');
}

export function validateStructuredSummary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'JSON must be an object' };
  }
  const videoTitle = String(data.video_title || '').trim();
  if (!videoTitle) {
    return { ok: false, error: 'video_title is required' };
  }
  return { ok: true, videoTitle };
}

export function extractSummaryFields(data) {
  const productName = String(data.product_name || '').trim() || null;
  const niche =
    data.marketing && typeof data.marketing === 'object'
      ? String(data.marketing.growth_type || '').trim() || null
      : null;
  return { productName, niche };
}

function buildTitleIndex(videos) {
  const index = new Map();
  for (const video of videos) {
    const key = normalizeTitle(video.title);
    if (!key) continue;
    const list = index.get(key) || [];
    list.push(video);
    index.set(key, list);
  }
  return index;
}

function resolveVideoMatch(titleIndex, normalizedKeys) {
  for (const key of normalizedKeys) {
    if (!key) continue;
    const matches = titleIndex.get(key);
    if (!matches?.length) continue;
    if (matches.length > 1) {
      return { status: 'ambiguous', matches };
    }
    return { status: 'matched', video: matches[0] };
  }
  return { status: 'unmatched' };
}

/**
 * Import structured summaries for one channel, matching by normalized video title.
 * @param {{ youtubeChannelId: string, items: Array<{ filename?: string, data: object }> }}
 */
export async function importStructuredSummaries({ youtubeChannelId, items }) {
  const channel = await prisma.channel.findUnique({
    where: { youtubeChannelId }
  });
  if (!channel) {
    throw new Error('Channel not found');
  }

  const videos = await prisma.video.findMany({
    where: { channelId: channel.id },
    select: {
      id: true,
      youtubeVideoId: true,
      title: true
    }
  });
  const titleIndex = buildTitleIndex(videos);

  const results = [];
  let imported = 0;
  let skipped = 0;
  const now = new Date();

  for (const item of items || []) {
    const filename = String(item?.filename || '').trim() || '(unknown)';
    const validation = validateStructuredSummary(item?.data);
    if (!validation.ok) {
      skipped += 1;
      results.push({
        file: filename,
        status: 'invalid',
        error: validation.error
      });
      continue;
    }

    const { videoTitle } = validation;
    const normalizedTitle = normalizeTitle(videoTitle);
    const normalizedFilename = normalizeTitle(filenameStem(filename));
    const match = resolveVideoMatch(titleIndex, [normalizedTitle, normalizedFilename]);

    if (match.status === 'ambiguous') {
      skipped += 1;
      results.push({
        file: filename,
        status: 'ambiguous',
        videoTitle,
        error: `Multiple videos match title "${videoTitle}"`
      });
      continue;
    }

    if (match.status === 'unmatched') {
      skipped += 1;
      results.push({
        file: filename,
        status: 'unmatched',
        videoTitle,
        error: 'No video found with matching title'
      });
      continue;
    }

    const { productName, niche } = extractSummaryFields(item.data);
    await prisma.video.update({
      where: { id: match.video.id },
      data: {
        structuredSummaryJson: JSON.stringify(item.data),
        productName,
        niche,
        structuredSummaryImportedAt: now
      }
    });

    imported += 1;
    results.push({
      file: filename,
      status: 'imported',
      videoTitle,
      youtubeVideoId: match.video.youtubeVideoId
    });
  }

  return { imported, skipped, results };
}
