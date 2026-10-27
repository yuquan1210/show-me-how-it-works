const words = value => value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());

// A workflow starts at one operation. Imports contribute supporting context;
// only resolved calls contribute operations, so sibling exports stay separate.
export function discoverWorkflows(model, {exportsByModule = new Map(), bindings = []} = {}) {
  const modules=new Map(model.nodes.map(node=>[node.id,node]));
  const functions=new Map(model.nodes.flatMap(node=>node.functionDetails.map(fn=>[fn.id,{...fn,parent:node.id}])));
  const outgoingFunctions=new Map();
  for(const [from,to] of model.functionEdges||[]){if(!outgoingFunctions.has(from))outgoingFunctions.set(from,[]);outgoingFunctions.get(from).push(to);}
  const outgoingModules=new Map();
  for(const [from,to] of model.edges){if(!outgoingModules.has(from))outgoingModules.set(from,[]);outgoingModules.get(from).push(to);}
  const incoming=new Set((model.functionEdges||[]).map(([,to])=>to));
  const imported=new Set(model.edges.map(([,to])=>to));
  const publicRoots=model.nodes.filter(node=>!imported.has(node.id));
  const exposed=new Set(publicRoots.flatMap(node=>exportsByModule.get(node.id)||[]));
  const usable=fn=>!['constructor','accessor','callback'].includes(fn.kind)&&fn.visibility!=='private'&&fn.visibility!=='protected';
  const registered=new Set(bindings.flatMap(binding=>binding.functionIds));
  const candidates=[];
  for(const fn of functions.values()){
    if(!usable(fn)||registered.has(fn.id))continue;
    const module=modules.get(fn.parent);
    if(module.layer==='controller'&&fn.exported)
      candidates.push({fn,kind:'controller',evidence:'Public operation inferred from an entry-point component.'});
    else if(module.layer!=='controller'&&!incoming.has(fn.id)&&(fn.exported||!fn.ownerName&&fn.topLevel)&&(!imported.has(fn.parent)||exposed.has(fn.id)))
      candidates.push({fn,kind:fn.exported?'public':'inferred',evidence:fn.exported?'Exported operation at a public project boundary.':'Uncalled operation at a project boundary; entry status is inferred.'});
    else if(exposed.has(fn.id)&&fn.exported)
      candidates.push({fn,kind:'public',evidence:'Operation exposed through a public export boundary.'});
  }
  if(!candidates.length&&!bindings.length){
    for(const fn of functions.values())if(usable(fn)&&fn.exported&&!incoming.has(fn.id))
      candidates.push({fn,kind:'inferred',evidence:'Possible public entry; module boundaries are cyclic or incomplete.'});
  }
  const reach = roots => {
    const seen=new Set(roots.filter(id=>functions.has(id))),queue=[...seen];
    for(let i=0;i<queue.length;i++)for(const to of outgoingFunctions.get(queue[i])||[])
      if(functions.has(to)&&!seen.has(to)){seen.add(to);queue.push(to);}
    return [...seen];
  };
  const members = (ids, entryId) => {
    const seen=new Set([entryId,...ids.map(id=>functions.get(id).parent)]),queue=[...seen];
    for(let i=0;i<queue.length;i++)for(const to of outgoingModules.get(queue[i])||[])
      if(!seen.has(to)&&(modules.get(to)?.componentRole==='support'||modules.get(to)?.stateFingerprint)){seen.add(to);queue.push(to);}
    return [...seen].filter(id=>modules.has(id));
  };
  const make=(id,name,entryFunctionId,roots,trigger,extra={})=>{
    const fn=functions.get(entryFunctionId),functionIds=reach(roots);
    const entryId=fn?.parent||extra.entryId;
    return {id,name,entryId,...(entryFunctionId?{entryFunctionId}:{}),entryFunctions:roots,
      functionIds,nodes:members(functionIds,entryId),description:trigger.label,
      trigger,icon:'workflow',steps:functionIds.length,...extra};
  };
  const workflows=candidates.map(({fn,kind,evidence})=>make(fn.id,fn.title,fn.id,[fn.id],{kind,label:kind==='controller'?'Public operation':'Possible entry operation',evidence}));
  for(const binding of bindings){
    workflows.push(make(binding.id,binding.name,binding.entryFunctionId,binding.functionIds,
      {kind:'http',label:`${binding.method} ${binding.path}`,method:binding.method,path:binding.path,evidence:'Statically registered Express handler; execution is not recorded.'},
      {registration:binding.registration,...(binding.uncertain?{uncertain:true}:{})}));
  }
  const entryFunctions=new Set(workflows.flatMap(w=>w.entryFunctions));
  for(const module of model.nodes.filter(node=>node.componentRole==='startup')){
    const calls=(model.coverage?.calls||[]).filter(call=>call.from===module.id);
    if(!calls.length||calls.every(call=>call.to&&entryFunctions.has(call.to)))continue;
    workflows.push(make(`startup:${module.id}`,`${words(module.title)} startup`,null,calls.map(c=>c.to).filter(Boolean),
      {kind:'initialization',label:'Application initialization',evidence:'Operations declared at module initialization; loading and execution are not verified.'},{entryId:module.id}));
  }
  return workflows.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

export function scopeWorkflowModel(model, workflow) {
  if(!workflow)return {...model,nodes:[],edges:[],functionEdges:[],workflows:[]};
  const ids=new Set(workflow.nodes),nodes=model.nodes.filter(node=>ids.has(node.id));
  const explicit=Array.isArray(workflow.functionIds);
  const reachable=new Set(explicit?workflow.functionIds:nodes.filter(node=>node.id===(workflow.entryId||workflow.nodes[0])).flatMap(node=>node.functionDetails.map(fn=>fn.id)));
  if(!explicit){
    const queue=[...reachable],known=new Set(nodes.flatMap(node=>node.functionDetails.map(fn=>fn.id)));
    for(let i=0;i<queue.length;i++)for(const [a,b] of model.functionEdges||[])
      if(a===queue[i]&&known.has(b)&&!reachable.has(b)){reachable.add(b);queue.push(b);}
  }
  const filtered=nodes.map(node=>{
    const reached=node.functionDetails.filter(fn=>reachable.has(fn.id));
    const functionDetails=explicit?reached:reached.length?reached:node.functionDetails;
    const fingerprint=explicit&&node.stateFingerprint!==undefined&&node.componentRole!=='support'
      ? JSON.stringify([node.stateFingerprint,functionDetails.map(fn=>[fn.id,fn.fingerprint||fn.raw])]) : node.fingerprint;
    const supporting=explicit&&!functionDetails.length&&node.id!==workflow.entryId&&node.componentRole==='implementation';
    return {...node,...Object.fromEntries(['inputs','outputs','decisions','effects','failures','limitations'].map(field=>[field,[...new Set(functionDetails.flatMap(fn=>fn[field]||[]))]])),fingerprint,functionDetails,...(supporting?{componentRole:'support',summary:'Supporting values and declarations; other operations are outside this workflow.'}:{}),functionEvidence:reached.length?'resolved':'import-only',functions:functionDetails.map(fn=>fn.title)};
  });
  const fids=new Set(filtered.flatMap(node=>node.functionDetails.map(fn=>fn.id)));
  const functionEdges=(model.functionEdges||[]).filter(([a,b])=>fids.has(a)&&fids.has(b));
  // An import between two implementations is not an execution step. Retain
  // supporting declaration edges and dependencies with an actual selected call.
  const byId=new Map(filtered.map(node=>[node.id,node]));
  const parents=new Map(filtered.flatMap(node=>node.functionDetails.map(fn=>[fn.id,node.id])));
  const callConnections=new Set(functionEdges.map(([from,to])=>JSON.stringify([parents.get(from),parents.get(to)])));
  if(workflow.trigger?.kind==='initialization')for(const call of model.coverage?.calls||[])
    if(ids.has(call.from)&&parents.has(call.to))callConnections.add(JSON.stringify([call.from,parents.get(call.to)]));
  const edges=model.edges.filter(([a,b])=>ids.has(a)&&ids.has(b)&&(!explicit||
    byId.get(a)?.componentRole==='support'||byId.get(b)?.componentRole==='support'||callConnections.has(JSON.stringify([a,b]))));
  return {...model,nodes:filtered,edges,functionEdges,workflows:[workflow]};
}
