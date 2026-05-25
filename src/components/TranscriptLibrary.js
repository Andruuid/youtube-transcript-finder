import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TranscriptReaderModal from './TranscriptReaderModal';
import ChannelAvatar from './ChannelAvatar';
import './TranscriptLibrary.css';
import {
  backfillVideoDurations,
  downloadTranscript,
  fetchTranscriptText,
  listAllChannelVideos,
  listChannels,
  searchLibrary
} from '../services/libraryService';
import {
  hasStoredSelectedChannelIds,
  readStoredSelectedChannelIds,
  reconcileSelectedChannelIds,
  writeStoredSelectedChannelIds
} from '../utils/channelSelectionStorage';
import {
  importStructuredSummariesFromFolder,
  summarizeStructuredImportResult
} from '../services/structuredSummaryImport';
import { hasStructuredSummary } from '../utils/structuredSummaryUtils';

const VIEW_MODE_STORAGE_KEY = 'transcriptLibraryViewMode';

function readStoredViewMode() {
  try {
    const value = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return value === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

function hasSummary(video) {
  return !!(video.sumShort?.trim() || video.sumLong?.trim());
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

function passesMinDurationFilter(video, minMinutes) {
  if (!minMinutes || minMinutes <= 0) return true;
  const sec = video.durationSeconds;
  if (sec == null) return false;
  return sec >= minMinutes * 60;
}

function formatDuration(seconds) {
  if (seconds == null || seconds <= 0) return '—';
  const sec = Math.round(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')} hr`;
  return `${m} min`;
}

function displayCell(value) {
  const text = String(value || '').trim();
  return text || '—';
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

export default function TranscriptLibrary() {
  const [channels, setChannels] = useState([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState(
    () => readStoredSelectedChannelIds() ?? new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [minMinutes, setMinMinutes] = useState(0);
  const [videos, setVideos] = useState([]);
  const [backfillingDurations, setBackfillingDurations] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState('');
  const [modalVideo, setModalVideo] = useState(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState(() => new Set());
  const [bulkDownload, setBulkDownload] = useState({
    loading: false,
    message: '',
    error: '',
    partialFailures: false
  });
  const [viewMode, setViewMode] = useState(() => readStoredViewMode());
  const [summaryImport, setSummaryImport] = useState({
    loading: false,
    message: '',
    error: '',
    partialFailures: false
  });
  const persistSelectionRef = useRef(false);

  const channelsWithTranscripts = useMemo(
    () => channels.filter((c) => c.downloadedCount > 0),
    [channels]
  );

  const selectedChannels = useMemo(
    () => channelsWithTranscripts.filter((c) => selectedChannelIds.has(c.youtubeChannelId)),
    [channelsWithTranscripts, selectedChannelIds]
  );

  const allChannelsSelected =
    channelsWithTranscripts.length > 0 &&
    selectedChannels.length === channelsWithTranscripts.length;

  const isSearching = !!searchQuery.trim();
  const multiChannelView = selectedChannels.length > 1;
  const singleChannelSelected = selectedChannels.length === 1;
  const hasDurationFilter = minMinutes > 0;

  const visibleVideos = useMemo(
    () => videos.filter((v) => passesMinDurationFilter(v, minMinutes)),
    [videos, minMinutes]
  );

  const structuredSummaryVideos = useMemo(
    () => visibleVideos.filter((v) => hasStructuredSummary(v)),
    [visibleVideos]
  );

  const structuredSummaryNav = useMemo(() => {
    if (!modalVideo || structuredSummaryVideos.length === 0) return null;
    const currentIndex = structuredSummaryVideos.findIndex(
      (v) => v.youtubeVideoId === modalVideo.youtubeVideoId
    );
    if (currentIndex < 0) return null;

    const total = structuredSummaryVideos.length;
    return {
      current: currentIndex + 1,
      total,
      canNavigate: total > 1,
      onPrev: () => {
        const nextIndex =
          (currentIndex - 1 + structuredSummaryVideos.length) %
          structuredSummaryVideos.length;
        setModalVideo(structuredSummaryVideos[nextIndex]);
      },
      onNext: () => {
        const nextIndex = (currentIndex + 1) % structuredSummaryVideos.length;
        setModalVideo(structuredSummaryVideos[nextIndex]);
      }
    };
  }, [modalVideo, structuredSummaryVideos]);

  const unknownDurationCount = useMemo(
    () =>
      hasDurationFilter
        ? videos.filter((v) => v.durationSeconds == null).length
        : 0,
    [videos, hasDurationFilter]
  );

  const mainHeading = useMemo(() => {
    if (isSearching) {
      return selectedChannels.length === 1
        ? `Search: ${selectedChannels[0].title}`
        : 'Search results';
    }
    if (selectedChannels.length === 1) return selectedChannels[0].title;
    if (selectedChannels.length > 1) return `Transcripts (${selectedChannels.length} channels)`;
    return 'Transcripts';
  }, [isSearching, selectedChannels]);

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    setError('');
    try {
      const loaded = await listChannels();
      setChannels(loaded);
      const withTranscripts = loaded.filter((c) => c.downloadedCount > 0);
      const availableIds = withTranscripts.map((c) => c.youtubeChannelId);
      setSelectedChannelIds((prev) => {
        const reconciled = reconcileSelectedChannelIds(prev, availableIds);
        if (
          reconciled.size === 0 &&
          withTranscripts.length > 0 &&
          !hasStoredSelectedChannelIds()
        ) {
          return new Set(availableIds);
        }
        return reconciled;
      });
    } catch (e) {
      setError(e.message || 'Failed to load channels');
    } finally {
      persistSelectionRef.current = true;
      setLoadingChannels(false);
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
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore storage errors
    }
  }, [viewMode]);

  const refreshVideos = useCallback(async () => {
    const ids = channelsWithTranscripts
      .filter((c) => selectedChannelIds.has(c.youtubeChannelId))
      .map((c) => c.youtubeChannelId);

    if (!ids.length) {
      setVideos([]);
      return;
    }

    setLoadingVideos(true);
    setError('');
    setModalVideo(null);

    const loadVideos = async () => {
      const trimmed = searchQuery.trim();
      if (trimmed) {
        const results = await searchLibrary(trimmed, {
          channelIds: ids,
          downloadedOnly: true
        });
        return mergeVideosById(results);
      }
      const batches = await Promise.all(
        ids.map((id) => listAllChannelVideos(id, 'downloaded'))
      );
      return mergeVideosById(batches.flat());
    };

    try {
      let loaded = await loadVideos();
      if (loaded.some((v) => v.durationSeconds == null)) {
        setBackfillingDurations(true);
        try {
          await backfillVideoDurations(ids);
          loaded = await loadVideos();
        } catch (backfillError) {
          console.warn('[TranscriptLibrary] duration backfill failed', backfillError);
        } finally {
          setBackfillingDurations(false);
        }
      }
      setVideos(loaded);
    } catch (e) {
      setError(e.message || 'Failed to load transcripts');
    } finally {
      setLoadingVideos(false);
    }
  }, [channelsWithTranscripts, selectedChannelIds, searchQuery]);

  useEffect(() => {
    if (loadingChannels) return;
    refreshVideos();
  }, [loadingChannels, refreshVideos]);

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
      if (allChannelsSelected) return new Set();
      return new Set(channelsWithTranscripts.map((c) => c.youtubeChannelId));
    });
  };

  const handleSummarySaved = useCallback((videoId, patch) => {
    setModalVideo((pv) => (pv ? { ...pv, ...patch } : pv));
    setVideos((list) =>
      list.map((x) => (x.youtubeVideoId === videoId ? { ...x, ...patch } : x))
    );
  }, []);

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

  const handleDownloadTranscripts = async () => {
    const selectedVideos = visibleVideos.filter((v) =>
      selectedVideoIds.has(v.youtubeVideoId)
    );
    if (selectedVideos.length === 0) return;

    setBulkDownload({
      loading: true,
      message: `Downloading ${selectedVideos.length} transcript(s)…`,
      error: '',
      partialFailures: false
    });
    setError('');

    try {
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
            message: err?.message || String(err)
          });
        }
      }

      const failNote =
        failures.length > 0
          ? ` ${failures.length} failed (${failures.map((f) => f.id).join(', ')}).`
          : '';
      const totalFail = failures.length === selectedVideos.length;
      setBulkDownload({
        loading: false,
        message: totalFail
          ? ''
          : baseDir
            ? `Saved ${savedCount} file(s) into ${folderByChannel.size} folder(s); ${dbOkCount} transcript(s) in the database.${failNote}`
            : `Saved ${dbOkCount} transcript(s) to the database.${failNote}`,
        error: totalFail ? failures.map((f) => `${f.id}: ${f.message}`).join(' ') : '',
        partialFailures: !totalFail && failures.length > 0
      });
    } catch (e) {
      const cancelled = e?.name === 'AbortError';
      setBulkDownload({
        loading: false,
        message: '',
        error: cancelled
          ? 'Folder selection cancelled.'
          : e.message || 'Failed to download transcripts.',
        partialFailures: false
      });
    }
  };

  const handleImportStructuredSummaries = async () => {
    if (!singleChannelSelected) return;
    const channelId = selectedChannels[0].youtubeChannelId;

    setSummaryImport({
      loading: true,
      message: 'Reading JSON files…',
      error: '',
      partialFailures: false
    });
    setError('');

    try {
      const result = await importStructuredSummariesFromFolder(channelId);
      const { message, partialFailures } = summarizeStructuredImportResult(result);
      const totalFail = (result.imported || 0) === 0 && (result.skipped || 0) > 0;

      setSummaryImport({
        loading: false,
        message: totalFail ? '' : message,
        error: totalFail
          ? (result.results || [])
              .filter((row) => row.status !== 'imported')
              .map((row) => `${row.file}: ${row.error || row.status}`)
              .join(' ')
          : '',
        partialFailures: partialFailures && !totalFail
      });

      if ((result.imported || 0) > 0) {
        await refreshVideos();
      }
    } catch (e) {
      const cancelled = e?.name === 'AbortError';
      setSummaryImport({
        loading: false,
        message: '',
        error: cancelled
          ? 'Folder selection cancelled.'
          : e.message || 'Structured summary import failed.',
        partialFailures: false
      });
    }
  };

  const videoPanelDisabled = !loadingChannels && selectedChannels.length === 0;

  return (
    <div className="transcript-library">
      <div className="transcript-library-search-bar">
        <div className="transcript-library-search-row">
          <div className="transcript-library-search-field">
            <label className="transcript-library-search-label" htmlFor="transcript-library-search">
              Search transcripts
            </label>
            <input
              id="transcript-library-search"
              type="search"
              className="transcript-library-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search video titles (use quotes for exact phrases, e.g. "part 2")'
              disabled={videoPanelDisabled}
              aria-label="Search downloaded transcripts by title"
            />
          </div>
          <div className="transcript-library-duration-filter">
            <label className="transcript-library-search-label" htmlFor="transcript-library-min-minutes">
              Min. length (minutes)
            </label>
            <input
              id="transcript-library-min-minutes"
              type="number"
              className="transcript-library-duration-input"
              value={minMinutes}
              onChange={(e) => setMinMinutes(Math.max(0, Number(e.target.value) || 0))}
              min="0"
              step="1"
              title="0 = no minimum. 1 hides most Shorts under 60 seconds."
              disabled={videoPanelDisabled}
              aria-label="Minimum video length in minutes"
            />
          </div>
        </div>
        <p className="transcript-library-search-hint">
          Matches titles first, then description and transcript text. Click channels to browse or
          search one or many at once. Set min. length to filter out Shorts and shorter videos
          {backfillingDurations
            ? ' (fetching video lengths from YouTube…).'
            : hasDurationFilter && unknownDurationCount > 0
            ? ` (${unknownDurationCount} still missing length metadata).`
            : '.'}
        </p>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="transcript-library-columns">
        <aside className="transcript-library-sidebar">
          <h2>Channels</h2>
          {loadingChannels && (
            <p className="transcript-library-empty">Loading channels…</p>
          )}
          {!loadingChannels && channelsWithTranscripts.length === 0 && (
            <p className="transcript-library-empty">
              No downloaded transcripts yet. Use Channel monitor to sync channels and download
              transcripts.
            </p>
          )}
          {!loadingChannels && channelsWithTranscripts.length > 0 && (
            <>
              <label className="transcript-library-select-all">
                <input
                  type="checkbox"
                  checked={allChannelsSelected}
                  onChange={toggleAllChannelsSelection}
                />
                <span>
                  Select all ({selectedChannels.length}/{channelsWithTranscripts.length})
                </span>
              </label>
              <ul className="transcript-library-channel-list">
                {channelsWithTranscripts.map((c) => {
                  const isSelected = selectedChannelIds.has(c.youtubeChannelId);
                  return (
                    <li key={c.youtubeChannelId} className="transcript-library-channel-item">
                      <label
                        className={
                          isSelected
                            ? 'transcript-library-channel-row is-active'
                            : 'transcript-library-channel-row'
                        }
                      >
                        <input
                          type="checkbox"
                          className="transcript-library-channel-checkbox-input"
                          checked={isSelected}
                          onChange={() => toggleChannelSelection(c.youtubeChannelId)}
                          aria-label={`Include ${c.title} in search and list`}
                        />
                        {c.thumbnailUrl ? (
                          <ChannelAvatar
                            src={c.thumbnailUrl}
                            className="transcript-library-channel-thumb"
                          />
                        ) : null}
                        <span className="transcript-library-channel-text">
                          <span className="transcript-library-channel-title">{c.title}</span>
                          <span className="transcript-library-channel-meta">
                            {c.downloadedCount} transcript{c.downloadedCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        <section className="transcript-library-main">
          <div className="transcript-library-main-header">
            <h2>{mainHeading}</h2>
            {!loadingVideos && !videoPanelDisabled && (
              <span className="transcript-library-count">
                {visibleVideos.length}
                {hasDurationFilter && visibleVideos.length !== videos.length
                  ? ` of ${videos.length}`
                  : ''}{' '}
                {isSearching ? 'match' : 'downloaded'}
                {visibleVideos.length === 1 ? '' : 'es'}
                {selectedChannels.length > 1 ? ` · ${selectedChannels.length} channels` : ''}
              </span>
            )}
          </div>

          {videoPanelDisabled && (
            <p className="transcript-library-empty">
              Select at least one channel to browse or search transcripts.
            </p>
          )}
          {loadingVideos && (
            <p className="transcript-library-empty">Loading transcripts…</p>
          )}
          {!loadingVideos && !videoPanelDisabled && visibleVideos.length === 0 && (
            <p className="transcript-library-empty">
              {videos.length > 0 && hasDurationFilter
                ? 'No transcripts meet the minimum length filter.'
                : isSearching
                ? 'No transcripts match your search in the selected channels.'
                : 'No downloaded transcripts for the selected channels.'}
            </p>
          )}
          {!loadingVideos && visibleVideos.length > 0 && (
            <>
              <div className="transcript-library-video-actions">
                <label className="transcript-library-video-select-all">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVideoSelections}
                    disabled={videoPanelDisabled}
                  />
                  <span>
                    Select all ({selectedVisibleCount}/{visibleVideos.length})
                  </span>
                </label>
                <div
                  className="transcript-library-view-toggle"
                  role="group"
                  aria-label="Library view mode"
                >
                  <button
                    type="button"
                    className={
                      viewMode === 'cards'
                        ? 'transcript-library-view-button is-active'
                        : 'transcript-library-view-button'
                    }
                    onClick={() => setViewMode('cards')}
                    aria-pressed={viewMode === 'cards'}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    className={
                      viewMode === 'table'
                        ? 'transcript-library-view-button is-active'
                        : 'transcript-library-view-button'
                    }
                    onClick={() => setViewMode('table')}
                    aria-pressed={viewMode === 'table'}
                  >
                    Table
                  </button>
                </div>
                <button
                  type="button"
                  className="search-button transcript-library-import-button"
                  onClick={handleImportStructuredSummaries}
                  disabled={
                    summaryImport.loading ||
                    videoPanelDisabled ||
                    !singleChannelSelected
                  }
                  title={
                    singleChannelSelected
                      ? 'Import structured summary JSON files from a folder (one channel at a time)'
                      : 'Select exactly one channel to import structured summaries'
                  }
                >
                  {summaryImport.loading ? 'Importing…' : 'Import Structured Summaries'}
                </button>
                <button
                  type="button"
                  className="search-button transcript-library-download-button"
                  onClick={handleDownloadTranscripts}
                  disabled={
                    bulkDownload.loading || videoPanelDisabled || selectedVisibleCount === 0
                  }
                >
                  {bulkDownload.loading ? 'Downloading…' : 'Download Transcripts'}
                </button>
              </div>
              {summaryImport.error && (
                <p className="error-message transcript-library-bulk-status">{summaryImport.error}</p>
              )}
              {summaryImport.message && (
                <p
                  className={`transcript-library-bulk-status ${
                    summaryImport.partialFailures
                      ? 'transcript-library-bulk-partial'
                      : 'transcript-library-bulk-success'
                  }`}
                >
                  {summaryImport.message}
                </p>
              )}
              {bulkDownload.error && (
                <p className="error-message transcript-library-bulk-status">{bulkDownload.error}</p>
              )}
              {bulkDownload.message && (
                <p
                  className={`transcript-library-bulk-status ${
                    bulkDownload.partialFailures
                      ? 'transcript-library-bulk-partial'
                      : 'transcript-library-bulk-success'
                  }`}
                >
                  {bulkDownload.message}
                </p>
              )}
              {viewMode === 'cards' ? (
              <div className="video-grid">
                {visibleVideos.map((v) => (
                  <div key={v.youtubeVideoId} className="transcript-library-grid-item">
                    <label
                      className="transcript-library-card-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.has(v.youtubeVideoId)}
                        onChange={() => toggleVideoSelection(v.youtubeVideoId)}
                        aria-label={`Select ${v.title}`}
                      />
                    </label>
                    <button
                      type="button"
                      className="video-card transcript-library-card"
                      onClick={() => setModalVideo(v)}
                    >
                      {v.thumbnailUrl ? (
                        <img
                          src={v.thumbnailUrl}
                          alt=""
                          className="video-thumbnail"
                        />
                      ) : (
                        <div className="video-thumbnail" style={{ background: '#eee' }} />
                      )}
                      <div className="video-info">
                        <h3 className="video-title">{v.title}</h3>
                        <p className="transcript-library-published">
                          {new Date(v.publishedAt).toLocaleDateString()}
                          {v.durationSeconds != null
                            ? ` · ${formatDuration(v.durationSeconds)}`
                            : ''}
                          {multiChannelView && v.channel?.title ? ` · ${v.channel.title}` : ''}
                          {isSearching && v.matchSource ? ` · Match: ${v.matchSource}` : ''}
                        </p>
                        {(hasSummary(v) || hasStructuredSummary(v)) && (
                          <div className="transcript-library-card-badges">
                            {hasSummary(v) && (
                              <span className="transcript-library-badge">Summarized</span>
                            )}
                            {hasStructuredSummary(v) && (
                              <span className="transcript-library-badge transcript-library-badge-structured">
                                Structured
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
              ) : (
              <div className="transcript-library-table-wrap">
                <table className="transcript-library-table">
                  <thead>
                    <tr>
                      <th className="transcript-library-table-check" scope="col">
                        <span className="visually-hidden">Select</span>
                      </th>
                      <th scope="col">YT Channel</th>
                      <th scope="col">Title</th>
                      <th scope="col">Product Name</th>
                      <th scope="col">Niche</th>
                      <th scope="col">Length</th>
                      <th scope="col">Structured Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleVideos.map((v) => (
                      <tr
                        key={v.youtubeVideoId}
                        className="transcript-library-table-row"
                        onClick={() => setModalVideo(v)}
                      >
                        <td className="transcript-library-table-check">
                          <input
                            type="checkbox"
                            checked={selectedVideoIds.has(v.youtubeVideoId)}
                            onChange={() => toggleVideoSelection(v.youtubeVideoId)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${v.title}`}
                          />
                        </td>
                        <td>{displayCell(v.channel?.title)}</td>
                        <td className="transcript-library-table-title" title={v.title}>
                          {v.title}
                        </td>
                        <td>{displayCell(v.productName)}</td>
                        <td>{displayCell(v.niche)}</td>
                        <td>{formatDuration(v.durationSeconds)}</td>
                        <td>
                          {hasStructuredSummary(v) ? (
                            <span className="transcript-library-table-yes">Yes</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </section>
      </div>

      <TranscriptReaderModal
        video={modalVideo}
        onClose={() => setModalVideo(null)}
        onSummarySaved={handleSummarySaved}
        structuredSummaryNavigation={structuredSummaryNav}
      />
    </div>
  );
}
