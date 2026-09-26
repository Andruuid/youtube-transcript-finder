export function isTranscriptAccessError(error) {
  return ['YOUTUBE_BOT_CHECK', 'YOUTUBE_AUTH_REQUIRED', 'YOUTUBE_CAPTIONS_BLOCKED']
    .includes(error?.code);
}
