import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import ChannelAvatar from './ChannelAvatar';
import TranscriptReaderModal from './TranscriptReaderModal';
import { syncCatalogThenFetchMissingTranscripts } from '../services/channelBulkPipeline';
import { downloadTranscript } from '../services/libraryService';
import {
  addPoliticsChannel,
  EMPTY_POLITICS_BOARD,
  listPoliticsVideos,
  loadPoliticsBoard,
  movePoliticsChannel,
  politicsCollectionOrder,
  removePoliticsChannel
} from '../services/politicsService';
import './Politics.css';

const PAGE_SIZE = 100;
const TARGET_MIN = 1;
const TARGET_MAX = 500;
const MIN_DURATION_MINUTES_DEFAULT = 4;
const MIN_DURATION_MINUTES_MAX = 1440;

function clampTarget(value) {
  const number = Number(value);
  return Math.min(
    TARGET_MAX,
    Math.max(TARGET_MIN, Number.isFinite(number) ? Math.floor(number) : 200)
  );
}

function clampMinDurationMinutes(value) {
  const number = Number(value);
  return Math.min(
    MIN_DURATION_MINUTES_MAX,
    Math.max(0, Number.isFinite(number) ? Math.floor(number) : MIN_DURATION_MINUTES_DEFAULT)
  );
}

function sideLabel(side) {
  return side === 'left' ? 'Left' : 'Right';
}

function dateBoundary(date, endOfDay) {
  if (!date) return '';
  const local = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(local.getTime()) ? '' : local.toISOString();
}

function channelOptions(board, side) {
  if (side === 'left') return board.left;
  if (side === 'right') return board.right;
  return [...board.left, ...board.right];
}

