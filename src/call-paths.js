// Locate a call inside its own exception region. A catch elsewhere in the
// function must never be presented as recovery for this call.
export function callPaths(fn,target) {
  const result=[];
  const sequence=steps=>steps.filter(s=>['call','throw','return','change'].includes(s.kind)).map(s=>s.kind==='throw'?`stop with error: ${s.label}`:s.kind==='return'?`return ${s.label}`:s.label.toLowerCase()).join(', then ');
  const walk=(steps,protectedBy=null,finalizers=[])=>{
    for(const [index,step] of steps.entries()){
      if(step.kind==='call'&&step.target===target){
        const when=step.conditions.length?step.conditions.join('; '):'No enclosing branch condition mapped; earlier returns may skip this call.';
        const recovery=protectedBy?`If this call throws${step.awaited?' or its awaited result rejects':''} → ${sequence(protectedBy.failure)||'error is caught without explicit recovery'}${step.awaited?'':'. Returned promise rejections are not awaited by this catch.'}`:
          step.region==='catch'?'This call is part of local error handling; an error here can interrupt recovery.':'No local catch mapped for this call; errors may propagate and skip later operations.';
        const after=steps.slice(index+1).filter(s=>s.kind==='call'&&s.effect).map(s=>s.label.toLowerCase());
        result.push({when,awaited:step.awaited,region:step.region,recovery,...(after.length?{following:`Later in this block: ${after.join(', then ')}; a failure can skip these operations.`}:{}),...(finalizers.length?{cleanup:`Finally: ${finalizers.map(sequence).filter(Boolean).join(', then ')}`}:{}),line:step.line,column:step.column});
      }
      if(step.kind==='branch'){walk(step.children,protectedBy,finalizers);walk(step.otherwise,protectedBy,finalizers);}
      if(step.kind==='try'){const cleanup=step.cleanup.length?[step.cleanup,...finalizers]:finalizers;walk(step.children,step.catches?step:protectedBy,cleanup);walk(step.failure,protectedBy,cleanup);walk(step.cleanup,protectedBy,finalizers);}
    }
  };
  walk(fn.behavior?.steps||[]);return result;
}
