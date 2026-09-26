import express from 'express';
import { prisma } from './src/db/prismaClient.js';
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
  toThumbnailBuffer
} from './src/services/channelThumbnailService.js';
import { syncChannelCatalog } from './src/services/channelSyncService.js';
import {
  addPoliticsChannel,
  getPoliticsBoard,
  listPoliticsVideos,
  movePoliticsChannel,
  PoliticsError,
  removePoliticsChannel
} from './src/services/politicsService.js';
import { importStructuredSummaries } from './src/services/structuredSummaryImportService.js';
import {
  deleteIdea,
  getIdeaByVideoId,
  listIdeas,
  saveIdea,
  updateIdea
} from './src/services/ideaService.js';
import {
  clearAccessCookie,
  createAccessAuthMiddleware,
  getAccessPassword,
  isAccessRequired,
  isAuthenticated,
  setAccessCookie
} from './src/middleware/accessAuth.js';
import {
  serializeVideoRows,
  toVideoDetail
} from './src/serializers/videoDto.js';

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

if (isAccessRequired()) {
  console.log('[startup] Shared access password is enabled (ACCESS_PASSWORD).');
} else {
  console.log('[startup] No ACCESS_PASSWORD set; API is open to anyone who can reach this server.');
}

app.get('/api/auth/session', (req, res) => {
  const required = isAccessRequired();
  return res.json({
    required,
    authenticated: !required || isAuthenticated(req)
  });
});

app.post('/api/auth/login', (req, res) => {
  const expected = getAccessPassword();
  if (!expected) {
    return res.json({ ok: true });
  }
  const password = String(req.body?.password || '');
  if (password !== expected) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  setAccessCookie(res, req, password);
  return res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  clearAccessCookie(res, req);
  return res.json({ ok: true });
});

app.use(createAccessAuthMiddleware());

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
  const minDurationSeconds = Math.max(
    Math.floor(Number(req.body?.minDurationSeconds) || 0),
    0
  );
  if (!channelInput) {
    return res.status(400).json({ error: 'channelInput is required' });
  }

  try {
    const result = await syncChannelCatalog({
      channelInput,
      limit,
      pageToken,
      minDurationSeconds
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Channel sync failed' });
  }
});

app.get('/api/channels', async (_req, res) => {
  const channels = await prisma.channel.findMany({
    include: {
      _count: {
        select: { videos: true }
      }
    },
    orderBy: { title: 'asc' }
  });

  const downloadedRows = await prisma.video.groupBy({
    by: ['channelId'],
    where: { hasTranscript: true },
    _count: { _all: true }
  });
  const downloadedByChannelId = new Map(
    downloadedRows.map((row) => [row.channelId, row._count._all])
  );

  void backfillMissingChannelThumbnails(channels);

  return res.json({
    channels: channels.map((channel) => {
      const downloadedCount = downloadedByChannelId.get(channel.id) || 0;
      const totalCount = channel._count.videos;
      return {
        youtubeChannelId: channel.youtubeChannelId,
        title: channel.title,
        handle: channel.handle,
        thumbnailUrl: formatChannelThumbnailUrl(channel),
        lastSyncedAt: channel.lastSyncedAt,
        totalCount,
        downloadedCount,
        undownloadedCount: totalCount - downloadedCount
      };
    })
  });
});

function politicsErrorStatus(error) {
  return error instanceof PoliticsError
    ? error.statusCode
    : error?.code === 'P2025'
      ? 404
      : 500;
}

app.get('/api/politics', async (_req, res) => {
  try {
    return res.json({ board: await getPoliticsBoard() });
  } catch (error) {
    return res.status(politicsErrorStatus(error)).json({
      error: error?.message || 'Failed to load Politics board'
    });
  }
});

app.post('/api/politics/channels', async (req, res) => {
  try {
    const result = await addPoliticsChannel({
      channelInput: req.body?.channelInput,
      side: req.body?.side
    });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(politicsErrorStatus(error)).json({
      error: error?.message || 'Failed to add Politics channel'
    });
  }
});

app.patch('/api/politics/channels/:youtubeChannelId', async (req, res) => {
  try {
    const board = await movePoliticsChannel(req.params.youtubeChannelId, {
      side: req.body?.side,
      position: req.body?.position
    });
    return res.json({ board });
  } catch (error) {
    return res.status(politicsErrorStatus(error)).json({
      error: error?.message || 'Failed to move Politics channel'
    });
  }
});

app.delete('/api/politics/channels/:youtubeChannelId', async (req, res) => {
  try {
    const board = await removePoliticsChannel(req.params.youtubeChannelId);
    return res.json({ ok: true, board });
  } catch (error) {
    return res.status(politicsErrorStatus(error)).json({
      error: error?.message || 'Failed to remove Politics channel'
    });
  }
});

app.get('/api/politics/videos', async (req, res) => {
  try {
    const result = await listPoliticsVideos({
      side: req.query.side,
      youtubeChannelId: String(req.query.channelId || '').trim(),
      status: req.query.status,
      query: req.query.q,
      from: req.query.from,
      to: req.query.to,
      skip: req.query.skip,
      take: req.query.take
    });
    return res.json(result);
  } catch (error) {
    return res.status(politicsErrorStatus(error)).json({
      error: error?.message || 'Failed to load Politics videos'
    });
  }
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
    const politicsMembership = await prisma.politicsChannel.findFirst({
      where: {
        channel: { youtubeChannelId }
      }
    });
    if (politicsMembership) {
      return res.status(409).json({
        error:
          'Channel belongs to the Politics board. Remove it from Politics before deleting it from the library.'
      });
    }
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
  const minDurationSeconds = Math.max(
    Math.floor(Number(req.query.minDurationSeconds) || 0),
    0
  );

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
      : {}),
    ...(minDurationSeconds > 0
      ? { durationSeconds: { gte: minDurationSeconds } }
      : {})
  };
  const fields = String(req.query.fields || 'list').toLowerCase() === 'full' ? 'full' : 'list';

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

  return res.json({ total, items: serializeVideoRows(items, fields) });
});

app.get('/api/videos/:youtubeVideoId', async (req, res) => {
  const youtubeVideoId = String(req.params.youtubeVideoId || '').trim();
  if (!youtubeVideoId) {
    return res.status(400).json({ error: 'Missing video id' });
  }

  const video = await prisma.video.findUnique({
    where: { youtubeVideoId },
    include: { channel: true }
  });
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  return res.json({ video: toVideoDetail(video) });
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

app.patch('/api/ideas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid idea id' });
  }
  try {
    const idea = await updateIdea(id, req.body || {});
    return res.json({ idea });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Idea not found' });
    }
    const status = error.message === 'No fields to update' ? 400 : 400;
    return res.status(status).json({ error: error.message || 'Failed to update idea' });
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

async function startServer() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  } catch (error) {
    console.warn('[startup] SQLite pragma setup failed:', error.message);
  }

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
}

startServer();
