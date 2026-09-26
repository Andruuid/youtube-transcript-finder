import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, parseSelection, eligible, calibratePoint, outcome, scorecards, hashText } from './cryptoMath.js';
import { validateAnalysis, chunks } from './cryptoAiService.js';
import { parseCandles } from './cryptoPriceService.js';
import { pageReachesStart, pauseForError } from './cryptoJobService.js';

const channel = 'UCrYmtJBtLdtm2ov84ulV-yg';
const quote = 'I think Bitcoin is going higher, so I am buying.';
const sample = () => ({ relevant: true, reason: 'Crypto outlook', summary: 'An optimistic Bitcoin outlook.', confidence: .8,
  scores: { overall: 8, BTC: 8, ETH: null, SOL: null },
  evidence: ['overall', 'BTC'].map(asset => ({ asset, quote, explanation: 'Endorsed bullish outlook' })),
  calls: [{ asset: 'BTC', direction: 'bullish', conditional: false, horizon: 'next month', quote }],
  actions: [{ asset: 'BTC', action: 'buy', conditional: false, quote }] });

test('selection validates actual dates, saved-channel format, and 1–3 bounds', () => {
  assert.deepEqual(parseSelection({ channelIds: [channel], from: '2021-01-01', to: '2021-02-01' }).channelIds, [channel]);
  for (const input of [{ channelIds: [] }, { channelIds: ['wrong'] }, { channelIds: [channel], from: '2021-02-30' }, { channelIds: [channel], from: '2020-01-01' }, { channelIds: ['UC'+'a'.repeat(22),'UC'+'b'.repeat(22),'UC'+'c'.repeat(22),'UC'+'d'.repeat(22)] }]) assert.throws(() => parseSelection(input));
});
test('duration boundary and transcript revision hashes', () => {
  assert.equal(eligible({ durationSeconds: 179 }), false);
  assert.equal(eligible({ durationSeconds: 180 }), true);
  assert.equal(eligible({ durationSeconds: null }), false);
  assert.notEqual(hashText('first transcript'), hashText('changed transcript'));
});
test('AI results require grounded evidence and never infer unsupported coin scores', () => {
  assert.equal(validateAnalysis(sample(), quote).scores.ETH, null);
  const invented = sample(); invented.evidence[0].quote = 'This did not occur in the source.';
  assert.throws(() => validateAnalysis(invented, quote), /not in the transcript/);
  const unsupported = sample(); unsupported.scores.SOL = 9;
  assert.throws(() => validateAnalysis(unsupported, quote), /SOL score evidence/);
  const irrelevant = sample(); irrelevant.relevant = false;
  assert.throws(() => validateAnalysis(irrelevant, quote), /irrelevant content/);
  assert.throws(() => validateAnalysis({}, quote), /classification/);
  const nullScore = sample(); nullScore.scores.BTC = 11;
  assert.throws(() => validateAnalysis(nullScore, quote), /between 1 and 10/);
});
test('long transcripts are entirely represented without clipping', () => {
  const transcript = 'a'.repeat(36000) + quote + 'b'.repeat(40000);
  assert.equal(chunks(transcript).join(''), transcript);
  assert.equal(chunks(transcript).length, 3);
});
test('calibration excludes same-time, future and old observations; requires 20 per series', () => {
  const publishedAt = '2023-07-01T10:00:00Z';
  const point = { channelId: 1, publishedAt, result: sample() };
  const history = Array.from({ length: 20 }, (_, i) => ({ ...point, publishedAt: new Date(Date.parse(publishedAt) - (i + 1) * DAY) }));
  history.push({ ...point, result: { ...sample(), scores: { overall: 1, BTC: 1, ETH: null, SOL: null } } });
  history.push({ ...point, publishedAt: '2024-01-01', result: { ...sample(), scores: { overall: 1, BTC: 1, ETH: null, SOL: null } } });
  history.push({ ...point, publishedAt: '2021-01-01' });
  const before = JSON.stringify(point);
  const result = calibratePoint(point, history);
  assert.equal(result.overall.samples, 20); assert.equal(result.overall.baseline, 8); assert.equal(result.overall.adjusted, 5.5);
  assert.equal(result.ETH.baseline, null);
  assert.equal(calibratePoint(point, history.slice(0,19)).overall.adjusted, null);
  assert.equal(calibratePoint(point, [], { overall: 1 }).overall.adjusted, 10);
  assert.equal(JSON.stringify(point), before);
});
const published = '2023-01-01T00:00:00Z';
const candles = Array.from({ length: 90 }, (_, i) => ({ asset: 'BTC', day: new Date(Date.parse('2023-01-02') + i * DAY), open: 100, low: i === 3 ? 70 : 99, high: 120, close: 110 }));
test('outcomes start strictly after publication including midnight and use complete UTC windows', () => {
  for (const horizon of [7,30,90]) {
    const r = outcome(published, 'BTC', horizon, candles, Date.parse('2024-01-01'));
    assert.equal(r.entryDate, '2023-01-02T00:00:00.000Z');
    assert.ok(Math.abs(r.returnPct - 10) < 1e-8); assert.ok(Math.abs(r.declinePct - 30) < 1e-8);
  }
  assert.equal(outcome('2023-01-01T23:59:59Z','BTC',7,candles,Date.parse('2023-01-05')).status, 'pending');
  assert.equal(outcome(published,'BTC',7,candles.filter((_,i)=>i!==3),Date.parse('2024-01-01')).status, 'unavailable');
});
test('scorecards count explicit calls once, exclude conditional/conflicting calls, and preserve derisk outcomes', () => {
  const rows = Array.from({length:4},(_,i)=>({id:i,channelId:1,publishedAt:published,title:'Video '+i,result:sample()}));
  rows[0].result.calls.push({...rows[0].result.calls[0]});
  rows[0].result.actions = [{asset:'BTC',action:'reduce_exposure',conditional:false,quote}];
  rows[1].result.calls[0].conditional=true;
  rows[2].result.calls.push({...rows[2].result.calls[0],direction:'bearish'});
  rows[3].result.calls[0].direction='neutral';
  const result=scorecards(rows,candles,7,'BTC',Date.parse('2024-01-01'))[0];
  assert.equal(result.samples,1); assert.equal(result.hitRate,1); assert.equal(result.alwaysBullish,1);
  assert.equal(result.warningCount,1); assert.equal(result.warningSamples,1); assert.equal(result.sentiment.samples,4);
});
test('Coinbase data is bounded, ordered, deduplicated and validated without filling gaps', () => {
  const start=Date.parse('2021-01-01');
  const row=[start/1000,90,110,100,105,4];
  const result=parseCandles([row,row,[(start-DAY)/1000,90,110,100,105,4]],'BTC',start,start+3*DAY);
  assert.equal(result.length,1); assert.equal(result[0].close,105);
  assert.throws(()=>parseCandles([[start/1000,120,110,100,105,4]],'BTC',start,start+DAY));
  assert.deepEqual(parseCandles([],'SOL',start,start+DAY),[]);
});
test('history page cutoff does not stop on a mixed page; authentication/quota pauses jobs', () => {
  assert.equal(pageReachesStart([{publishedAt:'2020-12-31'},{publishedAt:'2021-01-02'}],'2021-01-01'),false);
  assert.equal(pageReachesStart([{publishedAt:'2020-12-31'}],'2021-01-01'),true);
  assert.equal(pageReachesStart([],'2021-01-01'),false);
  assert.equal(pauseForError({code:'PROVIDER_QUOTA',message:'limit'}),true);
  assert.equal(pauseForError({code:'INVALID_AI_OUTPUT',message:'bad JSON'}),false);
});
