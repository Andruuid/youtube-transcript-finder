import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTranscript, restoreSourceQuotes, validateAnalysis } from './cryptoAiService.js';

const source = "At some point, we're going to go bull. That is the signal to go heavy heavy heavy heavy heavy. So, that can happen before 40K.";
const candidate = (quote = 'That is the signal to go heavy.') => ({
  relevant: true, reason: 'Bitcoin outlook', summary: 'The creator describes a conditional bullish outlook.',
  confidence: .8, scores: { overall: 8, BTC: 8, ETH: null, SOL: null },
  evidence: ['overall', 'BTC'].map(asset => ({ asset, quote, explanation: 'Endorsed outlook' })),
  calls: [{ asset: 'BTC', direction: 'bullish', horizon: 'unspecified', conditional: true, quote }],
  actions: [{ asset: 'BTC', action: 'buy', conditional: true, quote }]
});

test('reported failure is restored to a contiguous source excerpt in every quote collection', () => {
  const original = candidate();
  assert.throws(() => validateAnalysis(original, source), /not in the transcript/);
  const restored = restoreSourceQuotes(original, source);
  validateAnalysis(restored, source);
  for (const item of [...restored.evidence, ...restored.calls, ...restored.actions]) {
    assert.equal(item.quote, 'That is the signal to go heavy');
    assert.ok(source.includes(item.quote));
  }
  assert.equal(original.evidence[0].quote, 'That is the signal to go heavy.');
});

test('case, whitespace and typographic apostrophes are restored from the source', () => {
  const transcript = 'We’re\n  buying Bitcoin when the trend turns.';
  const restored = restoreSourceQuotes(candidate("we're buying bitcoin."), transcript);
  assert.equal(restored.evidence[0].quote, 'We’re\n  buying Bitcoin');
  validateAnalysis(restored, transcript);
});

test('already grounded quotes keep all repetitions and punctuation', () => {
  const quote = 'That is the signal to go heavy heavy heavy heavy heavy.';
  assert.deepEqual(restoreSourceQuotes(candidate(quote), source), candidate(quote));
});

test('restoration rejects changed words, omitted fillers, negation and partial words or numbers', () => {
  for (const [quote, transcript] of [
    ['That is the signal to buy heavily.', source],
    ['We are buying Bitcoin.', 'We are not buying Bitcoin.'],
    ['We are buying Bitcoin.', 'We are uh buying Bitcoin.'],
    ['That is the signal to go heavy heavy. So,', source],
    ['We will buy.', 'We will buying Bitcoin.'],
    ['We expect 40.', 'We expect 40,000 dollars.'],
    ['We expect 1.', 'We expect 1.5 dollars.'],
    ['Expect Bitcoin to rise.', 'Unexpected Bitcoin to rise.']
  ]) {
    assert.throws(() => validateAnalysis(restoreSourceQuotes(candidate(quote), transcript), transcript), /not in the transcript/);
  }
});

test('malformed quote items fail validation with a recoverable error', () => {
  const result = candidate();
  result.evidence = [null];
  assert.throws(() => validateAnalysis(restoreSourceQuotes(result, source), source), { code: 'INVALID_AI_OUTPUT' });
});

test('analysis restores excerpts before requesting repairs and still rejects ungrounded repairs', async t => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-only';
  try {
    await t.test('formatting-only failure needs one model request', async () => {
      let calls = 0;
      const result = await analyzeTranscript(source, { fetchImpl: async () => {
        calls++;
        return response(candidate());
      } });
      assert.equal(calls, 1);
      assert.equal(result.evidence[0].quote, 'That is the signal to go heavy');
    });
    await t.test('substantive mismatch still requests and validates a repair', async () => {
      let calls = 0;
      const result = await analyzeTranscript(source, { fetchImpl: async (url, options) => {
        calls++;
        if (calls === 2) assert.match(JSON.parse(options.body).messages[1].content, /failed validation/);
        return response(calls === 1 ? candidate('Bitcoin will reach one million.') : candidate());
      } });
      assert.equal(calls, 2);
      validateAnalysis(result, source);
    });
    await t.test('invented evidence cannot pass even after repair', async () => {
      let calls = 0;
      await assert.rejects(analyzeTranscript(source, { fetchImpl: async () => {
        calls++;
        return response(candidate('Bitcoin will reach one million.'));
      } }), { code: 'INVALID_AI_OUTPUT' });
      assert.equal(calls, 2);
    });
  } finally {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

function response(result) {
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] }));
}