function PoliticsChannelColumn({
  side,
  items,
  otherItems,
  value,
  onValueChange,
  onAdd,
  onMove,
  onRemove,
  busy
}) {
  const label = sideLabel(side);
  const otherSide = side === 'left' ? 'right' : 'left';
  const full = items.length >= 10;
  const otherFull = otherItems.length >= 10;

  return (
    <section className={`politics-side politics-side-${side}`}>
      <div className="politics-side-heading">
        <h2>{label}</h2>
        <span>{items.length}/10 channels</span>
      </div>

      <div className="politics-add-row">
        <input
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim() && !busy && !full) {
              onAdd();
            }
          }}
          placeholder="YouTube URL, @handle, or channel ID"
          disabled={busy || full}
          aria-label={`Add ${label} channel`}
        />
        <button
          type="button"
          className="search-button"
          disabled={busy || full || !value.trim()}
          onClick={onAdd}
        >
          Add
        </button>
      </div>
      {full && <p className="politics-limit-note">This side is full.</p>}

      {items.length === 0 ? (
        <p className="politics-empty">No channels assigned yet.</p>
      ) : (
        <ol className="politics-channel-list">
          {items.map((channel, index) => (
            <li key={channel.youtubeChannelId} className="politics-channel-row">
              <span className="politics-channel-position">{index + 1}</span>
              {channel.thumbnailUrl ? (
                <ChannelAvatar
                  src={channel.thumbnailUrl}
                  className="politics-channel-avatar"
                />
              ) : (
                <span className="politics-channel-avatar politics-channel-avatar-empty" />
              )}
              <span className="politics-channel-copy">
                <strong>{channel.title}</strong>
                <small>
                  {channel.downloadedCount}/{channel.totalCount} transcripts
                </small>
              </span>
              <span className="politics-channel-actions">
                <button
                  type="button"
                  onClick={() => onMove(channel, side, index - 1)}
                  disabled={busy || index === 0}
                  aria-label={`Move ${channel.title} up`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(channel, side, index + 1)}
                  disabled={busy || index === items.length - 1}
                  aria-label={`Move ${channel.title} down`}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onMove(channel, otherSide, otherItems.length)}
                  disabled={busy || otherFull}
                  aria-label={`Move ${channel.title} to ${sideLabel(otherSide)}`}
                  title={`Move to ${sideLabel(otherSide)}`}
                >
                  {side === 'left' ? '→' : '←'}
                </button>
                <button
                  type="button"
                  className="politics-remove-button"
                  onClick={() => onRemove(channel)}
                  disabled={busy}
                  aria-label={`Remove ${channel.title} from Politics`}
                  title="Remove from Politics"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Politics() {
  const [board, setBoard] = useState(EMPTY_POLITICS_BOARD);
  const [boardLoading, setBoardLoading] = useState(true);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [scope, setScope] = useState('all');
  const [targetCount, setTargetCount] = useState(200);
  const [minDurationMinutes, setMinDurationMinutes] = useState(
    MIN_DURATION_MINUTES_DEFAULT
  );
  const collectionAbortRef = useRef(null);
  const [collection, setCollection] = useState({
    running: false,
    stopped: false,
    message: '',
    processedChannels: 0,
    totalChannels: 0,
    downloaded: 0,
    skipped: 0,
    failures: [],
    channelErrors: []
  });

  const [filters, setFilters] = useState({
    side: 'all',
    channelId: '',
    status: 'all',
    query: '',
    from: '',
    to: ''
  });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [corpus, setCorpus] = useState({
    items: [],
    total: 0,
    loading: false,
    loadingMore: false,
    error: ''
  });
  const [corpusVersion, setCorpusVersion] = useState(0);
  const corpusAbortRef = useRef(null);
  const [downloadingVideoId, setDownloadingVideoId] = useState('');
  const [modalVideo, setModalVideo] = useState(null);

  const refreshBoard = useCallback(async () => {
    const loaded = await loadPoliticsBoard();
    setBoard(loaded);
    return loaded;
  }, []);

  useEffect(() => {
    let active = true;
    setBoardLoading(true);
    loadPoliticsBoard()
      .then((loaded) => {
        if (active) setBoard(loaded);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Failed to load Politics board');
      })
      .finally(() => {
        if (active) setBoardLoading(false);
      });
    return () => {
      active = false;
      collectionAbortRef.current?.abort();
      corpusAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(filters.query.trim()),
      250
    );
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  const availableFilterChannels = useMemo(
    () => channelOptions(board, filters.side),
    [board, filters.side]
  );

  useEffect(() => {
    if (
      filters.channelId &&
      !availableFilterChannels.some(
        (channel) => channel.youtubeChannelId === filters.channelId
      )
    ) {
      setFilters((previous) => ({ ...previous, channelId: '' }));
    }
  }, [availableFilterChannels, filters.channelId]);

  const loadCorpus = useCallback(
    async ({ append = false, skip = 0 } = {}) => {
      if (board.totals.channels === 0) {
        setCorpus({
          items: [],
          total: 0,
          loading: false,
          loadingMore: false,
          error: ''
        });
        return;
      }

      corpusAbortRef.current?.abort();
      const controller = new AbortController();
      corpusAbortRef.current = controller;
      setCorpus((previous) => ({
        ...previous,
        loading: !append,
        loadingMore: append,
        error: ''
      }));
      try {
        const result = await listPoliticsVideos(
          {
            side: filters.side,
            channelId: filters.channelId,
            status: filters.status,
            query: debouncedQuery,
            from: dateBoundary(filters.from, false),
            to: dateBoundary(filters.to, true),
            skip,
            take: PAGE_SIZE
          },
          { signal: controller.signal }
        );
        setCorpus((previous) => ({
          items: append
            ? [...previous.items, ...(result.items || [])]
            : result.items || [],
          total: result.total || 0,
          loading: false,
          loadingMore: false,
          error: ''
        }));
      } catch (loadError) {
        if (loadError?.name === 'AbortError') return;
        setCorpus((previous) => ({
          ...previous,
          loading: false,
          loadingMore: false,
          error: loadError.message || 'Failed to load Politics corpus'
        }));
      }
    },
    [
      board.totals.channels,
      debouncedQuery,
      filters.channelId,
      filters.from,
      filters.side,
      filters.status,
      filters.to
    ]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCorpus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [corpusVersion, loadCorpus]);

  const handleAdd = async (side) => {
    const value = side === 'left' ? leftInput : rightInput;
    if (!value.trim()) return;
    setMutationBusy(true);
    setError('');
    setNotice(`Adding ${sideLabel(side)} channel…`);
    try {
      const result = await addPoliticsChannel(value.trim(), side);
      setBoard(result.board || (await refreshBoard()));
      if (side === 'left') setLeftInput('');
      else setRightInput('');
      setNotice(`Added ${result.sync?.channel?.title || 'channel'} to ${sideLabel(side)}.`);
      setCorpusVersion((version) => version + 1);
    } catch (addError) {
      setError(addError.message || 'Failed to add channel');
      setNotice('');
    } finally {
      setMutationBusy(false);
    }
  };

  const handleMove = async (channel, side, position) => {
    setMutationBusy(true);
    setError('');
    setNotice('');
    try {
      const nextBoard = await movePoliticsChannel(channel.youtubeChannelId, {
        side,
        position
      });
      setBoard(nextBoard);
      setCorpusVersion((version) => version + 1);
    } catch (moveError) {
      setError(moveError.message || 'Failed to move channel');
    } finally {
      setMutationBusy(false);
    }
  };

  const handleRemove = async (channel) => {
    setMutationBusy(true);
    setError('');
    setNotice('');
    try {
      const nextBoard = await removePoliticsChannel(channel.youtubeChannelId);
      setBoard(nextBoard);
      setNotice(
        `Removed ${channel.title} from Politics. Stored transcripts remain in the library.`
      );
      setCorpusVersion((version) => version + 1);
    } catch (removeError) {
      setError(removeError.message || 'Failed to remove channel');
    } finally {
      setMutationBusy(false);
    }
  };

  const runCollection = async () => {
    const channels = politicsCollectionOrder(board, scope);
    if (channels.length === 0) {
      setError(`No ${scope === 'all' ? '' : `${sideLabel(scope)} `}channels to collect.`);
      return;
    }
    const target = clampTarget(targetCount);
    const minimumMinutes = clampMinDurationMinutes(minDurationMinutes);
    setTargetCount(target);
    setMinDurationMinutes(minimumMinutes);
    const controller = new AbortController();
    collectionAbortRef.current = controller;
    setError('');
    setNotice('');

    let downloaded = 0;
    let skipped = 0;
    const failures = [];
    const channelErrors = [];
    setCollection({
      running: true,
      stopped: false,
      message: 'Starting collection…',
      processedChannels: 0,
      totalChannels: channels.length,
      downloaded,
      skipped,
      failures,
      channelErrors
    });

    let stopped = false;
    for (let index = 0; index < channels.length; index += 1) {
      const channel = channels[index];
      if (controller.signal.aborted) {
        stopped = true;
        break;
      }
      const downloadedBeforeChannel = downloaded;
      const skippedBeforeChannel = skipped;
      let channelDownloaded = 0;
      let channelSkipped = 0;
      const stoppedChannelFailures = [];
      try {
        const result = await syncCatalogThenFetchMissingTranscripts({
          channelInput: channel.youtubeChannelId,
          youtubeChannelId: channel.youtubeChannelId,
          targetCount: target,
          minDurationSeconds: minimumMinutes * 60,
          signal: controller.signal,
          onProgress: (event) => {
            channelDownloaded = Math.max(
              channelDownloaded,
              Number(event.downloaded) || 0
            );
            channelSkipped = Math.max(
              channelSkipped,
              Number(event.skipped) || 0
            );
            if (event.step === 'transcript-error' && event.youtubeVideoId) {
              stoppedChannelFailures.push({
                youtubeVideoId: event.youtubeVideoId,
                title: event.youtubeVideoId,
                message: event.message || 'Transcript download failed',
                channelTitle: channel.title
              });
            }
            setCollection((previous) => ({
              ...previous,
              message: `${index + 1}/${channels.length} · ${channel.title}: ${
                event.message || 'Working…'
              }`,
              downloaded: downloadedBeforeChannel + channelDownloaded,
              skipped: skippedBeforeChannel + channelSkipped
            }));
          }
        });
        downloaded += result.transcriptsDownloaded;
        skipped += result.transcriptsSkipped;
        failures.push(
          ...result.transcriptFailures.map((failure) => ({
            ...failure,
            channelTitle: channel.title
          }))
        );
      } catch (collectionError) {
        if (
          collectionError?.name === 'AbortError' ||
          controller.signal.aborted
        ) {
          downloaded += channelDownloaded;
          skipped += channelSkipped;
          failures.push(...stoppedChannelFailures);
          stopped = true;
          break;
        }
        channelErrors.push({
          youtubeChannelId: channel.youtubeChannelId,
          channelTitle: channel.title,
          message: collectionError.message || 'Channel collection failed'
        });
      }

      const collectionSnapshot = {
        processedChannels: index + 1,
        downloaded,
        skipped,
        failures: [...failures],
        channelErrors: [...channelErrors]
      };
      setCollection((previous) => ({
        ...previous,
        ...collectionSnapshot
      }));
    }

    try {
      await refreshBoard();
    } catch (refreshError) {
      channelErrors.push({
        channelTitle: 'Board refresh',
        message: refreshError.message || 'Counts could not be refreshed'
      });
    }
    setCorpusVersion((version) => version + 1);
    setCollection((previous) => ({
      ...previous,
      running: false,
      stopped,
      message: stopped
        ? 'Collection stopped. Completed transcripts remain stored; rerun to resume missing work.'
        : `Collection complete: ${downloaded} downloaded, ${skipped} already stored, ${
            failures.length + channelErrors.length
          } failed.`,
      downloaded,
      skipped,
      failures: [...failures],
      channelErrors: [...channelErrors]
    }));
    collectionAbortRef.current = null;
  };

  const handleDownloadOne = async (video) => {
    setDownloadingVideoId(video.youtubeVideoId);
    setError('');
    setNotice('');
    try {
      await downloadTranscript(video.youtubeVideoId);
      setNotice(`Stored transcript for “${video.title}”.`);
      await refreshBoard();
      setCorpusVersion((version) => version + 1);
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download transcript');
    } finally {
      setDownloadingVideoId('');
    }
  };

  const boardBusy = boardLoading || mutationBusy || collection.running;
  const collectionFailureCount =
    collection.failures.length + collection.channelErrors.length;

  return (
    <div className="politics">
      <p className="politics-intro">
        Build a user-curated political transcript corpus. Labels are assignments
        you control; this release stores source material and does not judge factual
        accuracy or intent.
      </p>

      {error && <div className="error-message politics-message">{error}</div>}
      {notice && <div className="politics-success politics-message">{notice}</div>}

      <div className="politics-board">
        <PoliticsChannelColumn
          side="left"
          items={board.left}
          otherItems={board.right}
          value={leftInput}
          onValueChange={setLeftInput}
          onAdd={() => handleAdd('left')}
          onMove={handleMove}
          onRemove={handleRemove}
          busy={boardBusy}
        />
        <PoliticsChannelColumn
          side="right"
          items={board.right}
          otherItems={board.left}
          value={rightInput}
          onValueChange={setRightInput}
          onAdd={() => handleAdd('right')}
          onMove={handleMove}
          onRemove={handleRemove}
          busy={boardBusy}
        />
      </div>

      <section className="politics-collector">
        <div className="politics-section-heading">
          <div>
            <h2>Collect transcripts</h2>
            <p>
              Refresh the newest uploads and store only transcripts that are still
              missing. Reruns are safe.
            </p>
          </div>
          <div className="politics-summary-stats" aria-label="Corpus totals">
            <span>
              <strong>{board.totals.downloaded}</strong> downloaded
            </span>
            <span>
              <strong>{board.totals.missing}</strong> missing
            </span>
          </div>
        </div>
        <div className="politics-collection-controls">
          <label>
            Scope
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              disabled={collection.running}
            >
              <option value="all">Both sides</option>
              <option value="left">Left only</option>
              <option value="right">Right only</option>
            </select>
          </label>
          <label>
            Newest videos per channel
            <input
              type="number"
              min={TARGET_MIN}
              max={TARGET_MAX}
              value={targetCount}
              onChange={(event) => setTargetCount(clampTarget(event.target.value))}
              disabled={collection.running}
            />
          </label>
          <label>
            Minimum length (minutes)
            <input
              type="number"
              min="0"
              max={MIN_DURATION_MINUTES_MAX}
              step="1"
              value={minDurationMinutes}
              onChange={(event) =>
                setMinDurationMinutes(clampMinDurationMinutes(event.target.value))
              }
              disabled={collection.running}
              title="Videos shorter than this are ignored. Use 0 to include every length."
            />
          </label>
          {!collection.running ? (
            <button
              type="button"
              className="search-button politics-collect-button"
              disabled={boardLoading || mutationBusy || board.totals.channels === 0}
              onClick={runCollection}
            >
              Sync &amp; collect
            </button>
          ) : (
            <button
              type="button"
              className="politics-stop-button"
              onClick={() => collectionAbortRef.current?.abort()}
            >
              Stop safely
            </button>
          )}
        </div>
        {collection.message && (
          <div
            className={`politics-progress ${
              collectionFailureCount > 0 ? 'politics-progress-warning' : ''
            }`}
          >
            <strong>{collection.message}</strong>
            <span>
              Channels {collection.processedChannels}/{collection.totalChannels} ·{' '}
              Downloaded {collection.downloaded} · Already stored {collection.skipped}
              {collectionFailureCount > 0
                ? ` · Failed ${collectionFailureCount}`
                : ''}
            </span>
            {collectionFailureCount > 0 && (
              <details>
                <summary>Failure details</summary>
                <ul>
                  {collection.failures.slice(0, 20).map((failure) => (
                    <li key={`${failure.channelTitle}-${failure.youtubeVideoId}`}>
                      {failure.channelTitle}: {failure.title || failure.youtubeVideoId} —{' '}
                      {failure.message}
                    </li>
                  ))}
                  {collection.channelErrors.map((failure) => (
                    <li key={`${failure.channelTitle}-${failure.youtubeChannelId || ''}`}>
                      {failure.channelTitle}: {failure.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="politics-corpus">
        <div className="politics-section-heading">
          <div>
            <h2>Transcript corpus</h2>
            <p>
              {corpus.total} matching video{corpus.total === 1 ? '' : 's'} across
              the current Politics board.
            </p>
          </div>
        </div>
        <div className="politics-filters">
          <select
            value={filters.side}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                side: event.target.value,
                channelId: ''
              }))
            }
            aria-label="Filter corpus by side"
          >
            <option value="all">Both sides</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
          <select
            value={filters.channelId}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                channelId: event.target.value
              }))
            }
            aria-label="Filter corpus by channel"
          >
            <option value="">All channels</option>
            {availableFilterChannels.map((channel) => (
              <option
                key={channel.youtubeChannelId}
                value={channel.youtubeChannelId}
              >
                {channel.title}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                status: event.target.value
              }))
            }
            aria-label="Filter corpus by transcript status"
          >
            <option value="all">All transcript statuses</option>
            <option value="downloaded">Downloaded</option>
            <option value="missing">Missing</option>
          </select>
          <input
            type="search"
            value={filters.query}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                query: event.target.value
              }))
            }
            placeholder="Search title, description, or transcript"
            aria-label="Search Politics corpus"
          />
          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  from: event.target.value
                }))
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  to: event.target.value
                }))
              }
            />
          </label>
          <button
            type="button"
            className="politics-clear-filters"
            onClick={() =>
              setFilters({
                side: 'all',
                channelId: '',
                status: 'all',
                query: '',
                from: '',
                to: ''
              })
            }
          >
            Clear
          </button>
        </div>

        {corpus.error && (
          <p className="error-message politics-corpus-status">{corpus.error}</p>
        )}
        {corpus.loading ? (
          <p className="politics-empty">Loading corpus…</p>
        ) : corpus.items.length === 0 ? (
          <p className="politics-empty">
            {board.totals.channels === 0
              ? 'Add channels to begin building the corpus.'
              : 'No videos match these filters.'}
          </p>
        ) : (
          <ul className="politics-video-list">
            {corpus.items.map((video) => (
              <li key={video.youtubeVideoId}>
                <button
                  type="button"
                  className="politics-video-main"
                  onClick={() => video.hasTranscript && setModalVideo(video)}
                  disabled={!video.hasTranscript}
                  title={
                    video.hasTranscript
                      ? 'Open stored transcript'
                      : 'Download the transcript to open it'
                  }
                >
                  <span
                    className={`politics-side-badge politics-side-badge-${video.politicsSide}`}
                  >
                    {sideLabel(video.politicsSide)}
                  </span>
                  <span className="politics-video-copy">
                    <strong>{video.title}</strong>
                    <small>
                      {video.channel?.title || 'Channel'} ·{' '}
                      {new Date(video.publishedAt).toLocaleDateString()} ·{' '}
                      {video.hasTranscript ? 'Downloaded' : 'Missing transcript'}
                    </small>
                  </span>
                </button>
                <span className="politics-video-actions">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    YouTube
                  </a>
                  {!video.hasTranscript && (
                    <button
                      type="button"
                      className="search-button"
                      onClick={() => handleDownloadOne(video)}
                      disabled={
                        downloadingVideoId === video.youtubeVideoId ||
                        collection.running
                      }
                    >
                      {downloadingVideoId === video.youtubeVideoId
                        ? 'Downloading…'
                        : 'Download'}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {corpus.items.length < corpus.total && (
          <button
            type="button"
            className="politics-load-more"
            disabled={corpus.loadingMore}
            onClick={() =>
              loadCorpus({ append: true, skip: corpus.items.length })
            }
          >
            {corpus.loadingMore
              ? 'Loading…'
              : `Load more (${corpus.items.length}/${corpus.total})`}
          </button>
        )}
      </section>

      <TranscriptReaderModal
        video={modalVideo}
        onClose={() => setModalVideo(null)}
        onSummarySaved={(videoId, patch) => {
          setModalVideo((previous) =>
            previous?.youtubeVideoId === videoId
              ? { ...previous, ...patch }
              : previous
          );
          setCorpus((previous) => ({
            ...previous,
            items: previous.items.map((video) =>
              video.youtubeVideoId === videoId ? { ...video, ...patch } : video
            )
          }));
        }}
      />
    </div>
  );
}
