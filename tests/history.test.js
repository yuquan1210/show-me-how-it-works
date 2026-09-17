import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoHistory,historyDelta,historyUnion,validateHistory,CommitPlayer} from '../src/history.js';
test('sample history grows and retains removals only for the commit that removes them',()=>{
  const h=createDemoHistory();
  assert.equal(h.commits.length,6);
  assert.equal(h.commits[0].model.nodes.length,4);
  const first=historyDelta(null,h.commits[0].model);
  assert.ok(first.nodes.every(n=>n.status==='added'));
  const last=historyDelta(h.commits[4].model,h.commits[5].model);
  assert.ok(last.nodes.some(n=>n.status==='removed'));
  assert.ok(Object.values(last.edgeChanges).includes('removed'));
  const unchanged=historyDelta(h.commits[5].model,h.commits[5].model);
  assert.ok(unchanged.nodes.every(n=>n.status==='unchanged'));
  assert.ok(historyUnion(h).nodes.length>h.commits[5].model.nodes.length);
});
test('fingerprints detect function implementation changes without source bodies',()=>{
  const a=createDemoHistory().commits[0].model,b=structuredClone(a);
  a.nodes[0].fingerprint='before';b.nodes[0].fingerprint='after';
  a.nodes[0].functionDetails[0].fingerprint='one';b.nodes[0].functionDetails[0].fingerprint='two';
  const d=historyDelta(a,b);
  assert.equal(d.nodes[0].status,'modified');
  assert.equal(d.nodes[0].functionDetails[0].status,'modified');
});
test('import validation rejects malformed links and strips raw fields',()=>{
  const h=createDemoHistory();
  h.commits[0].model.nodes[0].functionDetails[0].raw='secret source';
  const valid=validateHistory(h);
  assert.equal(valid.kind,'git');
  assert.equal(valid.commits[0].model.nodes[0].functionDetails[0].raw,undefined);
  h.commits[0].model.edges.push(['missing','also-missing']);
  assert.throws(()=>validateHistory(h));
  assert.throws(()=>validateHistory({format:'show-me-history',version:1,commits:[]}));
});
test('player starts at selected commit, pauses immediately, resumes remaining time and stops at latest',()=>{
  let time=0,job=null,delay=0;const steps=[];
  const p=new CommitPlayer({count:4,onStep:i=>steps.push(i),onState:()=>{},clock:()=>time,schedule:(fn,ms)=>{job=fn;delay=ms;return 1;},cancel:()=>{job=null;}});
  p.select(1);p.play();assert.equal(delay,4000);
  time=1000;p.pause();assert.equal(job,null);assert.equal(p.index,1);
  p.play();assert.equal(delay,3000);job();assert.equal(p.index,2);
  job();assert.equal(p.index,3);assert.equal(p.playing,false);
  assert.deepEqual(steps,[1,2,3]);
  p.select(0);p.play();p.select(2);assert.equal(job,null);assert.equal(p.playing,false);
});
