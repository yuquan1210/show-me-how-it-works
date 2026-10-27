import { coverageSummary, COVERAGE_LIMITS } from './coverage-summary.js';
import { componentModel } from './components.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories = {
  unresolved: 'Unresolved operations', external: 'Operations outside the snapshot',
  resolved: 'Mapped operations', dependencies: 'Module dependencies', callbacks: 'Callbacks passed',
};
const pageSize = 30;

export function coverageMarkup(model, {moduleId = '', functionId = '', componentId = '', category = 'unresolved', page = 0} = {}) {
  const coverage = model.coverage;
  const view=componentModel(model);
  const component=componentId?view.nodes.find(n=>n.id===componentId):null;
  const summary = coverageSummary(coverage, moduleId || component?.members, functionId);
  const calls = new Map((coverage?.calls || []).map(c => [c.id, c]));
  const functions = new Map(model.nodes.flatMap(n => n.functionDetails.map(f => [f.id, f.title])));
  const options = [...new Set(component?.members || [...(coverage?.modules || []), ...(coverage?.dependencies || []).map(d => d.module), ...(coverage?.calls || []).map(c => c.module), ...(coverage?.emptyFiles || []), ...model.nodes.map(n => n.id)])].sort();
  const rows = category === 'dependencies' ? summary.dependencies
    : category === 'callbacks' ? summary.callbackReferences.map(r => ({...calls.get(r.call), ...r, label: functions.get(r.to) || `Callback argument ${r.argument} — implementation unknown`}))
      : summary.calls.filter(c => c.status === category);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  page = Math.max(0, Math.min(page, totalPages - 1));
  const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
  const scope = functionId ? 'Selected operation; dependencies describe its containing source.' : moduleId ? 'Selected supporting or implementation source.' : component ? `${component.title} component, including its supporting sources.` : 'Full imported snapshot, independent of workflow focus.';
  const parseErrors = (model.errors || []).filter(path => !moduleId || path === moduleId);
  const markup = `<h2>Analysis coverage</h2><div class="coverage-report"><p>${esc(scope)} These counts describe static analysis, not observed execution.</p>
    ${moduleId && coverage.emptyFiles.includes(moduleId) ? '<p>This file contains no parsed statements, so it has no map node.</p>' : ''}
    ${moduleId && coverage.modules && !coverage.modules.includes(moduleId) && !coverage.emptyFiles.includes(moduleId) ? '<p>This module is absent from the source snapshot covered by this report; removed code has no current coverage records.</p>' : ''}
    ${!moduleId&&!component ? `<p>${coverage.sourceFiles} source files read · ${coverage.mappedModules} modules analyzed · ${view.nodes.length} components in the current map · ${coverage.emptyFiles.length} empty files</p>` : ''}
    ${parseErrors.length ? `<details open><summary>${parseErrors.length} files could not be fully parsed</summary><ul>${parseErrors.slice(0,30).map(path => `<li>${esc(path)}</li>`).join('')}</ul>${parseErrors.length > 30 ? '<p>Select a module to inspect additional affected files.</p>' : ''}</details>` : ''}
    <dl class="coverage-counts"><div><dt>Mapped calls</dt><dd>${summary.resolvedCalls}</dd></div><div><dt>Outside snapshot</dt><dd>${summary.externalCalls}</dd></div><div><dt>Unresolved calls</dt><dd>${summary.unresolvedCalls}</dd></div><div><dt>Unresolved dependencies</dt><dd>${summary.unresolvedDependencies}</dd></div></dl>
    <p>${summary.dependencies.length} module dependencies · ${summary.callbackReferences.length} callbacks passed${summary.unresolvedCallbacks ? ` · ${summary.unresolvedCallbacks} callback implementations unknown` : ''}</p>
    <div class="coverage-filters">${functionId ? '' : `<label>Module<select id="coverage-module"><option value="">All modules</option>${options.map(id => `<option value="${esc(id)}" ${id === moduleId ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select></label>`}
    <label>Show<select id="coverage-category">${Object.entries(categories).map(([key,label]) => `<option value="${key}" ${key === category ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
    <p>${rows.length} ${esc(categories[category].toLowerCase())}. Module-loading expressions are counted under dependencies.</p>
    <ul class="coverage-records">${shown.map(row => `<li><strong>${esc(category === 'dependencies' ? row.specifier ?? 'Computed module location' : row.label)}</strong><small>${esc(row.module)}:${row.line}:${row.column}${category === 'dependencies' ? ` · ${esc(row.kind)}${row.typeOnly ? ' · types only' : ''} · ${esc(row.status)}` : ''}</small><p>${esc(row.reason)}</p>${row.to && category !== 'callbacks' ? `<small>Target: ${esc(functions.get(row.to) || row.to)}</small>` : ''}</li>`).join('') || '<li>No records in this category. This does not prove that all behavior is covered.</li>'}</ul>
    <div class="coverage-pagination"><button id="coverage-prev" ${page === 0 ? 'disabled' : ''}>Previous</button><span>Page ${page + 1} of ${totalPages}</span><button id="coverage-next" ${page + 1 >= totalPages ? 'disabled' : ''}>Next</button></div>
    ${model.analysisWarnings?.length ? `<h3>Project settings</h3><ul>${model.analysisWarnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    <details><summary>What this analysis does not cover</summary><ul>${COVERAGE_LIMITS.map(limit => `<li>${esc(limit)}</li>`).join('')}</ul></details></div>`;
  return {markup, page};
}
