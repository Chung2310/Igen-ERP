import type { ClientSession } from "mongoose";
import { runSupplyOperation } from "./atomic";
import { SupplyModel } from "../../model/supply.model";
import { SupplyTransactionModel } from "../../model/supply-transaction.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { DepartmentModel } from "../../model/department.model";
import { supplyExpiryDay } from "../../../shared/supply-stock";
import type { InventoryDraft } from "../../../shared/supply-inventory";
import { createInventoryDocument, transitionInventoryDocument } from "./inventory-document.service";
import { postInventoryDocument } from "./inventory-posting.service";
import type { InventoryActor } from "./inventory-access";
import type { LegacyStockPayload, SupplyActor } from "./legacy-write.service";
import { SupplyError } from "./errors";

function safeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new SupplyError("INVALID_QUANTITY", "Số lượng phải là số nguyên dương.");
  return quantity;
}

function receiptValue(quantity: number, unitPrice: unknown, supplyName: string) {
  const price = unitPrice === undefined || unitPrice === null || unitPrice === "" ? 0 : Number(unitPrice);
  const value = quantity * price;
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(value))
    throw new SupplyError("RECEIPT_VALUE_REQUIRED", `Cần đơn giá VND hợp lệ cho '${supplyName}'.`);
  return value;
}

/**
 * Compatibility writer used by the familiar Nhập/xuất UI after V2 activation.
 * The user never edits inventory documents directly: the workflow creates,
 * approves and posts the corresponding document on their behalf.
 */
export async function postInventoryFromLegacyUi(
  companyCode: string,
  actor: SupplyActor,
  data: LegacyStockPayload,
  branchId: string | undefined,
  operationKey: string,
  preferredNumber: string,
  outerSession?: ClientSession,
) {
  if (!branchId) throw new SupplyError("INVENTORY_SCOPE_REQUIRED", "Cần chọn chi nhánh để nhập/xuất kho.", 403);
  if (!operationKey) throw new SupplyError("IDEMPOTENCY_REQUIRED", "Cần mã thao tác chống ghi trùng.");

  return runSupplyOperation(
    companyCode,
    operationKey,
    { action: "stock-v2", actor: actor.uid, branchId, data },
    async (session) => {
      const ids = [...new Set(data.items.map((item) => item.supplyId))];
      const supplies = await SupplyModel.find({
        _id: { $in: ids },
        companyCode,
        branchId,
        isActive: { $ne: false },
      })
        .session(session)
        .lean();
      if (supplies.length !== ids.length)
        throw new SupplyError("SUPPLY_NOT_FOUND", "Có vật tư không còn tồn tại hoặc không thuộc chi nhánh.", 404);
      const byId = new Map(supplies.map((supply) => [String(supply._id), supply]));
      const warehouseIds = new Set(supplies.map((supply) => String(supply.warehouseId || "")).filter(Boolean));
      let warehouseId = [...warehouseIds][0];
      if (!warehouseId || warehouseIds.size === 0) {
        if (data.warehouseLocation?.trim()) {
          const matched = await WarehouseModel.findOne({
            companyCode,
            branchId,
            name: data.warehouseLocation.trim(),
            isActive: true,
          })
            .session(session)
            .lean();
          if (matched) warehouseId = String(matched._id);
        }
        if (!warehouseId) {
          const firstWh = await WarehouseModel.findOne({
            companyCode,
            branchId,
            isActive: true,
          })
            .session(session)
            .lean();
          if (firstWh) warehouseId = String(firstWh._id);
        }
      } else if (warehouseIds.size > 1) {
        throw new SupplyError("WAREHOUSE_CONFLICT", "Một phiếu chỉ được nhập/xuất vật tư trong cùng một kho.", 409);
      }
      if (!warehouseId)
        throw new SupplyError("WAREHOUSE_SCOPE", "Chưa có kho lưu trữ hoạt động trong chi nhánh này.", 403);
      const warehouse = await WarehouseModel.findOne({ _id: warehouseId, companyCode, branchId, isActive: true })
        .session(session)
        .lean();
      if (!warehouse)
        throw new SupplyError("WAREHOUSE_SCOPE", "Kho không còn hoạt động hoặc không thuộc chi nhánh.", 403);
      if (data.warehouseLocation?.trim() && data.warehouseLocation.trim() !== warehouse.name && warehouseIds.size === 1)
        throw new SupplyError("WAREHOUSE_CONFLICT", "Kho trên phiếu không khớp kho của vật tư.", 409);
      let recipientDepartment: string | undefined;
      if (data.type === "out") {
        const department = await DepartmentModel.findOne({
          companyCode,
          name: data.recipientDepartment?.trim(),
          isActive: true,
        })
          .session(session)
          .select("name")
          .lean();
        if (!department)
          throw new SupplyError(
            "INVALID_RECIPIENT_DEPARTMENT",
            "Khoa/phòng nhận không tồn tại hoặc đã ngừng hoạt động. Vui lòng chọn lại từ danh sách.",
            409,
          );
        recipientDepartment = department.name;
      }

      const inventoryActor: InventoryActor = {
        companyCode,
        branchId,
        uid: actor.uid,
        name: actor.name,
        permissions: new Set(["*"]),
      };
      const input: InventoryDraft = {
        type: data.type === "in" ? "receipt" : "issue",
        warehouseId,
        reason: data.reason.trim(),
        recipientDepartment,
        lines: data.items.map((item) => {
          const supply = byId.get(item.supplyId)!;
          const quantity = safeQuantity(item.quantity);
          return {
            supplyId: item.supplyId,
            quantity: String(quantity),
            unit: supply.unit,
            ...(data.type === "in"
              ? {
                  lotNumber: item.batchNumber?.trim() || supply.batchNumber || "",
                  expiryDay: supplyExpiryDay(item.expiryDate || supply.expiryDate) || "",
                  totalValueMinor: receiptValue(quantity, item.unitPrice ?? supply.unitPrice, supply.name),
                }
              : {}),
          };
        }),
      };

      const created: any = await createInventoryDocument(
        inventoryActor,
        input,
        `${operationKey}:create`,
        preferredNumber,
        session,
      );
      const submitted: any = await transitionInventoryDocument(
        inventoryActor,
        String(created._id),
        created.revision,
        "submit",
        "",
        `${operationKey}:submit`,
        session,
      );
      const approved: any = await transitionInventoryDocument(
        inventoryActor,
        String(created._id),
        submitted.revision,
        "approve",
        "",
        `${operationKey}:approve`,
        session,
      );
      const posted: any = await postInventoryDocument(
        inventoryActor,
        String(created._id),
        approved.revision,
        `${operationKey}:post`,
        session,
      );
      const transactions = await SupplyTransactionModel.find({ companyCode, branchId, batchCode: posted.number })
        .sort({ createdAt: 1 })
        .session(session)
        .lean();
      const updatedSupplies = await SupplyModel.find({ _id: { $in: ids }, companyCode, branchId })
        .session(session)
        .lean();
      return {
        batchCode: posted.number,
        type: data.type,
        totalItems: data.items.length,
        totalQuantity: data.items.reduce((sum, item) => sum + safeQuantity(item.quantity), 0),
        transactions,
        supplies: updatedSupplies,
      };
    },
    outerSession,
  );
}
