import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles } from '../src/analyzer.js';
import { componentModel } from '../src/components.js';
import { functionItems } from '../src/function-graph.js';
import { focusGraph, systemGraph, functionLayout } from '../src/graph-layout.js';
import { flowDepths } from '../src/graph-activity.js';
import { edgeDetails } from '../src/edge-details.js';
import { explanationJobs, jobContext } from '../src/explanations.js';
import { historyDelta, validateHistory } from '../src/history.js';
import { coverageMarkup } from '../src/coverage-view.js';
const file=(path,text)=>({path,text});
const files=[
  file('src/checkout.ts',"import {book} from './booking'; export function checkout(){return book();}"),
  file('src/booking/index.ts',"export {book} from './service'; export type {Input} from './types';"),
  file('src/booking/service.ts',"import {values} from './state'; import type {Input} from './types'; export function book(){return values.size;}"),
  file('src/booking/state.ts','export const values=new Map();'),
  file('src/booking/types.ts','export interface Input { id:string; }'),
  file('src/startup.ts',"import {start} from 'outside-sdk'; start();"),
];
const layers=['controller','service','repository','external'];

test('Components shows responsibilities with supporting sources folded into their details',()=>{
  const raw=analyzeFiles(files),view=componentModel(raw);
  assert.equal(raw.nodes.length,6);
  assert.equal(componentModel(view),view);
  assert.deepEqual(view.nodes.map(n=>n.title),['Booking','Checkout','Startup']);
  assert.ok(view.nodes.every(n=>n.isComponent));
  assert.ok(view.nodes.every(n=>!['Index','State','Types'].includes(n.title)));
  const booking=view.nodes.find(n=>n.title==='Booking');
  assert.deepEqual(booking.supportingFiles.map(n=>n.id),['src/booking/index.ts','src/booking/state.ts','src/booking/types.ts']);
  assert.ok(!view.nodes.some(n=>n.id==='src/booking/types.ts'));
  assert.equal(view.nodes.find(n=>n.title==='Startup').functionDetails.length,0);
  assert.ok(view.edges.some(([a,b])=>a==='component:checkout'&&b===booking.id));
});

test('functional files in one domain combine with correct function ownership and selection indices',()=>{
  const raw=analyzeFiles([
    file('src/booking/controller.ts',"import {save} from './repository'; export function submit(){return save();}"),
    file('src/booking/repository.ts','export function save(){return true;}'),
  ]),view=componentModel(raw);
  assert.equal(view.nodes.length,1);assert.equal(view.nodes[0].title,'Booking');
  const functions=functionItems(view,layers);
  assert.equal(functions.length,2);
  for(const fn of functions){
    assert.equal(fn.parentId,'component:booking');
    assert.equal(view.nodes[0].functionDetails[fn.functionIndex].id,fn.id);
    assert.equal(fn.sourceModule,fn.parent);
  }
  assert.deepEqual(view.edges,[]);
  assert.equal(functionLayout(functions,view.functionEdges).groups.length,1);
});

test('shared supporting data is marked shared without inventing a dependency between its consumers',()=>{
  const raw=analyzeFiles([
    file('src/orders.ts',"import {state} from './shared/state'; export function order(){return state;}"),
    file('src/users.ts',"import {state} from './shared/state'; export function user(){return state;}"),
    file('src/shared/state.ts','export const state={};'),
  ]),view=componentModel(raw);
  assert.equal(view.nodes.length,2);assert.deepEqual(view.edges,[]);
  for(const component of view.nodes){
    assert.equal(component.supportingFiles.length,1);
    assert.equal(component.supportingFiles[0].sharedWith.length,1);
    assert.notEqual(component.supportingFiles[0].sharedWith[0].id,component.id);
  }
});

test('unowned declarations form one shared responsibility rather than one node per file',()=>{
  const raw=analyzeFiles([file('types.ts','export type ID=string;'),file('constants.ts','export const limit=10;')]);
  const view=componentModel(raw);
  assert.equal(view.nodes.length,1);assert.equal(view.nodes[0].title,'Shared data & definitions');
  assert.equal(view.nodes[0].supportingFiles.length,2);
  assert.equal(view.nodes[0].functions.length,0);
});

test('module initialization remains a responsibility while passive collection state stays supporting data',()=>{
  const raw=analyzeFiles([
    file('src/boot.ts',"import {connect} from 'outside-sdk'; export const connection=connect();"),
    file('src/state.ts','export const values=new Map();'),
    file('src/register.ts',"import 'register-plugin';"),
  ]),view=componentModel(raw);
  assert.equal(raw.nodes.find(n=>n.id==='src/boot.ts').componentRole,'startup');
  assert.equal(raw.nodes.find(n=>n.id==='src/state.ts').componentRole,'support');
  assert.ok(view.nodes.some(n=>n.title==='Boot'));
  assert.ok(view.nodes.some(n=>n.title==='Register'));
  assert.ok(!view.nodes.some(n=>n.title==='State'));
});

