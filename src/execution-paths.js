import ts from 'typescript';
import {functionTarget,sourceLocation} from './analysis-coverage.js';
const words=value=>value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').toLowerCase();
const unique=values=>[...new Set(values)];
const clipped=value=>String(value).slice(0,180);

// A bounded syntax tree, not a simulated trace. Sibling statements retain source
// order; branches and exception regions remain separate instead of being flattened.
export function executionPaths(fn,source,checker,declarations) {
  const limitations=[],calls=[];let count=0;
  const expression=(node,depth=0)=>{
    if(!node||depth>5){if(depth>5)limitations.push('Deeply nested expressions are simplified.');return 'computed value';}
    const e=n=>expression(n,depth+1);
    if(ts.isIdentifier(node)||ts.isPrivateIdentifier(node))return words(node.text);
    if(ts.isPropertyAccessExpression(node))return `${e(node.expression)} ${words(node.name.text)}`;
    if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node)||ts.isAwaitExpression(node))return e(node.expression);
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return `“${clipped(node.text)}”`;
    if(ts.isNumericLiteral(node))return node.text;
    if(node.kind===ts.SyntaxKind.NullKeyword)return 'empty value';
    if(node.kind===ts.SyntaxKind.TrueKeyword)return 'true';
    if(node.kind===ts.SyntaxKind.FalseKeyword)return 'false';
    const wholeNumber=n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&ts.isIdentifier(n.expression.expression)&&n.expression.expression.text==='Number'&&n.expression.name.text==='isInteger'&&!checker.getSymbolAtLocation(n.expression.expression)?.declarations?.length;
    if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken&&wholeNumber(node.operand))return `${e(node.operand.arguments[0])} is not a whole number`;
    if(ts.isPrefixUnaryExpression(node))return node.operator===ts.SyntaxKind.ExclamationToken?`${e(node.operand)} is absent, empty, or false`:node.operator===ts.SyntaxKind.MinusToken?`negative ${e(node.operand)}`:'computed value';
    if(ts.isBinaryExpression(node)){
      const op={
        [ts.SyntaxKind.AsteriskToken]:'multiplied by',[ts.SyntaxKind.SlashToken]:'divided by',[ts.SyntaxKind.PlusToken]:'plus',[ts.SyntaxKind.MinusToken]:'minus',
        [ts.SyntaxKind.EqualsEqualsEqualsToken]:'exactly equals',[ts.SyntaxKind.ExclamationEqualsEqualsToken]:'does not exactly equal',
        [ts.SyntaxKind.EqualsEqualsToken]:'loosely equals',[ts.SyntaxKind.ExclamationEqualsToken]:'does not loosely equal',
        [ts.SyntaxKind.GreaterThanEqualsToken]:'is at least',[ts.SyntaxKind.LessThanEqualsToken]:'is at most',
        [ts.SyntaxKind.GreaterThanToken]:'is greater than',[ts.SyntaxKind.LessThanToken]:'is less than',
        [ts.SyntaxKind.AmpersandAmpersandToken]:'and',[ts.SyntaxKind.BarBarToken]:'or',[ts.SyntaxKind.QuestionQuestionToken]:'or, if absent,',
      }[node.operatorToken.kind];
      return op?`${e(node.left)} ${op} ${e(node.right)}`:'computed value';
    }
    if(ts.isConditionalExpression(node))return `${e(node.condition)}: ${e(node.whenTrue)}; otherwise ${e(node.whenFalse)}`;
    if(ts.isCallExpression(node)||ts.isNewExpression(node)){
      const name=ts.isIdentifier(node.expression)?node.expression.text:ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:null;
      if(ts.isNewExpression(node)&&/Error$/.test(name||''))return node.arguments?.[0]?e(node.arguments[0]):'an error';
      if(wholeNumber(node))return `${e(node.arguments[0])} is a whole number`;
      if(ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==='Math'&&!checker.getSymbolAtLocation(node.expression.expression)?.declarations?.length){
        if(name==='round')return `${e(node.arguments[0])}, rounded to a whole number`;
        if(name==='max')return `the greater of ${node.arguments.map(e).join(' and ')}`;
        if(name==='min')return `the lesser of ${node.arguments.map(e).join(' and ')}`;
      }
      return name?`result of ${words(name)}`:'result of a computed operation';
    }
    if(ts.isObjectLiteralExpression(node))return 'object with '+node.properties.map(p=>p.name?words(p.name.text||'computed field'):'additional fields').join(', ');
    if(ts.isArrayLiteralExpression(node))return 'list of values';
    if(ts.isTemplateExpression(node))return 'constructed text';
    return 'computed value';
  };
  const locate=node=>sourceLocation(source,node);
  const callNodes=(node,conditions=[],region='normal')=>{
    const out=[];
    const visit=n=>{
      if(ts.isFunctionLike(n))return;
      if(calls.length>=200){limitations.push('Call outline shortened for this operation.');return;}
      // Arguments/receiver are evaluated before the enclosing call.
      if(ts.isConditionalExpression(n)){
        out.push(...callNodes(n.condition,conditions,region));
        out.push(...callNodes(n.whenTrue,[...conditions,expression(n.condition)],region));
        out.push(...callNodes(n.whenFalse,[...conditions,`otherwise: ${expression(n.condition)}`],region));return;
      }
      if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)){
        out.push(...callNodes(n.left,conditions,region));
        const outcome=n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken?'is truthy':n.operatorToken.kind===ts.SyntaxKind.BarBarToken?'is false, empty, or absent':'is null or undefined';
        out.push(...callNodes(n.right,[...conditions,`${expression(n.left)} ${outcome}`],region));return;
      }
      ts.forEachChild(n,visit);
      if(ts.isCallExpression(n)||ts.isNewExpression(n)){
        if(ts.isNewExpression(n)&&ts.isIdentifier(n.expression)&&['Error','TypeError','RangeError'].includes(n.expression.text)&&!checker.getSymbolAtLocation(n.expression)?.declarations?.length)return;
        const target=functionTarget(n,checker,declarations);
        const label=ts.isIdentifier(n.expression)?words(n.expression.text):ts.isPropertyAccessExpression(n.expression)?words(n.expression.name.text):'computed operation';
        const awaited=ts.isAwaitExpression(n.parent);
        if(ts.isPropertyAccessExpression(n.expression)&&ts.isIdentifier(n.expression.expression)&&n.expression.expression.text==='Promise'&&['all','race','allSettled','any'].includes(n.expression.name.text)&&!checker.getSymbolAtLocation(n.expression.expression)?.declarations?.length)
          limitations.push('Concurrency or callback scheduling is not established.');
        const optional=!!n.questionDotToken||!!n.expression.questionDotToken;
        const call={kind:'call',label:`${awaited?'Await':'Call'} ${label}`,...locate(n),...(target?{target}:{}),conditions:[...conditions,...(optional?['optional receiver or operation is present']:[])].map(clipped),region,awaited,effect:/^(save|insert|delete|remove|update|write|send|publish|emit|create|set|add|push|pop|splice|charge|refund|take|release)/i.test(label)};
        out.push(call);calls.push(call);
      }
    };
    visit(node);return out;
  };
  const block=(node,conditions=[],region='normal')=>{
    if(!node)return [];
    if(++count>200){if(!limitations.includes('Path outline shortened for this operation.'))limitations.push('Path outline shortened for this operation.');return [];}
    const isLocal=name=>name&&ts.isIdentifier(name)&&(checker.getSymbolAtLocation(name)?.declarations||[]).some(d=>d.getSourceFile()===source&&d.getStart(source)>=fn.getStart(source)&&d.end<=fn.end);
    const step=(kind,label,extra={})=>{if(String(label).length>180)limitations.push('Long expressions are shortened.');return {kind,label:clipped(label),...locate(node),...extra};};
    const recurse=n=>block(n,conditions,region);
    if(ts.isBlock(node))return node.statements.flatMap(recurse);
    if(ts.isIfStatement(node)){
      const condition=expression(node.expression);
      return [...callNodes(node.expression,conditions,region),step('branch',condition,{children:block(node.thenStatement,[...conditions,condition],region),otherwise:block(node.elseStatement,[...conditions,`otherwise: ${condition}`],region)})];
    }
    if(ts.isTryStatement(node))return [step('try','Try these operations',{catches:!!node.catchClause,children:block(node.tryBlock,conditions,'try'),failure:node.catchClause?block(node.catchClause.block,[...conditions,'an operation in this try block throws'],'catch'):[],cleanup:block(node.finallyBlock,conditions,'finally')})];
    if(ts.isReturnStatement(node))return [...(node.expression?callNodes(node.expression,conditions,region):[]),step('return',node.expression?expression(node.expression):'no value')];
    if(ts.isThrowStatement(node))return [...callNodes(node.expression,conditions,region),step('throw',expression(node.expression))];
    if(ts.isVariableStatement(node))return node.declarationList.declarations.flatMap(d=>d.initializer?[...callNodes(d.initializer,conditions,region),step('value',`${expression(d.name)}: ${expression(d.initializer)}`)]:[]);
    if(ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node))return [];
    if(ts.isIterationStatement(node,false)||ts.isSwitchStatement(node)||ts.isWithStatement(node)){
      limitations.push('Loop or dynamic branch ordering is not expanded.');return [step('unknown','Loop or dynamic branch; execution order is unknown')];
    }
    if(ts.isExpressionStatement(node)){
      const operations=callNodes(node.expression,conditions,region);
      if(ts.isBinaryExpression(node.expression)&&!isLocal(node.expression.left)&&node.expression.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&node.expression.operatorToken.kind<=ts.SyntaxKind.LastAssignment)
        operations.push(step('change',`Updates ${expression(node.expression.left)}`));
      if(!isLocal(node.expression.operand)&&(ts.isPostfixUnaryExpression(node.expression)||ts.isPrefixUnaryExpression(node.expression)&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.expression.operator)))operations.push(step('change',`Updates ${expression(node.expression.operand)}`));
      return operations;
    }
    if(ts.isEmptyStatement(node))return [];
    limitations.push('Some syntax is not expanded in the path outline.');return [step('unknown','Additional operation; behavior not expanded')];
  };
  const steps=ts.isBlock(fn.body)?block(fn.body):[...callNodes(fn.body),{kind:'return',label:clipped(expression(fn.body)),...locate(fn.body)}];
  return {version:1,steps,limitations:unique(limitations),evidence:'Static syntax; branches, calls, and exception regions are possible behavior, not recorded execution.'};
}

