import { YoutubeTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';
import { prisma } from '../db/prismaClient.js';

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function assertVideoId(videoId) {
  if (!VIDEO_ID_RE.test(videoId)) {
    throw new Error('Invalid video id');
  }
}

export async function fetchTranscriptText(videoId) {
  assertVideoId(videoId);
  const chunks = await YoutubeTranscript.fetchTranscript(videoId);
  return chunks.map((chunk) => chunk.text).join(' ');
}

export async function saveTranscriptForVideo(videoId, transcriptText) {
  assertVideoId(videoId);
  const now = new Date();
  return prisma.video.update({
    where: { youtubeVideoId: videoId },
    data: {
      transcriptText,
      hasTranscript: true,
      transcriptFetchedAt: now
    },
    include: {
      channel: true
    }
  });
}

export async function fetchAndPersistTranscript(videoId) {
  const transcriptText = await fetchTranscriptText(videoId);
  const video = await saveTranscriptForVideo(videoId, transcriptText);
  return { transcriptText, video };
}
