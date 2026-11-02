import { Types } from "mongoose";
import { BranchModel } from "../../../model/branch.model";
import { inventoryError } from "../inventory-scope";
import { ReceiptCounterModel } from "./receipt-counter.model";

export function receiptBusinessDay(now = new Date(), timeZone = process.env.INVENTORY_TIME_ZONE || "Asia/Ho_Chi_Minh") {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)!.value).join("");
  } catch {
    inventoryError("Múi giờ hoặc ngày cấp mã phiếu nhập không hợp lệ.", 503);
  }
}

export async function nextReceiptCode(scope: { companyCode: string; branchId: string }, businessDay: string) {
  const companyCode = String(scope.companyCode || "").trim().toUpperCase();
  const branchId = String(scope.branchId || "").trim().toLowerCase();
  if (!companyCode || !Types.ObjectId.isValid(branchId) || !/^\d{8}$/.test(businessDay)) inventoryError("Phạm vi cấp mã phiếu nhập không hợp lệ.");
  if (!await BranchModel.exists({ _id: branchId, companyCode, isActive: true })) inventoryError("Chi nhánh không hợp lệ.");
  const key = JSON.stringify([companyCode, branchId, businessDay]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      // Intentionally outside the document transaction: failed creation leaves
      // a gap, and deleting a receipt never makes its number available again.
      const counter = await ReceiptCounterModel.findOneAndUpdate(
        { _id: key, sequence: { $lt: Number.MAX_SAFE_INTEGER } },
        { $inc: { sequence: 1 }, $setOnInsert: { companyCode, branchId, businessDay } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: false, writeConcern: { w: "majority" } },
      ).lean();
      if (!counter || !Number.isSafeInteger(counter.sequence) || counter.sequence < 1) inventoryError("Bộ đếm phiếu nhập không hợp lệ.", 409);
      return `PN-${branchId.toUpperCase()}-${businessDay}-${String(counter.sequence).padStart(6, "0")}`;
    } catch (error: any) {
      if (error?.code !== 11000 || error?.keyPattern?._id !== 1) throw error;
    }
  }
  inventoryError("Không thể cấp số phiếu nhập sau các lần thử; hãy kiểm tra bộ đếm rồi thử lại.", 409);
}

export function isReceiptCodeCollision(error: any) {
  return error?.code === 11000 && error?.keyPattern?.companyCode === 1 && error?.keyPattern?.receiptCode === 1;
}
