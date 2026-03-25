// YouTube API key from your provided key
const YOUTUBE_API_KEY = 'AIzaSyCQ3uQb0J9RH7aCrfMdy4ZKCinXuZQqvbk';

// Set to false to use real data from the YouTube API
const USE_MOCK_DATA = false;

/**
 * Search for YouTube videos containing the search term in the title
 * @param {string} searchTerm - The term to search for in video titles
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of video search results
 */
export const searchVideos = async (searchTerm, maxResults = 50) => {
  try {
    if (USE_MOCK_DATA) {
      console.log('Using mock data for search');
      // Return mock search results
      return {
        items: [
          {
            id: { videoId: 'mock-video-1' },
            snippet: {
              title: `${searchTerm} - Tutorial Video`,
              description: 'This is a mock video description',
              channelId: 'mock-channel-1',
              channelTitle: 'Tech Channel',
              thumbnails: {
                medium: { url: 'https://via.placeholder.com/320x180.png?text=Video+Thumbnail' }
              }
            }
          },
          {
            id: { videoId: 'mock-video-2' },
            snippet: {
              title: `Learn about ${searchTerm}`,
              description: 'Another mock video description',
              channelId: 'mock-channel-2',
              channelTitle: 'Learning Channel',
              thumbnails: {
                medium: { url: 'https://via.placeholder.com/320x180.png?text=Video+Thumbnail+2' }
              }
            }
          },
          {
            id: { videoId: 'mock-video-3' },
            snippet: {
              title: `${searchTerm} Explained`,
              description: 'Third mock video description',
              channelId: 'mock-channel-3',
              channelTitle: 'Explainer Channel',
              thumbnails: {
                medium: { url: 'https://via.placeholder.com/320x180.png?text=Video+Thumbnail+3' }
              }
            }
          }
        ]
      };
    }
    
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        searchTerm
      )}&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text();
      throw new Error(`Failed to fetch videos: ${errorBody}`);
    }
    
    return await searchResponse.json();
  } catch (error) {
    console.error('Error searching videos:', error);
    if (USE_MOCK_DATA) {
      // If we're using mock data but still got an error, return empty results
      return { items: [] };
    }
    throw error;
  }
};

/**
 * Get detailed information about a list of videos
 * @param {string} videoIds - Comma-separated list of video IDs
 * @returns {Promise<Array>} - Array of video details
 */
export const getVideoDetails = async (videoIds) => {
  try {
    if (USE_MOCK_DATA) {
      console.log('Using mock data for video details');
      // Parse the videoIds string to get an array of IDs
      const idArray = videoIds.split(',');
      
      // Create mock video details for each ID
      const mockItems = idArray.map((id, index) => ({
        id,
        snippet: {
          title: `Mock Video ${index + 1}`,
          description: `This is a mock description for video ${id}`,
          channelId: `mock-channel-${index + 1}`,
          channelTitle: `Channel ${index + 1}`,
          thumbnails: {
            medium: { url: `https://via.placeholder.com/320x180.png?text=Video+${index + 1}` }
          }
        },
        contentDetails: {
          duration: 'PT10M30S',
          caption: 'true' // All mock videos have captions
        },
        statistics: {
          viewCount: String(Math.floor(Math.random() * 1000000)),
          likeCount: String(Math.floor(Math.random() * 50000)),
          commentCount: String(Math.floor(Math.random() * 5000))
        }
      }));
      
      return { items: mockItems };
    }
    
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!videosResponse.ok) {
      throw new Error('Failed to fetch video details');
    }
    
    return await videosResponse.json();
  } catch (error) {
    console.error('Error getting video details:', error);
    if (USE_MOCK_DATA) {
      return { items: [] };
    }
    throw error;
  }
};

/**
 * Get channel information including subscriber count
 * @param {string} channelId - The channel ID
 * @returns {Promise<Object>} - Channel details
 */
export const getChannelInfo = async (channelId) => {
  try {
    if (USE_MOCK_DATA) {
      console.log('Using mock data for channel info');
      // Generate a random subscriber count between 100k and 10M
      const subscriberCount = Math.floor(Math.random() * 9900000) + 100000;
      
      return {
        items: [
          {
            id: channelId,
            statistics: {
              subscriberCount: String(subscriberCount),
              viewCount: String(subscriberCount * 50),
              videoCount: String(Math.floor(Math.random() * 500) + 50)
            }
          }
        ]
      };
    }
    
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel info');
    }
    
    return await channelResponse.json();
  } catch (error) {
    console.error('Error getting channel info:', error);
    if (USE_MOCK_DATA) {
      // Return a default channel with the minimum follower count
      return {
        items: [
          {
            id: channelId,
            statistics: {
              subscriberCount: '150000',
              viewCount: '7500000',
              videoCount: '120'
            }
          }
        ]
      };
    }
    throw error;
  }
};

