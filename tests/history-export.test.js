import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateHistory } from '../src/history.js';

test('history export omits module declarations as well as function source',()=>{
  const directory=mkdtempSync(join(tmpdir(),'smhiw-history-evidence-'));
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'});
  try {
    git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
    writeFileSync(join(directory,'store.ts'),'const storageMarker = "PRIVATE_SOURCE_MARKER"; export function read(){return storageMarker;}');
    git('add','store.ts');git('commit','-m','Create fixture');
    const output=join(directory,'history.json');
    execFileSync(process.execPath,[new URL('../scripts/export-history.mjs',import.meta.url).pathname,directory,output],{stdio:'pipe'});
    const text=readFileSync(output,'utf8'),model=JSON.parse(text).commits[0].model;
    assert.equal(model.explanationEvidence,undefined);
    assert.equal(model.nodes[0].functionDetails[0].raw,undefined);
    assert.ok(!text.includes('PRIVATE_SOURCE_MARKER'));
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('history uses each commit config to resolve aliases without exporting configuration source',()=>{
  const directory=mkdtempSync(join(tmpdir(),'smhiw-history-config-'));
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'});
  try {
    git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
    mkdirSync(join(directory,'src'));mkdirSync(join(directory,'alternative'));
    writeFileSync(join(directory,'src/controller.ts'),"import {save} from '@/store'; export function submit(){return save();}");
    writeFileSync(join(directory,'src/store.ts'),'export function save(){return true;}');
    writeFileSync(join(directory,'alternative/store.ts'),'export function save(){return false;}');
    const settings=target=>JSON.stringify({compilerOptions:{paths:{'@/*':[target]}},privateMarker:'PRIVATE_CONFIG_MARKER'});
    writeFileSync(join(directory,'tsconfig.json'),settings('src/*'));
    git('add','.');git('commit','-m','Use original store');
    writeFileSync(join(directory,'tsconfig.json'),settings('alternative/*'));
    git('add','.');git('commit','-m','Change alias target');
    const output=join(directory,'history.json');
    execFileSync(process.execPath,[new URL('../scripts/export-history.mjs',import.meta.url).pathname,directory,output],{stdio:'pipe'});
    const text=readFileSync(output,'utf8'),history=JSON.parse(text);
    assert.deepEqual(history.commits[0].model.edges,[['src/controller.ts','src/store.ts']]);
    assert.deepEqual(history.commits[1].model.edges,[['src/controller.ts','alternative/store.ts']]);
    assert.deepEqual(history.commits[1].model.functionEdges,[['src/controller.ts#submit:0','alternative/store.ts#save:0']]);
    for(const {model} of history.commits){
      assert.equal(model.fileCount,3);
      assert.equal(model.explanationEvidence,undefined);
      assert.ok(!model.nodes.some(n=>n.id==='tsconfig.json'));
    }
    assert.ok(!text.includes('PRIVATE_CONFIG_MARKER'));
    assert.ok(!text.includes('compilerOptions'));
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('history exports the coverage fixture with retained modules and no source bodies',()=>{
  const directory=mkdtempSync(join(tmpdir(),'smhiw-history-coverage-'));
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'});
  try {
    cpSync(new URL('../examples/analysis-coverage/',import.meta.url),directory,{recursive:true});
    writeFileSync(join(directory,'src/private-state.ts'),'export const secret = "PRIVATE_MODULE_ONLY_MARKER";');
    git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
    git('add','.');git('commit','-m','Create coverage fixture');
    const output=join(directory,'history.json');
    execFileSync(process.execPath,[new URL('../scripts/export-history.mjs',import.meta.url).pathname,directory,output],{stdio:'pipe'});
    const text=readFileSync(output,'utf8'),model=validateHistory(JSON.parse(text)).commits[0].model;
    assert.equal(model.nodes.find(n=>n.id==='src/private-state.ts').functionDetails.length,0);
    assert.ok(model.coverage.callbackReferences.length);
    assert.ok(model.coverage.calls.some(c=>c.label==='charge'&&c.status==='external'));
    assert.ok(model.coverage.dependencies.some(d=>d.kind==='re-export'));
    assert.equal(model.explanationEvidence,undefined);
    assert.ok(!text.includes('PRIVATE_MODULE_ONLY_MARKER'));
    assert.ok(!text.includes('moduleSource'));
    assert.ok(!text.includes('return booking;'));
    assert.ok(model.nodes.flatMap(n=>n.functionDetails).every(f=>!Object.hasOwn(f,'raw')));
  } finally {rmSync(directory,{recursive:true,force:true});}
});
