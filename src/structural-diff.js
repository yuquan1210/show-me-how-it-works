// Compare presentation data, never generated prose or raw source.
export function structuralFields(entity) {
  if (!entity) return null;
  return {
    Purpose: [entity.summary], Inputs: entity.inputs || [], Outputs: entity.outputs || [],
    Decisions: entity.decisions || [], 'Side effects': entity.effects || [],
    ...(entity.functionDetails ? {Functions:entity.functionDetails.map(f=>`${f.title}: ${f.summary}`)} : {}),
  };
}
export function edgeFields(detail) {
  if (!detail) return null;
  return {Purpose:[detail.purpose], Calls:detail.calls.map(({caller,callee})=>`${caller.title} → ${callee.title}`),
    Conditions:detail.conditions || [], Inputs:detail.inputs, Outputs:detail.outputs,
    'Side effects':detail.effects, 'Failure handling':detail.failures};
}
export function changedFields(before, after) {
  return [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].flatMap(label=>{
    const old=(before?.[label] || []).filter(Boolean), next=(after?.[label] || []).filter(Boolean);
    return JSON.stringify(old) === JSON.stringify(next) ? [] : [{label,before:old,after:next}];
  });
}
function highlight(text, other, esc, tag) {
  const words = text.split(/(\s+)/), compare = other.split(/(\s+)/);
  let prefix=0, suffix=0;
  while(prefix<words.length && prefix<compare.length && words[prefix]===compare[prefix])prefix++;
  while(suffix<words.length-prefix && suffix<compare.length-prefix && words.at(-suffix-1)===compare.at(-suffix-1))suffix++;
  const end=words.length-suffix;
  return esc(words.slice(0,prefix).join(''))+(end>prefix?`<${tag}>${esc(words.slice(prefix,end).join(''))}</${tag}>`:'')+esc(words.slice(end).join(''));
}
export function structuralDiffMarkup(before, after, esc) {
  const changed = changedFields(before, after);
  const labels = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const cell = (values, other, kind, present) => {
    const differences = values.filter(line=>!other.includes(line));
    const counterparts = other.filter(line=>!values.includes(line));
    return `<div class="diff-cell diff-cell-${kind}">${!present ? `<p class="diff-absent">${kind==='before'?'Before · Not present':'After · Removed'}</p>` : !values.length ? '<p class="diff-absent">None mapped</p>' : values.map(line=>{
      const isChanged = differences.includes(line);
      const opposite = counterparts[differences.indexOf(line)] || '';
      return `<div class="diff-row ${isChanged?`diff-${kind}`:'diff-context'}"><span class="diff-sign" aria-hidden="true">${isChanged?(kind==='before'?'−':'+'):'·'}</span><p>${isChanged?highlight(line,opposite,esc,kind==='before'?'del':'ins'):esc(line)}</p></div>`;
    }).join('')}</div>`;
  };
  return `<section class="structural-diff" aria-label="Changes in this commit"><div class="diff-heading"><h3>Structural comparison</h3><span>${!before?'Added':!after?'Removed':changed.length?`${changed.length} changed fields`:'Unchanged'}</span></div><p class="diff-caption">Red − removed · Green + added · Unchanged text stays neutral</p>${!changed.length?'<p class="diff-no-change">No structural changes to this selection. This workflow is affected elsewhere in the commit.</p>':''}<div class="diff-table-scroll"><div class="diff-table"><div class="diff-column-heading"><strong>Before this commit</strong><small>Previous commit</small></div><div class="diff-column-heading"><strong>After this commit</strong><small>Add express checkout</small></div>${labels.map(label=>{
    const old = (before?.[label] || []).filter(Boolean), next = (after?.[label] || []).filter(Boolean);
    return `<section class="diff-field"><h4>${esc(label)}${changed.some(f=>f.label===label)?'<span>Changed</span>':''}</h4><div class="diff-field-columns">${cell(old,next,'before',!!before)}${cell(next,old,'after',!!after)}</div></section>`;
  }).join('')}</div></div></section>`;
}
