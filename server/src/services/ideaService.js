import { prisma } from '../db/prismaClient.js';

function validateStars(stars) {
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 3) {
    throw new Error('stars must be 1, 2, or 3');
  }
  return n;
}

function trimRequired(value, fieldName) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function trimOptional(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export async function listIdeas() {
  return prisma.idea.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function getIdeaByVideoId(youtubeVideoId) {
  const id = String(youtubeVideoId || '').trim();
  if (!id) return null;
  return prisma.idea.findUnique({ where: { youtubeVideoId: id } });
}

export async function upsertIdeaFromVideo({
  youtubeVideoId,
  channelTitle,
  videoTitle,
  stars,
  comment
}) {
  const videoId = trimRequired(youtubeVideoId, 'youtubeVideoId');
  const data = {
    channelTitle: trimOptional(channelTitle) || '',
    videoTitle: trimRequired(videoTitle, 'videoTitle'),
    stars: validateStars(stars),
    comment: trimOptional(comment)
  };

  return prisma.idea.upsert({
    where: { youtubeVideoId: videoId },
    create: { ...data, youtubeVideoId: videoId },
    update: data
  });
}

export async function createManualIdea({
  channelTitle,
  videoTitle,
  stars,
  comment
}) {
  return prisma.idea.create({
    data: {
      channelTitle: trimOptional(channelTitle) || '',
      videoTitle: trimRequired(videoTitle, 'videoTitle'),
      stars: validateStars(stars),
      comment: trimOptional(comment),
      youtubeVideoId: null
    }
  });
}

export async function saveIdea(body) {
  const youtubeVideoId = String(body?.youtubeVideoId || '').trim();
  if (youtubeVideoId) {
    return upsertIdeaFromVideo({
      youtubeVideoId,
      channelTitle: body.channelTitle,
      videoTitle: body.videoTitle,
      stars: body.stars,
      comment: body.comment
    });
  }
  return createManualIdea({
    channelTitle: body.channelTitle,
    videoTitle: body.videoTitle,
    stars: body.stars,
    comment: body.comment
  });
}

export async function deleteIdea(id) {
  const ideaId = Number(id);
  if (!Number.isInteger(ideaId) || ideaId < 1) {
    throw new Error('Invalid idea id');
  }
  return prisma.idea.delete({ where: { id: ideaId } });
}
