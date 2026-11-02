import { apiFetch } from "../lib/api";
import type { EntityPreset } from "../config/entityLabels";

type ApiResponse<T> = { success: boolean; data: T };
type ModuleSettingsDto = { tenantId: string; entityPreset: EntityPreset };

const basePath = "/student-management/settings";

export async function getModuleSettings(tenantId?: string, options: Pick<RequestInit, 'signal'> = {}): Promise<ModuleSettingsDto> {
  const response = await apiFetch<ApiResponse<ModuleSettingsDto>>(basePath, {
    ...options,
    ...(tenantId ? { params: { tenantId } } : {}),
  });
  return response.data;
}

export async function updateModuleSettings(entityPreset: EntityPreset, tenantId?: string): Promise<ModuleSettingsDto> {
  const response = await apiFetch<ApiResponse<ModuleSettingsDto>>(basePath, {
    method: "PATCH",
    ...(tenantId ? { params: { tenantId } } : {}),
    body: JSON.stringify({ entityPreset }),
  });
  return response.data;
}
