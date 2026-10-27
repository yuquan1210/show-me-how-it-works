// Presentation of responsibilities over the complete source model. Supporting
// files remain analysis evidence; there is no file-level canvas mode.
const technical = /^(src|app|lib|server|client|backend|frontend|web|api|services?|controllers?|repositories|repository|routes?|models?|handlers?|utils?|helpers?|common|shared|types?|constants?|components?|features?|modules?)$/i;
const projected = Symbol('component presentation');
const titleCase = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]/g, ' ').replace(/^./, c => c.toUpperCase());
const stem = node => (node.source || node.id).split('/').at(-1).replace(/\.[^.]+$/, '').replace(/[._-]?(controller|service|repository|routes?|model|handler)s?$/i, '');

function responsibility(node) {
  const folders = (node.source || node.id).split('/').slice(0, -1).filter(p => !technical.test(p));
  if (folders.length) return {key: folders.join('/'), title: titleCase(folders.at(-1))};
  const base = stem(node) || node.layer;
  const names = {main: 'Application entry', index: 'Application entry', app: 'Application entry', controller: 'Request handling', service: 'Application logic', repository: 'Data storage'};
  return {key: base, title: names[base.toLowerCase()] || titleCase(base)};
}
const isPrimary = node => node.componentRole ? node.componentRole !== 'support'
  : node.functionDetails.length > 0 || !node.moduleFeatures || node.moduleFeatures.includes('initialization');
const isForwarder = node => node.moduleFeatures?.includes('re-exports') && !node.moduleFeatures.some(f => ['values', 'initialization'].includes(f));
const supportRole = node => [node.moduleFeatures?.includes('values') ? 'Shared data' : '', node.moduleFeatures?.includes('types') ? 'Type definitions' : '', isForwarder(node) ? 'Public exports' : ''].filter(Boolean).join(' · ') || 'Supporting declarations';

