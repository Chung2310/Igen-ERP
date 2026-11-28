import type {AssistantWorkflow,AssistantField,AssistantDataShape} from '../../src/shared/assistant-workflow';
import {declaredContractKey,normalizeContractScalar} from './contract-normalization';
import {isProtectedAssistantKey} from './structured-data';

class InputAliasConflict extends Error {}
function normalizeStructuredValue(shape:AssistantDataShape,value:unknown,depth=0):unknown{
 if(depth>8||shape.reference)return value;
 if(shape.type==='array'&&Array.isArray(value)&&shape.items&&value.length<=100)return value.map(item=>normalizeStructuredValue(shape.items!,item,depth+1));
 if(shape.type==='object'&&shape.keys&&value&&typeof value==='object'&&!Array.isArray(value)){
  const out:Record<string,unknown>=Object.create(null);
  const fields=Object.entries(shape.keys).map(([key,child])=>({key,spellings:[key,...(child.label?[child.label]:[])]}));
  for(const [raw,entry]of Object.entries(value)){
   const key=isProtectedAssistantKey(raw)?raw:declaredContractKey(raw,fields)||raw;
   const child=Object.hasOwn(shape.keys,key)?normalizeStructuredValue(shape.keys[key],entry,depth+1):entry;
   if(Object.hasOwn(out,key)&&JSON.stringify(out[key])!==JSON.stringify(child))throw new InputAliasConflict();
   Object.defineProperty(out,key,{value:child,enumerable:true,writable:true,configurable:true});
  }
  return out;
 }
 return normalizeContractScalar(value,shape.type,shape.options?Object.fromEntries(shape.options.map(option=>[String(option),String(option)])):undefined,shape.type==='date');
}

/** Resolve schema spellings, never guesses based on a user's sentence. Exact
 * canonical keys win; aliases must identify exactly one field. */
export function assistantInputAddress(workflow:AssistantWorkflow,address:string){
 const matches=workflow.fields.flatMap(field=>{
  const spellings=[field.key,...(field.apiKey?[field.apiKey,...(field.source?[`${field.source}_${field.apiKey}`,`${field.source}.${field.apiKey}`]:[])]:[])];
  return [...new Set(spellings)].filter(key=>address===key||address.startsWith(key+'.')||address.startsWith(key+'['))
   .map(key=>({field,key,canonical:field.key+address.slice(key.length)}));
 });
 const exact=matches.filter(match=>match.key===match.field.key);
 const candidates=exact.length?exact:matches;
 const longest=Math.max(0,...candidates.map(match=>match.key.length));
 const best=candidates.filter(match=>match.key.length===longest);
 if(best.length)return new Set(best.map(match=>match.canonical)).size===1?best[0]:undefined;
 const key=declaredContractKey(address,workflow.fields.map(field=>({key:field.key,spellings:[field.key,field.label,...(field.apiKey?[field.apiKey,...(field.source?[`${field.source}_${field.apiKey}`,`${field.source}.${field.apiKey}`]:[])]:[])]})));
 const field=workflow.fields.find(field=>field.key===key);
 return field?{field,key:field.key,canonical:field.key}:undefined;
}

export function normalizeAssistantFieldValue(field:AssistantField,value:unknown){
 if(field.reference)return value;
 if(field.type==='json'&&field.structure){
  let data=value;
  if(typeof data==='string'){
   if(data.length>(field.structure.type==='array'?1_000_000:4_000))return value;
   try{data=JSON.parse(data);}catch{return value;}
  }
  if(data===null||typeof data!=='object')return value;
  try{
   const normalized=normalizeStructuredValue(field.structure,data);
   return JSON.stringify(normalized,(_key,cell)=>{
    if(cell===undefined||['function','symbol','bigint'].includes(typeof cell)||typeof cell==='number'&&!Number.isFinite(cell))throw new Error('INVALID_JSON_VALUE');
    return cell;
   });
  }catch(error){if(error instanceof InputAliasConflict)throw error;return value;}
 }
 return normalizeContractScalar(value,field.type,field.options?Object.fromEntries(field.options.map(option=>[option,option])):undefined,field.type==='date');
}

/** Keep unknown keys for the normal contract validator. Conflicting aliases
 * are a model plan defect, not a question the user needs to answer. */
export function normalizeAssistantInputValues(workflow:AssistantWorkflow,provided:Record<string,unknown>){
 const values:Record<string,unknown>=Object.create(null),conflicts=new Set<string>();
 for(const [key,value] of Object.entries(provided)){
  const address=assistantInputAddress(workflow,key);
  const target=address&&address.canonical===address.field.key?address.canonical:key;
  if(['__proto__','constructor','prototype'].includes(key)||['__proto__','constructor','prototype'].includes(target)){conflicts.add(key);continue;}
  let normalized=value;
  try{if(address&&target===address.field.key)normalized=normalizeAssistantFieldValue(address.field,value);}
  catch(error){if(!(error instanceof InputAliasConflict))throw error;conflicts.add(target);}
  if(Object.hasOwn(values,target)&&JSON.stringify(values[target])!==JSON.stringify(normalized))conflicts.add(target);
  else values[target]=normalized;
 }
 return {values,conflicts:[...conflicts]};
}
