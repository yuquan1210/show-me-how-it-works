import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles } from '../src/analyzer.js';
import { isAnalysisInput, isProjectConfig, isSource } from '../src/source-files.js';
import { jobContext } from '../src/explanations.js';

const config = (value, path = 'tsconfig.json') => ({path, text: JSON.stringify(value)});
const caller = {path: 'src/controller.ts', text: "import {save} from '@/store'; export function submit(){ return save(); }"};
const store = {path: 'src/store.ts', text: 'export function save(){return true;}'};

test('path aliases resolve component dependencies and actual function calls', () => {
  const model = analyzeFiles([config({compilerOptions: {baseUrl: '.', paths: {'@/*': ['src/*']}}}), caller, store]);
  assert.deepEqual(model.edges, [[caller.path, store.path]]);
  assert.deepEqual(model.functionEdges, [[`${caller.path}#submit:0`, `${store.path}#save:0`]]);
  assert.equal(model.fileCount, 2);
  assert.equal(model.nodes.length, 2);
  assert.deepEqual(model.analysisWarnings, []);
});

test('JSON comments, trailing commas, and local inheritance use the declaring config directory', () => {
  const model = analyzeFiles([
    {path: 'tsconfig.json', text: '{ // project settings\n "extends": "./config/tsconfig.base.json", }'},
    config({compilerOptions: {baseUrl: '..', paths: {'@/*': ['src/*']}}}, 'config/tsconfig.base.json'),
    caller, store,
  ]);
  assert.deepEqual(model.edges, [[caller.path, store.path]]);
  assert.equal(model.functionEdges.length, 1);
  assert.deepEqual(model.analysisWarnings, []);
});

test('nested configs resolve identical aliases independently of the root project', () => {
  const project = prefix => [
    config({compilerOptions: {baseUrl: '.', paths: {'@/*': ['src/*']}}}, prefix + 'tsconfig.json'),
    {...caller, path: prefix + caller.path}, {...store, path: prefix + store.path},
  ];
  const model = analyzeFiles([...project(''), ...project('packages/child/')]);
  assert.deepEqual(model.edges, [
    [caller.path, store.path],
    ['packages/child/src/controller.ts', 'packages/child/src/store.ts'],
  ]);
  assert.deepEqual(model.functionEdges, [
    ['src/controller.ts#submit:0', 'src/store.ts#save:0'],
    ['packages/child/src/controller.ts#submit:0', 'packages/child/src/store.ts#save:0'],
  ]);
});

test('jsconfig baseUrl imports resolve directory indexes in JavaScript projects', () => {
  const model = analyzeFiles([
    config({compilerOptions: {baseUrl: './src'}}, 'jsconfig.json'),
    {path: 'src/controller.js', text: "import {save} from 'storage'; export function submit(){return save();}"},
    {path: 'src/storage/index.js', text: 'export function save(){return true;}'},
  ]);
  assert.deepEqual(model.edges, [['src/controller.js', 'src/storage/index.js']]);
  assert.equal(model.functionEdges.length, 1);
});

test('paths without baseUrl use the config directory and try ordered fallback targets', () => {
  const model = analyzeFiles([
    config({compilerOptions: {paths: {'@/*': ['missing/*', 'src/*']}}}), caller, store,
  ]);
  assert.deepEqual(model.edges, [[caller.path, store.path]]);
  assert.equal(model.functionEdges.length, 1);
});

test('module resolution respects the configured strategy instead of always using bundler rules', () => {
  const files = [
    {path: 'src/controller.ts', text: "import {save} from './store'; export function submit(){return save();}"},
    {path: 'src/store/index.ts', text: store.text},
  ];
  const node = analyzeFiles([config({compilerOptions: {moduleResolution: 'node'}}), ...files]);
  const classic = analyzeFiles([config({compilerOptions: {moduleResolution: 'classic'}}), ...files]);
  assert.equal(node.functionEdges.length, 1);
  assert.equal(classic.functionEdges.length, 0);
  assert.deepEqual(classic.edges, []);
});

test('relative extension substitution resolves ESM and CommonJS TypeScript modules', () => {
  const model = analyzeFiles([
    {path: 'main.mts', text: "import {save} from './store.mjs'; export function run(){return save();}"},
    {path: 'store.mts', text: store.text},
    {path: 'other.cts', text: "import {save} from './store.cjs'; export function run(){return save();}"},
    {path: 'store.cts', text: store.text},
  ]);
  assert.deepEqual(model.edges, [['main.mts', 'store.mts'], ['other.cts', 'store.cts']]);
  assert.equal(model.functionEdges.length, 2);
});

test('alias imports include supporting types and state in AI evidence without config bodies', () => {
  const files = [
    config({compilerOptions: {paths: {'@/*': ['src/*']}}}),
    {path: 'src/controller.ts', text: "import type {Input} from '@/types'; export function submit(input:Input){return input.id;}"},
    {path: 'src/types.ts', text: 'export interface Input { id:string; }'},
  ];
  const model = analyzeFiles(files);
  const fn = model.nodes[0].functionDetails[0];
  const {context} = jobContext(model, {id: fn.id, title: fn.title, kind: 'function', members: [fn.parent], fn});
  assert.ok(context.environment.some(e => e.id === 'src/types.ts' && e.source.includes('interface Input')));
  assert.ok(!JSON.stringify(context).includes('compilerOptions'));
});

