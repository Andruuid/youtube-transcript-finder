import express from 'express';
import { prisma } from './src/db/prismaClient.js';
import {
  fetchChannelVideos,
  resolveChannel
} from './src/services/youtubeCatalogService.js';
import {
  assertVideoId,
  fetchAndPersistTranscript,
  fetchTranscriptText
} from './src/services/transcriptService.js';
import { searchLibrary } from './src/services/librarySearchService.js';
import { backfillMissingVideoDurations } from './src/services/videoDurationService.js';
import { summarizeTranscriptViaOpenRouter } from './src/services/transcriptSummarizeService.js';
import {
  backfillMissingChannelThumbnails,
  formatChannelThumbnailUrl,
  getStoredChannelThumbnail,
  persistChannelThumbnail,
  toThumbnailBuffer
} from './src/services/channelThumbnailService.js';
import { importStructuredSummaries } from './src/services/structuredSummaryImportService.js';
import {
  deleteIdea,
  getIdeaByVideoId,
  listIdeas,
  saveIdea
} from './src/services/ideaService.js';

const PORT = Number(
  process.env.TRANSCRIPT_SERVER_PORT || process.env.PORT || 3222
);
const app = express();

/** Large transcripts are POSTed to /api/summarize-transcript; keep one generous limit. */
app.use(express.json({ limit: '5mb' }));
const youtubeApiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
if (!youtubeApiKey) {
  console.warn('[startup] Missing YOUTUBE_API_KEY; channel sync/import will fail until set in server/.env.');
} else if (youtubeApiKey === 'your_youtube_data_api_key') {
  console.warn(
    '[startup] YOUTUBE_API_KEY is still the placeholder in server/.env. Channel import/sync will fail until you set a real YouTube Data API v3 key and restart.'
  );
}

app.get('/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    assertVideoId(videoId);
  } catch {
    return res.status(400).json({ error: 'Invalid video id' });
  }

  const stored = await prisma.video.findUnique({
    where: { youtubeVideoId: videoId },
    select: { transcriptText: true, hasTranscript: true }
  });
  if (stored?.hasTranscript && stored.transcriptText) {
    return res.json({ transcript: stored.transcriptText, source: 'database' });
  }

  try {
    const transcript = await fetchTranscriptText(videoId);
    return res.json({ transcript, source: 'youtube' });
  } catch (e) {
    const message = e?.message || String(e);
    console.error('[transcript]', videoId, message);
    return res.status(500).json({
      error:
        message.includes('disabled') || message.includes('not available')
          ? 'Transcript not available for this video (YouTube may block or omit captions).'
          : message
    });
  }
});

