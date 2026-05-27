import React, { useCallback, useEffect, useMemo, useState } from 'react';
import IdeaFormPopover, {
  EFFORT_LEVELS,
  StarRatingInput
} from './IdeaFormPopover';
import { deleteIdea, listIdeas, saveIdea, updateIdea } from '../services/ideasService';
import './Ideas.css';

const EFFORT_ORDER = { low: 1, medium: 2, high: 3 };
const UNSET_EFFORT_ORDER = 99;

const TABLE_COLUMNS = [
  { key: 'videoTitle', label: 'Title' },
  { key: 'stars', label: 'Stars' },
  { key: 'channelTitle', label: 'Channel' },
  { key: 'effort', label: 'Estimated Effort' },
  { key: 'comment', label: 'Description' },
  { key: 'source', label: 'Source' },
  { key: 'updatedAt', label: 'Updated' }
];

function effortSortValue(effort) {
  return EFFORT_ORDER[effort] ?? UNSET_EFFORT_ORDER;
}

function sortIdeas(items) {
  return [...items].sort((a, b) => {
    const starsDiff = (Number(b.stars) || 0) - (Number(a.stars) || 0);
    if (starsDiff !== 0) return starsDiff;

    const effortDiff = effortSortValue(a.effort) - effortSortValue(b.effort);
    if (effortDiff !== 0) return effortDiff;

    return (a.videoTitle || '').localeCompare(b.videoTitle || '', undefined, {
      sensitivity: 'base'
    });
  });
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function ChannelCell({ channelTitle }) {
  const text = String(channelTitle || '').trim();
  if (!text) return '—';

  const className = 'ideas-table-cell-clamp ideas-table-channel-text';
  if (isHttpUrl(text)) {
    return (
      <a
        href={text}
        className={`${className} ideas-table-channel-link`}
        target="_blank"
        rel="noopener noreferrer"
        title={text}
      >
        {text}
      </a>
    );
  }

  return (
    <span className={className} title={text}>
      {text}
    </span>
  );
}

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [ideaPendingDelete, setIdeaPendingDelete] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

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

  const sortedIdeas = useMemo(() => sortIdeas(ideas), [ideas]);

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

  const handleEditSave = async (payload) => {
    if (!editingIdea) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateIdea(editingIdea.id, payload);
      setIdeas((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditingIdea(null);
    } catch (e) {
      setSaveError(e.message || 'Failed to update idea');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (idea) => {
    setSaveError('');
    setShowCreate(false);
    setEditingIdea(idea);
  };

  const handleInlineUpdate = async (idea, patch) => {
    setUpdatingId(idea.id);
    setError('');
    try {
      const updated = await updateIdea(idea.id, patch);
      setIdeas((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (e) {
      setError(e.message || 'Failed to update idea');
    } finally {
      setUpdatingId(null);
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
            Sorted by stars (highest first), then estimated effort (low to high).
          </p>
        </div>
        <button
          type="button"
          className="search-button ideas-add-button"
          onClick={() => {
            setSaveError('');
            setEditingIdea(null);
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
        <div className="ideas-table-wrap">
          <table className="ideas-table">
            <colgroup>
              <col className="ideas-col-title" />
              <col className="ideas-col-stars" />
              <col className="ideas-col-channel" />
              <col className="ideas-col-effort" />
              <col className="ideas-col-description" />
              <col className="ideas-col-source" />
              <col className="ideas-col-updated" />
              <col className="ideas-col-actions" />
            </colgroup>
            <thead>
              <tr>
                {TABLE_COLUMNS.map(({ key, label }) => (
                  <th key={key} scope="col" className="ideas-table-header">
                    {label}
                  </th>
                ))}
                <th scope="col" className="ideas-table-actions-col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedIdeas.map((idea) => (
                <tr key={idea.id} className="ideas-table-row">
                  <td className="ideas-table-title">
                    <button
                      type="button"
                      className="ideas-table-title-button ideas-table-cell-clamp"
                      onClick={() => handleEditClick(idea)}
                      title={idea.videoTitle}
                    >
                      {idea.videoTitle}
                    </button>
                  </td>
                  <td className="ideas-table-stars">
                    <StarRatingInput
                      value={idea.stars || 0}
                      onChange={(stars) => handleInlineUpdate(idea, { stars })}
                      disabled={updatingId === idea.id}
                      compact
                    />
                  </td>
                  <td className="ideas-table-channel">
                    <ChannelCell channelTitle={idea.channelTitle} />
                  </td>
                  <td className="ideas-table-effort">
                    <select
                      className={`ideas-effort-select ${
                        idea.effort ? `is-${idea.effort}` : 'is-empty'
                      }`}
                      value={idea.effort || ''}
                      onChange={(e) =>
                        handleInlineUpdate(idea, {
                          effort: e.target.value || null
                        })
                      }
                      disabled={updatingId === idea.id}
                      aria-label={`Estimated effort for ${idea.videoTitle}`}
                    >
                      <option value="">—</option>
                      {EFFORT_LEVELS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ideas-table-comment">
                    {idea.comment ? (
                      <span
                        className="ideas-table-comment-text ideas-table-cell-clamp ideas-table-cell-clamp-description"
                        title={idea.comment}
                      >
                        {idea.comment}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="ideas-table-source">
                    {idea.youtubeVideoId ? (
                      <span className="ideas-badge">Library</span>
                    ) : (
                      <span className="ideas-badge ideas-badge-manual">Manual</span>
                    )}
                  </td>
                  <td className="ideas-table-date">
                    <time dateTime={idea.updatedAt}>
                      {new Date(idea.updatedAt).toLocaleString()}
                    </time>
                  </td>
                  <td className="ideas-table-actions">
                    {idea.youtubeVideoId ? (
                      <a
                        className="ideas-table-link"
                        href={`https://www.youtube.com/watch?v=${idea.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        YouTube
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="ideas-delete-button"
                      onClick={() => handleDeleteClick(idea)}
                      disabled={deletingId === idea.id}
                      aria-label={`Delete idea: ${idea.videoTitle}`}
                      title="Delete idea"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {editingIdea ? (
        <IdeaFormPopover
          key={editingIdea.id}
          mode="modal"
          editing
          channelTitle={editingIdea.channelTitle || ''}
          videoTitle={editingIdea.videoTitle || ''}
          initialStars={editingIdea.stars || 0}
          initialEffort={editingIdea.effort || ''}
          initialComment={editingIdea.comment || ''}
          onSave={handleEditSave}
          onCancel={() => {
            setEditingIdea(null);
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
              Delete this idea?
            </h3>
            <div className="ideas-delete-warning" role="status">
              <strong>Warning:</strong> This permanently removes the idea. This action
              cannot be undone.
            </div>
            <p id="ideas-delete-desc" className="ideas-delete-message">
              You are about to delete{' '}
              <strong>&ldquo;{ideaPendingDelete.videoTitle || 'Untitled'}&rdquo;</strong>.
              Are you sure you want to continue?
            </p>
            <div className="ideas-delete-actions">
              <button
                type="button"
                className="ideas-delete-cancel"
                onClick={handleDeleteCancel}
                disabled={deletingId != null}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="ideas-delete-confirm"
                onClick={handleDeleteConfirm}
                disabled={deletingId != null}
              >
                {deletingId != null ? 'Deleting…' : 'Yes, delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
