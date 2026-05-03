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

export async function syncChannel(channelInput, limit = 50, pageToken = '') {
  const res = await fetch('/api/channels/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelInput, limit, pageToken })
  });
  return parseJsonResponse(res, 'Failed to sync channel');
}

export async function listChannels() {
  const res = await fetch('/api/channels');
  const data = await parseJsonResponse(res, 'Failed to load channels');
  return data.channels || [];
}

export async function removeChannel(youtubeChannelId) {
  const res = await fetch(
    `/api/channels/${encodeURIComponent(youtubeChannelId)}`,
    { method: 'DELETE' }
  );
  return parseJsonResponse(res, 'Failed to remove channel');
}

export async function listChannelVideos(youtubeChannelId, status = 'all') {
  const qp = new URLSearchParams({ status, skip: '0', take: '200' });
  const res = await fetch(`/api/channels/${encodeURIComponent(youtubeChannelId)}/videos?${qp}`);
  const data = await parseJsonResponse(res, 'Failed to load channel videos');
  return data.items || [];
}

export async function downloadTranscript(videoId) {
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/download-transcript`, {
    method: 'POST'
  });
  return parseJsonResponse(res, 'Failed to download transcript');
}

export async function searchLibrary(query, channelId = '') {
  const qp = new URLSearchParams({ q: query, skip: '0', take: '200' });
  if (channelId) qp.set('channelId', channelId);
  const res = await fetch(`/api/search?${qp}`);
  const data = await parseJsonResponse(res, 'Failed to search library');
  return data.items || [];
}

/** Loads transcript text (prefers DB when already downloaded). */
export async function fetchTranscriptText(videoId) {
  const res = await fetch(`/transcript/${encodeURIComponent(videoId)}`);
  const data = await parseJsonResponse(res, 'Failed to load transcript');
  return {
    transcript: typeof data.transcript === 'string' ? data.transcript : '',
    source: data.source || ''
  };
}

/**
 * Summarizes transcript via OpenRouter (server holds API key and prompts).
 * Pass youtubeVideoId so the server can persist summary + model on the Video row.
 */
export async function summarizeTranscript(transcript, mode, youtubeVideoId = '') {
  const res = await fetch('/api/summarize-transcript', {
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