app.post('/api/channels/sync', async (req, res) => {
  const channelInput = String(req.body?.channelInput || '').trim();
  const limit = Number(req.body?.limit || 50);
  const pageToken = String(req.body?.pageToken || '').trim();
  if (!channelInput) {
    return res.status(400).json({ error: 'channelInput is required' });
  }

  try {
    const channel = await resolveChannel(channelInput);
    const upsertedChannel = await prisma.channel.upsert({
      where: { youtubeChannelId: channel.youtubeChannelId },
      create: {
        youtubeChannelId: channel.youtubeChannelId,
        title: channel.title,
        handle: channel.handle,
        thumbnailUrl: channel.thumbnailUrl,
        lastSyncedAt: new Date()
      },
      update: {
        title: channel.title,
        handle: channel.handle,
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

    const channelWithThumbnail = await prisma.channel.findUnique({
      where: { id: upsertedChannel.id }
    });

    const { videos, nextPageToken } = await fetchChannelVideos(
      channel.youtubeChannelId,
      limit,
      pageToken
    );

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

    return res.json({
      channel: {
        youtubeChannelId: channelWithThumbnail.youtubeChannelId,
        title: channelWithThumbnail.title,
        handle: channelWithThumbnail.handle,
        thumbnailUrl: formatChannelThumbnailUrl(channelWithThumbnail)
      },
      syncedVideos: videos.length,
      totalCount,
      downloadedCount,
      undownloadedCount: totalCount - downloadedCount,
      nextPageToken
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Channel sync failed' });
  }
});

app.get('/api/channels', async (_req, res) => {
  const channels = await prisma.channel.findMany({
    include: {
      _count: {
        select: { videos: true }
      },
      videos: {
        select: { hasTranscript: true }
      }
    },
    orderBy: { title: 'asc' }
  });

  void backfillMissingChannelThumbnails(channels);

  return res.json({
    channels: channels.map((channel) => {
      const downloadedCount = channel.videos.filter((v) => v.hasTranscript).length;
      return {
        youtubeChannelId: channel.youtubeChannelId,
        title: channel.title,
        handle: channel.handle,
        thumbnailUrl: formatChannelThumbnailUrl(channel),
        lastSyncedAt: channel.lastSyncedAt,
        totalCount: channel._count.videos,
        downloadedCount,
        undownloadedCount: channel._count.videos - downloadedCount
      };
    })
  });
});

app.get('/api/channels/:youtubeChannelId/thumbnail', async (req, res) => {
  const youtubeChannelId = String(req.params.youtubeChannelId || '').trim();
  if (!youtubeChannelId) {
    return res.status(400).json({ error: 'Missing channel id' });
  }

  const channel = await getStoredChannelThumbnail(youtubeChannelId);
  const body = toThumbnailBuffer(channel?.thumbnailData);
  if (!body?.length) {
    return res.status(404).json({ error: 'Channel thumbnail not found' });
  }

  res.type(channel.thumbnailMimeType || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  return res.end(body);
});

app.delete('/api/channels/:youtubeChannelId', async (req, res) => {
  const youtubeChannelId = String(req.params.youtubeChannelId || '').trim();
  if (!youtubeChannelId) {
    return res.status(400).json({ error: 'Missing channel id' });
  }
  try {
    await prisma.channel.delete({
      where: { youtubeChannelId }
    });
    return res.json({ ok: true });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Channel not found' });
    }
    return res.status(500).json({
      error: error?.message || 'Failed to remove channel'
    });
  }
});

app.get('/api/channels/:youtubeChannelId/videos', async (req, res) => {
  const youtubeChannelId = String(req.params.youtubeChannelId || '');
  const status = String(req.query.status || 'all');
  const skip = Math.max(Number(req.query.skip || 0), 0);
  const take = Math.min(Math.max(Number(req.query.take || 100), 1), 200);

  const channel = await prisma.channel.findUnique({
    where: { youtubeChannelId }
  });
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const where = {
    channelId: channel.id,
    ...(status === 'downloaded'
      ? { hasTranscript: true }
      : status === 'missing'
      ? { hasTranscript: false }
      : {})
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

  return res.json({ total, items });
});

app.post('/api/channels/:youtubeChannelId/import-structured-summaries', async (req, res) => {
  const youtubeChannelId = String(req.params.youtubeChannelId || '').trim();
  if (!youtubeChannelId) {
    return res.status(400).json({ error: 'Missing channel id' });
  }

  const rawItems = req.body?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  const items = rawItems.map((item, index) => {
    const filename = String(item?.filename || `item-${index + 1}.json`).trim();
    const data = item?.data;
    return { filename, data };
  });

  try {
    const result = await importStructuredSummaries({ youtubeChannelId, items });
    return res.json(result);
  } catch (error) {
    if (error?.message === 'Channel not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error?.message || 'Structured summary import failed'
    });
  }
});

app.post('/api/videos/backfill-durations', async (req, res) => {
  const raw = req.body?.channelIds;
  const youtubeChannelIds = Array.isArray(raw)
    ? raw.map(String).map((id) => id.trim()).filter(Boolean)
    : String(raw || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

  try {
    const result = await backfillMissingVideoDurations({
      youtubeChannelIds: youtubeChannelIds.length ? youtubeChannelIds : undefined
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Duration backfill failed' });
  }
});

app.post('/api/videos/:youtubeVideoId/download-transcript', async (req, res) => {
  const videoId = String(req.params.youtubeVideoId || '');
  try {
    assertVideoId(videoId);
  } catch {
    return res.status(400).json({ error: 'Invalid video id' });
  }

  try {
    const existing = await prisma.video.findUnique({
      where: { youtubeVideoId: videoId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Video not found in library; sync channel first.' });
    }
    if (existing.hasTranscript && existing.transcriptText) {
      return res.json({
        videoId,
        transcript: existing.transcriptText,
        transcriptFetchedAt: existing.transcriptFetchedAt,
        source: 'database'
      });
    }
    const payload = await fetchAndPersistTranscript(videoId);
    return res.json({
      videoId,
      transcript: payload.transcriptText,
      transcriptFetchedAt: payload.video.transcriptFetchedAt
    });
  } catch (error) {
    const message = error?.message || String(error);
    return res.status(500).json({ error: message });
  }
});

app.post('/api/summarize-transcript', async (req, res) => {
  const transcript = String(req.body?.transcript ?? '');
  const youtubeVideoId = String(req.body?.youtubeVideoId ?? '').trim();
  const modeRaw = String(req.body?.mode || '').toLowerCase();
  const mode = modeRaw === 'long' ? 'long' : modeRaw === 'short' ? 'short' : '';

  if (!mode) {
    return res.status(400).json({ error: 'mode must be "short" or "long"' });
  }

  try {
    const { summary, model } = await summarizeTranscriptViaOpenRouter({ transcript, mode });

    if (youtubeVideoId) {
      try {
        assertVideoId(youtubeVideoId);
        const data =
          mode === 'short'
            ? { sumShort: summary, sumShortModel: model }
            : { sumLong: summary, sumLongModel: model };
        const updated = await prisma.video.updateMany({
          where: { youtubeVideoId },
          data
        });
        if (updated.count === 0) {
          console.warn('[summarize-transcript] no Video row for youtubeVideoId', youtubeVideoId);
        }
      } catch (persistErr) {
        console.error('[summarize-transcript] failed to persist summary', persistErr);
      }
    }

    return res.json({ summary, model });
  } catch (error) {
    const message = error?.message || String(error);
    console.error('[summarize-transcript] failed', { mode, message, stack: error?.stack });
    return res.status(500).json({ error: message });
  }
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const channelId = String(req.query.channelId || '').trim();
  const channelIdsParam = String(req.query.channelIds || '').trim();
  const downloadedOnly =
    req.query.downloadedOnly === '1' || req.query.downloadedOnly === 'true';
  const skip = Math.max(Number(req.query.skip || 0), 0);
  const take = Math.min(Math.max(Number(req.query.take || 100), 1), 200);
  if (!q) {
    return res.json({ total: 0, items: [] });
  }
  try {
    let youtubeChannelIds;
    if (channelIdsParam) {
      youtubeChannelIds = channelIdsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (channelId) {
      youtubeChannelIds = [channelId];
    }
    const result = await searchLibrary({
      query: q,
      youtubeChannelIds,
      skip,
      take,
      downloadedOnly
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Search failed' });
  }
});

app.get('/api/ideas', async (_req, res) => {
  try {
    const items = await listIdeas();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load ideas' });
  }
});

app.get('/api/ideas/by-video/:youtubeVideoId', async (req, res) => {
  const youtubeVideoId = String(req.params.youtubeVideoId || '').trim();
  if (!youtubeVideoId) {
    return res.status(400).json({ error: 'youtubeVideoId is required' });
  }
  try {
    const idea = await getIdeaByVideoId(youtubeVideoId);
    return res.json({ idea: idea || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load idea' });
  }
});

app.post('/api/ideas', async (req, res) => {
  try {
    const idea = await saveIdea(req.body || {});
    return res.json({ idea });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save idea' });
  }
});

app.delete('/api/ideas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid idea id' });
  }
  try {
    await deleteIdea(id);
    return res.json({ ok: true });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Idea not found' });
    }
    return res.status(500).json({ error: error.message || 'Failed to delete idea' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Transcript server listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
Port ${PORT} is already in use.

  • Stop whatever is listening (another transcript server, old terminal), or
  • Free the port on Windows — find the PID, then kill it:
      netstat -ano | findstr :${PORT}
      taskkill /PID <pid_from_last_column> /F

  • Or use a different port, then point the React app at it:
      set TRANSCRIPT_SERVER_PORT=3223
      npm start
    (and in the repo root package.json set "proxy" to "http://localhost:3223")
`);
    process.exit(1);
  }
  throw err;
});
