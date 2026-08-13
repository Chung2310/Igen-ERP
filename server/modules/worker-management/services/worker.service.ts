import { Types } from "mongoose";
import { WorkerModel } from "../models/worker.model";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WORKER_LABOR_TYPES, type WorkerLaborType, type WorkerStatus } from "../interfaces/worker.interface";
import type { WorkerScope } from "../contracts";

export type { WorkerScope } from "../contracts";

export type WorkerInput = {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  status?: unknown;
  laborType?: unknown;
  nationality?: unknown;
  workPermitNumber?: unknown;
  workPermitExpiry?: unknown;
  note?: unknown;
  branchId?: unknown;
  address?: unknown;
  birthday?: unknown;
  idCard?: unknown;
  registrationDate?: unknown;
  customFields?: unknown;
  projectId?: unknown;
};

export type BulkWorkerInput = {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  idCard?: unknown;
  birthday?: unknown;
  address?: unknown;
  note?: unknown;
  registrationDate?: unknown;
  status?: unknown;
  laborType?: unknown;
  nationality?: unknown;
  workPermitNumber?: unknown;
  workPermitExpiry?: unknown;
  customFields?: unknown;
};

export type WorkerBulkImportError = { row: number; name: string; phone: string; reason: string };

export type WorkerBulkImportResult = {
  importedCount: number;
  skippedCount: number;
  errors: WorkerBulkImportError[];
};

export function buildWorkerQuery(scope: WorkerScope) {
  return { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null };
}

function normalizeCustomFields(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  return value as Record<string, unknown>;
}

/**
 * Reduce a phone number to the digits a Vietnamese subscriber number is made
 * of, so that "0912 345 678", "+84912345678" and "912345678" all resolve to
 * the same stored value. Worker lookups (QR check-in, duplicate detection,
 * bulk import) compare on this form, so writes must use it too.
 */
export function normalizeWorkerPhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (/^[1-9]\d{8}$/.test(digits)) digits = `0${digits}`;
  return digits;
}

function normalizeWorkerEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeIdCard(value: unknown): string {
  return String(value ?? "").replace(/\s/g, "");
}

/**
 * Accept both the stored codes and the Vietnamese labels users type into the
 * import sheet, so "Thời vụ" and "seasonal" land on the same value.
 */
export function normalizeLaborType(value: unknown): WorkerLaborType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (WORKER_LABOR_TYPES.includes(raw as WorkerLaborType)) return raw as WorkerLaborType;
  if (raw.includes("thời vụ") || raw.includes("thoi vu")) return "seasonal";
  if (raw.includes("nước ngoài") || raw.includes("nuoc ngoai")) return "foreign";
  return "official";
}

export function normalizeWorkerInput(input: WorkerInput) {
  const fullName = String(input.fullName || "").trim();
  if (!fullName) throw new Error("Worker full name is required");
  const status: WorkerStatus = ["active", "inactive", "placed"].includes(String(input.status))
    ? String(input.status) as WorkerStatus
    : "active";
  const customFields = normalizeCustomFields(input.customFields);
  const laborType = input.laborType !== undefined ? normalizeLaborType(input.laborType) : undefined;
  // Giấy phép lao động/visa chỉ có nghĩa với lao động nước ngoài: khi chuyển sang
  // loại khác thì xoá luôn để hồ sơ không giữ dữ liệu treo.
  const clearWorkPermit = laborType !== undefined && laborType !== "foreign";
  const workPermit = clearWorkPermit
    ? { workPermitNumber: "", workPermitExpiry: "" }
    : {
        ...(input.workPermitNumber !== undefined
          ? { workPermitNumber: String(input.workPermitNumber || "").trim() }
          : {}),
        ...(input.workPermitExpiry !== undefined
          ? { workPermitExpiry: String(input.workPermitExpiry || "").trim() }
          : {}),
      };
  return {
    fullName,
    ...(input.phone !== undefined ? { phone: normalizeWorkerPhone(input.phone) } : {}),
    ...(input.email !== undefined ? { email: normalizeWorkerEmail(input.email) } : {}),
    status,
    ...(laborType !== undefined ? { laborType } : {}),
    ...(input.nationality !== undefined ? { nationality: String(input.nationality || "").trim() } : {}),
    ...workPermit,
    ...(input.note !== undefined ? { note: String(input.note || "").trim() } : {}),
    ...(input.address !== undefined ? { address: String(input.address || "").trim() } : {}),
    ...(input.birthday !== undefined ? { birthday: String(input.birthday || "").trim() } : {}),
    ...(input.idCard !== undefined ? { idCard: String(input.idCard || "").trim() } : {}),
    ...(input.registrationDate !== undefined ? { registrationDate: String(input.registrationDate || "").trim() } : {}),
    ...(customFields !== undefined ? { customFields } : {}),
    ...(input.branchId !== undefined ? { branchId: String(input.branchId || "").trim() } : {}),
  };
}

