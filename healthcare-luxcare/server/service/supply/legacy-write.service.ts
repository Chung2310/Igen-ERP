import { assertRecipientDepartment } from "./recipient-department";
import { assertLegacyInventoryMode } from "./inventory-access";
import { createHash, randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { SupplyModel } from "../../model/supply.model";
import { SupplyTransactionModel } from "../../model/supply-transaction.model";
import { SupplyAuditModel } from "../../model/supply-audit.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { RoomModel } from "../../model/room.model";
import { SupplierModel } from "../../model/supplier.model";
import { supplyExpiryDay, supplyStockStatus, supplyExpiryState } from "../../../shared/supply-stock";
import { canonical, runSupplyAtomic, runSupplyOperation } from "./atomic";
import { SupplyError } from "./errors";
import {
  SupplyInventoryConfigModel,
  SupplyInventoryProfileModel,
  SupplyStockBalanceModel,
} from "../../model/supply-inventory.model";

export interface SupplyActor {
  uid: string;
  name: string;
}
export interface StockItem {
  supplyId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string | Date | null;
  unitPrice?: number;
  notes?: string;
}
export interface LegacyStockPayload {
  type: "in" | "out";
  batchCode?: string;
  supplier?: string;
  warehouseLocation?: string;
  recipientDepartment?: string;
  reason: string;
  branchId?: string;
  items: StockItem[];
}
export function supplyScope(companyCode: string, branchId?: string) {
  if (!companyCode) throw new SupplyError("SUPPLY_SCOPE_REQUIRED", "Thiếu phạm vi công ty.", 403);
  return { companyCode, ...(branchId ? { branchId } : {}) };
}
function quantity(value: unknown, allowZero = false) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1))
    throw new SupplyError("INVALID_QUANTITY", "Số lượng phải là số nguyên hợp lệ và không được âm.");
  return number;
}
function date(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const day = supplyExpiryDay(value as string);
  if (!day) throw new SupplyError("INVALID_EXPIRY", "Hạn dùng không hợp lệ.");
  return new Date(`${day}T00:00:00.000Z`);
}
function active(supply: any) {
  if (!supply) throw new SupplyError("SUPPLY_NOT_FOUND", "Không tìm thấy vật tư trong phạm vi được phép.", 404);
  if (supply.isActive === false) throw new SupplyError("SUPPLY_ARCHIVED", "Vật tư đã ngừng sử dụng.", 409);
}
async function references(companyCode: string, data: any, session: ClientSession | null) {
  if (data.warehouseId) {
    const warehouse = await WarehouseModel.findOne({ _id: data.warehouseId, companyCode, isActive: true })
      .session(session)
      .lean();
    if (!warehouse || (warehouse.branchId && String(warehouse.branchId) !== String(data.branchId || "")))
      throw new SupplyError("INVALID_WAREHOUSE", "Kho không thuộc phạm vi chi nhánh hoặc đã ngừng hoạt động.");
    data.warehouseLocation = warehouse.name;
  }
  if (
    data.roomId &&
    !(await RoomModel.exists({ _id: data.roomId, companyCode, branchId: data.branchId || "", isActive: true }).session(
      session,
    ))
  )
    throw new SupplyError("INVALID_ROOM", "Phòng không thuộc chi nhánh hoặc đã ngừng hoạt động.");
  if (data.supplierId) {
    const supplier = await SupplierModel.findOne({ _id: data.supplierId, companyCode, isActive: true })
      .session(session)
      .lean();
    if (!supplier)
      throw new SupplyError("INVALID_SUPPLIER", "Nhà cung cấp không thuộc công ty hoặc đã ngừng hoạt động.");
    data.supplier = supplier.name;
  }
}
async function audit(supply: any, actor: SupplyActor, action: string, before: any, session: ClientSession) {
  await SupplyAuditModel.create(
    [
      {
        companyCode: supply.companyCode,
        branchId: supply.branchId,
        supplyId: String(supply._id),
        actorId: actor.uid,
        action,
        before,
        after: supply.toObject(),
      },
    ],
    { session },
  );
}
const editable = [
  "name",
  "code",
  "category",
  "unit",
  "supplier",
  "supplierId",
  "warehouseLocation",
  "warehouseId",
  "roomId",
  "batchNumber",
  "inspectionCertificateNumber",
  "imageUrl",
  "images",
  "documents",
  "unitPrice",
  "notes",
  "branchId",
  "minQuantity",
  "expiryDate",
  "requiresExpiry",
  "manufactureDate",
  "inspectionDate",
  "nextInspectionDate",
];
const protectedFields = [
  "unit",
  "warehouseId",
  "warehouseLocation",
  "roomId",
  "batchNumber",
  "expiryDate",
  "unitPrice",
  "branchId",
  "requiresExpiry",
];
function comparable(key: string, value: any) {
  return key === "expiryDate"
    ? supplyExpiryDay(value)
    : key === "requiresExpiry"
      ? value !== false
      : key === "unitPrice"
        ? (value ?? 0)
        : (value ?? "");
}

