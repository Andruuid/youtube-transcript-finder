import React, { useEffect, useRef, useState } from 'react';
import './IdeaFormPopover.css';

export function StarRatingDisplay({ stars, className = '' }) {
  const count = Math.min(Math.max(Number(stars) || 0, 0), 3);
  return (
    <span
      className={`idea-star-display ${className}`.trim()}
      aria-label={`${count} out of 3 stars`}
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={
            n <= count ? 'idea-star-display-star is-filled' : 'idea-star-display-star'
          }
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="idea-star-picker" role="group" aria-label="Rating">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          className={
            n <= value
              ? 'idea-star-picker-star is-selected'
              : 'idea-star-picker-star'
          }
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={n <= value}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function IdeaFormPopover({
  mode = 'popover',
  manual = false,
  channelTitle: initialChannelTitle = '',
  videoTitle: initialVideoTitle = '',
  initialStars = 0,
  initialComment = '',
  onSave,
  onCancel,
  saving = false,
  error = '',
  outsideClickRef = null,
  autoFocusComment = false
}) {
  const [channelTitle, setChannelTitle] = useState(initialChannelTitle);
  const [videoTitle, setVideoTitle] = useState(initialVideoTitle);
  const [stars, setStars] = useState(initialStars);
  const [comment, setComment] = useState(initialComment);
  const panelRef = useRef(null);
  const commentRef = useRef(null);

  useEffect(() => {
    setChannelTitle(initialChannelTitle);
    setVideoTitle(initialVideoTitle);
    setStars(initialStars);
    setComment(initialComment);
  }, [initialChannelTitle, initialVideoTitle, initialStars, initialComment]);

  useEffect(() => {
    if (!autoFocusComment) return undefined;
    const id = window.requestAnimationFrame(() => {
      commentRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [autoFocusComment]);

  useEffect(() => {
    if (mode !== 'popover') return undefined;

    const onPointerDown = (e) => {
      if (outsideClickRef?.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      onCancel?.();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel?.();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [mode, onCancel, outsideClickRef]);

  const trimmedTitle = videoTitle.trim();
  const canSave = stars >= 1 && stars <= 3 && (!manual || trimmedTitle.length > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave?.({
      channelTitle: channelTitle.trim(),
      videoTitle: trimmedTitle,
      stars,
      comment: comment.trim()
    });
  };

  const handleCommentKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (saving || !canSave) return;
    panelRef.current?.requestSubmit();
  };

  const form = (
    <form
      ref={panelRef}
      className={
        mode === 'modal'
          ? 'idea-form-popover idea-form-popover-modal-panel'
          : 'idea-form-popover idea-form-popover-panel'
      }
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="idea-form-popover-title">
        {manual ? 'New idea' : 'Save idea'}
      </h3>

      {manual ? (
        <>
          <label className="idea-form-popover-field">
            <span className="idea-form-popover-label">Channel (optional)</span>
            <input
              type="text"
              className="idea-form-popover-input"
              value={channelTitle}
              onChange={(e) => setChannelTitle(e.target.value)}
              placeholder="Channel or source"
            />
          </label>
          <label className="idea-form-popover-field">
            <span className="idea-form-popover-label">Title</span>
            <input
              type="text"
              className="idea-form-popover-input"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Idea title"
              required
            />
          </label>
        </>
      ) : (
        <div className="idea-form-popover-readonly-meta">
          {channelTitle ? (
            <p className="idea-form-popover-meta-line">
              <span className="idea-form-popover-meta-label">Channel</span>
              {channelTitle}
            </p>
          ) : null}
          <p className="idea-form-popover-meta-line">
            <span className="idea-form-popover-meta-label">Title</span>
            {videoTitle || 'Untitled'}
          </p>
        </div>
      )}

      <div className="idea-form-popover-field">
        <span className="idea-form-popover-label">Rating</span>
        <StarPicker value={stars} onChange={setStars} />
      </div>

      <label className="idea-form-popover-field">
        <span className="idea-form-popover-label">Comment (optional)</span>
        <textarea
          ref={commentRef}
          className="idea-form-popover-textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleCommentKeyDown}
          placeholder="Why is this interesting?"
          rows={3}
        />
      </label>

      {error ? <p className="idea-form-popover-error">{error}</p> : null}

      <div className="idea-form-popover-actions">
        <button
          type="button"
          className="idea-form-popover-cancel"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="search-button idea-form-popover-save"
          disabled={saving || !canSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );

  if (mode === 'modal') {
    return (
      <div
        className="idea-form-popover-backdrop"
        role="presentation"
        onClick={onCancel}
      >
        <div
          className="idea-form-popover-modal-wrap"
          role="dialog"
          aria-modal="true"
          aria-labelledby="idea-form-title"
          onClick={(e) => e.stopPropagation()}
        >
          {form}
        </div>
      </div>
    );
  }

  return <div className="idea-form-popover-anchor">{form}</div>;
}
