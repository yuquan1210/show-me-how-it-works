export function orderedFiles(files) {
  return [...files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function sourceSignature(files) {
  return JSON.stringify(orderedFiles(files).map(({path,text})=>[path,text]));
}
