import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cookieHeaderFromNetscape,
  fetchYouTubeTranscriptText,
  transcriptTextFromCaptionBody
} from './youtubeTranscriptFetch.js';

const VIDEO_ID = 'D8W05rsCTnU';

function response({ status = 200, body = '', ok = status >= 200 && status < 300 } = {}) {
  return {
    ok,
    status,
    text: async () => body
  };
}

test('parses json3 and timed-text caption bodies', () => {
  const json3 = JSON.stringify({
    events: [
      { segs: [{ utf8: 'Hello' }, { utf8: ' there' }] },
      { segs: [{ utf8: '\n' }] },
      { segs: [{ utf8: 'Next line' }] }
    ]
  });
  assert.equal(transcriptTextFromCaptionBody(json3), 'Hello there Next line');
  assert.equal(
    transcriptTextFromCaptionBody(
      '<text start="0" dur="1">Tom &amp; Jerry</text><text start="2" dur="1">again</text>'
    ),
    'Tom & Jerry again'
  );
});

test('builds a Cookie header from youtube.com netscape rows only', () => {
  const header = cookieHeaderFromNetscape(`
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	0	VISITOR_INFO1_LIVE	visitor-value
.google.com	TRUE	/	TRUE	0	SID	should-not-leak
.youtube.com	TRUE	/	TRUE	0	LOGIN_INFO	login-value
`);
  assert.equal(header, 'VISITOR_INFO1_LIVE=visitor-value; LOGIN_INFO=login-value');
});

test('downloads caption text from the player track list', async () => {
  const calls = [];
  const watchHtml = `
    ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=${VIDEO_ID}","languageCode":"en","kind":"asr"}]}}};
  `;
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), cookie: init.headers.Cookie || '' });
    if (String(url).includes('/watch?')) return response({ body: watchHtml });
    return response({
      body: JSON.stringify({ events: [{ segs: [{ utf8: 'Saved transcript' }] }] })
    });
  };

  const text = await fetchYouTubeTranscriptText(VIDEO_ID, {
    fetchImpl,
    cookieHeader: 'LOGIN_INFO=abc'
  });

  assert.equal(text, 'Saved transcript');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].cookie, 'LOGIN_INFO=abc');
  assert.match(calls[1].url, /fmt=json3/);
});

test('reports the YouTube bot check instead of claiming captions are disabled', async () => {
  const watchHtml = `
    "INNERTUBE_API_KEY":"test-key"
    "INNERTUBE_CLIENT_VERSION":"2.20260925.01.00"
    "VISITOR_DATA":"visitor"
    ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Sign in to confirm you’re not a bot"}};
  `;
  const fetchImpl = async (url) => {
    if (String(url).includes('/watch?')) return response({ body: watchHtml });
    return response({
      body: JSON.stringify({
        playabilityStatus: {
          status: 'LOGIN_REQUIRED',
          reason: 'Sign in to confirm you’re not a bot'
        }
      })
    });
  };

  await assert.rejects(
    () => fetchYouTubeTranscriptText(VIDEO_ID, { fetchImpl, cookieHeader: '' }),
    (error) => {
      assert.equal(error.code, 'YOUTUBE_BOT_CHECK');
      assert.match(error.message, /server\/youtube\.cookies\.txt/);
      assert.doesNotMatch(error.message, /disabled/i);
      return true;
    }
  );
});
