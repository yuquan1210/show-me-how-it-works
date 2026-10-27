import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyzeFiles } from '../src/analyzer.js';
import { coverageSummary, validateCoverage } from '../src/coverage-summary.js';
import { coverageMarkup } from '../src/coverage-view.js';
import { explanationJobs, jobContext } from '../src/explanations.js';
import { edgeDetails } from '../src/edge-details.js';
import { functionItems } from '../src/function-graph.js';
import { layoutGraph, functionLayout, systemGraph } from '../src/graph-layout.js';
import { historyDelta, validateHistory } from '../src/history.js';

const fixture = () => {
  const root = new URL('../examples/analysis-coverage/', import.meta.url);
  const walk = prefix => readdirSync(new URL(prefix, root), {withFileTypes: true}).flatMap(entry =>
    entry.isDirectory() ? walk(prefix + entry.name + '/') : /\.(ts|json)$/.test(entry.name) ? [{path: prefix + entry.name, text: readFileSync(new URL(prefix + entry.name, root), 'utf8')}] : []);
  return walk('');
};
const layers = ['controller','service','repository','external'];
const history = model => ({format:'show-me-history',version:1,name:'Coverage fixture',kind:'git',commits:[{sha:'fixture',date:'2026-10-27T00:00:00Z',message:'Coverage fixture',model}]});

test('retains state, type, re-export, and startup modules and their dependency chain', () => {
  const model = analyzeFiles(fixture());
  assert.equal(model.nodes.length, 6);
  for (const id of ['src/booking/index.ts','src/booking/types.ts','src/booking/state.ts','src/startup.ts']) {
    const node = model.nodes.find(n => n.id === id);
    assert.ok(node, id);
    assert.equal(node.functionDetails.length, 0, id);
  }
  assert.ok(model.edges.some(([a,b]) => a === 'src/main.ts' && b === 'src/booking/index.ts'));
  assert.ok(model.edges.some(([a,b]) => a === 'src/booking/index.ts' && b === 'src/booking/service.ts'));
  assert.ok(model.edges.some(([a,b]) => a === 'src/booking/index.ts' && b === 'src/booking/types.ts'));
  assert.ok(model.functionEdges.some(([a,b]) => a === 'src/main.ts#submit:0' && b === 'src/booking/service.ts#createBooking:0'));
  assert.equal(model.coverage.sourceFiles, 6);
  assert.equal(model.coverage.mappedModules, 6);
});

test('barrel/type/state modules supply scoped explanation evidence and invalidate it when changed', () => {
  const files = fixture(), model = analyzeFiles(files);
  const job = explanationJobs(model).find(j => j.fn?.name === 'submit');
  const {context,revision} = jobContext(model,job);
  assert.ok(context.environment.some(s => s.id === 'src/booking/types.ts' && s.source.includes('requestId: string')));
  assert.ok(context.environment.some(s => s.id === 'src/booking/state.ts'));
  assert.ok(context.analysisCoverage.dependencies.some(d => d.kind === 're-export'));
  assert.ok(context.analysisCoverage.callbackReferences.length);
  assert.equal(context.hasUnresolvedBehavior,true);
  const changed = analyzeFiles(files.map(f => f.path === 'src/booking/types.ts' ? {...f,text:f.text.replace('requestId: string','requestId: number')} : f));
  assert.notEqual(revision,jobContext(changed,job).revision);
  for (const id of ['src/booking/index.ts','src/booking/state.ts','src/startup.ts']) {
    const componentJob = explanationJobs(model).find(j => j.kind==='component'&&j.members.includes(id));
    assert.ok(jobContext(model,componentJob).context.source.some(s => s.id === id && s.role === 'selected module'),id);
  }
});

