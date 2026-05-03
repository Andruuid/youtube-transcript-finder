const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getYouTubeApiKey() {
  const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable');
  }
  return apiKey;
}

async function fetchYouTube(path, params) {
  const apiKey = getYouTubeApiKey();
  const qp = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${YOUTUBE_API_BASE}/${path}?${qp.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${path} failed: ${text || res.status}`);
  }
  return res.json();
}

export function parseChannelInput(rawInput) {
  const s = String(rawInput || '').trim();
  if (!s) {
    throw new Error('Enter a channel URL, @handle, or channel ID');
  }
  if (/^UC[\w-]{22}$/.test(s)) {
    return { type: 'id', channelId: s };
  }
  let url;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    url = new URL(withProto);
  } catch {
    url = null;
  }
  if (url && /youtube\.com$/i.test(url.hostname.replace(/^www\./, ''))) {
    const path = url.pathname;
    const byId = path.match(/\/channel\/(UC[\w-]{22})/);
    if (byId) return { type: 'id', channelId: byId[1] };
    const byHandle = path.match(/\/@([\w.-]+)/);
    if (byHandle) return { type: 'handle', handle: byHandle[1] };
  }
  if (s.startsWith('@')) {
    return { type: 'handle', handle: s.slice(1) };
  }
  if (/^[\w.-]+$/.test(s) && !s.includes('/')) {
    return { type: 'handle', handle: s };
  }
  throw new Error(
    'Could not parse channel. Use channel ID (UC...), @handle, or a link like youtube.com/@handle'
  );
}

export async function resolveChannel(rawInput) {
  const parsed = parseChannelInput(rawInput);
  const params =
    parsed.type === 'id'
      ? { part: 'snippet', id: parsed.channelId }
      : { part: 'snippet', forHandle: parsed.handle };
  const data = await fetchYouTube('channels', params);
  const item = data.items?.[0];
  if (!item) {
    throw new Error('Channel not found');
  }
  return {
    youtubeChannelId: item.id,
    title: item.snippet?.title || rawInput.trim(),
    handle: parsed.type === 'handle' ? parsed.handle : null
  };
}

export async function fetchChannelVideos(youtubeChannelId, limit = 50, pageToken = '') {
  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);
  const params = {
    part: 'snippet',
    channelId: youtubeChannelId,
    order: 'date',
    type: 'video',
    maxResults: String(cappedLimit)
  };
  if (pageToken) params.pageToken = pageToken;
  const searchData = await fetchYouTube('search', params);
  const ids = (searchData.items || [])
    .map((it) => it.id?.videoId)
    .filter(Boolean);
  if (!ids.length) {
    return { videos: [], nextPageToken: searchData.nextPageToken || null };
  }

  const videosData = await fetchYouTube('videos', {
    part: 'snippet,contentDetails',
    id: ids.join(',')
  });
  const byId = new Map((videosData.items || []).map((v) => [v.id, v]));
  const videos = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((video) => ({
      youtubeVideoId: video.id,
      title: video.snippet?.title || '(untitled)',
      description: video.snippet?.description || '',
      publishedAt: video.snippet?.publishedAt || new Date().toISOString(),
      thumbnailUrl: video.snippet?.thumbnails?.medium?.url || null
    }));

  return { videos, nextPageToken: searchData.nextPageToken || null };
}
