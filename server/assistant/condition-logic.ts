/** Relationships extracted independently of the chosen action. */
export type ConditionLogic = string | {all:ConditionLogic[]} | {any:ConditionLogic[]} | {not:ConditionLogic};
export function parseConditionLogic(raw:unknown, ids:Set<string>):ConditionLogic {
  let nodes=0;const seen=new Set<string>();
  const visit=(v:any,depth:number):ConditionLogic=>{
    if(++nodes>80||depth>6)throw Error('INVALID_CONDITION_LOGIC');
    if(typeof v==='string'){if(!ids.has(v)||seen.has(v))throw Error('INVALID_CONDITION_LOGIC');seen.add(v);return v;}
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==1)throw Error('INVALID_CONDITION_LOGIC');
    if(Object.hasOwn(v,'not'))return {not:visit(v.not,depth+1)};
    const key=Object.hasOwn(v,'all')?'all':Object.hasOwn(v,'any')?'any':undefined;
    if(!key||!Array.isArray(v[key])||v[key].length<1||v[key].length>40)throw Error('INVALID_CONDITION_LOGIC');
    return {[key]:v[key].map((n:unknown)=>visit(n,depth+1))} as ConditionLogic;
  };return visit(raw,0);
}
export function logicSignature(tree:ConditionLogic):string {
  if(typeof tree==='string')return JSON.stringify(tree);
  if('not' in tree)return `not(${logicSignature(tree.not)})`;
  const key='all' in tree?'all':'any',children=key==='all'?(tree as {all:ConditionLogic[]}).all:(tree as {any:ConditionLogic[]}).any;
  const flatten=(node:ConditionLogic):ConditionLogic[]=>typeof node!=='string'&&key in node ? (node as any)[key].flatMap(flatten) : [node];
  const raw=children.flatMap(flatten).map(logicSignature).sort();
  // An independently reviewed abstract unit may lower to several predicates
  // in the legacy AND grammar. Its full conjunction still denotes that unit.
  const signatures=key==='all'?[...new Set(raw)]:raw;
  return signatures.length===1?signatures[0]:`${key}(${signatures.join(',')})`;
}
/** A native API predicate can be pushed down only through a conjunction. */
export function projectConditionLogic(tree:ConditionLogic, selected:Set<string>):ConditionLogic|undefined {
  if(!logicIds(tree).some(id=>selected.has(id)))return;
  if(typeof tree==='string')return selected.has(tree)?tree:undefined;
  if('all' in tree){const children=tree.all.map(t=>projectConditionLogic(t,selected)).filter((v):v is ConditionLogic=>v!==undefined);return children.length?{all:children}:undefined;}
  if('not' in tree){const n=projectConditionLogic(tree.not,selected);if(n===undefined)throw Error('UNSAFE_PREDICATE_PUSHDOWN');return {not:n};}
  const children=tree.any.map(t=>projectConditionLogic(t,selected));if(children.some(v=>v===undefined))throw Error('UNSAFE_PREDICATE_PUSHDOWN');
  return {any:children as ConditionLogic[]};
}
export function logicIds(tree:ConditionLogic):string[]{return typeof tree==='string'?[tree]:'not' in tree?logicIds(tree.not):('all' in tree?tree.all:tree.any).flatMap(logicIds);}
export function nonConjunctiveGroups(tree:ConditionLogic):string[][] {
  if(typeof tree==='string')return [];
  if('not' in tree||'any' in tree)return [logicIds(tree)];
  return tree.all.flatMap(nonConjunctiveGroups);
}
