import { prisma } from '../db/prismaClient.js';
import { toVideoListItem } from '../serializers/videoDto.js';

function parseQuery(query) {
  const str = String(query || '').trim();
  const phrases = [];
  const tokens = [];

  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(str)) !== null) {
    const phrase = match[1].trim().toLowerCase();
    if (phrase) phrases.push(phrase);
  }

  const remainder = str.replace(/"([^"]+)"/g, ' ');
  for (const part of remainder.toLowerCase().split(/[\s,]+/)) {
    const trimmed = part.trim();
    if (trimmed) tokens.push(trimmed);
  }

  return { tokens, phrases };
}

function titleWords(title) {
  return String(title || '')
    .toLowerCase()
    .split(/[\s\-_|:\[\]()#]+/)
    .filter(Boolean);
}

function collectMatchSource(video, tokens, phrases) {
  const title = String(video.title || '').toLowerCase();
  const description = String(video.description || '').toLowerCase();
  const transcript = String(video.transcriptText || '').toLowerCase();
  const words = titleWords(title);

  for (const phrase of phrases) {
    if (title.includes(phrase)) return 'title';
    if (description.includes(phrase)) return 'description';
    if (video.hasTranscript && transcript.includes(phrase)) return 'transcript';
  }

  for (const token of tokens) {
    if (title.includes(token) || words.some((w) => w.startsWith(token))) return 'title';
    if (description.includes(token)) return 'description';
    if (video.hasTranscript && transcript.includes(token)) return 'transcript';
  }
  return null;
}

function scoreVideo(video, tokens, phrases) {
  let score = 0;
  const title = String(video.title || '').toLowerCase();
  const description = String(video.description || '').toLowerCase();
  const transcript = String(video.transcriptText || '').toLowerCase();
  const words = titleWords(title);

  for (const phrase of phrases) {
    if (title.includes(phrase)) score += 220;
    else if (description.includes(phrase)) score += 60;
    else if (video.hasTranscript && transcript.includes(phrase)) score += 30;
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 120;
      if (words.some((w) => w.startsWith(token))) score += 25;
    } else if (words.some((w) => w.startsWith(token) && token.length >= 2)) {
      score += 90;
    } else if (description.includes(token)) {
      score += 45;
    } else if (video.hasTranscript && transcript.includes(token)) {
      score += 20;
    }
  }

  return score;
}

function buildTokenFilter(token) {
  return {
    OR: [
      { title: { contains: token } },
      { description: { contains: token } },
      {
        AND: [{ hasTranscript: true }, { transcriptText: { contains: token } }]
      }
    ]
  };
}

function buildPhraseFilter(phrase) {
  return {
    OR: [
      { title: { contains: phrase } },
      { description: { contains: phrase } },
      {
        AND: [{ hasTranscript: true }, { transcriptText: { contains: phrase } }]
      }
    ]
  };
}

export async function searchLibrary({
  query,
  youtubeChannelId,
  youtubeChannelIds,
  skip = 0,
  take = 100,
  downloadedOnly = false
}) {
  const { tokens, phrases } = parseQuery(query);
  if (!tokens.length && !phrases.length) {
    return { items: [], total: 0 };
  }

  const channelIds = youtubeChannelIds?.length
    ? youtubeChannelIds
    : youtubeChannelId
    ? [youtubeChannelId]
    : [];

  const channelFilter = channelIds.length
    ? {
        channel: {
          youtubeChannelId: { in: channelIds }
        }
      }
    : {};

  const transcriptFilter = downloadedOnly ? { hasTranscript: true } : {};

  const textFilters = [
    ...phrases.map((phrase) => buildPhraseFilter(phrase)),
    ...tokens.map((token) => buildTokenFilter(token))
  ];

  const where = {
    ...channelFilter,
    ...transcriptFilter,
    AND: textFilters
  };

  const [rawItems, total] = await Promise.all([
    prisma.video.findMany({
      where,
      include: { channel: true },
      orderBy: { publishedAt: 'desc' },
      skip: 0,
      take: Math.min(Math.max(take + skip, take), 500)
    }),
    prisma.video.count({ where })
  ]);

  const scored = rawItems
    .map((video) => ({
      video,
      score: scoreVideo(video, tokens, phrases),
      matchSource: collectMatchSource(video, tokens, phrases)
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.video.publishedAt) - new Date(a.video.publishedAt);
    });

  const page = scored.slice(skip, skip + take);

  return {
    total,
    items: page.map(({ video, matchSource }) =>
      toVideoListItem(video, { matchSource })
    )
  };
}