/**
 * Parse user input into channel id or handle for API lookup.
 * @param {string} rawInput
 * @returns {{ type: 'id', channelId: string } | { type: 'handle', handle: string }}
 */
function parseChannelInput(rawInput) {
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
    const ch = path.match(/\/channel\/(UC[\w-]{22})/);
    if (ch) return { type: 'id', channelId: ch[1] };
    const handleMatch = path.match(/\/@([\w.-]+)/);
    if (handleMatch) return { type: 'handle', handle: handleMatch[1] };
  }
  if (s.startsWith('@')) {
    return { type: 'handle', handle: s.slice(1) };
  }
  if (/^[\w.-]+$/.test(s) && !s.includes('/')) {
    return { type: 'handle', handle: s };
  }
  throw new Error(
    'Could not parse channel. Use channel ID (UC…), @handle, or a link like youtube.com/@handle or youtube.com/channel/UC…'
  );
}

/**
 * Resolve a URL, @handle, or channel ID to canonical channel id and title.
 * @param {string} rawInput
 * @returns {Promise<{ id: string, title: string }>}
 */
export const resolveChannel = async (rawInput) => {
  if (USE_MOCK_DATA) {
    return { id: 'mock-channel-uc', title: 'Mock Channel' };
  }
  const parsed = parseChannelInput(rawInput);
  let url;
  if (parsed.type === 'id') {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(
      parsed.channelId
    )}&key=${YOUTUBE_API_KEY}`;
  } else {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(
      parsed.handle
    )}&key=${YOUTUBE_API_KEY}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Channel lookup failed: ${text}`);
  }
  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Channel not found');
  }
  const item = data.items[0];
  return {
    id: item.id,
    title: item.snippet?.title || rawInput.trim()
  };
};

/**
 * Get the uploads playlist id for a channel.
 * @param {string} channelId
 * @returns {Promise<string>}
 */
export const getChannelUploadsPlaylistId = async (channelId) => {
  if (USE_MOCK_DATA) {
    return 'mock-uploads-playlist';
  }
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(
      channelId
    )}&key=${YOUTUBE_API_KEY}`
  );
  if (!res.ok) {
    throw new Error('Failed to fetch channel uploads playlist');
  }
  const data = await res.json();
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) {
    throw new Error('No uploads playlist for this channel');
  }
  return uploads;
};

/**
 * Start of local calendar day for date input yyyy-mm-dd.
 * @param {string} dateYmd
 * @returns {number} timestamp ms
 */
export function startOfLocalDay(dateYmd) {
  return new Date(`${dateYmd}T00:00:00`).getTime();
}

/**
 * Fetch uploads from a channel's uploads playlist published on or after local start of dateYmd.
 * @param {string} uploadsPlaylistId
 * @param {string} dateYmd - yyyy-mm-dd
 * @returns {Promise<Array<{ videoId: string, videoTitle: string, channelId: string, channelTitle: string, publishedAt: string }>>}
 */
export const fetchUploadsPublishedOnOrAfter = async (uploadsPlaylistId, dateYmd) => {
  if (USE_MOCK_DATA) {
    return [
      {
        videoId: 'mock-v1',
        videoTitle: 'Mock new video',
        channelId: 'mock-channel-uc',
        channelTitle: 'Mock Channel',
        publishedAt: new Date().toISOString()
      }
    ];
  }
  const cutoff = startOfLocalDay(dateYmd);
  const out = [];
  let pageToken = '';

  for (;;) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      key: YOUTUBE_API_KEY
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Playlist items failed: ${text}`);
    }
    const data = await res.json();
    const items = data.items || [];
    let shouldStop = false;
    for (const it of items) {
      const rid = it.snippet?.resourceId;
      const vid = rid?.videoId;
      if (!vid) continue;
      // If kind is omitted, still accept (some clients omit it); only skip known non-video kinds.
      if (rid?.kind && rid.kind !== 'youtube#video') continue;
      // Prefer actual video publish time; snippet.publishedAt is playlist add time and can disagree.
      const publishedAt =
        it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt;
      if (!publishedAt) continue;
      const t = new Date(publishedAt).getTime();
      if (Number.isNaN(t)) continue;
      if (t < cutoff) {
        shouldStop = true;
        break;
      }
      out.push({
        videoId: vid,
        videoTitle: it.snippet.title || '(untitled)',
        channelId: it.snippet.channelId || '',
        channelTitle: it.snippet.channelTitle || '',
        publishedAt
      });
    }
    if (shouldStop || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
};

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Parse YouTube contentDetails.duration (ISO 8601, e.g. PT1H2M3S, PT45S) to seconds.
 * @param {string} iso
 * @returns {number}
 */
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

