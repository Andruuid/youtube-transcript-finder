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

export async function listIdeas() {
  const res = await fetch('/api/ideas');
  const data = await parseJsonResponse(res, 'Failed to load ideas');
  return data.items || [];
}

export async function getIdeaByVideoId(youtubeVideoId) {
  const res = await fetch(
    `/api/ideas/by-video/${encodeURIComponent(youtubeVideoId)}`
  );
  const data = await parseJsonResponse(res, 'Failed to load idea');
  return data.idea || null;
}

export async function saveIdea(payload) {
  const res = await fetch('/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonResponse(res, 'Failed to save idea');
  return data.idea;
}

export async function deleteIdea(id) {
  const res = await fetch(`/api/ideas/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return parseJsonResponse(res, 'Failed to delete idea');
}
