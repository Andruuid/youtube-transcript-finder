import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SmartBulkTranscriptPanel from './SmartBulkTranscriptPanel';
import { syncCatalogThenFetchMissingTranscripts } from '../services/channelBulkPipeline';

jest.mock('../services/channelBulkPipeline', () => ({
  syncCatalogThenFetchMissingTranscripts: jest.fn()
}));

test('Stop cancels the active request, refreshes saved work and allows restarting', async () => {
  const onFinished = jest.fn();
  const onBusyChange = jest.fn();
  syncCatalogThenFetchMissingTranscripts.mockImplementationOnce(({ signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }))
      );
    })
  ).mockResolvedValueOnce({ transcriptsDownloaded: 1, transcriptFailures: [] });

  render(<SmartBulkTranscriptPanel youtubeChannelId="UC123"
    onFinished={onFinished} onBusyChange={onBusyChange} />);
  expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Sync pages & fill transcripts' }));
  expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  const firstSignal = syncCatalogThenFetchMissingTranscripts.mock.calls[0][0].signal;
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

  expect(firstSignal.aborted).toBe(true);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Stopped. Saved transcripts are kept.'));
  expect(onFinished).toHaveBeenCalledTimes(1);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Sync pages & fill transcripts' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Done: 1 transcript(s) downloaded'));
  expect(syncCatalogThenFetchMissingTranscripts.mock.calls[1][0].signal.aborted).toBe(false);
});
