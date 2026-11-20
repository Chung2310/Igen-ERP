import { Types } from "mongoose";
import { SupplyModel } from "../../model/supply.model";
import { SupplyTransactionModel } from "../../model/supply-transaction.model";
import { WarehouseModel } from "../../model/warehouse.model";
import {
  SupplyStockDocumentModel as Document,
  SupplyStockDocumentLineModel as Line,
  SupplyInventoryProfileModel as Profile,
  SupplyStockBalanceModel as Balance,
  SupplyLotModel as Lot,
  SupplyInventoryConfigModel as Config,
} from "../../model/supply-inventory.model";
import { supplyBusinessDay, supplyExpiryDay } from "../../../shared/supply-stock";

/**
 * Automatically migrates and backfills existing legacy supplies, transactions,
 * and stock balances into Inventory V2 documents, profiles, lots, and balances.
 * Idempotent and safe to run multiple times.
 */
export async function backfillLegacySupplyDocuments(companyCode: string, branchId?: string) {
  if (!companyCode) return;

  // 1. Ensure config is mode: "v2"
  await Config.findOneAndUpdate(
    { companyCode },
    {
      $set: {
        companyCode,
        mode: "v2",
        timeZone: "Asia/Ho_Chi_Minh",
        currency: "VND",
        activatedAt: new Date(),
      },
      $setOnInsert: { writeVersion: 0 },
    },
    { upsert: true },
  );

  // 2. Fetch supplies & warehouses
  let [supplies, warehouses] = await Promise.all([
    SupplyModel.find({ companyCode, ...(branchId ? { branchId } : {}) }).lean(),
    WarehouseModel.find({ companyCode, ...(branchId ? { branchId } : {}), isActive: true }).lean(),
  ]);

  if (!supplies.length && branchId) {
    supplies = await SupplyModel.find({ companyCode }).lean();
  }

  if (!supplies.length) return;

  if (!warehouses.length) {
    warehouses = await WarehouseModel.find({ companyCode, isActive: true }).lean();
  }

  if (!warehouses.length) {
    const created = await WarehouseModel.create({
      companyCode,
      branchId: branchId || supplies[0]?.branchId || "",
      code: "KHO-CHINH",
      name: "Kho chính",
      isActive: true,
    });
    warehouses = [created.toObject()];
  }

  const defaultWarehouseId = warehouses[0] ? String(warehouses[0]._id) : "";
  const supplyById = new Map(supplies.map((s) => [String(s._id), s]));

  // 3. Ensure profiles exist for all supplies
  for (const s of supplies) {
    const supplyId = String(s._id);
    const trackingMode = s.batchNumber || s.requiresExpiry !== false ? "lot" : "none";
    await Profile.findOneAndUpdate(
      { companyCode, supplyId },
      {
        $setOnInsert: {
          companyCode,
          supplyId,
          baseUnit: s.unit || "Cái",
          precision: 0,
          trackingMode,
          requiresExpiry: s.requiresExpiry !== false,
          conversions: [],
          version: 1,
        },
      },
      { upsert: true },
    );
  }

  // 4. Fetch legacy transactions
  let transactions = await SupplyTransactionModel.find({
    companyCode,
    ...(branchId ? { branchId } : {}),
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!transactions.length && branchId) {
    transactions = await SupplyTransactionModel.find({ companyCode })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
  }

  // Group transactions by batchCode or fallback unique key
  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const groupKey = tx.batchCode?.trim() || `tx-${tx._id}`;
    const list = groups.get(groupKey) || [];
    list.push(tx);
    groups.set(groupKey, list);
  }

  // 5. Generate documents for transaction groups if they don't already exist
  for (const [groupKey, txList] of groups) {
    const first = txList[0];
    const docNumber = groupKey.startsWith("tx-")
      ? `${first.type === "in" ? "PNK" : "PXK"}-${String(first._id).slice(-8)}`
      : groupKey;

    const exists = await Document.exists({ companyCode, number: docNumber });
    if (exists) continue;

    const documentId = new Types.ObjectId().toHexString();
    const docType = first.type === "in" ? "receipt" : "issue";
    const targetWarehouseId =
      supplyById.get(String(first.supplyId))?.warehouseId ||
      warehouses.find((w) => w.name === first.supplier || w.name === first.recipientDepartment)?._id ||
      defaultWarehouseId;

    if (!targetWarehouseId) continue;

    const when = new Date(first.createdAt || Date.now());

    await Document.create({
      _id: documentId,
      companyCode,
      branchId: first.branchId || branchId || supplies[0]?.branchId || "",
      warehouseId: String(targetWarehouseId),
      number: docNumber,
      type: docType,
      status: "posted",
      revision: 1,
      createdBy: first.performerId || "system-migration",
      submittedBy: first.performerId || "system-migration",
      approvedBy: first.performerId || "system-migration",
      approvedRevision: 1,
      postedBy: first.performerId || "system-migration",
      postedAt: when,
      postedDay: supplyBusinessDay(when),
      reason: first.reason || (first.type === "in" ? "Nhập kho (chuyển đổi)" : "Xuất kho (chuyển đổi)"),
      recipientDepartment: first.recipientDepartment || undefined,
      createdAt: when,
      updatedAt: when,
    });

    // Create lines
    for (const [idx, tx] of txList.entries()) {
      const supply = supplyById.get(String(tx.supplyId));
      const lineId = new Types.ObjectId().toHexString();
      const unit = supply?.unit || "Cái";
      const unitPrice = tx.unitPrice ?? supply?.unitPrice ?? 0;
      const totalValueMinor = tx.quantity * unitPrice;
      const expiryDay = supplyExpiryDay(tx.expiryDate || supply?.expiryDate) || "";
      const lotNumber = tx.batchNumber || supply?.batchNumber || "NO-LOT";

      await Line.create({
        _id: lineId,
        companyCode,
        documentId,
        lineNo: idx + 1,
        supplyId: String(tx.supplyId),
        supplyCode: tx.supplyCode || supply?.code || "VT",
        supplyName: tx.supplyName || supply?.name || "Vật tư",
        baseUnit: unit,
        precision: 0,
        enteredUnit: unit,
        enteredQuantity: String(tx.quantity),
        conversionFactor: "1",
        profileVersion: 1,
        quantityScaled: tx.quantity,
        lotNumber,
        manufacturerKey: "",
        expiryDay,
        requestedLotId: "",
        totalValueMinor,
        createdAt: when,
        updatedAt: when,
      });
    }
  }

  // 6. Check for supplies with quantity > 0 but no transaction documents covering them (Opening Stock)
  for (const s of supplies) {
    if (s.quantity > 0) {
      const openingNumber = `OPEN-${s.code}`;
      const docExists = await Document.exists({ companyCode, number: openingNumber });
      const hasAnyDoc = await Line.exists({ companyCode, supplyId: String(s._id) });
      if (!docExists && !hasAnyDoc) {
        const documentId = new Types.ObjectId().toHexString();
        const lineId = new Types.ObjectId().toHexString();
        const targetWarehouseId = String(s.warehouseId || defaultWarehouseId);
        if (!targetWarehouseId) continue;
        const when = new Date(s.createdAt || Date.now());
        const unit = s.unit || "Cái";
        const unitPrice = s.unitPrice || 0;
        const totalValueMinor = s.quantity * unitPrice;
        const expiryDay = supplyExpiryDay(s.expiryDate) || "";
        const lotNumber = s.batchNumber || "NO-LOT";

        await Document.create({
          _id: documentId,
          companyCode,
          branchId: s.branchId || branchId || "",
          warehouseId: targetWarehouseId,
          number: openingNumber,
          type: "opening",
          status: "posted",
          revision: 1,
          createdBy: "system-migration",
          submittedBy: "system-migration",
          approvedBy: "system-migration",
          approvedRevision: 1,
          postedBy: "system-migration",
          postedAt: when,
          postedDay: supplyBusinessDay(when),
          reason: "Tồn đầu kỳ vật tư (chuyển đổi)",
          createdAt: when,
          updatedAt: when,
        });

        await Line.create({
          _id: lineId,
          companyCode,
          documentId,
          lineNo: 1,
          supplyId: String(s._id),
          supplyCode: s.code,
          supplyName: s.name,
          baseUnit: unit,
          precision: 0,
          enteredUnit: unit,
          enteredQuantity: String(s.quantity),
          conversionFactor: "1",
          profileVersion: 1,
          quantityScaled: s.quantity,
          lotNumber,
          manufacturerKey: "",
          expiryDay,
          requestedLotId: "",
          totalValueMinor,
          createdAt: when,
          updatedAt: when,
        });
      }
    }
  }

  // 7. Ensure balances exist in SupplyStockBalanceModel for all supplies with stock
  for (const s of supplies) {
    if (s.quantity > 0) {
      const targetWarehouseId = String(s.warehouseId || defaultWarehouseId);
      if (!targetWarehouseId) continue;
      const lotNumber = s.batchNumber || "NO-LOT";
      const expiryDay = supplyExpiryDay(s.expiryDate) || "";

      // Ensure lot exists
      let lot = await Lot.findOne({
        companyCode,
        supplyId: String(s._id),
        lotNumber,
      }).lean();

      if (!lot) {
        lot = (
          await Lot.create({
            companyCode,
            supplyId: String(s._id),
            manufacturerKey: "",
            lotNumber,
            expiryDay,
            recalled: false,
            version: 1,
          })
        ).toObject();
      }

      const quality =
        s.requiresExpiry !== false && (!expiryDay || expiryDay < supplyBusinessDay()) ? "quarantine" : "available";
      const totalValueMinor = s.quantity * (s.unitPrice || 0);

      await Balance.findOneAndUpdate(
        {
          companyCode,
          branchId: s.branchId || branchId || "",
          warehouseId: targetWarehouseId,
          locationId: "",
          supplyId: String(s._id),
          lotId: String(lot._id),
          containerId: "",
          quality,
        },
        {
          $set: {
            quantityScaled: s.quantity,
            valueMinor: totalValueMinor,
            version: 1,
          },
        },
        { upsert: true },
      );
    }
  }
}
