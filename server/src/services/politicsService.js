import { prisma } from '../db/prismaClient.js';
import { toVideoListItem } from '../serializers/videoDto.js';
import { formatChannelThumbnailUrl } from './channelThumbnailService.js';
import { syncChannelCatalog } from './channelSyncService.js';

export const POLITICS_SIDES = new Set(['left', 'right']);
export const POLITICS_MAX_CHANNELS_PER_SIDE = 10;

export class PoliticsError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'PoliticsError';
    this.statusCode = statusCode;
  }
}

export function normalizePoliticsSide(value, { allowAll = false } = {}) {
  const side = String(value || '').trim().toLowerCase();
  if (allowAll && (!side || side === 'all')) return 'all';
  if (!POLITICS_SIDES.has(side)) {
    throw new PoliticsError('side must be "left" or "right"');
  }
  return side;
}

function sortMemberships(a, b) {
  if (a.side !== b.side) return a.side.localeCompare(b.side);
  if (a.position !== b.position) return a.position - b.position;
  return (a.channel?.title || '').localeCompare(b.channel?.title || '');
}

function politicsChannelDto(membership, downloadedByChannelId) {
  const channel = membership.channel;
  const totalCount = channel?._count?.videos || 0;
  const downloadedCount = downloadedByChannelId.get(channel.id) || 0;
  return {
    youtubeChannelId: channel.youtubeChannelId,
    title: channel.title,
    handle: channel.handle ?? null,
    thumbnailUrl: formatChannelThumbnailUrl(channel),
    lastSyncedAt: channel.lastSyncedAt ?? null,
    side: membership.side,
    position: membership.position,
    totalCount,
    downloadedCount,
    missingCount: Math.max(0, totalCount - downloadedCount)
  };
}

function sideTotals(items) {
  return items.reduce(
    (totals, item) => ({
      channels: totals.channels + 1,
      totalVideos: totals.totalVideos + item.totalCount,
      downloaded: totals.downloaded + item.downloadedCount,
      missing: totals.missing + item.missingCount
    }),
    { channels: 0, totalVideos: 0, downloaded: 0, missing: 0 }
  );
}

export async function getPoliticsBoard() {
  const memberships = await prisma.politicsChannel.findMany({
    include: {
      channel: {
        include: {
          _count: {
            select: { videos: true }
          }
        }
      }
    }
  });
  memberships.sort(sortMemberships);

  const channelIds = memberships.map((item) => item.channelId);
  const downloadedRows = channelIds.length
    ? await prisma.video.groupBy({
        by: ['channelId'],
        where: {
          channelId: { in: channelIds },
          hasTranscript: true
        },
        _count: { _all: true }
      })
    : [];
  const downloadedByChannelId = new Map(
    downloadedRows.map((row) => [row.channelId, row._count._all])
  );
  const items = memberships.map((membership) =>
    politicsChannelDto(membership, downloadedByChannelId)
  );
  const left = items.filter((item) => item.side === 'left');
  const right = items.filter((item) => item.side === 'right');
  const leftTotals = sideTotals(left);
  const rightTotals = sideTotals(right);

  return {
    left,
    right,
    totals: {
      channels: leftTotals.channels + rightTotals.channels,
      totalVideos: leftTotals.totalVideos + rightTotals.totalVideos,
      downloaded: leftTotals.downloaded + rightTotals.downloaded,
      missing: leftTotals.missing + rightTotals.missing,
      left: leftTotals,
      right: rightTotals
    }
  };
}

export async function addPoliticsChannel({ channelInput, side: rawSide }) {
  const side = normalizePoliticsSide(rawSide);
  const input = String(channelInput || '').trim();
  if (!input) {
    throw new PoliticsError('channelInput is required');
  }

  const syncResult = await syncChannelCatalog({
    channelInput: input,
    limit: 50,
    pageToken: ''
  });
  const channel = await prisma.channel.findUnique({
    where: { youtubeChannelId: syncResult.channel.youtubeChannelId }
  });
  if (!channel) {
    throw new PoliticsError('Synced channel was not stored', 500);
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.politicsChannel.findUnique({
      where: { channelId: channel.id }
    });
    if (existing) {
      throw new PoliticsError('Channel is already on the Politics board', 409);
    }
    const count = await tx.politicsChannel.count({ where: { side } });
    if (count >= POLITICS_MAX_CHANNELS_PER_SIDE) {
      throw new PoliticsError(
        `${side === 'left' ? 'Left' : 'Right'} already has 10 channels`,
        409
      );
    }
    const last = await tx.politicsChannel.aggregate({
      where: { side },
      _max: { position: true }
    });
    await tx.politicsChannel.create({
      data: {
        channelId: channel.id,
        side,
        position: (last._max.position ?? -1) + 1
      }
    });
  });

  return {
    board: await getPoliticsBoard(),
    sync: syncResult
  };
}

/**
 * Pure ordering helper used by the mutation service and unit tests.
 * Items must contain { id, side, position, channel.youtubeChannelId }.
 */
