/**
 * POST /audio-download — download audio as MP3 via yt-dlp (youtube-dl-exec).
 * Uses ffmpeg-static for yt-dlp's postprocessor (--ffmpeg-location).
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import ffmpegPath from 'ffmpeg-static';

const require = createRequire(import.meta.url);
const youtubedl = require('youtube-dl-exec');

function isYouTubeHttpUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.replace(/^www\./i, '').toLowerCase();
    return (
      h === 'youtube.com' ||
      h === 'youtu.be' ||
      h === 'm.youtube.com' ||
      h === 'music.youtube.com'
    );
  } catch {
    return false;
  }
}

function sanitizeFileName(name) {
  const s = String(name || 'youtube-audio')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .trim()
    .slice(0, 120);
  return s || 'youtube-audio';
}

const ffmpegDir = ffmpegPath ? dirname(ffmpegPath) : null;

export function registerAudioDownload(app) {
  app.post('/audio-download', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url || !isYouTubeHttpUrl(url)) {
      return res.status(400).json({ error: 'Enter a valid YouTube video URL.' });
    }

    if (!ffmpegDir) {
      return res.status(500).json({
        error: 'ffmpeg-static is missing; cannot build MP3 on this install.'
      });
    }

    const commonFlags = {
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegDir,
      referer: 'https://www.youtube.com/'
    };

    let meta;
    try {
      meta = await youtubedl(url, {
        ...commonFlags,
        dumpSingleJson: true,
        skipDownload: true
      });
    } catch (e) {
      const stderr = e?.stderr || e?.message || String(e);
      console.error('[audio-download] meta', stderr);
      return res.status(400).json({
        error:
          typeof stderr === 'string' && stderr.length < 400
            ? stderr.trim()
            : 'Could not read this video (private, region-blocked, or unsupported).'
      });
    }

    const videoId = meta.id || meta.display_id || 'audio';
    const title = sanitizeFileName(meta.title || meta.fulltitle);

    const tmpDir = join(
      tmpdir(),
      `ytf-audio-${videoId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    try {
      await mkdir(tmpDir, { recursive: true });
      const outputPattern = join(tmpDir, `${videoId}.%(ext)s`);

      await youtubedl(url, {
        ...commonFlags,
        format: 'bestaudio/best',
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: '5',
        output: outputPattern
      });

      const files = await readdir(tmpDir);
      const mp3Name = files.find((f) => f.endsWith('.mp3'));
      if (!mp3Name) {
        return res.status(500).json({
          error: 'Download finished but no MP3 was produced. Check server logs.'
        });
      }

      const mp3Path = join(tmpDir, mp3Name);
      const { size } = await stat(mp3Path);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${title}-${videoId}.mp3"`
      );
      res.setHeader('Content-Length', String(size));

      const rs = createReadStream(mp3Path);
      const cleanup = () =>
        rm(tmpDir, { recursive: true, force: true }).catch(() => {});

      req.on('close', () => {
        rs.destroy();
        cleanup();
      });

      rs.on('error', (err) => {
        console.error('[audio-download] stream', err);
        cleanup();
        if (!res.writableEnded) {
          res.destroy();
        }
      });

      await pipeline(rs, res);
      await cleanup();
    } catch (e) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      const msg = e?.stderr || e?.message || String(e);
      console.error('[audio-download]', msg);
      if (!res.headersSent) {
        return res.status(500).json({
          error:
            typeof msg === 'string' && msg.length < 500
              ? msg.trim()
              : 'Audio download failed (see server terminal for details).'
        });
      }
      if (!res.writableEnded) res.destroy();
    }
  });
}
