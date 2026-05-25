import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TranscriptReaderModal from './TranscriptReaderModal';
import ChannelAvatar from './ChannelAvatar';
import './TranscriptLibrary.css';
import {
  listAllChannelVideos,
  listChannels,
  searchLibrary
} from '../services/libraryService';

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
  if (seconds == null || seconds <= 0) return '';
  const sec = Math.round(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')} hr`;
  return `${m} min`;
}

export default function TranscriptLibrary() {
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [minMinutes, setMinMinutes] = useState(0);
  const [videos, setVideos] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState('');
  const [modalVideo, setModalVideo] = useState(null);

  const channelsWithTranscripts = useMemo(
    () => channels.filter((c) => c.downloadedCount > 0),
    [channels]
  );

  const selectedChannels = useMemo(
    () => channelsWithTranscripts.filter((c) => selectedChannelIds.has(c.youtubeChannelId)),
    [channelsWithTranscripts, selectedChannelIds]
  );

  const focusedChannel = useMemo(
    () => channelsWithTranscripts.find((c) => c.youtubeChannelId === selectedChannelId),
    [channelsWithTranscripts, selectedChannelId]
  );

  const allChannelsSelected =
    channelsWithTranscripts.length > 0 &&
    selectedChannels.length === channelsWithTranscripts.length;

  const isSearching = !!searchQuery.trim();
  const multiChannelView = selectedChannels.length > 1;
  const hasDurationFilter = minMinutes > 0;

  const visibleVideos = useMemo(
    () => videos.filter((v) => passesMinDurationFilter(v, minMinutes)),
    [videos, minMinutes]
  );

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
    if (focusedChannel) return focusedChannel.title;
    if (selectedChannels.length > 1) return `Transcripts (${selectedChannels.length} channels)`;
    return 'Transcripts';
  }, [isSearching, focusedChannel, selectedChannels]);

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    setError('');
    try {
      const loaded = await listChannels();
      setChannels(loaded);
      const withTranscripts = loaded.filter((c) => c.downloadedCount > 0);
      setSelectedChannelIds((prev) => {
        if (prev.size === 0 && withTranscripts.length > 0) {
          return new Set(withTranscripts.map((c) => c.youtubeChannelId));
        }
        const next = new Set();
        for (const c of withTranscripts) {
          if (prev.has(c.youtubeChannelId)) next.add(c.youtubeChannelId);
        }
        if (next.size === 0 && withTranscripts.length > 0) {
          return new Set(withTranscripts.map((c) => c.youtubeChannelId));
        }
        return next;
      });
      setSelectedChannelId((prev) => {
        if (prev && withTranscripts.some((c) => c.youtubeChannelId === prev)) {
          return prev;
        }
        return withTranscripts[0]?.youtubeChannelId || '';
      });
    } catch (e) {
      setError(e.message || 'Failed to load channels');
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

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

    try {
      const trimmed = searchQuery.trim();
      if (trimmed) {
        const results = await searchLibrary(trimmed, {
          channelIds: ids,
          downloadedOnly: true
        });
        setVideos(mergeVideosById(results));
      } else {
        const batches = await Promise.all(
          ids.map((id) => listAllChannelVideos(id, 'downloaded'))
        );
        setVideos(mergeVideosById(batches.flat()));
      }
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

  const handleChannelFocus = (youtubeChannelId) => {
    setSelectedChannelId(youtubeChannelId);
  };

  const handleSummarySaved = useCallback((videoId, patch) => {
    setModalVideo((pv) => (pv ? { ...pv, ...patch } : pv));
    setVideos((list) =>
      list.map((x) => (x.youtubeVideoId === videoId ? { ...x, ...patch } : x))
    );
  }, []);

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
          Matches titles first, then description and transcript text. Use channel checkboxes to
          search one or many channels. Set min. length to filter out Shorts and shorter videos
          {hasDurationFilter && unknownDurationCount > 0
            ? ` (${unknownDurationCount} hidden without duration — re-sync channel to update).`
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
                {channelsWithTranscripts.map((c) => (
                  <li key={c.youtubeChannelId} className="transcript-library-channel-item">
                    <label className="transcript-library-channel-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedChannelIds.has(c.youtubeChannelId)}
                        onChange={() => toggleChannelSelection(c.youtubeChannelId)}
                        aria-label={`Include ${c.title} in search and list`}
                      />
                    </label>
                    <button
                      type="button"
                      className={
                        selectedChannelId === c.youtubeChannelId
                          ? 'transcript-library-channel-button is-active'
                          : 'transcript-library-channel-button'
                      }
                      onClick={() => handleChannelFocus(c.youtubeChannelId)}
                    >
                      {c.thumbnailUrl ? (
                        <ChannelAvatar
                          src={c.thumbnailUrl}
                          className="transcript-library-channel-thumb"
                        />
                      ) : null}
                      <span className="transcript-library-channel-text">
                        <span className="transcript-library-channel-title">
                          {c.title}
                          {selectedChannelId === c.youtubeChannelId ? ' (focused)' : ''}
                        </span>
                        <span className="transcript-library-channel-meta">
                          {c.downloadedCount} transcript{c.downloadedCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
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
              Select at least one channel (checkbox) to browse or search transcripts.
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
            <div className="video-grid">
              {visibleVideos.map((v) => (
                <button
                  key={v.youtubeVideoId}
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
                    {hasSummary(v) && (
                      <div className="transcript-library-card-badges">
                        <span className="transcript-library-badge">Summarized</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <TranscriptReaderModal
        video={modalVideo}
        onClose={() => setModalVideo(null)}
        onSummarySaved={handleSummarySaved}
      />
    </div>
  );
}
