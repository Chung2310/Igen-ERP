import type {AssistantField} from '../../src/shared/assistant-workflow';
import type {AssistantOperation} from './catalog';
/** A strict inequality on an integer domain has an exact inclusive bound.
 * Only explicitly reviewed API semantics are eligible; never infer from names. */
export function matchesNativeNumericPredicate(operation:AssistantOperation,field:AssistantField,operator:string,value:unknown,actual:unknown):boolean {
  const rule=operation.queryPredicates?.[field.key];
  if(!(operation.method==='GET'||operation.readOnly)||!rule||field.source!=='query'||field.type!=='number'||typeof value!=='number'||!Number.isFinite(value)||typeof actual!=='number'||!Number.isFinite(actual))return false;
  if(!rule.integer)return operator===rule.operator&&actual===value;
  if(!Number.isSafeInteger(actual)||Math.abs(value)>Number.MAX_SAFE_INTEGER)return false;
  const expected=rule.operator==='gte'
    ?operator==='gt'?Math.floor(value)+1:operator==='gte'?Math.ceil(value):undefined
    :operator==='lt'?Math.ceil(value)-1:operator==='lte'?Math.floor(value):undefined;
  return expected!==undefined&&actual===expected;
}