test('changing an alias target invalidates explanation evidence for unchanged caller source', () => {
  const files = [caller, store, {path: 'alternative/store.ts', text: 'export function save(){return false;}'}];
  const revision = target => {
    const model = analyzeFiles([config({compilerOptions: {paths: {'@/*': [target]}}}), ...files]);
    const fn = model.nodes.find(n => n.id === caller.path).functionDetails[0];
    return jobContext(model, {id: fn.id, title: fn.title, kind: 'function', members: [fn.parent], fn}).revision;
  };
  assert.notEqual(revision('src/*'), revision('alternative/*'));
});

test('invalid and unavailable inherited configs warn without preventing relative analysis', () => {
  const relative = {...caller, text: caller.text.replace("@/store", './store')};
  for (const text of ['{"compilerOptions":', '{"extends":"./tsconfig.missing.json"}', '{"extends":"external-config"}', '{"compilerOptions":{"moduleResolution":"invalid"}}']) {
    const model = analyzeFiles([{path: 'tsconfig.json', text}, relative, store]);
    assert.ok(model.analysisWarnings.length, text);
    assert.equal(model.functionEdges.length, 1, text);
    assert.equal(model.nodes.length, 2);
  }
});

test('config inheritance cycles warn and do not hang analysis', () => {
  const model = analyzeFiles([
    config({extends: './tsconfig.base.json'}),
    config({extends: './tsconfig.json'}, 'tsconfig.base.json'), store,
  ]);
  assert.ok(model.analysisWarnings.length);
  assert.equal(model.nodes.length, 1);
});

test('unresolved aliases never connect to unrelated functions with the same name', () => {
  const model = analyzeFiles([caller, store]);
  assert.deepEqual(model.edges, []);
  assert.deepEqual(model.functionEdges, []);
});

test('only recognized compiler configs enter the analysis snapshot and never become source nodes', () => {
  for (const path of ['tsconfig.json', 'config/tsconfig.base.json', 'web/jsconfig.json']) {
    assert.equal(isProjectConfig(path), true);
    assert.equal(isAnalysisInput(path), true);
    assert.equal(isSource(path), false);
  }
  for (const path of ['package.json', 'secrets.json', 'node_modules/pkg/tsconfig.json', 'dist/tsconfig.json']) {
    assert.equal(isAnalysisInput(path), false);
  }
});

test('solution-style references select settings by TypeScript include/exclude and files membership', () => {
  const model = analyzeFiles([
    config({files: [], references: [{path: './tsconfig.app.json'}, {path: './tsconfig.tools.json'}]}),
    config({compilerOptions: {paths: {'@/*': ['src/*']}}, include: ['src/**/*.ts'], exclude: ['src/tools/**']}, 'tsconfig.app.json'),
    config({compilerOptions: {paths: {'@/*': ['src/tools/*']}}, files: ['src/tools/main.ts', 'src/tools/store.ts']}, 'tsconfig.tools.json'),
    {...caller, path:'src/main.ts'}, store,
    {...caller, path:'src/tools/main.ts'}, {...store, path:'src/tools/store.ts'},
  ]);
  assert.deepEqual(model.edges,[['src/main.ts','src/store.ts'],['src/tools/main.ts','src/tools/store.ts']]);
  assert.equal(model.functionEdges.length,2);
  assert.deepEqual(model.analysisWarnings,[]);
});

test('referenced projects follow local inherited membership and transitive directory references', () => {
  const model = analyzeFiles([
    config({files:[],references:[{path:'./config'}]}),
    config({files:[],references:[{path:'./tsconfig.app.json'}]},'config/tsconfig.json'),
    config({extends:'./tsconfig.base.json'},'config/tsconfig.app.json'),
    config({compilerOptions:{baseUrl:'..',paths:{'@/*':['src/*']}},include:['../src']},'config/tsconfig.base.json'),
    caller,store,
  ]);
  assert.deepEqual(model.edges,[[caller.path,store.path]]);
  assert.deepEqual(model.analysisWarnings,[]);
});

test('overlapping referenced projects warn and do not arbitrarily select an alias target', () => {
  const model = analyzeFiles([
    config({files:[],references:[{path:'./tsconfig.first.json'},{path:'./tsconfig.second.json'}]}),
    config({compilerOptions:{paths:{'@/*':['src/*']}},include:['src']},'tsconfig.first.json'),
    config({compilerOptions:{paths:{'@/*':['alternative/*']}},include:['src']},'tsconfig.second.json'),
    caller,store,{...store,path:'alternative/store.ts'},
  ]);
  assert.ok(model.analysisWarnings.some(w=>/multiple referenced projects/.test(w)));
  assert.deepEqual(model.edges,[]);
  assert.deepEqual(model.functionEdges,[]);
});

test('missing and circular project references warn without hanging or reading outside the snapshot', () => {
  const model=analyzeFiles([
    config({files:[],references:[{path:'./tsconfig.child.json'},{path:'../outside'}]}),
    config({files:[],references:[{path:'./tsconfig.json'}]},'tsconfig.child.json'),store,
  ]);
  assert.ok(model.analysisWarnings.some(w=>/circular project references/.test(w)));
  assert.ok(model.analysisWarnings.some(w=>/configuration is missing/.test(w)));
  assert.equal(model.nodes.length,1);
});
