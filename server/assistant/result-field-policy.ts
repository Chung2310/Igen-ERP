import type { AssistantOperation } from "./catalog";

export function maskAssistantBankAccount(value: string) {
  const digits=value.replace(/\D/g,'');
  return digits.length>4?`•••• ${digits.slice(-4)}`:'••••';
}

export const privateAssistantResultField = (key: string) => key.startsWith("__assistant")
  || ["id", "uid", "version", "token", "password", "secret", "credential"].includes(key.toLocaleLowerCase("en"))
  || /(?:Id|ID|Uid|UID|Version|Token|Password|Secret|Credential)$/.test(key)
  || /(?:_|-)(?:id|uid|version|token|password|secret|credential)$/i.test(key);

export function publicAssistantResultFields(operation: AssistantOperation) {
  return [...new Set([...operation.resultFields, ...Object.keys(operation.analysis?.fields || {})])]
    .filter(field => !privateAssistantResultField(field));
}
export function assistantIdentityFields(operation:AssistantOperation){
 const publicFields=new Set(publicAssistantResultFields(operation));
 return (operation.analysis?.identityFields||['code','productCode','sku','orderCode','name','productName','fullName','displayName','employeeName','workerName','studentName','partnerName','title'].filter(key=>publicFields.has(key))).filter(key=>publicFields.has(key)).slice(0,2);
}

/** Output evidence may address a declared child without turning the HTTP
 * envelope into a filterable scalar or widening its projection allow-list. */
export function publicAssistantResultTarget(operation:AssistantOperation,key:string){
 if(publicAssistantResultFields(operation).includes(key))return key;
 const parts=key.split('.');
 return parts.length===2&&publicAssistantResultFields(operation).includes(parts[0])
   &&Array.isArray(operation.resultChildFields?.[parts[0]])&&(operation.resultChildFields![parts[0]] as string[]).includes(parts[1])&&!privateAssistantResultField(parts[1])?parts[0]:undefined;
}

/** Preserve an explicitly requested leaf rather than expanding it back into
 * every sibling of the summary envelope. Unknown/private paths stay excluded. */
export function projectAssistantResultContract(operation:AssistantOperation,paths:readonly string[]):AssistantOperation{
 const identity=assistantIdentityFields(operation);
 const approved=[...new Set([...paths,...(paths.some(path=>identity.includes(path))?[]:identity)])].filter(path=>Boolean(publicAssistantResultTarget(operation,path)));
 const roots=[...new Set(approved.map(path=>publicAssistantResultTarget(operation,path)!))];
 const children={...operation.resultChildFields};
 for(const root of roots){
   if(approved.includes(root)||!Array.isArray(children[root]))continue;
   children[root]=(children[root] as string[]).filter(child=>approved.includes(root+'.'+child));
 }
 return {...operation,resultFields:roots,resultChildFields:children};
}
