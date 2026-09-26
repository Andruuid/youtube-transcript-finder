import { downloadTranscript } from './libraryService';
import { apiFetch } from './apiClient';

jest.mock('./apiClient', () => ({ apiFetch: jest.fn() }));

test('preserves transcript access error codes for bulk callers', async () => {
  apiFetch.mockResolvedValue({ ok: false, text: async () => JSON.stringify({
    error: 'Sign in again', code: 'YOUTUBE_BOT_CHECK'
  }) });
  await expect(downloadTranscript('E6psHNmShtg')).rejects.toMatchObject({
    message: 'Sign in again', code: 'YOUTUBE_BOT_CHECK'
  });
});
