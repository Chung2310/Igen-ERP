import { AssistantError } from "./policy";

/** Preserve public API validation reasons without serializing arbitrary error objects. */
export function apiRejectionReason(payload: unknown): string {
  const messages: string[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 5) return;
    if (typeof value === "string" && value.trim()) messages.push(value.trim().slice(0, 500));
    else if (Array.isArray(value)) value.slice(0, 12).forEach(item => visit(item, depth + 1));
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["message", "details", "errors", "error", "body", "query", "params"]) {
        if (record[key] !== undefined) visit(record[key], depth + 1);
      }
    }
  };
  visit(payload);
  return [...new Set(messages)].join("\n").slice(0, 2000) || "API nghiệp vụ từ chối thao tác.";
}

export class AssistantApiRejection extends AssistantError {
  constructor(payload: unknown, status: number) { super(apiRejectionReason(payload), status); }
}
