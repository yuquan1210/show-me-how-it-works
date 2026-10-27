import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {resolveAiConfig,loadAiConfig,publicAiConfig} from '../server/ai-config.js';

test('AI config defaults to selective Flash with thinking disabled for all phases',()=>{
  const config=resolveAiConfig({},{});
  assert.equal(config.explanationMode,'selective');
  assert.equal(config.provider.model,'deepseek-flash');
  assert.equal(config.draft.thinking,'disabled');
  assert.equal(config.review.thinking,'disabled');
  assert.equal(config.review.reasoningEffort,'low');
  assert.equal(config.review.maxTokens,2048);
  assert.equal(config.followUp.thinking,'disabled');
  assert.equal(config.provider.apiKey,'');
});
test('private config overlays public settings and credentials without requiring environment variables',()=>{
  const dir=mkdtempSync(join(tmpdir(),'smhiw-ai-config-'));
  try{
    writeFileSync(join(dir,'ai.config.json'),JSON.stringify({explanationMode:'full',provider:{model:'configured-model'},review:{reasoningEffort:'low',maxTokens:3000,retryMaxTokens:6000}}));
    writeFileSync(join(dir,'ai.config.local.json'),JSON.stringify({provider:{apiKey:'private-test-key'},review:{reasoningEffort:'max'}}));
    const config=loadAiConfig({cwd:dir,env:{DEEPSEEK_API_KEY:'environment-key',DEEPSEEK_MODEL:'legacy-model'}});
    assert.equal(config.explanationMode,'full');assert.equal(config.provider.model,'configured-model');
    assert.equal(config.provider.apiKey,'private-test-key');assert.equal(config.review.reasoningEffort,'max');
    assert.equal(config.review.maxTokens,3000);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('existing server credentials remain a fallback when the local config key is blank',()=>{
  const config=resolveAiConfig({provider:{apiKey:''}}, {DEEPSEEK_API_KEY:'environment-key'});
  assert.equal(config.provider.apiKey,'environment-key');
});
test('malformed private config reports its filename without revealing its contents',()=>{
  const dir=mkdtempSync(join(tmpdir(),'smhiw-ai-invalid-'));
  try{
    writeFileSync(join(dir,'ai.config.local.json'),'PRIVATE_SECRET_INVALID_JSON');
    assert.throws(()=>loadAiConfig({cwd:dir,env:{}}),error=>error.message.includes('ai.config.local.json')&&!error.message.includes('PRIVATE_SECRET'));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid mode, nested settings, thinking, effort, budgets, timeouts, and endpoints are rejected',()=>{
  for(const override of [
    {explanationMode:'automatic'}, {provider:null}, {provider:{model:''}},
    {review:{thinking:'sometimes'}},{review:{reasoningEffort:'unsupported'}},
    {draft:{maxTokens:0}},{review:{maxTokens:400000}},{review:{retryMaxTokens:1}},
    {timeouts:{requestMs:-1}},{provider:{baseUrl:'https://user:secret@example.com'}},
    {provider:{baseUrl:'https://example.com?key=secret'}},{provider:{baseUrl:'http://example.com'}},
    {review:{apiKey:'wrong-place-secret'}}, {provider:{apiKey:123}},
  ])assert.throws(()=>resolveAiConfig(override,{}),/Invalid AI configuration/);
});
test('public settings contain no key and fingerprint only generation-affecting settings',()=>{
  const original=resolveAiConfig({provider:{apiKey:'private-test-secret'}},{}),publicConfig=publicAiConfig(original);
  assert.equal(publicConfig.configured,true);assert.ok(!JSON.stringify(publicConfig).includes('private-test-secret'));
  assert.equal(publicConfig.provider,undefined);
  assert.equal(publicAiConfig(resolveAiConfig({provider:{apiKey:'another-key'},explanationMode:'full'},{})).configFingerprint,publicConfig.configFingerprint);
  for(const override of [{provider:{model:'different-model'}},{review:{reasoningEffort:'max'}},{draft:{thinking:'enabled'}},{review:{maxTokens:20000,retryMaxTokens:32768}}]){
    assert.notEqual(publicAiConfig(resolveAiConfig(override,{})).configFingerprint,publicConfig.configFingerprint);
  }
});