test('connections through export wrappers retain true call evidence without exposing wrappers as nodes',()=>{
  const raw=analyzeFiles(files),view=componentModel(raw);
  const detail=edgeDetails(raw,'architecture','component:checkout','component:booking');
  assert.equal(detail.calls.length,1);assert.match(detail.evidence,/Resolved calls/);
  assert.ok(detail.supportingPaths.some(path=>path.includes('src/booking/index.ts')));
  assert.ok(view.edges.every(e=>e.every(id=>view.nodes.some(n=>n.id===id))));
});

test('type-only dependencies across responsibilities remain explicitly non-runtime evidence',()=>{
  const raw=analyzeFiles([
    file('a.ts',"import type {Input} from './b'; export function use(input:Input){return input;}"),
    file('b.ts','export interface Input{id:string;} export function save(){return true;}'),
  ]);
  const detail=edgeDetails(raw,'architecture','a.ts','b.ts');
  assert.equal(detail.calls.length,0);assert.match(detail.evidence,/Type-only/);
});

test('support cycles terminate and do not create extra component links',()=>{
  const raw=analyzeFiles([
    file('a.ts',"import {save} from './exports'; export function use(){return save();}"),
    file('exports.ts',"export * from './exports-again';"),
    file('exports-again.ts',"export * from './exports'; export {save} from './b';"),
    file('b.ts','export function save(){return 1;}'),
  ]),view=componentModel(raw);
  assert.equal(view.nodes.length,2);
  assert.deepEqual(view.edges,[['component:a','component:b']]);
});

test('workflow focus, overview, and function animation use source membership behind component identities',()=>{
  const raw=analyzeFiles(files),view=componentModel(raw);
  const workflow={nodes:['src/booking/service.ts','src/booking/state.ts','src/booking/types.ts']};
  const focused=focusGraph({items:view.nodes,edges:view.edges},workflow);
  assert.deepEqual(focused.items.map(n=>n.title),['Booking']);
  const functions=functionItems(view,layers),functionFocus=focusGraph({items:functions,edges:view.functionEdges},workflow);
  assert.ok(functionFocus.items.every(f=>f.sourceModule==='src/booking/service.ts'));
  assert.ok(flowDepths(focused.items,focused.edges,workflow).has('component:booking'));
  const areas=systemGraph(view);
  assert.ok(areas.items.every(area=>!area.members.some(id=>id.startsWith('component:'))));
  assert.ok(focusGraph(areas,workflow).items.some(area=>area.title==='Booking'));
});

test('AI component cards cover folded sources and do not create separate supporting-file jobs',()=>{
  const raw=analyzeFiles(files),view=componentModel(raw),jobs=explanationJobs(raw,systemGraph(view).items);
  const components=jobs.filter(j=>j.kind==='component');
  assert.equal(components.length,3);
  assert.ok(!components.some(j=>j.id==='src/booking/types.ts'));
  const booking=components.find(j=>j.title==='Booking'),context=jobContext(raw,booking).context;
  assert.ok(context.selected.members.includes('src/booking/state.ts'));
  assert.ok(context.source.some(s=>s.id==='src/booking/index.ts'&&s.role==='selected module'));
  assert.ok(context.selectedOperations.some(f=>f.title==='Book'));
});

test('support changes propagate to owning component history while raw evidence survives roundtrip',()=>{
  const before=analyzeFiles(files),after=analyzeFiles(files.map(f=>f.path.endsWith('/state.ts')?{...f,text:f.text+'\nexport const version=2;'}:f));
  const delta=historyDelta(before,after),view=componentModel(delta);
  const booking=view.nodes.find(n=>n.title==='Booking');assert.equal(booking.status,'modified');
  assert.ok(booking.supportingFiles.some(n=>n.id.endsWith('/state.ts')&&n.status==='modified'));
  const h={format:'show-me-history',version:1,name:'test',kind:'git',commits:[{sha:'a',date:'2026-10-27T00:00:00Z',message:'before',model:before},{sha:'b',date:'2026-10-27T00:00:01Z',message:'after',model:after}]};
  const restored=validateHistory(h).commits[1].model;
  assert.equal(restored.nodes.length,6);assert.equal(componentModel(restored).nodes.length,3);
  assert.match(coverageMarkup(restored,{componentId:'component:booking'}).markup,/Booking component, including its supporting sources/);
});

test('changing export wrappers preserves an existing component connection through history',()=>{
  const before=analyzeFiles(files);
  const after=analyzeFiles(files.filter(f=>f.path!=='src/booking/index.ts').map(f=>f.path==='src/checkout.ts'?{...f,text:f.text.replace("'./booking'","'./booking/service'")}:f));
  const view=componentModel(historyDelta(before,after));
  const key=JSON.stringify(['component:checkout','component:booking']);
  assert.ok(view.edges.some(([a,b])=>a==='component:checkout'&&b==='component:booking'));
  assert.equal(view.edgeChanges[key],undefined);
  const booking=view.nodes.find(n=>n.title==='Booking');
  assert.ok(booking.supportingFiles.some(n=>n.id==='src/booking/index.ts'&&n.status==='removed'));
});
