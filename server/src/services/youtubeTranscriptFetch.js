import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const BLOCKED_MESSAGE =
  'YouTube is asking you to sign in or has temporarily blocked downloads. Export cookies for youtube.com only from a signed-in browser and replace server/youtube.cookies.txt, then retry. The file is read on each download; no restart is needed. If fresh cookies do not help, wait before retrying.';

export function defaultYouTubeCookiesPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../youtube.cookies.txt'
  );
}

export function cookieHeaderFromNetscape(text) {
  const pairs = new Map();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/^#HttpOnly_/, '');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const domain = parts[0].replace(/^\./, '').toLowerCase();
    if (domain !== 'youtube.com' && domain !== 'www.youtube.com') continue;
    const expires = Number(parts[4]);
    if (expires > 0 && expires <= Date.now() / 1000) continue;
    if (parts[2] !== '/') continue;
    const name = parts[5].trim();
    const value = parts.slice(6).join('\t').trim();
    if (!name || !value) continue;
    if (pairs.has(name) && pairs.get(name) !== value) {
      throw transcriptError('YOUTUBE_AUTH_REQUIRED',
        'The cookie file contains conflicting YouTube sessions. Export cookies for youtube.com only from one signed-in browser tab and replace server/youtube.cookies.txt.');
    }
    pairs.set(name, value);
  }
  return [...pairs].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function readConfiguredYouTubeCookie({
  env = process.env,
  filePath = defaultYouTubeCookiesPath(),
  readFileSync = fs.readFileSync,
  existsSync = fs.existsSync
} = {}) {
  const direct = String(env.YOUTUBE_COOKIE || env.YOUTUBE_COOKIES || '').trim();
  if (direct) return direct;
  if (!filePath || !existsSync(filePath)) return '';
  return cookieHeaderFromNetscape(readFileSync(filePath, 'utf8'));
}

function assertVideoId(videoId) {
  if (!VIDEO_ID_RE.test(videoId)) {
    throw new Error('Invalid video id');
  }
}

function extractJsonAfter(html, marker) {
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = jsonStart; i < html.length; i += 1) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function captionTracksFromPlayer(player) {
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) ? tracks : [];
}

function isBotWall(player, html = '') {
  const status = player?.playabilityStatus?.status || '';
  const reason = String(player?.playabilityStatus?.reason || '');
  if (status === 'LOGIN_REQUIRED' && /not a bot/i.test(reason)) return true;
  return /confirm you.?re not a bot/i.test(html);
}

