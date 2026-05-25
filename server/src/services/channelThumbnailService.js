import { prisma } from '../db/prismaClient.js';
import { resolveChannel } from './youtubeCatalogService.js';

/** Bumped when thumbnail bytes/serving changes — busts stale browser img cache. */
const THUMBNAIL_CACHE_VERSION = 2;

export function channelThumbnailApiPath(youtubeChannelId) {
  return `/api/channels/${encodeURIComponent(youtubeChannelId)}/thumbnail`;
}

export function formatChannelThumbnailUrl(channel) {
  if (!channel?.youtubeChannelId) {
    return null;
  }
  const params = new URLSearchParams();
  params.set('v', String(THUMBNAIL_CACHE_VERSION));
  if (channel.updatedAt) {
    params.set('t', String(new Date(channel.updatedAt).getTime()));
  } else if (channelHasStoredThumbnail(channel)) {
    params.set('t', String(channel.thumbnailData.length));
  }
  return `${channelThumbnailApiPath(channel.youtubeChannelId)}?${params.toString()}`;
}

export function channelHasStoredThumbnail(channel) {
  const data = channel?.thumbnailData;
  return Boolean(data && (Buffer.isBuffer(data) ? data.length : data.length));
}

export function toThumbnailBuffer(thumbnailData) {
  if (!thumbnailData) {
    return null;
  }
  return Buffer.isBuffer(thumbnailData) ? thumbnailData : Buffer.from(thumbnailData);
}

async function downloadThumbnailFromUrl(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: { Accept: 'image/*' }
  });
  if (!res.ok) {
    throw new Error(`Thumbnail download failed (${res.status})`);
  }
  const mimeType = String(res.headers.get('content-type') || 'image/jpeg')
    .split(';')[0]
    .trim();
  const data = Buffer.from(await res.arrayBuffer());
  if (!data.length) {
    throw new Error('Thumbnail download returned empty body');
  }
  return { data, mimeType };
}

export async function persistChannelThumbnail(channelDbId, sourceUrl) {
  const trimmed = String(sourceUrl || '').trim();
  if (!trimmed) {
    return null;
  }

  const { data, mimeType } = await downloadThumbnailFromUrl(trimmed);
  return prisma.channel.update({
    where: { id: channelDbId },
    data: {
      thumbnailUrl: trimmed,
      thumbnailData: data,
      thumbnailMimeType: mimeType
    }
  });
}

async function resolveSourceUrl(channel) {
  const existing = String(channel.thumbnailUrl || '').trim();
  if (existing) {
    return existing;
  }
  const resolved = await resolveChannel(channel.youtubeChannelId);
  return resolved.thumbnailUrl;
}

export async function ensureChannelThumbnail(channel) {
  if (channelHasStoredThumbnail(channel)) {
    return channel;
  }

  const sourceUrl = await resolveSourceUrl(channel);
  if (!sourceUrl) {
    return channel;
  }

  return persistChannelThumbnail(channel.id, sourceUrl);
}

export async function backfillMissingChannelThumbnails(channels) {
  const pending = channels.filter((channel) => !channelHasStoredThumbnail(channel));
  if (!pending.length) {
    return;
  }

  await Promise.all(
    pending.map((channel) =>
      ensureChannelThumbnail(channel).catch((error) => {
        console.warn(
          '[channel-thumbnail] backfill failed',
          channel.youtubeChannelId,
          error?.message || error
        );
      })
    )
  );
}

export async function getStoredChannelThumbnail(youtubeChannelId) {
  const channel = await prisma.channel.findUnique({
    where: { youtubeChannelId },
    select: {
      id: true,
      youtubeChannelId: true,
      title: true,
      handle: true,
      thumbnailUrl: true,
      thumbnailData: true,
      thumbnailMimeType: true
    }
  });
  if (!channel) {
    return null;
  }
  if (channelHasStoredThumbnail(channel)) {
    return channel;
  }

  try {
    return await ensureChannelThumbnail(channel);
  } catch (error) {
    console.warn(
      '[channel-thumbnail] fetch failed',
      youtubeChannelId,
      error?.message || error
    );
    return channel;
  }
}
