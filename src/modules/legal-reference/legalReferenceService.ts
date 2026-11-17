import { getAccessToken } from "../../services/authService";

export type LegalStatus = "effective" | "partially_effective" | "upcoming" | "expired" | "repealed" | "unknown";
export type LegalDocument = {
  id: string;
  symbol: string;
  title: string;
  issuingAuthority: string;
  jurisdiction: "central" | "ministry" | "local";
  province?: string;
  field?: string;
  issueDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  status: LegalStatus;
  sourceUrl: string;
  relatedDocuments: Array<{ symbol: string; relation: "amends" | "consolidates" | "related"; affectedArticles: string[]; reviewStatus: "needs_review" | "verified" }>;
  reviewRequired: boolean;
  currentVersionId: string;
  latestVersion: null | { _id: string; versionNumber: number; downloadedAt: string; sha256: string; lifecycleStatus: string; extractionStatus: string };
  chunksCount: number;
};
export type LegalHealth = {
  documents: number;
  chunks: number;
  pendingReviews: number;
  latestDownloadAt: string | null;
  syncConfigured: boolean;
  sync: null | {
    status: "idle" | "running" | "completed" | "failed";
    configuredScopes: number;
    startedAt?: string;
    completedAt?: string;
    lastSuccessAt?: string;
    pagesScanned: number;
    documentsFound: number;
    documentsAdded: number;
    revisionsAdded: number;
    unchanged: number;
    reviewRequired: number;
    missingOriginal: number;
    lastError: string;
  };
};
export type LegalReviewTask = {
  id: string;
  taskType: "extraction" | "version_change" | "amendment";
  reason: string;
  createdAt: string;
  details: { relatedDocuments?: Array<{ symbol: string; relation: "amends" | "consolidates" | "related"; affectedArticles: string[] }> };
  document: null | { symbol: string; title: string; issuingAuthority: string; sourceUrl: string; effectiveDate?: string };
  version: null | { _id: string; id: string; versionNumber: number; sha256: string; extractionStatus: string; downloadedAt: string; originalFilename?: string };
};
export type LegalSearchMatch = {
  score: number;
  keywordScore?: number;
  embeddingScore?: number;
  citation?: string;
  text: string;
  symbol: string;
  title: string;
  issuingAuthority: string;
  field?: string;
  status: LegalStatus;
  chapter?: string;
  article?: string;
  clause?: string;
  point?: string;
  versionNumber?: number;
  sourceUrl: string;
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      ...(options?.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không thể xử lý kho văn bản pháp luật.");
  return result as T;
}

function formData(fields: Record<string, string>, file: File) {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  body.append("original", file, file.name);
  return body;
}

export const legalReferenceService = {
  health: () => requestJson<LegalHealth>("/api/v1/legal-reference/health"),
  list: (filters: { q?: string; jurisdiction?: string; status?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<[string, string]>);
    return requestJson<{ documents: LegalDocument[] }>(`/api/v1/legal-reference/documents${query.size ? `?${query}` : ""}`);
  },
  reviews: () => requestJson<{ tasks: LegalReviewTask[] }>("/api/v1/legal-reference/review-queue"),
  create: (fields: Record<string, string>, file: File) => requestJson("/api/v1/legal-reference/documents", { method: "POST", body: formData(fields, file) }),
  addRevision: (documentId: string, sourceUrl: string, file: File) => requestJson(`/api/v1/legal-reference/documents/${documentId}/revisions`, { method: "POST", body: formData({ sourceUrl }, file) }),
  decideReview: (taskId: string, decision: "approve" | "reject", effectiveFrom?: string) => requestJson(`/api/v1/legal-reference/review-queue/${taskId}/decision`, { method: "POST", body: JSON.stringify({ decision, effectiveFrom }) }),
  updateReviewText: (taskId: string, text: string) => requestJson(`/api/v1/legal-reference/review-queue/${taskId}/content`, { method: "POST", body: JSON.stringify({ text }) }),
  search: (input: { query: string; asOf: string; jurisdiction?: string; field?: string; authority?: string }) => requestJson<{ query: string; asOf: string; matches: LegalSearchMatch[] }>("/api/v1/legal-reference/search", { method: "POST", body: JSON.stringify(input) }),
  answer: (input: { query: string; asOf: string; jurisdiction?: string; field?: string; authority?: string }) => requestJson<{ query: string; asOf: string; answer: string; sources: LegalSearchMatch[] }>("/api/v1/legal-reference/answer", { method: "POST", body: JSON.stringify(input) }),
  sync: (pageLimit?: number) => requestJson<{ status: string; message: string }>("/api/v1/legal-reference/sync", { method: "POST", body: JSON.stringify({ pageLimit }) }),
  async downloadOriginal(versionId: string, filename: string) {
    const response = await fetch(`/api/v1/legal-reference/documents/${versionId}/original`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "Không thể tải bản gốc.");
    }
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};
