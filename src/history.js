import { createDemo, applyDemoChange, applyLargeDemoChange } from './demo.js';
import { validateCoverage } from './coverage-summary.js';

const clean = model => {
  const copy = structuredClone(model);
  copy.errors ||= [];
  copy.fileCount ??= copy.nodes.length;
  copy.nodes = copy.nodes.filter(n => n.status !== 'removed').map(n => {
    delete n.change;
    n.status = 'unchanged';
    n.functionDetails = n.functionDetails.filter(f => f.status !== 'removed').map(f => ({...f, status:'unchanged'}));
    n.functions = n.functionDetails.map(f => f.title);
    return n;
  });
  const ids = new Set(copy.nodes.map(n => n.id));
  const fids = new Set(copy.nodes.flatMap(n => n.functionDetails.map(f => f.id)));
  copy.edges = copy.edges.filter(([a,b]) => ids.has(a) && ids.has(b));
  copy.functionEdges = (copy.functionEdges || []).filter(([a,b]) => fids.has(a) && fids.has(b));
  delete copy.edgeChanges; delete copy.functionEdgeChanges;
  copy.workflows = copy.workflows.filter(w=>ids.has(w.entryId || w.nodes[0])).map(w => ({...w,nodes:w.nodes.filter(id => ids.has(id))})).filter(w => w.nodes.length);
  return copy;
};
const signature = n => n.fingerprint || JSON.stringify([n.summary,n.inputs,n.outputs,n.decisions,n.effects,n.functionDetails?.map(signature)]);
export function historyDelta(before, after) {
  const next = clean(after), old = clean(before || {...after,nodes:[],edges:[],functionEdges:[],workflows:[]});
  const mark = (previous, current) => {
    const byId = new Map(previous.map(n => [n.id,n]));
    return [
      ...current.map(n => ({...n, status: !byId.has(n.id) ? 'added' : signature(byId.get(n.id)) !== signature(n) ? 'modified' : 'unchanged'})),
      ...previous.filter(n => !current.some(m => m.id === n.id)).map(n => ({...n,status:'removed'})),
    ];
  };
  next.nodes = mark(old.nodes,next.nodes).map(n => {
    const previous = old.nodes.find(p => p.id === n.id);
    if(n.status === 'removed') n.functionDetails = n.functionDetails.map(f => ({...f,status:'removed'}));
    else n.functionDetails = mark(previous?.functionDetails || [],n.functionDetails);
    n.functions = n.functionDetails.map(f => f.title);
    if(n.status !== 'unchanged') n.change = `${n.status === 'added' ? 'Added' : n.status === 'removed' ? 'Removed' : 'Changed'} in this commit.`;
    return n;
  });
  for(const [field,status] of [['edges','edgeChanges'],['functionEdges','functionEdgeChanges']]) {
    const oldKeys = new Set(old[field].map(e => JSON.stringify(e))), newKeys = new Set(next[field].map(e => JSON.stringify(e)));
    next[status] = {};
    for(const e of next[field]) if(!oldKeys.has(JSON.stringify(e))) next[status][JSON.stringify(e)] = 'added';
    for(const e of old[field]) if(!newKeys.has(JSON.stringify(e))) {
      next[field].push(e); next[status][JSON.stringify(e)] = 'removed';
    }
  }
  for(const n of next.nodes) {
    const changedCalls = next.edges.some(([a,b])=>a===n.id && next.edgeChanges[JSON.stringify([a,b])]);
    if(n.status==='unchanged' && changedCalls) {n.status='modified';n.change='Outgoing dependencies changed in this commit.';}
    for(const f of n.functionDetails) if(f.status==='unchanged' && next.functionEdges.some(([a,b])=>a===f.id && next.functionEdgeChanges[JSON.stringify([a,b])])) f.status='modified';
  }
  return next;
}
export function createDemoHistory() {
  const full = createDemo();
  const subset = ids => clean({...full,nodes:full.nodes.filter(n => ids.includes(n.id))});
  const snapshots = [
    ['Create the product catalog',subset(['catalog-api','inventory','stock-store','db'])],
    ['Add customer accounts',subset(['catalog-api','inventory','stock-store','db','auth-api','users','customers'])],
    ['Introduce checkout and inventory',subset(full.nodes.filter(n => !['payment','email'].includes(n.id)).map(n => n.id))],
    ['Connect payments and receipts',full],
    ['Prevent duplicate checkout',applyDemoChange(full)],
    ['Separate fulfillment and notifications',applyLargeDemoChange(full)],
  ];
  return {format:'show-me-history',version:1,name:full.name,kind:'demo',branch:'Illustrative sample',commits:snapshots.map(([message,model],i) => ({sha:`sample-${i+1}`,message,date:`2026-09-${String(i+1).padStart(2,'0')}T09:00:00Z`,model:clean(model)}))};
}
export function historyUnion(history) {
  const nodes = new Map(), edges = new Map(), functionEdges = new Map();
  for(const {model} of history.commits) {
    for(const n of model.nodes) {
      const old = nodes.get(n.id);
      const functions = new Map([...(old?.functionDetails || []),...n.functionDetails].map(f => [f.id,f]));
      nodes.set(n.id,{...n,functionDetails:[...functions.values()],functions:[...functions.values()].map(f => f.title)});
    }
    model.edges.forEach(e => edges.set(JSON.stringify(e),e));
    model.functionEdges.forEach(e => functionEdges.set(JSON.stringify(e),e));
  }
  return {...history.commits.at(-1).model,nodes:[...nodes.values()],edges:[...edges.values()],functionEdges:[...functionEdges.values()]};
}
export function validateHistory(value) {
  const bad = () => {throw new Error('Not a supported history export. Use the project’s history exporter.');};
  if(value?.format !== 'show-me-history' || value.version !== 1 || !Array.isArray(value.commits) || !value.commits.length || value.commits.length > 5000) bad();
  const text = s => typeof s === 'string' && s.length < 20000;
  const strings = a => Array.isArray(a) && a.every(text);
  const ids = new Set();
  for(const c of value.commits) {
    if(!text(c.sha) || ids.has(c.sha) || !text(c.message) || !text(c.date) || !Number.isFinite(Date.parse(c.date))) bad();
    ids.add(c.sha);
    const m = c.model;
    if(!m || !Array.isArray(m.nodes) || m.nodes.length > 10000 || !Array.isArray(m.workflows) || !Array.isArray(m.errors)) bad();
    if(m.analysisWarnings !== undefined && !strings(m.analysisWarnings)) bad();
    const nodeIds = new Set(), fnIds = new Set();
    for(const n of m.nodes) {
      if(!text(n.id) || nodeIds.has(n.id) || !text(n.title) || !text(n.summary) || !strings(n.functions) || !Array.isArray(n.functionDetails) || !['controller','service','repository','external'].includes(n.layer)) bad();
      nodeIds.add(n.id);
      if(n.moduleFeatures !== undefined && !strings(n.moduleFeatures)) bad();
      if(n.componentRole !== undefined && !['implementation','startup','support'].includes(n.componentRole)) bad();
      for(const f of n.functionDetails) {
        if(!text(f.id) || fnIds.has(f.id) || !text(f.title) || !text(f.summary)) bad();
        fnIds.add(f.id);
        for(const key of ['inputs','outputs','decisions','effects']) if(!strings(f[key])) bad();
      }
      for(const key of ['inputs','outputs','decisions','effects']) if(!strings(n[key])) bad();
    }
    for(const [field,known] of [['edges',nodeIds],['functionEdges',fnIds]])
      if(!Array.isArray(m[field]) || !m[field].every(e => Array.isArray(e) && e.length === 2 && e.every(id => known.has(id)))) bad();
    if(!m.workflows.every(w => text(w.id) && text(w.name) && strings(w.nodes) && w.nodes.every(id => nodeIds.has(id)))) bad();
    if(m.coverage !== undefined) validateCoverage(m.coverage, m);
  }
  // Imported files cannot override the sample label or inject source into AI context.
  const result = structuredClone(value);
  result.kind = 'git';
  for(const c of result.commits) {
    c.model.kind = 'local';
    c.model.name = String(value.name || 'Imported history').slice(0,200);
    delete c.model.explanationEvidence;
    if(c.model.coverage) c.model.coverage = validateCoverage(c.model.coverage, c.model);
    for(const n of c.model.nodes) {
      delete n.raw;
      for(const f of n.functionDetails) delete f.raw;
    }
  }
  return result;
}