export function pathSummary(behavior) {
  const checks=[],outputs=[],changes=[],failures=[];
  const concise=steps=>steps.filter(s=>['call','return','throw','change'].includes(s.kind)).map(s=>s.kind==='return'?`return ${s.label}`:s.kind==='throw'?`stop with error: ${s.label}`:s.label.toLowerCase()).join(', then ');
  const walk=(steps,region='normal')=>{
    for(const [index,step] of steps.entries()){
      if(step.kind==='call'&&step.awaited&&region==='normal'){
        const later=steps.slice(index+1).filter(s=>s.kind==='call'&&s.effect).map(s=>s.label.toLowerCase());
        failures.push(`If ${step.label.toLowerCase()} fails → error propagates${later.length?`; later ${later.join(' and ')} are skipped`:''}.`);
      }
      if(step.kind==='value')checks.push(step.label);
      if(step.kind==='branch'){
        checks.push(`When ${step.label} → ${concise(step.children)||'follow the conditional path'}`);
        if(step.otherwise?.length)checks.push(`Otherwise → ${concise(step.otherwise)||'follow the alternative path'}`);
        walk(step.children,region);walk(step.otherwise||[],region);
      }
      if(step.kind==='return')outputs.push(step.label);
      if(step.kind==='throw'&&region!=='catch')failures.push(`Stops with ${step.label}`);
      if(step.kind==='change')changes.push(step.label);
      if(step.kind==='call'&&step.effect)changes.push(step.label+(step.conditions?.length?` when ${step.conditions.join('; ')}`:'')+(region==='catch'?' if the protected operation fails':region==='finally'?' during final cleanup':''));
      if(step.kind==='try'){
        const protectedCalls=concise(step.children.filter(s=>s.kind==='call')),recovery=concise(step.failure||[]),cleanup=concise(step.cleanup||[]);
        if(recovery)failures.push(`If ${protectedCalls||'the protected block'} fails → ${recovery}${step.children.some(s=>s.kind==='call'&&!s.awaited)?'. This catch handles synchronous throws; unawaited promise rejections may escape.':''}`);
        else if(step.catches)failures.push('Errors in the protected block are caught without explicit recovery.');
        else failures.push('No catch is declared for the protected block; errors propagate.');
        if(cleanup)failures.push(`Finally → ${cleanup}; a return or error in cleanup may replace the earlier outcome.`);
        walk(step.children,'try');walk(step.failure||[],'catch');walk(step.cleanup||[],'finally');
      }
    }
  };
  walk(behavior.steps);
  return {decisions:unique(checks),outputs:unique(outputs),effects:unique(changes),failures:unique(failures),limitations:behavior.limitations};
}
