const layouts=new Map();
const observers=new Map();
const panels=new Map();
const moved=new Set();
function keepInViewport(panel,preserveSize) {
  const r=panel.getBoundingClientRect();if(!r.width||!r.height)return;
  const width=Math.min(r.width,innerWidth-24),height=Math.min(r.height,innerHeight-24);
  if(preserveSize&&r.width>width)panel.style.width=`${width}px`;
  if(preserveSize&&r.height>height)panel.style.height=`${height}px`;
  if(r.left<12||r.right>innerWidth-12){panel.style.left=`${Math.max(12,Math.min(r.left,innerWidth-width-12))}px`;panel.style.right='auto';panel.style.transform='none';}
  if(r.top<12||r.bottom>innerHeight-12){panel.style.top=`${Math.max(12,Math.min(r.top,innerHeight-height-12))}px`;panel.style.bottom='auto';}
}
window.addEventListener('resize',()=>requestAnimationFrame(()=>{
  for(const [key,{panel,preserveSize}] of panels){
    if(!panel.isConnected){panels.delete(key);continue;}
    if(!preserveSize){for(const property of ['left','right','top','bottom','transform','width','height'])panel.style[property]='';layouts.delete(key);moved.delete(key);}
    keepInViewport(panel,preserveSize);
  }
}));
export function bindFloatingPanel(panel,key,handle,{preserveSize=true}={}) {
  if(!panel||!handle)return;
  panel.classList.add('floating-window');panel.dataset.window=key;
  panels.set(key,{panel,preserveSize});
  const layout=layouts.get(key);
  if(layout&&(preserveSize||moved.has(key))){
    const size=preserveSize?{width:`${Math.min(layout.width,innerWidth-24)}px`,height:`${Math.min(layout.height,innerHeight-24)}px`}:{};
    Object.assign(panel.style,{left:`${Math.min(layout.left,Math.max(12,innerWidth-layout.width-12))}px`,top:`${Math.min(layout.top,Math.max(12,innerHeight-layout.height-12))}px`,right:'auto',bottom:'auto',transform:'none',...size});
  }
  keepInViewport(panel,preserveSize);
  const save=()=>{const r=panel.getBoundingClientRect();if(r.width&&r.height)layouts.set(key,{left:r.left,top:r.top,width:r.width,height:r.height});};
  observers.get(key)?.disconnect();const observer=new ResizeObserver(save);observer.observe(panel);observers.set(key,observer);
  handle.classList.add('window-handle');if(!handle.title)handle.title='Drag to move';
  handle.onpointerdown=event=>{
    if(event.button!==0||event.target.closest('button,input,select,a'))return;
    event.preventDefault();event.stopPropagation();
    const r=panel.getBoundingClientRect(),start={x:event.clientX,y:event.clientY,left:r.left,top:r.top};
    if(preserveSize){panel.style.width=`${r.width}px`;panel.style.height=`${r.height}px`;}
    panel.style.right='auto';panel.style.bottom='auto';panel.style.transform='none';
    handle.setPointerCapture(event.pointerId);
    handle.onpointermove=e=>{moved.add(key);panel.style.left=`${Math.min(Math.max(12,start.left+e.clientX-start.x),Math.max(12,innerWidth-r.width-12))}px`;panel.style.top=`${Math.min(Math.max(12,start.top+e.clientY-start.y),Math.max(12,innerHeight-r.height-12))}px`;};
    handle.onpointerup=handle.onpointercancel=()=>{handle.onpointermove=null;save();};
  };
}
