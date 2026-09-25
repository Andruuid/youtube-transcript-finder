const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const PLACEHOLDER_YOUTUBE_API_KEYS = new Set([
  'your_youtube_data_api_key',
  'your-api-key-here',
  'changeme'
]);

function getYouTubeApiKey() {
  const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'Missing YOUTUBE_API_KEY. Set a YouTube Data API v3 key in server/.env and restart the transcript server.'
    );
  }
  if (PLACEHOLDER_YOUTUBE_API_KEYS.has(apiKey.toLowerCase())) {
    throw new Error(
      'YOUTUBE_API_KEY is still the placeholder in server/.env. Replace it with a real YouTube Data API v3 key from Google Cloud Console, then restart npm run dev:full.'
    );
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

/** Parse YouTube contentDetails.duration (ISO 8601, e.g. PT1H2M3S) to seconds. */
export function iso8601DurationToSeconds(iso) {
  if (!iso || typeof iso !== 'string' || !iso.startsWith('PT')) {
    return 0;
  }
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) {
    return 0;
  }
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseFloat(match[3] || '0');
  return Math.round(h * 3600 + m * 60 + s);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Batch YouTube videos.list for contentDetails.duration only. */
export async function fetchVideoDurationsByIds(youtubeVideoIds) {
  const ids = [...new Set((youtubeVideoIds || []).filter(Boolean))];
  const durations = new Map();
  if (!ids.length) return durations;

  for (const batch of chunkArray(ids, 50)) {
    const data = await fetchYouTube('videos', {
      part: 'contentDetails',
      id: batch.join(',')
    });
    for (const video of data.items || []) {
      const sec = iso8601DurationToSeconds(video.contentDetails?.duration);
      if (sec > 0) durations.set(video.id, sec);
    }
  }
  return durations;
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
  const thumbs = item.snippet?.thumbnails;
  return {
    youtubeChannelId: item.id,
    title: item.snippet?.title || rawInput.trim(),
    handle: parsed.type === 'handle' ? parsed.handle : null,
    thumbnailUrl:
      thumbs?.medium?.url || thumbs?.default?.url || thumbs?.high?.url || null
  };
}

export async function fetchChannelVideos(youtubeChannelId, limit = 50, pageToken = '') {
  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);
  const channelData = await fetchYouTube('channels', {
    part: 'contentDetails',
    id: youtubeChannelId
  });
  const uploadsPlaylistId =
    channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error('Could not find the channel uploads playlist');
  }

  const params = {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(cappedLimit)
  };
  if (pageToken) params.pageToken = pageToken;
  const playlistData = await fetchYouTube('playlistItems', params);
  const ids = (playlistData.items || [])
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);
  if (!ids.length) {
    return { videos: [], nextPageToken: playlistData.nextPageToken || null };
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
      thumbnailUrl: video.snippet?.thumbnails?.medium?.url || null,
      durationSeconds: iso8601DurationToSeconds(video.contentDetails?.duration) || null
    }));

  return { videos, nextPageToken: playlistData.nextPageToken || null };
}
