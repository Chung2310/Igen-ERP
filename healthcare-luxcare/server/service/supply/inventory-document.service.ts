import { assertRecipientDepartment } from "./recipient-department";
import type { ClientSession } from "mongoose";
import type { InventoryDraft } from "../../../shared/supply-inventory";
import { SupplyModel } from "../../model/supply.model";
import { SupplierModel } from "../../model/supplier.model";
import {
  SupplyStockDocumentModel as Document,
  SupplyStockDocumentLineModel as Line,
  SupplyInventoryProfileModel as Profile,
  SupplyInventoryAuditModel as Audit,
} from "../../model/supply-inventory.model";
import { runSupplyOperation } from "./atomic";
import { SupplyError } from "./errors";
import { convertQuantity } from "./quantity";
import {
  assertInventoryWarehouse,
  requireInventoryPermission,
  lockInventory,
  inventoryView,
  inventoryReadFilter,
  type InventoryActor,
} from "./inventory-access";
import { assertInventoryIndexes } from "./inventory-indexes";

export function validExpiryDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(new Date(day).getTime()) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export async function inventoryDocument(actor: InventoryActor, id: string, session?: ClientSession, write = false) {
  const document = await Document.findOne({
    _id: id,
    companyCode: actor.companyCode,
    branchId: actor.branchId,
  }).session(session || null);
  if (!document) throw new SupplyError("DOCUMENT_NOT_FOUND", "Không tìm thấy chứng từ trong phạm vi được phép.", 404);
  await assertInventoryWarehouse(actor, document.warehouseId, write, session);
  return document;
}
export async function documentAudit(
  actor: InventoryActor,
  document: any,
  action: string,
  session: ClientSession,
  reason?: string,
) {
  await Audit.create(
    [
      {
        companyCode: actor.companyCode,
        branchId: actor.branchId,
        documentId: String(document._id),
        actorId: actor.uid,
        action,
        revision: document.revision,
        reason,
      },
    ],
    { session },
  );
}
async function draftLines(actor: InventoryActor, documentId: string, input: InventoryDraft, session: ClientSession) {
  if (
    !input.reason?.trim() ||
    !["opening", "receipt", "issue"].includes(input.type) ||
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    input.lines.length > 200
  )
    throw new SupplyError("INVALID_DOCUMENT", "Phiếu cần lý do, loại hợp lệ và 1–200 dòng vật tư.");
  if (input.type === "opening") requireInventoryPermission(actor, "supply:adjust");
  if (input.type !== "issue") requireInventoryPermission(actor, "supply:cost-read");
  if (input.type === "issue" && !input.recipientDepartment?.trim())
    throw new SupplyError("RECIPIENT_REQUIRED", "Cần khoa/phòng nhận khi xuất dùng.");
  if (
    input.supplierId &&
    !(await SupplierModel.exists({ _id: input.supplierId, companyCode: actor.companyCode, isActive: true }).session(
      session,
    ))
  )
    throw new SupplyError("INVALID_SUPPLIER", "Nhà cung cấp không hợp lệ.");
  if (input.type === "issue") await assertRecipientDepartment(actor.companyCode, input.recipientDepartment, session);
  const rows = [];
  for (const [index, item] of input.lines.entries()) {
    const supply = await SupplyModel.findOne({
      _id: item.supplyId,
      companyCode: actor.companyCode,
      isActive: { $ne: false },
    })
      .session(session)
      .lean();
    let profile = await Profile.findOne({ companyCode: actor.companyCode, supplyId: item.supplyId })
      .session(session)
      .lean();
    if (!profile && supply) {
      const trackingMode = item.lotNumber || supply.batchNumber || supply.requiresExpiry !== false ? "lot" : "none";
      const [createdProfile] = await Profile.create(
        [
          {
            companyCode: actor.companyCode,
            supplyId: item.supplyId,
            baseUnit: supply.unit || "Cái",
            precision: 0,
            trackingMode,
            requiresExpiry: supply.requiresExpiry !== false,
            conversions: [],
            version: 1,
          },
        ],
        { session: session || undefined },
      );
      profile = createdProfile.toObject();
    }
    if (!supply || !profile)
      throw new SupplyError("PROFILE_REQUIRED", "Vật tư cần có danh mục đang hoạt động và cấu hình đơn vị V2.");
    if (supply.unit !== profile.baseUnit)
      throw new SupplyError("BASE_UNIT_MISMATCH", "Đơn vị danh mục khác cấu hình đã xác minh.", 409);
    const factor = item.unit === profile.baseUnit ? "1" : profile.conversions.find((c) => c.unit === item.unit)?.factor;
    if (!factor) throw new SupplyError("INVALID_UNIT", "Đơn vị chưa được khai báo trong cấu hình vật tư.");
    const amount = convertQuantity(item.quantity, factor, profile.precision);
    if (amount <= 0) throw new SupplyError("INVALID_QUANTITY", "Số lượng phải lớn hơn 0.");
    if (input.type !== "issue") {
      if (!Number.isSafeInteger(item.totalValueMinor) || item.totalValueMinor! < 0)
        throw new SupplyError("RECEIPT_VALUE_REQUIRED", "Cần tổng giá trị nhận theo VND, là số nguyên không âm.");
      if (profile.trackingMode === "lot" && !item.lotNumber?.trim())
        throw new SupplyError("LOT_REQUIRED", "Vật tư theo lô cần số lô sản xuất.");
      if (profile.trackingMode === "none" && (item.lotNumber || item.expiryDay))
        throw new SupplyError("UNTRACKED_LOT", "Vật tư không theo lô không được khai báo lô hoặc hạn dùng.");
      if (item.expiryDay && (!profile.requiresExpiry || !validExpiryDay(item.expiryDay)))
        throw new SupplyError("INVALID_EXPIRY", "Hạn dùng không phù hợp với cấu hình hoặc ngày không hợp lệ.");
    }
    rows.push({
      companyCode: actor.companyCode,
      documentId,
      lineNo: index + 1,
      supplyId: item.supplyId,
      supplyCode: supply.code,
      supplyName: supply.name,
      baseUnit: profile.baseUnit,
      precision: profile.precision,
      enteredUnit: item.unit,
      enteredQuantity: item.quantity,
      conversionFactor: factor,
      profileVersion: profile.version,
      quantityScaled: amount,
      lotNumber: input.type === "issue" ? "" : item.lotNumber?.trim() || "",
      manufacturerKey: item.manufacturerKey?.trim() || "",
      expiryDay: input.type === "issue" ? "" : item.expiryDay || "",
      requestedLotId: input.type === "issue" ? item.lotId || "" : "",
      ...(input.type !== "issue" ? { totalValueMinor: item.totalValueMinor } : {}),
    });
  }
  return rows;
}
export async function createInventoryDocument(
  actor: InventoryActor,
  input: InventoryDraft,
  key: string,
  preferredNumber?: string,
  session?: ClientSession,
) {
  requireInventoryPermission(actor, "supply:document-create");
  if (!key) throw new SupplyError("IDEMPOTENCY_REQUIRED", "Cần mã thao tác để lập phiếu.");
  const requestedNumber = preferredNumber?.trim();
  if (requestedNumber && (requestedNumber.length > 100 || /[\u0000-\u001F\u007F]/.test(requestedNumber)))
    throw new SupplyError("INVALID_DOCUMENT_NUMBER", "Mã phiếu không hợp lệ.");
  await assertInventoryWarehouse(actor, input.warehouseId, true, session);
  await assertInventoryIndexes();
  const result = await runSupplyOperation(
    actor.companyCode,
    key,
    { operation: "v2.create", actor: actor.uid, branchId: actor.branchId, input, preferredNumber: requestedNumber },
    async (session) => {
      const config = await lockInventory(actor, session);
      await assertInventoryWarehouse(actor, input.warehouseId, true, session);
      const [doc] = await Document.create(
        [
          {
            companyCode: actor.companyCode,
            branchId: actor.branchId,
            warehouseId: input.warehouseId,
            number: requestedNumber || `VT-${String(config.writeVersion).padStart(8, "0")}`,
            type: input.type,
            reason: input.reason,
            recipientDepartment: input.recipientDepartment,
            supplierId: input.supplierId,
            createdBy: actor.uid,
            status: "draft",
          },
        ],
        { session },
      );
      const rows = await draftLines(actor, String(doc._id), input, session);
      await Line.insertMany(rows, { session, ordered: true });
      await documentAudit(actor, doc, "create", session);
      return { ...doc.toObject(), lines: rows };
    },
    session,
  );
  return inventoryView(actor, result);
}
export async function updateInventoryDocument(
  actor: InventoryActor,
  id: string,
  revision: number,
  input: InventoryDraft,
  key: string,
) {
  requireInventoryPermission(actor, "supply:document-create");
  if (!key) throw new SupplyError("IDEMPOTENCY_REQUIRED", "Cần mã thao tác.");
  await inventoryDocument(actor, id, undefined, true);
  await assertInventoryWarehouse(actor, input.warehouseId, true);
  const result = await runSupplyOperation(
    actor.companyCode,
    key,
    { operation: "v2.update", actor: actor.uid, branchId: actor.branchId, id, revision, input },
    async (session) => {
      await lockInventory(actor, session);
      const doc = await inventoryDocument(actor, id, session, true);
      if (doc.revision !== revision) throw new SupplyError("REVISION_CONFLICT", "Chứng từ đã thay đổi.", 409);
      if (!["draft", "rejected"].includes(doc.status))
        throw new SupplyError(
          "DOCUMENT_IMMUTABLE",
          "Chỉ sửa phiếu nháp hoặc bị từ chối. Phiếu đã gửi/duyệt/ghi sổ không sửa trực tiếp.",
          409,
        );
      await assertInventoryWarehouse(actor, input.warehouseId, true, session);
      const rows = await draftLines(actor, id, input, session);
      await Line.deleteMany({ companyCode: actor.companyCode, documentId: id }).session(session);
      await Line.insertMany(rows, { session, ordered: true });
      doc.set({
        warehouseId: input.warehouseId,
        type: input.type,
        reason: input.reason,
        supplierId: input.supplierId,
        recipientDepartment: input.recipientDepartment,
        status: "draft",
        revision: revision + 1,
        approvedBy: undefined,
        approvedRevision: undefined,
        decisionReason: undefined,
      });
      await doc.save({ session });
      await documentAudit(actor, doc, "update", session);
      return { ...doc.toObject(), lines: rows };
    },
  );
  return inventoryView(actor, result);
}
export async function transitionInventoryDocument(
  actor: InventoryActor,
  id: string,
  revision: number,
  action: "submit" | "approve" | "reject" | "cancel",
  reason: string,
  key: string,
  session?: ClientSession,
) {
  requireInventoryPermission(
    actor,
    ["approve", "reject"].includes(action) ? "supply:approve" : "supply:document-create",
  );
  if (!key) throw new SupplyError("IDEMPOTENCY_REQUIRED", "Cần mã thao tác.");
  if (!["submit", "approve", "reject", "cancel"].includes(action))
    throw new SupplyError("INVALID_ACTION", "Thao tác không hợp lệ.");
  if (["reject", "cancel"].includes(action) && !reason?.trim())
    throw new SupplyError("REASON_REQUIRED", "Cần lý do từ chối hoặc hủy.");
  await inventoryDocument(actor, id, session, true);
  return runSupplyOperation(
    actor.companyCode,
    key,
    { operation: "v2.transition", actor: actor.uid, branchId: actor.branchId, id, revision, action, reason },
    async (session) => {
      await lockInventory(actor, session);
      const doc = await inventoryDocument(actor, id, session, true);
      if (doc.revision !== revision) throw new SupplyError("REVISION_CONFLICT", "Chứng từ đã thay đổi.", 409);
      const valid =
        action === "submit"
          ? doc.status === "draft"
          : action === "approve" || action === "reject"
            ? doc.status === "submitted"
            : ["draft", "submitted", "approved", "rejected"].includes(doc.status);
      if (!valid) throw new SupplyError("DOCUMENT_STATE", "Trạng thái chứng từ không cho phép thao tác này.", 409);
      doc.revision++;
      doc.status = ({ submit: "submitted", approve: "approved", reject: "rejected", cancel: "cancelled" } as const)[
        action
      ];
      if (action === "submit") doc.submittedBy = actor.uid;
      if (action === "approve") {
        doc.approvedBy = actor.uid;
        doc.approvedRevision = doc.revision;
      }
      if (action === "cancel") doc.cancelledBy = actor.uid;
      doc.decisionReason = reason || undefined;
      await doc.save({ session });
      await documentAudit(actor, doc, action, session, reason);
      return doc.toObject();
    },
    session,
  );
}
export async function getInventoryDocument(actor: InventoryActor, id: string) {
  requireInventoryPermission(actor, "supply:read");
  const doc = await inventoryDocument(actor, id);
  const lines = await Line.find({ companyCode: actor.companyCode, documentId: id }).sort({ lineNo: 1 }).lean();
  return inventoryView(actor, { ...doc.toObject(), lines });
}
export async function listInventoryDocuments(actor: InventoryActor, page = 1, limit = 20) {
  const filter = await inventoryReadFilter(actor);
  const safePage = Math.max(1, Math.trunc(page) || 1),
    safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 20));
  const [data, total] = await Promise.all([
    Document.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Document.countDocuments(filter),
  ]);
  return {
    data: inventoryView(actor, data),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}
