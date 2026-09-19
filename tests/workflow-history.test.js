import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoHistory, CommitPlayer } from '../src/history.js';
import { workflowCatalog, workflowCommit, workflowHistoryUnion, nextWorkflowCommit } from '../src/workflow-history.js';

test('catalog includes future workflows but their pre-creation graph is empty',()=>{
  const h=createDemoHistory(),catalog=workflowCatalog(h),checkout=catalog.find(w=>w.name==='Place an order');
  assert.equal(catalog.length,3);
  assert.equal(workflowCommit(h,0,checkout).state,'not-created');
  assert.equal(workflowCommit(h,0,checkout).model.nodes.length,0);
  assert.equal(workflowCommit(h,2,checkout).state,'created');
  const union=workflowHistoryUnion(h,checkout);
  assert.ok(!union.nodes.some(n=>n.id==='auth-api'));
});
test('unrelated changes are excluded and selected snapshots still compare against their immediate parent',()=>{
  const h=createDemoHistory(),catalog=workflowCatalog(h),browse=catalog.find(w=>w.name==='Browse products');
  assert.equal(workflowCommit(h,1,browse).changed,false);
  assert.equal(workflowCommit(h,4,browse).changed,false);
  assert.ok(workflowCommit(h,3,browse).model.nodes.every(n=>n.status==='unchanged'));
  assert.equal(nextWorkflowCommit(0,6,i=>workflowCommit(h,i,browse).changed,true),5);
});
test('disconnected nodes and edges survive as ghosts even when still present elsewhere',()=>{
  const h=createDemoHistory();
  const before=structuredClone(h.commits[3]),after=structuredClone(before);
  after.model.workflows.find(w=>w.id==='checkout').nodes=after.model.workflows.find(w=>w.id==='checkout').nodes.filter(id=>id!=='email');
  const pair={commits:[before,after]},entry=workflowCatalog(pair).find(w=>w.name==='Place an order');
  const result=workflowCommit(pair,1,entry);
  const email=result.model.nodes.find(n=>n.id==='email');
  assert.equal(email.status,'removed');assert.match(email.change,/Still exists/);
  assert.equal(result.model.edgeChanges[JSON.stringify(['order-store','email'])],'removed');
  after.model.workflows=after.model.workflows.filter(w=>w.id!=='checkout');
  const removed=workflowCommit(pair,1,workflowCatalog(pair).find(w=>w.name==='Place an order'));
  assert.equal(removed.state,'removed-now');assert.ok(removed.model.nodes.every(n=>n.status==='removed'));
});
function localHistory() {
  const node=(id,fp)=>({id,title:id,summary:id,layer:'service',functions:[id],functionDetails:[{id:id+'#f',title:id,summary:id,inputs:[],outputs:[],effects:[],decisions:[],fingerprint:fp}],inputs:[],outputs:[],effects:[],decisions:[],fingerprint:fp,status:'unchanged'});
  const model={kind:'local',name:'test',nodes:[node('entry','e'),node('shared','s'),node('leaf','l')],edges:[['entry','shared'],['shared','leaf']],functionEdges:[['entry#f','shared#f']],workflows:[{id:'entry',name:'Checkout',nodes:['entry','shared','leaf']}],errors:[]};
  return {commits:[{model},{model:structuredClone(model)}]};
}
test('unique unchanged entry fingerprints retain identity across file moves',()=>{
  const h=localHistory(),m=h.commits[1].model;
  m.nodes[0].id='moved';m.workflows[0]={id:'moved',name:'New checkout name',nodes:['moved','shared','leaf']};
  const catalog=workflowCatalog(h);
  assert.equal(catalog.length,1);assert.ok(catalog[0].matched.has(1));
  assert.equal(catalog[0].versions[0].name,'Checkout');
});
test('ambiguous splits remain separate and flag both old and new selections',()=>{
  const h=localHistory(),m=h.commits[1].model;
  m.nodes[0].id='moved';m.nodes[0].fingerprint='changed';m.nodes.push({...m.nodes[0],id:'other'});
  m.workflows=[{id:'moved',name:'Checkout A',nodes:['moved','shared','leaf']},{id:'other',name:'Checkout B',nodes:['other','shared','leaf']}];
  const catalog=workflowCatalog(h);
  assert.equal(catalog.length,3);assert.ok(catalog.every(e=>e.uncertain.has(1)));
});
test('import-only dependency changes are possible impacts, not verified workflow behavior',()=>{
  const h=localHistory();
  h.commits[1].model.nodes[2].fingerprint='new';h.commits[1].model.nodes[2].functionDetails[0].fingerprint='new-fn';
  const result=workflowCommit(h,1,workflowCatalog(h)[0]);
  assert.equal(result.possible,1);assert.equal(result.within,0);
  assert.equal(result.model.nodes.find(n=>n.id==='leaf').impact,'possible');
});
test('filtered playback jumps only to affected commits and always reaches latest',()=>{
  let job=null;const seen=[];
  const p=new CommitPlayer({count:6,onStep:i=>seen.push(i),onState:()=>{},schedule:fn=>(job=fn,1),cancel:()=>{job=null;},nextIndex:i=>nextWorkflowCommit(i,6,j=>j===3,true)});
  p.select(0);p.play();job();assert.equal(p.index,3);job();assert.equal(p.index,5);
  assert.equal(p.playing,false);assert.deepEqual(seen,[0,3,5]);
});
