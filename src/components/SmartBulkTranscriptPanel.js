import React, { useState } from 'react';
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

  const clampTarget = (n) =>
    Math.min(TARGET_MAX, Math.max(TARGET_MIN, Number.isFinite(n) ? Math.floor(n) : TARGET_MIN));

  const run = async () => {
    const n = clampTarget(targetCount);
    setTargetCount(n);
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setLine('Starting…');
    try {
      await syncCatalogThenFetchMissingTranscripts({
        channelInput: youtubeChannelId,
        youtubeChannelId,
        targetCount: n,
        onProgress: (ev) => {
          if (ev?.message) setLine(ev.message);
        }
      });
      setLine(`Done. Target was newest ${n} video(s); check counts above.`);
      await onFinished?.();
    } catch (e) {
      setError(e?.message || 'Bulk sync/download failed');
      setLine('');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
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
        if 100 of 200 are already saved, only the remaining 100 are fetched. Uses the focused channel
        row (not every checkbox).
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
      </div>
      {line && <p className="channel-smart-bulk-status">{line}</p>}
      {error && <p className="error-message channel-bulk-status">{error}</p>}
    </div>
  );
}
