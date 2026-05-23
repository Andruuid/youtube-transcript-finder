import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchTranscriptText, summarizeTranscript } from '../services/libraryService';
import { buildTranscriptHighlightModel } from '../utils/transcriptTextUtils';
import './TranscriptReaderModal.css';

export default function TranscriptReaderModal({ video, onClose, onSummarySaved }) {
  const [transcriptText, setTranscriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [hitIndex, setHitIndex] = useState(0);
  const bodyRef = useRef(null);
  const [modalSummaries, setModalSummaries] = useState({
    short: { text: '', model: '' },
    long: { text: '', model: '' }
  });
  const [displayedSummaryTab, setDisplayedSummaryTab] = useState(null);
  const [summarizeBusy, setSummarizeBusy] = useState(false);
  const [summarizeError, setSummarizeError] = useState('');
  const [summarizeVariant, setSummarizeVariant] = useState(null);

  useEffect(() => {
    if (!video) return;
    setError('');
    setSearch('');
    setHitIndex(0);
    setModalSummaries({
      short: { text: video.sumShort || '', model: video.sumShortModel || '' },
      long: { text: video.sumLong || '', model: video.sumLongModel || '' }
    });
    setDisplayedSummaryTab(video.sumShort ? 'short' : video.sumLong ? 'long' : null);
    setSummarizeBusy(false);
    setSummarizeError('');
    setSummarizeVariant(null);

    const cached =
      typeof video.transcriptText === 'string' && video.transcriptText.length > 0;
    if (cached) {
      setTranscriptText(video.transcriptText);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setTranscriptText('');
    setLoading(true);
    fetchTranscriptText(video.youtubeVideoId)
      .then(({ transcript }) => {
        if (!cancelled) setTranscriptText(transcript);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Could not load transcript');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [video]);

  const runSummarize = useCallback(
    async (variant) => {
      const text = transcriptText.trim();
      if (!text || loading || error || !video) return;
      const videoId = video.youtubeVideoId;
      setSummarizeBusy(true);
      setSummarizeError('');
      setSummarizeVariant(variant);
      setDisplayedSummaryTab(variant);
      setModalSummaries((prev) => ({
        ...prev,
        short: variant === 'short' ? { text: '', model: '' } : prev.short,
        long: variant === 'long' ? { text: '', model: '' } : prev.long
      }));
      try {
        const { summary, model } = await summarizeTranscript(text, variant, videoId);
        setModalSummaries((prev) => ({
          ...prev,
          short: variant === 'short' ? { text: summary, model } : prev.short,
          long: variant === 'long' ? { text: summary, model } : prev.long
        }));
        const patch =
          variant === 'short'
            ? { sumShort: summary, sumShortModel: model }
            : { sumLong: summary, sumLongModel: model };
        onSummarySaved?.(videoId, patch);
      } catch (e) {
        setSummarizeError(e.message || 'Summarization failed');
        setModalSummaries({
          short: {
            text: video.sumShort || '',
            model: video.sumShortModel || ''
          },
          long: {
            text: video.sumLong || '',
            model: video.sumLongModel || ''
          }
        });
        setDisplayedSummaryTab(video.sumShort ? 'short' : video.sumLong ? 'long' : null);
        setSummarizeVariant(null);
      } finally {
        setSummarizeBusy(false);
      }
    },
    [transcriptText, loading, error, video, onSummarySaved]
  );

  const highlightModel = useMemo(
    () => buildTranscriptHighlightModel(transcriptText, search),
    [transcriptText, search]
  );

  useEffect(() => {
    setHitIndex(0);
  }, [search]);

  useEffect(() => {
    if (!video || !search.trim()) return;
    const root = bodyRef.current;
    if (!root) return;
    const active = root.querySelector('.channel-transcript-hit-active');
    active?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [hitIndex, search, video, highlightModel.hitCount, transcriptText]);

  useEffect(() => {
    if (!video) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [video]);

  useEffect(() => {
    if (!video) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, onClose]);

  const goPrevHit = () => {
    const n = highlightModel.hitCount;
    if (n <= 0) return;
    setHitIndex((i) => (i - 1 + n) % n);
  };

  const goNextHit = () => {
    const n = highlightModel.hitCount;
    if (n <= 0) return;
    setHitIndex((i) => (i + 1) % n);
  };

  if (!video) return null;

  const searchInputId = `transcript-in-modal-search-${video.youtubeVideoId}`;

  return (
    <div
      className="channel-transcript-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="channel-transcript-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-transcript-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="channel-transcript-modal-header">
          <div className="channel-transcript-modal-title-row">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="channel-transcript-modal-thumb"
              />
            ) : null}
            <div className="channel-transcript-modal-title-text">
              <h2 id="channel-transcript-modal-title" className="channel-transcript-modal-title">
                {video.title}
              </h2>
              <p className="channel-transcript-modal-meta">
                {video.channel?.title || 'Channel'} ·{' '}
                {new Date(video.publishedAt).toLocaleString()}
              </p>
              <a
                className="channel-transcript-modal-watch"
                href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on YouTube
              </a>
            </div>
          </div>
          <button
            type="button"
            className="channel-transcript-modal-close"
            onClick={onClose}
            aria-label="Close transcript"
          >
            ×
          </button>
        </header>

        <div className="channel-transcript-modal-toolbar">
          <label className="channel-transcript-modal-search-label" htmlFor={searchInputId}>
            Search in transcript
          </label>
          <input
            id={searchInputId}
            type="search"
            className="channel-transcript-modal-search-input"
            placeholder="Keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading || !!error}
          />
          <span className="channel-transcript-modal-hit-count" aria-live="polite">
            {search.trim()
              ? highlightModel.hitCount === 0
                ? 'No matches'
                : `${hitIndex + 1} / ${highlightModel.hitCount}`
              : ''}
          </span>
          <button
            type="button"
            className="channel-transcript-modal-nav"
            onClick={goPrevHit}
            disabled={highlightModel.hitCount === 0 || loading || !!error}
            aria-label="Previous match"
          >
            ↑ Prev
          </button>
          <button
            type="button"
            className="channel-transcript-modal-nav"
            onClick={goNextHit}
            disabled={highlightModel.hitCount === 0 || loading || !!error}
            aria-label="Next match"
          >
            Next ↓
          </button>
        </div>

        <div ref={bodyRef} className="channel-transcript-modal-body">
          {loading && (
            <p className="channel-transcript-modal-status">Loading transcript…</p>
          )}
          {!loading && error && (
            <p className="error-message channel-transcript-modal-status">{error}</p>
          )}
          {!loading && !error && !transcriptText.trim() && (
            <p className="channel-transcript-modal-status">No transcript text stored for this video.</p>
          )}
          {!loading && !error && !!transcriptText.trim() && (
            <>
              <section className="channel-transcript-summary-panel" aria-label="Summary">
                <div className="channel-transcript-summary-actions">
                  <button
                    type="button"
                    className="search-button channel-transcript-summarize-button"
                    onClick={() => void runSummarize('short')}
                    disabled={summarizeBusy}
                  >
                    {summarizeBusy && summarizeVariant === 'short'
                      ? 'Summarizing…'
                      : 'Summarize Short'}
                  </button>
                  <button
                    type="button"
                    className="search-button channel-transcript-summarize-button"
                    onClick={() => void runSummarize('long')}
                    disabled={summarizeBusy}
                  >
                    {summarizeBusy && summarizeVariant === 'long'
                      ? 'Summarizing…'
                      : 'Summarize Long'}
                  </button>
                </div>
                {modalSummaries.short.text.trim() &&
                  modalSummaries.long.text.trim() &&
                  !summarizeBusy && (
                    <div
                      className="channel-transcript-summary-view-tabs"
                      role="tablist"
                      aria-label="Stored summaries"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={displayedSummaryTab === 'short'}
                        className={
                          displayedSummaryTab === 'short'
                            ? 'channel-transcript-summary-tab is-active'
                            : 'channel-transcript-summary-tab'
                        }
                        onClick={() => setDisplayedSummaryTab('short')}
                      >
                        View short
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={displayedSummaryTab === 'long'}
                        className={
                          displayedSummaryTab === 'long'
                            ? 'channel-transcript-summary-tab is-active'
                            : 'channel-transcript-summary-tab'
                        }
                        onClick={() => setDisplayedSummaryTab('long')}
                      >
                        View long
                      </button>
                    </div>
                  )}
                {!!summarizeError && (
                  <p className="error-message channel-transcript-summary-status">{summarizeError}</p>
                )}
                {displayedSummaryTab &&
                  (() => {
                    const payload =
                      displayedSummaryTab === 'short'
                        ? modalSummaries.short
                        : modalSummaries.long;
                    const busyThis =
                      summarizeBusy && summarizeVariant === displayedSummaryTab;
                    const hasText = !!payload.text.trim();
                    if (!hasText && !busyThis) return null;
                    return (
                      <div className="channel-transcript-summary-output">
                        {payload.model && !busyThis && (
                          <p className="channel-transcript-summary-model">
                            Model:{' '}
                            <span className="channel-transcript-summary-model-slug">
                              {payload.model}
                            </span>
                          </p>
                        )}
                        <h3 className="channel-transcript-summary-heading">
                          Summary ({displayedSummaryTab === 'short' ? 'Short' : 'Long'})
                        </h3>
                        {busyThis ? (
                          <p className="channel-transcript-modal-status">Summarizing…</p>
                        ) : (
                          <div className="channel-transcript-summary-markdown">
                            <ReactMarkdown>{payload.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </section>

              <h3 className="channel-transcript-full-heading">Full transcript</h3>

              {highlightModel.paragraphs.map((parts, pi) => (
                <p key={pi} className="channel-transcript-modal-para">
                  {parts.map((part, si) =>
                    part.type === 'mark' ? (
                      <mark
                        key={si}
                        className={
                          part.hitIndex === hitIndex
                            ? 'channel-transcript-hit channel-transcript-hit-active'
                            : 'channel-transcript-hit'
                        }
                      >
                        {part.value}
                      </mark>
                    ) : (
                      <span key={si}>{part.value}</span>
                    )
                  )}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
