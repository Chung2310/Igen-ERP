import { browserTransport, type ServiceTransport } from "./serviceTransport";
import type { Credential, CredentialEmployee } from "../types/hrCredential";
import type { HRCredentialStatus, HRCredentialType } from "../../shared/hr-credential";

export interface CredentialFilters {
  companyCode: string;
  branchId?: string;
  employeeId?: string;
  search?: string;
  status?: HRCredentialStatus;
  type?: HRCredentialType;
  page?: number;
  limit?: number;
  all?: boolean;
}
export interface CredentialList {
  credentials: Credential[];
  employees: CredentialEmployee[];
  total: number;
  page: number;
  limit: number;
  summary: { total: number; active: number; expiring: number; expired: number };
}
export type CredentialInput = Pick<
  Credential,
  | "employeeId"
  | "name"
  | "type"
  | "credentialNumber"
  | "issuingOrganization"
  | "issueDate"
  | "expiryDate"
  | "professionalScope"
  | "note"
  | "reminderDays"
>;
export type CredentialScanInput = Pick<Credential, "fileUrl" | "fileName" | "fileMimeType" | "fileSize"> & {
  uploadToken?: string;
};
export function createHrCredentialService({ fetch, getAccessToken }: ServiceTransport) {
  async function write(companyCode: string, path: string, method: string, value: object, signal?: AbortSignal) {
    const response = await fetch(`/api/v1/hr-credentials${path}?${new URLSearchParams({ companyCode })}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify(value),
      ...(signal ? { signal } : {}),
    });
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(body.message || "Không thể lưu văn bằng/chứng chỉ."), { status: response.status });
    return body.data;
  }
  return {
    async remove(companyCode: string, id: string): Promise<void> {
      const response = await fetch(
        `/api/v1/hr-credentials/${encodeURIComponent(id)}?${new URLSearchParams({ companyCode })}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(body.message || "Không thể xóa văn bằng/chứng chỉ."), {
          status: response.status,
        });
      if (body.status !== "success") throw new Error("Chưa xác nhận hồ sơ đã được xóa. Tải lại danh sách để kiểm tra.");
    },
    upload: (
      companyCode: string,
      value: { file: string; name: string; mimeType: string; size: number },
      signal?: AbortSignal,
    ): Promise<{ url: string; uploadToken: string }> => write(companyCode, "/upload", "POST", value, signal),
    create: (companyCode: string, value: CredentialInput & CredentialScanInput): Promise<Credential> =>
      write(companyCode, "", "POST", value),
    update: (
      companyCode: string,
      id: string,
      value: Partial<CredentialInput> & CredentialScanInput,
    ): Promise<Credential> => write(companyCode, `/${encodeURIComponent(id)}`, "PATCH", value),
    async list(filters: CredentialFilters): Promise<CredentialList> {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
      });
      const response = await fetch(`/api/v1/hr-credentials?${params}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      });
      const body = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(body.message || "Không thể tải văn bằng/chứng chỉ."), {
          status: response.status,
        });
      return body.data;
    },
  };
}
export const hrCredentialService = createHrCredentialService(browserTransport);
