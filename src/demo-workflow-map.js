// Curated presentation paths. These are demo storyboards, not inferred executions.
const paths = {
  checkout: ['Validate cart', 'Check stock', 'Reserve items', 'Take payment', 'Save order', 'Send receipt'],
  'checkout-out-of-stock': ['Validate cart', 'Check stock', 'Reject checkout'],
  'checkout-payment-declined': ['Validate cart', 'Check stock', 'Reserve items', 'Payment declined', 'Release items'],
  login: ['Find customer', 'Check password', 'Create session'],
  'login-rejected': ['Find customer', 'Check password', 'Reject sign-in'],
  browse: ['Read catalog', 'Check availability', 'Return products'],
  'browse-empty': ['Read catalog', 'Return empty list'],
};
const groups = [
  {id:'order-api', title:'Order controller', prefix:'checkout', color:'#56c7bd'},
  {id:'auth-api', title:'Authentication', prefix:'login', color:'#aca1ed'},
  {id:'catalog-api', title:'Product controller', prefix:'browse', color:'#e7bb71'},
];
export function demoWorkflowMap(model, esc, search = '', affected = []) {
  let y = 70;
  const controllers = [], lanes = [], wires = [];
  for (const group of groups) {
    const workflows = model.workflows.filter(w => w.demoScenario && w.id.startsWith(group.prefix));
    if (!workflows.length) continue;
    const center = y + workflows.length * 112 / 2;
    controllers.push(`<div class="demo-controller" style="left:24px;top:${center-40}px;--lane-color:${group.color}"><small>ENTRY POINT · ${workflows.length} PATHS</small><strong>${esc(group.title)}</strong></div>`);
    workflows.forEach((w, index) => {
      const top = y + index * 112;
      const dim = search && !`${w.name} ${w.description} ${paths[w.id]?.join(' ')}`.toLowerCase().includes(search.toLowerCase());
      wires.push(`<path d="M 224 ${center} H 250 Q 268 ${center} 268 ${center+(top+48>center?18:-18)} V ${top+48} H 300" stroke="${group.color}"/>`);
      lanes.push(`<button class="demo-workflow-lane ${dim?'search-muted':''} ${affected.includes(w.id)?'commit-affected':affected.length?'commit-unaffected':''}" data-demo-workflow="${esc(w.id)}" style="left:300px;top:${top}px;--lane-color:${group.color}" aria-label="Open ${esc(w.name)}"><span class="demo-lane-title"><b>${index+1}</b><strong>${esc(w.name)}</strong><small>${affected.includes(w.id)?'Affected by commit · ':''}Explore path ↗</small></span><span class="demo-lane-steps">${(paths[w.id]||[]).map((step,i)=>`<span>${i?' <i>→</i> ':''}${esc(step)}</span>`).join('')}</span><span class="demo-lane-outcome">${esc(w.description)}</span></button>`);
    });
    y += workflows.length * 112 + 48;
  }
  return {height:y, count:lanes.length, markup:`<p class="demo-map-note">Workflow paths · Shared steps repeat in each lane · Select a path to explore</p><svg class="demo-map-wires" width="1300" height="${y}" aria-hidden="true">${wires.join('')}</svg>${controllers.join('')}${lanes.join('')}`};
}
