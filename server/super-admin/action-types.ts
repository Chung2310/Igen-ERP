export type AdminActionRisk = "read_only" | "standard" | "sensitive" | "dangerous";
export interface AdminActionDefinition<T = unknown> { type: string; risk: AdminActionRisk; requiresReason: boolean; requiresStepUp: boolean; parse(input: unknown): T; }
