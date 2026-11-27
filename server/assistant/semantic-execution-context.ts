import {createHash} from 'node:crypto';
import type {AssistantWorkflow} from '../../src/shared/assistant-workflow';
import {revalidateSemanticProof,semanticRequestedInputs,semanticRequestedOutputs,semanticContextEnabled,isSemanticClarificationContinuation,type SemanticSource} from './semantic-request';
import {AssistantPlanningError} from './interpretation-error';
import {operationById} from './catalog';

/** Stored only by the server in its scoped pending state. Attests that meaning
 * was checked; never grants permission, supplies values or confirms a write. */
export interface SemanticExecutionContext {actionId:string;intent:string;contract:string;requestedInputs:string[];requestedOutputs?:string[];clarificationContinuation?:true}
const contract=(workflow:AssistantWorkflow)=>createHash('sha256').update(JSON.stringify({actionId:workflow.actionId,module:workflow.module,enabled:workflow.enabled,version:workflow.version,fields:workflow.fields,operation:operationById(workflow.actionId)})).digest('hex');
export function verifiedSemanticContexts(result:object,sources:SemanticSource[],intent:string){
 const checked=revalidateSemanticProof(result,sources);
 if(checked?.ok===false)throw new AssistantPlanningError(checked.diagnostic);
 return checked?.ok?sources.map(source=>({actionId:source.operation.id,intent,contract:contract(source.workflow),requestedInputs:semanticRequestedInputs(result,source),requestedOutputs:semanticRequestedOutputs(result,source),...(isSemanticClarificationContinuation(result)?{clarificationContinuation:true as const}:{})})):[];
}
export function matchesSemanticExecutionContext(context:SemanticExecutionContext|undefined,workflow:AssistantWorkflow,intent:string){
 return (semanticContextEnabled()||context?.clarificationContinuation===true)&&workflow.enabled&&context?.actionId===workflow.actionId&&context.intent===intent&&context.contract===contract(workflow);
}
