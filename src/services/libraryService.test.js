import { downloadTranscript, listAllChannelVideos, listNewestChannelVideos } from './libraryService';
import { apiFetch } from './apiClient';

jest.mock('./apiClient', () => ({ apiFetch: jest.fn() }));

beforeEach(() => jest.resetAllMocks());

test.each(['all', 'newest'])('loads 1,000 %s videos across the API page limit', async (mode) => {
  const videos = Array.from({ length: 1000 }, (_, i) => ({ youtubeVideoId: `video-${i}` }));
  apiFetch.mockImplementation(async (path) => {
    const url = new URL(path, 'http://localhost');
    const skip = Number(url.searchParams.get('skip'));
    const take = Number(url.searchParams.get('take'));
    expect(take).toBeLessThanOrEqual(200);
    return { ok: true, text: async () => JSON.stringify({
      total: videos.length, items: videos.slice(skip, skip + take)
    }) };
  });

  const result = mode === 'all'
    ? await listAllChannelVideos('UC123')
    : await listNewestChannelVideos('UC123', 1000);

  expect(result).toEqual(videos);
  expect(apiFetch).toHaveBeenCalledTimes(5);
});

test('preserves transcript access error codes for bulk callers', async () => {
  apiFetch.mockResolvedValue({ ok: false, text: async () => JSON.stringify({
    error: 'Sign in again', code: 'YOUTUBE_BOT_CHECK'
  }) });
  await expect(downloadTranscript('E6psHNmShtg')).rejects.toMatchObject({
    message: 'Sign in again', code: 'YOUTUBE_BOT_CHECK'
  });
});
