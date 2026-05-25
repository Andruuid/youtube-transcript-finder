import { prisma } from '../db/prismaClient.js';
import { fetchVideoDurationsByIds } from './youtubeCatalogService.js';

/**
 * Fetches missing video lengths from YouTube metadata (not transcripts) and saves them.
 * @param {{ youtubeChannelIds?: string[] }} opts
 */
export async function backfillMissingVideoDurations({ youtubeChannelIds } = {}) {
  const where = {
    durationSeconds: null,
    ...(youtubeChannelIds?.length
      ? { channel: { youtubeChannelId: { in: youtubeChannelIds } } }
      : {})
  };

  const videos = await prisma.video.findMany({
    where,
    select: { id: true, youtubeVideoId: true }
  });
  if (!videos.length) {
    return { updated: 0, checked: 0 };
  }

  const durations = await fetchVideoDurationsByIds(
    videos.map((video) => video.youtubeVideoId)
  );

  let updated = 0;
  for (const video of videos) {
    const durationSeconds = durations.get(video.youtubeVideoId);
    if (!durationSeconds) continue;
    await prisma.video.update({
      where: { id: video.id },
      data: { durationSeconds }
    });
    updated += 1;
  }

  return { updated, checked: videos.length };
}