export async function createLegacySupply(companyCode: string, data: any, actor: SupplyActor, key?: string) {
  supplyScope(companyCode);
  const openingQuantity = quantity(data.quantity ?? 0, true);
  const payload = { action: "create", actor: actor.uid, data };
  if (key && !/^[a-zA-Z0-9:_-]{8,128}$/.test(key))
    throw new SupplyError("INVALID_IDEMPOTENCY_KEY", "Mã thao tác không hợp lệ.");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(canonical(payload)))
    .digest("hex");
  const replay = async () => {
    if (!key) return null;
    const existing = await SupplyModel.findOne({ companyCode, "catalogCreation.key": key }).select("+catalogCreation");
    if (!existing) return null;
    if (existing.catalogCreation?.fingerprint !== fingerprint)
      throw new SupplyError(
        "IDEMPOTENCY_CONFLICT",
        "Mã thao tác đã dùng cho nội dung khác. Vui lòng mở phiếu mới.",
        409,
      );
    return existing.catalogCreation.snapshot;
  };
  const create = async (session: ClientSession | null) => {
    // A zero-stock catalog item does not write inventory and remains valid
    // while the company is preparing or already using V2 inventory.
    if (openingQuantity > 0) await assertLegacyInventoryMode(companyCode, session);
    const draft: any = Object.fromEntries(editable.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));
    draft.code = String(draft.code || "").trim();
    draft.name = String(draft.name || "").trim();
    draft.quantity = openingQuantity;
    draft.minQuantity = quantity(data.minQuantity ?? 10, true);
    draft.requiresExpiry = data.requiresExpiry !== false;
    draft.expiryDate = date(data.expiryDate);
    if (!draft.requiresExpiry && draft.expiryDate)
      throw new SupplyError("INVALID_EXPIRY_POLICY", "Vật tư không quản lý hạn dùng không được khai báo hạn dùng.");
    draft.inspectionDate = data.inspectionDate || new Date();
    for (const k of ["manufactureDate", "nextInspectionDate"]) draft[k] = data[k] || undefined;
    draft.warehouseLocation = String(data.warehouseLocation || "Chưa phân bổ").trim();
    draft.supplier = String(data.supplier || "Chưa phân bổ").trim();
    await references(companyCode, draft, session);
    draft.status = supplyStockStatus(draft.quantity, draft.minQuantity, draft.expiryDate, draft.requiresExpiry);
    // A catalog with no stock is a single-document write, including its creation record.
    // Stock-bearing creation still writes the item, ledger and audit in one transaction.
    if (!session) {
      const supply = new SupplyModel({ ...draft, companyCode, isActive: true });
      supply.createdAt = new Date();
      supply.updatedAt = supply.createdAt;
      const snapshot = supply.toObject();
      supply.catalogCreation = { actorId: actor.uid, key, fingerprint, snapshot };
      await supply.save();
      if (SupplyInventoryProfileModel.db?.readyState === 1) {
        await SupplyInventoryProfileModel.create([
          {
            companyCode,
            supplyId: String(supply._id),
            baseUnit: supply.unit || "Cái",
            precision: 0,
            trackingMode: supply.batchNumber || supply.requiresExpiry !== false ? "lot" : "none",
            requiresExpiry: supply.requiresExpiry !== false,
            conversions: [],
            version: 1,
          },
        ]).catch(() => undefined);
      }
      const { catalogCreation: _creation, ...result } = supply.toObject();
      return result;
    }
    const [supply] = await SupplyModel.create([{ ...draft, companyCode, isActive: true }], { session });
    if (SupplyInventoryProfileModel.db?.readyState === 1) {
      await SupplyInventoryProfileModel.create(
        [
          {
            companyCode,
            supplyId: String(supply._id),
            baseUnit: supply.unit || "Cái",
            precision: 0,
            trackingMode: supply.batchNumber || supply.requiresExpiry !== false ? "lot" : "none",
            requiresExpiry: supply.requiresExpiry !== false,
            conversions: [],
            version: 1,
          },
        ],
        { session: session || undefined },
      ).catch(() => undefined);
    }
    if (draft.quantity > 0) {
      await SupplyTransactionModel.create(
        [
          {
            companyCode,
            branchId: supply.branchId,
            supplyId: String(supply._id),
            supplyCode: supply.code,
            supplyName: supply.name,
            type: "in",
            quantity: supply.quantity,
            balanceBefore: 0,
            balanceAfter: supply.quantity,
            performerId: actor.uid,
            performerName: actor.name,
            reason: "Tồn đầu kỳ khi tạo vật tư",
            batchNumber: supply.batchNumber,
            expiryDate: supply.expiryDate,
            unitPrice: supply.unitPrice,
            batchCode: `OPEN-${supply._id}`,
          },
        ],
        { session },
      );
    }
    await audit(supply, actor, "create", null, session);
    return supply.toObject();
  };
  const previous = await replay();
  if (previous) return previous;
  if (openingQuantity > 0) return runSupplyOperation(companyCode, key, payload, create);
  try {
    return await create(null);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const previous = await replay();
      if (previous) return previous;
    }
    throw error;
  }
}

