import ts from 'typescript';
import {sourceLocation} from './analysis-coverage.js';

const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
const unwrap = node => {
  while(node && (ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node)))node=node.expression;
  return node;
};

// Deliberately recognizes Express provenance, not variables named "app" or
// arbitrary methods named "get". Registration never adds a call edge.
export function expressEntries(sources, checker, declarations) {
  const diagnostics=[],routes=[],mounts=[],roots=new Set();
  const symbolAt=node=>{
    let symbol=checker.getSymbolAtLocation(node);
    if(symbol?.flags&ts.SymbolFlags.Alias)symbol=checker.getAliasedSymbol(symbol);
    return symbol;
  };
  const declarationOf=node=>symbolAt(node)?.declarations?.[0];
  const factory=(node,seen=new Set())=>{
    node=unwrap(node);if(!node||seen.has(node))return null;seen.add(node);
    if(ts.isPropertyAccessExpression(node)&&node.name.text==='Router'&&factory(node.expression,seen)==='express')return 'router';
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='require'&&literal(node.arguments[0])==='express'&&!checker.getSymbolAtLocation(node.expression)?.declarations?.length)return 'express';
    // Do not follow aliases into an unavailable package's synthetic symbol.
    const symbol=checker.getSymbolAtLocation(node);
    for(const declaration of symbol?.declarations||[]){
      let imp=declaration;
      while(imp&&!ts.isImportDeclaration(imp))imp=imp.parent;
      if(imp&&literal(imp.moduleSpecifier)==='express'&&!imp.importClause?.isTypeOnly){
        if(ts.isImportSpecifier(declaration))return !declaration.isTypeOnly&&(declaration.propertyName||declaration.name).text==='Router'?'router':null;
        if(ts.isImportClause(declaration)||ts.isNamespaceImport(declaration))return 'express';
      }
    }
    const d=declarationOf(node);
    return d&&ts.isVariableDeclaration(d)&&d.parent.flags&ts.NodeFlags.Const?factory(d.initializer,seen):null;
  };
  const instance=(node,seen=new Set())=>{
    node=unwrap(node);if(!node||seen.has(node))return null;seen.add(node);
    const d=declarationOf(node);
    if(d&&ts.isVariableDeclaration(d)&&d.parent.flags&ts.NodeFlags.Const){
      if(d.initializer&&ts.isCallExpression(unwrap(d.initializer))&&factory(unwrap(d.initializer).expression))return d;
      return instance(d.initializer,seen);
    }
    return null;
  };
  const handler=node=>{
    node=unwrap(node);if(!node)return null;
    const d=declarationOf(node);
    return declarations.get(node)||declarations.get(d)||declarations.get(d?.initializer)||null;
  };
  const registration=(source,node)=>({module:source.path,...sourceLocation(source.sf,node)});
  const warn=(source,node,reason)=>diagnostics.push({...registration(source,node),reason});
  const methods=new Set(['get','post','put','patch','delete','head','options','all']);
  for(const source of sources){
    const visit=node=>{
      if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isCallExpression(unwrap(node.initializer))&&factory(unwrap(node.initializer).expression)==='express')roots.add(node);
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
        const method=node.expression.name.text;
        let receiver=node.expression.expression,routePath;
        // app.route('/path').get(...).post(...) shares a verified route receiver.
        while(ts.isCallExpression(receiver)&&ts.isPropertyAccessExpression(receiver.expression)&&methods.has(receiver.expression.name.text))receiver=receiver.expression.expression;
        if(ts.isCallExpression(receiver)&&ts.isPropertyAccessExpression(receiver.expression)&&receiver.expression.name.text==='route'){
          routePath=literal(receiver.arguments[0]);receiver=receiver.expression.expression;
        }
        const owner=instance(receiver);
        if(owner&&method==='use'){
          const prefix=literal(node.arguments[0]);
          const offset=prefix===null?0:1;
          for(const argument of node.arguments.slice(offset)){
            const child=instance(argument);
            if(child)mounts.push({parent:owner,child,prefix:prefix??'',uncertain:prefix===null&&offset===0&&node.arguments.length>1&&!handler(node.arguments[0]),source,node});
          }
        }else if(owner&&methods.has(method)){
          const chained=routePath!==undefined;
          const path=chained?routePath:literal(node.arguments[0]);
          const args=node.arguments.slice(chained?0:1);
          // An Express app.get('setting') is a read, not a route registration.
          if(!args.length)return;
          if(path===null){warn(source,node,'Express route path is computed; no URL was assumed.');return;}
          const functionIds=args.map(handler);
          if(!functionIds.at(-1)){warn(source,node,'Express handler has no unique implementation in this snapshot.');return;}
          routes.push({owner,path,method:method.toUpperCase(),functionIds:functionIds.filter(Boolean),entryFunctionId:functionIds.at(-1),registration:registration(source,node),uncertain:functionIds.some(id=>!id),source,node});
        }
      }
      ts.forEachChild(node,visit);
    };
    visit(source.sf);
  }
  const prefixes=(owner,seen=new Set())=>{
    if(seen.has(owner))return [{prefix:null,uncertain:true}];
    const next=new Set(seen).add(owner),parents=mounts.filter(m=>m.child===owner);
    if(!parents.length)return [{prefix:'',uncertain:!roots.has(owner)}];
    return parents.flatMap(m=>prefixes(m.parent,next).map(p=>({prefix:p.prefix===null||m.uncertain?null:p.prefix+m.prefix,uncertain:p.uncertain||m.uncertain})));
  };
  const bindings=[];
  for(const route of routes)for(const prefix of prefixes(route.owner)){
    if(prefix.prefix===null){warn(route.source,route.node,'Express mount path is computed or ambiguous; no full route URL was assumed.');continue;}
    const path=(prefix.prefix+route.path).replace(/\/+/g,'/');
    const name=`${route.method} ${path}`;
    bindings.push({id:`http:${route.registration.module}:${name}`,name,path,method:route.method,functionIds:route.functionIds,entryFunctionId:route.entryFunctionId,registration:route.registration,...(prefix.uncertain||route.uncertain?{uncertain:true}:{})});
  }
  const distinct=[];
  for(const binding of bindings){
    const previous=distinct.find(other=>other.id===binding.id&&other.entryFunctionId===binding.entryFunctionId&&other.registration.line===binding.registration.line&&other.registration.column===binding.registration.column);
    if(previous)previous.uncertain=true;else distinct.push(binding);
  }
  const counts=new Map();for(const binding of distinct)counts.set(binding.id,(counts.get(binding.id)||0)+1);
  for(const binding of distinct)if(counts.get(binding.id)>1){binding.id+=`:${binding.registration.line}:${binding.registration.column}`;binding.uncertain=true;}
  return {bindings:distinct,diagnostics};
}
