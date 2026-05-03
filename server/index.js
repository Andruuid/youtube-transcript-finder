/**
 * Local transcript API for the React app (default port 5001).
 * Install and run: cd server && npm install && npm start
 * Uses youtube-transcript for captions; POST /audio-download for MP3 via yt-dlp.
 *
 * Port: TRANSCRIPT_SERVER_PORT or PORT (default 5001). If EADDRINUSE, free the port or
 * pick another port and set "proxy" in the parent package.json to match.
 */
import express from 'express';
// Package "main" is CJS while package.json has "type":"module"; use ESM build explicitly.
import { YoutubeTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';
import { registerAudioDownload } from './audioDownload.js';

const PORT = Number(
  process.env.TRANSCRIPT_SERVER_PORT || process.env.PORT || 5001
);
const app = express();

app.use(express.json({ limit: '64kb' }));
registerAudioDownload(app);

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

app.get('/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!VIDEO_ID_RE.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video id' });
  }
  try {
    const chunks = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = chunks.map((c) => c.text).join(' ');
    return res.json({ transcript });
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
      set TRANSCRIPT_SERVER_PORT=5002
      npm start
    (and in the repo root package.json set "proxy" to "http://localhost:5002")
`);
    process.exit(1);
  }
  throw err;
});