export class CommitPlayer {
  constructor({count,onStep,onState,nextIndex=i=>i+1,delay=4000,clock=() => performance.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}) {
    Object.assign(this,{count,onStep,onState,nextIndex,delay,clock,schedule,cancel,index:0,playing:false,remaining:delay,timer:null});
  }
  select(index) { this.pause(); this.index=Math.max(0,Math.min(this.count-1,index)); this.remaining=this.delay; this.onStep(this.index); }
  play() { if(this.playing || this.index >= this.count-1) return; this.playing=true; this.onState(true); this.arm(); }
  arm() { this.started=this.clock(); this.timer=this.schedule(() => {
    this.timer=null; if(!this.playing)return;
    this.index=Math.min(this.count-1,Math.max(this.index+1,this.nextIndex(this.index))); this.remaining=this.delay; this.onStep(this.index);
    if(this.index >= this.count-1) {this.playing=false;this.onState(false);} else this.arm();
  },this.remaining); }
  pause() { if(this.timer !== null){this.cancel(this.timer);this.timer=null;this.remaining=Math.max(0,this.remaining-(this.clock()-this.started));} this.playing=false;this.onState(false); }
  stop() { if(this.timer!==null){this.cancel(this.timer);this.timer=null;}this.playing=false;this.index=0;this.remaining=this.delay;this.onState(false); }
}
