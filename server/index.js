import express from 'express';
import { registerAudioDownload } from './audioDownload.js';
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
import { summarizeTranscriptViaOpenRouter } from './src/services/transcriptSummarizeService.js';

const PORT = Number(
  process.env.TRANSCRIPT_SERVER_PORT || process.env.PORT || 3222
);
const app = express();

/** Large transcripts are POSTed to /api/summarize-transcript; keep one generous limit. */
app.use(express.json({ limit: '5mb' }));
registerAudioDownload(app);
if (!String(process.env.YOUTUBE_API_KEY || '').trim()) {
  console.warn('[startup] Missing YOUTUBE_API_KEY; channel sync endpoints will fail until set.');
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
        lastSyncedAt: new Date()
      },
      update: {
        title: channel.title,
        handle: channel.handle,
        lastSyncedAt: new Date()
      }
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
          thumbnailUrl: video.thumbnailUrl
        },
        update: {
          channelId: upsertedChannel.id,
          title: video.title,
          description: video.description,
          publishedAt: new Date(video.publishedAt),
          thumbnailUrl: video.thumbnailUrl
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
        youtubeChannelId: upsertedChannel.youtubeChannelId,
        title: upsertedChannel.title,
        handle: upsertedChannel.handle
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

  return res.json({
    channels: channels.map((channel) => {
      const downloadedCount = channel.videos.filter((v) => v.hasTranscript).length;
      return {
        youtubeChannelId: channel.youtubeChannelId,
        title: channel.title,
        handle: channel.handle,
        lastSyncedAt: channel.lastSyncedAt,
        totalCount: channel._count.videos,
        downloadedCount,
        undownloadedCount: channel._count.videos - downloadedCount
      };
    })
  });
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
  const skip = Math.max(Number(req.query.skip || 0), 0);
  const take = Math.min(Math.max(Number(req.query.take || 100), 1), 200);
  if (!q) {
    return res.json({ total: 0, items: [] });
  }
  try {
    const result = await searchLibrary({
      query: q,
      youtubeChannelId: channelId || undefined,
      skip,
      take
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Search failed' });
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
