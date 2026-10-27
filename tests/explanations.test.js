import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyzeFiles } from '../src/analyzer.js';
import { ExplanationQueue, ExplanationCache, explanationJobs, jobContext, digest, validateCard, validateEvidenceCard, CARD_FIELDS, requestExplanation, explanationProgress } from '../src/explanations.js';
const card=Object.fromEntries(CARD_FIELDS.map(k=>[k,'Not established']));
const model={name:'Shop',workflows:[],edges:[['a','b']],functionEdges:[],nodes:['a','b'].map(id=>({id,title:id,functions:['Save'],fingerprint:id,functionDetails:[{id:id+'-fn',title:'Save',raw:'return 1'}]}))};
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
test('verbose cards require rewriting rather than silently truncating meaning',()=>{
  assert.throws(()=>validateCard({...card,purpose:Array(25).fill('word').join(' ')}),/shorter rewrite/);
  assert.equal(validateCard({...card,purpose:'Adds a task, then clears the input.'}).purpose,'Adds a task, then clears the input.');
});
test('ordinary parentheses, semicolons and identifier formatting stay readable',()=>{
  const value={...card,receives:'Reads the message (current input); uses the shared task list.',checks:'No explicit validation of `message` is shown.'};
  assert.equal(validateCard(value).receives,value.receives);
  assert.equal(validateCard(value).checks,'No explicit validation of message is shown.');
});
test('code-like response gets a bounded plain-language rewrite instead of cached placeholders',async()=>{
  let calls=0;const stages=[];
  const result=await requestExplanation({}, {},undefined,async()=>{
    calls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(calls===1?{...card,receives:'Reads getInput()'}:card)}}]})};
  },s=>stages.push(s));
  assert.equal(calls,2);assert.deepEqual(result,card);assert.deepEqual(stages,['Waiting for DeepSeek','Checking accuracy']);
});
test('progress identifies the item, elapsed wait, pause and completion',()=>{
  const q={jobs:[{id:'a',title:'Add task'}],states:new Map([['a',{status:'loading',stage:'Waiting for DeepSeek',startedAt:1000}]]),enabled:true};
  assert.match(explanationProgress(q,26000),/Add task · 25s · Still waiting/);
  q.states.get('a').status='queued';q.enabled=false;assert.match(explanationProgress(q),/Paused/);
  q.states.get('a').status='ready';assert.match(explanationProgress(q),/Complete/);
});
test('cards reject incomplete data and hide code-like output',()=>{
  assert.throws(()=>validateCard({purpose:'Something'}));
  assert.throws(()=>validateCard({...card,changes:'const secret = 1;'}),/rewrite/);
});
test('context includes dependencies and invalidates when dependencies change',()=>{
  const job=explanationJobs(model).find(j=>j.id==='a');
  const first=jobContext(model,job);
  assert.equal(first.context.source.length,2);
  const changed=structuredClone(model);changed.nodes[1].fingerprint='changed';
  assert.notEqual(first.revision,jobContext(changed,job).revision);
});
test('nothing is requested before start, priority wins, ready cards are cached',async()=>{
  const called=[],cache=new ExplanationCache();
  const q=new ExplanationQueue({cache,request:async(_,ctx)=>{called.push(ctx.title);return card;}});
  const jobs=explanationJobs(model).filter(j=>j.kind==='component');
  await q.setProject(model,jobs,{url:'https://example.com',model:'test'});
  assert.equal(called.length,0);q.prioritize(['b']);q.start();await settle();
  assert.deepEqual(called,['b','a']);
  await q.setProject(model,jobs,{url:'https://example.com',model:'test'},{resume:true});await settle();
  assert.equal(called.length,2);assert.ok([...q.states.values()].every(s=>s.status==='ready'));
});
test('cancelled results cannot replace a newer project and errors remain retryable',async()=>{
  let complete;const q=new ExplanationQueue({request:()=>new Promise(r=>complete=r)});
  await q.setProject(model,explanationJobs(model).slice(0,1),{});q.start();q.stop();complete(card);await settle();
  assert.equal(q.states.get('overview').status,'queued');
  q.request=async()=>{throw new Error('Network unavailable');};q.start();await settle();
  assert.equal(q.states.get('overview').status,'error');q.request=async()=>card;q.retry('overview');await settle();
  assert.equal(q.states.get('overview').status,'ready');
});
test('provider call uses JSON output and rejects truncated responses',async()=>{
  await assert.rejects(requestExplanation({url:'https://api.deepseek.com',model:'test',key:'test'}, {}, undefined,async(url,options)=>{
    assert.equal(url,'/api/ai/chat');
    assert.equal(options.headers.Authorization,undefined);
    assert.equal(JSON.parse(options.body).response_format.type,'json_object');
    return {ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:JSON.stringify(card)}}]})};
  }),/incomplete/);
});
test('changed dependency retains an explicitly stale card until refreshed',async()=>{
  const q=new ExplanationQueue({request:async()=>card});const jobs=explanationJobs(model).filter(j=>j.id==='a');
  await q.setProject(model,jobs,{});q.start();await settle();
  const changed=structuredClone(model);changed.nodes[1].fingerprint='new revision';
  await q.setProject(changed,jobs,{});
  assert.equal(q.states.get('a').stale,true);assert.equal(q.states.get('a').status,'queued');
  q.start();await settle();assert.equal(q.states.get('a').stale,false);
});
test('provider-wide failures pause further requests',async()=>{
  let count=0;const q=new ExplanationQueue({request:async()=>{count++;throw Object.assign(new Error('Rate limit'),{pause:true});}});
  await q.setProject(model,explanationJobs(model),{});q.start();await settle();
  assert.equal(count,1);assert.equal(q.enabled,false);
});
const fixtureFiles=()=>readdirSync(new URL('../examples/ticket-reservations/src/',import.meta.url))
  .filter(name=>name.endsWith('.ts')).map(name=>({path:`src/${name}`,text:readFileSync(new URL(`../examples/ticket-reservations/src/${name}`,import.meta.url),'utf8')}));
