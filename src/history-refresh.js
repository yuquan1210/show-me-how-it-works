// Continuity is accepted only for the same append-only commit sequence. A
// different branch, rewritten history, or unrelated project starts a new review.
export function historyRefresh(previous,next,sha,workflowId=null) {
  if(!previous||previous.kind!==next.kind||previous.name!==next.name||previous.branch!==next.branch||!previous.commits.length||next.commits.length<previous.commits.length)return null;
  if(!previous.commits.every((commit,i)=>commit.sha===next.commits[i].sha))return null;
  const index=next.commits.findIndex(commit=>commit.sha===sha);
  if(index<0)return null;
  return {index,workflowId,added:next.commits.length-previous.commits.length};
}
