// Server-only configuration. Only publicAiConfig() may cross into the browser.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const defaults = JSON.parse(readFileSync(new URL('../ai.config.json', import.meta.url), 'utf8'));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const merge = (base, override) => {
  if(!object(override))throw new Error('AI configuration must be a JSON object.');
  const result={...base};
  for(const [key,value] of Object.entries(override)){
    if(['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid AI configuration key.');
    result[key]=object(value)?merge(object(base[key])?base[key]:{},value):value;
  }
  return result;
};
const integer = (value, min, max, field) => {
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`Invalid AI configuration: ${field} must be an integer from ${min} to ${max}.`);
};
const keys = (value, allowed, field) => {
  if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`Invalid AI configuration fields in ${field}.`);
};

export function resolveAiConfig(overrides = {}, env = {}) {
  const config=merge(defaults,overrides);
  keys(config,['explanationMode','provider','draft','review','followUp','timeouts'],'root');
  keys(config.provider,['baseUrl','model','apiKey'],'provider');
  if(!['selective','full'].includes(config.explanationMode))throw new Error('Invalid AI configuration: explanationMode must be selective or full.');
  for(const key of ['baseUrl','model'])if(typeof config.provider[key]!=='string'||!config.provider[key].trim())throw new Error(`Invalid AI configuration: provider.${key} is required.`);
  let endpoint;try{endpoint=new URL(config.provider.baseUrl);}catch{throw new Error('Invalid AI configuration: provider.baseUrl must be a URL.');}
  if((endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw new Error('Invalid AI configuration: provider.baseUrl must use HTTPS or local HTTP, without credentials, query, or fragment.');
  config.provider.baseUrl=endpoint.href.replace(/\/$/,'');
  config.provider.model=config.provider.model.trim();
  if(config.provider.apiKey!==undefined&&typeof config.provider.apiKey!=='string')throw new Error('Invalid AI configuration: provider.apiKey must be a string.');
  config.provider.apiKey=config.provider.apiKey?.trim()||env.DEEPSEEK_API_KEY?.trim()||'';
  // Preserve programmatic callers using the old environment-only middleware API.
  if(!overrides.provider?.model&&env.DEEPSEEK_MODEL?.trim())config.provider.model=env.DEEPSEEK_MODEL.trim();
  for(const phase of ['draft','review','followUp']){
    const options=config[phase];
    keys(options,['thinking','reasoningEffort','maxTokens','retryMaxTokens'],phase);
    if(!object(options)||!['enabled','disabled'].includes(options.thinking))throw new Error(`Invalid AI configuration: ${phase}.thinking must be enabled or disabled.`);
    if(!['low','high','max'].includes(options.reasoningEffort))throw new Error(`Invalid AI configuration: ${phase}.reasoningEffort must be low, high, or max.`);
    integer(options.maxTokens,1,393216,`${phase}.maxTokens`);
    integer(options.retryMaxTokens,options.maxTokens,393216,`${phase}.retryMaxTokens`);
  }
  if(!object(config.timeouts))throw new Error('Invalid AI configuration: timeouts must be an object.');
  keys(config.timeouts,['requestMs','cardMs','followUpMs'],'timeouts');
  for(const field of ['requestMs','cardMs','followUpMs'])integer(config.timeouts[field],1,7200000,`timeouts.${field}`);
  return config;
}

export function loadAiConfig({cwd=process.cwd(),env=process.env}={}) {
  const read=path=>{
    try{return JSON.parse(readFileSync(path,'utf8'));}
    catch{throw new Error(`Cannot read AI configuration in ${path.endsWith('ai.config.local.json')?'ai.config.local.json':'ai.config.json'}. Check that it contains valid JSON.`);}
  };
  const base=resolve(cwd,'ai.config.json'),local=resolve(cwd,'ai.config.local.json');
  const config=merge(existsSync(base)?read(base):defaults,existsSync(local)?read(local):{});
  return resolveAiConfig(config,env);
}

export function publicAiConfig(config) {
  const generation={baseUrl:config.provider.baseUrl,model:config.provider.model,draft:config.draft,review:config.review};
  const configFingerprint=createHash('sha256').update(JSON.stringify(generation)).digest('hex');
  return {
    configured:!!config.provider.apiKey,model:config.provider.model,url:config.provider.baseUrl,
    explanationMode:config.explanationMode,configFingerprint,
    draft:{...config.draft},review:{...config.review},followUp:{...config.followUp},
    cardTimeoutMs:config.timeouts.cardMs,followUpTimeoutMs:config.timeouts.followUpMs,
  };
}