export class WorkerService {
  static list(scope: WorkerScope) { return WorkerModel.find(buildWorkerQuery(scope)).sort({ createdAt: -1 }).lean(); }
  static async create(scope: WorkerScope, input: WorkerInput) {
    const data = normalizeWorkerInput(input);
    const worker = await WorkerModel.create({ ...data, companyCode: scope.companyCode, branchId: scope.branchId || data.branchId, deletedAt: null });
    const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
    if (projectId && Types.ObjectId.isValid(projectId)) {
      await WorkerProjectModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(projectId),
          companyCode: scope.companyCode,
          ...(scope.branchId ? { branchId: scope.branchId } : {}),
          deletedAt: null,
        },
        { $addToSet: { workerIds: worker._id } },
      );
    }
    return worker;
  }
  static update(scope: WorkerScope, id: string, input: WorkerInput) {
    const data = normalizeWorkerInput(input);
    return WorkerModel.findOneAndUpdate(
      { _id: id, ...buildWorkerQuery(scope) },
      { $set: { ...data, ...(scope.branchId ? { branchId: scope.branchId } : {}) } },
      { new: true },
    ).lean();
  }
  /**
   * Validate and insert a batch of workers in one round trip. Invalid rows are
   * skipped and reported by their 1-based position in the submitted list so the
   * client can point the user back at the offending spreadsheet row.
   */
  static async bulkCreate(
    scope: WorkerScope,
    rows: BulkWorkerInput[],
    projectId?: string,
  ): Promise<WorkerBulkImportResult> {
    const errors: WorkerBulkImportError[] = [];
    const valid: Record<string, unknown>[] = [];

    const existing = await WorkerModel.find(buildWorkerQuery(scope)).select("phone email idCard").lean();
    const takenPhones = new Set(existing.map((row: any) => normalizeWorkerPhone(row.phone)).filter(Boolean));
    const takenEmails = new Set(existing.map((row: any) => normalizeWorkerEmail(row.email)).filter(Boolean));
    const takenIdCards = new Set(existing.map((row: any) => normalizeIdCard(row.idCard)).filter(Boolean));
    const seenPhones = new Set<string>();

    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      const fullName = String(row.fullName ?? "").trim();
      const phone = normalizeWorkerPhone(row.phone);
      const email = normalizeWorkerEmail(row.email);
      const idCard = normalizeIdCard(row.idCard);
      const fail = (reason: string) => errors.push({ row: rowNumber, name: fullName, phone, reason });

      if (!fullName) return fail("Họ và tên không được để trống.");
      if (!phone) return fail("Số điện thoại không được để trống.");
      if (seenPhones.has(phone)) return fail("Số điện thoại bị trùng lặp trong file.");
      if (takenPhones.has(phone)) return fail("Số điện thoại đã tồn tại trong hệ thống.");
      if (email && takenEmails.has(email)) return fail("Email đã tồn tại trong hệ thống.");
      if (idCard && takenIdCards.has(idCard)) return fail("CCCD/CMND đã tồn tại trong hệ thống.");

      seenPhones.add(phone);
      takenPhones.add(phone);
      if (email) takenEmails.add(email);
      if (idCard) takenIdCards.add(idCard);

      const status: WorkerStatus = ["active", "inactive", "placed"].includes(String(row.status))
        ? (String(row.status) as WorkerStatus)
        : "active";

      valid.push({
        fullName,
        phone,
        ...(email ? { email } : {}),
        ...(idCard ? { idCard } : {}),
        ...(row.birthday ? { birthday: String(row.birthday).trim() } : {}),
        ...(row.address ? { address: String(row.address).trim() } : {}),
        ...(row.note ? { note: String(row.note).trim() } : {}),
        registrationDate: String(row.registrationDate ?? "").trim() || new Date().toLocaleDateString("vi-VN"),
        ...(normalizeCustomFields(row.customFields) !== undefined
          ? { customFields: normalizeCustomFields(row.customFields) }
          : {}),
        status,
        laborType: normalizeLaborType(row.laborType),
        ...(row.nationality ? { nationality: String(row.nationality).trim() } : {}),
        ...(normalizeLaborType(row.laborType) === "foreign"
          ? {
              ...(row.workPermitNumber ? { workPermitNumber: String(row.workPermitNumber).trim() } : {}),
              ...(row.workPermitExpiry ? { workPermitExpiry: String(row.workPermitExpiry).trim() } : {}),
            }
          : {}),
        companyCode: scope.companyCode,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        deletedAt: null,
      });
    });

    if (!valid.length) {
      return { importedCount: 0, skippedCount: errors.length, errors };
    }

    const inserted = await WorkerModel.insertMany(valid);

    const targetProject = typeof projectId === "string" ? projectId.trim() : "";
    if (targetProject && Types.ObjectId.isValid(targetProject) && inserted.length) {
      await WorkerProjectModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(targetProject),
          companyCode: scope.companyCode,
          ...(scope.branchId ? { branchId: scope.branchId } : {}),
          deletedAt: null,
        },
        { $addToSet: { workerIds: { $each: inserted.map((worker: any) => worker._id) } } },
      );
    }

    return { importedCount: inserted.length, skippedCount: errors.length, errors };
  }

  static delete(scope: WorkerScope, id: string) {
    return WorkerModel.findOneAndUpdate({ _id: id, ...buildWorkerQuery(scope) }, { $set: { deletedAt: new Date() } }, { new: true }).lean();
  }
}