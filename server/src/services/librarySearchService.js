import { prisma } from '../db/prismaClient.js';

function tokenizeQuery(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function collectMatchSource(video, tokens) {
  const title = String(video.title || '').toLowerCase();
  const description = String(video.description || '').toLowerCase();
  const transcript = String(video.transcriptText || '').toLowerCase();

  for (const token of tokens) {
    if (title.includes(token)) return 'title';
    if (description.includes(token)) return 'description';
    if (video.hasTranscript && transcript.includes(token)) return 'transcript';
  }
  return null;
}

export async function searchLibrary({ query, youtubeChannelId, skip = 0, take = 100 }) {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) {
    return { items: [], total: 0 };
  }

  const channelFilter = youtubeChannelId
    ? {
        channel: {
          youtubeChannelId
        }
      }
    : {};

  const andFilters = tokens.map((token) => ({
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
  }));

  const where = {
    ...channelFilter,
    AND: andFilters
  };

  const [items, total] = await Promise.all([
    prisma.video.findMany({
      where,
      include: { channel: true },
      orderBy: { publishedAt: 'desc' },
      skip,
      take
    }),
    prisma.video.count({ where })
  ]);

  return {
    total,
    items: items.map((video) => ({
      ...video,
      matchSource: collectMatchSource(video, tokens)
    }))
  };
}
