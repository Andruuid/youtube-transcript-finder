import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ChannelMonitor.css';
import {
  resolveChannel,
  checkChannelsForNewVideos,
  getVideoTranscript
} from '../services/youtubeService';

const STORAGE_KEY = 'ytf_saved_channels';

function formatLocalDateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadChannels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c) => c && typeof c.id === 'string' && typeof c.input === 'string'
    );
  } catch {
    return [];
  }
}

function saveChannels(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function splitTranscriptParagraphs(text) {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function sanitizeFilePart(value, fallback = 'untitled') {
  const noIllegalChars = String(value || '').replace(/[<>:"/\\|?*]/g, '');
  const printableOnly = Array.from(noIllegalChars)
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('');
  const cleaned = printableOnly
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);
  return cleaned || fallback;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text, tokens, className) {
  const source = String(text || '');
  if (!source) {
    return <span className={className} />;
  }
  if (!tokens.length) {
    return <span className={className}>{source}</span>;
  }
  const pattern = tokens.map(escapeRegExp).join('|');
  if (!pattern) {
    return <span className={className}>{source}</span>;
  }
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = source.split(regex);
  return (
    <span className={className}>
      {parts.map((part, idx) =>
        tokens.includes(part.toLowerCase()) ? (
          <mark key={`${part}-${idx}`} className="channel-hit-mark">
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

export default function ChannelMonitor() {
  const [channels, setChannels] = useState(() => loadChannels());
  const [selectedChannelIds, setSelectedChannelIds] = useState(
    () => new Set(loadChannels().map((c) => c.id))
  );
  const [newInput, setNewInput] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [sinceDate, setSinceDate] = useState(() => formatLocalDateInputValue());
  /** 0 = no filter; 61 skips most Shorts */
  const [minVideoLengthSec, setMinVideoLengthSec] = useState(61);
  const [checkBusy, setCheckBusy] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [checkErrors, setCheckErrors] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [transcript, setTranscript] = useState({
    loading: false,
    text: null,
    error: null
  });
  const [selectedVideoIds, setSelectedVideoIds] = useState(() => new Set());
  const [bulkDownload, setBulkDownload] = useState({
    loading: false,
    message: '',
    error: ''
  });
  /** OR-match on title + description; filters the list in memory after Check */
  const [keywordFilter, setKeywordFilter] = useState('');
  /** Invalidate in-flight getVideoTranscript so stale responses never repopulate UI */
  const transcriptFetchSeqRef = useRef(0);

  useEffect(() => {
    saveChannels(channels);
  }, [channels]);

  const handleAdd = async () => {
    const trimmed = newInput.trim();
    if (!trimmed) {
      setAddError('Enter a channel URL, @handle, or channel ID');
      return;
    }
    setAddError('');
    setAddBusy(true);
    try {
      const { id, title } = await resolveChannel(trimmed);
      if (channels.some((c) => c.id === id)) {
        setAddError('This channel is already in the list');
        return;
      }
      setChannels((prev) => [...prev, { id, input: trimmed, title }]);
      setSelectedChannelIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setNewInput('');
    } catch (e) {
      setAddError(e.message || 'Could not add channel');
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemove = (id) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setResults((prev) => prev.filter((v) => v.channelId !== id));
  };

  const selectedChannels = channels.filter((c) => selectedChannelIds.has(c.id));
  const allChannelsSelected =
    channels.length > 0 && selectedChannels.length === channels.length;

  const toggleChannelSelection = (channelId) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const toggleAllChannelsSelection = () => {
    setSelectedChannelIds((prev) => {
      if (channels.length > 0 && prev.size === channels.length) {
        return new Set();
      }
      return new Set(channels.map((c) => c.id));
    });
  };

  const handleCheck = async () => {
    transcriptFetchSeqRef.current += 1;
    setCheckErrors([]);
    setResults([]);
    setSelectedVideoId(null);
    setTranscript({ loading: false, text: null, error: null });
    setSelectedVideoIds(new Set());
    setBulkDownload({ loading: false, message: '', error: '' });
    setKeywordFilter('');

    if (channels.length === 0) {
      setCheckErrors([{ channelId: '', input: '', message: 'Add at least one channel first' }]);
      setHasChecked(true);
      return;
    }
    if (selectedChannels.length === 0) {
      setCheckErrors([{ channelId: '', input: '', message: 'Select at least one channel first' }]);
      setHasChecked(true);
      return;
    }

    setCheckBusy(true);
    try {
      const payload = selectedChannels.map(({ id, input }) => ({ id, input }));
      const { videos, errors } = await checkChannelsForNewVideos(
        payload,
        sinceDate,
        minVideoLengthSec
      );
      setResults(videos);
      setCheckErrors(errors);
    } catch (e) {
      setCheckErrors([
        { channelId: '', input: '', message: e.message || 'Check failed' }
      ]);
    } finally {
      setHasChecked(true);
      setCheckBusy(false);
    }
  };

  const loadTranscript = useCallback(async (videoId) => {
    const seq = ++transcriptFetchSeqRef.current;
    setSelectedVideoId(videoId);
    setTranscript({ loading: true, text: null, error: null });
    try {
      const text = await getVideoTranscript(videoId);
      if (seq !== transcriptFetchSeqRef.current) return;
      setTranscript({ loading: false, text, error: null });
    } catch (e) {
      if (seq !== transcriptFetchSeqRef.current) return;
      setTranscript({
        loading: false,
        text: null,
        error: e.message || 'Failed to load transcript'
      });
    }
  }, []);

  const keywordTokens = useMemo(
    () =>
      keywordFilter
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => t.toLowerCase()),
    [keywordFilter]
  );

  const visibleResults = useMemo(() => {
    if (keywordTokens.length === 0) {
      return results;
    }
    return results.filter((v) => {
      const hay = `${v.videoTitle || ''}\n${v.videoDescription || ''}`.toLowerCase();
      return keywordTokens.some((kw) => hay.includes(kw));
    });
  }, [results, keywordTokens]);

  const selectedVisibleCount = useMemo(
    () => visibleResults.filter((v) => selectedVideoIds.has(v.videoId)).length,
    [visibleResults, selectedVideoIds]
  );

  useEffect(() => {
    if (!selectedVideoId) return;
    const stillVisible = visibleResults.some((v) => v.videoId === selectedVideoId);
    if (stillVisible) return;
    transcriptFetchSeqRef.current += 1;
    setSelectedVideoId(null);
    setTranscript({ loading: false, text: null, error: null });
  }, [visibleResults, selectedVideoId]);

  const handleRowClick = (videoId) => {
    if (selectedVideoId === videoId && transcript.text) {
      return;
    }
    loadTranscript(videoId);
  };

  const toggleVideoSelection = (videoId) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const allVisibleSelected =
    visibleResults.length > 0 && selectedVisibleCount === visibleResults.length;

  const toggleAllSelections = () => {
    const visibleIds = visibleResults.map((v) => v.videoId);
    setSelectedVideoIds((prev) => {
      const everyVisibleChecked =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (everyVisibleChecked) {
        for (const id of visibleIds) {
          next.delete(id);
        }
      } else {
        for (const id of visibleIds) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleGetTranscripts = async () => {
    const selectedVideos = visibleResults.filter((v) =>
      selectedVideoIds.has(v.videoId)
    );
    if (selectedVideos.length === 0) {
      setBulkDownload({
        loading: false,
        message: '',
        error:
          'Select at least one visible video (matching the keyword filter if any).'
      });
      return;
    }
    if (typeof window.showDirectoryPicker !== 'function') {
      setBulkDownload({
        loading: false,
        message: '',
        error:
          'Your browser does not support folder download here. Use a Chromium-based browser (Chrome/Edge) to save to folders.'
      });
      return;
    }

    setBulkDownload({
      loading: true,
      message: `Downloading ${selectedVideos.length} transcript(s)…`,
      error: ''
    });

    try {
      const baseDir = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      let savedCount = 0;
      const folderByChannel = new Map();

      for (const video of selectedVideos) {
        const channelFolderName = sanitizeFilePart(video.channelTitle || 'unknown-channel');
        let channelFolder = folderByChannel.get(channelFolderName);
        if (!channelFolder) {
          channelFolder = await baseDir.getDirectoryHandle(channelFolderName, { create: true });
          folderByChannel.set(channelFolderName, channelFolder);
        }

        const transcriptText = await getVideoTranscript(video.videoId);
        const fileTitle = sanitizeFilePart(video.videoTitle || video.videoId);
        const fileName = `${fileTitle}-${video.videoId}.txt`;
        const fileHandle = await channelFolder.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(transcriptText);
        await writable.close();
        savedCount += 1;
      }

      setBulkDownload({
        loading: false,
        message: `Saved ${savedCount} transcript(s) into ${folderByChannel.size} channel folder(s).`,
        error: ''
      });
    } catch (e) {
      const cancelled = e?.name === 'AbortError';
      setBulkDownload({
        loading: false,
        message: '',
        error: cancelled ? 'Folder selection cancelled.' : e.message || 'Failed to save transcripts.'
      });
    }
  };

  return (
    <div className="channel-monitor">
      <p className="channel-monitor-intro">
        Save channels, pick a date (videos published that day or later, local time), then run Check.
      </p>

      <div className="channel-monitor-toolbar">
        <div className="channel-add-row">
          <input
            type="text"
            className="channel-add-input"
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !addBusy && handleAdd()}
            placeholder="Channel URL, @handle, or UC…"
            disabled={addBusy}
          />
          <button
            type="button"
            className="search-button channel-add-button"
            onClick={handleAdd}
            disabled={addBusy}
          >
            {addBusy ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <div className="error-message channel-monitor-error">{addError}</div>}

        <div className="channel-check-row">
          <label className="channel-date-label" htmlFor="since-date">
            New from (local date)
          </label>
          <input
            id="since-date"
            type="date"
            className="channel-date-input"
            value={sinceDate}
            onChange={(e) => setSinceDate(e.target.value)}
          />
          <label className="channel-date-label" htmlFor="min-len-sec">
            Min. length (sec)
          </label>
          <input
            id="min-len-sec"
            type="number"
            className="channel-date-input channel-min-len-input"
            min={0}
            step={1}
            title="0 = include Shorts. 61 ≈ hide most Shorts."
            value={minVideoLengthSec}
            onChange={(e) =>
              setMinVideoLengthSec(Math.max(0, Number(e.target.value) || 0))
            }
          />
          <button
            type="button"
            className="search-button"
            onClick={handleCheck}
            disabled={checkBusy || channels.length === 0 || selectedChannels.length === 0}
          >
            {checkBusy ? 'Checking…' : 'Check'}
          </button>
        </div>
      </div>

      <div className="channel-monitor-columns">
        <section className="channel-list-section">
          <h2 className="channel-section-title">Saved channels</h2>
          {channels.length === 0 ? (
            <p className="channel-empty">No channels yet. Add one above.</p>
          ) : (
            <>
              <label className="channel-saved-select-all">
                <input
                  type="checkbox"
                  checked={allChannelsSelected}
                  onChange={toggleAllChannelsSelection}
                />
                <span>
                  Select all ({selectedChannels.length}/{channels.length})
                </span>
              </label>
              <ul className="channel-saved-list">
                {channels.map((c) => (
                  <li key={c.id} className="channel-saved-item">
                    <label className="channel-saved-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedChannelIds.has(c.id)}
                        onChange={() => toggleChannelSelection(c.id)}
                      />
                    </label>
                    <div className="channel-saved-text">
                      <span className="channel-saved-title">{c.title || c.input}</span>
                      <span className="channel-saved-meta">{c.input}</span>
                    </div>
                    <button
                      type="button"
                      className="channel-remove-button"
                      onClick={() => handleRemove(c.id)}
                      aria-label={`Remove ${c.title || c.input}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="channel-results-section">
          <h2 className="channel-section-title">New videos</h2>
          {checkErrors.length > 0 && (
            <ul className="channel-check-errors">
              {checkErrors.map((err, i) => (
                <li key={`${err.channelId}-${i}`} className="error-message channel-check-error-item">
                  {err.input ? (
                    <>
                      <strong>{err.input}</strong>: {err.message}
                    </>
                  ) : (
                    err.message
                  )}
                </li>
              ))}
            </ul>
          )}
          {!checkBusy &&
            hasChecked &&
            results.length === 0 &&
            channels.length > 0 &&
            checkErrors.length === 0 && (
              <p className="channel-empty">
                No new videos since the selected date
                {minVideoLengthSec > 0
                  ? ` (at least ${minVideoLengthSec}s long)`
                  : ''}
                .
              </p>
            )}
          {!checkBusy && !hasChecked && channels.length > 0 && (
            <p className="channel-empty">Click Check to load new videos for your saved channels.</p>
          )}
          {!checkBusy && channels.length === 0 && (
            <p className="channel-empty">Add channels to check for new uploads.</p>
          )}
          {results.length > 0 && (
            <>
              <div className="channel-results-actions">
                <label className="channel-select-all">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllSelections}
                  />
                  <span>
                    Select all ({selectedVisibleCount}/{visibleResults.length})
                  </span>
                </label>
                <input
                  type="search"
                  className="channel-keyword-filter"
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  placeholder="Keyword filter (any word, OR)"
                  aria-label="Filter videos by keywords in title or description"
                />
                <button
                  type="button"
                  className="search-button channel-get-transcripts-button"
                  onClick={handleGetTranscripts}
                  disabled={bulkDownload.loading || selectedVisibleCount === 0}
                >
                  {bulkDownload.loading ? 'Getting…' : 'Get Transcripts'}
                </button>
              </div>
              {results.length > 0 &&
                visibleResults.length === 0 &&
                keywordTokens.length > 0 && (
                  <p className="channel-filter-empty">
                    No videos match this keyword filter ({results.length} loaded).
                  </p>
                )}
              {bulkDownload.error && (
                <p className="error-message channel-bulk-status">{bulkDownload.error}</p>
              )}
              {bulkDownload.message && (
                <p className="channel-bulk-success channel-bulk-status">{bulkDownload.message}</p>
              )}
              <ul className="channel-results-list">
              {visibleResults.map((v) => (
                <li key={v.videoId}>
                  <label className="channel-row-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.has(v.videoId)}
                      onChange={() => toggleVideoSelection(v.videoId)}
                    />
                    <span>Select</span>
                  </label>
                  <button
                    type="button"
                    className={
                      selectedVideoId === v.videoId
                        ? 'channel-result-row channel-result-row-active'
                        : 'channel-result-row'
                    }
                    onClick={() => handleRowClick(v.videoId)}
                  >
                    <span className="channel-result-channel">{v.channelTitle}</span>
                    <span className="channel-result-sep"> — </span>
                    {renderHighlightedText(
                      v.videoTitle,
                      keywordTokens,
                      'channel-result-video'
                    )}
                    {!!v.videoDescription && (
                      renderHighlightedText(
                        v.videoDescription,
                        keywordTokens,
                        'channel-result-description'
                      )
                    )}
                    <span className="channel-result-date">
                      {new Date(v.publishedAt).toLocaleString()}
                    </span>
                  </button>
                  <a
                    className="channel-result-watch"
                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open on YouTube
                  </a>
                </li>
              ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {(selectedVideoId || transcript.loading || transcript.error || transcript.text) && (
        <section className="channel-transcript-section">
          <h2 className="channel-section-title">Transcript</h2>
          {transcript.loading && <p className="channel-transcript-status">Loading transcript…</p>}
          {transcript.error && (
            <p className="error-message channel-transcript-status">{transcript.error}</p>
          )}
          {transcript.text && (
            <div className="channel-transcript-reader">
              {splitTranscriptParagraphs(transcript.text).map((para, idx) => (
                <p key={idx} className="channel-transcript-para">
                  {para}
                </p>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
