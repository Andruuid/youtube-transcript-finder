import { apiFetch } from './apiClient';

export const EMPTY_POLITICS_BOARD = {
  left: [],
  right: [],
  totals: {
    channels: 0,
    totalVideos: 0,
    downloaded: 0,
    missing: 0,
    left: { channels: 0, totalVideos: 0, downloaded: 0, missing: 0 },
    right: { channels: 0, totalVideos: 0, downloaded: 0, missing: 0 }
  }
};

async function parseJsonResponse(res, fallbackMessage) {
  const raw = await res.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new Error(body.error || raw || fallbackMessage);
  }
  return body;
}

export async function loadPoliticsBoard({ signal } = {}) {
  const res = await apiFetch('/api/politics', { signal });
  const data = await parseJsonResponse(res, 'Failed to load Politics board');
  return data.board || EMPTY_POLITICS_BOARD;
}

export async function addPoliticsChannel(
  channelInput,
  side,
  { signal } = {}
) {
  const res = await apiFetch('/api/politics/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelInput, side }),
    signal
  });
  return parseJsonResponse(res, 'Failed to add Politics channel');
}

export async function movePoliticsChannel(
  youtubeChannelId,
  patch,
  { signal } = {}
) {
  const res = await apiFetch(
    `/api/politics/channels/${encodeURIComponent(youtubeChannelId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      signal
    }
  );
  const data = await parseJsonResponse(res, 'Failed to move Politics channel');
  return data.board || EMPTY_POLITICS_BOARD;
}

export async function removePoliticsChannel(
  youtubeChannelId,
  { signal } = {}
) {
  const res = await apiFetch(
    `/api/politics/channels/${encodeURIComponent(youtubeChannelId)}`,
    { method: 'DELETE', signal }
  );
  const data = await parseJsonResponse(res, 'Failed to remove Politics channel');
  return data.board || EMPTY_POLITICS_BOARD;
}

export async function listPoliticsVideos(
  {
    side = 'all',
    channelId = '',
    status = 'all',
    query = '',
    from = '',
    to = '',
    skip = 0,
    take = 100
  } = {},
  { signal } = {}
) {
  const qp = new URLSearchParams({
    side,
    status,
    skip: String(skip),
    take: String(take)
  });
  if (channelId) qp.set('channelId', channelId);
  if (query.trim()) qp.set('q', query.trim());
  if (from) qp.set('from', from);
  if (to) qp.set('to', to);
  const res = await apiFetch(`/api/politics/videos?${qp}`, { signal });
  return parseJsonResponse(res, 'Failed to load Politics corpus');
}

/** Fair collection order so a stopped "both" run advances each side together. */
export function politicsCollectionOrder(board, scope = 'all') {
  const left = board?.left || [];
  const right = board?.right || [];
  if (scope === 'left') return [...left];
  if (scope === 'right') return [...right];
  const ordered = [];
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index]) ordered.push(left[index]);
    if (right[index]) ordered.push(right[index]);
  }
  return ordered;
}
