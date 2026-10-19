import ts from "typescript";
import { edgeKey } from "./graph-activity.js";
const excluded =
  /(^|\/)(node_modules|\.git|dist|build|coverage|__tests__|tests?|\.next|vendor)(\/|$)|\.(test|spec|config)\.[cm]?[jt]sx?$|\.d\.ts$/i;
export const isSource = (path) =>
  /\.[cm]?[jt]sx?$/.test(path) && !excluded.test(path);
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
          : `Handles ${w.toLowerCase()}.`;
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
  const sources = new Map(
    files.filter((f) => isSource(f.path)).map((f) => [f.path, f.text]),
  );
  const options = {
    allowJs: true,
    noLib: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
  };
  const host = {
    getSourceFile: (path) =>
      sources.has(path)
        ? ts.createSourceFile(
            path,
            sources.get(path),
            ts.ScriptTarget.Latest,
            true,
          )
        : undefined,
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => "",
    getDirectories: () => [],
    fileExists: (path) => sources.has(path),
    readFile: (path) => sources.get(path),
    getCanonicalFileName: (path) => path,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  const checker = program.getTypeChecker();
  const declarations = new Map(),
    callSites = [];
  const nodes = [],
    imports = new Map(),
    functions = [],
    errors = [],
    explanationEvidence = [];
  for (const { path, text } of files.filter((f) => isSource(f.path))) {
    const sf = program.getSourceFile(path);
    if (sf.parseDiagnostics.length) errors.push(path);
    const id = path,
      layer = layerFor(path),
      fns = [],
      moduleImports = [];
    for (const st of sf.statements)
      if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier))
        moduleImports.push(st.moduleSpecifier.text);
    // Local AI evidence includes state, constants and types, not just function bodies.
    const moduleDeclarations = sf.statements.flatMap(st => {
      if (ts.isVariableStatement(st)) return st.declarationList.declarations
        .filter(d => !d.initializer || !ts.isArrowFunction(d.initializer) && !ts.isFunctionExpression(d.initializer))
        .map(d => `${st.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let'} ${d.getText(sf)};`);
      if (ts.isClassDeclaration(st)) return st.members.filter(ts.isPropertyDeclaration).map(p => p.getText(sf));
      return ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)
        ? [st.getText(sf)] : [];
    });
    const evidence={id, declarations:moduleDeclarations.join('\n'), imports:moduleImports,functions:[]};
    explanationEvidence.push(evidence);
    const visit = (n) => {
      if (
        (ts.isFunctionDeclaration(n) ||
          ts.isMethodDeclaration(n) ||
          ts.isArrowFunction(n) ||
          ts.isFunctionExpression(n)) &&
        n.body
      ) {
        const fnName =
          (n.name && ts.isIdentifier(n.name) ? n.name.text : null) ||
          (ts.isVariableDeclaration(n.parent)
            ? ts.isIdentifier(n.parent.name) ? n.parent.name.text : null
            : ts.isPropertyAssignment(n.parent)
              ? ts.isIdentifier(n.parent.name) ? n.parent.name.text : null
              : null);
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
                ts.isArrowFunction(c) ||
                ts.isFunctionExpression(c))
            )
              return;
            if (ts.isCallExpression(c)) {
              callSites.push([fnId, c]);
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
            title: words(fnName),
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
            summary: actionText(fnName),
            raw: n.getText(sf),
            parent: id,
          };
          fns.push(fn);
          evidence.functions.push({id:fnId,...facts});
          functions.push(fn);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    if (!fns.length) continue;
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
    const title = baseTitle.toLowerCase().includes(suffix)
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
      summary: `${fns.length} operations in ${title.toLowerCase()}. Select a function for its inputs, results, and behavior.`,
      inputs: [...new Set(fns.flatMap((f) => f.inputs))].slice(0, 8),
      outputs: [...new Set(fns.flatMap((f) => f.outputs))].slice(0, 6),
      decisions: [...new Set(fns.flatMap((f) => f.decisions))],
      effects: [...new Set(fns.flatMap((f) => f.effects))],
      functions: fns.map((f) => f.title),
      functionDetails: fns,
      evidence: "Parsed structure · inferred labels",
      source: path,
      status: "unchanged",
      fingerprint: text,
    });
    imports.set(id, moduleImports);
  }
  const edges = [],
    ids = new Set(nodes.map((n) => n.id));
  const normalize = (p) => {
    const a = [];
    for (const s of p.split("/")) {
      if (s === "..") a.pop();
      else if (s !== "." && s) a.push(s);
    }
    return a.join("/");
  };
  for (const [path, imps] of imports)
    for (const imp of imps) {
      if (!imp.startsWith(".")) continue;
      const target = normalize(
        path.split("/").slice(0, -1).join("/") + "/" + imp,
      ).replace(/\.[cm]?jsx?$/, "");
      const found = [
        target,
        ...[
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          "/index.ts",
          "/index.tsx",
          "/index.js",
        ].map((ext) => target + ext),
      ].find((p) => ids.has(p));
      if (
        found &&
        found !== path &&
        !edges.some((e) => e[0] === path && e[1] === found)
      )
        edges.push([path, found]);
    }
  const entries = nodes.filter((n) => n.layer === "controller");
  const functionEdges = [];
  for (const [from, call] of callSites) {
    const target = checker.getResolvedSignature(call)?.declaration;
    const to = declarations.get(target);
    if (to && !functionEdges.some(([a, b]) => a === from && b === to))
      functionEdges.push([from, to]);
    if(to && ts.isVariableDeclaration(call.parent)) {
      const file=explanationEvidence.find(e=>e.id===call.getSourceFile().fileName);
      if(file)(file.callResults ||= []).push({from,to,resultName:call.parent.name.getText(call.getSourceFile())});
    }
  }
  const roots = entries.length
    ? entries
    : nodes.filter((n) => !edges.some((e) => e[1] === n.id));
  const reach = (id) => {
    const seen = new Set([id]),
      q = [id];
    while (q.length) {
      const current = q.shift();
      for (const [a, b] of edges)
        if (a === current && !seen.has(b)) {
          seen.add(b);
          q.push(b);
        }
    }
    return [...seen];
  };
  const workflows = roots.slice(0, 20).map((n) => ({
    id: n.id,
    name: n.title,
    description: "Inferred from module dependencies",
    icon: n.icon,
    nodes: reach(n.id),
    steps: reach(n.id).length,
  }));
  return {
    name,
    kind: "local",
    nodes,
    edges,
    functionEdges,
    workflows,
    updated: Date.now(),
    errors,
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
        : prior.raw !== fn.raw
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
