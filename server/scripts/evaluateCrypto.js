// Read-only against the library. Live mode is explicit and incurs OpenRouter use.
// Run from the repository root: node --env-file=server/.env server/scripts/evaluateCrypto.js [--live]
import { mkdir, writeFile } from 'node:fs/promises';
import { prisma } from '../src/db/prismaClient.js';
import { analyzeTranscript, chunks, validateAnalysis } from '../src/services/cryptoAiService.js';
import { MARKET_PROMPT_GUIDANCE } from '../src/services/cryptoPromptGuidance.js';
import { loadRows, selection } from '../src/services/cryptoDataService.js';
import { SERIES, median, calibratePoint, scorecards } from '../src/services/cryptoMath.js';

// Authored challenge cases, not a representative or independently labeled holdout.
const cases = [
  { id: 'technology-only', source: 'Today we explore Bitcoin transaction signing. Bitcoin is the most secure ledger. Its cryptography is beautiful. This is a technical tutorial, with no view about what BTC will be worth.', check: r => r.scores.BTC === null && r.scores.overall === null && !r.calls.length },
  { id: 'price-over-ecosystem', source: 'Solana developers are doing amazing work. The applications are exciting. But my price outlook for SOL is bearish. I expect SOL to drop substantially over the next month despite those great applications.', check: r => r.scores.SOL <= 4 && r.scores.SOL !== null && r.calls.some(c => c.asset === 'SOL' && c.direction === 'bearish' && !c.conditional) },
  { id: 'generic-action', source: 'This Bitcoin investing lesson covers risk management. Learning when to take profits is a skill every trader needs. This is general education, and I am not recommending a trade or describing my position today.', check: r => !r.actions.length },
  { id: 'guest-attribution', source: 'Host: What do you think Bitcoin will do? Guest: I expect Bitcoin to double by December. Host: That is your forecast. I disagree with making that prediction, and have no directional outlook myself.', check: r => r.scores.BTC === null && !r.calls.length },
  { id: 'joke-retraction', source: 'Panic stations, dump every satoshi, Bitcoin is headed straight into the dustbin! Ha, I am doing an impression of panicked traders. That was comedy, not my advice. I have no prediction for the price.', check: r => SERIES.every(s => r.scores[s] === null) && !r.calls.length && !r.actions.length },
  { id: 'ironic-certainty', source: 'Sure, mortgage the house for Bitcoin, what could possibly go wrong? That is sarcasm, please do not interpret it as a recommendation. I do not know whether Bitcoin rises or falls from here.', check: r => SERIES.every(s => r.scores[s] === null) && !r.calls.length && !r.actions.length },
  { id: 'sincere-after-joke', source: 'Bitcoin to a billion dollars tomorrow, ha ha! Obviously I am making fun of those thumbnails. Here is my actual view: I expect Bitcoin to decline over the next month. I am reducing my Bitcoin exposure today.', check: r => r.scores.BTC !== null && r.scores.BTC <= 4 && r.calls.some(c => c.asset === 'BTC' && c.direction === 'bearish') && !r.calls.some(c => c.direction === 'bullish') && r.actions.some(a => a.asset === 'BTC' && a.action === 'reduce_exposure' && !a.conditional) },
  { id: 'sincere-emphasis', source: 'I am not joking about this Bitcoin forecast. I expect Bitcoin to rise over the next month, and I am buying Bitcoin today. I understand that I could be wrong.', check: r => r.scores.BTC >= 7 && r.calls.some(c => c.asset === 'BTC' && c.direction === 'bullish' && !c.conditional) && r.actions.some(a => a.asset === 'BTC' && a.action === 'buy' && !a.conditional) },
];

