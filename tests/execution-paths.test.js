import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {analyzeFiles} from '../src/analyzer.js';
import {validateHistory} from '../src/history.js';
const root=new URL('../examples/ticket-reservations/src/',import.meta.url);
const files=readdirSync(root).filter(p=>p.endsWith('.ts')).map(p=>({path:p,text:readFileSync(new URL(p,root),'utf8')}));
const model=analyzeFiles(files);
const fn=name=>model.nodes.flatMap(n=>n.functionDetails).find(f=>f.name===name);
async function runtime(run){
  const dir=mkdtempSync(join(tmpdir(),'reservation-paths-'));
  try{
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    for(const file of files)writeFileSync(join(dir,file.path.replace('.ts','.js')),ts.transpileModule(file.text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
    const load=name=>import(pathToFileURL(join(dir,name+'.js')).href);
    await run({pricing:await load('pricing.service'),booking:await load('booking.service'),repository:await load('reservation.repository'),payment:await load('payment.service')});
  }finally{rmSync(dir,{recursive:true,force:true});}
}
const request={requestId:'one',email:'a@b',seats:2,paymentToken:'ok'};
test('pricing structure retains arithmetic, threshold, exact coupon and early unclamped return',async()=>{
  const pricing=fn('calculateTotal');
  assert.match(pricing.decisions.join(' '),/2500/);assert.match(pricing.decisions.join(' '),/at least 4.*0.9.*rounded/);
  assert.deepEqual(pricing.outputs,['group price','the greater of 0 and group price minus 500']);
  assert.match(pricing.decisions.join(' '),/does not exactly equal “WELCOME”/);
  await runtime(async({pricing:p})=>{
    assert.equal(p.calculateTotal(3),7500);assert.equal(p.calculateTotal(4),9000);assert.equal(p.calculateTotal(4,'WELCOME'),8500);
    assert.equal(p.calculateTotal(-1),-2500);assert.equal(p.calculateTotal(-1,'WELCOME'),0);
    assert.throws(()=>p.calculateTotal(1,'welcome'),/Unknown coupon/);
  });
});
test('duplicate return precedes charging and saving in structure and executable example',async()=>{
  const steps=fn('book').behavior.steps;
  assert.equal(steps.find(s=>s.kind==='branch').children[0].kind,'return');
  assert.ok(steps.findIndex(s=>s.kind==='branch')<steps.findIndex(s=>s.kind==='try'));
  await runtime(async({booking,repository})=>{
    const first=await booking.book(request),second=await booking.book({...request,paymentToken:'declined',seats:20,coupon:'bad'});
    assert.deepEqual(second,first);repository.takeSeats(10);assert.throws(()=>repository.takeSeats(1),/Not enough seats/);
  });
});
test('charge failure catch releases seats and rethrows; pricing errors are outside that catch',async()=>{
  const path=fn('book').behavior.steps,protectedBlock=path.find(s=>s.kind==='try');
  assert.ok(protectedBlock.children.some(s=>s.label==='Await charge'));
  assert.deepEqual(protectedBlock.failure.map(s=>s.kind),['call','throw']);
  assert.ok(path.findIndex(s=>s.label==='Call calculate total')<path.indexOf(protectedBlock));
  assert.equal(fn('book').failures.length,1);assert.match(fn('book').failures[0],/await charge fails.*release seats.*error/);
  await runtime(async({booking,repository})=>{
    await assert.rejects(booking.book({...request,paymentToken:'declined'}),/Payment declined/);
    await assert.rejects(booking.book({...request,coupon:'BAD'}),/Unknown coupon/);
    repository.takeSeats(12);assert.throws(()=>repository.takeSeats(1),/Not enough seats/);
  });
});
test('cancellation awaits refund before release and save; failed refund skips both',async()=>{
  const steps=fn('cancel').behavior.steps;
  assert.ok(steps.findIndex(s=>s.label==='Await refund')<steps.findIndex(s=>s.label==='Call release seats'));
  assert.match(fn('cancel').failures.join(' '),/refund fails.*release seats.*save.*skipped/);
  await runtime(async({booking,repository,payment})=>{
    const first=await booking.book(request);await payment.refund(first.paymentId);
    await assert.rejects(booking.cancel(first.id,first.email),/Payment not found/);
    assert.equal(repository.findById(first.id).status,'confirmed');assert.throws(()=>repository.takeSeats(11),/Not enough seats/);
  });
});
test('finally and unsupported control flow remain explicit; nested callbacks stay separate',()=>{
  const m=analyzeFiles([{path:'a.ts',text:'export async function run(){try {await work();} catch(error){recover();throw error;} finally {finish();}for(const x of xs){visit(x);}setTimeout(()=>hidden(),1);}'}]);
  const f=m.nodes[0].functionDetails.find(f=>f.name==='run');
  assert.match(f.failures.join(' '),/Finally.*finish.*replace/);assert.match(f.limitations.join(' '),/Loop/);
  assert.ok(!JSON.stringify(f.behavior).includes('hidden'));assert.ok(f.behavior.steps.some(s=>s.kind==='unknown'));
});
test('history validates execution-path references and strips unrecognized evidence fields',()=>{
  const history={format:'show-me-history',version:1,name:'test',commits:[{sha:'a',date:'2026-01-01',message:'a',model}]};
  const copy=structuredClone(history);copy.commits[0].model.nodes[0].functionDetails[0].behavior.raw='secret source';
  assert.ok(!JSON.stringify(validateHistory(copy)).includes('secret source'));
  const bad=structuredClone(history),behavior=bad.commits[0].model.nodes[0].functionDetails[0].behavior;
  behavior.steps.push({kind:'call',label:'fake',target:'absent',line:1,column:1,conditions:[],region:'normal',awaited:false,effect:false});
  assert.throws(()=>validateHistory(bad),/execution-path/);
});

test('connection explanations distinguish protected charge from unprotected pricing and refund',async()=>{
  const {edgeDetails}=await import('../src/edge-details.js');
  const charge=edgeDetails(model,'functions',fn('book').id,fn('charge').id);
  assert.match(charge.failures.join(' '),/release seats/);
  const pricing=edgeDetails(model,'functions',fn('book').id,fn('calculateTotal').id);
  assert.match(pricing.failures.join(' '),/No local catch/);assert.ok(!pricing.failures.join(' ').includes('release seats'));
  const refund=edgeDetails(model,'functions',fn('cancel').id,fn('refund').id);
  assert.match(refund.conditions.join(' '),/awaits completion/);
  assert.match(refund.failures.join(' '),/Later.*release seats.*save/);
});

test('a returned promise inside try is not described as having rejection recovery',async()=>{
  const {callPaths}=await import('../src/call-paths.js');
  const m=analyzeFiles([{path:'a.ts',text:'async function charge(){throw new Error("declined");}export function start(){try{return charge();}catch(error){cleanup();}}'}]);
  const [charge,start]=m.nodes[0].functionDetails;
  assert.match(callPaths(start,charge.id)[0].recovery,/not awaited/);
  assert.match(start.failures.join(' '),/unawaited promise rejections may escape/);
});

test('short-circuit and ternary effects retain conditions without inventing concurrency',()=>{
  const m=analyzeFiles([{path:'a.ts',text:'export function run(enabled){enabled && save();const value=enabled?charge():refund();return value;}function save(){}function charge(){}function refund(){}'}]);
  const f=m.nodes[0].functionDetails[0];
  assert.match(f.effects.join(' '),/save when enabled is truthy/);
  assert.match(f.effects.join(' '),/charge when enabled/);assert.match(f.effects.join(' '),/refund when otherwise: enabled/);
  assert.deepEqual(f.limitations,[]);
});

test('empty catches suppress propagation and finally-only blocks retain cleanup on connections',async()=>{
  const {callPaths}=await import('../src/call-paths.js');
  const m=analyzeFiles([{path:'a.ts',text:'function work(){}function finish(){}export function handled(){try{work();}catch{}}export function cleaned(){try{work();}finally{finish();}}'}]);
  const [work,finish,handled,cleaned]=m.nodes[0].functionDetails;
  assert.match(handled.failures.join(' '),/caught without explicit recovery/);
  assert.ok(!handled.failures.join(' ').includes('No catch'));
  assert.match(callPaths(handled,work.id)[0].recovery,/caught without explicit recovery/);
  const path=callPaths(cleaned,work.id)[0];assert.match(path.recovery,/No local catch/);assert.match(path.cleanup,/finish/);
});
