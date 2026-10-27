import { historyDelta, historyUnion } from './history.js';
import { scopeWorkflowModel } from './workflows.js';

const entryId = w => w.entryId || w.nodes[0];
const entrySignature = (m,w) => w.entryFunctionId?m.nodes.flatMap(n=>n.functionDetails).find(f=>f.id===w.entryFunctionId)?.fingerprint:m.nodes.find(n=>n.id===entryId(w))?.fingerprint;

// Exact IDs survive renames. A moved entry is matched only when its fingerprint
// is unique in both adjacent snapshots. Similar names/members are hints, not identity.
export function workflowCatalog(history) {
  const entries=[], owners=new Map();
  history.commits.forEach(({model},index)=>{
    const workflows=model.workflows.filter(w=>model.nodes.some(n=>n.id===entryId(w)));
    const claimed=new Set();
    for(const w of workflows) if(owners.has(w.id)) {
      const e=owners.get(w.id);e.versions[index]=w;e.name=w.name;claimed.add(e);
    }
    const unmatched=workflows.filter(w=>!owners.has(w.id));
    const previous=entries.filter(e=>e.versions[index-1]&&!claimed.has(e));
    for(const w of unmatched) {
      const sig=entrySignature(model,w);
      const exact=previous.filter(e=>sig && sig===entrySignature(history.commits[index-1].model,e.versions[index-1]));
      const unique=unmatched.filter(other=>sig && entrySignature(model,other)===sig).length===1;
      let e=exact.length===1 && unique && !claimed.has(exact[0]) ? exact[0] : null;
      if(!e) {
        e={id:`workflow-${entries.length+1}`,name:w.name,icon:w.icon,versions:[],uncertain:new Set(),matched:new Set()};
        const candidates=previous.filter(p=>{
          const prior=p.versions[index-1];
          return prior.name===w.name || prior.nodes.filter(id=>w.nodes.includes(id)).length>=2;
        });
        if(candidates.length){e.uncertain.add(index);candidates.forEach(p=>p.uncertain.add(index));}
        entries.push(e);
      } else e.matched.add(index);
      e.versions[index]=w;e.name=w.name;owners.set(w.id,e);claimed.add(e);
    }
  });
  return entries;
}

const scopedModel=scopeWorkflowModel;

export function workflowCommit(history, index, entry=null) {
  const after=history.commits[index].model, before=history.commits[index-1]?.model;
  if(!entry) {
    const model=historyDelta(before,after);
    return {model,state:'all',changed:hasChanges(model),within:model.nodes.filter(n=>n.status!=='unchanged').length,possible:0,connections:Object.keys(model.edgeChanges).length};
  }
  const current=entry.versions[index], prior=entry.versions[index-1];
  const first=entry.versions.findIndex(Boolean);
  const state=current ? prior ? 'present' : 'created' : prior ? 'removed-now' : index<first ? 'not-created' : 'removed';
  const model=historyDelta(before ? scopedModel(before,prior) : null,scopedModel(after,current));
  const previousIds=new Set(prior?.nodes||[]), currentIds=new Set(current?.nodes||[]);
  for(const n of model.nodes) {
    const inAfter=after.nodes.some(m=>m.id===n.id);
    if(n.status==='removed' && inAfter) n.change='Disconnected from this workflow. Still exists elsewhere in the system.';
    if(n.status==='added' && before?.nodes.some(m=>m.id===n.id)) n.change='Connected to this workflow. Already existed elsewhere in the system.';
    const membershipChanged=previousIds.has(n.id)!==currentIds.has(n.id);
    const functionsChanged=n.functionDetails.some(f=>f.status!=='unchanged');
    if(n.status==='unchanged' && functionsChanged) {n.status='modified';n.change='Functions participating in this workflow changed.';}
    const connectionsChanged=model.edges.some(([a,b])=>a===n.id && model.edgeChanges[JSON.stringify([a,b])]);
    n.impact=n.status==='unchanged' ? 'context'
      : after.kind==='demo' || membershipChanged || n.functionEvidence==='resolved' && (functionsChanged||connectionsChanged) ? 'within' : 'possible';
    for(const f of n.functionDetails) f.impact=n.functionEvidence==='resolved'||after.kind==='demo' ? 'within' : 'possible';
  }
  const renamed=current && prior && current.name!==prior.name;
  return {model,state,changed:hasChanges(model)||!!renamed||entry.uncertain.has(index)||entry.matched.has(index),
    within:model.nodes.filter(n=>n.impact==='within').length,possible:model.nodes.filter(n=>n.impact==='possible').length,
    connections:Object.keys(model.edgeChanges).length+Object.keys(model.functionEdgeChanges).length,uncertain:entry.uncertain.has(index),matched:entry.matched.has(index),renamed,
    name:current?.name||prior?.name||entry.name};
}
const hasChanges=m=>m.nodes.some(n=>n.status!=='unchanged')||Object.keys(m.edgeChanges).length>0||Object.keys(m.functionEdgeChanges).length>0;

export function workflowHistoryUnion(history, entry) {
  if(!entry)return historyUnion(history);
  return historyUnion({...history,commits:history.commits.map((c,i)=>({...c,model:scopedModel(c.model,entry.versions[i])}))});
}
export function nextWorkflowCommit(index,count,changed,skip) {
  if(!skip)return Math.min(index+1,count-1);
  for(let i=index+1;i<count;i++) if(changed(i))return i;
  return count-1; // Always land at the latest snapshot, even if unchanged.
}
