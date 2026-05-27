import React, { useEffect, useRef, useState } from 'react';
import './IdeaFormPopover.css';

export const EFFORT_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const STAR_COUNT = 5;

export function StarRatingDisplay({ stars, className = '', compact = false }) {
  const count = Math.min(Math.max(Number(stars) || 0, 0), STAR_COUNT);
  return (
    <span
      className={`idea-star-display ${compact ? 'is-compact' : ''} ${className}`.trim()}
      aria-label={`${count} out of ${STAR_COUNT} stars`}
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((n) => (
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

export function EffortDisplay({ effort, className = '' }) {
  if (!effort) {
    return <span className={`idea-effort-display is-empty ${className}`.trim()}>—</span>;
  }
  const label =
    EFFORT_LEVELS.find((level) => level.value === effort)?.label || effort;
  return (
    <span
      className={`idea-effort-display idea-effort-display-${effort} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export function StarRatingInput({ value, onChange, disabled = false, compact = false }) {
  return (
    <div
      className={`idea-star-picker ${compact ? 'is-compact' : ''}`}
      role="group"
      aria-label="Rating"
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={
            n <= value
              ? 'idea-star-picker-star is-selected'
              : 'idea-star-picker-star'
          }
          onClick={() => onChange(n)}
          disabled={disabled}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={n <= value}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return <StarRatingInput value={value} onChange={onChange} />;
}

function EffortPicker({ value, onChange }) {
  return (
    <div className="idea-effort-picker" role="group" aria-label="Estimated Effort">
      {EFFORT_LEVELS.map(({ value: level, label }) => (
        <button
          key={level}
          type="button"
          className={
            value === level
              ? `idea-effort-picker-option is-selected idea-effort-display-${level}`
              : 'idea-effort-picker-option'
          }
          onClick={() => onChange(level)}
          aria-pressed={value === level}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function IdeaFormPopover({
  mode = 'popover',
  manual = false,
  editing = false,
  channelTitle: initialChannelTitle = '',
  videoTitle: initialVideoTitle = '',
  initialStars = 0,
  initialEffort = '',
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
  const [effort, setEffort] = useState(initialEffort);
  const [comment, setComment] = useState(initialComment);
  const panelRef = useRef(null);
  const commentRef = useRef(null);

  useEffect(() => {
    setChannelTitle(initialChannelTitle);
    setVideoTitle(initialVideoTitle);
    setStars(initialStars);
    setEffort(initialEffort);
    setComment(initialComment);
  }, [
    initialChannelTitle,
    initialVideoTitle,
    initialStars,
    initialEffort,
    initialComment
  ]);

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
  const showEditableFields = manual || editing;
  const canSave =
    stars >= 1 &&
    stars <= STAR_COUNT &&
    (!showEditableFields || trimmedTitle.length > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave?.({
      channelTitle: channelTitle.trim(),
      videoTitle: trimmedTitle,
      stars,
      effort: effort || null,
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
        {editing ? 'Edit idea' : manual ? 'New idea' : 'Save idea'}
      </h3>

      {showEditableFields ? (
        <>
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
        </>
      ) : (
        <div className="idea-form-popover-readonly-meta">
          <p className="idea-form-popover-meta-line">
            <span className="idea-form-popover-meta-label">Title</span>
            {videoTitle || 'Untitled'}
          </p>
          {channelTitle ? (
            <p className="idea-form-popover-meta-line">
              <span className="idea-form-popover-meta-label">Channel</span>
              {channelTitle}
            </p>
          ) : null}
        </div>
      )}

      <div className="idea-form-popover-field">
        <span className="idea-form-popover-label">Rating</span>
        <StarPicker value={stars} onChange={setStars} />
      </div>

      <div className="idea-form-popover-field">
        <span className="idea-form-popover-label">Estimated Effort</span>
        <EffortPicker value={effort} onChange={setEffort} />
      </div>

      <label className="idea-form-popover-field">
        <span className="idea-form-popover-label">Description</span>
        <textarea
          ref={commentRef}
          className="idea-form-popover-textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleCommentKeyDown}
          placeholder="Why is this interesting?"
          rows={5}
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
