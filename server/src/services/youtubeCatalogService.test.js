import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  fetchChannelVideos,
  resolveChannel
} from './youtubeCatalogService.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalApiKey;
});

function jsonResponse(body) {
  return {
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
    status: 200
  };
}

test('resolves and returns the channel uploads playlist', async () => {
  process.env.YOUTUBE_API_KEY = 'test-key';
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({
      items: [
        {
          id: 'UC1234567890123456789012',
          snippet: { title: 'Example', thumbnails: {} },
          contentDetails: {
            relatedPlaylists: { uploads: 'UU1234567890123456789012' }
          }
        }
      ]
    });
  };

  const channel = await resolveChannel('UC1234567890123456789012');

  assert.equal(channel.uploadsPlaylistId, 'UU1234567890123456789012');
  assert.match(requestedUrl, /channels\?/);
  assert.match(decodeURIComponent(requestedUrl), /part=snippet,contentDetails/);
});

test('pages playlist items and enriches them with video details', async () => {
  process.env.YOUTUBE_API_KEY = 'test-key';
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes('/playlistItems?')) {
      return jsonResponse({
        items: [{ contentDetails: { videoId: 'abcdefghijk' } }],
        nextPageToken: 'next-token'
      });
    }
    return jsonResponse({
      items: [
        {
          id: 'abcdefghijk',
          snippet: {
            title: 'A video',
            description: 'Description',
            publishedAt: '2026-01-02T00:00:00.000Z',
            thumbnails: { medium: { url: 'https://example.com/thumb.jpg' } }
          },
          contentDetails: { duration: 'PT1M30S' }
        }
      ]
    });
  };

  const result = await fetchChannelVideos('UU123', 50, 'page-token');

  assert.equal(result.nextPageToken, 'next-token');
  assert.equal(result.videos[0].durationSeconds, 90);
  assert.match(requestedUrls[0], /playlistItems\?/);
  assert.match(requestedUrls[0], /playlistId=UU123/);
  assert.match(requestedUrls[0], /pageToken=page-token/);
  assert.match(requestedUrls[1], /videos\?/);
});
