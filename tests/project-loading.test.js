import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {allExplanationsReady, explanationJobs, jobContext, ExplanationQueue, CARD_FIELDS} from '../src/explanations.js';
import {sourceSignature,orderedFiles} from '../src/project-revision.js';
import {systemGraph} from '../src/graph-layout.js';
import {analyzeFiles} from '../src/analyzer.js';
test('reordered folder scans preserve sample explanation contexts and the source signature',async()=>{
  const root=new URL('../examples/ticket-reservations/src/',import.meta.url);
  const files=fs.readdirSync(root).filter(p=>p.endsWith('.ts')).map(path=>({path,text:fs.readFileSync(new URL(path,root),'utf8')}));
  assert.equal(sourceSignature(files),sourceSignature([...files].reverse()));
  const a=analyzeFiles(orderedFiles(files),'sample'),b=analyzeFiles(orderedFiles([...files].reverse()),'sample');
  const jobs=explanationJobs(a,systemGraph(a).items),other=explanationJobs(b,systemGraph(b).items);
  for(const job of jobs)assert.equal(jobContext(a,job).revision,jobContext(b,other.find(j=>j.id===job.id)).revision);
  b.nodes.reverse();b.edges.reverse();b.functionEdges.reverse();
  for(const job of jobs)assert.equal(jobContext(a,job).revision,jobContext(b,job).revision);
  const edited=files.map((f,i)=>i===0?{...f,text:f.text+'\n'}:f);
  assert.notEqual(sourceSignature(files),sourceSignature(edited));
});
test('preparing a changed revision does not automatically start provider requests',async()=>{
  let calls=0;const card=Object.fromEntries(CARD_FIELDS.map(k=>[k,'Not established']));
  const q=new ExplanationQueue({request:async()=>{calls++;return card;}});
  const model=analyzeFiles([{path:'example.ts',text:'export function read(){ return 1; }'}],'sample');
  await q.setProject(model,explanationJobs(model),{});
  assert.equal(q.enabled,false);assert.equal(calls,0);
});

test('project gate requires a valid ready card for every job, never errors or stale cards',()=>{
  const queue={jobs:[{id:'a'},{id:'b'}],states:new Map([['a',{status:'ready',card:{}}]])};
  assert.equal(allExplanationsReady(queue),false);
  for(const state of [{status:'loading'},{status:'error'},{status:'ready',card:{},stale:true},{status:'ready'}]){
    queue.states.set('b',state);assert.equal(allExplanationsReady(queue),false);
  }
  queue.states.set('b',{status:'ready',card:{}});assert.equal(allExplanationsReady(queue),true);
  assert.equal(allExplanationsReady({jobs:[],states:new Map()}),false);
});
test('sample source is comment-free and maps multiple connected components',()=>{
  const root=new URL('../examples/ticket-reservations/src/',import.meta.url);
  const files=fs.readdirSync(root).filter(p=>p.endsWith('.ts')).map(path=>({path,text:fs.readFileSync(new URL(path,root),'utf8')}));
  for(const file of files){
    const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,file.text);
    for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())assert.ok(token!==ts.SyntaxKind.SingleLineCommentTrivia&&token!==ts.SyntaxKind.MultiLineCommentTrivia,file.path);
  }
  const model=analyzeFiles(files,'Ticket reservations');
  assert.ok(model.nodes.length>=5);assert.ok(model.edges.length>=4);
});
