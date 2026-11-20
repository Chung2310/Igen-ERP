import { runSupplyOperation } from "./atomic";
import { assertRecipientDepartment } from "./recipient-department";
import { SupplyModel } from "../../model/supply.model";
import { SupplyTransactionModel } from "../../model/supply-transaction.model";
import { SupplyVoucherModel } from "../../model/supply-voucher.model";
import { SupplyError } from "./errors";
import { postLegacyStock, supplyScope, type LegacyStockPayload, type SupplyActor } from "./legacy-write.service";

async function voucherPayload(companyCode: string, branchId: string | undefined, data: LegacyStockPayload) {
  const batchCode = data.batchCode?.trim();
  if (!batchCode) throw new SupplyError("VOUCHER_CODE_REQUIRED", "Mã phiếu là bắt buộc.");
  if (!data.items?.length || data.items.length > 200)
    throw new SupplyError("INVALID_STOCK_DOCUMENT", "Phiếu phải có từ 1 đến 200 mặt hàng.");

  const ids = [...new Set(data.items.map((item) => item.supplyId))];
  const supplies = await SupplyModel.find({
    _id: { $in: ids },
    ...supplyScope(companyCode, branchId),
    isActive: { $ne: false },
  }).lean();
  const byId = new Map(supplies.map((item) => [String(item._id), item]));
  if (byId.size !== ids.length)
    throw new SupplyError("SUPPLY_NOT_FOUND", "Có vật tư không còn tồn tại hoặc đã ngừng sử dụng.", 404);

  if (data.type === "out") await assertRecipientDepartment(companyCode, data.recipientDepartment);
  const runningBalance = new Map(supplies.map((item) => [String(item._id), item.quantity]));
  const items = data.items.map((item) => {
    const supply = byId.get(item.supplyId)!;
    const quantity = Number(item.quantity);
    const balanceBefore = runningBalance.get(item.supplyId)!;
    const balanceAfter = balanceBefore + (data.type === "in" ? quantity : -quantity);
    runningBalance.set(item.supplyId, balanceAfter);
    return {
      supplyId: item.supplyId,
      supplyCode: supply.code,
      supplyName: supply.name,
      quantity,
      balanceBefore,
      balanceAfter,
      batchNumber: item.batchNumber?.trim() || supply.batchNumber,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : supply.expiryDate,
      unitPrice: item.unitPrice ?? supply.unitPrice,
      notes: item.notes?.trim(),
    };
  });

  return {
    batchCode,
    type: data.type,
    reason: data.reason.trim(),
    supplier: data.supplier?.trim(),
    warehouseLocation: data.warehouseLocation?.trim(),
    recipientDepartment: data.recipientDepartment?.trim(),
    items,
  };
}

async function assertVoucherCodeAvailable(companyCode: string, batchCode: string, excludeId?: string) {
  const [transaction, voucher] = await Promise.all([
    SupplyTransactionModel.exists({ companyCode, batchCode }),
    SupplyVoucherModel.exists({
      companyCode,
      batchCode,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }),
  ]);
  if (transaction || voucher)
    throw new SupplyError("VOUCHER_CODE_EXISTS", `Mã phiếu '${batchCode}' đã được sử dụng.`, 409);
}

export async function createVoucherDraft(
  companyCode: string,
  actor: SupplyActor,
  data: LegacyStockPayload,
  branchId?: string,
) {
  const payload = await voucherPayload(companyCode, branchId, data);
  await assertVoucherCodeAvailable(companyCode, payload.batchCode);
  return SupplyVoucherModel.create({
    ...payload,
    companyCode,
    branchId,
    status: "draft",
    performerId: actor.uid,
    performerName: actor.name,
  });
}

export async function updateVoucherDraft(companyCode: string, id: string, data: LegacyStockPayload, branchId?: string) {
  const voucher = await SupplyVoucherModel.findOne({ _id: id, ...supplyScope(companyCode, branchId) });
  if (!voucher) throw new SupplyError("VOUCHER_NOT_FOUND", "Không tìm thấy phiếu nháp.", 404);
  if (voucher.status !== "draft")
    throw new SupplyError("VOUCHER_LOCKED", "Phiếu đã hoàn tất nên không thể chỉnh sửa.", 409);
  const payload = await voucherPayload(companyCode, branchId, data);
  await assertVoucherCodeAvailable(companyCode, payload.batchCode, id);
  const updated = await SupplyVoucherModel.findOneAndUpdate(
    { _id: id, ...supplyScope(companyCode, branchId), status: "draft", __v: voucher.__v },
    { $set: payload, $inc: { __v: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) throw new SupplyError("VOUCHER_LOCKED", "Phiếu đã thay đổi hoặc đang hoàn tất. Vui lòng tải lại.", 409);
  return updated;
}

export async function completeVoucherDraft(companyCode: string, id: string, actor: SupplyActor, branchId?: string) {
  return runSupplyOperation(
    companyCode,
    "complete-voucher:" + id,
    { action: "complete-voucher", id, branchId, actor: actor.uid },
    async (session) => {
      const voucher = await SupplyVoucherModel.findOneAndUpdate(
        { _id: id, ...supplyScope(companyCode, branchId), status: "draft" },
        { $set: { status: "completing" } },
        { session, returnDocument: "after" },
      );
      if (!voucher)
        throw new SupplyError(
          "VOUCHER_LOCKED",
          "Phiếu không còn ở trạng thái nháp hoặc không thuộc phạm vi được phép.",
          409,
        );
      const data: LegacyStockPayload = {
        type: voucher.type as "in" | "out",
        batchCode: voucher.batchCode,
        reason: voucher.reason,
        supplier: voucher.supplier,
        warehouseLocation: voucher.warehouseLocation,
        recipientDepartment: voucher.recipientDepartment,
        items: voucher.items.map((item: any) => ({
          supplyId: item.supplyId,
          quantity: item.quantity,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      };
      const result = await postLegacyStock(companyCode, actor, data, branchId, "voucher:" + id, session);
      await SupplyVoucherModel.updateOne(
        { _id: id, ...supplyScope(companyCode, branchId), status: "completing" },
        { $set: { status: "completed", completedAt: new Date() } },
        { session },
      );
      return result;
    },
  );
}
