import { assertRecipientDepartment } from "./recipient-department";
import type { ClientSession } from "mongoose";
import { supplyBusinessDay, supplyStockStatus } from "../../../shared/supply-stock";
import { SupplyModel } from "../../model/supply.model";
import { SupplyTransactionModel } from "../../model/supply-transaction.model";
import {
  SupplyStockDocumentLineModel as Line,
  SupplyInventoryProfileModel as Profile,
  SupplyLotModel as Lot,
  SupplyStockBalanceModel as Balance,
  SupplyCostLayerModel as Layer,
  SupplyStockLedgerModel as Ledger,
  SupplyWarehouseGuardModel as Guard,
  SupplyInventoryPeriodModel as Period,
  SupplyInventoryOutboxModel as Outbox,
} from "../../model/supply-inventory.model";
import { runSupplyOperation } from "./atomic";
import { checkedAdd, allocateValue } from "./quantity";
import { SupplyError } from "./errors";
import { requireInventoryPermission, inventoryView, lockInventory, type InventoryActor } from "./inventory-access";
import { inventoryDocument, documentAudit, validExpiryDay } from "./inventory-document.service";
import { assertInventoryIndexes } from "./inventory-indexes";

type StockKey = {
  companyCode: string;
  branchId: string;
  warehouseId: string;
  locationId: string;
  supplyId: string;
  lotId: string;
  containerId: string;
  quality: string;
};
async function moveBalance(key: StockKey, qty: number, value: number, session: ClientSession) {
  let balance = await Balance.findOne(key).session(session);
  const before = balance?.quantityScaled || 0,
    valueBefore = balance?.valueMinor || 0;
  const after = checkedAdd(before, qty),
    valueAfter = checkedAdd(valueBefore, value);
  if (!balance) {
    const [created] = await Balance.create([{ ...key, quantityScaled: after, valueMinor: valueAfter, version: 1 }], {
      session,
    });
    balance = created;
  } else {
    balance.quantityScaled = after;
    balance.valueMinor = valueAfter;
    balance.version++;
    await balance.save({ session });
  }
  return { balanceBefore: before, balanceAfter: after, valueBefore, valueAfter };
}

