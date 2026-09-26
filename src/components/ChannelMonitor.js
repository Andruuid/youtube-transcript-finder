import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SmartBulkTranscriptPanel from './SmartBulkTranscriptPanel';
import TranscriptReaderModal from './TranscriptReaderModal';
import ChannelAvatar from './ChannelAvatar';
import { isTranscriptAccessError } from '../utils/transcriptErrors';
import './ChannelMonitor.css';
import {
  downloadChannelListJson,
  parseChannelListImport
} from '../services/channelListIO';
import {
  downloadTranscript,
  fetchTranscriptText,
  listChannels,
  listChannelVideos,
  removeChannel,
  searchLibrary,
  syncChannel
} from '../services/libraryService';
import {
  hasStoredSelectedChannelIds,
  readStoredFocusedChannelId,
  readStoredSelectedChannelIds,
  reconcileSelectedChannelIds,
  writeStoredFocusedChannelId,
  writeStoredSelectedChannelIds
} from '../utils/channelSelectionStorage';

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

/** Rolling “last 7 days”: same local clock time, seven calendar days earlier. */
function formatSevenDaysAgoLocalValue() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return formatDatetimeLocalValue(d);
}

function parseDatetimeLocalToMs(value) {
  if (!value || typeof value !== 'string') return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** yyyy-mm-dd from stored datetime-local string (for `type="date"` display). */
function datetimeLocalDatePart(value) {
  if (!value || typeof value !== 'string') return '';
  return value.length >= 10 ? value.slice(0, 10) : '';
}

/** New yyyy-mm-ddTHH:mm with same time as previous value (or 00:00). */
function withDatetimeLocalDate(previousFull, dateYmd) {
  if (!dateYmd) return previousFull;
  const prev = String(previousFull || '');
  const timePart =
    prev.length >= 16 && prev[10] === 'T' ? prev.slice(11, 16) : '00:00';
  return `${dateYmd}T${timePart}`;
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
  const [importBusy, setImportBusy] = useState(false);
  const importFileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [downloadingVideoId, setDownloadingVideoId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState(() => readStoredFocusedChannelId());
  const [selectedChannelIds, setSelectedChannelIds] = useState(
    () => readStoredSelectedChannelIds() ?? new Set()
  );
  const persistSelectionRef = useRef(false);
  const [videos, setVideos] = useState([]);
  /** Default range: last 7 days through end of today (local). */
  const [publishedFrom, setPublishedFrom] = useState(() =>
    formatSevenDaysAgoLocalValue()
  );
  const [publishedTo, setPublishedTo] = useState(() => formatEndOfTodayLocalValue());
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [bulkDownload, setBulkDownload] = useState({
    loading: false,
    message: '',
    error: '',
    partialFailures: false
  });
  const [smartBulkBusy, setSmartBulkBusy] = useState(false);

  const [transcriptModalVideo, setTranscriptModalVideo] = useState(null);

  const selectedChannels = useMemo(
    () => channels.filter((c) => selectedChannelIds.has(c.youtubeChannelId)),
    [channels, selectedChannelIds]
  );

  const focusedChannel = useMemo(
    () => channels.find((c) => c.youtubeChannelId === selectedChannelId),
    [channels, selectedChannelId]
  );

  const allChannelsSelected =
    channels.length > 0 && selectedChannels.length === channels.length;

  const visibleVideos = useMemo(
    () => filterVideosByPublishedRange(videos, publishedFrom, publishedTo),
    [videos, publishedFrom, publishedTo]
  );

  const closeTranscriptModal = useCallback(() => {
    setTranscriptModalVideo(null);
  }, []);

  const openTranscriptModal = useCallback((v) => {
    setSelectedVideoId(v.youtubeVideoId);
    setTranscriptModalVideo(v);
  }, []);

  const handleTranscriptSummarySaved = useCallback((videoId, patch) => {
    setTranscriptModalVideo((pv) => (pv ? { ...pv, ...patch } : pv));
    setVideos((list) =>
      list.map((x) => (x.youtubeVideoId === videoId ? { ...x, ...patch } : x))
    );
  }, []);

  useEffect(() => {
    if (!selectedVideoId) return;
    const stillVisible = visibleVideos.some((v) => v.youtubeVideoId === selectedVideoId);
    if (!stillVisible) {
      setSelectedVideoId('');
      closeTranscriptModal();
    }
  }, [visibleVideos, selectedVideoId, closeTranscriptModal]);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await listChannels();
      setChannels(loaded);
      const availableIds = loaded.map((c) => c.youtubeChannelId);
      setSelectedChannelIds((prev) => {
        const reconciled = reconcileSelectedChannelIds(prev, availableIds);
        if (reconciled.size === 0 && loaded.length > 0 && !hasStoredSelectedChannelIds()) {
          return new Set(availableIds);
        }
        return reconciled;
      });
      setSelectedChannelId((prev) => {
        if (prev && loaded.some((c) => c.youtubeChannelId === prev)) {
          return prev;
        }
        const storedFocused = readStoredFocusedChannelId();
        if (storedFocused && loaded.some((c) => c.youtubeChannelId === storedFocused)) {
          return storedFocused;
        }
        return loaded[0]?.youtubeChannelId || '';
      });
    } catch (e) {
      setError(e.message || 'Failed to load channels');
    } finally {
      persistSelectionRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!persistSelectionRef.current) return;
    writeStoredSelectedChannelIds(selectedChannelIds);
  }, [selectedChannelIds]);

  useEffect(() => {
    if (!persistSelectionRef.current) return;
    writeStoredFocusedChannelId(selectedChannelId);
  }, [selectedChannelId]);

  /** Load merged video rows for checked channels (no loading UI); used after YouTube sync inside bulk actions. */
  const fetchMergedVideosSnapshot = useCallback(async () => {
    const ids = channels
      .filter((c) => selectedChannelIds.has(c.youtubeChannelId))
      .map((c) => c.youtubeChannelId);
    if (!ids.length) return [];
    if (searchTerm.trim()) {
      const allResults = await searchLibrary(searchTerm.trim(), '');
      const idSet = new Set(ids);
      const filtered = allResults.filter((v) =>
        idSet.has(v.channel?.youtubeChannelId)
      );
      return mergeVideosById(filtered);
    }
    const batches = await Promise.all(
      ids.map((id) => listChannelVideos(id, statusFilter))
    );
    return mergeVideosById(batches.flat());
  }, [channels, selectedChannelIds, searchTerm, statusFilter]);

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
      const merged = await fetchMergedVideosSnapshot();
      setVideos(merged);
    } catch (e) {
      setError(e.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [channels, selectedChannelIds, fetchMergedVideosSnapshot]);

  useEffect(() => {
    refreshVideos();
  }, [refreshVideos]);

  const toggleChannelSelection = (youtubeChannelId) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(youtubeChannelId)) next.delete(youtubeChannelId);
      else {
        next.add(youtubeChannelId);
        setSelectedChannelId(youtubeChannelId);
      }
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
    setBulkDownload({
      loading: false,
      message: '',
      error: '',
      partialFailures: false
    });
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
      closeTranscriptModal();
      await loadChannels();
      setStatusMessage(`Removed ${titleOrInput || 'channel'} from the library.`);
    } catch (e) {
      setError(e.message || 'Failed to remove channel');
    }
  };

  const handleExportChannels = () => {
    if (channels.length === 0) {
      setError('No channels to export');
      setStatusMessage('');
      return;
    }
    setError('');
    setStatusMessage('');
    downloadChannelListJson(channels);
    setStatusMessage(`Exported ${channels.length} channel(s) to JSON.`);
  };

  const handleImportChannelsClick = () => {
    if (importBusy || addBusy) return;
    importFileRef.current?.click();
  };

  const handleImportChannelsFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportBusy(true);
    setError('');
    setStatusMessage('');
    setBulkDownload({
      loading: false,
      message: '',
      error: '',
      partialFailures: false
    });

    try {
      const text = await file.text();
      const { entries } = parseChannelListImport(text);
      const failures = [];
      let imported = 0;

      for (let i = 0; i < entries.length; i++) {
        const { input, label } = entries[i];
        setStatusMessage(
          `Importing channel ${i + 1}/${entries.length}: ${label}…`
        );
        try {
          await syncChannel(input, 50);
          imported += 1;
        } catch (err) {
          failures.push(`${label}: ${err.message || 'Sync failed'}`);
        }
      }

      await loadChannels();

      if (failures.length === 0) {
        setStatusMessage(
          `Imported ${imported} channel${imported === 1 ? '' : 's'} from ${file.name}.`
        );
      } else if (imported === 0) {
        setError(
          `Import failed for all ${entries.length} channel(s). ${failures[0]}`
        );
        setStatusMessage('');
      } else {
        setStatusMessage(
          `Imported ${imported}/${entries.length} channel(s). ${failures.length} failed.`
        );
        setError(failures.slice(0, 3).join(' · '));
      }
    } catch (err) {
      setError(err.message || 'Could not import channels');
      setStatusMessage('');
    } finally {
      setImportBusy(false);
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
    setBulkDownload({
      loading: false,
      message: '',
      error: '',
      partialFailures: false
    });
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
    setBulkDownload({
      loading: false,
      message: '',
      error: '',
      partialFailures: false
    });
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
    let selectedVideos = visibleVideos.filter((v) =>
      selectedVideoIds.has(v.youtubeVideoId)
    );

    setBulkDownload({
      loading: true,
      message:
        selectedVideos.length > 0
          ? `Downloading ${selectedVideos.length} transcript(s)…`
          : 'Checking for new uploads…',
      error: '',
      partialFailures: false
    });

    try {
      if (selectedVideos.length === 0) {
        const channelIds = channels
          .filter((c) => selectedChannelIds.has(c.youtubeChannelId))
          .map((c) => c.youtubeChannelId);
        setBulkDownload({
          loading: true,
          message: 'Syncing newest uploads from YouTube…',
          error: '',
          partialFailures: false
        });
        for (const cid of channelIds) {
          await syncChannel(cid, 50, '');
        }
        const merged = await fetchMergedVideosSnapshot();
        setVideos(merged);
        const visible = filterVideosByPublishedRange(
          merged,
          publishedFrom,
          publishedTo
        );
        selectedVideos = visible.filter((v) => !v.hasTranscript);
        if (selectedVideos.length === 0) {
          setBulkDownload({
            loading: false,
            message:
              'No transcripts missing in the current view (after syncing newest uploads). Select specific videos if you want to export existing transcripts to files.',
            error: '',
            partialFailures: false
          });
          return;
        }
        setBulkDownload({
          loading: true,
          message: `Downloading ${selectedVideos.length} transcript(s)…`,
          error: '',
          partialFailures: false
        });
      }

      const canPickFolder = typeof window.showDirectoryPicker === 'function';

      let baseDir = null;
      if (canPickFolder) {
        baseDir = await window.showDirectoryPicker({ mode: 'readwrite' });
      }

      const folderByChannel = new Map();
      let savedCount = 0;
      let dbOkCount = 0;
      const failures = [];

      for (const video of selectedVideos) {
        try {
          let text =
            video.hasTranscript &&
            typeof video.transcriptText === 'string' &&
            video.transcriptText.length > 0
              ? video.transcriptText
              : null;
          if (!text && video.hasTranscript) {
            const { transcript } = await fetchTranscriptText(video.youtubeVideoId);
            text = transcript;
          } else if (!text) {
            const data = await downloadTranscript(video.youtubeVideoId);
            text = data.transcript;
          }
          if (typeof text !== 'string' || !text) {
            throw new Error('Server returned no transcript text');
          }

          dbOkCount += 1;

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
        } catch (err) {
          failures.push({
            id: video.youtubeVideoId,
            message: isTranscriptAccessError(err)
              ? `Remaining downloads stopped. ${err.message}` : err?.message || String(err)
          });
          if (isTranscriptAccessError(err)) break;
        }
      }

      await refreshVideos();

      const firstFailure = failures[0]?.message || '';
      const sameFailure =
        failures.length > 0 && failures.every((failure) => failure.message === firstFailure);
      const failNote =
        failures.length > 0
          ? sameFailure
            ? ` ${failures.length} failed. ${firstFailure}`
            : ` ${failures.length} failed (${failures.map((f) => f.id).join(', ')}).`
          : '';
      const totalFail = failures.length === selectedVideos.length;
      setBulkDownload({
        loading: false,
        message: totalFail
          ? ''
          : baseDir
            ? `Saved ${savedCount} file(s) into ${folderByChannel.size} folder(s); ${dbOkCount} transcript(s) in the database.${failNote}`
            : `Saved ${dbOkCount} transcript(s) to the database.${failNote}`,
        error: totalFail
          ? sameFailure
            ? firstFailure
            : failures.map((f) => `${f.id}: ${f.message}`).join(' ')
          : '',
        partialFailures: !totalFail && failures.length > 0
      });
    } catch (e) {
      const cancelled = e?.name === 'AbortError';
      setBulkDownload({
        loading: false,
        message: '',
        error: cancelled
          ? 'Folder selection cancelled.'
          : e.message || 'Failed to get transcripts.',
        partialFailures: false
      });
    }
  };

  const channelSelectionDisabled = channels.length === 0;
  const videoPanelDisabled = selectedChannels.length === 0;

  const canBulkGetTranscripts = useMemo(() => {
    if (visibleVideos.length === 0) return false;
    if (selectedVisibleCount > 0) return true;
    return visibleVideos.some((v) => !v.hasTranscript);
  }, [visibleVideos, selectedVisibleCount]);

  return (
    <div className="channel-monitor">
      <p className="channel-monitor-intro">
        Add channels below. Use checkboxes to choose which channels contribute to the
        video list. Optionally narrow videos by <strong>published date/time</strong>.
        Bulk <strong>Get Transcripts</strong> saves to the database and, in Chromium
        browsers, also writes .txt files to a folder you pick. With{' '}
        <strong>no video rows checked</strong>, it syncs the latest uploads from YouTube,
        then downloads transcripts for every visible video that does not have one yet.
        Check specific rows to fetch or export only those (including re-export to disk).
        Click a row marked <strong>Downloaded</strong> to open the transcript in a reader
        with keyword search.
      </p>

      <div className="channel-monitor-toolbar">
        <div className="channel-add-row">
          <input
            type="text"
            className="channel-add-input"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && !addBusy && !importBusy && handleAddChannel()
            }
            placeholder="Channel URL, @handle, or UC…"
            disabled={addBusy || importBusy}
          />
          <button
            type="button"
            className="search-button channel-add-button"
            onClick={handleAddChannel}
            disabled={addBusy || importBusy}
          >
            {addBusy ? 'Adding…' : 'Add Channel'}
          </button>
        </div>
        <div className="channel-io-row">
          <button
            type="button"
            className="channel-io-button"
            onClick={handleExportChannels}
            disabled={importBusy || addBusy || channels.length === 0}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="channel-io-button"
            onClick={handleImportChannelsClick}
            disabled={importBusy || addBusy}
          >
            {importBusy ? 'Importing…' : 'Import JSON'}
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="channel-io-file-input"
            onChange={handleImportChannelsFile}
            tabIndex={-1}
            aria-hidden="true"
          />
          <span className="channel-io-hint">
            Backup or restore your saved channel list.
          </span>
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
                      onClick={() => {
                        setSelectedChannelId(c.youtubeChannelId);
                        setSelectedChannelIds((prev) => {
                          if (prev.has(c.youtubeChannelId)) return prev;
                          const next = new Set(prev);
                          next.add(c.youtubeChannelId);
                          return next;
                        });
                      }}
                    >
                      {c.thumbnailUrl ? (
                        <ChannelAvatar
                          src={c.thumbnailUrl}
                          className="channel-saved-thumb"
                        />
                      ) : null}
                      <span className="channel-saved-text">
                        <span className="channel-saved-title">
                          {c.title}
                          {selectedChannelId === c.youtubeChannelId ? ' (focused)' : ''}
                        </span>
                        <span className="channel-saved-meta">
                          Downloaded {c.downloadedCount} / {c.totalCount}
                        </span>
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
              type="date"
              className="channel-date-input channel-datetime-input"
              value={datetimeLocalDatePart(publishedFrom)}
              onChange={(e) =>
                setPublishedFrom((prev) =>
                  withDatetimeLocalDate(prev, e.target.value)
                )
              }
              disabled={videoPanelDisabled}
            />
            <label htmlFor="published-to" className="channel-date-label">
              to
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
                setPublishedFrom(formatSevenDaysAgoLocalValue());
                setPublishedTo(formatEndOfTodayLocalValue());
              }}
              disabled={videoPanelDisabled}
            >
              Clear range
            </button>
          </div>
          <SmartBulkTranscriptPanel
            youtubeChannelId={selectedChannelId || ''}
            channelTitle={focusedChannel?.title || ''}
            disabled={channels.length === 0 || !selectedChannelId}
            otherBulkBusy={bulkDownload.loading}
            onBusyChange={setSmartBulkBusy}
            onFinished={async () => {
              await loadChannels();
              await refreshVideos();
            }}
          />
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
                smartBulkBusy ||
                videoPanelDisabled ||
                !canBulkGetTranscripts
              }
            >
              {bulkDownload.loading ? 'Getting…' : 'Get Transcripts'}
            </button>
          </div>
          {bulkDownload.error && (
            <p className="error-message channel-bulk-status">{bulkDownload.error}</p>
          )}
          {bulkDownload.message && (
            <p
              className={`channel-bulk-status ${
                bulkDownload.partialFailures
                  ? 'channel-bulk-partial'
                  : 'channel-bulk-success'
              }`}
            >
              {bulkDownload.message}
            </p>
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
                    onClick={() => {
                      if (v.hasTranscript) {
                        void openTranscriptModal(v);
                      } else {
                        setSelectedVideoId(v.youtubeVideoId);
                        closeTranscriptModal();
                      }
                    }}
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
                      disabled={
                        downloadingVideoId === v.youtubeVideoId || smartBulkBusy
                      }
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

      <TranscriptReaderModal
        video={transcriptModalVideo}
        onClose={closeTranscriptModal}
        onSummarySaved={handleTranscriptSummarySaved}
      />
    </div>
  );
}