export async function updateLegacySupply(
  companyCode: string,
  id: string,
  patch: any,
  actor: SupplyActor,
  branchId?: string,
) {
  if (patch.quantity !== undefined)
    throw new SupplyError("DIRECT_STOCK_EDIT_FORBIDDEN", "Không sửa trực tiếp số tồn. Vui lòng dùng chứng từ kho.");
  return runSupplyAtomic(async (session) => {
    await assertLegacyInventoryMode(companyCode, session);
    const supply = await SupplyModel.findOne({ _id: id, ...supplyScope(companyCode, branchId) }).session(session);
    if (!supply) return null;
    active(supply);
    const before = supply.toObject();
    const next: any = {
      ...before,
      ...Object.fromEntries(editable.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]])),
    };
    next.expiryDate = date(next.expiryDate);
    if (next.requiresExpiry === false && next.expiryDate)
      throw new SupplyError("INVALID_EXPIRY_POLICY", "Vật tư không quản lý hạn dùng không được khai báo hạn dùng.");
    if (
      ["warehouseId", "roomId", "supplierId", "branchId"].some(
        (k) => patch[k] !== undefined && patch[k] !== (before as any)[k],
      )
    )
      await references(companyCode, next, session);
    const changedStockIdentity = protectedFields.some(
      (k) => comparable(k, next[k]) !== comparable(k, (before as any)[k]),
    );
    if (
      changedStockIdentity &&
      (supply.quantity > 0 || (await SupplyTransactionModel.exists({ companyCode, supplyId: id }).session(session)))
    )
      throw new SupplyError(
        "STOCK_METADATA_LOCKED",
        "Vật tư đã có tồn hoặc lịch sử: không đổi đơn vị, lô, hạn, kho, chi nhánh hoặc giá trực tiếp.",
        409,
      );
    for (const field of editable)
      if (next[field] !== undefined)
        supply.set(
          field,
          next[field] === "" && ["manufactureDate", "nextInspectionDate", "inspectionDate"].includes(field)
            ? null
            : next[field],
        );
    supply.minQuantity = quantity(next.minQuantity, true);
    supply.status = supplyStockStatus(supply.quantity, supply.minQuantity, supply.expiryDate, supply.requiresExpiry);
    await supply.save({ session });
    await audit(supply, actor, "update", before, session);
    return supply.toObject();
  });
}

