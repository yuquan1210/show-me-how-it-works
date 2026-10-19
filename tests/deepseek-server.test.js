import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {deepseekMiddleware} from '../server/deepseek.js';
async function server(t,options){
  const middleware=deepseekMiddleware(options);
  const app=http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end();}));
  await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));
  return `http://127.0.0.1:${app.address().port}`;
}
test('status reveals presence, never the key; missing key returns actionable error',async t=>{
  const url=await server(t,{env:{}});
  assert.equal((await (await fetch(url+'/api/ai/status')).json()).configured,false);
  const response=await fetch(url+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,503);assert.match((await response.json()).error,/DEEPSEEK_API_KEY/);
});
test('proxy injects server key, fixes upstream and rejects foreign origins',async t=>{
  let calls=0;
  const url=await server(t,{env:{DEEPSEEK_API_KEY:'test-server-secret'},fetcher:async(target,options)=>{
    calls++;assert.equal(target,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-server-secret');
    assert.equal(JSON.parse(options.body).model,'deepseek-flash');
    assert.equal(JSON.parse(options.body).thinking.type,'disabled');
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"answer":"Ready"}',reasoning_content:'private reasoning'}}]})};
  }});
  const status=await (await fetch(url+'/api/ai/status')).text();assert.ok(!status.includes('test-server-secret'));
  const request={method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({model:'arbitrary',messages:[{role:'user',content:'Explain'}]})};
  assert.equal((await fetch(url+'/api/ai/chat',request)).status,200);
  assert.equal((await fetch(url+'/api/ai/chat',{...request,headers:{...request.headers,Origin:'https://untrusted.example'}})).status,403);
  assert.equal(calls,1);
});
test('empty or truncated provider output retries once with a larger final-answer budget',async t=>{
  const budgets=[];
  const url=await server(t,{env:{DEEPSEEK_API_KEY:'fake-test-key'},fetcher:async(_,options)=>{
    const body=JSON.parse(options.body);budgets.push(body.max_tokens);assert.equal(body.thinking.type,'disabled');
    return {ok:true,json:async()=>({choices:[{finish_reason:budgets.length===1?'length':'stop',message:{content:budgets.length===1?'':'{"answer":"Ready"}',reasoning_content:'not returned'}}]})};
  }});
  const result=await (await fetch(url+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Explain'}]})})).json();
  assert.deepEqual(budgets,[2048,4096]);assert.equal(result.choices[0].message.content,'{"answer":"Ready"}');
  assert.equal(result.choices[0].message.reasoning_content,undefined);
});
test('repeated malformed output stops after two attempts with a safe error',async t=>{
  let calls=0;
  const url=await server(t,{env:{DEEPSEEK_API_KEY:'fake-test-key'},fetcher:async()=>{calls++;return {ok:true,json:async()=>({choices:[{message:{content:''}}]})};}});
  const response=await fetch(url+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[]})});
  assert.equal(response.status,502);assert.equal(calls,2);assert.match((await response.json()).error,/twice/);
});
test('accuracy review enables reasoning with sufficient budget but returns only final text',async t=>{
  const url=await server(t,{env:{DEEPSEEK_API_KEY:'fake-test-key'},fetcher:async(_,options)=>{
    const body=JSON.parse(options.body);
    assert.equal(body.thinking.type,'enabled');assert.equal(body.reasoning_effort,'high');assert.equal(body.max_tokens,16384);
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"purpose":"Reviewed"}',reasoning_content:'private intermediate reasoning'}}]})};
  }});
  const result=await (await fetch(url+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({review:true,messages:[{role:'user',content:'Review'}]})})).json();
  assert.deepEqual(result,{choices:[{finish_reason:'stop',message:{content:'{"purpose":"Reviewed"}'}}]});
});
test('truncated high-effort review retries once with a larger reasoning budget',async t=>{
  const budgets=[];
  const url=await server(t,{env:{DEEPSEEK_API_KEY:'fake-test-key'},fetcher:async(_,options)=>{
    const body=JSON.parse(options.body);budgets.push(body.max_tokens);
    assert.equal(body.thinking.type,'enabled');assert.equal(body.reasoning_effort,'high');
    return {ok:true,json:async()=>({choices:[{finish_reason:budgets.length===1?'length':'stop',message:{content:budgets.length===1?'':'{"purpose":"Reviewed"}'}}]})};
  }});
  const response=await fetch(url+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({review:true,messages:[{role:'user',content:'Review'}]})});
  assert.equal(response.status,200);assert.deepEqual(budgets,[16384,32768]);
});