test('external packages and unresolved supplied callbacks remain explicit without invented call links', () => {
  const model = analyzeFiles(fixture()), coverage = model.coverage;
  const charge = coverage.calls.find(c => c.label === 'charge');
  assert.equal(charge.status,'external');assert.ok(charge.dependency);assert.equal(charge.to,undefined);
  const notify = coverage.calls.find(c => c.label === 'notify');
  assert.equal(notify.status,'unresolved');assert.equal(notify.to,undefined);
  assert.ok(!model.functionEdges.some(([a,b]) => b.includes('#notify:')));
  assert.equal(coverage.dependencies.find(d => d.specifier === 'example-payment-sdk').status,'external');
  const stats=coverageSummary(coverage);
  assert.equal(stats.resolvedCalls+stats.externalCalls+stats.unresolvedCalls,coverage.calls.length);
  assert.equal(coverage.counts.totalCalls,coverage.calls.length);
  assert.ok(coverage.calls.every(c => c.line > 0 && c.column > 0));
});

test('constructors, instance methods and field functions resolve to explicit implementations', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function save(){return 1;} class Store {constructor(){save();} run = () => save(); get(){return save();}} export function use(){const s=new Store();s.run();s.get();}'}]);
  const constructor=model.nodes[0].functionDetails.find(f => f.kind === 'constructor');
  assert.ok(constructor);
  assert.ok(model.functionEdges.some(([a,b]) => a === 'app.ts#use:0' && b === constructor.id));
  assert.ok(model.functionEdges.some(([a,b]) => a === constructor.id && b === 'app.ts#save:0'));
  assert.ok(model.functionEdges.some(([a,b]) => a === 'app.ts#use:0' && b === 'app.ts#run:0'));
  assert.ok(model.functionEdges.some(([a,b]) => a === 'app.ts#use:0' && b === 'app.ts#get:0'));
});

test('accessor bodies and private/quoted methods retain their own ownership without implicit call edges', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function save(){return 1;} class Store {get value(){return save();} set value(input){save();} #read(){return save();} "write"(){return this.#read();}} export function use(s:Store){return s.value;}'}]);
  const accessors=model.nodes[0].functionDetails.filter(f=>f.kind==='accessor');
  assert.equal(accessors.length,2);
  for(const fn of accessors) assert.ok(model.functionEdges.some(([a,b])=>a===fn.id&&b==='app.ts#save:0'));
  assert.ok(model.functionEdges.some(([a,b])=>a==='app.ts#write:0'&&b==='app.ts##read:0'));
  assert.ok(!model.functionEdges.some(([a])=>a==='app.ts#use:0'));
});

test('runtime operations are external while locally implemented names remain mapped', () => {
  const model=analyzeFiles([{path:'app.ts',text:'const values=new Map(); export function use(input:string){values.set(input,1);input.trim();} function fetch(){return 1;} export function local(){return fetch();}'}]);
  assert.equal(model.coverage.calls.find(c=>c.label==='Map').status,'external');
  assert.equal(model.coverage.calls.find(c=>c.label==='set').status,'external');
  assert.equal(model.coverage.calls.find(c=>c.label==='trim').status,'external');
  assert.equal(model.coverage.calls.find(c=>c.label==='fetch').status,'resolved');
});

test('inline and named callbacks are references, never fabricated caller-to-callback execution edges', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function save(){return 1;} function later(cb){} export function use(){later(()=>save());later(save);}'}]);
  const callback=model.nodes[0].functionDetails.find(f => f.kind === 'callback');
  assert.ok(callback);
  assert.equal(model.coverage.callbackReferences.length,2);
  assert.ok(!model.functionEdges.some(([a,b]) => a === 'app.ts#use:0' && b === callback.id));
  assert.ok(!model.functionEdges.some(([a,b]) => a === 'app.ts#use:0' && b === 'app.ts#save:0'));
  assert.ok(model.functionEdges.some(([a,b]) => a === callback.id && b === 'app.ts#save:0'));
  const ctx=jobContext(model,explanationJobs(model).find(j=>j.fn?.name==='use')).context;
  assert.ok(ctx.source.some(s=>s.id==='app.ts#save:0'));
  assert.ok(ctx.analysisCoverage.callbackReferences.every(r=>/not established/.test(r.reason)));
});

