import type {AnalysisContract} from './list-analysis';
import {canonicalFilterEnums} from './filter-expression';
import {declaredContractKey,normalizeContractScalar} from './contract-normalization';
import {aggregateOrderField,aggregateOutputContract, readAggregates} from './read-aggregation';

const plain=(value:unknown):value is Record<string,any>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
export function analysisFieldAddress(contract:AnalysisContract,address:string){
  if(Object.hasOwn(contract.fields,address)&&!['__proto__','prototype','constructor'].includes(address))return address;
  const fields=Object.entries(contract.fields).map(([key,definition])=>({key,spellings:[key,definition.label,...(definition.aliases||[])]}));
  const exact=declaredContractKey(address,fields);if(exact)return exact;
  // Only declared row envelopes and the known HTTP/result wrappers. Never
  // take the last segment of an arbitrary nested/private path.
  const prefixes=['result.','data.',...(contract.publicRowsField?[contract.publicRowsField+'.',contract.publicRowsField+'[].']:[])];
  for(const prefix of prefixes)if(address.startsWith(prefix)){
    const key=declaredContractKey(address.slice(prefix.length),fields);if(key)return key;
  }
}
const operatorAliases:Readonly<Record<string,string>>={
  '=':'eq','==':'eq','===':'eq','$eq':'eq','!=':'ne','!==':'ne','$ne':'ne',
  '>':'gt','>=':'gte','<':'lt','<=':'lte','$gt':'gt','$gte':'gte','$lt':'lt','$lte':'lte',
  '$in':'in','$nin':'nin',not_in:'nin',starts_with:'startsWith',ends_with:'endsWith',
};
/** Compile equivalent wire representations before validation. Invalid/unknown
 * members are retained so the validator cannot silently discard a condition. */
export function normalizeAnalysisPlan(raw:unknown,contract:AnalysisContract,evaluatedAt?:string):unknown{
  let plan=raw;
  if(typeof plan==='string')try{plan=JSON.parse(plan);}catch{return raw;}
  if(!plain(plan))return plan;
  const field=(value:unknown)=>typeof value==='string'?analysisFieldAddress(contract,value)||value:value;
  const predicate=(node:unknown,depth=0):unknown=>{
    if(!plain(node)||depth>6)return node;
    if(Object.keys(node).length===1){
      for(const key of ['all','any'] as const)if(Array.isArray(node[key]))return {[key]:node[key].map((child:unknown)=>predicate(child,depth+1))};
      if(Object.hasOwn(node,'not'))return {not:predicate(node.not,depth+1)};
    }
    const key=field(node.field),definition=typeof key==='string'?contract.fields[key]:undefined;
    const operator=typeof node.operator==='string'&&Object.hasOwn(operatorAliases,node.operator)?operatorAliases[node.operator]:node.operator;
    let next:Record<string,any>={...node,field:key,operator};
    next=canonicalFilterEnums(next,contract.fields,evaluatedAt) as typeof next;
    if(definition&&Object.hasOwn(next,'value')){
      const scalar=(value:unknown)=>normalizeContractScalar(value,definition.type,definition.values,definition.format==='date');
      next={...next,value:Array.isArray(next.value)?next.value.map(scalar):scalar(next.value)};
    }
    return next;
  };
  const result={...plan};
  if(Object.hasOwn(plan,'where'))result.where=predicate(plan.where);
  if(Array.isArray(plan.filters))result.filters=plan.filters.map((item:unknown)=>predicate(item));
  // filters is an AND list. Combining it with an existing OR/NOT tree means
  // AND the complete tree, never distribute/flatten its branches.
  const legacy=new Set(['eq','ne','gt','gte','lt','lte','contains']);
  if(Array.isArray(result.filters)&&(result.where!==undefined||result.filters.some((item:any)=>plain(item)&&!legacy.has(item.operator)))){
    const filters=result.filters;
    if(filters.length<=20){
      if(filters.length)result.where={all:[...(result.where!==undefined?[result.where]:[]),...filters]};
      delete result.filters;
    }
  }
  for(const key of ['sort','extreme'] as const)if(plain(result[key])){
    const order=result[key],direction=typeof order.direction==='string'?({ascending:'asc',descending:'desc'}[order.direction.toLowerCase()]||order.direction.toLowerCase()):order.direction;
    result[key]={...order,field:field(order.field),direction};
  }
  if(Object.hasOwn(result,'groupBy'))result.groupBy=field(result.groupBy);
  if(Array.isArray(result.select)){
    const selected=result.select.map(field);
    result.select=selected.length<=20?[...new Set(selected)]:selected;
  }
  const aggregate=(value:unknown)=>plain(value)?{...value,...(Object.hasOwn(value,'field')?{field:field(value.field)}:{}),operation:typeof value.operation==='string'?value.operation.toLowerCase():value.operation}:value;
  if(Object.hasOwn(result,'aggregate'))result.aggregate=aggregate(result.aggregate);
  if(Array.isArray(result.aggregates))result.aggregates=result.aggregates.map(aggregate);
  if(Object.hasOwn(result,'having')&&readAggregates(result).length){
    const measures=readAggregates(result);
    if(measures.every(item=>plain(item)&&['count','sum','avg'].includes(item.operation)&&(!item.field||Object.hasOwn(contract.fields,item.field)))){
      const output=aggregateOutputContract(contract,result);
      const address=(node:unknown,depth=0):unknown=>{
        if(!plain(node)||depth>6)return node;
        if(Object.keys(node).length===1){
          for(const key of ['all','any'] as const)if(Array.isArray(node[key]))return {[key]:node[key].map((child:unknown)=>address(child,depth+1))};
          if(Object.hasOwn(node,'not'))return {not:address(node.not,depth+1)};
        }
        if(typeof node.field!=='string')return node;
        const direct=analysisFieldAddress(output,node.field);
        const source=analysisFieldAddress(contract,node.field);
        return {...node,field:direct||(source?aggregateOrderField(contract,result,source):node.field)};
      };
      result.having=(normalizeAnalysisPlan({where:address(result.having)},output,evaluatedAt) as any).where;
    }
  }
  if(Object.hasOwn(result,'limit'))result.limit=normalizeContractScalar(result.limit,'number');
  return result;
}

export function canonicalAnalysisTarget(contract:AnalysisContract,target:string,rawPlan?:unknown){
  const normalized=target.replace(/^values\.analysis\./,'analysis.').replace(/^analysis\.aggregates\./,'analysis.aggregate.');
  const match=/^(result\.|analysis\.(?:filters|having|select|aggregate|sort|extreme|groupBy)\.)(.+)$/.exec(normalized);
  if(!match)return normalized;
  if(/^analysis\.(having|sort|extreme)\.$/.test(match[1])&&rawPlan!==undefined){
    try{
      const plan=normalizeAnalysisPlan(rawPlan,contract) as any;
      const measures=plain(plan)?readAggregates(plan):[];
      if(measures.length&&measures.every(item=>plain(item)&&['count','sum','avg'].includes(item.operation)&&(!item.field||Object.hasOwn(contract.fields,item.field)))){
        const output=aggregateOutputContract(contract,plan),source=analysisFieldAddress(contract,match[2]);
        const key=analysisFieldAddress(output,match[2])||(source?aggregateOrderField(contract,plan,source):undefined);
        if(key&&Object.hasOwn(output.fields,key))return match[1]+key;
      }
    }catch{/* Preserve invalid targets for ordinary validation. */}
  }
  const key=analysisFieldAddress(contract,match[2]);
  return key?match[1]+key:normalized;
}
