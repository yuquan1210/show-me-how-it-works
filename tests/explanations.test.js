import test from 'node:test';
import assert from 'node:assert/strict';
import { ExplanationQueue, ExplanationCache, explanationJobs, jobContext, validateCard, CARD_FIELDS, requestExplanation, explanationProgress } from '../src/explanations.js';
const card=Object.fromEntries(CARD_FIELDS.map(k=>[k,'Not established']));
const model={name:'Shop',workflows:[],edges:[['a','b']],functionEdges:[],nodes:['a','b'].map(id=>({id,title:id,functions:['Save'],fingerprint:id,functionDetails:[{id:id+'-fn',title:'Save',raw:'return 1'}]}))};
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
test('verbose cards require rewriting rather than silently truncating meaning',()=>{
  assert.throws(()=>validateCard({...card,purpose:Array(25).fill('word').join(' ')}),/shorter rewrite/);
  assert.equal(validateCard({...card,purpose:'Adds a task, then clears the input.'}).purpose,'Adds a task, then clears the input.');
});
test('ordinary parentheses, semicolons and identifier formatting stay readable',()=>{
  const value={...card,receives:'Reads the message (current input); uses the shared task list.',checks:'No explicit validation of `message` is shown.'};
  assert.equal(validateCard(value).receives,value.receives);
  assert.equal(validateCard(value).checks,'No explicit validation of message is shown.');
});
test('code-like response gets a bounded plain-language rewrite instead of cached placeholders',async()=>{
  let calls=0;const stages=[];
  const result=await requestExplanation({}, {},undefined,async()=>{
    calls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(calls===1?{...card,receives:'Reads getInput()'}:card)}}]})};
  },s=>stages.push(s));
  assert.equal(calls,2);assert.deepEqual(result,card);assert.deepEqual(stages,['Waiting for DeepSeek','Rewriting for clarity']);
});
test('progress identifies the item, elapsed wait, pause and completion',()=>{
  const q={jobs:[{id:'a',title:'Add task'}],states:new Map([['a',{status:'loading',stage:'Waiting for DeepSeek',startedAt:1000}]]),enabled:true};
  assert.match(explanationProgress(q,26000),/Add task · 25s · Still waiting/);
  q.states.get('a').status='queued';q.enabled=false;assert.match(explanationProgress(q),/Paused/);
  q.states.get('a').status='ready';assert.match(explanationProgress(q),/Complete/);
});
test('cards reject incomplete data and hide code-like output',()=>{
  assert.throws(()=>validateCard({purpose:'Something'}));
  assert.throws(()=>validateCard({...card,changes:'const secret = 1;'}),/rewrite/);
});
test('context includes dependencies and invalidates when dependencies change',()=>{
  const job=explanationJobs(model).find(j=>j.id==='a');
  const first=jobContext(model,job);
  assert.equal(first.context.source.length,2);
  const changed=structuredClone(model);changed.nodes[1].fingerprint='changed';
  assert.notEqual(first.revision,jobContext(changed,job).revision);
});
test('nothing is requested before start, priority wins, ready cards are cached',async()=>{
  const called=[],cache=new ExplanationCache();
  const q=new ExplanationQueue({cache,request:async(_,ctx)=>{called.push(ctx.title);return card;}});
  const jobs=explanationJobs(model).filter(j=>j.kind==='component');
  await q.setProject(model,jobs,{url:'https://example.com',model:'test'});
  assert.equal(called.length,0);q.prioritize(['b']);q.start();await settle();
  assert.deepEqual(called,['b','a']);
  await q.setProject(model,jobs,{url:'https://example.com',model:'test'},{resume:true});await settle();
  assert.equal(called.length,2);assert.ok([...q.states.values()].every(s=>s.status==='ready'));
});
test('cancelled results cannot replace a newer project and errors remain retryable',async()=>{
  let complete;const q=new ExplanationQueue({request:()=>new Promise(r=>complete=r)});
  await q.setProject(model,explanationJobs(model).slice(0,1),{});q.start();q.stop();complete(card);await settle();
  assert.equal(q.states.get('overview').status,'queued');
  q.request=async()=>{throw new Error('Network unavailable');};q.start();await settle();
  assert.equal(q.states.get('overview').status,'error');q.request=async()=>card;q.retry('overview');await settle();
  assert.equal(q.states.get('overview').status,'ready');
});
test('provider call uses JSON output and rejects truncated responses',async()=>{
  await assert.rejects(requestExplanation({url:'https://api.deepseek.com',model:'test',key:'test'}, {}, undefined,async(url,options)=>{
    assert.equal(url,'/api/ai/chat');
    assert.equal(options.headers.Authorization,undefined);
    assert.equal(JSON.parse(options.body).response_format.type,'json_object');
    return {ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:JSON.stringify(card)}}]})};
  }),/incomplete/);
});
test('changed dependency retains an explicitly stale card until refreshed',async()=>{
  const q=new ExplanationQueue({request:async()=>card});const jobs=explanationJobs(model).filter(j=>j.id==='a');
  await q.setProject(model,jobs,{});q.start();await settle();
  const changed=structuredClone(model);changed.nodes[1].fingerprint='new revision';
  await q.setProject(changed,jobs,{});
  assert.equal(q.states.get('a').stale,true);assert.equal(q.states.get('a').status,'queued');
  q.start();await settle();assert.equal(q.states.get('a').stale,false);
});
test('provider-wide failures pause further requests',async()=>{
  let count=0;const q=new ExplanationQueue({request:async()=>{count++;throw Object.assign(new Error('Rate limit'),{pause:true});}});
  await q.setProject(model,explanationJobs(model),{});q.start();await settle();
  assert.equal(count,1);assert.equal(q.enabled,false);
});
