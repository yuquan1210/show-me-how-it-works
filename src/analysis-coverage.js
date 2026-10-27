import ts from 'typescript';

const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
export const sourceLocation = (source, node) => {
  const {line, character} = source.getLineAndCharacterOfPosition(node.getStart(source));
  return {line: line + 1, column: character + 1};
};

export function moduleDependencies(source, path, checker, project) {
  const records = [], loaders = new Set();
  const add = (node, specifier, kind, typeOnly = false) => {
    const to = specifier === null ? undefined : project.resolveImport(specifier, path);
    records.push({
      id: `${path}:dependency:${node.getStart(source)}`, module: path, kind, specifier, typeOnly,
      ...sourceLocation(source, node),
      ...(to ? {status: 'resolved', to, reason: 'Module resolved inside the imported snapshot.'}
        : specifier === null ? {status: 'unresolved', reason: 'Module location is computed; no target was assumed.'}
          : project.importBoundary(specifier, path)),
    });
  };
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly = !!clause?.isTypeOnly || !!(bindings && ts.isNamedImports(bindings) && !clause.name && bindings.elements.length && bindings.elements.every(e => e.isTypeOnly));
      add(node, literal(node.moduleSpecifier), 'import', typeOnly);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const typeOnly = !!node.isTypeOnly || !!(clause && ts.isNamedExports(clause) && clause.elements.length && clause.elements.every(e => e.isTypeOnly));
      add(node, literal(node.moduleSpecifier), 're-export', typeOnly);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node, literal(node.moduleReference.expression), 'import', !!node.isTypeOnly);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, literal(node.argument.literal), 'type import', true);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        add(node, literal(node.arguments[0]), 'dynamic import'); loaders.add(node);
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && !checker.getSymbolAtLocation(node.expression)?.declarations?.length) {
        add(node, literal(node.arguments[0]), 'require'); loaders.add(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {records, loaders};
}

export function functionTarget(node, checker, declarations) {
  const declaration = checker.getResolvedSignature(node)?.declaration;
  if (declarations.has(declaration)) return declarations.get(declaration);
  // Overload signatures have no body. Match their one declared implementation.
  let candidates = declaration?.name ? checker.getSymbolAtLocation(declaration.name)?.declarations || [] : [];
  if (declaration && ts.isConstructorDeclaration(declaration)) candidates = declaration.parent.members.filter(ts.isConstructorDeclaration);
  const targets = [...new Set(candidates.map(d => declarations.get(d)).filter(Boolean))];
  return targets.length === 1 ? targets[0] : undefined;
}

function expressionFunction(expression, checker, declarations) {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression) || ts.isTypeAssertionExpression(expression)) expression = expression.expression;
  if (declarations.has(expression)) return declarations.get(expression);
  let symbol = checker.getSymbolAtLocation(expression);
  if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const targets = [...new Set((symbol?.declarations || []).map(d => declarations.get(d) || declarations.get(d.initializer)).filter(Boolean))];
  return targets.length === 1 ? targets[0] : undefined;
}

const runtimeNames = new Set(['Math', 'JSON', 'Object', 'Array', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Number', 'String', 'Boolean', 'Symbol', 'BigInt', 'console', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'URL', 'URLSearchParams', 'parseInt', 'parseFloat', 'isNaN']);

export function collectCallRecords(source, path, checker, declarations, dependencies, loaders) {
  const calls = [], callbackReferences = [], callResults = [];
  const visit = (node, owner = path) => {
    owner = declarations.get(node) || owner;
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && !loaders.has(node)) {
      const expression = node.expression;
      const computed = ts.isElementAccessExpression(expression) && literal(expression.argumentExpression) === null;
      const to = computed ? undefined : functionTarget(node, checker, declarations);
      let rootExpression = expression;
      while (ts.isPropertyAccessExpression(rootExpression) || ts.isElementAccessExpression(rootExpression)) rootExpression = rootExpression.expression;
      const symbol = checker.getSymbolAtLocation(rootExpression);
      const importDeclaration = symbol?.declarations?.map(d => {
        while (d && !ts.isImportDeclaration(d) && !ts.isImportEqualsDeclaration(d)) d = d.parent;
        return d;
      }).find(Boolean);
      const dependency = importDeclaration && dependencies.find(d => d.id === `${path}:dependency:${importDeclaration.getStart(source)}`);
      const runtimeValue = (symbol?.declarations || []).some(d => d.initializer && ts.isNewExpression(d.initializer)
        && ts.isIdentifier(d.initializer.expression) && runtimeNames.has(d.initializer.expression.text)
        && !checker.getSymbolAtLocation(d.initializer.expression)?.declarations?.length);
      const primitiveReceiver = ts.isPropertyAccessExpression(expression) && !!(checker.getTypeAtLocation(expression.expression).flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike));
      const runtime = runtimeValue || primitiveReceiver || ts.isIdentifier(rootExpression) && runtimeNames.has(rootExpression.text) && !symbol?.declarations?.length;
      const label = ts.isIdentifier(expression) ? expression.text
        : ts.isPropertyAccessExpression(expression) ? expression.name.text
          : ts.isArrowFunction(expression) || ts.isFunctionExpression(expression) || ts.isParenthesizedExpression(expression) ? 'Anonymous operation' : 'Computed operation';
      const status = to ? 'resolved' : computed ? 'unresolved' : dependency?.status === 'external' || runtime ? 'external' : 'unresolved';
      const reason = to ? 'Statically resolved implementation; execution is not verified.'
        : computed ? 'Computed call target; no implementation was assumed.'
          : dependency ? dependency.status === 'resolved' ? 'Imported module is known, but this operation has no resolved implementation.' : dependency.reason
            : runtime ? 'Runtime-provided operation; implementation is outside the imported snapshot.'
              : ts.isNewExpression(node) ? 'No unique explicit constructor implementation was resolved.' : 'No unique implementation was resolved; dispatch or supplied callbacks may be dynamic.';
      const call = {id: `${path}:call:${node.getStart(source)}`, module: path, from: owner,
        kind: ts.isNewExpression(node) ? 'construct' : 'call', label, ...sourceLocation(source, node), status, reason,
        ...(to ? {to} : {}), ...(dependency ? {dependency: dependency.id} : {})};
      calls.push(call);
      if (to && ts.isVariableDeclaration(node.parent)) callResults.push({from: owner, to, resultName: node.parent.name.getText(source)});
      for (const [index, argument] of (node.arguments || []).entries()) {
        const target = expressionFunction(argument, checker, declarations);
        const functionValued = checker.getNonNullableType(checker.getTypeAtLocation(argument)).getCallSignatures().length > 0;
        if (target || functionValued) callbackReferences.push({call: call.id, from: owner, ...(target ? {to: target} : {}), argument: index + 1,
          status: target ? 'resolved' : 'unresolved',
          reason: target ? 'Passed as an argument; invocation and timing are not established.' : 'Function-valued argument has no unique implementation; invocation and timing are not established.'});
      }
    }
    ts.forEachChild(node, child => visit(child, owner));
  };
  visit(source);
  return {calls, callbackReferences, callResults};
}
