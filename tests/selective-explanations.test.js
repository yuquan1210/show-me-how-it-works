import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeFiles} from '../src/analyzer.js';
import {ExplanationQueue,explanationJobs,CARD_FIELDS} from '../src/explanations.js';
const card=Object.fromEntries(CARD_FIELDS.map(key=>[key,'Not established']));
const model=()=>analyzeFiles([
  {path:'a.ts',text:"import {save} from './b';export function run(){return save();}"},
  {path:'b.ts',text:'export function save(){return true;}'},
]);
const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
const config={explanationMode:'selective',url:'https://example.invalid',model:'mock',configFingerprint:'profile-a'};

test('selective mode never starts unsolicited work, even when generic start is called',async()=>{
  let calls=0;const q=new ExplanationQueue({request:async()=>{calls++;return card;}}),m=model();
  await q.setProject(m,explanationJobs(m),config);q.start();await settle();
  assert.equal(calls,0);assert.equal(q.enabled,false);
  assert.ok([...q.states.values()].every(s=>s.status==='idle'));
});
test('requesting a component generates only that card without waiting for function cards',async()=>{
  const called=[],q=new ExplanationQueue({request:async(_,ctx)=>{called.push(ctx);return card;}}),m=model();
  await q.setProject(m,explanationJobs(m),config);
  q.start(['component:a']);await settle();
  assert.deepEqual(called.map(c=>c.selected.id),['component:a']);
  assert.equal(q.states.get('component:a').status,'ready');
  assert.equal(q.states.get('a.ts#run:0').status,'idle');
  assert.equal(q.states.get('b.ts#save:0').status,'idle');
  assert.ok(called[0].source.some(s=>s.id==='b.ts#save:0'));
});
test('requesting a caller includes callee code without generating its explanation',async()=>{
  const called=[],q=new ExplanationQueue({request:async(_,ctx)=>{called.push(ctx);return card;}}),m=model();
  await q.setProject(m,explanationJobs(m),config);q.start(['a.ts#run:0']);await settle();
  assert.deepEqual(called.map(c=>c.selected.id),['a.ts#run:0']);
  assert.ok(called[0].source.some(s=>s.id==='b.ts#save:0'));
  assert.equal(q.states.get('b.ts#save:0').status,'idle');
});
test('cached cards reuse across modes while generation settings invalidate them',async()=>{
  let calls=0;const q=new ExplanationQueue({request:async()=>{calls++;return card;}}),m=model(),jobs=explanationJobs(m);
  await q.setProject(m,jobs,config);q.start(['component:a']);await settle();
  await q.setProject(m,jobs,{...config,explanationMode:'full'});
  assert.equal(q.states.get('component:a').status,'ready');assert.equal(calls,1);
  await q.setProject(m,jobs,{...config,configFingerprint:'profile-b'});
  assert.equal(q.states.get('component:a').status,'idle');assert.equal(q.states.get('component:a').stale,true);
  assert.equal(calls,1);
});
test('pausing and resuming selective work retains only explicitly requested targets',async()=>{
  const q=new ExplanationQueue({request:async(_config,_ctx,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}))}),m=model();
  await q.setProject(m,explanationJobs(m),config);q.start(['component:a']);q.stop();await settle();
  assert.equal(q.states.get('component:a').status,'queued');assert.equal(q.states.get('component:b').status,'idle');
  const called=[];q.request=async(_,ctx)=>{called.push(ctx.selected.id);return card;};q.start();await settle();
  assert.deepEqual(called,['component:a']);assert.equal(q.requested.size,0);
});
test('retry and regeneration do not start unrelated cards',async()=>{
  const m=model(),q=new ExplanationQueue({request:async()=>{throw new Error('Try again');}});
  await q.setProject(m,explanationJobs(m),config);q.start(['component:a']);await settle();
  assert.equal(q.states.get('component:a').status,'error');
  const called=[];q.request=async(_,ctx)=>{called.push(ctx.selected.id);return card;};q.retry('component:a');await settle();
  const state=q.states.get('component:a');state.status='queued';state.stale=true;q.start(['component:a']);await settle();
  assert.deepEqual(called,['component:a','component:a']);assert.equal(q.states.get('component:b').status,'idle');
});
test('full mode still generates every card with callees before callers',async()=>{
  const m=model(),called=[],q=new ExplanationQueue({request:async(_,ctx)=>{called.push(ctx.selected.id);return card;}});
  const jobs=explanationJobs(m);await q.setProject(m,jobs,{...config,explanationMode:'full'});q.start();await settle();
  assert.equal(called.length,jobs.length);assert.ok(called.indexOf('b.ts#save:0')<called.indexOf('a.ts#run:0'));
  assert.ok([...q.states.values()].every(s=>s.status==='ready'));
});