function pickTrack(tracks) {
  const score = (track) => {
    const lang = String(track.languageCode || '').toLowerCase();
    let value = 0;
    if (lang === 'en' || lang.startsWith('en-')) value += 100;
    if (track.kind !== 'asr') value += 20;
    return value;
  };
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

export function transcriptTextFromCaptionBody(body) {
  const raw = String(body || '').trim();
  if (!raw) return '';
  if (raw.startsWith('{')) {
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    if (json) {
      const parts = [];
      for (const event of json.events || []) {
        if (!Array.isArray(event.segs)) continue;
        const text = event.segs
          .map((seg) => seg.utf8 || '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) parts.push(text);
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  const parts = [];
  const srv3 = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  for (const match of raw.matchAll(srv3)) {
    const inner = match[3];
    let text = '';
    for (const piece of inner.matchAll(/<s[^>]*>([^<]*)<\/s>/g)) text += piece[1];
    if (!text) text = inner.replace(/<[^>]+>/g, '');
    text = decodeXml(text).replace(/\s+/g, ' ').trim();
    if (text) parts.push(text);
  }
  if (parts.length) return parts.join(' ');

  const legacy = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  for (const match of raw.matchAll(legacy)) {
    const text = decodeXml(match[3]).replace(/\s+/g, ' ').trim();
    if (text) parts.push(text);
  }
  return parts.join(' ');
}

function blockedError() {
  return transcriptError('YOUTUBE_BOT_CHECK', BLOCKED_MESSAGE);
}

function transcriptError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// Sending cookies alone does not authenticate an InnerTube player request.
export function youtubeAuthHeaders(cookieHeader, now = Date.now()) {
  const cookies = new Map(String(cookieHeader || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const sid = cookies.get('SAPISID') || cookies.get('__Secure-3PAPISID');
  if (!sid) return {};
  const timestamp = Math.floor(now / 1000);
  const hash = createHash('sha1')
    .update(`${timestamp} ${sid} https://www.youtube.com`).digest('hex');
  return {
    Authorization: `SAPISIDHASH ${timestamp}_${hash}`,
    'X-Origin': 'https://www.youtube.com',
    'X-Goog-AuthUser': '0'
  };
}

async function youtubeFetch(fetchImpl, url, { method = 'GET', headers = {}, body, cookieHeader } = {}) {
  const requestHeaders = {
    'User-Agent': BROWSER_UA,
    'Accept-Language': 'en-US,en;q=0.9',
    ...headers
  };
  if (cookieHeader) requestHeaders.Cookie = cookieHeader;
  return fetchImpl(url, {
    method, headers: requestHeaders, body,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000)
  });
}

async function readResponseText(response) {
  if (typeof response.text === 'function') return response.text();
  return '';
}

async function downloadTrack(fetchImpl, videoId, tracks, cookieHeader) {
  const track = pickTrack(tracks);
  const captionUrl = new URL(track.baseUrl);
  if (captionUrl.protocol !== 'https:' ||
      !['www.youtube.com', 'youtube.com'].includes(captionUrl.hostname) ||
      captionUrl.port || captionUrl.username || captionUrl.password) {
    throw new Error('Refusing to fetch captions from an unexpected host.');
  }
  captionUrl.searchParams.set('fmt', 'json3');
  const response = await youtubeFetch(fetchImpl, captionUrl.toString(), {
    cookieHeader,
    headers: {
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/watch?v=' + videoId
    }
  });
  if (response.status === 429) throw blockedError();
  // The watch page can contain an unusable track even for a signed-in session.
  if ([403, 410].includes(response.status)) return '';
  if (!response.ok) throw new Error('Caption download failed (' + response.status + ')');
  return transcriptTextFromCaptionBody(await readResponseText(response));
}

/** Fetch captions, refreshing empty/stale watch-page tracks via the player API. */
export async function fetchYouTubeTranscriptText(videoId, options = {}) {
  assertVideoId(videoId);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cookieHeader = options.cookieHeader !== undefined
    ? options.cookieHeader : readConfiguredYouTubeCookie();
  const watchResponse = await youtubeFetch(
    fetchImpl, 'https://www.youtube.com/watch?v=' + videoId + '&hl=en', { cookieHeader }
  );
  const watchHtml = await readResponseText(watchResponse);
  if (watchResponse.status === 429 || /class="g-recaptcha"/i.test(watchHtml)) {
    throw blockedError();
  }
  const redirectLocation = watchResponse.headers?.get('location') || watchResponse.url || '';
  if (/^https:\/\/accounts\.google\.com\//i.test(redirectLocation)) {
    throw transcriptError('YOUTUBE_AUTH_REQUIRED',
      'YouTube rejected the saved cookies. Export cookies for youtube.com only from one signed-in browser tab and replace server/youtube.cookies.txt, then retry.');
  }
  if (!watchResponse.ok) {
    throw new Error('YouTube watch page failed (' + (watchResponse.status || 'error') + ')');
  }

  let player = extractJsonAfter(watchHtml, 'ytInitialPlayerResponse = ');
  let tracks = captionTracksFromPlayer(player);
  let hadTracks = tracks.length > 0;
  let sawBotWall = isBotWall(player, watchHtml);
  if (tracks.length) {
    const text = await downloadTrack(fetchImpl, videoId, tracks, cookieHeader);
    if (text) return text;
  }

  const apiKey = watchHtml.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/)?.[1];
  const clientVersion = watchHtml.match(/"INNERTUBE_CLIENT_VERSION":\s*"([^"]+)"/)?.[1]
    || '2.20260708.00.00';
  const visitorData = watchHtml.match(/"VISITOR_DATA":\s*"([^"]+)"/)?.[1] || '';
  const clients = [
    { clientName: 'WEB', clientVersion, hl: 'en', gl: 'US', visitorData },
    // Android does not support browser cookie authentication.
    ...(!cookieHeader ? [{ clientName: 'ANDROID', clientVersion: '21.26.364', hl: 'en', gl: 'US' }] : [])
  ];
  for (const client of clients) {
    const response = await youtubeFetch(
      fetchImpl,
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false' +
        (apiKey ? '&key=' + encodeURIComponent(apiKey) : ''),
      {
        method: 'POST', cookieHeader,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://www.youtube.com',
          Referer: 'https://www.youtube.com/watch?v=' + videoId,
          'X-YouTube-Client-Name': client.clientName === 'WEB' ? '1' : '3',
          'X-YouTube-Client-Version': client.clientVersion,
          ...youtubeAuthHeaders(cookieHeader)
        },
        body: JSON.stringify({ context: { client }, videoId, contentCheckOk: true, racyCheckOk: true })
      }
    );
    if (response.status === 429) throw blockedError();
    if (response.status === 401) {
      throw transcriptError('YOUTUBE_AUTH_REQUIRED',
        'YouTube rejected the saved session. Replace server/youtube.cookies.txt with a fresh youtube.com cookie export and retry.');
    }
    if (!response.ok) {
      throw new Error('YouTube player request failed (' + response.status + ')');
    }
    try { player = JSON.parse(await readResponseText(response)); }
    catch { throw new Error('YouTube returned invalid player data. Please retry.'); }
    sawBotWall ||= isBotWall(player);
    tracks = captionTracksFromPlayer(player);
    hadTracks ||= tracks.length > 0;
    if (tracks.length) {
      const text = await downloadTrack(fetchImpl, videoId, tracks, cookieHeader);
      if (text) return text;
    }
  }

  if (sawBotWall) throw blockedError();
  if (hadTracks) {
    throw transcriptError('YOUTUBE_CAPTIONS_BLOCKED',
      'YouTube returned empty captions even after refreshing the player. Replace server/youtube.cookies.txt with a fresh youtube.com cookie export and retry. If this continues, wait before retrying; cookies alone may not resolve the block.');
  }
  const status = player?.playabilityStatus?.status;
  const reason = player?.playabilityStatus?.reason;
  if (!status) throw new Error('Could not read YouTube player data for this video.');
  if (status !== 'OK') {
    throw new Error('Transcript unavailable (' + status + (reason ? ': ' + reason : '') + ')');
  }
  throw new Error('This video has no captions.');
}
