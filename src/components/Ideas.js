import React, { useCallback, useEffect, useState } from 'react';
import IdeaFormPopover, { StarRatingDisplay } from './IdeaFormPopover';
import { deleteIdea, listIdeas, saveIdea } from '../services/ideasService';
import './Ideas.css';

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [ideaPendingDelete, setIdeaPendingDelete] = useState(null);

  const refreshIdeas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await listIdeas();
      setIdeas(items);
    } catch (e) {
      setError(e.message || 'Failed to load ideas');
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshIdeas();
  }, [refreshIdeas]);

  const handleCreate = async (payload) => {
    setSaving(true);
    setSaveError('');
    try {
      await saveIdea(payload);
      setShowCreate(false);
      await refreshIdeas();
    } catch (e) {
      setSaveError(e.message || 'Failed to save idea');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (idea) => {
    setIdeaPendingDelete(idea);
  };

  const handleDeleteCancel = () => {
    if (deletingId != null) return;
    setIdeaPendingDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!ideaPendingDelete) return;

    const id = ideaPendingDelete.id;
    setDeletingId(id);
    setError('');
    try {
      await deleteIdea(id);
      setIdeas((prev) => prev.filter((item) => item.id !== id));
      setIdeaPendingDelete(null);
    } catch (e) {
      setError(e.message || 'Failed to delete idea');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="ideas-view">
      <div className="ideas-toolbar">
        <div>
          <h2 className="ideas-heading">Saved ideas</h2>
          <p className="ideas-subheading">
            Star-rated ideas from structured summaries or your own notes.
          </p>
        </div>
        <button
          type="button"
          className="search-button ideas-add-button"
          onClick={() => {
            setSaveError('');
            setShowCreate(true);
          }}
          aria-label="Add idea"
          title="Add idea"
        >
          +
        </button>
      </div>

      {error ? <p className="error-message">{error}</p> : null}

      {loading ? (
        <p className="ideas-empty">Loading ideas…</p>
      ) : ideas.length === 0 ? (
        <div className="ideas-empty ideas-empty-card">
          <p>No ideas yet — save one from a structured summary or click +.</p>
        </div>
      ) : (
        <ul className="ideas-list">
          {ideas.map((idea) => (
            <li key={idea.id} className="ideas-card">
              <div className="ideas-card-header">
                <StarRatingDisplay stars={idea.stars} />
                <div className="ideas-card-actions">
                  {idea.youtubeVideoId ? (
                    <span className="ideas-badge">From library</span>
                  ) : null}
                  <button
                    type="button"
                    className="ideas-delete-button"
                    onClick={() => handleDeleteClick(idea)}
                    disabled={deletingId === idea.id}
                    aria-label="Delete idea"
                    title="Delete idea"
                  >
                    ×
                  </button>
                </div>
              </div>
              {idea.channelTitle ? (
                <p className="ideas-card-channel">{idea.channelTitle}</p>
              ) : null}
              <h3 className="ideas-card-title">{idea.videoTitle}</h3>
              {idea.comment ? (
                <p className="ideas-card-comment">{idea.comment}</p>
              ) : null}
              <div className="ideas-card-footer">
                <time className="ideas-card-date" dateTime={idea.updatedAt}>
                  {new Date(idea.updatedAt).toLocaleString()}
                </time>
                {idea.youtubeVideoId ? (
                  <a
                    className="ideas-card-link"
                    href={`https://www.youtube.com/watch?v=${idea.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open on YouTube
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate ? (
        <IdeaFormPopover
          mode="modal"
          manual
          onSave={handleCreate}
          onCancel={() => {
            setShowCreate(false);
            setSaveError('');
          }}
          saving={saving}
          error={saveError}
        />
      ) : null}

      {ideaPendingDelete ? (
        <div
          className="ideas-delete-backdrop"
          role="presentation"
          onClick={handleDeleteCancel}
        >
          <div
            className="ideas-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ideas-delete-title"
            aria-describedby="ideas-delete-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ideas-delete-title" className="ideas-delete-title">
              Delete idea?
            </h3>
            <p id="ideas-delete-desc" className="ideas-delete-message">
              Delete &ldquo;{ideaPendingDelete.videoTitle || 'Untitled'}&rdquo;? This
              cannot be undone.
            </p>
            <div className="ideas-delete-actions">
              <button
                type="button"
                className="ideas-delete-cancel"
                onClick={handleDeleteCancel}
                disabled={deletingId != null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="search-button ideas-delete-confirm"
                onClick={handleDeleteConfirm}
                disabled={deletingId != null}
              >
                {deletingId != null ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