try {
  const params = await selection({ channelIds: ['UCrYmtJBtLdtm2ov84ulV-yg'], from: '2021-01-01' });
  const all = await loadRows(params), rows = all.filter(r => r.analysis);
  const candles = await prisma.cryptoCandle.findMany();
  const report = { generatedAt: new Date().toISOString(), channel: params.channels[0].title,
    counts: { catalog: all.length, downloaded: all.filter(r => r.video.transcriptText?.trim()).length, analyzed: rows.length, relevant: rows.filter(r => r.result.relevant).length },
    byYear: Object.fromEntries([...new Set(all.map(r => r.video.publishedAt.getUTCFullYear()))].map(year => [year, { catalog: all.filter(r => r.video.publishedAt.getUTCFullYear() === year).length, analyzed: rows.filter(r => r.video.publishedAt.getUTCFullYear() === year).length }])),
    validationFailures: [],
    calibration: Object.fromEntries(SERIES.map(s => [s, { scores: rows.filter(r => Number.isFinite(r.result.scores[s])).length, median: median(rows.map(r => r.result.scores[s]).filter(Number.isFinite)), historicalPoints: rows.filter(r => calibratePoint(r, rows)[s].adjusted !== null).length }])),
    confidenceMedian: median(rows.map(r => r.result.confidence)),
    minimumRequestsByChunkSize: Object.fromEntries([36000, 64000].map(size => [size, rows.reduce((sum, r) => { const n = chunks(r.video.transcriptText, size).length; return sum + n + (n > 1 ? 1 : 0); }, 0)])),
    outcomes30Days: Object.fromEntries(SERIES.map(s => [s, scorecards(rows, candles, 30, s).map(({ warnings, ...c }) => c)])),
    caveat: 'Fixed-window associations, not horizon-matched forecast accuracy. Challenge labels authored during this review; small sample, no estimate of real-world accuracy.',
    challenges: [], fullTranscripts: [], usage: { requests: 0, promptTokens: 0, completionTokens: 0, reportedCost: 0, costReports: 0 }
  };
  for (const r of rows) { try { validateAnalysis(r.result, r.video.transcriptText); } catch (e) { report.validationFailures.push({ id: r.id, error: e.message }); } }
  const out = new URL('../../.local/crypto-evaluation.json', import.meta.url);
  const save = async () => { await mkdir(new URL('.', out), { recursive: true }); await writeFile(out, JSON.stringify(report, null, 2) + '\n'); };
  await save();
  if (process.argv.includes('--live')) {
    const onUsage = u => {
      report.usage.promptTokens += u.prompt_tokens || 0;
      report.usage.completionTokens += u.completion_tokens || 0;
      if (Number.isFinite(u.cost)) { report.usage.reportedCost += u.cost; report.usage.costReports++; }
    };
    const fetchImpl = (...args) => {
      if (report.usage.requests >= 32) throw Object.assign(new Error('Evaluation request cap reached'), { code: 'PROVIDER_AUTH' });
      report.usage.requests++;
      return fetch(...args);
    };
    const run = async (source, candidate) => {
      const start = performance.now(), before = report.usage.requests;
      try {
        const result = await analyzeTranscript(source, { fetchImpl, onUsage, signal: AbortSignal.timeout(300000),
          promptExtension: candidate ? MARKET_PROMPT_GUIDANCE : '', chunkSize: candidate ? 64000 : 36000 });
        return { result, requests: report.usage.requests - before, ms: Math.round(performance.now() - start) };
      } catch (error) { return { error: error.message, requests: report.usage.requests - before, ms: Math.round(performance.now() - start) }; }
    };
    for (const c of cases) {
      const variants = {};
      for (const [name, candidate] of [['crypto-v3', false], ['crypto-v4', true]]) {
        const result = await run(c.source, candidate);
        variants[name] = { ...result, passed: !!result.result && c.check(result.result) };
        console.log(`${c.id} ${name}: ${variants[name].passed ? 'PASS' : 'FAIL'} (${result.requests} requests)`);
      }
      report.challenges.push({ id: c.id, source: c.source, variants }); await save();
    }
    // Real full transcripts: technical tutorial, panel, conflicting SOL opinion,
    // and a stream containing a parody clip. Read-only; never replaces saved work.
    for (const id of [92, 103, 21, 31]) {
      const row = await prisma.cryptoAnalysis.findUnique({ where: { id }, include: { video: { select: { title: true, transcriptText: true } } } });
      if (!row) continue;
      const result = await run(row.video.transcriptText, true);
      report.fullTranscripts.push({ id, title: row.video.title, characters: row.video.transcriptText.length, saved: JSON.parse(row.resultJson), candidate: result });
      console.log(`Full transcript ${id}: ${result.error || 'complete'} (${result.requests} requests)`); await save();
    }
  }
  console.log(JSON.stringify({ output: out.pathname, counts: report.counts, calibration: report.calibration, minimumRequestsByChunkSize: report.minimumRequestsByChunkSize, usage: report.usage }, null, 2));
} finally { await prisma.$disconnect(); }
