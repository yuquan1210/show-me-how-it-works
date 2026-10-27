import ts from "typescript";
import { edgeKey } from "./graph-activity.js";
import { isSource } from './source-files.js';
import { createProjectProgram } from './project-config.js';
import { moduleDependencies, collectCallRecords, sourceLocation } from './analysis-coverage.js';
import { coverageCounts, COVERAGE_LIMITS } from './coverage-summary.js';
import { executionPaths, pathSummary } from './execution-paths.js';
import { expressEntries } from './framework-entry-points.js';
import { discoverWorkflows } from './workflows.js';
export { isSource } from './source-files.js';
export const words = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/, (c) => c.toUpperCase());
function layerFor(path) {
  return /controller|routes?|endpoints?|pages?\//i.test(path)
    ? "controller"
    : /repository|repositories|models?|dao|storage/i.test(path)
      ? "repository"
      : "service";
}
function actionText(name) {
  const w = words(name);
  return /^(get|find|fetch|load|read|list)/i.test(name)
    ? `Retrieves ${w.replace(/^(Get|Find|Fetch|Load|Read|List) /, "").toLowerCase()}.`
    : /^(save|create|insert|add|write)/i.test(name)
      ? `Creates or stores ${w.replace(/^(Save|Create|Insert|Add|Write) /, "").toLowerCase()}.`
      : /^(delete|remove)/i.test(name)
        ? `Removes ${w.replace(/^(Delete|Remove) /, "").toLowerCase()}.`
        : /^(update|set)/i.test(name)
          ? `Updates ${w.replace(/^(Update|Set) /, "").toLowerCase()}.`
          : /^(calculate|compute)/i.test(name)
            ? `Computes ${w.replace(/^(Calculate|Compute) /, "").toLowerCase()}.`
            : `Handles ${w.toLowerCase()}.`;
}
function declaredName(name) {
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)) ? name.text : null;
}
function callLabel(expression) {
  if (ts.isIdentifier(expression)) return words(expression.text).toLowerCase();
  if (ts.isPropertyAccessExpression(expression)) return words(expression.name.text).toLowerCase();
  return "a computed operation";
}
function describeCondition(n) {
  if (ts.isIdentifier(n)) return words(n.text).toLowerCase();
  if (ts.isPropertyAccessExpression(n))
    return `${describeCondition(n.expression)} ${words(n.name.text).toLowerCase()}`;
  if (
    ts.isPrefixUnaryExpression(n) &&
    n.operator === ts.SyntaxKind.ExclamationToken
  )
    return `${describeCondition(n.operand)} is absent, empty, or false`;
  if (ts.isParenthesizedExpression(n)) return describeCondition(n.expression);
  if (ts.isStringLiteral(n)) return `“${n.text}”`;
  if (ts.isNumericLiteral(n)) return n.text;
  if (n.kind === ts.SyntaxKind.NullKeyword) return "empty";
  if (n.kind === ts.SyntaxKind.TrueKeyword) return "true";
  if (n.kind === ts.SyntaxKind.FalseKeyword) return "false";
  if (ts.isBinaryExpression(n)) {
    const op = {
      [ts.SyntaxKind.EqualsEqualsEqualsToken]: "equals",
      [ts.SyntaxKind.EqualsEqualsToken]: "equals",
      [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "does not equal",
      [ts.SyntaxKind.ExclamationEqualsToken]: "does not equal",
      [ts.SyntaxKind.GreaterThanToken]: "is greater than",
      [ts.SyntaxKind.LessThanToken]: "is less than",
      [ts.SyntaxKind.GreaterThanEqualsToken]: "is at least",
      [ts.SyntaxKind.LessThanEqualsToken]: "is at most",
      [ts.SyntaxKind.AmpersandAmpersandToken]: "and",
      [ts.SyntaxKind.BarBarToken]: "or",
    }[n.operatorToken.kind];
    if (op)
      return `${describeCondition(n.left)} ${op} ${describeCondition(n.right)}`;
  }
  if (ts.isCallExpression(n))
    return `${callLabel(n.expression)} succeeds`;
  return "a computed condition holds";
}
function branchOutcome(n) {
  if (ts.isBlock(n))
    return n.statements.length ? branchOutcome(n.statements[0]) : "continue";
  if (ts.isThrowStatement(n)) return "stop with an error";
  if (ts.isReturnStatement(n))
    return "return " + summarizeReturn(n.expression).toLowerCase();
  return "run the conditional operation";
}
function summarizeReturn(exp) {
  if (!exp) return "No value";
  if (ts.isObjectLiteralExpression(exp))
    return `Object containing ${exp.properties.map((p) => (p.name && ts.isIdentifier(p.name) ? words(p.name.text).toLowerCase() : "additional fields")).join(", ")}`;
  if (ts.isArrayLiteralExpression(exp)) return "List of values";
  if (exp.kind === ts.SyntaxKind.NullKeyword) return "Empty result";
  if (
    exp.kind === ts.SyntaxKind.TrueKeyword ||
    exp.kind === ts.SyntaxKind.FalseKeyword
  )
    return "Yes / no result";
  if (ts.isStringLiteral(exp)) return "Text result";
  if (ts.isNumericLiteral(exp)) return "Numeric result";
  if (ts.isAwaitExpression(exp)) return summarizeReturn(exp.expression);
  if (ts.isCallExpression(exp))
    return `Result from ${callLabel(exp.expression)}`;
  return "Computed result";
}
export function analyzeFiles(files, name = "My application") {
  const project = createProjectProgram(files);
  const { program } = project;
  const checker = program.getTypeChecker();
  const printer=ts.createPrinter({removeComments:true});
  const declarations = new Map();
  const nodes = [],
    errors = [],
    explanationEvidence = [];
  const sourceModules = [];
  const coverage = {version: 1, sourceFiles: 0, mappedModules: 0, emptyFiles: [], dependencies: [], calls: [], callbackReferences: [], limitations: COVERAGE_LIMITS};
  for (const { path, text } of files.filter((f) => isSource(f.path))) {
    const sf = project.getSourceFile(path);
    if (sf.parseDiagnostics.length) errors.push(path);
    const id = path,
      layer = layerFor(path),
      fns = [];
    const dependencies = moduleDependencies(sf, path, checker, project);
    sourceModules.push({sf, path, ...dependencies});
    coverage.dependencies.push(...dependencies.records);
    const moduleImports = [...new Set(dependencies.records.map(d => d.specifier).filter(s => s !== null))];
    // Local AI evidence includes state, constants and types, not just function bodies.
    const moduleDeclarations = sf.statements.flatMap(st => {
      if (ts.isVariableStatement(st)) return st.declarationList.declarations
        .filter(d => !d.initializer || !ts.isArrowFunction(d.initializer) && !ts.isFunctionExpression(d.initializer))
        .map(d => `${st.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let'} ${d.getText(sf)};`);
      if (ts.isClassDeclaration(st)) return st.members.filter(ts.isPropertyDeclaration).map(p => p.getText(sf));
      return ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)
        ? [st.getText(sf)] : [];
    });
    const evidence={id, declarations:moduleDeclarations.join('\n'), imports:moduleImports,
      resolvedImports: [...new Set(dependencies.records.filter(d => d.status === 'resolved').map(d => d.to))], functions:[]};
    explanationEvidence.push(evidence);
    const isFunctionValue=d=>d.initializer&&(ts.isArrowFunction(d.initializer)||ts.isFunctionExpression(d.initializer));
    const stateFingerprint=sf.statements.flatMap(st=>{
      if(ts.isVariableStatement(st))return st.declarationList.declarations.filter(d=>!isFunctionValue(d)).map(d=>`${st.declarationList.flags&ts.NodeFlags.Const?'const':'let'} ${printer.printNode(ts.EmitHint.Unspecified,d,sf)}`);
      if(ts.isClassDeclaration(st))return st.members.filter(m=>ts.isPropertyDeclaration(m)&&!isFunctionValue(m)).map(m=>printer.printNode(ts.EmitHint.Unspecified,m,sf));
      return ts.isInterfaceDeclaration(st)||ts.isTypeAliasDeclaration(st)||ts.isEnumDeclaration(st)?[printer.printNode(ts.EmitHint.Unspecified,st,sf)]:[];
    }).join('\n');
    const visit = (n) => {
      if (
        (ts.isFunctionDeclaration(n) ||
          ts.isMethodDeclaration(n) ||
          ts.isGetAccessor(n) || ts.isSetAccessor(n) ||
          ts.isConstructorDeclaration(n) ||
          ts.isArrowFunction(n) ||
          ts.isFunctionExpression(n)) &&
        n.body
      ) {
        const position = sourceLocation(sf, n);
        const ownerName = (ts.isClassDeclaration(n.parent) || ts.isClassExpression(n.parent)) ? n.parent.name?.text || 'Anonymous class' : null;
        const anonymousCallback = ts.isCallExpression(n.parent) || ts.isNewExpression(n.parent);
        const fnName = ts.isConstructorDeclaration(n) ? `${ownerName}.constructor` :
          declaredName(n.name) ||
          (ts.isVariableDeclaration(n.parent)
            ? declaredName(n.parent.name)
            : ts.isPropertyAssignment(n.parent) || ts.isPropertyDeclaration(n.parent)
              ? declaredName(n.parent.name)
              : null) || (ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : `${anonymousCallback ? 'callback' : 'anonymous'}@${position.line}:${position.column}`);
        if (fnName) {
          const fnId = `${path}#${fnName}:${fns.filter((f) => f.name === fnName).length}`;
          declarations.set(n, fnId);
          const calls = [],
            outputs = [],
            decisions = [],
            effects = [];
          const facts={parameters:n.parameters.map(p=>p.getText(sf)),returns:[],throws:[],branches:[],locals:[],numbers:[],arithmeticValues:[]};
          const scan = (c) => {
            if (
              c !== n &&
              (ts.isFunctionDeclaration(c) ||
                ts.isMethodDeclaration(c) || ts.isConstructorDeclaration(c) || ts.isGetAccessor(c) || ts.isSetAccessor(c) ||
                ts.isArrowFunction(c) ||
                ts.isFunctionExpression(c))
            )
              return;
            if (ts.isCallExpression(c) || ts.isNewExpression(c)) {
              const call = ts.isIdentifier(c.expression) ? c.expression.text
                : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : "computed operation";
              calls.push(call);
              if (
                /^(save|insert|delete|update|write|send|publish|emit|create)/i.test(
                  call,
                )
              )
                effects.push(actionText(call));
            }
            if (ts.isReturnStatement(c))
              outputs.push(summarizeReturn(c.expression));
            if(ts.isReturnStatement(c))facts.returns.push(c.expression?.getText(sf)||'No value');
            if(ts.isThrowStatement(c))facts.throws.push(c.expression.getText(sf));
            if(ts.isIfStatement(c))facts.branches.push({condition:c.expression.getText(sf),outcome:branchOutcome(c.thenStatement)});
            if(ts.isVariableDeclaration(c)&&c.initializer)facts.locals.push({name:c.name.getText(sf),value:c.initializer.getText(sf)});
            if(ts.isNumericLiteral(c))facts.numbers.push(c.text);
            if(ts.isNumericLiteral(c)&&ts.isBinaryExpression(c.parent)&&[
              ts.SyntaxKind.AsteriskToken,ts.SyntaxKind.SlashToken,ts.SyntaxKind.PlusToken,ts.SyntaxKind.MinusToken,
            ].includes(c.parent.operatorToken.kind)&&Number(c.text)>=10)facts.arithmeticValues.push(String(Number(c.text)));
            if (ts.isIfStatement(c)) {
              decisions.push(
                `When ${describeCondition(c.expression)} → ${branchOutcome(c.thenStatement)}`,
              );
              if (c.elseStatement)
                decisions.push(`Otherwise → ${branchOutcome(c.elseStatement)}`);
            }
            if (ts.isThrowStatement(c))
              decisions.push("May stop with an error");
            if (ts.isTryStatement(c))
              decisions.push(
                c.catchClause
                  ? "Catches an error for local handling"
                  : "Runs cleanup after an operation",
              );
            ts.forEachChild(c, scan);
          };
          scan(n.body);
          if (ts.isArrowFunction(n) && !ts.isBlock(n.body))
            outputs.push(summarizeReturn(n.body));
          const fn = {
            id: fnId,
            name: fnName,
            title: ts.isConstructorDeclaration(n) ? `${ownerName} constructor` : ts.isGetAccessor(n) ? `Read ${words(fnName)}` : ts.isSetAccessor(n) ? `Set ${words(fnName)}` : /^(callback|anonymous)@/.test(fnName) ? `${anonymousCallback ? 'Callback' : 'Anonymous operation'} at line ${position.line}, column ${position.column}` : fnName === 'default' ? 'Default export' : words(fnName),
            kind: ts.isConstructorDeclaration(n) ? 'constructor' : ts.isGetAccessor(n) || ts.isSetAccessor(n) ? 'accessor' : /^(callback|anonymous)@/.test(fnName) ? 'callback' : 'function',
            ...(ownerName?{ownerName}:{}),
            topLevel:n.parent===sf||ts.isVariableDeclaration(n.parent)&&n.parent.parent?.parent?.parent===sf,
            visibility:fnName.startsWith('#')||n.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword)?'private':n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ProtectedKeyword)?'protected':'public',
            fingerprint:printer.printNode(ts.EmitHint.Unspecified,n,sf),
            ...position,
            inputs: n.parameters.map(
              (p) =>
                (ts.isIdentifier(p.name)
                  ? words(p.name.text)
                  : "Grouped input fields") +
                (p.questionToken ? " (optional)" : ""),
            ),
            outputs: [...new Set(outputs)],
            decisions: [...new Set(decisions)],
            effects: [...new Set(effects)],
            calls: [...new Set(calls)],
            summary: ts.isConstructorDeclaration(n) ? `Initializes a ${ownerName} instance.` : /^(callback|anonymous)@/.test(fnName) ? 'Defines an operation whose invocation depends on its caller.' : actionText(fnName),
            raw: n.getText(sf),
            parent: id,
          };
          fns.push(fn);
          evidence.functions.push({id:fnId,...facts});
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    if (!sf.statements.length) {coverage.emptyFiles.push(path);continue;}
    const moduleFeatures = [];
    if (sf.statements.some(ts.isVariableStatement) || sf.statements.some(ts.isClassDeclaration)) moduleFeatures.push('values');
    if (sf.statements.some(s => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s))) moduleFeatures.push('types');
    if (dependencies.records.some(d => d.kind === 're-export')) moduleFeatures.push('re-exports');
    if (sf.statements.some(s => ts.isExpressionStatement(s) || ts.isIfStatement(s) || ts.isForStatement(s) || ts.isTryStatement(s) || ts.isExportAssignment(s))) moduleFeatures.push('initialization');
    if (dependencies.records.some(d => d.kind !== 're-export')) moduleFeatures.push('imports');
    if (!fns.length) evidence.moduleSource = text;
    const baseTitle = words(
      path
        .split("/")
        .at(-1)
        .replace(/\.[^.]+$/, "")
        .replace(/\./g, " "),
    );
    const suffix = {
      controller: "controller",
      service: "service",
      repository: "repository",
    }[layer];
    const title = !fns.length ? baseTitle : baseTitle.toLowerCase().includes(suffix)
      ? baseTitle
      : `${baseTitle} ${suffix}`;
    nodes.push({
      id,
      title,
      layer,
      icon:
        layer === "controller"
          ? "arrow-right-left"
          : layer === "repository"
            ? "database"
            : "workflow",
      summary: fns.length ? `${fns.length} operations in ${title.toLowerCase()}. Select a function for its inputs, results, and behavior.`
        : [moduleFeatures.includes('values') ? 'Declares module values or shared state.' : '', moduleFeatures.includes('types') ? 'Defines shared types.' : '', moduleFeatures.includes('re-exports') ? 'Re-exports other modules.' : '', moduleFeatures.includes('initialization') ? 'Contains module initialization.' : '', moduleFeatures.includes('imports') ? 'Depends on imported modules.' : ''].filter(Boolean).join(' ') || 'Contains module declarations.',
      moduleFeatures,
      componentRole: fns.length ? 'implementation' : sf.statements.some(s =>
        ts.isExpressionStatement(s) || ts.isIfStatement(s) || ts.isIterationStatement(s,false) || ts.isTryStatement(s) || ts.isThrowStatement(s) || ts.isSwitchStatement(s) || ts.isImportDeclaration(s)&&!s.importClause) ? 'startup' : 'support',
      inputs: [...new Set(fns.flatMap((f) => f.inputs))].slice(0, 8),
      outputs: [...new Set(fns.flatMap((f) => f.outputs))].slice(0, 6),
      decisions: [...new Set(fns.flatMap((f) => f.decisions))],
      effects: [...new Set(fns.flatMap((f) => f.effects))],
      functions: fns.map((f) => f.title),
      functionDetails: fns,
      evidence: "Parsed structure · inferred labels",
      source: path,
      status: "unchanged",
      fingerprint: printer.printFile(sf),
      stateFingerprint,
    });
  }
  const edges = [],
    ids = new Set(nodes.map((n) => n.id));
  for (const dependency of coverage.dependencies) {
      const path = dependency.module, found = dependency.to;
      if (
        found && ids.has(found) &&
        found !== path &&
        !edges.some((e) => e[0] === path && e[1] === found)
      )
        edges.push([path, found]);
    }
  const functionEdges = [];
  const functionIds = new Set(declarations.values());
  for (const {sf, path, records, loaders} of sourceModules) {
    const result = collectCallRecords(sf, path, checker, declarations, records, loaders);
    coverage.calls.push(...result.calls);coverage.callbackReferences.push(...result.callbackReferences);
    for (const {from, to, resultName} of result.callResults) {
      const file = explanationEvidence.find(e => e.id === path);
      (file.callResults ||= []).push({from, to, resultName});
    }
    for (const {from, to} of result.calls) if (to && functionIds.has(from) && !functionEdges.some(([a,b]) => a === from && b === to)) functionEdges.push([from, to]);
  }
  const analyzedFunctions=new Map(nodes.flatMap(node=>node.functionDetails.map(fn=>[fn.id,fn])));
  for(const [declaration,id] of declarations){
    const source=declaration.getSourceFile();
    const fn=analyzedFunctions.get(id);
    fn.behavior=executionPaths(declaration,source,checker,declarations);
    Object.assign(fn,pathSummary(fn.behavior));
  }
  for(const node of nodes)for(const field of ['outputs','decisions','effects','failures','limitations'])node[field]=[...new Set(node.functionDetails.flatMap(fn=>fn[field]||[]))];
  coverage.sourceFiles = sourceModules.length;coverage.mappedModules = nodes.length;
  for(const node of nodes)if(node.componentRole==='support'&&coverage.calls.some(c=>c.module===node.id&&c.from===node.id&&!(c.kind==='construct'&&c.status==='external'&&c.reason.startsWith('Runtime-provided')&&['Map','Set','WeakMap','WeakSet','Date','RegExp','Object','Array'].includes(c.label))))node.componentRole='startup';
  coverage.modules = nodes.map(n => n.id);
  coverage.counts = coverageCounts(coverage, functionIds.size);
  const exportsByModule=new Map();
  const exportedIds=symbol=>{
    if(symbol.flags&ts.SymbolFlags.Alias)symbol=checker.getAliasedSymbol(symbol);
    return (symbol.declarations||[]).flatMap(declaration=>{
      const id=declarations.get(declaration)||declarations.get(declaration.initializer);
      if(id)return [id];
      return ts.isClassDeclaration(declaration)?declaration.members.map(member=>declarations.get(member)||declarations.get(member.initializer)).filter(Boolean):[];
    });
  };
  for(const {sf,path} of sourceModules){
    const symbol=checker.getSymbolAtLocation(sf);
    exportsByModule.set(path,symbol?[...new Set(checker.getExportsOfModule(symbol).flatMap(exportedIds))]:[]);
  }
  for(const node of nodes)for(const fn of node.functionDetails)fn.exported=exportsByModule.get(node.id)?.includes(fn.id)||false;
  const framework=expressEntries(sourceModules,checker,declarations);
  for(const binding of framework.bindings){
    const fn=analyzedFunctions.get(binding.entryFunctionId);
    const matches=framework.bindings.filter(other=>other.entryFunctionId===binding.entryFunctionId);
    if(fn?.kind==='callback'&&matches.length===1){
      fn.title=`${binding.method} ${binding.path} handler`;
      fn.summary='Handles a registered HTTP request. Registration does not establish execution.';
    }
  }
  for(const node of nodes)node.functions=node.functionDetails.map(fn=>fn.title);
  const workflows=discoverWorkflows({nodes,edges,functionEdges,coverage},{exportsByModule,bindings:framework.bindings});
  return {
    name,
    kind: "local",
    nodes,
    edges,
    functionEdges,
    workflows,
    updated: Date.now(),
    errors,
    analysisWarnings: [...new Set([...project.warnings,...framework.diagnostics.map(d=>`${d.module}:${d.line}: ${d.reason}`)])],
    coverage,
    fileCount: files.filter((f) => isSource(f.path)).length,
    explanationEvidence,
  };
}
export function diffModels(before, after) {
  for (const [field, statusField] of [
    ["edges", "edgeChanges"],
    ["functionEdges", "functionEdgeChanges"],
  ]) {
    const oldEdges = (before[field] || []).filter(
      ([a, b]) => before[statusField]?.[edgeKey(a, b)] !== "removed",
    );
    const newEdges = after[field] || [];
    const oldKeys = new Set(oldEdges.map(([a, b]) => edgeKey(a, b)));
    const newKeys = new Set(newEdges.map(([a, b]) => edgeKey(a, b)));
    after[statusField] = {};
    for (const [a, b] of newEdges)
      if (!oldKeys.has(edgeKey(a, b)))
        after[statusField][edgeKey(a, b)] = "added";
    after[field] = [...newEdges];
    for (const [a, b] of oldEdges)
      if (!newKeys.has(edgeKey(a, b))) {
        after[field].push([a, b]);
        after[statusField][edgeKey(a, b)] = "removed";
      }
  }
  const previous = new Map(before.nodes.map((n) => [n.id, n]));
  for (const n of after.nodes) {
    const old = previous.get(n.id);
    n.status = !old
      ? "added"
      : old.fingerprint !== n.fingerprint
        ? "modified"
        : "unchanged";
    if (n.status === "modified")
      n.change = "Implementation changed since the previous scan.";
    const previousFunctions = new Map(
      (old?.functionDetails || [])
        .filter((f) => f.status !== "removed")
        .map((f) => [f.id, f]),
    );
    for (const fn of n.functionDetails) {
      const prior = previousFunctions.get(fn.id);
      fn.status = !prior
        ? "added"
        : (prior.fingerprint || prior.raw) !== (fn.fingerprint || fn.raw)
          ? "modified"
          : "unchanged";
    }
    for (const fn of previousFunctions.values()) {
      if (!n.functionDetails.some((f) => f.id === fn.id)) {
        n.functionDetails.push({ ...fn, status: "removed" });
        n.functions.push(fn.title);
      }
    }
  }
  for (const n of before.nodes)
    if (n.status !== "removed" && !after.nodes.some((x) => x.id === n.id))
      after.nodes.push({
        ...n,
        status: "removed",
        change: "Removed since the previous scan.",
      });
  return after;
}
