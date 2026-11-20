import { getAccessToken } from "./authService";

export type MedicalRiskClassification = "A" | "B" | "C" | "D";
export type InspectionResult = "pass" | "fail" | "conditional";
export type LegalDocumentType =
  "invoice" | "co_cq" | "import_license" | "circulation_license" | "calibration_cert" | "manual" | "other";

export interface ILegalDocument {
  _id: string;
  title: string;
  type: LegalDocumentType;
  documentNumber?: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  issuedDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  notes?: string;
  uploadedAt: string;
  uploadedBy?: string;
  uploadToken?: string;
}

export interface IEquipmentInspectionRecord {
  _id: string;
  companyCode: string;
  branchId?: string;
  equipmentId: string;
  type: "inspection" | "calibration" | "maintenance";
  performedDate: string;
  nextDueDate: string;
  serviceProvider: string;
  inspectorName?: string;
  result: InspectionResult;
  certificateNumber?: string;
  reportFileUrl?: string;
  reportFileName?: string;
  cost?: number;
  notes?: string;
  performedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceSummary {
  total: number;
  overdue: number;
  dueSoon: number;
  valid: number;
  none: number;
  classifications: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
}

function authHeaders(withJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (withJson) headers["Content-Type"] = "application/json";
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res: Response, fallbackMessage: string) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || fallbackMessage);
  }
  return json;
}

export const equipmentComplianceService = {
  /**
   * Tải file lên server media relay (Cloudinary)
   */
  async uploadFile(file: File): Promise<{ url: string; fileName: string; size: number; uploadToken: string }> {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await fetch("/api/v1/equipment-media/upload", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        file: base64Data,
        sourceType: "equipment.compliance",
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      }),
    });

    const data = await handleResponse(res, `Không thể tải tệp "${file.name}" lên hệ thống.`);
    if (!data.uploadToken) throw new Error("Hệ thống không trả về mã hoàn tất upload.");
    return {
      url: data.url,
      fileName: file.name,
      size: file.size,
      uploadToken: data.uploadToken,
    };
  },

  /**
   * Thống kê tổng quan hồ sơ pháp lý & tình trạng kiểm định
   */
  async getSummary(branchId?: string): Promise<ComplianceSummary> {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);

    const res = await fetch(`/api/v1/equipment/compliance-summary?${params.toString()}`, {
      headers: authHeaders(false),
    });
    const data = await handleResponse(res, "Không thể tải thống kê kiểm định thiết bị.");
    return data.data;
  },

  /**
   * Thêm tài liệu pháp lý cho thiết bị
   */
  async addLegalDocument(equipmentId: string, payload: Partial<ILegalDocument>): Promise<any> {
    const res = await fetch(`/api/v1/equipment/${equipmentId}/legal-documents`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await handleResponse(res, "Không thể thêm hồ sơ pháp lý.");
    return data.data;
  },

  /**
   * Xóa tài liệu pháp lý của thiết bị
   */
  async deleteLegalDocument(equipmentId: string, docId: string): Promise<any> {
    const res = await fetch(`/api/v1/equipment/${equipmentId}/legal-documents/${docId}`, {
      method: "DELETE",
      headers: authHeaders(false),
    });
    const data = await handleResponse(res, "Không thể xóa hồ sơ pháp lý.");
    return data.data;
  },

  /**
   * Lấy lịch sử các đợt kiểm định của thiết bị
   */
  async listInspections(equipmentId: string): Promise<IEquipmentInspectionRecord[]> {
    const res = await fetch(`/api/v1/equipment/${equipmentId}/inspections`, {
      headers: authHeaders(false),
    });
    const data = await handleResponse(res, "Không thể tải lịch sử kiểm định.");
    return data.data || [];
  },

  /**
   * Ghi nhận một đợt kiểm định / hiệu chuẩn mới
   */
  async recordInspection(
    equipmentId: string,
    payload: {
      type: "inspection" | "calibration" | "maintenance";
      performedDate: string;
      nextDueDate?: string;
      serviceProvider: string;
      inspectorName?: string;
      result: InspectionResult;
      certificateNumber?: string;
      reportFileUrl?: string;
      reportFileName?: string;
      cost?: number;
      notes?: string;
      uploadToken?: string;
    },
  ): Promise<{ record: IEquipmentInspectionRecord; equipment: any }> {
    const res = await fetch(`/api/v1/equipment/${equipmentId}/inspections`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await handleResponse(res, "Không thể ghi nhận đợt kiểm định.");
    return data.data;
  },

  /**
   * Xóa bản ghi lịch sử kiểm định
   */
  async deleteInspectionRecord(equipmentId: string, recordId: string): Promise<void> {
    const res = await fetch(`/api/v1/equipment/${equipmentId}/inspections/${recordId}`, {
      method: "DELETE",
      headers: authHeaders(false),
    });
    await handleResponse(res, "Không thể xóa bản ghi kiểm định.");
  },
};