export async function archiveLegacySupply(
  companyCode: string,
  id: string,
  actor: SupplyActor,
  branchId?: string,
  restore = false,
) {
  return runSupplyAtomic(async (session) => {
    const inventoryConfig = await SupplyInventoryConfigModel.findOne({ companyCode })
      .session(session)
      .select("mode")
      .lean();
    if (inventoryConfig?.mode === "preparing")
      throw new SupplyError(
        "INVENTORY_MIGRATION_IN_PROGRESS",
        "Kho đang chuyển dữ liệu. Vui lòng thử lại sau khi quá trình chuyển đổi hoàn tất.",
        409,
      );
    if (!inventoryConfig || inventoryConfig.mode === "legacy") {
      await assertLegacyInventoryMode(companyCode, session);
    }
    const supply = await SupplyModel.findOne({ _id: id, ...supplyScope(companyCode, branchId) }).session(session);
    if (!supply) return { matchedCount: 0 };
    if (!restore) {
      const hasV2Stock =
        inventoryConfig?.mode === "v2" &&
        Boolean(
          await SupplyStockBalanceModel.exists({
            companyCode,
            supplyId: id,
            quantityScaled: { $gt: 0 },
          }).session(session),
        );
      if (supply.quantity !== 0 || hasV2Stock)
        throw new SupplyError("SUPPLY_HAS_STOCK", "Vật tư còn tồn kho. Cần xử lý số tồn trước khi ngừng sử dụng.", 409);
    }
    const before = supply.toObject();
    supply.isActive = restore;
    supply.archivedAt = restore ? undefined : new Date();
    supply.archivedBy = restore ? undefined : actor.uid;
    await supply.save({ session });
    await audit(supply, actor, restore ? "restore" : "archive", before, session);
    return { matchedCount: 1 };
  });
}

