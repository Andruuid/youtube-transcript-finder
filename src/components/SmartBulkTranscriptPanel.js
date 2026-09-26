import React, { useEffect, useRef, useState } from 'react';
import { syncCatalogThenFetchMissingTranscripts } from '../services/channelBulkPipeline';

const TARGET_MIN = 1;
const TARGET_MAX = 500;

export default function SmartBulkTranscriptPanel({
  youtubeChannelId,
  channelTitle,
  disabled,
  otherBulkBusy,
  onBusyChange,
  onFinished
}) {
  const [targetCount, setTargetCount] = useState(200);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const clampTarget = (n) =>
    Math.min(TARGET_MAX, Math.max(TARGET_MIN, Number.isFinite(n) ? Math.floor(n) : TARGET_MIN));

  const run = async () => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const n = clampTarget(targetCount);
    setTargetCount(n);
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setLine('Starting…');
    try {
      const result = await syncCatalogThenFetchMissingTranscripts({
        channelInput: youtubeChannelId,
        youtubeChannelId,
        targetCount: n,
        signal: controller.signal,
        onProgress: (ev) => {
          if (!controller.signal.aborted && ev?.message) setLine(ev.message);
        }
      });
      const fails = result.transcriptFailures || [];
      let summary = `Done: ${result.transcriptsDownloaded} transcript(s) downloaded`;
      if (fails.length > 0) {
        const firstMessage = fails[0]?.message || 'captions unavailable';
        const sameMessage = fails.every((failure) => failure.message === firstMessage);
        summary += sameMessage
          ? `; ${fails.length} failed. ${firstMessage}`
          : `; ${fails.length} failed. First error: ${firstMessage}`;
      }
      summary += `. Target newest ${n} videos — refresh counts above.`;
      setLine(summary);
    } catch (e) {
      if (controller.signal.aborted || e?.name === 'AbortError') {
        setLine('Stopped. Saved transcripts are kept. Start again to fetch the remaining ones.');
        setError('');
      } else {
        setError(e?.message || 'Bulk sync/download failed');
        setLine('');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      onBusyChange?.(false);
      try {
        await onFinished?.();
      } catch (refreshError) {
        setError((previous) => previous || refreshError?.message || 'Could not refresh channel counts');
      }
    }
  };

  const blocked = disabled || busy || otherBulkBusy;

  return (
    <div className="channel-smart-bulk-panel">
      <div className="channel-smart-bulk-title">
        Deep catalog + transcripts
        {channelTitle ? (
          <span className="channel-smart-bulk-channel"> — {channelTitle}</span>
        ) : null}
      </div>
      <p className="channel-smart-bulk-help">
        Loads up to your target count of <strong>newest</strong> videos from YouTube using sequential
        pages (50 per API call). Then downloads transcripts only for rows that do not have one yet—so
        if 100 of 200 are already saved, only the remaining 100 are fetched. Runs on the channel you
        focus in the sidebar (click the channel name; checking the box also focuses that row).
      </p>
      <div className="channel-smart-bulk-row">
        <label className="channel-smart-bulk-label" htmlFor="smart-bulk-target">
          Newest videos (target)
        </label>
        <input
          id="smart-bulk-target"
          type="number"
          min={TARGET_MIN}
          max={TARGET_MAX}
          className="channel-smart-bulk-input"
          value={targetCount}
          onChange={(e) => setTargetCount(clampTarget(Number(e.target.value)))}
          disabled={blocked}
        />
        <button
          type="button"
          className="search-button channel-smart-bulk-button"
          onClick={run}
          disabled={blocked || !youtubeChannelId}
        >
          {busy ? 'Working…' : 'Sync pages & fill transcripts'}
        </button>
        <button
          type="button"
          className="search-button channel-smart-bulk-button"
          onClick={() => abortRef.current?.abort()}
          disabled={!busy}
        >
          Stop
        </button>
      </div>
      {line && <p className="channel-smart-bulk-status" role="status">{line}</p>}
      {error && <p className="error-message channel-bulk-status">{error}</p>}
    </div>
  );
}
