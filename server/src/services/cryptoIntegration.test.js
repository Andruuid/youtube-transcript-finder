import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('durable Crypto pipeline: restart recovery, deduplication, retries, revisions and history', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ytf-crypto-test-'));
  process.env.DATABASE_URL = 'file:' + path.join(dir, 'test.db').replaceAll('\\', '/');
  process.env.OPENROUTER_API_KEY = 'test-only';
  process.env.YOUTUBE_API_KEY = 'test-only';
  const { prisma } = await import('../db/prismaClient.js');
  const originalFetch = globalThis.fetch;
  const { createJob, initializeCryptoWorker, controlJob } = await import('./cryptoJobService.js');
  const { loadRows, selection, dashboard } = await import('./cryptoDataService.js');
  const transcript = 'I think Bitcoin is going higher. I am buying Bitcoin.';
  let modelCalls = 0, invalid = false, catalogCalls = 0, hold = false, unauthorized = false;
  const result = { relevant: true, reason: 'Bitcoin outlook', summary: 'The speaker is bullish on Bitcoin.', scores: { overall: 8, BTC: 8, ETH: null, SOL: null }, confidence: .9,
    evidence: ['overall','BTC'].map(asset => ({ asset, quote: transcript, explanation: 'Direct opinion' })),
    calls: [{asset:'overall', direction:'bullish', horizon:'unspecified', conditional:false, quote:transcript}], actions:[] };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('openrouter.ai')) {
      modelCalls++;
      assert.equal(JSON.parse(options.body).model, 'openai/gpt-6-luna');
      if (hold) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
      if (unauthorized) return new Response(JSON.stringify({error:{message:'Invalid API key'}}),{status:401});
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(invalid ? {...result, confidence: 9} : result)}}]}),{status:200});
    }
    const u = new URL(url);
    if (u.pathname.endsWith('/playlistItems')) {
      catalogCalls++;
      return new Response(JSON.stringify({items:[{contentDetails:{videoId:'oldvideo001'}}]}),{status:200});
    }
    if (u.pathname.endsWith('/videos')) return new Response(JSON.stringify({items:[{id:'oldvideo001',snippet:{title:'Old video',publishedAt:'2020-12-01T00:00:00Z',description:''},contentDetails:{duration:'PT4M'}}]}),{status:200});
    throw Error(`Unexpected test network access: ${u.hostname}`);
  };
  async function finished(id) {
    for(let i=0;i<200;i++) {
      const job=await prisma.cryptoJob.findUnique({where:{id}});
      if(!['queued','running'].includes(job.status)) return job;
      await new Promise(r=>setTimeout(r,25));
    }
    throw Error('Test job did not finish');
  }
  try {
    const migrationDir = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url));
    const entries = (await readdir(migrationDir, {withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort();
    for(const entry of entries) {
      const sql=await readFile(path.join(migrationDir,entry,'migration.sql'),'utf8');
      for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
    }
    const channel=await prisma.channel.create({data:{title:'Test creator',youtubeChannelId:'UC'+'x'.repeat(22),uploadsPlaylistId:'UUtest'}});
    const video=await prisma.video.create({data:{channelId:channel.id,youtubeVideoId:'testvideo01',title:'A prediction',description:'',publishedAt:new Date('2023-01-01'),durationSeconds:180,hasTranscript:true,transcriptText:transcript}});
    const params={channelIds:[channel.youtubeChannelId],from:'2021-01-01',to:'2023-12-31',kind:'analysis'};
    await t.test('duplicate creation returns the same active job',async()=>{
      const [a,b]=await Promise.all([createJob(params),createJob(params)]);
      assert.equal(a.id,b.id);
    });
    const interrupted=await prisma.cryptoJob.create({data:{kind:'analysis',status:'running',paramsJson:JSON.stringify(params)}});
    await prisma.cryptoJobItem.create({data:{jobId:interrupted.id,youtubeVideoId:video.youtubeVideoId,status:'running'}});
    await initializeCryptoWorker();
    await t.test('restart marks interrupted work resumable and completes queued analysis',async()=>{
      assert.equal((await prisma.cryptoJob.findUnique({where:{id:interrupted.id}})).status,'paused');
      assert.equal((await prisma.cryptoJobItem.findFirst({where:{jobId:interrupted.id}})).status,'pending');
      const first=await prisma.cryptoJob.findFirst({where:{id:{not:interrupted.id}}});
      assert.equal((await finished(first.id)).status,'complete');
      assert.equal(modelCalls,1);
      const repeat=await createJob(params);await finished(repeat.id);assert.equal(modelCalls,1);
    });
    await t.test('transcript changes invalidate success; malformed output fails and retries resume',async()=>{
      await prisma.video.update({where:{id:video.id},data:{transcriptText:transcript+' Updated transcript.'}});
      const rows=await loadRows(await selection(params)); assert.equal(rows[0].analysis,null);
      invalid=true;const failed=await createJob(params);assert.equal((await finished(failed.id)).status,'partial');
      invalid=false;await controlJob(failed.id,'retry');assert.equal((await finished(failed.id)).status,'complete');
      assert.equal(await prisma.cryptoAnalysis.count(),2);
      const d=await dashboard(params);assert.equal(d.coverage[0].analyzed,1);assert.equal(d.points.length,1);
    });
    await t.test('calibration versions are persisted without changing raw scores',async()=>{
      const job=await createJob({...params,kind:'calibration'});await finished(job.id);
      const d=await dashboard(params);assert.equal(d.profiles[0].version,1);assert.equal(d.points[0].scores.overall,8);assert.equal(d.points[0].calibration.overall.adjusted,null);
    });
    await t.test('history checkpoints persist and a finished import is idempotent on resume',async()=>{
      const job=await createJob({...params,kind:'history'});assert.equal((await finished(job.id)).status,'complete');
      assert.equal(catalogCalls,1);
      const saved=await prisma.cryptoJob.findUnique({where:{id:job.id}});assert.equal(JSON.parse(saved.checkpointJson)[channel.youtubeChannelId].done,true);
      await controlJob(job.id,'resume');await finished(job.id);assert.equal(catalogCalls,1);
    });
    await t.test('stop aborts the current model request and resume keeps its saved work item',async()=>{
      await prisma.video.update({where:{id:video.id},data:{transcriptText:transcript+' A new edition.'}});
      hold=true;const callsBefore=modelCalls;const job=await createJob(params);
      for(let i=0;i<100&&modelCalls===callsBefore;i++)await new Promise(r=>setTimeout(r,10));
      assert.ok(modelCalls>callsBefore);
      await controlJob(job.id,'stop');hold=false;
      for(let i=0;i<100;i++){
        try{await controlJob(job.id,'resume');break;}catch(e){if(e.status!==409)throw e;await new Promise(r=>setTimeout(r,10));}
      }
      assert.equal((await finished(job.id)).status,'complete');
      assert.equal(await prisma.cryptoJobItem.count({where:{jobId:job.id}}),1);
    });
    await t.test('provider authentication failures pause, then recover without losing the item',async()=>{
      await prisma.video.update({where:{id:video.id},data:{transcriptText:transcript+' Another edition.'}});
      unauthorized=true;const job=await createJob(params);
      assert.equal((await finished(job.id)).status,'paused');
      assert.equal((await prisma.cryptoJobItem.findFirst({where:{jobId:job.id}})).status,'pending');
      unauthorized=false;await controlJob(job.id,'resume');assert.equal((await finished(job.id)).status,'complete');
    });
  } finally {
    globalThis.fetch=originalFetch;
    await prisma.$disconnect();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('ytf-crypto-test-')) throw Error('Unexpected test cleanup path');
    await rm(dir,{recursive:true,force:true});
  }
});
