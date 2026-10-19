// Server-only: never import this module from src/.
export function deepseekMiddleware({env=process.env,fetcher=fetch}={}) {
  return async (req,res,next)=>{
    const path=req.url?.split('?')[0];
    if(!['/api/ai/status','/api/ai/chat'].includes(path))return next();
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    // This is a local-only proxy, not a public shared-key API.
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||''))return send(403,{error:'Local access only.'});
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`)return send(403,{error:'Cross-origin requests are not allowed.'});
    const configured=!!env.DEEPSEEK_API_KEY?.trim();
    const model=env.DEEPSEEK_MODEL?.trim()||'deepseek-flash';
    if(path==='/api/ai/status'&&req.method==='GET')return send(200,{configured,model});
    if(req.method!=='POST'||path!=='/api/ai/chat')return send(405,{error:'Method not allowed.'});
    if(!configured)return send(503,{error:'DEEPSEEK_API_KEY is not configured. Set it in the server environment and restart the app.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required.'});
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),300000);
    res.on('close',()=>controller.abort());
    try {
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>256000)return send(413,{error:'Explanation context is too large.'});}
      let data;try{data=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON.'});}
      if(data.review!==undefined&&typeof data.review!=='boolean')return send(400,{error:'Invalid review mode.'});
      if(!Array.isArray(data.messages)||data.messages.length>8||!data.messages.every(m=>['system','user','assistant'].includes(m.role)&&typeof m.content==='string'))return send(400,{error:'Invalid messages.'});
      for(let attempt=0;attempt<2;attempt++) {
      const upstream=await fetcher('https://api.deepseek.com/chat/completions',{
        method:'POST',signal:controller.signal,
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.DEEPSEEK_API_KEY.trim()}`},
        body:JSON.stringify({model,messages:data.messages,max_tokens:data.review?(attempt?32768:16384):(attempt?4096:2048),thinking:{type:data.review?'enabled':'disabled'},...(data.review?{reasoning_effort:'high'}:{}),response_format:{type:'json_object'},stream:false})
      });
      if(!upstream.ok)return send(upstream.status,{error:upstream.status===401?'DeepSeek rejected the configured server key.':upstream.status===402?'DeepSeek reports insufficient account balance.':upstream.status===400?'DeepSeek rejected the request. Check DEEPSEEK_MODEL in the server environment.':upstream.status===429?'DeepSeek rate limit reached. Retry shortly.':`DeepSeek request failed (${upstream.status}).`});
      const result=await upstream.json();
      const choice=result.choices?.[0],content=choice?.message?.content;
      let valid=false;try{const parsed=JSON.parse(content);valid=!!parsed&&typeof parsed==='object'&&!Array.isArray(parsed);}catch{}
      if(choice?.finish_reason==='length'||!valid) {
        if(attempt===0)continue;
        return send(502,{error:'DeepSeek returned an empty or incomplete explanation twice. Retry this card.'});
      }
      // Forward only final answer content, never reasoning or provider metadata.
      if(!res.destroyed)send(200,{choices:[{finish_reason:choice.finish_reason,message:{content}}]});
      return;
      }
    }catch{if(!res.destroyed)send(controller.signal.aborted?504:502,{error:controller.signal.aborted?'DeepSeek took too long to respond. Retry this card.':'Unable to reach DeepSeek from the local server. Check network access and retry.'});}
    finally{clearTimeout(timeout);}
  };
}
