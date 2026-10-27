import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {analyzeFiles} from '../src/analyzer.js';
import {scopeWorkflowModel} from '../src/workflows.js';
import {explanationJobs,jobContext,workflowCardId} from '../src/explanations.js';
import {componentModel} from '../src/components.js';
import {workflowCatalog,workflowCommit} from '../src/workflow-history.js';
import {validateHistory} from '../src/history.js';

const tickets=()=>{
  const root=new URL('../examples/ticket-reservations/src/',import.meta.url);
  return readdirSync(root).filter(name=>name.endsWith('.ts')).map(path=>({path:'src/'+path,text:readFileSync(new URL(path,root),'utf8')}));
};
test('create and cancel workflows in the same controller stay separate with shared helpers',()=>{
  const model=analyzeFiles(tickets());
  const create=model.workflows.find(w=>w.name==='Create Booking'),cancel=model.workflows.find(w=>w.name==='Cancel Booking');
  assert.ok(create&&cancel);assert.notEqual(create.id,cancel.id);
  assert.ok(create.functionIds.some(id=>id.includes('#charge:')));
  assert.ok(!create.functionIds.some(id=>id.includes('#refund:')));
  assert.ok(cancel.functionIds.some(id=>id.includes('#refund:')));
  assert.ok(!cancel.functionIds.some(id=>id.includes('#calculateTotal:')));
  assert.ok(create.functionIds.some(id=>cancel.functionIds.includes(id)&&id.includes('#releaseSeats:')));
  const scoped=scopeWorkflowModel(model,cancel);
  assert.ok(scoped.nodes.flatMap(n=>n.functionDetails).every(fn=>cancel.functionIds.includes(fn.id)));
  assert.ok(!scoped.nodes.some(n=>n.id==='src/pricing.service.ts'));
  const booking=componentModel(scoped).nodes.find(n=>n.title==='Booking');
  assert.ok(booking.functionDetails.some(fn=>fn.name==='cancelBooking'));
  assert.ok(!booking.functionDetails.some(fn=>fn.name==='createBooking'));
});
test('unused imports do not become workflow operations or implementation steps',()=>{
  const model=analyzeFiles([
    {path:'controller.ts',text:"import {used} from './used';import {unused} from './unused';export function entry(){return used();}"},
    {path:'used.ts',text:'export function used(){return true;}'},
    {path:'unused.ts',text:'export function unused(){return true;}'},
  ]);
  const workflow=model.workflows.find(w=>w.name==='Entry');
  assert.deepEqual(workflow.nodes,['controller.ts','used.ts']);
  assert.ok(!workflow.functionIds.some(id=>id.includes('unused')));
});
test('workflow discovery has no twenty-operation cap and excludes private controller helpers',()=>{
  const model=analyzeFiles([{path:'controllers/example.ts',text:Array.from({length:30},(_,i)=>`export function operation${i}(){return ${i};}`).join('\n')+'\nfunction internalHelper(){return true;}'}]);
  assert.equal(model.workflows.length,30);
  assert.ok(model.workflows.every(w=>w.trigger.kind==='controller'));
  assert.ok(!model.workflows.some(w=>w.entryFunctionId.includes('internalHelper')));
});
test('public exports through a barrel remain discoverable while nested helpers do not become entries',()=>{
  const model=analyzeFiles([
    {path:'index.ts',text:"export {read,write} from './store';"},
    {path:'store.ts',text:'export function read(){return 1;}export function write(){function nested(){return 2;}return nested();}'},
  ]);
  assert.deepEqual(model.workflows.map(w=>w.name),['Read','Write']);
  assert.ok(model.workflows.find(w=>w.name==='Write').functionIds.some(id=>id.includes('#nested:')));
});
test('workflow AI cards and scoped component cards exclude sibling operations',()=>{
  const model=analyzeFiles(tickets()),workflow=model.workflows.find(w=>w.name==='Cancel Booking');
  const jobs=explanationJobs(model);
  for(const job of [jobs.find(j=>j.id===`workflow:${workflow.id}`),jobs.find(j=>j.id===workflowCardId('component:booking',workflow))]){
    const context=jobContext(model,job).context;
    assert.ok(context.source.some(s=>s.role==='selected'&&s.id.includes('#cancel')));
    assert.ok(!context.source.some(s=>s.role==='selected'&&/#(createBooking|book|charge|calculateTotal):/.test(s.id)));
    assert.ok(context.selectedOperations.every(fn=>workflow.functionIds.includes(fn.id)));
  }
});
test('a sibling-only change is skipped while a selected workflow state change remains visible',()=>{
  const original=tickets(),before=analyzeFiles(original);
  const after=analyzeFiles(original.map(f=>f.path.endsWith('booking.controller.ts')?{...f,text:f.text.replace('Email is invalid','Invalid email address')}:f));
  const history={commits:[{model:before},{model:after}]},catalog=workflowCatalog(history);
  assert.equal(workflowCommit(history,1,catalog.find(w=>w.name==='Cancel Booking')).changed,false);
  assert.equal(workflowCommit(history,1,catalog.find(w=>w.name==='Create Booking')).changed,true);
  const state=analyzeFiles(original.map(f=>f.path.endsWith('reservation.repository.ts')?{...f,text:f.text.replace('availableSeats = 12','availableSeats = 15')}:f));
  const stateHistory={commits:[{model:before},{model:state}]};
  assert.equal(workflowCommit(stateHistory,1,workflowCatalog(stateHistory).find(w=>w.name==='Create Booking')).changed,true);
});
test('moving a controller file matches each unique entry fingerprint independently',()=>{
  const before=analyzeFiles([{path:'controllers/old.ts',text:'export function create(){return 1;}export function cancel(){return 2;}'}]);
  const after=analyzeFiles([{path:'controllers/new.ts',text:'export function create(){return 1;}export function cancel(){return 2;}'}]);
  const catalog=workflowCatalog({commits:[{model:before},{model:after}]});
  assert.equal(catalog.length,2);assert.ok(catalog.every(w=>w.matched.has(1)));
});
test('comments and formatting alone do not produce structural history changes',()=>{
  const before=analyzeFiles([{path:'controller.ts',text:'const amount=1;export function read(){return amount;}'}]);
  const after=analyzeFiles([{path:'controller.ts',text:'// explanatory comment\nconst amount = 1;\nexport function read() { return amount; }'}]);
  const history={commits:[{model:before},{model:after}]};
  assert.equal(workflowCommit(history,1,workflowCatalog(history)[0]).changed,false);
});
test('history rejects dangling operation references and accepts older module-based workflows',()=>{
  const model=analyzeFiles(tickets());
  const history={format:'show-me-history',version:1,name:'tickets',commits:[{sha:'a',message:'a',date:'2026-10-27T00:00:00Z',model}]};
  assert.doesNotThrow(()=>validateHistory(history));
  history.commits[0].model.workflows[0].entryFunctionId='missing';
  assert.throws(()=>validateHistory(history));
});

test('overview AI context retains operation entry points after workflows become function-based',()=>{
  const model=analyzeFiles(tickets());
  const context=jobContext(model,explanationJobs(model).find(job=>job.id==='overview')).context;
  assert.ok(context.entryOperations.some(fn=>fn.id.includes('#createBooking:')));
  assert.ok(context.entryOperations.some(fn=>fn.id.includes('#cancelBooking:')));
});

test('workflow coverage sent to AI excludes unresolved calls owned only by a sibling operation',()=>{
  const model=analyzeFiles([{path:'controller.ts',text:'export function first(){unknownFirst();}export function second(){unknownSecond();}'}]);
  const workflow=model.workflows.find(w=>w.name==='First');
  const context=jobContext(model,explanationJobs(model).find(job=>job.id===`workflow:${workflow.id}`)).context;
  assert.ok(context.analysisCoverage.calls.some(c=>c.label==='unknownFirst'));
  assert.ok(!context.analysisCoverage.calls.some(c=>c.label==='unknownSecond'));
});
