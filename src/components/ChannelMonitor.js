import React, { useCallback, useEffect, useState } from 'react';
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

export default function ChannelMonitor() {
  const [channels, setChannels] = useState(() => loadChannels());
  const [newInput, setNewInput] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [sinceDate, setSinceDate] = useState(() => formatLocalDateInputValue());
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
      setNewInput('');
    } catch (e) {
      setAddError(e.message || 'Could not add channel');
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemove = (id) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setResults((prev) => prev.filter((v) => v.channelId !== id));
  };

  const handleCheck = async () => {
    setCheckErrors([]);
    setResults([]);
    setSelectedVideoId(null);
    setTranscript({ loading: false, text: null, error: null });

    if (channels.length === 0) {
      setCheckErrors([{ channelId: '', input: '', message: 'Add at least one channel first' }]);
      setHasChecked(true);
      return;
    }

    setCheckBusy(true);
    try {
      const payload = channels.map(({ id, input }) => ({ id, input }));
      const { videos, errors } = await checkChannelsForNewVideos(payload, sinceDate);
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
    setSelectedVideoId(videoId);
    setTranscript({ loading: true, text: null, error: null });
    try {
      const text = await getVideoTranscript(videoId);
      setTranscript({ loading: false, text, error: null });
    } catch {
      setTranscript({ loading: false, text: null, error: 'Failed to load transcript' });
    }
  }, []);

  const handleRowClick = (videoId) => {
    if (selectedVideoId === videoId && transcript.text) {
      return;
    }
    loadTranscript(videoId);
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
          <button
            type="button"
            className="search-button"
            onClick={handleCheck}
            disabled={checkBusy || channels.length === 0}
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
            <ul className="channel-saved-list">
              {channels.map((c) => (
                <li key={c.id} className="channel-saved-item">
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
                No new videos since the selected date.
              </p>
            )}
          {!checkBusy && !hasChecked && channels.length > 0 && (
            <p className="channel-empty">Click Check to load new videos for your saved channels.</p>
          )}
          {!checkBusy && channels.length === 0 && (
            <p className="channel-empty">Add channels to check for new uploads.</p>
          )}
          {results.length > 0 && (
            <ul className="channel-results-list">
              {results.map((v) => (
                <li key={v.videoId}>
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
                    <span className="channel-result-video">{v.videoTitle}</span>
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