export function buildPoliticsOrder(items, youtubeChannelId, rawSide, rawPosition) {
  const ordered = [...items].sort(sortMemberships);
  const target = ordered.find(
    (item) => item.channel?.youtubeChannelId === youtubeChannelId
  );
  if (!target) {
    throw new PoliticsError('Politics channel not found', 404);
  }
  const destinationSide = rawSide
    ? normalizePoliticsSide(rawSide)
    : target.side;
  const destinationWithoutTarget = ordered.filter(
    (item) => item.id !== target.id && item.side === destinationSide
  );
  if (
    destinationSide !== target.side &&
    destinationWithoutTarget.length >= POLITICS_MAX_CHANNELS_PER_SIDE
  ) {
    throw new PoliticsError(
      `${destinationSide === 'left' ? 'Left' : 'Right'} already has 10 channels`,
      409
    );
  }

  const numericPosition = Number(rawPosition);
  const positionMissing =
    rawPosition === undefined || rawPosition === null || rawPosition === '';
  if (!positionMissing && !Number.isInteger(numericPosition)) {
    throw new PoliticsError('position must be an integer');
  }
  const requestedPosition = positionMissing
    ? destinationWithoutTarget.length
    : numericPosition;
  const insertionIndex = Math.min(
    Math.max(requestedPosition, 0),
    destinationWithoutTarget.length
  );
  destinationWithoutTarget.splice(insertionIndex, 0, {
    ...target,
    side: destinationSide
  });

  const otherSide = destinationSide === 'left' ? 'right' : 'left';
  const other = ordered.filter(
    (item) => item.id !== target.id && item.side === otherSide
  );

  return [
    ...destinationWithoutTarget.map((item, position) => ({
      id: item.id,
      side: destinationSide,
      position
    })),
    ...other.map((item, position) => ({
      id: item.id,
      side: otherSide,
      position
    }))
  ];
}

export async function movePoliticsChannel(
  youtubeChannelId,
  { side, position } = {}
) {
  const id = String(youtubeChannelId || '').trim();
  if (!id) throw new PoliticsError('youtubeChannelId is required');

  const memberships = await prisma.politicsChannel.findMany({
    include: { channel: true }
  });
  const updates = buildPoliticsOrder(memberships, id, side, position);
  await prisma.$transaction(
    updates.map((item) =>
      prisma.politicsChannel.update({
        where: { id: item.id },
        data: { side: item.side, position: item.position }
      })
    )
  );
  return getPoliticsBoard();
}

export async function removePoliticsChannel(youtubeChannelId) {
  const id = String(youtubeChannelId || '').trim();
  const membership = await prisma.politicsChannel.findFirst({
    where: { channel: { youtubeChannelId: id } }
  });
  if (!membership) {
    throw new PoliticsError('Politics channel not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.politicsChannel.delete({ where: { id: membership.id } });
    const remaining = await tx.politicsChannel.findMany({
      where: { side: membership.side },
      orderBy: [{ position: 'asc' }, { id: 'asc' }]
    });
    for (let position = 0; position < remaining.length; position += 1) {
      if (remaining[position].position === position) continue;
      await tx.politicsChannel.update({
        where: { id: remaining[position].id },
        data: { position }
      });
    }
  });
  return getPoliticsBoard();
}

function parseOptionalDate(value, fieldName) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new PoliticsError(`${fieldName} must be a valid date`);
  }
  return date;
}

function queryTokens(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
}

export async function listPoliticsVideos({
  side: rawSide = 'all',
  youtubeChannelId = '',
  status = 'all',
  query = '',
  from = '',
  to = '',
  skip = 0,
  take = 100
} = {}) {
  const side = normalizePoliticsSide(rawSide, { allowAll: true });
  const transcriptStatus = String(status || 'all').toLowerCase();
  if (!['all', 'downloaded', 'missing'].includes(transcriptStatus)) {
    throw new PoliticsError('status must be "all", "downloaded", or "missing"');
  }
  const publishedFrom = parseOptionalDate(from, 'from');
  const publishedTo = parseOptionalDate(to, 'to');
  if (publishedFrom && publishedTo && publishedFrom > publishedTo) {
    throw new PoliticsError('from must be before to');
  }

  const memberships = await prisma.politicsChannel.findMany({
    where: side === 'all' ? {} : { side },
    include: { channel: true }
  });
  const filteredMemberships = youtubeChannelId
    ? memberships.filter(
        (item) => item.channel.youtubeChannelId === youtubeChannelId
      )
    : memberships;
  if (youtubeChannelId && filteredMemberships.length === 0) {
    throw new PoliticsError('Channel is not in the selected Politics scope', 404);
  }
  if (filteredMemberships.length === 0) {
    return { total: 0, items: [] };
  }

  const sideByChannelId = new Map(
    filteredMemberships.map((item) => [item.channelId, item.side])
  );
  const tokens = queryTokens(query);
  const where = {
    channelId: { in: [...sideByChannelId.keys()] },
    ...(transcriptStatus === 'downloaded'
      ? { hasTranscript: true }
      : transcriptStatus === 'missing'
        ? { hasTranscript: false }
        : {}),
    ...(publishedFrom || publishedTo
      ? {
          publishedAt: {
            ...(publishedFrom ? { gte: publishedFrom } : {}),
            ...(publishedTo ? { lte: publishedTo } : {})
          }
        }
      : {}),
    ...(tokens.length
      ? {
          AND: tokens.map((token) => ({
            OR: [
              { title: { contains: token } },
              { description: { contains: token } },
              {
                AND: [
                  { hasTranscript: true },
                  { transcriptText: { contains: token } }
                ]
              }
            ]
          }))
        }
      : {})
  };
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const safeTake = Math.min(Math.max(Number(take) || 100, 1), 200);
  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      include: { channel: true },
      orderBy: { publishedAt: 'desc' },
      skip: safeSkip,
      take: safeTake
    }),
    prisma.video.count({ where })
  ]);

  return {
    total,
    items: videos.map((video) =>
      toVideoListItem(video, {
        politicsSide: sideByChannelId.get(video.channelId)
      })
    )
  };
}
