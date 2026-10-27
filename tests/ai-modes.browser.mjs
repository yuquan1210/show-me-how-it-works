// Run against a local dev/preview server. All AI requests are intercepted; this
// check never calls a provider or uses the user's credentials.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {analyzeFiles} from '../src/analyzer.js';
import {explanationJobs,CARD_FIELDS} from '../src/explanations.js';
import {componentModel} from '../src/components.js';
import {systemGraph} from '../src/graph-layout.js';

const baseUrl=process.argv[2]||'http://127.0.0.1:5173/';
const directory=mkdtempSync(join(tmpdir(),'smhiw-ai-modes-'));
const files=[{path:'a.ts',text:"import {save} from './b'; export function run(){return save();}"},{path:'b.ts',text:'export function save(){return true;}'}];
for(const file of files)writeFileSync(join(directory,file.path),file.text);
mkdirSync('test-results',{recursive:true});
const card=Object.fromEntries(CARD_FIELDS.map(key=>[key,'Explains the selected behavior.']));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});

async function scenario(mode,{configured=true,holdFirst=false}={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),calls=[],errors=[];
  let fingerprint='profile-a',release,started;
  const waiting=new Promise(resolve=>{release=resolve;}),firstStarted=new Promise(resolve=>{started=resolve;});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/ai/status',route=>route.fulfill({json:{configured,model:'mock-model',url:'https://provider.invalid',explanationMode:mode,configFingerprint:fingerprint,cardTimeoutMs:30000,followUpTimeoutMs:10000}}));
  await page.route('**/api/ai/chat',async route=>{
    const body=route.request().postDataJSON(),data=JSON.parse(body.messages[1].content);
    calls.push({id:data.selected?.id,phase:body.phase,context:data});
    if(calls.length===1){started();if(holdFirst)await waiting;}
    await route.fulfill({json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(card)}}]}});
  });
  const open=async()=>{await page.goto(baseUrl);await page.locator('#connect').click();await page.locator('#folder-input').setInputFiles(directory);};
  return {context,page,calls,errors,open,release,firstStarted,setFingerprint:value=>{fingerprint=value;}};
}

try{
  const selective=await scenario('selective',{holdFirst:true});
  try{
    const {page,calls}=selective;await selective.open();
    await page.locator('[data-node="component:a"]').waitFor();
    assert.equal(await page.locator('#project-loading').count(),0);assert.equal(calls.length,0);
    await page.locator('[data-node="component:a"]').click();
    await page.getByRole('button',{name:'Generate explanation',exact:true}).click();
    assert.equal(calls.length,0);
    await page.locator('#approve-explanations').click();await selective.firstStarted;
    await page.locator('[data-node="component:b"]').click();
    assert.equal(await page.locator('#inspector h2').innerText(),'B');
    assert.equal(await page.locator('#project-loading').count(),0);assert.equal(calls.length,1);
    await page.screenshot({path:'test-results/ai-selective.png'});
    selective.release();await expect.poll(()=>calls.length).toBe(2);
    await page.locator('[data-node="component:a"]').click();
    await page.getByRole('button',{name:'Regenerate explanation',exact:true}).waitFor();
    assert.deepEqual(calls.map(c=>c.id),['component:a','component:a']);
    assert.ok(calls[0].context.source.some(source=>source.id==='b.ts#save:0'));

    await page.locator('[data-level="functions"]').click();await page.locator('[data-node="a.ts#run:0"]').click();
    await page.getByRole('button',{name:'Generate explanation',exact:true}).click();
    await page.getByRole('button',{name:'Regenerate explanation',exact:true}).waitFor();
    assert.deepEqual(calls.slice(2).map(c=>c.id),['a.ts#run:0','a.ts#run:0']);
    await page.locator('[data-level="overview"]').click();await page.locator('[data-node="system:A"]').click();
    await page.locator('#open-project-summary').click();
    await page.locator('#modal').getByRole('button',{name:'Generate explanation',exact:true}).click();
    await page.locator('#modal').getByRole('button',{name:'Regenerate explanation',exact:true}).waitFor();
    assert.deepEqual(calls.slice(4).map(c=>c.id),['area:system:A','area:system:A']);
    assert.equal(calls.length,6);

    await selective.open();await page.locator('[data-node="component:a"]').click();
    await page.getByRole('button',{name:'Regenerate explanation',exact:true}).waitFor();assert.equal(calls.length,6);
    selective.setFingerprint('profile-b');await selective.open();await page.locator('[data-node="component:a"]').click();
    await page.getByRole('button',{name:'Generate explanation',exact:true}).waitFor();assert.equal(calls.length,6);
    assert.deepEqual(selective.errors,[]);
  }finally{selective.release();await selective.context.close();}

  const full=await scenario('full',{holdFirst:true});
  try{
    const {page,calls}=full;await full.open();await page.locator('#gate-start').waitFor();
    assert.equal(calls.length,0);assert.equal(await page.locator('#project-loading').evaluate(d=>d.matches(':modal')),true);
    await page.locator('#gate-start').click();await full.firstStarted;
    assert.equal(await page.locator('#project-loading').evaluate(d=>d.matches(':modal')),true);
    await page.screenshot({path:'test-results/ai-full.png'});full.release();
    await page.locator('#project-loading').waitFor({state:'detached'});
    const model=analyzeFiles(files),jobs=explanationJobs(model,systemGraph(componentModel(model)).items);
    assert.equal(calls.length,jobs.length*2);assert.equal(calls[0].id,'b.ts#save:0');
    assert.ok(jobs.every(job=>calls.filter(call=>call.id===job.id).length===2));
    assert.deepEqual(full.errors,[]);
  }finally{full.release();await full.context.close();}

  for(const mode of ['selective','full']){
    const missing=await scenario(mode,{configured:false});
    try{
      const {page,calls}=missing;await missing.open();
      if(mode==='full'){await page.locator('#gate-check').waitFor();assert.equal(await page.locator('#project-loading').evaluate(d=>d.matches(':modal')),true);}
      else {await page.locator('[data-node="component:a"]').click();await page.getByRole('button',{name:'Generate explanation',exact:true}).click();await page.getByRole('heading',{name:'AI configuration',exact:true}).waitFor();assert.equal(await page.locator('#project-loading').count(),0);}
      assert.equal(calls.length,0);assert.deepEqual(missing.errors,[]);
    }finally{await missing.context.close();}
  }
  console.log('AI mode browser checks passed: selective component/function/area requests, responsive canvas, consent, caching, settings invalidation, full blocking preparation, and missing-key behavior. No real provider requests.');
}finally{await browser.close();rmSync(directory,{recursive:true,force:true});}
