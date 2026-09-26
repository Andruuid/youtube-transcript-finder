import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const BLOCKED_MESSAGE =
  'YouTube is blocking transcript downloads from this computer ("Sign in to confirm you\'re not a bot"). Anonymous downloads used to work; YouTube now withholds captions until the request looks signed in. Export a Netscape cookies.txt from a browser where you are signed in to YouTube, save it as server/youtube.cookies.txt (or set YOUTUBE_COOKIE to that Cookie header), restart the transcript server, and try again.';

export function defaultYouTubeCookiesPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../youtube.cookies.txt'
  );
}

export function cookieHeaderFromNetscape(text) {
  const pairs = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const domain = parts[0].replace(/^\./, '').toLowerCase();
    if (domain !== 'youtube.com' && !domain.endsWith('.youtube.com')) continue;
    const name = parts[5].trim();
    const value = parts.slice(6).join('\t').trim();
    if (!name || !value) continue;
    pairs.push(`${name}=${value}`);
  }
  return pairs.join('; ');
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
  const error = new Error(BLOCKED_MESSAGE);
  error.code = 'YOUTUBE_BOT_CHECK';
  return error;
}

async function youtubeFetch(fetchImpl, url, { method = 'GET', headers = {}, body, cookieHeader } = {}) {
  const requestHeaders = {
    'User-Agent': BROWSER_UA,
    'Accept-Language': 'en-US,en;q=0.9',
    ...headers
  };
  if (cookieHeader) requestHeaders.Cookie = cookieHeader;
  return fetchImpl(url, { method, headers: requestHeaders, body });
}

async function readResponseText(response) {
  if (typeof response.text === 'function') return response.text();
  return '';
}

/**
 * Download the spoken transcript for a public YouTube video.
 * Uses an optional signed-in Cookie header when YouTube's bot check hides captions.
 */
export async function fetchYouTubeTranscriptText(videoId, options = {}) {
  assertVideoId(videoId);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cookieHeader =
    options.cookieHeader !== undefined
      ? options.cookieHeader
      : readConfiguredYouTubeCookie();

  const watchResponse = await youtubeFetch(
    fetchImpl,
    `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    { cookieHeader }
  );
  const watchHtml = await readResponseText(watchResponse);
  if (watchResponse.status === 429 || /class="g-recaptcha"/i.test(watchHtml)) {
    throw blockedError();
  }
  if (!watchResponse.ok) {
    throw new Error(`YouTube watch page failed (${watchResponse.status || 'error'})`);
  }

  const playerFromPage = extractJsonAfter(watchHtml, 'ytInitialPlayerResponse = ');
  let tracks = captionTracksFromPlayer(playerFromPage);
  let player = playerFromPage;

  if (!tracks.length) {
    const apiKey = watchHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    const clientVersion =
      watchHtml.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] || '2.20260925.01.00';
    const visitorData = watchHtml.match(/"VISITOR_DATA":"([^"]+)"/)?.[1] || '';
    if (!apiKey) {
      if (isBotWall(playerFromPage, watchHtml)) throw blockedError();
      throw new Error('Could not read YouTube player data for this video.');
    }

    const clients = [
      {
        clientName: 'WEB',
        clientVersion,
        hl: 'en',
        gl: 'US',
        visitorData
      },
      {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        hl: 'en',
        gl: 'US'
      }
    ];

    for (const client of clients) {
      const response = await youtubeFetch(
        fetchImpl,
        `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`,
        {
          method: 'POST',
          cookieHeader,
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://www.youtube.com',
            Referer: `https://www.youtube.com/watch?v=${videoId}`
          },
          body: JSON.stringify({
            context: { client },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true
          })
        }
      );
      const playerText = await readResponseText(response);
      if (!response.ok) continue;
      try {
        player = JSON.parse(playerText);
      } catch {
        continue;
      }
      tracks = captionTracksFromPlayer(player);
      if (tracks.length || player?.playabilityStatus?.status === 'OK') break;
    }
  }

  if (!tracks.length) {
    if (isBotWall(player, watchHtml)) throw blockedError();
    const status = player?.playabilityStatus?.status;
    const reason = player?.playabilityStatus?.reason;
    if (status && status !== 'OK') {
      throw new Error(
        `Transcript unavailable (${status}${reason ? `: ${reason}` : ''})`
      );
    }
    throw new Error('This video has no captions.');
  }

  const track = pickTrack(tracks);
  const captionUrl = new URL(track.baseUrl);
  if (!captionUrl.hostname.endsWith('youtube.com')) {
    throw new Error('Refusing to fetch captions from an unexpected host.');
  }
  captionUrl.searchParams.set('fmt', 'json3');
  const captionResponse = await youtubeFetch(fetchImpl, captionUrl.toString(), {
    cookieHeader,
    headers: {
      Origin: 'https://www.youtube.com',
      Referer: `https://www.youtube.com/watch?v=${videoId}`
    }
  });
  const captionBody = await readResponseText(captionResponse);
  if (captionResponse.status === 429) throw blockedError();
  if (!captionResponse.ok) {
    throw new Error(`Caption download failed (${captionResponse.status || 'error'})`);
  }
  const text = transcriptTextFromCaptionBody(captionBody);
  if (!text) {
    throw new Error(
      cookieHeader
        ? 'YouTube returned an empty caption track for this video even with the signed-in cookies.'
        : 'YouTube returned an empty caption track. Save a signed-in Netscape cookies.txt as server/youtube.cookies.txt and restart the transcript server.'
    );
  }
  return text;
}
