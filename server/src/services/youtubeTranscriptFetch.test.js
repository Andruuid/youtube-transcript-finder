import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  cookieHeaderFromNetscape,
  fetchYouTubeTranscriptText,
  transcriptTextFromCaptionBody,
  youtubeAuthHeaders
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

test('imports HttpOnly cookies, omits expired/unrelated cookies and rejects conflicting sessions', () => {
  assert.equal(cookieHeaderFromNetscape([
    '#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tsession',
    '.youtube.com\tTRUE\t/\tTRUE\t1\tOLD\texpired',
    'music.youtube.com\tFALSE\t/\tTRUE\t0\tOTHER\tmusic',
    '.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tsession'
  ].join('\n')), 'SID=session');
  assert.throws(() => cookieHeaderFromNetscape([
    '.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tone',
    '.youtube.com\tTRUE\t/\tTRUE\t0\tSID\ttwo'
  ].join('\n')), { code: 'YOUTUBE_AUTH_REQUIRED' });
});

test('signs player requests with the session cookie and YouTube origin', () => {
  const digest = createHash('sha1').update('123 secret https://www.youtube.com').digest('hex');
  assert.equal(youtubeAuthHeaders('SAPISID=secret', 123000).Authorization,
    `SAPISIDHASH 123_${digest}`);
  assert.deepEqual(youtubeAuthHeaders('LOGIN_INFO=value'), {});
  assert.equal(youtubeAuthHeaders('__Secure-3PAPISID=secret', 123000).Authorization,
    `SAPISIDHASH 123_${digest}`);
});

const playerWithTrack = (suffix) => ({
  playabilityStatus: { status: 'OK' },
  captions: { playerCaptionsTracklistRenderer: { captionTracks: [
    { baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&track=${suffix}`, languageCode: 'en' }
  ] } }
});

for (const status of [200, 403, 410]) {
  test(`refreshes an empty or expired watch-page track (${status}) with an authenticated player request`, async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (url.includes('/watch?')) return response({ body:
        `ytInitialPlayerResponse = ${JSON.stringify(playerWithTrack('stale'))}; "INNERTUBE_CLIENT_VERSION":"current-version"` });
      if (url.includes('track=stale')) return response({ status });
      if (url.includes('/youtubei/')) {
        assert.match(init.headers.Authorization, /^SAPISIDHASH \d+_[a-f0-9]{40}$/);
        assert.equal(init.headers['X-YouTube-Client-Version'], 'current-version');
        assert.equal(init.headers.Cookie, 'SAPISID=secret');
        return response({ body: JSON.stringify(playerWithTrack('fresh')) });
      }
      assert.match(url, /track=fresh/);
      return response({ body: JSON.stringify({ events: [{ segs: [{ utf8: 'Recovered captions' }] }] }) });
    };
    assert.equal(await fetchYouTubeTranscriptText(VIDEO_ID, { fetchImpl, cookieHeader: 'SAPISID=secret' }),
      'Recovered captions');
    assert.equal(calls.length, 4);
    assert.ok(calls.every(({ init }) => init.signal && init.redirect === 'manual'));
  });
}

test('reports invalid cookie redirects without following them', async () => {
  await assert.rejects(() => fetchYouTubeTranscriptText(VIDEO_ID, {
    cookieHeader: 'SID=bad',
    fetchImpl: async () => ({ ...response({ status: 303 }),
      headers: new Headers({ location: 'https://accounts.google.com/CookieMismatch' }) })
  }), { code: 'YOUTUBE_AUTH_REQUIRED' });
});

test('rejects a lookalike caption host before sending session cookies', async () => {
  let calls = 0;
  const player = playerWithTrack('bad');
  player.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl = 'https://evilyoutube.com/api/timedtext';
  await assert.rejects(() => fetchYouTubeTranscriptText(VIDEO_ID, {
    cookieHeader: 'SID=secret',
    fetchImpl: async () => {
      calls++;
      return response({ body: `ytInitialPlayerResponse = ${JSON.stringify(player)};` });
    }
  }), /unexpected host/);
  assert.equal(calls, 1);
});

test('does not misreport player rate limiting as missing captions', async () => {
  let calls = 0;
  await assert.rejects(() => fetchYouTubeTranscriptText(VIDEO_ID, {
    cookieHeader: '', fetchImpl: async () => {
      calls++;
      return calls === 1 ? response({ body: 'ytInitialPlayerResponse = {};' }) : response({ status: 429 });
    }
  }), { code: 'YOUTUBE_BOT_CHECK' });
  assert.equal(calls, 2);
});

test('reports a blocked caption response when both track sources are empty', async () => {
  await assert.rejects(() => fetchYouTubeTranscriptText(VIDEO_ID, {
    cookieHeader: 'SAPISID=secret', fetchImpl: async (url) => {
      if (url.includes('/watch?')) return response({ body: `ytInitialPlayerResponse = ${JSON.stringify(playerWithTrack('page'))};` });
      if (url.includes('/youtubei/')) return response({ body: JSON.stringify(playerWithTrack('api')) });
      return response();
    }
  }), { code: 'YOUTUBE_CAPTIONS_BLOCKED' });
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
