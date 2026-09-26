import {
  downloadMissingTranscriptsSequential,
  ensureCatalogDepth,
  syncCatalogThenFetchMissingTranscripts
} from './channelBulkPipeline';
import {
  downloadTranscript,
  listNewestChannelVideos,
  syncChannel
} from './libraryService';

jest.mock('./libraryService', () => ({
  downloadTranscript: jest.fn(),
  listNewestChannelVideos: jest.fn(),
  syncChannel: jest.fn()
}));

beforeEach(() => {
  jest.resetAllMocks();
});

test.each(['YOUTUBE_BOT_CHECK', 'YOUTUBE_AUTH_REQUIRED', 'YOUTUBE_CAPTIONS_BLOCKED'])(
  'stops the batch on %s and preserves completed work', async (code) => {
    downloadTranscript.mockResolvedValueOnce({ transcript: 'Saved' })
      .mockRejectedValueOnce(Object.assign(new Error('Refresh cookies'), { code }));
    await expect(downloadMissingTranscriptsSequential([
      { youtubeVideoId: 'saved', hasTranscript: false },
      { youtubeVideoId: 'blocked', hasTranscript: false },
      { youtubeVideoId: 'unattempted', hasTranscript: false }
    ])).rejects.toMatchObject({ code, message: expect.stringContaining('saving 1 transcript') });
    expect(downloadTranscript).toHaveBeenCalledTimes(2);
  }
);

test('refreshes enough newest catalog pages even when rows already exist', async () => {
  syncChannel
    .mockResolvedValueOnce({
      syncedVideos: 50,
      totalCount: 400,
      nextPageToken: 'page-2'
    })
    .mockResolvedValueOnce({
      syncedVideos: 50,
      totalCount: 400,
      nextPageToken: 'page-3'
    })
    .mockResolvedValueOnce({
      syncedVideos: 20,
      totalCount: 400,
      nextPageToken: null
    });

  const result = await ensureCatalogDepth('UC123', 'UC123', 120);

  expect(syncChannel).toHaveBeenCalledTimes(3);
  expect(syncChannel.mock.calls.map((call) => call[2])).toEqual([
    '',
    'page-2',
    'page-3'
  ]);
  expect(result.catalogVideosVisited).toBe(120);
});

test('keeps scanning until enough videos meet the minimum duration', async () => {
  syncChannel
    .mockResolvedValueOnce({
      syncedVideos: 50,
      eligibleVideos: 12,
      totalCount: 50,
      nextPageToken: 'page-2'
    })
    .mockResolvedValueOnce({
      syncedVideos: 50,
      eligibleVideos: 8,
      totalCount: 100,
      nextPageToken: 'page-3'
    });

  const result = await ensureCatalogDepth(
    'UC123',
    'UC123',
    20,
    undefined,
    { minDurationSeconds: 240 }
  );

  expect(syncChannel).toHaveBeenCalledTimes(2);
  expect(syncChannel).toHaveBeenLastCalledWith(
    'UC123',
    50,
    'page-2',
    expect.objectContaining({ minDurationSeconds: 240 })
  );
  expect(result).toMatchObject({
    catalogVideosVisited: 100,
    eligibleVideosVisited: 20
  });
});

test('selects newest videos after applying the minimum duration', async () => {
  syncChannel.mockResolvedValue({
    syncedVideos: 20,
    eligibleVideos: 20,
    totalCount: 20,
    nextPageToken: null
  });
  listNewestChannelVideos.mockResolvedValue([
    { youtubeVideoId: 'long-video', hasTranscript: true }
  ]);

  await syncCatalogThenFetchMissingTranscripts({
    channelInput: 'UC123',
    youtubeChannelId: 'UC123',
    targetCount: 20,
    minDurationSeconds: 240
  });

  expect(listNewestChannelVideos).toHaveBeenCalledWith(
    'UC123',
    20,
    'all',
    expect.objectContaining({ minDurationSeconds: 240 })
  );
});

test('skips stored transcripts and continues after unavailable captions', async () => {
  downloadTranscript
    .mockRejectedValueOnce(new Error('captions disabled'))
    .mockResolvedValueOnce({ transcript: 'ok' });

  const result = await downloadMissingTranscriptsSequential([
    { youtubeVideoId: 'stored', title: 'Stored', hasTranscript: true },
    { youtubeVideoId: 'missing-1', title: 'Missing one', hasTranscript: false },
    { youtubeVideoId: 'missing-2', title: 'Missing two', hasTranscript: false }
  ]);

  expect(result).toMatchObject({
    downloaded: 1,
    skipped: 1
  });
  expect(result.failures).toHaveLength(1);
  expect(downloadTranscript).toHaveBeenCalledTimes(2);
});

test('stops before starting work when its abort signal is already cancelled', async () => {
  const controller = new AbortController();
  controller.abort();

  await expect(
    downloadMissingTranscriptsSequential(
      [{ youtubeVideoId: 'missing', hasTranscript: false }],
      undefined,
      { signal: controller.signal }
    )
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(downloadTranscript).not.toHaveBeenCalled();
});

test('cancels an in-flight download without starting the next video', async () => {
  const controller = new AbortController();
  downloadTranscript.mockImplementationOnce((_id, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })));
  }));
  const batch = downloadMissingTranscriptsSequential([
    { youtubeVideoId: 'current', hasTranscript: false },
    { youtubeVideoId: 'next', hasTranscript: false }
  ], undefined, { signal: controller.signal });
  controller.abort();
  await expect(batch).rejects.toMatchObject({ name: 'AbortError' });
  expect(downloadTranscript).toHaveBeenCalledTimes(1);
});
