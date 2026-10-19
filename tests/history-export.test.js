import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

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
