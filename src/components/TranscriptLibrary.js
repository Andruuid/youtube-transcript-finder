import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TranscriptReaderModal from './TranscriptReaderModal';
import './TranscriptLibrary.css';
import { listAllChannelVideos, listChannels } from '../services/libraryService';

function hasSummary(video) {
  return !!(video.sumShort?.trim() || video.sumLong?.trim());
}

export default function TranscriptLibrary() {
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [videos, setVideos] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState('');
  const [modalVideo, setModalVideo] = useState(null);

  const channelsWithTranscripts = useMemo(
    () => channels.filter((c) => c.downloadedCount > 0),
    [channels]
  );

  const selectedChannel = useMemo(
    () => channelsWithTranscripts.find((c) => c.youtubeChannelId === selectedChannelId),
    [channelsWithTranscripts, selectedChannelId]
  );

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    setError('');
    try {
      const loaded = await listChannels();
      setChannels(loaded);
      const withTranscripts = loaded.filter((c) => c.downloadedCount > 0);
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

  useEffect(() => {
    if (!selectedChannelId) {
      setVideos([]);
      return;
    }

    let cancelled = false;
    setLoadingVideos(true);
    setError('');
    setModalVideo(null);

    listAllChannelVideos(selectedChannelId, 'downloaded')
      .then((items) => {
        if (!cancelled) setVideos(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load transcripts');
      })
      .finally(() => {
        if (!cancelled) setLoadingVideos(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChannelId]);

  const handleChannelSelect = (youtubeChannelId) => {
    setSelectedChannelId(youtubeChannelId);
  };

  const handleSummarySaved = useCallback((videoId, patch) => {
    setModalVideo((pv) => (pv ? { ...pv, ...patch } : pv));
    setVideos((list) =>
      list.map((x) => (x.youtubeVideoId === videoId ? { ...x, ...patch } : x))
    );
  }, []);

  return (
    <div className="transcript-library">
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
            <ul className="transcript-library-channel-list">
              {channelsWithTranscripts.map((c) => (
                <li key={c.youtubeChannelId} className="transcript-library-channel-item">
                  <button
                    type="button"
                    className={
                      selectedChannelId === c.youtubeChannelId
                        ? 'transcript-library-channel-button is-active'
                        : 'transcript-library-channel-button'
                    }
                    onClick={() => handleChannelSelect(c.youtubeChannelId)}
                  >
                    {c.thumbnailUrl ? (
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="transcript-library-channel-thumb"
                      />
                    ) : null}
                    <span className="transcript-library-channel-text">
                      <span className="transcript-library-channel-title">{c.title}</span>
                      <span className="transcript-library-channel-meta">
                        {c.downloadedCount} transcript{c.downloadedCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="transcript-library-main">
          <div className="transcript-library-main-header">
            <h2>{selectedChannel?.title || 'Transcripts'}</h2>
            {selectedChannelId && !loadingVideos && (
              <span className="transcript-library-count">
                {videos.length} downloaded
              </span>
            )}
          </div>

          {loadingVideos && (
            <p className="transcript-library-empty">Loading transcripts…</p>
          )}
          {!loadingVideos && selectedChannelId && videos.length === 0 && (
            <p className="transcript-library-empty">No downloaded transcripts for this channel.</p>
          )}
          {!loadingVideos && videos.length > 0 && (
            <div className="video-grid">
              {videos.map((v) => (
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