export async function postLegacyStock(
  companyCode: string,
  actor: SupplyActor,
  data: LegacyStockPayload,
  branchId?: string,
  key?: string,
  session?: ClientSession,
) {
  if (!actor.uid) throw new SupplyError("SUPPLY_ACTOR_REQUIRED", "Thiếu người thực hiện.", 403);
  if (!["in", "out"].includes(data.type) || !data.items?.length || data.items.length > 200)
    throw new SupplyError("INVALID_STOCK_DOCUMENT", "Phiếu phải có từ 1 đến 200 dòng và loại nhập/xuất hợp lệ.");
  if (!data.reason?.trim() || (data.type === "out" && !data.recipientDepartment?.trim()))
    throw new SupplyError("STOCK_REASON_REQUIRED", "Cần lý do và khoa/phòng nhận khi xuất dùng.");
  const code =
    data.batchCode?.trim() ||
    `${data.type === "in" ? "PNK" : "PXK"}-${key ? createHash("sha256").update(key).digest("hex").slice(0, 24) : randomUUID()}`;
  const totals = new Map<string, number>();
  for (const item of data.items)
    totals.set(item.supplyId, quantity((totals.get(item.supplyId) || 0) + quantity(item.quantity)));
  const config = await SupplyInventoryConfigModel.findOne({ companyCode })
    .session(session || null)
    .select("mode")
    .lean();
  if (config?.mode === "preparing")
    throw new SupplyError("INVENTORY_MIGRATION_IN_PROGRESS", "Kho đang chuyển dữ liệu, vui lòng thử lại sau.", 409);
  if (!config || config.mode !== "legacy") {
    if (!config) {
      await SupplyInventoryConfigModel.create(
        [
          {
            companyCode,
            mode: "v2",
            writeVersion: 0,
            timeZone: "Asia/Ho_Chi_Minh",
            currency: "VND",
            activatedAt: new Date(),
          },
        ],
        { session: session || undefined },
      ).catch(() => undefined);
    }
    const { postInventoryFromLegacyUi } = await import("./inventory-legacy-bridge.service");
    return postInventoryFromLegacyUi(
      companyCode,
      actor,
      { ...data, batchCode: code },
      branchId,
      key || "",
      code,
      session,
    );
  }
  return runSupplyOperation(
    companyCode,
    key,
    { action: "stock", actor: actor.uid, branchId, data },
    async (session) => {
      await assertLegacyInventoryMode(companyCode, session);
      const supplies = await SupplyModel.find({
        _id: { $in: [...totals.keys()] },
        ...supplyScope(companyCode, branchId),
      })
        .sort({ _id: 1 })
        .session(session);
      const byId = new Map(supplies.map((s) => [String(s._id), s]));
      for (const [id, total] of totals) {
        const supply = byId.get(id);
        active(supply);
        if (data.type === "out") {
          const expiry = supplyExpiryState(supply!.expiryDate, supply!.requiresExpiry !== false);
          if (expiry === "expired" || expiry === "unknown")
            throw new SupplyError(
              expiry === "expired" ? "EXPIRED_STOCK" : "QUALITY_BLOCKED",
              `Vật tư '${supply!.name}' hết hạn hoặc chưa xác minh hạn dùng, không được xuất dùng.`,
            );
          if (supply!.quantity < total)
            throw new SupplyError(
              "INSUFFICIENT_STOCK",
              `Vật tư '${supply!.name}' không đủ tồn cho tổng số lượng ${total}.`,
              409,
            );
        }
      }
      if (data.type === "out") await assertRecipientDepartment(companyCode, data.recipientDepartment, session);
      const transactions = [];
      for (const item of data.items) {
        const supply = byId.get(item.supplyId)!;
        const amount = quantity(item.quantity);
        const before = supply.quantity;
        if (data.type === "in") {
          const changedLot = !!item.batchNumber?.trim() && item.batchNumber.trim() !== supply.batchNumber;
          const incoming = {
            batchNumber: item.batchNumber?.trim() || supply.batchNumber,
            expiryDate: item.expiryDate ? date(item.expiryDate) : changedLot ? null : supply.expiryDate,
            unitPrice: item.unitPrice ?? (changedLot ? undefined : supply.unitPrice),
          };
          if (
            before > 0 &&
            ["batchNumber", "expiryDate", "unitPrice"].some(
              (k) => comparable(k, (incoming as any)[k]) !== comparable(k, (supply as any)[k]),
            )
          )
            throw new SupplyError(
              "LOT_CONFLICT",
              `Vật tư '${supply.name}' còn tồn: không thể gộp lô, hạn hoặc giá khác vào số tồn hiện tại.`,
              409,
            );
          if (data.warehouseLocation?.trim() && data.warehouseLocation.trim() !== supply.warehouseLocation)
            throw new SupplyError(
              "WAREHOUSE_CONFLICT",
              `Kho trên phiếu không khớp kho của '${supply.name}'. Không thể đổi kho bằng phiếu nhập.`,
              409,
            );
          if (!supply.requiresExpiry && incoming.expiryDate)
            throw new SupplyError(
              "INVALID_EXPIRY_POLICY",
              "Vật tư không quản lý hạn dùng không được khai báo hạn dùng.",
            );
          supply.batchNumber = incoming.batchNumber;
          supply.expiryDate = incoming.expiryDate;
          supply.unitPrice = incoming.unitPrice;
        }
        supply.quantity = quantity(before + (data.type === "in" ? amount : -amount), true);
        supply.status = supplyStockStatus(
          supply.quantity,
          supply.minQuantity,
          supply.expiryDate,
          supply.requiresExpiry !== false,
        );
        await supply.save({ session });
        const [tx] = await SupplyTransactionModel.create(
          [
            {
              companyCode,
              branchId: supply.branchId,
              supplyId: String(supply._id),
              supplyCode: supply.code,
              supplyName: supply.name,
              type: data.type,
              quantity: amount,
              balanceBefore: before,
              balanceAfter: supply.quantity,
              performerId: actor.uid,
              performerName: actor.name,
              recipientDepartment: data.recipientDepartment,
              reason: data.reason,
              batchNumber: supply.batchNumber,
              expiryDate: supply.expiryDate,
              batchCode: code,
              supplier: data.supplier || supply.supplier,
              unitPrice: supply.unitPrice,
            },
          ],
          { session },
        );
        transactions.push(tx.toObject());
      }
      return {
        batchCode: code,
        type: data.type,
        totalItems: data.items.length,
        totalQuantity: [...totals.values()].reduce((a, b) => a + b, 0),
        transactions,
        supplies: [...byId.values()].map((s) => s.toObject()),
      };
    },
    session,
  );
}
