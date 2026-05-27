import { prisma } from '../db/prismaClient.js';

export const EFFORT_LEVELS = ['low', 'medium', 'high'];

function validateStars(stars) {
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error('stars must be 1, 2, 3, 4, or 5');
  }
  return n;
}

function validateEffort(effort) {
  if (effort == null || effort === '') return null;
  const value = String(effort).trim().toLowerCase();
  if (!EFFORT_LEVELS.includes(value)) {
    throw new Error('effort must be low, medium, or high');
  }
  return value;
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

function buildIdeaData({ channelTitle, videoTitle, stars, effort, comment }) {
  return {
    channelTitle: trimOptional(channelTitle) || '',
    videoTitle: trimRequired(videoTitle, 'videoTitle'),
    stars: validateStars(stars),
    effort: validateEffort(effort),
    comment: trimOptional(comment)
  };
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
  effort,
  comment
}) {
  const videoId = trimRequired(youtubeVideoId, 'youtubeVideoId');
  const data = buildIdeaData({ channelTitle, videoTitle, stars, effort, comment });

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
  effort,
  comment
}) {
  return prisma.idea.create({
    data: {
      ...buildIdeaData({ channelTitle, videoTitle, stars, effort, comment }),
      youtubeVideoId: null
    }
  });
}

export async function saveIdea(body) {
  const id = Number(body?.id);
  if (Number.isInteger(id) && id >= 1) {
    const { id: _id, youtubeVideoId: _videoId, ...patch } = body || {};
    return updateIdea(id, patch);
  }

  const youtubeVideoId = String(body?.youtubeVideoId || '').trim();
  if (youtubeVideoId) {
    return upsertIdeaFromVideo({
      youtubeVideoId,
      channelTitle: body.channelTitle,
      videoTitle: body.videoTitle,
      stars: body.stars,
      effort: body.effort,
      comment: body.comment
    });
  }
  return createManualIdea({
    channelTitle: body.channelTitle,
    videoTitle: body.videoTitle,
    stars: body.stars,
    effort: body.effort,
    comment: body.comment
  });
}

export async function updateIdea(id, body) {
  const ideaId = Number(id);
  if (!Number.isInteger(ideaId) || ideaId < 1) {
    throw new Error('Invalid idea id');
  }

  const data = {};
  if (body?.stars !== undefined) data.stars = validateStars(body.stars);
  if (body?.effort !== undefined) data.effort = validateEffort(body.effort);
  if (body?.comment !== undefined) data.comment = trimOptional(body.comment);
  if (body?.videoTitle !== undefined) {
    data.videoTitle = trimRequired(body.videoTitle, 'videoTitle');
  }
  if (body?.channelTitle !== undefined) {
    data.channelTitle = trimOptional(body.channelTitle) || '';
  }

  if (Object.keys(data).length === 0) {
    throw new Error('No fields to update');
  }

  return prisma.idea.update({ where: { id: ideaId }, data });
}

export async function deleteIdea(id) {
  const ideaId = Number(id);
  if (!Number.isInteger(ideaId) || ideaId < 1) {
    throw new Error('Invalid idea id');
  }
  return prisma.idea.delete({ where: { id: ideaId } });
}
