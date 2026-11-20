const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}` });

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Không thể xử lý kho tri thức.");
  return data;
}

async function request(path: string, init?: RequestInit) {
  return parseResponse(
    await fetch(`/api/v1/assistant/knowledge${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeader(), ...(init?.headers || {}) },
    }),
  );
}

export type KnowledgeFileUploadResult = {
  filename: string;
  status: "queued" | "indexed" | "duplicate" | "rejected";
  chunksCount?: number;
  documentId?: string;
  jobId?: string;
  message?: string;
};
export const listKnowledgeDocuments = async () => (await request("/documents")).documents || [];
export const createKnowledgeDocument = async (input: { title: string; text: string } & KnowledgeMetadata) =>
  request("/documents", { method: "POST", body: JSON.stringify(input) });
export const syncKnowledgeResource = async (resourceId: string, text: string) =>
  request(`/resources/${resourceId}/sync`, { method: "POST", body: JSON.stringify({ text }) });
export const deleteKnowledgeDocument = async (id: string) => request(`/documents/${id}`, { method: "DELETE" });
export const testKnowledgeSearch = async (query: string, filters: { category?: string; documentType?: string } = {}) =>
  (await request("/test-search", { method: "POST", body: JSON.stringify({ query, ...filters }) })).evidence || [];
export const uploadKnowledgeFiles = async (
  files: File[],
  metadata: KnowledgeMetadata = {},
): Promise<KnowledgeFileUploadResult[]> => {
  const body = new FormData();
  if (metadata.documentType !== undefined) body.append("documentType", metadata.documentType);
  if (metadata.category !== undefined) body.append("category", metadata.category);
  if (metadata.visibility !== undefined) body.append("visibility", metadata.visibility);
  if (metadata.branchIds !== undefined) body.append("branchIds", JSON.stringify(metadata.branchIds));
  if (metadata.departmentIds !== undefined) body.append("departmentIds", JSON.stringify(metadata.departmentIds));
  if (metadata.replaces !== undefined) body.append("replaces", metadata.replaces);
  if (metadata.effectiveFrom !== undefined) body.append("effectiveFrom", metadata.effectiveFrom);
  if (metadata.effectiveTo !== undefined) body.append("effectiveTo", metadata.effectiveTo);
  files.forEach((file) => body.append("files", file));
  const data = await parseResponse(
    await fetch("/api/v1/assistant/knowledge/files", { method: "POST", body, headers: authHeader() }),
  );
  return data.results || [];
};

export type KnowledgeScope = { visibility: "company" | "restricted"; branchIds: string[]; departmentIds: string[] };
export type KnowledgeMetadata = {
  documentType?: string;
  category?: string;
  replaces?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
} & Partial<KnowledgeScope>;
export const updateKnowledgeMetadata = (id: string, metadata: KnowledgeMetadata) =>
  request(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(metadata) });
export const getKnowledgeScopes = () => request("/scopes");
export const suggestSupersededDocument = async (title: string, number?: string) =>
  request("/suggest-replacement", { method: "POST", body: JSON.stringify({ title, number }) });
export const verifySpotCheckDocument = async (id: string, review: { contentHash: string; flagIds: string[]; note?: string }) =>
  request(`/documents/${encodeURIComponent(id)}/verify-spotcheck`, { method: "POST", body: JSON.stringify(review) });
export const getKnowledgeDocument = (id: string, revision?: string) =>
  request(`/documents/${encodeURIComponent(id)}${revision ? `?revision=${encodeURIComponent(revision)}` : ""}`);
export const reindexKnowledgeDocument = (id: string) =>
  request(`/documents/${encodeURIComponent(id)}/reindex`, { method: "POST" });
export async function downloadKnowledgeSource(id: string, filename: string) {
  const response = await fetch(`/api/v1/assistant/knowledge/documents/${encodeURIComponent(id)}/source`, {
    headers: authHeader(),
  });
  if (!response.ok) {
    await parseResponse(response);
    return;
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getKnowledgeSourceBlob(id: string): Promise<{ blob: Blob; mimeType: string }> {
  const response = await fetch(`/api/v1/assistant/knowledge/documents/${encodeURIComponent(id)}/source?inline=true`, {
    headers: authHeader(),
  });
  if (!response.ok) {
    await parseResponse(response);
    throw new Error("Không thể tải tệp nguồn.");
  }
  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const blob = await response.blob();
  return { blob, mimeType };
}

