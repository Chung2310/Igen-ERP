export interface AssistantUserIdentity {
  id: string;
  email: string;
  role: string;
  companyCode?: string;
  branchId?: string;
  departmentId?: string;
}

export interface AssistantAccessContext {
  readonly userId: string;
  readonly companyCode: string;
  readonly role: string;
  readonly permissions: ReadonlySet<string>;
  readonly branchIds: readonly string[];
  readonly allBranches: boolean;
  readonly departmentId?: string;
}

export interface AssistantCitation {
  id: string;
  sourceType: "knowledge" | "database";
  title: string;
  scope?: string;
  updatedAt?: string;
  queriedAt?: string;
  documentId?: string;
  chunkIndex?: number;
  revision?: string;
  url?: string;
}

export interface AssistantEvidence {
  extractionWarnings?: string[];
  id: string;
  sourceType: "knowledge" | "database";
  title: string;
  content: string;
  citation: AssistantCitation;
  score?: number;
  category?: string;
  documentType?: string;
}

export interface AssistantResponse {
  reply: string;
  citations: AssistantCitation[];
  suggestions: string[];
  queriedAt: string;
  status?: "answered" | "partial" | "insufficient_evidence" | "not_found";
  diagnostics?: {
    retrievedIds: string[];
    scores: number[];
    retrievalMs: number;
    composeMs: number;
    promptTokens?: number;
    completionTokens?: number;
    costUSD?: number;
    model?: string;
  };
}
