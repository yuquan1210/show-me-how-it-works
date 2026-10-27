import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeFiles} from '../src/analyzer.js';
import {scopeWorkflowModel} from '../src/workflows.js';
const analyze=text=>analyzeFiles([{path:'routes.ts',text}]);
const http=model=>model.workflows.filter(w=>w.trigger.kind==='http');
test('Express registrations expose named and inline operations without fake invocation edges',()=>{
  const model=analyze(`import express from 'express';const app=express();function list(req,res){return read();}function read(){return 1;}app.get('/orders',list);app.post('/orders',(req,res)=>save());function save(){return 2;}`);
  assert.deepEqual(http(model).map(w=>w.name),['GET /orders','POST /orders']);
  const get=http(model)[0];assert.equal(get.functionIds.length,2);
  assert.ok(get.functionIds.some(id=>id.includes('#read:')));
  assert.ok(!get.functionIds.some(id=>id.includes('#save:')));
  assert.ok(!model.functionEdges.some(([from,to])=>from==='routes.ts'&&to===get.entryFunctionId));
  assert.equal(scopeWorkflowModel(model,get).nodes[0].functionDetails.length,2);
});
test('Express Router import aliases, local imports, mounting prefixes and route chaining are recognized',()=>{
  const model=analyzeFiles([
    {path:'app.ts',text:"import express from 'express';import {router} from './router';const app=express();app.use('/v1',router);"},
    {path:'router.ts',text:"import {Router as makeRouter} from 'express';export const router=makeRouter();const alias=router;alias.route('/bookings').get((req,res)=>1).post((req,res)=>2);"},
  ]);
  assert.deepEqual(http(model).map(w=>w.name),['GET /v1/bookings','POST /v1/bookings']);
  assert.ok(http(model).every(w=>!w.uncertain));
});
test('CommonJS Express and middleware references preserve separate registered roots',()=>{
  const model=analyze(`const express=require('express');const app=express();function auth(req,res,next){next();}function result(req,res){return 1;}app.get('/a',auth,result);`);
  const [workflow]=http(model);assert.ok(workflow);assert.equal(workflow.entryFunctions.length,2);
  assert.ok(!model.functionEdges.some(([a,b])=>a.includes('#auth:')&&b.includes('#result:')));
});
test('name matching, shadowed imports and mutable receivers do not invent routes',()=>{
  for(const source of [
    "const app={get(){}};app.get('/x',()=>1);",
    "import express from 'other-package';const app=express();app.get('/x',()=>1);",
    "import express from 'express';function configure(express){const app=express();app.get('/x',()=>1);}",
    "import express from 'express';let app=express();app=other;app.get('/x',()=>1);",
    "function require(name){return other;}const express=require('express');const app=express();app.get('/x',()=>1);",
  ])assert.equal(http(analyze(source)).length,0);
});
test('computed paths and unknown dispatch produce warnings, partial middleware remains uncertain',()=>{
  const model=analyze(`import express from 'express';const app=express();app.get(path,()=>1);app.post('/missing',unknown);app.put('/partial',unknown,()=>1);app.get('setting');`);
  assert.deepEqual(http(model).map(w=>w.name),['PUT /partial']);
  assert.equal(http(model)[0].uncertain,true);assert.equal(model.analysisWarnings.length,2);
});
test('unmounted routers and duplicate route registrations do not claim unique verified routing',()=>{
  const model=analyze(`import {Router} from 'express';const router=Router();router.get('/x',()=>1);router.get('/x',()=>2);`);
  assert.equal(http(model).length,2);assert.notEqual(http(model)[0].id,http(model)[1].id);
  assert.ok(http(model).every(w=>w.uncertain));
});

test('computed mounting prefixes never become invented complete route URLs',()=>{
  const model=analyze(`import express from 'express';const app=express();const router=express.Router();router.get('/x',()=>1);app.use(prefix,router);`);
  assert.equal(http(model).length,0);assert.match(model.analysisWarnings.join(' '),/mount path/);
});

test('duplicate mounts keep unique workflow IDs; mount cycles do not invent full URLs',()=>{
  const duplicated=analyze(`import express from 'express';const app=express();const router=express.Router();router.get('/x',()=>1);app.use('/v1',router);app.use('/v1',router);`);
  assert.equal(http(duplicated).length,1);assert.equal(http(duplicated)[0].uncertain,true);
  const cycle=analyze(`import express from 'express';const a=express.Router();const b=express.Router();a.use('/a',b);b.use('/b',a);a.get('/x',()=>1);`);
  assert.equal(http(cycle).length,0);assert.match(cycle.analysisWarnings.join(' '),/mount path/);
});
