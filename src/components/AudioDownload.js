import React, { useState } from 'react';
import './AudioDownload.css';

function parseFilenameFromDisposition(header) {
  if (!header) return 'youtube-audio.mp3';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* fall through */
    }
  }
  const m = /filename="([^"]+)"/i.exec(header);
  if (m) return m[1].trim();
  const m2 = /filename=([^;]+)/i.exec(header);
  if (m2) return m2[1].trim().replace(/^["']|["']$/g, '');
  return 'youtube-audio.mp3';
}

export default function AudioDownload() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const handleDownload = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste a YouTube video URL first.');
      return;
    }
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const res = await fetch('/audio-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed })
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        const raw = await res.text();
        try {
          const j = JSON.parse(raw);
          if (j.error) detail = j.error;
        } catch {
          if (raw) detail = raw.slice(0, 400);
        }
        throw new Error(detail);
      }

      const blob = await res.blob();
      const filename = parseFilenameFromDisposition(
        res.headers.get('Content-Disposition')
      );
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setStatus(`Saved: ${filename}`);
    } catch (e) {
      setError(
        e.message ||
          'Download failed. Is the transcript server running (npm run transcript-server)?'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="audio-download-view" aria-labelledby="audio-download-heading">
      <div className="audio-download-card">
        <h2 id="audio-download-heading" className="audio-download-title">
          Audio download
        </h2>
        <p className="audio-download-hint">
          Paste a standard YouTube video URL. The local server uses yt-dlp (bundled
          with the server package) and ffmpeg-static to save MP3. Keep{' '}
          <code className="audio-download-code">npm run transcript-server</code>{' '}
          running in another terminal while you use this.
        </p>
        <div className="audio-download-row">
          <input
            type="url"
            className="audio-download-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && handleDownload()}
            placeholder="https://www.youtube.com/watch?v=…"
            disabled={busy}
            autoComplete="off"
          />
          <button
            type="button"
            className="search-button audio-download-button"
            onClick={handleDownload}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Download MP3'}
          </button>
        </div>
        {error && <div className="error-message audio-download-message">{error}</div>}
        {status && !error && (
          <p className="audio-download-success" role="status">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
