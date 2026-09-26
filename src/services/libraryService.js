import { apiFetch } from './apiClient';

async function parseJsonResponse(res, fallbackMessage) {
  const raw = await res.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    const error = new Error(body.error || raw || fallbackMessage);
    error.code = body.code;
    throw error;
  }
  return body;
}

export async function syncChannel(
  channelInput,
  limit = 50,
  pageToken = '',
  { signal, minDurationSeconds = 0 } = {}
) {
  const res = await apiFetch('/api/channels/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelInput,
      limit,
      pageToken,
      minDurationSeconds
    }),
    signal
  });
  return parseJsonResponse(res, 'Failed to sync channel');
}

export async function listChannels() {
  const res = await apiFetch('/api/channels');
  const data = await parseJsonResponse(res, 'Failed to load channels');
  return data.channels || [];
}

export async function removeChannel(youtubeChannelId) {
  const res = await apiFetch(
    `/api/channels/${encodeURIComponent(youtubeChannelId)}`,
    { method: 'DELETE' }
  );
  return parseJsonResponse(res, 'Failed to remove channel');
}

export async function listChannelVideosPage(
  youtubeChannelId,
  status = 'all',
  skip = 0,
  take = 200,
  { fields = 'list', signal, minDurationSeconds = 0 } = {}
) {
  const cappedTake = Math.min(Math.max(Number(take) || 200, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const qp = new URLSearchParams({
    status,
    skip: String(safeSkip),
    take: String(cappedTake),
    fields: fields === 'full' ? 'full' : 'list'
  });
  const minimumDuration = Math.max(Number(minDurationSeconds) || 0, 0);
  if (minimumDuration > 0) {
    qp.set('minDurationSeconds', String(Math.floor(minimumDuration)));
  }
  const res = await apiFetch(
    `/api/channels/${encodeURIComponent(youtubeChannelId)}/videos?${qp}`,
    { signal }
  );
  const data = await parseJsonResponse(res, 'Failed to load channel videos');
  const items = data.items || [];
  const total = typeof data.total === 'number' ? data.total : items.length + safeSkip;
  return { items, total };
}

/** Backwards-compatible: first page only (max 200). Prefer {@link listChannelVideosPage} or {@link listAllChannelVideos}. */
export async function listChannelVideos(youtubeChannelId, status = 'all') {
  const { items } = await listChannelVideosPage(youtubeChannelId, status, 0, 200);
  return items;
}

export async function getChannelVideoTotal(
  youtubeChannelId,
  status = 'all',
  { signal } = {}
) {
  const { total } = await listChannelVideosPage(
    youtubeChannelId,
    status,
    0,
    1,
    { signal }
  );
  return total;
}

export async function listAllChannelVideos(
  youtubeChannelId,
  status = 'all',
  { fields = 'list', signal } = {}
) {
  const take = 200;
  let skip = 0;
  const out = [];
  let total = Infinity;
  while (skip < total) {
    const page = await listChannelVideosPage(youtubeChannelId, status, skip, take, {
      fields,
      signal
    });
    total = page.total;
    out.push(...page.items);
    if (page.items.length === 0) break;
    skip += page.items.length;
  }
  return out;
}

export async function listNewestChannelVideos(
  youtubeChannelId,
  limit,
  status = 'all',
  { fields = 'list', signal, minDurationSeconds = 0 } = {}
) {
  const wanted = Math.max(Number(limit) || 1, 1);
  const out = [];
  let skip = 0;
  let total = Infinity;
  while (out.length < wanted && skip < total) {
    const page = await listChannelVideosPage(
      youtubeChannelId,
      status,
      skip,
      Math.min(200, wanted - out.length),
      { fields, signal, minDurationSeconds }
    );
    total = page.total;
    out.push(...page.items);
    if (page.items.length === 0) break;
    skip += page.items.length;
  }
  return out.slice(0, wanted);
}

export async function downloadTranscript(videoId, { signal } = {}) {
  const res = await apiFetch(`/api/videos/${encodeURIComponent(videoId)}/download-transcript`, {
    method: 'POST',
    signal
  });
  return parseJsonResponse(res, 'Failed to download transcript');
}

/**
 * @param {string} query
 * @param {string | { channelIds?: string[], downloadedOnly?: boolean }} channelIdOrOptions
 */
export async function searchLibrary(query, channelIdOrOptions = '') {
  let channelIds = [];
  let downloadedOnly = false;

  if (typeof channelIdOrOptions === 'object' && channelIdOrOptions !== null) {
    channelIds = channelIdOrOptions.channelIds || [];
    downloadedOnly = !!channelIdOrOptions.downloadedOnly;
  } else if (channelIdOrOptions) {
    channelIds = [channelIdOrOptions];
  }

  const qp = new URLSearchParams({ q: query, skip: '0', take: '200' });
  if (channelIds.length === 1) qp.set('channelId', channelIds[0]);
  else if (channelIds.length > 1) qp.set('channelIds', channelIds.join(','));
  if (downloadedOnly) qp.set('downloadedOnly', '1');
  const res = await apiFetch(`/api/search?${qp}`);
  const data = await parseJsonResponse(res, 'Failed to search library');
  return data.items || [];
}

/** Fetches video lengths from YouTube metadata for rows missing durationSeconds. */
export async function backfillVideoDurations(channelIds = []) {
  const res = await apiFetch('/api/videos/backfill-durations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelIds })
  });
  return parseJsonResponse(res, 'Failed to backfill video durations');
}

/** Loads transcript text (prefers DB when already downloaded). */
export async function apiFetchTranscriptText(videoId) {
  const res = await apiFetch(`/transcript/${encodeURIComponent(videoId)}`);
  const data = await parseJsonResponse(res, 'Failed to load transcript');
  return {
    transcript: typeof data.transcript === 'string' ? data.transcript : '',
    source: data.source || ''
  };
}

/** @deprecated Prefer {@link apiFetchTranscriptText}. */
export const fetchTranscriptText = apiFetchTranscriptText;

/** Full video row for modals and export (includes transcript and summary blobs). */
export async function fetchVideoDetail(youtubeVideoId) {
  const res = await apiFetch(`/api/videos/${encodeURIComponent(youtubeVideoId)}`);
  const data = await parseJsonResponse(res, 'Failed to load video');
  return data.video || null;
}

/**
 * Summarizes transcript via OpenRouter (server holds API key and prompts).
 * Pass youtubeVideoId so the server can persist summary + model on the Video row.
 */
export async function summarizeTranscript(transcript, mode, youtubeVideoId = '') {
  const res = await apiFetch('/api/summarize-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      mode,
      ...(youtubeVideoId ? { youtubeVideoId } : {})
    })
  });
  const data = await parseJsonResponse(res, 'Summarization failed');
  return {
    summary: typeof data.summary === 'string' ? data.summary : '',
    model: typeof data.model === 'string' ? data.model : ''
  };
}

export async function importStructuredSummaries(youtubeChannelId, items) {
  const res = await apiFetch(
    `/api/channels/${encodeURIComponent(youtubeChannelId)}/import-structured-summaries`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }
  );
  return parseJsonResponse(res, 'Structured summary import failed');
}