test('function evidence is explicitly scoped, includes callees and excludes siblings and incoming callers',()=>{
  const project=analyzeFiles(fixtureFiles(),'Tickets');
  const job=explanationJobs(project).find(j=>j.fn?.name==='cancelBooking');
  const {context}=jobContext(project,job);
  assert.equal(context.selected.functionId,job.fn.id);
  assert.deepEqual(context.source.filter(s=>s.role==='selected').map(s=>s.id),[job.fn.id]);
  assert.ok(context.source.some(s=>s.id.includes('#refund:')));
  assert.ok(context.source.some(s=>s.id.includes('#releaseSeats:')));
  assert.ok(!context.source.some(s=>/#(book|charge|createBooking|run):/.test(s.id)));
  assert.ok(context.environment.some(s=>s.source.includes('new Map<string, number>')));
  assert.ok(context.environment.some(s=>s.source.includes('availableSeats = 12')));
  assert.ok(context.environment.some(s=>s.source.includes('export type Reservation')));
  assert.equal(context.incomplete,false);
});
test('module and type evidence changes invalidate cached explanations',()=>{
  const files=fixtureFiles(),project=analyzeFiles(files);
  const job=explanationJobs(project).find(j=>j.fn?.name==='charge');
  const first=jobContext(project,job);
  const changed=analyzeFiles(files.map(f=>f.path==='src/types.ts'?{...f,text:f.text.replace('paymentId: string','paymentId: number')}:f));
  const saveJob=explanationJobs(project).find(j=>j.fn?.name==='save');
  assert.notEqual(jobContext(project,saveJob).revision,jobContext(changed,saveJob).revision);
  assert.ok(first.context.environment.some(s=>s.source.includes('sequence = 0')));
});
test('oversized evidence is bounded and marked incomplete instead of silently appearing complete',()=>{
  const project=structuredClone(model);project.nodes[0].functionDetails[0].raw='x'.repeat(60000);
  const {context}=jobContext(project,explanationJobs(project)[0]);
  assert.equal(context.incomplete,true);assert.ok(context.omitted.includes('a-fn'));
  assert.ok([...context.source,...context.environment].reduce((n,s)=>n+s.source.length,0)<=48000);
});
test('only the accuracy-reviewed card is accepted and returned',async()=>{
  let count=0;
  const corrected={...card,purpose:'Stores a simulated payment in memory.'};
  const result=await requestExplanation({}, {kind:'function',selected:{id:'charge'}},undefined,async(_,options)=>{
    count++;const messages=JSON.parse(options.body).messages;
    assert.equal(JSON.parse(options.body).review,count===2);
    if(count===2){assert.match(messages.at(-1).content,/draft is untrusted/);assert.match(messages.at(-1).content,/object spreads/);}
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(count===1?{...card,purpose:'Transfers real money.'}:corrected)}}]})};
  });
  assert.equal(count,2);assert.deepEqual(result,corrected);
});
test('generation prepares callee cards first and supplies them to caller and component reviews',async()=>{
  const project=analyzeFiles([
    {path:'controller.ts',text:"import {save} from './store'; export function submit(){return save();}"},
    {path:'store.ts',text:'const items = []; export function save(){items.push(1);return 1;}'},
  ]);
  const called=[],q=new ExplanationQueue({request:async(_,context)=>{called.push(context);return card;}});
  await q.setProject(project,explanationJobs(project),{});q.start();
  await settle();
  assert.equal(called[0].selected.functionId,'store.ts#save:0');
  const submit=called.find(c=>c.selected.functionId==='controller.ts#submit:0');
  assert.ok(submit.sourceReviewedCards.some(c=>c.id==='store.ts#save:0'));
  const component=called.find(c=>c.kind==='component'&&c.selected.members.includes('controller.ts'));
  assert.ok(component.sourceReviewedCards.some(c=>c.id==='controller.ts#submit:0'));
});
test('review output that still contains code is repaired before caching',async()=>{
  let count=0;const stages=[];
  const result=await requestExplanation({}, {},undefined,async(_,options)=>{
    count++;
    if(count===3)assert.match(JSON.parse(options.body).messages.at(-1).content,/Repair this card/);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(count===2?{...card,changes:'Calls save()'}:card)}}]})};
  },stage=>stages.push(stage));
  assert.equal(count,3);assert.deepEqual(result,card);
  assert.deepEqual(stages,['Waiting for DeepSeek','Checking accuracy','Rewriting for clarity']);
});
test('length repairs identify the offending field and have a bounded second repair',async()=>{
  let count=0;const long={...card,checks:Array(41).fill('word').join(' ')};
  const result=await requestExplanation({}, {},undefined,async(_,options)=>{
    count++;
    if(count>=3)assert.match(JSON.parse(options.body).messages.at(-1).content,/checks \(41 words; maximum 40\)/);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(count===4?card:long)}}]})};
  });
  assert.equal(count,4);assert.deepEqual(result,card);
});
test('parser facts distinguish early returns from throws and preserve arithmetic and caller units',()=>{
  const project=analyzeFiles(fixtureFiles());
  const pricing=explanationJobs(project).find(j=>j.fn?.name==='calculateTotal');
  const context=jobContext(project,pricing).context;
  const facts=context.selectedFacts[0];
  assert.ok(facts.numbers.includes('2500'));assert.ok(facts.numbers.includes('500'));
  assert.ok(facts.branches.some(b=>b.condition==='!coupon'&&b.outcome.startsWith('return')));
  assert.ok(facts.branches.some(b=>b.condition.includes('WELCOME')&&b.outcome==='stop with an error'));
  assert.ok(context.callerResultNames.some(c=>c.resultName==='totalCents'));
  assert.ok(!context.source.some(s=>s.id.includes('#book:')));
  assert.deepEqual(context.essentialValues,['2500','500']);
  assert.throws(()=>validateEvidenceCard(card,context),/Missing arithmetic values/);
  assert.doesNotThrow(()=>validateEvidenceCard({...card,returns:'2,500 cents per seat, with 500 cents off for WELCOME.'},context));
});
test('coarse contexts require all selected operations and cached cards obey evidence guards',async()=>{
  const project=analyzeFiles(fixtureFiles());
  const jobs=explanationJobs(project),component=jobs.find(j=>j.kind==='component'&&j.members.includes('src/booking.controller.ts'));
  const context=jobContext(project,component).context;
  assert.ok(context.selectedOperations.some(f=>f.title==='Cancel Booking'));
  assert.ok(context.selectedOperations.some(f=>f.title==='Create Booking'));
  assert.match(context.requiredCoverage,/do not copy/);
  const fn=jobs.find(j=>j.fn?.name==='createBooking'),evidence=jobContext(project,fn);
  assert.throws(()=>validateEvidenceCard(card,evidence.context),/normalization/);
  const cache=new ExplanationCache(),config={url:'https://api.deepseek.com',model:'mock'};
  cache.put(await digest(JSON.stringify([config.url,config.model,evidence.revision])),card);
  const queue=new ExplanationQueue({cache});await queue.setProject(project,[fn],config);
  assert.equal(queue.states.get(fn.id).status,'queued');
});
test('higher-level requests explicitly ask for JSON and use thinking source review',async()=>{
  let count=0;
  await requestExplanation({}, {kind:'component',selectedOperations:[{title:'Create'},{title:'Cancel'}]},undefined,async(_,options)=>{
    count++;const body=JSON.parse(options.body);
    assert.match(body.messages[0].content,/JSON object/);
    assert.match(body.messages[0].content,/distinct major operations/);
    assert.equal(body.review,count===2);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(card)}}]})};
  });
  assert.equal(count,2);
});
test('declaring a deferred normalizer does not claim the selected function normalizes immediately',()=>{
  assert.doesNotThrow(()=>validateEvidenceCard(card,{kind:'function',selectedFacts:[{returns:['value => value.trim()'],locals:[{value:'value => value.toLowerCase()'}]}]}));
});
test('summaries wait for failed function cards to be repaired',async()=>{
  const project=analyzeFiles([{path:'store.ts',text:'export function save(){return 1;}'}]);
  const calls=[],queue=new ExplanationQueue({request:async(_,context)=>{
    calls.push(context.kind);if(context.kind==='function')throw new Error('Incomplete card');return card;
  }});
  await queue.setProject(project,explanationJobs(project),{});queue.start();await settle();
  assert.deepEqual(calls,['function']);assert.equal(queue.enabled,false);
  queue.request=async(_,context)=>{calls.push(context.kind);return card;};
  queue.retry('store.ts#save:0');await settle();
  assert.ok(calls.includes('component'));assert.ok(calls.includes('application overview'));
});
