import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchTranscriptText, summarizeTranscript } from '../services/libraryService';
import { buildTranscriptHighlightModel } from '../utils/transcriptTextUtils';
import {
  hasStructuredSummary,
  parseStructuredSummary
} from '../utils/structuredSummaryUtils';
import StructuredSummaryViewer from './StructuredSummaryViewer';
import IdeaFormPopover from './IdeaFormPopover';
import { getIdeaByVideoId, saveIdea } from '../services/ideasService';
import './TranscriptReaderModal.css';

function TranscriptContent({
  video,
  transcriptText,
  loading,
  error,
  search,
  setSearch,
  hitIndex,
  setHitIndex,
  bodyRef,
  modalSummaries,
  displayedSummaryTab,
  setDisplayedSummaryTab,
  summarizeBusy,
  summarizeError,
  summarizeVariant,
  runSummarize
}) {
  const highlightModel = useMemo(
    () => buildTranscriptHighlightModel(transcriptText, search),
    [transcriptText, search]
  );

  useEffect(() => {
    setHitIndex(0);
  }, [search, setHitIndex]);

  useEffect(() => {
    if (!video || !search.trim()) return;
    const root = bodyRef.current;
    if (!root) return;
    const active = root.querySelector('.channel-transcript-hit-active');
    active?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [hitIndex, search, video, highlightModel.hitCount, transcriptText, bodyRef]);

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

  const searchInputId = `transcript-in-modal-search-${video.youtubeVideoId}`;

  return (
    <>
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
          <p className="channel-transcript-modal-status">
            No transcript text stored for this video.
          </p>
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
    </>
  );
}

export default function TranscriptReaderModal({
  video,
  onClose,
  onSummarySaved,
  structuredSummaryNavigation = null
}) {
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
  const [contentView, setContentView] = useState('transcript');
  const [ideaPopoverOpen, setIdeaPopoverOpen] = useState(false);
  const [ideaQuickOpen, setIdeaQuickOpen] = useState(false);
  const [savedIdea, setSavedIdea] = useState(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaSaving, setIdeaSaving] = useState(false);
  const [ideaSaveError, setIdeaSaveError] = useState('');
  const ideaStarRef = useRef(null);

  const structuredSummary = useMemo(
    () => (video ? parseStructuredSummary(video) : null),
    [video]
  );
  const showStructured = structuredSummary != null;

  useEffect(() => {
    if (!video) return;
    setError('');
    setSearch('');
    setHitIndex(0);
    setContentView(hasStructuredSummary(video) ? 'structured' : 'transcript');
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

  useEffect(() => {
    if (!video?.youtubeVideoId || !showStructured) {
      setSavedIdea(null);
      setIdeaPopoverOpen(false);
      setIdeaQuickOpen(false);
      return undefined;
    }

    let cancelled = false;
    setIdeaLoading(true);
    setIdeaSaveError('');
    getIdeaByVideoId(video.youtubeVideoId)
      .then((idea) => {
        if (!cancelled) setSavedIdea(idea);
      })
      .catch(() => {
        if (!cancelled) setSavedIdea(null);
      })
      .finally(() => {
        if (!cancelled) setIdeaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [video?.youtubeVideoId, showStructured]);

  const handleIdeaSave = useCallback(
    async ({ stars, comment }) => {
      if (!video) return;
      setIdeaSaving(true);
      setIdeaSaveError('');
      try {
        const idea = await saveIdea({
          youtubeVideoId: video.youtubeVideoId,
          channelTitle: video.channel?.title || 'Channel',
          videoTitle: video.title,
          stars,
          comment
        });
        setSavedIdea(idea);
        setIdeaPopoverOpen(false);
        setIdeaQuickOpen(false);
      } catch (e) {
        setIdeaSaveError(e.message || 'Failed to save idea');
      } finally {
        setIdeaSaving(false);
      }
    },
    [video]
  );

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
      if (e.key === 'Escape') {
        if (ideaPopoverOpen) {
          e.stopPropagation();
          setIdeaPopoverOpen(false);
          setIdeaQuickOpen(false);
          setIdeaSaveError('');
          return;
        }
        onClose();
        return;
      }

      const tag = e.target?.tagName?.toLowerCase();
      const inEditable =
        tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

      if (contentView === 'structured' && showStructured && !inEditable) {
        if (e.key === 'ArrowUp' && !ideaPopoverOpen && !ideaLoading) {
          e.preventDefault();
          setIdeaSaveError('');
          setIdeaQuickOpen(true);
          setIdeaPopoverOpen(true);
          return;
        }

        if (structuredSummaryNavigation?.canNavigate) {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            structuredSummaryNavigation.onPrev();
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            structuredSummaryNavigation.onNext();
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    video,
    onClose,
    contentView,
    showStructured,
    structuredSummaryNavigation,
    ideaPopoverOpen,
    ideaLoading
  ]);

  if (!video) return null;

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
                {video.productName ? ` · ${video.productName}` : ''}
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
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {showStructured && (
          <div className="channel-transcript-modal-view-bar">
            <div
              className="channel-transcript-view-toggle"
              role="tablist"
              aria-label="Content view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={contentView === 'structured'}
                className={
                  contentView === 'structured'
                    ? 'channel-transcript-view-toggle-button is-active'
                    : 'channel-transcript-view-toggle-button'
                }
                onClick={() => setContentView('structured')}
              >
                Structured summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={contentView === 'transcript'}
                className={
                  contentView === 'transcript'
                    ? 'channel-transcript-view-toggle-button is-active'
                    : 'channel-transcript-view-toggle-button'
                }
                onClick={() => setContentView('transcript')}
              >
                Full transcript
              </button>
            </div>
            <div className="channel-transcript-view-bar-actions">
              <div className="channel-transcript-idea-star-wrap" ref={ideaStarRef}>
                <button
                  type="button"
                  className={
                    savedIdea
                      ? 'channel-transcript-idea-star-button is-saved'
                      : 'channel-transcript-idea-star-button'
                  }
                  onClick={() => {
                    setIdeaSaveError('');
                    setIdeaQuickOpen(false);
                    setIdeaPopoverOpen((open) => !open);
                  }}
                  disabled={ideaLoading}
                  aria-label={savedIdea ? 'Edit saved idea' : 'Save as idea'}
                  title={
                    savedIdea
                      ? 'Edit saved idea'
                      : 'Save as idea (↑ in structured summary)'
                  }
                >
                  ★
                </button>
                {ideaPopoverOpen ? (
                  <IdeaFormPopover
                    mode="popover"
                    outsideClickRef={ideaStarRef}
                    channelTitle={video.channel?.title || 'Channel'}
                    videoTitle={video.title}
                    initialStars={ideaQuickOpen ? 1 : savedIdea?.stars || 0}
                    initialComment={savedIdea?.comment || ''}
                    autoFocusComment={ideaQuickOpen}
                    onSave={handleIdeaSave}
                    onCancel={() => {
                      setIdeaPopoverOpen(false);
                      setIdeaQuickOpen(false);
                      setIdeaSaveError('');
                    }}
                    saving={ideaSaving}
                    error={ideaSaveError}
                  />
                ) : null}
              </div>
              {structuredSummaryNavigation ? (
                <div className="channel-transcript-structured-nav">
                  <span
                    className="channel-transcript-structured-nav-count"
                    aria-live="polite"
                  >
                    {structuredSummaryNavigation.current} / {structuredSummaryNavigation.total}
                  </span>
                  <button
                    type="button"
                    className="channel-transcript-structured-nav-button"
                    onClick={() => {
                      setContentView('structured');
                      structuredSummaryNavigation.onPrev();
                    }}
                    disabled={!structuredSummaryNavigation.canNavigate}
                    aria-label="Previous structured summary"
                    title="Previous structured summary (←)"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="channel-transcript-structured-nav-button"
                    onClick={() => {
                      setContentView('structured');
                      structuredSummaryNavigation.onNext();
                    }}
                    disabled={!structuredSummaryNavigation.canNavigate}
                    aria-label="Next structured summary"
                    title="Next structured summary (→)"
                  >
                    →
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {contentView === 'structured' && showStructured ? (
          <div className="channel-transcript-modal-body channel-transcript-modal-body-structured">
            <StructuredSummaryViewer
              summary={structuredSummary}
              importedAt={video.structuredSummaryImportedAt}
            />
          </div>
        ) : (
          <TranscriptContent
            video={video}
            transcriptText={transcriptText}
            loading={loading}
            error={error}
            search={search}
            setSearch={setSearch}
            hitIndex={hitIndex}
            setHitIndex={setHitIndex}
            bodyRef={bodyRef}
            modalSummaries={modalSummaries}
            displayedSummaryTab={displayedSummaryTab}
            setDisplayedSummaryTab={setDisplayedSummaryTab}
            summarizeBusy={summarizeBusy}
            summarizeError={summarizeError}
            summarizeVariant={summarizeVariant}
            runSummarize={runSummarize}
          />
        )}
      </div>
    </div>
  );
}