test('function-valued callback arguments without supplied bodies remain unresolved references', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function register(handler:()=>void){} export function use(handler:()=>void){register(handler);}'}]);
  const reference=model.coverage.callbackReferences[0];
  assert.equal(reference.status,'unresolved');assert.equal(reference.to,undefined);
  assert.match(reference.reason,/no unique implementation/);
  assert.equal(coverageSummary(model.coverage).unresolvedCallbacks,1);
  assert.doesNotThrow(()=>validateCoverage(model.coverage,model));
  const context=jobContext(model,explanationJobs(model).find(j=>j.fn?.name==='use')).context;
  assert.equal(context.hasUnresolvedBehavior,true);
});

test('an immediately invoked anonymous function has its own resolved operation', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function save(){return 1;} export function use(){return (()=>save())();}'}]);
  const anonymous=model.nodes[0].functionDetails.find(f=>f.kind==='callback');
  assert.ok(model.functionEdges.some(([a,b])=>a==='app.ts#use:0'&&b===anonymous.id));
  assert.ok(model.functionEdges.some(([a,b])=>a===anonymous.id&&b==='app.ts#save:0'));
});

test('overload signatures resolve only to their single supplied implementation', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function save(x:string):string; function save(x:number):number; function save(x:any){return x;} export function use(){return save(1);}'}]);
  assert.deepEqual(model.functionEdges,[['app.ts#use:0','app.ts#save:0']]);
});

test('computed dispatch never selects a coincidentally matching implementation', () => {
  const model=analyzeFiles([{path:'app.ts',text:'function save(){return 1;} const methods={save}; export function use(key:"save"){return methods[key]();}'}]);
  assert.deepEqual(model.functionEdges,[]);
  const call=model.coverage.calls[0];assert.equal(call.status,'unresolved');assert.match(call.reason,/Computed/);
});

test('module initialization calls are recorded without fake function nodes or function edges', () => {
  const model=analyzeFiles([{path:'start.ts',text:"import {boot} from './boot';boot();"},{path:'boot.ts',text:'export function boot(){return true;}'}]);
  assert.equal(model.nodes[0].functionDetails.length,0);
  assert.deepEqual(model.functionEdges,[]);
  assert.equal(model.coverage.calls[0].from,'start.ts');
  assert.equal(model.coverage.calls[0].to,'boot.ts#boot:0');
  const empty=analyzeFiles([{path:'empty.ts',text:'// intentionally empty'}]);
  assert.deepEqual(empty.coverage.emptyFiles,['empty.ts']);
  assert.equal(empty.coverage.mappedModules,0);
});

test('dynamic imports and unshadowed require dependencies resolve literal locations only', () => {
  const model=analyzeFiles([
    {path:'main.ts',text:"export async function run(path:string){await import('./store');await import(path);require('./store');} export function local(require:(value:string)=>void){require('not-a-module');}"},
    {path:'store.ts',text:'export const value=1;'},
  ]);
  assert.equal(model.coverage.dependencies.length,3);
  assert.equal(model.coverage.dependencies.filter(d=>d.status==='resolved').length,2);
  assert.equal(model.coverage.dependencies.find(d=>d.specifier===null).status,'unresolved');
  assert.ok(!model.coverage.dependencies.some(d=>d.specifier==='not-a-module'));
  assert.ok(model.coverage.calls.some(c=>c.label==='require'&&c.status==='unresolved'));
});

