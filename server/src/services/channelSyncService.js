import { prisma } from '../db/prismaClient.js';
import {
  fetchChannelVideos,
  resolveChannel
} from './youtubeCatalogService.js';
import {
  formatChannelThumbnailUrl,
  persistChannelThumbnail
} from './channelThumbnailService.js';

/**
 * Resolves a YouTube channel, refreshes one uploads-playlist page, and upserts
 * its catalog rows. The return value intentionally matches /api/channels/sync.
 */
export async function syncChannelCatalog({
  channelInput,
  limit = 50,
  pageToken = '',
  minDurationSeconds = 0
}) {
  const input = String(channelInput || '').trim();
  if (!input) {
    throw new Error('channelInput is required');
  }

  const channel = await resolveChannel(input);
  const upsertedChannel = await prisma.channel.upsert({
    where: { youtubeChannelId: channel.youtubeChannelId },
    create: {
      youtubeChannelId: channel.youtubeChannelId,
      title: channel.title,
      handle: channel.handle,
      uploadsPlaylistId: channel.uploadsPlaylistId,
      thumbnailUrl: channel.thumbnailUrl,
      lastSyncedAt: new Date()
    },
    update: {
      title: channel.title,
      handle: channel.handle,
      uploadsPlaylistId: channel.uploadsPlaylistId,
      thumbnailUrl: channel.thumbnailUrl,
      lastSyncedAt: new Date()
    }
  });

  if (channel.thumbnailUrl) {
    try {
      await persistChannelThumbnail(upsertedChannel.id, channel.thumbnailUrl);
    } catch (error) {
      console.warn(
        '[channel-sync] thumbnail download failed',
        channel.youtubeChannelId,
        error?.message || error
      );
    }
  }

  const { videos, nextPageToken } = await fetchChannelVideos(
    channel.uploadsPlaylistId,
    limit,
    pageToken
  );
  const minimumDuration = Math.max(
    Math.floor(Number(minDurationSeconds) || 0),
    0
  );
  const eligibleVideos = videos.filter(
    (video) =>
      minimumDuration === 0 ||
      (video.durationSeconds != null &&
        video.durationSeconds >= minimumDuration)
  ).length;

  for (const video of videos) {
    await prisma.video.upsert({
      where: { youtubeVideoId: video.youtubeVideoId },
      create: {
        channelId: upsertedChannel.id,
        youtubeVideoId: video.youtubeVideoId,
        title: video.title,
        description: video.description,
        publishedAt: new Date(video.publishedAt),
        thumbnailUrl: video.thumbnailUrl,
        durationSeconds: video.durationSeconds ?? null
      },
      update: {
        channelId: upsertedChannel.id,
        title: video.title,
        description: video.description,
        publishedAt: new Date(video.publishedAt),
        thumbnailUrl: video.thumbnailUrl,
        durationSeconds: video.durationSeconds ?? null
      }
    });
  }

  const counts = await prisma.video.groupBy({
    by: ['hasTranscript'],
    where: { channelId: upsertedChannel.id },
    _count: { _all: true }
  });
  const downloadedCount =
    counts.find((row) => row.hasTranscript)?._count._all || 0;
  const totalCount = counts.reduce((acc, row) => acc + row._count._all, 0);
  const channelWithThumbnail = await prisma.channel.findUnique({
    where: { id: upsertedChannel.id }
  });

  return {
    channel: {
      youtubeChannelId: channelWithThumbnail.youtubeChannelId,
      title: channelWithThumbnail.title,
      handle: channelWithThumbnail.handle,
      thumbnailUrl: formatChannelThumbnailUrl(channelWithThumbnail)
    },
    syncedVideos: videos.length,
    eligibleVideos,
    totalCount,
    downloadedCount,
    undownloadedCount: totalCount - downloadedCount,
    nextPageToken
  };
}
