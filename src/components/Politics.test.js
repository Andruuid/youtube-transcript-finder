import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Politics from './Politics';
import {
  addPoliticsChannel,
  EMPTY_POLITICS_BOARD,
  listPoliticsVideos,
  loadPoliticsBoard
} from '../services/politicsService';
import { syncCatalogThenFetchMissingTranscripts } from '../services/channelBulkPipeline';

jest.mock('../services/politicsService', () => {
  const actual = jest.requireActual('../services/politicsService');
  return {
    ...actual,
    addPoliticsChannel: jest.fn(),
    listPoliticsVideos: jest.fn().mockResolvedValue({ total: 0, items: [] }),
    loadPoliticsBoard: jest.fn(),
    movePoliticsChannel: jest.fn(),
    removePoliticsChannel: jest.fn()
  };
});

jest.mock('../services/channelBulkPipeline', () => ({
  syncCatalogThenFetchMissingTranscripts: jest.fn()
}));

jest.mock('../services/libraryService', () => ({
  downloadTranscript: jest.fn()
}));

beforeEach(() => {
  jest.clearAllMocks();
  loadPoliticsBoard.mockResolvedValue(EMPTY_POLITICS_BOARD);
  listPoliticsVideos.mockResolvedValue({ total: 0, items: [] });
});

test('renders two empty user-curated sides and disabled collection', async () => {
  render(<Politics />);

  expect(await screen.findByRole('heading', { name: 'Left' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Right' })).toBeInTheDocument();
  expect(screen.getAllByText('No channels assigned yet.')).toHaveLength(2);
  expect(
    screen.getByRole('button', { name: 'Sync & collect' })
  ).toBeDisabled();
});

test('adds a channel to the explicitly selected side', async () => {
  addPoliticsChannel.mockResolvedValue({
    board: EMPTY_POLITICS_BOARD,
    sync: { channel: { title: 'Example' } }
  });
  render(<Politics />);
  await screen.findByRole('heading', { name: 'Left' });

  const input = screen.getByLabelText('Add Left channel');
  fireEvent.change(input, { target: { value: '@example' } });
  const section = input.closest('section');
  fireEvent.click(within(section).getByRole('button', { name: 'Add' }));

  await waitFor(() =>
    expect(addPoliticsChannel).toHaveBeenCalledWith('@example', 'left')
  );
});

test('passes the minimum video length to transcript collection', async () => {
  const board = {
    ...EMPTY_POLITICS_BOARD,
    left: [
      {
        youtubeChannelId: 'UC123',
        title: 'Example',
        downloadedCount: 0,
        totalCount: 0
      }
    ],
    totals: {
      ...EMPTY_POLITICS_BOARD.totals,
      channels: 1,
      left: {
        ...EMPTY_POLITICS_BOARD.totals.left,
        channels: 1
      }
    }
  };
  loadPoliticsBoard.mockResolvedValue(board);
  syncCatalogThenFetchMissingTranscripts.mockResolvedValue({
    transcriptsDownloaded: 0,
    transcriptsSkipped: 0,
    transcriptFailures: []
  });

  render(<Politics />);
  expect(await screen.findAllByText('Example')).not.toHaveLength(0);

  fireEvent.change(screen.getByLabelText('Minimum length (minutes)'), {
    target: { value: '6' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sync & collect' }));

  await waitFor(() =>
    expect(syncCatalogThenFetchMissingTranscripts).toHaveBeenCalledWith(
      expect.objectContaining({
        youtubeChannelId: 'UC123',
        minDurationSeconds: 360
      })
    )
  );
});
