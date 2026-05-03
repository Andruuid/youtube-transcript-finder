import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './ChannelMonitor.css';
import {
  downloadTranscript,
  listChannels,
  listChannelVideos,
  removeChannel,
  searchLibrary,
  syncChannel
} from '../services/libraryService';

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

function splitTranscriptParagraphs(text) {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function mergeVideosById(items) {
  const map = new Map();
  for (const v of items) {
    map.set(v.youtubeVideoId, v);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );
}

/** Value for `<input type="datetime-local">` in local timezone. */
function formatDatetimeLocalValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** End of local calendar day (23:59), used as default “Published to = today”. */
function formatEndOfTodayLocalValue() {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return formatDatetimeLocalValue(d);
}

function parseDatetimeLocalToMs(value) {
  if (!value || typeof value !== 'string') return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Keeps videos whose publishedAt falls in [from, to] when bounds are set (local picker values). */
function filterVideosByPublishedRange(items, publishedFrom, publishedTo) {
  const fromMs = parseDatetimeLocalToMs(publishedFrom);
  const toMs = parseDatetimeLocalToMs(publishedTo);
  if (fromMs == null && toMs == null) return items;
  return items.filter((v) => {
    const t = new Date(v.publishedAt).getTime();
    if (Number.isNaN(t)) return false;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

export default function ChannelMonitor() {
  const [channels, setChannels] = useState([]);
  const [channelInput, setChannelInput] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingVideoId, setDownloadingVideoId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState(() => new Set());
  const [videos, setVideos] = useState([]);
  /** `datetime-local` strings (empty = no bound). `publishedTo` defaults to end of today (local). */
  const [publishedFrom, setPublishedFrom] = useState('');
  const [publishedTo, setPublishedTo] = useState(() => formatEndOfTodayLocalValue());
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [bulkDownload, setBulkDownload] = useState({
    loading: false,
    message: '',
    error: ''
  });

  const selectedChannels = useMemo(
    () => channels.filter((c) => selectedChannelIds.has(c.youtubeChannelId)),
    [channels, selectedChannelIds]
  );

  const allChannelsSelected =
    channels.length > 0 && selectedChannels.length === channels.length;

  const selectedVideo = useMemo(
    () => videos.find((v) => v.youtubeVideoId === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  const visibleVideos = useMemo(
    () => filterVideosByPublishedRange(videos, publishedFrom, publishedTo),
    [videos, publishedFrom, publishedTo]
  );

  useEffect(() => {
    if (!selectedVideoId) return;
    const stillVisible = visibleVideos.some((v) => v.youtubeVideoId === selectedVideoId);
    if (!stillVisible) setSelectedVideoId('');
  }, [visibleVideos, selectedVideoId]);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await listChannels();
      setChannels(loaded);
      setSelectedChannelIds((prev) => {
        if (prev.size === 0 && loaded.length > 0) {
          return new Set(loaded.map((c) => c.youtubeChannelId));
        }
        const next = new Set();
        for (const c of loaded) {
          if (prev.has(c.youtubeChannelId)) next.add(c.youtubeChannelId);
        }
        if (next.size === 0 && loaded.length > 0) {
          return new Set(loaded.map((c) => c.youtubeChannelId));
        }
        return next;
      });
      setSelectedChannelId((prev) => prev || loaded[0]?.youtubeChannelId || '');
    } catch (e) {
      setError(e.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const refreshVideos = useCallback(async () => {
    const ids = channels
      .filter((c) => selectedChannelIds.has(c.youtubeChannelId))
      .map((c) => c.youtubeChannelId);
    if (!ids.length) {
      setVideos([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (searchTerm.trim()) {
        const allResults = await searchLibrary(searchTerm.trim(), '');
        const idSet = new Set(ids);
        const filtered = allResults.filter((v) =>
          idSet.has(v.channel?.youtubeChannelId)
        );
        setVideos(mergeVideosById(filtered));
      } else {
        const batches = await Promise.all(
          ids.map((id) => listChannelVideos(id, statusFilter))
        );
        setVideos(mergeVideosById(batches.flat()));
      }
    } catch (e) {
      setError(e.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [channels, selectedChannelIds, searchTerm, statusFilter]);

  useEffect(() => {
    refreshVideos();
  }, [refreshVideos]);

  const toggleChannelSelection = (youtubeChannelId) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(youtubeChannelId)) next.delete(youtubeChannelId);
      else next.add(youtubeChannelId);
      return next;
    });
  };

  const toggleAllChannelsSelection = () => {
    setSelectedChannelIds((prev) => {
      if (channels.length > 0 && prev.size === channels.length) {
        return new Set();
      }
      return new Set(channels.map((c) => c.youtubeChannelId));
    });
  };

  const toggleVideoSelection = (videoId) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const selectedVisibleCount = useMemo(
    () =>
      visibleVideos.filter((v) => selectedVideoIds.has(v.youtubeVideoId)).length,
    [visibleVideos, selectedVideoIds]
  );

  const allVisibleSelected =
    visibleVideos.length > 0 && selectedVisibleCount === visibleVideos.length;

  const toggleAllVideoSelections = () => {
    const visibleIds = visibleVideos.map((v) => v.youtubeVideoId);
    setSelectedVideoIds((prev) => {
      const everyChecked =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (everyChecked) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const handleRemoveChannel = async (youtubeChannelId, titleOrInput) => {
    setError('');
    setStatusMessage('');
    setBulkDownload({ loading: false, message: '', error: '' });
    try {
      await removeChannel(youtubeChannelId);
      setSelectedChannelIds((prev) => {
        const next = new Set(prev);
        next.delete(youtubeChannelId);
        return next;
      });
      if (selectedChannelId === youtubeChannelId) {
        setSelectedChannelId('');
      }
      setSelectedVideoId('');
      setSelectedVideoIds(new Set());
      await loadChannels();
      setStatusMessage(`Removed ${titleOrInput || 'channel'} from the library.`);
    } catch (e) {
      setError(e.message || 'Failed to remove channel');
    }
  };

  const handleAddChannel = async () => {
    const trimmed = channelInput.trim();
    if (!trimmed) {
      setError('Enter a channel URL, @handle, or channel ID');
      return;
    }
    setAddBusy(true);
    setError('');
    setStatusMessage('');
    setBulkDownload({ loading: false, message: '', error: '' });
    try {
      const result = await syncChannel(trimmed, 50);
      await loadChannels();
      setSelectedChannelId(result.channel.youtubeChannelId);
      setSelectedChannelIds((prev) => {
        const next = new Set(prev);
        next.add(result.channel.youtubeChannelId);
        return next;
      });
      setChannelInput('');
      setStatusMessage(
        `Added ${result.syncedVideos} recent video(s) for ${result.channel.title}.`
      );
    } catch (e) {
      setError(e.message || 'Could not add channel');
    } finally {
      setAddBusy(false);
    }
  };

  const handleDownloadTranscript = async (videoId) => {
    setDownloadingVideoId(videoId);
    setError('');
    setStatusMessage('');
    setBulkDownload({ loading: false, message: '', error: '' });
    try {
      await downloadTranscript(videoId);
      setStatusMessage('Transcript saved to the local database.');
      await refreshVideos();
    } catch (e) {
      setError(e.message || 'Failed to download transcript');
    } finally {
      setDownloadingVideoId('');
    }
  };

  const handleGetTranscripts = async () => {
    const selectedVideos = visibleVideos.filter((v) =>
      selectedVideoIds.has(v.youtubeVideoId)
    );
    if (selectedVideos.length === 0) {
      setBulkDownload({
        loading: false,
        message: '',
        error:
          'Select at least one visible video (matching the filter/search if any).'
      });
      return;
    }

    const canPickFolder = typeof window.showDirectoryPicker === 'function';

    setBulkDownload({
      loading: true,
      message: `Downloading ${selectedVideos.length} transcript(s)…`,
      error: ''
    });

    try {
      let baseDir = null;
      if (canPickFolder) {
        baseDir = await window.showDirectoryPicker({ mode: 'readwrite' });
      }

      const folderByChannel = new Map();
      let savedCount = 0;

      for (const video of selectedVideos) {
        let text =
          video.hasTranscript && typeof video.transcriptText === 'string'
            ? video.transcriptText
            : null;
        if (!text) {
          const data = await downloadTranscript(video.youtubeVideoId);
          text = data.transcript;
        }
        if (typeof text !== 'string' || !text) {
          throw new Error('Server returned no transcript text');
        }

        if (baseDir) {
          const channelFolderName = sanitizeFilePart(
            video.channel?.title || 'unknown-channel'
          );
          let channelFolder = folderByChannel.get(channelFolderName);
          if (!channelFolder) {
            channelFolder = await baseDir.getDirectoryHandle(channelFolderName, {
              create: true
            });
            folderByChannel.set(channelFolderName, channelFolder);
          }
          const fileTitle = sanitizeFilePart(video.title || video.youtubeVideoId);
          const fileName = `${fileTitle}-${video.youtubeVideoId}.txt`;
          const fileHandle = await channelFolder.getFileHandle(fileName, {
            create: true
          });
          const writable = await fileHandle.createWritable();
          await writable.write(text);
          await writable.close();
          savedCount += 1;
        }
      }

      await refreshVideos();

      setBulkDownload({
        loading: false,
        message: baseDir
          ? `Saved ${savedCount} file(s) into ${folderByChannel.size} folder(s); transcripts are also in the database.`
          : `Saved ${selectedVideos.length} transcript(s) to the database (folder picker not available in this browser).`,
        error: ''
      });
    } catch (e) {
      const cancelled = e?.name === 'AbortError';
      setBulkDownload({
        loading: false,
        message: '',
        error: cancelled
          ? 'Folder selection cancelled.'
          : e.message || 'Failed to get transcripts.'
      });
    }
  };

  const channelSelectionDisabled = channels.length === 0;
  const videoPanelDisabled = selectedChannels.length === 0;

  return (
    <div className="channel-monitor">
      <p className="channel-monitor-intro">
        Add channels below. Use checkboxes to choose which channels contribute to the
        video list. Optionally narrow videos by <strong>published date/time</strong>.
        Bulk <strong>Get Transcripts</strong> saves to the database and, in Chromium
        browsers, also writes .txt files to a folder you pick.
      </p>

      <div className="channel-monitor-toolbar">
        <div className="channel-add-row">
          <input
            type="text"
            className="channel-add-input"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !addBusy && handleAddChannel()}
            placeholder="Channel URL, @handle, or UC…"
            disabled={addBusy}
          />
          <button
            type="button"
            className="search-button channel-add-button"
            onClick={handleAddChannel}
            disabled={addBusy}
          >
            {addBusy ? 'Adding…' : 'Add Channel'}
          </button>
        </div>
        {error && <div className="error-message channel-monitor-error">{error}</div>}
        {statusMessage && (
          <div className="channel-bulk-success channel-monitor-error">{statusMessage}</div>
        )}
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
                  disabled={channelSelectionDisabled}
                />
                <span>
                  Select all ({selectedChannels.length}/{channels.length})
                </span>
              </label>
              <ul className="channel-saved-list">
                {channels.map((c) => (
                  <li key={c.youtubeChannelId} className="channel-saved-item">
                    <label className="channel-saved-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedChannelIds.has(c.youtubeChannelId)}
                        onChange={() => toggleChannelSelection(c.youtubeChannelId)}
                      />
                    </label>
                    <button
                      type="button"
                      className="channel-saved-row-button"
                      onClick={() => setSelectedChannelId(c.youtubeChannelId)}
                    >
                      <span className="channel-saved-title">
                        {c.title}
                        {selectedChannelId === c.youtubeChannelId ? ' (focused)' : ''}
                      </span>
                      <span className="channel-saved-meta">
                        Downloaded {c.downloadedCount} / {c.totalCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="channel-remove-button"
                      onClick={() => handleRemoveChannel(c.youtubeChannelId, c.title)}
                      aria-label={`Remove ${c.title}`}
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
          <h2 className="channel-section-title">Videos</h2>
          {videoPanelDisabled && channels.length > 0 && (
            <p className="channel-empty">
              Select at least one channel (checkbox) to load videos.
            </p>
          )}
          <div className="channel-datetime-filter-row">
            <label htmlFor="published-from" className="channel-date-label">
              Published from
            </label>
            <input
              id="published-from"
              type="datetime-local"
              className="channel-date-input channel-datetime-input"
              value={publishedFrom}
              onChange={(e) => setPublishedFrom(e.target.value)}
              disabled={videoPanelDisabled}
            />
            <label htmlFor="published-to" className="channel-date-label">
              Published to
            </label>
            <input
              id="published-to"
              type="datetime-local"
              className="channel-date-input channel-datetime-input"
              value={publishedTo}
              onChange={(e) => setPublishedTo(e.target.value)}
              disabled={videoPanelDisabled}
            />
            <button
              type="button"
              className="channel-clear-dates-button"
              onClick={() => {
                setPublishedFrom('');
                setPublishedTo(formatEndOfTodayLocalValue());
              }}
              disabled={videoPanelDisabled}
            >
              Clear range
            </button>
          </div>
          <div className="channel-results-actions">
            <label className="channel-select-all">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVideoSelections}
                disabled={videoPanelDisabled || visibleVideos.length === 0}
              />
              <span>
                Select all ({selectedVisibleCount}/{visibleVideos.length})
              </span>
            </label>
            <select
              className="channel-keyword-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={videoPanelDisabled}
              aria-label="Filter by transcript status"
            >
              <option value="all">All</option>
              <option value="downloaded">Downloaded</option>
              <option value="missing">Not downloaded</option>
            </select>
            <input
              type="search"
              className="channel-keyword-filter"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Keyword filter / search (includes transcript when downloaded)"
              aria-label="Filter or search videos"
              disabled={videoPanelDisabled}
            />
            <button
              type="button"
              className="search-button channel-get-transcripts-button"
              onClick={handleGetTranscripts}
              disabled={
                bulkDownload.loading ||
                videoPanelDisabled ||
                selectedVisibleCount === 0
              }
            >
              {bulkDownload.loading ? 'Getting…' : 'Get Transcripts'}
            </button>
          </div>
          {bulkDownload.error && (
            <p className="error-message channel-bulk-status">{bulkDownload.error}</p>
          )}
          {bulkDownload.message && (
            <p className="channel-bulk-success channel-bulk-status">{bulkDownload.message}</p>
          )}
          {!videoPanelDisabled && !loading && videos.length === 0 && (
            <p className="channel-empty">No videos found for this filter.</p>
          )}
          {!videoPanelDisabled &&
            !loading &&
            videos.length > 0 &&
            visibleVideos.length === 0 && (
              <p className="channel-filter-empty">
                No videos in this published date/time range ({videos.length} loaded).
              </p>
            )}
          {visibleVideos.length > 0 && (
            <ul className="channel-results-list">
              {visibleVideos.map((v) => (
                <li key={v.youtubeVideoId}>
                  <label className="channel-row-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.has(v.youtubeVideoId)}
                      onChange={() => toggleVideoSelection(v.youtubeVideoId)}
                    />
                    <span>Select</span>
                  </label>
                  <button
                    type="button"
                    className={
                      selectedVideoId === v.youtubeVideoId
                        ? 'channel-result-row channel-result-row-active'
                        : 'channel-result-row'
                    }
                    onClick={() => setSelectedVideoId(v.youtubeVideoId)}
                  >
                    <span className="channel-result-channel">
                      {v.channel?.title || 'Channel'}
                    </span>
                    <span className="channel-result-sep"> — </span>
                    <span className="channel-result-video">{v.title}</span>
                    {!!v.description && (
                      <span className="channel-result-description">{v.description}</span>
                    )}
                    <span className="channel-result-date">
                      {new Date(v.publishedAt).toLocaleString()} •{' '}
                      {v.hasTranscript ? 'Downloaded' : 'Not downloaded'}
                      {v.matchSource ? ` • Match: ${v.matchSource}` : ''}
                    </span>
                  </button>
                  <a
                    className="channel-result-watch"
                    href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open on YouTube
                  </a>
                  {!v.hasTranscript && (
                    <button
                      type="button"
                      className="search-button channel-download-one-button"
                      onClick={() => handleDownloadTranscript(v.youtubeVideoId)}
                      disabled={downloadingVideoId === v.youtubeVideoId}
                    >
                      {downloadingVideoId === v.youtubeVideoId
                        ? 'Downloading…'
                        : 'Download Transcript'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedVideo && selectedVideo.hasTranscript && selectedVideo.transcriptText && (
        <section className="channel-transcript-section">
          <h2 className="channel-section-title">Transcript</h2>
          <div className="channel-transcript-reader">
            {splitTranscriptParagraphs(selectedVideo.transcriptText).map((para, idx) => (
              <p key={idx} className="channel-transcript-para">
                {para}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
