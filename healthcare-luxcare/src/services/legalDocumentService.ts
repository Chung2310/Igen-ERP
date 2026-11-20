import { getAccessToken } from "./authService";
import type { KnowledgeProgress } from "../../shared/knowledge-progress";
export interface LegalSection {
  key: string;
  label: string;
  start: number;
  end: number;
}
export interface LegalSectionChange {
  action: "replace" | "repeal" | "add";
  targetKey: string;
  targetLabel: string;
  sourceKeys: string[];
  previousAmendmentId?: string;
}
export interface LegalStructure {
  document: LegalDocument;
  sourceRevision: string;
  text: string;
  sections: LegalSection[];
  saved: boolean;
  canEdit: boolean;
}

export interface LegalDocument {
  _id: string;
  number: string;
  title: string;
  issuer: string;
  issuedAt: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceUrl: string;
  applicability: string;
  companyCodes: string[];
  postId: string;
  replaces?: string;
  amends?: string;
  sectionChanges?: LegalSectionChange[];
  sections?: LegalSection[];
  structureRevision?: string;
  status: "draft" | "approved" | "withdrawn";
  current: boolean;
  indexingStatus?: string;
  indexingProgress?: KnowledgeProgress;
  indexingError?: string;
  approvedAt?: string;
  withdrawalReason?: string;
  updatedAt: string;
}
export interface LegalList {
  canManage: boolean;
  canApprove: boolean;
  documents: LegalDocument[];
}
export async function legalRequest<T>(path = "", options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/legal-documents${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      ...(!(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Không thể xử lý văn bản pháp lý.");
  return body;
}
export async function downloadLegalSource(id: string) {
  const response = await fetch(`/api/v1/legal-documents/${id}/source`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) throw new Error((await response.json()).message || "Không thể tải file.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  const filename = response.headers.get("Content-Disposition")?.split("UTF-8''")[1];
  link.download = filename ? decodeURIComponent(filename) : "van-ban-phap-ly";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
