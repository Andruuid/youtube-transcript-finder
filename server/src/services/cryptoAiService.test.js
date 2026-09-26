import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTranscript, quotePassages, resolveQuoteReferences, validateAnalysis } from './cryptoAiService.js';
const source = "At some point, we're going to go bull. That is the signal to go heavy heavy heavy heavy heavy. So, that can happen before 40K.";
const candidate = (quote = {start:2,end:2}) => ({
  relevant:true, reason:'Bitcoin outlook', summary:'A conditional bullish outlook.', confidence:.8,
  scores:{overall:8,BTC:8,ETH:null,SOL:null},
  evidence:['overall','BTC'].map(asset=>({asset,quote,explanation:'Endorsed outlook'})),
  calls:[{asset:'BTC',direction:'bullish',horizon:'unspecified',conditional:true,quote}],
  actions:[{asset:'BTC',action:'buy',conditional:true,quote}]
});

test('passages preserve every source character, including long unpunctuated captions',()=>{
  for(const transcript of [source,'hello '.repeat(9000),'x'.repeat(1500),'Price is $1.50.\nNext: $40,000! Buying? Yes.']){
    const passages=quotePassages(transcript);
    assert.equal(passages.join(''),transcript);
    assert.ok(passages.every(p=>p.length<=601));
  }
});
test('ranges copy exact text into all collections without mutating the candidate',()=>{
  const original=candidate({start:1,end:2});
  const resolved=resolveQuoteReferences(original,quotePassages(source));
  validateAnalysis(resolved,source);
  for(const item of [...resolved.evidence,...resolved.calls,...resolved.actions]){
    assert.equal(item.quote,"At some point, we're going to go bull. That is the signal to go heavy heavy heavy heavy heavy.");
  }
  assert.deepEqual(original.evidence[0].quote,{start:1,end:2});
});
test('real failures preserve caption spelling, repetitions, contractions and punctuation',()=>{
  for(const transcript of [
    "I'm bearish Sana price, guys. I think likely it's going to go to 30.",
    'So, the catchup trade is going to be massive in crypto, but we have to be patient.',
    'So if if we go to 50, buy by by buy by by massive massive buy.',
    "the plebe doesn't understand that you can stake and you can get this inflation",
    'So, for now though, for now though, Solana looks very bad.',
    "How it's good for ETH? It's a corporate chain that takes all users, takes all fees, and they pay $1,000 to L1.",
    'Slana still bearish. Stay out. Be careful. Be careful.',
    "the upside in it is very capped like in my mind it's it's it's too capped"
  ]){
    const passages=quotePassages(transcript);
    const result=resolveQuoteReferences(candidate({start:1,end:passages.length}),passages);
    assert.equal(result.evidence[0].quote,transcript);
    validateAnalysis(result,transcript);
  }
});
test('invalid references and disjoint synthesis ranges cannot become evidence',()=>{
  for(const ref of [null,'Invented quote',{start:0,end:1},{start:2,end:1},{start:1,end:99},{start:1.5,end:2},{start:'1',end:2}]){
    assert.throws(()=>resolveQuoteReferences(candidate(ref),quotePassages(source)),{code:'INVALID_AI_OUTPUT'});
  }
  assert.throws(()=>resolveQuoteReferences(candidate({start:1,end:2}),['First excerpt.','Separate excerpt.'],true),{code:'INVALID_AI_OUTPUT'});
});
test('strict validation rejects invented text and partial numbers',()=>{
  for(const quote of ['Bitcoin will reach one million.','We expect 1.']){
    assert.throws(()=>validateAnalysis(candidate(quote),'We expect 1.5 dollars.'),/not in the transcript/);
  }
});
test('model pipeline uses references, bounded repair and grounded synthesis',async t=>{
  const previousKey=process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY='test-only';
  try{
    await t.test('one request selects a passage without retyping',async()=>{
      let calls=0;
      const result=await analyzeTranscript(source,{fetchImpl:async(url,options)=>{
        calls++;
        const body=JSON.parse(options.body);
        const schema=body.response_format.json_schema.schema.properties.evidence.items.properties.quote;
        assert.equal(schema.type,'object');
        assert.equal(schema.properties.start.minimum,1);
        assert.match(body.messages[1].content,/SOURCE PASSAGES/);
        return response(candidate());
      }});
      assert.equal(calls,1);
      assert.equal(result.evidence[0].quote,'That is the signal to go heavy heavy heavy heavy heavy.');
    });
    await t.test('invalid selection gets one repair',async()=>{
      let calls=0;
      const result=await analyzeTranscript(source,{fetchImpl:async(url,options)=>{
        calls++;
        if(calls===2)assert.match(JSON.parse(options.body).messages[1].content,/failed validation/);
        return response(calls===1?candidate({start:999,end:999}):candidate());
      }});
      assert.equal(calls,2);
      validateAnalysis(result,source);
    });
    await t.test('invented text fails after bounded repair',async()=>{
      let calls=0;
      await assert.rejects(analyzeTranscript(source,{fetchImpl:async()=>{
        calls++;return response(candidate('Bitcoin will reach one million.'));
      }}),{code:'INVALID_AI_OUTPUT'});
      assert.equal(calls,2);
    });
    await t.test('synthesis selects verified excerpts across multiple chunks',async()=>{
      const transcript='Bitcoin may rise. '.repeat(2500);
      let calls=0;
      const result=await analyzeTranscript(transcript,{fetchImpl:async(url,options)=>{
        calls++;
        if(calls===3)assert.match(JSON.parse(options.body).messages[1].content,/start and end MUST be the same id/);
        return response(candidate({start:1,end:1}));
      }});
      assert.equal(calls,3);
      validateAnalysis(result,transcript);
    });
    await t.test('irrelevant chunks synthesize with no evidence passages',async()=>{
      const irrelevant={...candidate(),relevant:false,summary:'',scores:{overall:null,BTC:null,ETH:null,SOL:null},evidence:[],calls:[],actions:[]};
      const result=await analyzeTranscript('Cooking dinner. '.repeat(2500),{fetchImpl:async()=>response(irrelevant)});
      assert.equal(result.relevant,false);
      assert.deepEqual(result.evidence,[]);
    });
  }finally{
    if(previousKey===undefined)delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY=previousKey;
  }
});
function response(result){
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));
}