export function componentModel(model) {
  if(model[projected])return model;
  if (model.kind !== 'local' || !model.nodes.some(n => n.moduleFeatures || n.componentRole || /\.[cm]?[jt]sx?$/.test(n.source||n.id))) return model;
  const byId = new Map(model.nodes.map(n => [n.id,n]));
  const outgoing = new Map(model.nodes.map(n => [n.id,[]]));
  for (const [a,b] of model.edges) if (byId.has(a) && byId.has(b)) outgoing.get(a).push(b);
  const groups = new Map(), owner = new Map();
  for (const node of model.nodes.filter(isPrimary)) {
    const {key,title} = responsibility(node), id = `component:${key}`;
    if (!groups.has(id)) groups.set(id,{id,title,implementations:[],support:[]});
    groups.get(id).implementations.push(node);owner.set(node.id,id);
  }
  const usedBy = new Map(model.nodes.filter(n => !isPrimary(n)).map(n => [n.id,new Set()]));
  for (const group of groups.values()) {
    const seen = new Set(group.implementations.map(n=>n.id)), queue=[...seen];
    for (let i=0;i<queue.length;i++) for (const target of outgoing.get(queue[i]) || []) {
      if (seen.has(target) || owner.has(target)) continue;
      seen.add(target);queue.push(target);usedBy.get(target)?.add(group.id);
    }
  }
  // A public export belongs with the responsibilities it exposes. It is not
  // promoted to another responsibility just because a caller imports it.
  for (const node of model.nodes.filter(n=>!isPrimary(n) && isForwarder(n))) {
    const targets=new Set(),seen=new Set([node.id]),queue=[node.id];
    for(let i=0;i<queue.length;i++)for(const next of outgoing.get(queue[i])||[]){
      if(owner.has(next))targets.add(owner.get(next));
      else if(!seen.has(next)){seen.add(next);queue.push(next);}
    }
    if(targets.size)usedBy.set(node.id,targets);
  }
  const unowned = model.nodes.filter(n=>!isPrimary(n) && !usedBy.get(n.id)?.size);
  if(unowned.length)groups.set('supporting:unowned',{id:'supporting:unowned',title:'Shared data & definitions',implementations:[],support:unowned});
  for(const [id,owners] of usedBy)for(const groupId of owners)groups.get(groupId).support.push(byId.get(id));
  const titles=new Map([...groups].map(([id,g])=>[id,g.title]));
  const nodes=[...groups.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(group=>{
    const implementations=[...group.implementations].sort((a,b)=>a.id.localeCompare(b.id));
    const support=[...group.support].sort((a,b)=>a.id.localeCompare(b.id));
    const members=[...implementations,...support];
    const primary=implementations[0]||support[0];
    const functionDetails=implementations.flatMap(n=>n.functionDetails.map(f=>({...f,sourceModule:n.id})));
    const changed=members.filter(n=>n.status && n.status!=='unchanged');
    const status=implementations.length&&implementations.every(n=>n.status==='removed')?'removed'
      : implementations.length&&implementations.every(n=>n.status==='added')?'added'
        : !implementations.length&&members.every(n=>n.status==='removed')?'removed'
          : !implementations.length&&members.every(n=>n.status==='added')?'added':changed.length?'modified':'unchanged';
    const gather=field=>[...new Set(members.flatMap(n=>n[field]||[]))];
    return {
      ...primary,id:group.id,title:group.title,isComponent:true,members:members.map(n=>n.id),
      componentRole:functionDetails.length?'implementation':implementations.length?'startup':'support',
      implementationMembers:implementations.map(n=>n.id),
      supportingFiles:support.map(n=>({id:n.id,title:n.title,role:supportRole(n),summary:n.summary,status:n.status||'unchanged',sharedWith:[...(usedBy.get(n.id)||[])].filter(id=>id!==group.id).map(id=>({id,title:titles.get(id)}))})),
      functions:functionDetails.map(f=>f.title),functionDetails,status,
      summary:functionDetails.length ? `${functionDetails.length} operations${support.length?` with ${support.length} supporting source${support.length===1?'':'s'}`:''}. Responsibility inferred from project structure.`
        : implementations.length ? 'Runs application initialization. External or unresolved behavior is listed in analysis coverage.' : 'Shared data and declarations with no mapped owning operation.',
      inputs:gather('inputs'),outputs:gather('outputs'),effects:gather('effects'),decisions:gather('decisions'),failures:gather('failures'),limitations:gather('limitations'),
      layer:implementations.some(n=>n.layer==='controller')?'controller':primary.layer,
      evidence:'Responsibility inferred from structure · supporting sources included',
      impact:changed.length&&changed.every(n=>n.impact==='possible')?'possible':'within',
      ...(changed.length ? {change:changed.some(n=>support.includes(n))?'Includes changes to supporting data or declarations.':primary.change||'Implementation changed in this responsibility.'} : {change:undefined}),
    };
  });
  const componentPaths=new Map();
  const dependencies=model.coverage?.dependencies||[];
  const dependencyByEdge=new Map();
  for(const d of dependencies)if(d.to){const key=JSON.stringify([d.module,d.to]);const rows=dependencyByEdge.get(key)||[];rows.push(d);dependencyByEdge.set(key,rows);}
  for(const group of groups.values()){
    const queue=group.implementations.map(n=>({node:n.id,path:[n.id],typeOnly:false,removed:n.status==='removed',added:false})),seen=new Set();
    for(let i=0;i<queue.length;i++){
      const current=queue[i];
      for(const next of outgoing.get(current.node)||[]){
        const key=JSON.stringify([current.node,next]);
        const dependencyRows=dependencyByEdge.get(key)||[];
        const state={node:next,path:[...current.path,next],typeOnly:current.typeOnly||!!(dependencyRows.length&&dependencyRows.every(d=>d.typeOnly)),removed:current.removed||model.edgeChanges?.[key]==='removed'||byId.get(next).status==='removed',added:current.added||model.edgeChanges?.[key]==='added'};
        const target=owner.get(next);
        if(target){
          if(target!==group.id){
            const edge=JSON.stringify([group.id,target]),paths=componentPaths.get(edge)||[];
            paths.push(state);componentPaths.set(edge,paths);
          }
          continue;
        }
        const visit=JSON.stringify([next,state.typeOnly,state.removed,state.added]);
        if(!seen.has(visit)){seen.add(visit);queue.push(state);}
      }
    }
  }
  const edgeChanges={},componentConnections={};
  for(const [edge,paths] of componentPaths){
    const active=paths.filter(p=>!p.removed),prior=paths.some(p=>p.removed||!p.added);
    const change=!active.length?'removed':active.every(p=>p.added)&&!prior?'added':'unchanged';
    if(change!=='unchanged')edgeChanges[edge]=change;
    componentConnections[edge]={paths:paths.slice(0,8).map(p=>p.path),typeOnly:(active.length?active:paths).every(p=>p.typeOnly),indirect:paths.some(p=>p.path.length>2)};
  }
  return {...model,[projected]:true,nodes,edges:[...componentPaths.keys()].sort().map(key=>JSON.parse(key)),edgeChanges,componentConnections};
}
