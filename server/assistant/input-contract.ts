import type {AssistantWorkflow} from '../../src/shared/assistant-workflow';

/** Resolve schema spellings, never guesses based on a user's sentence. Exact
 * canonical keys win; aliases must identify exactly one field. */
export function assistantInputAddress(workflow:AssistantWorkflow,address:string){
 const matches=workflow.fields.flatMap(field=>{
  const spellings=[field.key,...(field.apiKey?[field.apiKey,...(field.source?[`${field.source}_${field.apiKey}`]:[])]:[])];
  return [...new Set(spellings)].filter(key=>address===key||address.startsWith(key+'.')||address.startsWith(key+'['))
   .map(key=>({field,key,canonical:field.key+address.slice(key.length)}));
 });
 const exact=matches.filter(match=>match.key===match.field.key);
 const candidates=exact.length?exact:matches;
 const longest=Math.max(0,...candidates.map(match=>match.key.length));
 const best=candidates.filter(match=>match.key.length===longest);
 return new Set(best.map(match=>match.canonical)).size===1?best[0]:undefined;
}

/** Keep unknown keys for the normal contract validator. Conflicting aliases
 * are a model plan defect, not a question the user needs to answer. */
export function normalizeAssistantInputValues(workflow:AssistantWorkflow,provided:Record<string,unknown>){
 const values:Record<string,unknown>=Object.create(null),conflicts=new Set<string>();
 for(const [key,value] of Object.entries(provided)){
  const address=assistantInputAddress(workflow,key);
  const target=address&&address.canonical===address.field.key?address.canonical:key;
  if(['__proto__','constructor','prototype'].includes(key)||['__proto__','constructor','prototype'].includes(target)){conflicts.add(key);continue;}
  if(Object.hasOwn(values,target)&&JSON.stringify(values[target])!==JSON.stringify(value))conflicts.add(target);
  else values[target]=value;
 }
 return {values,conflicts:[...conflicts]};
}
