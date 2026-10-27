// History files retain only the bounded, plain structural path schema.
export function validatePaths(value,knownFunctions) {
  let count=0;
  const fail=()=>{throw new Error('Invalid execution-path metadata');};
  const text=v=>typeof v==='string'&&v.length<=2000;
  const strings=v=>Array.isArray(v)&&v.length<=200&&v.every(text);
  const kinds=new Set(['call','branch','try','return','throw','value','change','unknown']);
  const list=rows=>{
    if(!Array.isArray(rows)||rows.length>400)fail();
    return rows.map(row=>{
      if(++count>600||!row||!kinds.has(row.kind)||!text(row.label)||!Number.isInteger(row.line)||row.line<1||!Number.isInteger(row.column)||row.column<1)fail();
      const result={kind:row.kind,label:row.label,line:row.line,column:row.column};
      if(row.kind==='call'){
        if(row.target!==undefined&&!knownFunctions.has(row.target)||!strings(row.conditions)||!['normal','try','catch','finally'].includes(row.region)||typeof row.awaited!=='boolean'||typeof row.effect!=='boolean')fail();
        Object.assign(result,{conditions:row.conditions,region:row.region,awaited:row.awaited,effect:row.effect,...(row.target?{target:row.target}:{})});
      }
      if(row.kind==='branch'){result.children=list(row.children);result.otherwise=list(row.otherwise);}
      if(row.kind==='try'){if(typeof row.catches!=='boolean')fail();result.catches=row.catches;result.children=list(row.children);result.failure=list(row.failure);result.cleanup=list(row.cleanup);}
      return result;
    });
  };
  if(!value||value.version!==1||!strings(value.limitations)||!text(value.evidence))fail();
  return {version:1,steps:list(value.steps),limitations:value.limitations,evidence:value.evidence};
}
