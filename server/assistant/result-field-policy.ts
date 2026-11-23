import type { AssistantOperation } from "./catalog";

export const privateAssistantResultField = (key: string) => key.startsWith("__assistant")
  || ["id", "uid", "version", "token", "password", "secret", "credential"].includes(key.toLocaleLowerCase("en"))
  || /(?:Id|ID|Uid|UID|Version|Token|Password|Secret|Credential)$/.test(key)
  || /(?:_|-)(?:id|uid|version|token|password|secret|credential)$/i.test(key);

export function publicAssistantResultFields(operation: AssistantOperation) {
  return [...new Set([...operation.resultFields, ...Object.keys(operation.analysis?.fields || {})])]
    .filter(field => !privateAssistantResultField(field));
}
