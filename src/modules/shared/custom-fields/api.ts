import { apiFetch } from "../../student-management/lib/api";
import { createMaxSizeMb, type CreateFieldInput, type FieldDefinition, type FileMetadata, type ModuleKey, type UpdateFieldInput } from "./types";

type ApiResponse<T> = { success: boolean; data: T };
type ApiFieldDefinition = FieldDefinition & { _id?: string };

const basePath = "/student-management/custom-fields";

function normalizeField(field: ApiFieldDefinition): FieldDefinition {
  const { _id, ...definition } = field;
  return { ...definition, id: field.id ?? _id ?? "" };
}

function validateFileSizeLimit(input: CreateFieldInput | UpdateFieldInput): void {
  const validation = input.validation as { maxSizeMb?: unknown } | undefined;
  if (validation?.maxSizeMb !== undefined) createMaxSizeMb(validation.maxSizeMb as number);
}

export async function listCustomFields(moduleKey: ModuleKey, includeArchived = false, tenantId?: string): Promise<FieldDefinition[]> {
  const path = `${basePath}/${moduleKey}`;
  const response = includeArchived
    ? await apiFetch<ApiResponse<ApiFieldDefinition[]>>(path, { params: tenantId ? { includeArchived: true, tenantId } : { includeArchived: true } })
    : tenantId
      ? await apiFetch<ApiResponse<ApiFieldDefinition[]>>(path, { params: { tenantId } })
      : await apiFetch<ApiResponse<ApiFieldDefinition[]>>(path);
  return response.data.map(normalizeField);
}

export async function createCustomField(moduleKey: ModuleKey, input: CreateFieldInput, tenantId?: string): Promise<FieldDefinition> {
  validateFileSizeLimit(input);
  const response = await apiFetch<ApiResponse<ApiFieldDefinition>>(`${basePath}/${moduleKey}`, {
    method: "POST",
    ...(tenantId ? { params: { tenantId } } : {}),
    body: JSON.stringify(input),
  });
  return normalizeField(response.data);
}

export async function updateCustomField(moduleKey: ModuleKey, id: string, input: UpdateFieldInput, tenantId?: string): Promise<FieldDefinition> {
  validateFileSizeLimit(input);
  const response = await apiFetch<ApiResponse<ApiFieldDefinition>>(`${basePath}/${moduleKey}/${id}`, {
    method: "PATCH",
    ...(tenantId ? { params: { tenantId } } : {}),
    body: JSON.stringify(input),
  });
  return normalizeField(response.data);
}

export async function archiveCustomField(moduleKey: ModuleKey, id: string, tenantId?: string): Promise<FieldDefinition> {
  const response = await apiFetch<ApiResponse<ApiFieldDefinition>>(`${basePath}/${moduleKey}/${id}/archive`, { method: "POST", ...(tenantId ? { params: { tenantId } } : {}) });
  return normalizeField(response.data);
}

export async function restoreCustomField(moduleKey: ModuleKey, id: string, tenantId?: string): Promise<FieldDefinition> {
  const response = await apiFetch<ApiResponse<ApiFieldDefinition>>(`${basePath}/${moduleKey}/${id}/restore`, { method: "POST", ...(tenantId ? { params: { tenantId } } : {}) });
  return normalizeField(response.data);
}

export async function deleteCustomField(moduleKey: ModuleKey, id: string, tenantId?: string): Promise<void> {
  await apiFetch<ApiResponse<void>>(`${basePath}/${moduleKey}/${id}/delete`, { method: "POST", ...(tenantId ? { params: { tenantId } } : {}) });
}

export async function uploadCustomFieldFile(field: FieldDefinition, file: File): Promise<FileMetadata> {
  const body = new FormData();
  body.append("file", file);
  const response = await apiFetch<ApiResponse<FileMetadata>>(`${basePath}/${field.moduleKey}/${field.id}/upload`, {
    method: "POST",
    params: { tenantId: field.tenantId },
    body,
  });
  return response.data;
}
