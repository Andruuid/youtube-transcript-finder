import { Router } from 'express';
import { prisma } from '../db/prismaClient.js';
import { dashboard, selection, getCoverage, listAnalyses, setOverrides } from '../services/cryptoDataService.js';
import { createJob, controlJob, listJobs } from '../services/cryptoJobService.js';
import { cryptoError } from '../services/cryptoMath.js';

export const cryptoRouter = Router();
const route = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (error) { res.status(error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: error.message || 'Crypto request failed.', code: error.code || 'CRYPTO_ERROR' }); }
};
cryptoRouter.get('/coverage', route(async req => getCoverage(await selection(req.query))));
cryptoRouter.get('/dashboard', route(req => dashboard(req.query)));
cryptoRouter.get('/analyses', route(req => listAnalyses(req.query)));
cryptoRouter.get('/analyses/:id', route(async req => {
  const row = await prisma.cryptoAnalysis.findUnique({ where: { id: Number(req.params.id) || 0 }, include: { video: { select: { title: true, youtubeVideoId: true, transcriptText: true, publishedAt: true } }, channel: { select: { title: true } } } });
  if (!row) throw cryptoError('Analysis not found.', 404);
  return { ...row, result: JSON.parse(row.resultJson), resultJson: undefined };
}));
cryptoRouter.get('/jobs', route(async req => listJobs((await selection(req.query)).channelIds)));
cryptoRouter.post('/jobs', route(req => createJob(req.body)));
cryptoRouter.post('/jobs/:id/:action', route(req => controlJob(req.params.id, req.params.action)));
cryptoRouter.patch('/calibration/:channelId', route(req => setOverrides(Number(req.params.channelId) || 0, req.body.overrides)));
