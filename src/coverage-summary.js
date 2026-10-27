export const COVERAGE_LIMITS = [
  'Counts cover the imported supported source snapshot, not every file in the original repository. Tests, build output, declaration files, and oversized files are excluded before import.',
  'Resolved calls are static links, not observed execution. Dynamic dispatch and dependency injection may remain unresolved.',
  'Passing a callback records a reference, not proof that it runs. Branch order and timing are not modeled yet.',
  'Counts include explicit calls and constructions. Implicit accessor calls, field-initialization timing, decorators, and framework-triggered execution are not reconstructed.',
  'Package implementations and package exports, bundler-only aliases, and compiler settings outside the snapshot are not analyzed.',
];

export function coverageSummary(coverage, module, fn) {
  const modules=module?new Set(Array.isArray(module)?module:[module]):null;
  const calls = (coverage?.calls || []).filter(c => (!modules || modules.has(c.module)) && (!fn || c.from === fn));
  const dependencies = (coverage?.dependencies || []).filter(d => !modules || modules.has(d.module));
  const ids = new Set(calls.map(c => c.id));
  const callbackReferences = (coverage?.callbackReferences || []).filter(r => ids.has(r.call));
  return {
    calls, dependencies,
    callbackReferences,
    unresolvedCallbacks: callbackReferences.filter(r => !r.to).length,
    resolvedCalls: calls.filter(c => c.status === 'resolved').length,
    externalCalls: calls.filter(c => c.status === 'external').length,
    unresolvedCalls: calls.filter(c => c.status === 'unresolved').length,
    resolvedDependencies: dependencies.filter(d => d.status === 'resolved').length,
    externalDependencies: dependencies.filter(d => d.status === 'external').length,
    unresolvedDependencies: dependencies.filter(d => d.status === 'unresolved').length,
  };
}

export function coverageCounts(coverage, functions) {
  const {calls, dependencies, callbackReferences, ...counts} = coverageSummary(coverage);
  return {...counts, totalCalls: calls.length, functions, callbackReferences: callbackReferences.length};
}

// Reconstruct allowed metadata on history import; unknown fields cannot smuggle
// source bodies into reports or explanation contexts. Older exports omit coverage.
export function validateCoverage(value, model) {
  const fail = () => {throw new Error('Invalid analysis coverage.');};
  const text = value => typeof value === 'string' && value.length < 20000;
  const list = value => Array.isArray(value) && value.length <= 200000;
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  if (!value || value.version !== 1 || !list(value.emptyFiles) || !value.emptyFiles.every(text) || !integer(value.sourceFiles) || !list(value.calls) || !list(value.dependencies) || !list(value.callbackReferences)) fail();
  const modules = new Set([...model.nodes.map(n => n.id), ...value.emptyFiles]);
  const functions = new Set(model.nodes.flatMap(n => n.functionDetails.map(f => f.id)));
  const functionModules = new Map(model.nodes.flatMap(n => n.functionDetails.map(f => [f.id,n.id])));
  if (value.sourceFiles !== modules.size || modules.size !== model.nodes.length + value.emptyFiles.length) fail();
  const location = row => integer(row.line) && row.line > 0 && integer(row.column) && row.column > 0;
  const status = row => ['resolved', 'external', 'unresolved'].includes(row.status);
  const unique = rows => new Set(rows.map(r => r.id)).size === rows.length;
  const dependencies = value.dependencies.map(row => {
    if (!row || !text(row.id) || !modules.has(row.module) || !['import', 're-export', 'type import', 'dynamic import', 'require'].includes(row.kind) || !(row.specifier === null || text(row.specifier)) || typeof row.typeOnly !== 'boolean' || !location(row) || !status(row) || !text(row.reason) || (row.status === 'resolved' && !modules.has(row.to))) fail();
    return {id: row.id, module: row.module, kind: row.kind, specifier: row.specifier, typeOnly: row.typeOnly, line: row.line, column: row.column, status: row.status, reason: row.reason, ...(row.status === 'resolved' ? {to: row.to} : {})};
  });
  if (!unique(dependencies)) fail();
  const dependencyModules = new Map(dependencies.map(d => [d.id,d.module]));
  const calls = value.calls.map(row => {
    if (!row || !text(row.id) || !modules.has(row.module) || !(row.from === row.module || functionModules.get(row.from) === row.module) || !['call', 'construct'].includes(row.kind) || !text(row.label) || !location(row) || !status(row) || !text(row.reason) || (row.status === 'resolved' && !functions.has(row.to)) || (row.dependency !== undefined && dependencyModules.get(row.dependency) !== row.module)) fail();
    return {id: row.id, module: row.module, from: row.from, kind: row.kind, label: row.label, line: row.line, column: row.column, status: row.status, reason: row.reason, ...(row.status === 'resolved' ? {to: row.to} : {}), ...(row.dependency ? {dependency: row.dependency} : {})};
  });
  if (!unique(calls)) fail();
  const callById = new Map(calls.map(c => [c.id, c]));
  const callbackReferences = value.callbackReferences.map(row => {
    if (!row || !callById.has(row.call) || row.from !== callById.get(row.call).from || (row.to !== undefined && !functions.has(row.to)) || !integer(row.argument) || row.argument < 1 || !text(row.reason)) fail();
    const status = row.status || (row.to ? 'resolved' : 'unresolved');
    if(!['resolved','unresolved'].includes(status) || (status==='resolved') !== !!row.to)fail();
    return {call: row.call, from: row.from, ...(row.to ? {to: row.to} : {}), argument: row.argument, status, reason: row.reason};
  });
  const result = {version: 1, sourceFiles: value.sourceFiles, mappedModules: model.nodes.length, modules: model.nodes.map(n=>n.id), emptyFiles: [...value.emptyFiles], dependencies, calls, callbackReferences, limitations: [...COVERAGE_LIMITS]};
  result.counts = coverageCounts(result, functions.size);
  return result;
}