test('an unresolved configured alias is not mislabeled as an external package', () => {
  const model=analyzeFiles([{path:'tsconfig.json',text:'{"compilerOptions":{"paths":{"@/*":["src/*"]}}}'},{path:'app.ts',text:"import {save} from '@/missing'; export function use(){save();}"}]);
  assert.equal(model.coverage.dependencies[0].status,'unresolved');
  assert.match(model.coverage.dependencies[0].reason,/Configured alias/);
  assert.equal(model.coverage.calls[0].status,'unresolved');
});

test('supporting files do not expose standalone component edges', () => {
  const model=analyzeFiles(fixture());
  const reexport=edgeDetails(model,'architecture','src/booking/index.ts','src/booking/service.ts');
  assert.equal(reexport,null);
  const types=edgeDetails(model,'architecture','src/booking/index.ts','src/booking/types.ts');
  assert.equal(types,null);
});

test('expanded graph lays out and serializes through history with functionless modules intact', () => {
  const model=analyzeFiles(fixture());
  assert.equal(layoutGraph(model.nodes,model.edges).length,model.nodes.length);
  const functions=functionItems(model,layers);
  assert.equal(functionLayout(functions,model.functionEdges).items.length,functions.length);
  assert.ok(systemGraph(model).items.length);
  const restored=validateHistory(history(model)).commits[0].model;
  assert.equal(restored.explanationEvidence,undefined);
  assert.equal(restored.coverage.calls.length,model.coverage.calls.length);
  assert.ok(restored.nodes.some(n=>n.id==='src/booking/types.ts'&&n.functionDetails.length===0));
  const delta=historyDelta(null,restored);
  assert.ok(delta.nodes.every(n=>n.status==='added'));
});

test('coverage import rejects malformed links and strips unrecognized source fields', () => {
  const model=analyzeFiles(fixture());
  const raw=structuredClone(model.coverage);raw.calls[0].raw='PRIVATE_SOURCE';raw.dependencies[0].source='PRIVATE_SOURCE';raw.counts.totalCalls=999;
  const clean=validateCoverage(raw,model);
  assert.ok(!JSON.stringify(clean).includes('PRIVATE_SOURCE'));
  assert.equal(clean.counts.totalCalls,clean.calls.length);
  for(const mutate of [c=>{c.calls[0].to='missing';c.calls[0].status='resolved';},c=>{c.calls[0].line=-1;},c=>{c.calls[0].from='missing';},c=>{c.dependencies[0].status='invalid';},c=>{c.callbackReferences[0].call='missing';}]){
    const value=structuredClone(model.coverage);mutate(value);assert.throws(()=>validateCoverage(value,model));
  }
  for(const metadata of [{moduleFeatures:'re-exports'},{componentRole:'unknown'}]){
    const invalid=structuredClone(model);Object.assign(invalid.nodes[0],metadata);
    assert.throws(()=>validateHistory(history(invalid)));
  }
});

test('coverage report scopes, paginates, and escapes imported labels', () => {
  const model=analyzeFiles(fixture());
  const scoped=coverageSummary(model.coverage,'src/main.ts','src/main.ts#submit:0');
  assert.equal(scoped.unresolvedCalls,1);
  assert.ok(scoped.calls.every(c=>c.from==='src/main.ts#submit:0'));
  const many=structuredClone(model);many.coverage.calls=Array.from({length:35},(_,i)=>({...model.coverage.calls.find(c=>c.status==='unresolved'),id:`call-${i}`,label:`<script>bad-${i}</script>`}));
  const first=coverageMarkup(many,{category:'unresolved'}).markup;
  const last=coverageMarkup(many,{category:'unresolved',page:1}).markup;
  assert.match(first,/Page 1 of 2/);assert.match(last,/Page 2 of 2/);
  assert.ok(!first.includes('<script>'));assert.ok(first.includes('&lt;script&gt;'));
  assert.equal((last.match(/<strong>/g)||[]).length,5);
  const focused={...model,nodes:model.nodes.filter(n=>n.id==='src/main.ts')};
  assert.ok(coverageMarkup(focused).markup.includes('value="src/booking/types.ts"'));
});