export async function postInventoryDocument(
  actor: InventoryActor,
  id: string,
  revision: number,
  key: string,
  session?: ClientSession,
) {
  requireInventoryPermission(actor, "supply:post");
  if (!key) throw new SupplyError("IDEMPOTENCY_REQUIRED", "Cần mã thao tác để ghi sổ.");
  const requested = await inventoryDocument(actor, id, session, true);
  if (requested.type === "opening") requireInventoryPermission(actor, "supply:adjust");
  await assertInventoryIndexes();
  const result = await runSupplyOperation(
    actor.companyCode,
    key,
    { operation: "v2.post", actor: actor.uid, branchId: actor.branchId, id, revision },
    async (session) => {
      const config = await lockInventory(actor, session);
      const doc = await inventoryDocument(actor, id, session, true);
      if (doc.revision !== revision)
        throw new SupplyError("REVISION_CONFLICT", "Phiếu đã thay đổi hoặc được xử lý.", 409);
      if (doc.status !== "approved" || doc.approvedRevision !== revision)
        throw new SupplyError("APPROVAL_REQUIRED", "Chỉ ghi sổ phiên bản phiếu đã duyệt.", 409);
      if (doc.type === "issue") await assertRecipientDepartment(actor.companyCode, doc.recipientDepartment, session);
      const now = new Date(),
        day = supplyBusinessDay(now, config.timeZone);
      const guard = await Guard.findOne({ companyCode: actor.companyCode, warehouseId: doc.warehouseId })
        .session(session)
        .lean();
      if (guard?.lockedByStocktakeId)
        throw new SupplyError("STOCKTAKE_LOCKED", "Kho đang kiểm kê, chưa được ghi biến động.", 409);
      const period = await Period.findOne({ companyCode: actor.companyCode, branchId: actor.branchId })
        .session(session)
        .lean();
      if (period && period.closedThroughDay >= day)
        throw new SupplyError("PERIOD_CLOSED", "Ngày ghi sổ thuộc kỳ đã đóng.", 409);
      const lines = await Line.find({ companyCode: actor.companyCode, documentId: id })
        .sort({ lineNo: 1 })
        .session(session);
      if (!lines.length || lines.length > 200)
        throw new SupplyError("INVALID_DOCUMENT", "Số dòng chứng từ không hợp lệ.");
      if (
        doc.type === "opening" &&
        (await Ledger.exists({
          companyCode: actor.companyCode,
          branchId: actor.branchId,
          warehouseId: doc.warehouseId,
          supplyId: { $in: lines.map((l) => l.supplyId) },
        }).session(session))
      )
        throw new SupplyError(
          "OPENING_ALREADY_EXISTS",
          "Vật tư đã có sổ tại kho này; cần dùng nghiệp vụ điều chỉnh thay vì mở sổ lần nữa.",
          409,
        );
      let allocationNo = 0;
      const movements = [];
      for (const line of lines) {
        const profile = await Profile.findOne({ companyCode: actor.companyCode, supplyId: line.supplyId })
          .session(session)
          .lean();
        if (!profile || profile.version !== line.profileVersion)
          throw new SupplyError("PROFILE_CHANGED", "Cấu hình vật tư đã thay đổi so với phiếu.", 409);
        const catalogSupply = await SupplyModel.findOne({
          _id: line.supplyId,
          companyCode: actor.companyCode,
          branchId: actor.branchId,
          isActive: { $ne: false },
        }).session(session);
        if (!catalogSupply) throw new SupplyError("SUPPLY_ARCHIVED", "Vật tư đã ngừng hoạt động.", 409);
        const base = {
          companyCode: actor.companyCode,
          branchId: actor.branchId,
          warehouseId: doc.warehouseId,
          locationId: "",
          supplyId: line.supplyId,
          containerId: "",
        };
        const allocations: { quantity: number; value: number; lotNumber: string; expiryDay: string }[] = [];
        const record = async (stockKey: StockKey, layerId: string, quantity: number, value: number) => {
          if (++allocationNo > 1000)
            throw new SupplyError("ALLOCATION_LIMIT", "Phiếu vượt 1.000 phân bổ, cần chia nhỏ phiếu trước khi ghi sổ.");
          const balances = await moveBalance(stockKey, quantity, value, session);
          const [entry] = await Ledger.create(
            [
              {
                ...stockKey,
                documentId: id,
                lineId: String(line._id),
                allocationNo,
                layerId,
                deltaQty: quantity,
                deltaValue: value,
                ...balances,
                actorId: actor.uid,
                postedAt: now,
                postedDay: day,
              },
            ],
            { session },
          );
          movements.push(entry.toObject());
        };
        if (doc.type !== "issue") {
          const lotKey = {
            companyCode: actor.companyCode,
            supplyId: line.supplyId,
            manufacturerKey: line.manufacturerKey || "",
            lotNumber: line.lotNumber || "",
          };
          let lot = await Lot.findOne(lotKey).session(session);
          if (lot && lot.expiryDay !== (line.expiryDay || ""))
            throw new SupplyError(
              "LOT_EXPIRY_CONFLICT",
              "Cùng số lô nhưng khác hạn dùng; cần xác minh, không ghi đè lô cũ.",
              409,
            );
          if (!lot) {
            const [created] = await Lot.create([{ ...lotKey, expiryDay: line.expiryDay || "" }], { session });
            lot = created;
          }
          if (lot.recalled)
            throw new SupplyError("LOT_RECALLED", "Lô đã bị thu hồi, không nhận thêm bằng phiếu nhập thường.", 409);
          const quality =
            profile.requiresExpiry && (!validExpiryDay(lot.expiryDay) || lot.expiryDay < day)
              ? "quarantine"
              : "available";
          const stockKey = { ...base, lotId: String(lot._id), quality };
          if (!Number.isSafeInteger(line.totalValueMinor) || line.totalValueMinor! < 0)
            throw new SupplyError("RECEIPT_VALUE_REQUIRED", "Thiếu giá trị nhận hợp lệ.");
          const [layer] = await Layer.create(
            [
              {
                ...stockKey,
                receiptLineId: String(line._id),
                receiptDocumentId: id,
                receivedAt: now,
                remainingQty: line.quantityScaled,
                remainingValue: line.totalValueMinor,
              },
            ],
            { session },
          );
          await record(stockKey, String(layer._id), line.quantityScaled, line.totalValueMinor!);
          allocations.push({
            quantity: line.quantityScaled,
            value: line.totalValueMinor!,
            lotNumber: lot.lotNumber,
            expiryDay: lot.expiryDay,
          });
        } else {
          const eligible = await Lot.find({
            companyCode: actor.companyCode,
            supplyId: line.supplyId,
            recalled: false,
            ...(line.requestedLotId ? { _id: line.requestedLotId } : {}),
            ...(profile.requiresExpiry ? { expiryDay: { $gte: day, $lte: "9999-12-31" } } : {}),
          })
            .session(session)
            .lean();
          const lotMap = new Map(
            eligible
              .filter((l) => !profile.requiresExpiry || validExpiryDay(l.expiryDay))
              .map((l) => [String(l._id), l]),
          );
          const candidates = await Layer.find({
            ...base,
            quality: "available",
            remainingQty: { $gt: 0 },
            lotId: { $in: [...lotMap.keys()] },
          })
            .sort({ receivedAt: 1, _id: 1 })
            .session(session);
          candidates.sort(
            (a, b) =>
              (lotMap.get(a.lotId)?.expiryDay || "9999-12-31").localeCompare(
                lotMap.get(b.lotId)?.expiryDay || "9999-12-31",
              ) ||
              a.receivedAt.getTime() - b.receivedAt.getTime() ||
              String(a._id).localeCompare(String(b._id)),
          );
          let remaining = line.quantityScaled;
          for (const layer of candidates) {
            if (!remaining) break;
            const amount = Math.min(remaining, layer.remainingQty);
            const value = allocateValue(layer.remainingValue, amount, layer.remainingQty);
            layer.remainingQty -= amount;
            layer.remainingValue -= value;
            layer.version++;
            await layer.save({ session });
            await record({ ...base, lotId: layer.lotId, quality: "available" }, String(layer._id), -amount, -value);
            allocations.push({
              quantity: amount,
              value,
              lotNumber: lotMap.get(layer.lotId)!.lotNumber,
              expiryDay: lotMap.get(layer.lotId)!.expiryDay,
            });
            remaining -= amount;
          }
          if (remaining)
            throw new SupplyError(
              "INSUFFICIENT_STOCK",
              `Không đủ tồn khả dụng cho '${line.supplyName}'. Lô hết hạn, cách ly hoặc thu hồi không được xuất.`,
              409,
            );
        }
        // Project the V2 ledger back to the familiar Nhập/xuất list in the same transaction.
        const legacyAmount = line.quantityScaled / 10 ** line.precision;
        const legacyBefore = catalogSupply.quantity;
        const legacyAfter = legacyBefore + (doc.type === "issue" ? -legacyAmount : legacyAmount);
        if (!Number.isFinite(legacyAmount) || legacyAmount <= 0 || !Number.isFinite(legacyAfter) || legacyAfter < 0)
          throw new SupplyError("INVALID_QUANTITY", "Số lượng đồng bộ sang màn Nhập/xuất không hợp lệ.");
        if (doc.type !== "issue") {
          catalogSupply.batchNumber = line.lotNumber || catalogSupply.batchNumber;
          catalogSupply.expiryDate = line.expiryDay ? new Date(`${line.expiryDay}T00:00:00.000Z`) : null;
          catalogSupply.unitPrice = line.totalValueMinor! / legacyAmount;
        }
        catalogSupply.quantity = legacyAfter;
        catalogSupply.status = supplyStockStatus(
          legacyAfter,
          catalogSupply.minQuantity,
          catalogSupply.expiryDate,
          catalogSupply.requiresExpiry !== false,
        );
        if (!catalogSupply.inspectionDate) {
          catalogSupply.inspectionDate = new Date();
        }
        await catalogSupply.save({ session });
        let runningBalance = legacyBefore;
        await SupplyTransactionModel.create(
          allocations.map((allocation) => {
            const quantity = allocation.quantity / 10 ** line.precision;
            const before = runningBalance;
            runningBalance += doc.type === "issue" ? -quantity : quantity;
            return {
              companyCode: actor.companyCode,
              branchId: actor.branchId,
              supplyId: line.supplyId,
              supplyCode: catalogSupply.code,
              supplyName: catalogSupply.name,
              type: doc.type === "issue" ? "out" : "in",
              quantity,
              balanceBefore: before,
              balanceAfter: runningBalance,
              performerId: actor.uid,
              performerName: actor.name || actor.uid,
              recipientDepartment: doc.recipientDepartment,
              reason: doc.reason,
              batchNumber: allocation.lotNumber,
              expiryDate: allocation.expiryDay ? new Date(`${allocation.expiryDay}T00:00:00.000Z`) : null,
              batchCode: doc.number,
              supplier: catalogSupply.supplier,
              unitPrice: allocation.value / quantity,
            };
          }),
          { session, ordered: true },
        );
      }
      doc.status = "posted";
      doc.postedAt = now;
      doc.postedDay = day;
      doc.postedBy = actor.uid;
      doc.revision++;
      await doc.save({ session });
      await documentAudit(actor, doc, "post", session);
      await Outbox.create(
        [{ companyCode: actor.companyCode, branchId: actor.branchId, documentId: id, event: "supply.document.posted" }],
        { session },
      );
      return { ...doc.toObject(), movements };
    },
    session,
  );
  return inventoryView(actor, result);
}