/**
 * Filter upload rows by minimum duration (uses videos.list batches).
 * @param {Array<{ videoId: string }>} rows
 * @param {number} minSeconds
 * @returns {Promise<Array>}
 */
async function filterUploadsByMinDuration(rows, minSeconds) {
  if (!rows.length || minSeconds <= 0) {
    return rows;
  }
  const ids = [...new Set(rows.map((r) => r.videoId))];
  const durationById = new Map();
  for (const batch of chunkArray(ids, 50)) {
    const data = await getVideoDetails(batch.join(','));
    for (const v of data.items || []) {
      durationById.set(
        v.id,
        iso8601DurationToSeconds(v.contentDetails?.duration)
      );
    }
  }
  return rows.filter((r) => (durationById.get(r.videoId) ?? 0) >= minSeconds);
}

/**
 * Keep only rows whose videos have captions (batch videos.list).
 * @param {Array<{ videoId: string }>} rows
 * @returns {Promise<Array>}
 */
export const filterVideosWithCaptions = async (rows) => {
  if (!rows.length) return [];
  if (USE_MOCK_DATA) {
    return rows;
  }
  const captionIds = new Set();
  const batches = chunkArray(
    rows.map((r) => r.videoId),
    50
  );
  for (const batch of batches) {
    const data = await getVideoDetails(batch.join(','));
    for (const v of data.items || []) {
      if (v.contentDetails?.caption === 'true') {
        captionIds.add(v.id);
      }
    }
  }
  return rows.filter((r) => captionIds.has(r.videoId));
};

/**
 * For each saved channel, collect videos published on or after dateYmd (local).
 * Does not filter by YouTube's caption flag — it is often false for very new uploads or Shorts
 * while transcripts may still be available via the transcript service.
 * @param {Array<{ id: string, input: string }>} savedChannels
 * @param {string} dateYmd
 * @param {number} [minDurationSeconds=0] — drop videos shorter than this (e.g. 61 to skip most Shorts)
 * @returns {Promise<{ videos: Array, errors: Array<{ channelId: string, input: string, message: string }> }>}
 */
export const checkChannelsForNewVideos = async (
  savedChannels,
  dateYmd,
  minDurationSeconds = 0
) => {
  const videos = [];
  const errors = [];
  for (const ch of savedChannels) {
    try {
      const playlistId = await getChannelUploadsPlaylistId(ch.id);
      const uploads = await fetchUploadsPublishedOnOrAfter(playlistId, dateYmd);
      videos.push(...uploads);
    } catch (e) {
      errors.push({
        channelId: ch.id,
        input: ch.input,
        message: e.message || String(e)
      });
    }
  }
  videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const filtered =
    minDurationSeconds > 0
      ? await filterUploadsByMinDuration(videos, minDurationSeconds)
      : videos;
  return { videos: filtered, errors };
};

/**
 * Transcript API URL. In development, use a relative path so Create React App's
 * "proxy" forwards to the backend and avoids browser CORS blocks.
 * For production or a remote API, set REACT_APP_TRANSCRIPT_API_URL (no trailing slash).
 */
function transcriptRequestUrl(videoId) {
  const base = (process.env.REACT_APP_TRANSCRIPT_API_URL || '').replace(/\/$/, '');
  const path = `/transcript/${encodeURIComponent(videoId)}`;
  return base ? `${base}${path}` : path;
}

/**
 * Get transcript for a video via local or configured transcript service.
 * @param {string} videoId - The video ID
 * @returns {Promise<string>} - The transcript text
 */
export const getVideoTranscript = async (videoId) => {
  const url = transcriptRequestUrl(videoId);
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    const hint =
      'Start the transcript server (e.g. port 5001) and restart npm after adding proxy, or set REACT_APP_TRANSCRIPT_API_URL.';
    console.error('Error fetching transcript:', e);
    throw new Error(
      e.name === 'TypeError' && String(e.message).includes('fetch')
        ? `Could not reach transcript service. ${hint}`
        : e.message || 'Network error'
    );
  }

  const raw = await response.text();

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = raw ? JSON.parse(raw) : {};
      detail =
        (typeof errBody.error === 'string' && errBody.error) ||
        errBody.error?.message ||
        errBody.message ||
        '';
    } catch {
      const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped) detail = stripped.slice(0, 500);
    }
    throw new Error(
      detail
        ? `Transcript service error (HTTP ${response.status}): ${detail}`
        : `Transcript service error (HTTP ${response.status})`
    );
  }

  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Transcript service returned invalid JSON');
  }

  if (data.transcript == null || data.transcript === '') {
    throw new Error('Transcript service returned no transcript text');
  }
  return data.transcript;
};
