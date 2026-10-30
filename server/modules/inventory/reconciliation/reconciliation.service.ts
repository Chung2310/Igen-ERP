import { mongo } from "mongoose";

// Native reads only: importing this module cannot create models, collections,
// indexes, users or run application startup migrations.
export const collections = {
  balances: "inventorybalances", ledger: "inventoryledgerentries", units: "inventoryserialunits",
  events: "inventoryserialevents", warehouses: "warehouses", branches: "branches",
  variants: "productvariants", products: "productcatalogs", logs: "stocklogs",
  receipts: "goodsreceipts", transfers: "inventorytransfers", counts: "inventorycounts",
  orders: "retailorders", afterSales: "retailaftersales", repairs: "repairtickets",
} as const;
export type AuditScope = { companyCode: string; branchId?: string; warehouseId?: string };
export type BaselineRow = { branchId: string; warehouseId: string; productId: string; variantId?: string; sku: string; quantity: number; value: number };
export type Baseline = { schemaVersion: 1; companyCode: string; asOf: string; balances: BaselineRow[] };
export type Finding = AuditScope & { code: string; severity: "error" | "review"; productId?: string; variantId?: string; sku?: string; documentId?: string; message: string; details?: Record<string, unknown> };
export class AuditInputError extends Error {}
const id = (value: unknown) => String(value || "");
const oid = (value: unknown) => /^[a-f0-9]{24}$/i.test(id(value)) ? new mongo.ObjectId(id(value)) : null;
const tracked = (mode: unknown) => mode === "serial" || mode === "unit_barcode";
const key = (row: any) => JSON.stringify([row.branchId, row.warehouseId, row.productId, row.variantId || "", row.variantId ? "" : row.sku]);
const same = (a: number, b: number, tolerance = 0.000001) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
export function validateBaseline(value: any, companyCode: string): Baseline {
  if (value?.schemaVersion !== 1 || value.companyCode !== companyCode || !/^\d{4}-\d\d-\d\dT.*Z$/.test(value.asOf || "") || !Number.isFinite(Date.parse(value.asOf)) || Date.parse(value.asOf) > Date.now() || !Array.isArray(value.balances) || value.balances.length > 10000) throw new AuditInputError("Baseline cần schemaVersion=1, cùng công ty, mốc UTC hợp lệ không ở tương lai và tối đa 10.000 dòng.");
  const seen = new Set<string>();
  for (const row of value.balances) {
    if (!row || !oid(row.branchId) || !oid(row.warehouseId) || !oid(row.productId) || (row.variantId && !oid(row.variantId)) || typeof row.sku !== "string" || !row.sku.trim() || !Number.isFinite(row.quantity) || !Number.isFinite(row.value) || seen.has(key(row))) throw new AuditInputError("Baseline có dòng thiếu định danh, số không hợp lệ hoặc trùng vị trí/SKU.");
    seen.add(key(row));
  }
  return value;
}

export async function reconcileInventory(db: mongo.Db, session: mongo.ClientSession, rawScope: AuditScope, emit: (finding: Finding) => Promise<void>, options: { baseline?: Baseline; ledgerComplete?: boolean; batchSize?: number; maxDocuments?: number; signal?: AbortSignal } = {}) {
  const scope = { ...rawScope, companyCode: String(rawScope.companyCode || "").trim().toUpperCase() };
  if (!scope.companyCode || (scope.branchId && !oid(scope.branchId)) || (scope.warehouseId && !oid(scope.warehouseId))) throw new AuditInputError("Cần company và ID chi nhánh/kho hợp lệ.");
  if (!(session as any).snapshotEnabled) throw new AuditInputError("Đối soát yêu cầu session snapshot chỉ đọc.");
  if (options.baseline && options.ledgerComplete) throw new AuditInputError("Chọn baseline hoặc ledger-complete, không chọn cả hai.");
  const batchSize = options.batchSize ?? 200, maxDocuments = options.maxDocuments ?? 100000;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !Number.isInteger(maxDocuments) || maxDocuments < 1) throw new AuditInputError("batchSize phải từ 1–1000; maxDocuments phải là số nguyên dương.");
  const baseline = options.baseline ? validateBaseline(options.baseline, scope.companyCode) : undefined;
  const bases = new Map((baseline?.balances || []).map((row) => [key(row), row]));
  const scoped = { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}) };
  const read = { session, maxTimeMS: 15000 };
  const col = (name: keyof typeof collections) => db.collection<any>(collections[name]);
  const find = (name: keyof typeof collections, filter: any) => col(name).findOne(filter, read);
  const count = (name: keyof typeof collections, filter: any) => col(name).countDocuments(filter, read);
  const reference = (name: keyof typeof collections, value: unknown) => find(name, { _id: oid(value), companyCode: scope.companyCode });
  if (scope.branchId && !await reference("branches", scope.branchId)) throw new AuditInputError("Chi nhánh không thuộc công ty.");
  if (scope.warehouseId) {
    const warehouse = await reference("warehouses", scope.warehouseId);
    if (!warehouse || (scope.branchId && warehouse.branchId !== scope.branchId)) throw new AuditInputError("Kho không thuộc phạm vi chọn.");
  }
  const summary = { schemaVersion: 1, scope, baselineMode: baseline ? "reviewed-baseline" : options.ledgerComplete ? "asserted-complete-ledger" : "unverified", baselineAsOf: baseline?.asOf, examined: {} as Record<string, number>, errors: 0, reviews: 0, findings: 0, complete: false, status: "incomplete", snapshotTime: "" };
  let examined = 0;
  const finding = async (code: string, severity: Finding["severity"], row: any, message: string, details?: Record<string, unknown>) => {
    summary.findings++; if (severity === "error") summary.errors++; else summary.reviews++;
    await emit({ ...scope, branchId: row.branchId || scope.branchId, warehouseId: row.warehouseId || scope.warehouseId, productId: row.productId, variantId: row.variantId, sku: row.sku, documentId: id(row._id), code, severity, message, details });
  };
  async function* scan(name: keyof typeof collections, filter: any = scoped) {
    const cursor = col(name).find(filter, read).sort({ _id: 1 }).batchSize(batchSize);
    try {
      for await (const row of cursor) {
        options.signal?.throwIfAborted();
        if (++examined > maxDocuments) throw new AuditInputError("Vượt maxDocuments; báo cáo chưa hoàn tất. Hãy chia phạm vi hoặc tăng giới hạn.");
        summary.examined[name] = (summary.examined[name] || 0) + 1;
        yield row;
      }
    } finally { await cursor.close(); }
  }
  const identity = (row: any) => ({ companyCode: scope.companyCode, branchId: row.branchId, warehouseId: row.warehouseId, productId: row.productId, ...(row.variantId ? { variantId: row.variantId } : { variantId: { $exists: false }, sku: row.sku }) });
  async function validLocation(row: any) {
    const warehouse = await reference("warehouses", row.warehouseId);
    const branch = await reference("branches", row.branchId);
    if (!warehouse || !branch || warehouse.branchId !== row.branchId) await finding("LOCATION_INVALID", "error", row, "Kho/chi nhánh bị thiếu hoặc không khớp công ty.");
    return warehouse;
  }
  for await (const balance of scan("balances")) {
    const warehouse = await validLocation(balance);
    if (![balance.quantity, balance.reservedQuantity, balance.averageCost].every(Number.isFinite) || balance.quantity < 0 || balance.reservedQuantity < 0 || balance.reservedQuantity > balance.quantity || balance.averageCost < 0) await finding("BALANCE_INVALID", "error", balance, "Tồn, giữ chỗ hoặc giá vốn không hợp lệ.");
    const variant = balance.variantId ? await reference("variants", balance.variantId) : null;
    if (balance.variantId && (!variant || variant.productId !== balance.productId || variant.sku !== balance.sku)) await finding("SKU_INVALID", "error", balance, "Biến thể không khớp sản phẩm/SKU/công ty.");
    if (balance.variantId && !await reference("products", balance.productId)) await finding("PRODUCT_MISSING", "error", balance, "Sản phẩm catalog của balance bị thiếu trong công ty.");
    if (tracked(variant?.trackingMode)) {
      const actual = await count("units", { ...identity(balance), status: warehouse?.kind === "transit" ? "in_transit" : "in_stock" });
      if (!same(balance.quantity, actual)) await finding("SERIAL_BALANCE_MISMATCH", "error", balance, "Số máy khả dụng/đang vận chuyển không khớp tồn vị trí.", { balance: balance.quantity, units: actual });
    }
    const base = bases.get(key(balance));
    if (!base && !options.ledgerComplete) {
      await finding("BASELINE_UNVERIFIED", "review", balance, "Chưa có baseline đã xác nhận; không kết luận chênh lệch balance–ledger.");
      continue;
    }
    const [totals] = await col("ledger").aggregate([{ $match: { ...identity(balance), ...(baseline ? { createdAt: { $gt: new Date(baseline.asOf) } } : {}) } }, { $group: { _id: null, quantity: { $sum: "$quantityDelta" }, value: { $sum: { $multiply: ["$quantityDelta", "$unitCost"] } } } }], read).toArray();
    const expectedQuantity = (base?.quantity || 0) + (totals?.quantity || 0), expectedValue = (base?.value || 0) + (totals?.value || 0);
    if (!same(balance.quantity, expectedQuantity)) await finding("BALANCE_LEDGER_MISMATCH", "error", balance, "Tồn khác baseline cộng biến động sau baseline.", { actual: balance.quantity, expected: expectedQuantity });
    if (!same(balance.quantity * balance.averageCost, expectedValue, 0.01)) await finding("VALUE_LEDGER_MISMATCH", "error", balance, "Giá trị tồn khác baseline cộng giá trị biến động (dung sai 0,01).", { actual: balance.quantity * balance.averageCost, expected: expectedValue });
  }
  for (const row of bases.values()) {
    if ((scope.branchId && row.branchId !== scope.branchId) || (scope.warehouseId && row.warehouseId !== scope.warehouseId)) continue;
    if (!await find("balances", identity(row))) await finding("BASELINE_BALANCE_MISSING", "error", row, "Vị trí trong baseline không còn bản ghi tồn.");
  }
  const sources: Record<string, keyof typeof collections> = { "manual-stock-log": "logs", "stock-log-reversal": "logs", "goods-receipt": "receipts", "inventory-transfer": "transfers", "inventory-count": "counts", "retail-order": "orders", "retail_order": "orders", "retail-after-sale": "afterSales", "repair-ticket": "repairs" };
  for await (const entry of scan("ledger")) {
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0 || !["in", "out"].includes(entry.direction) || !same(entry.quantityDelta, entry.quantity * (entry.direction === "in" ? 1 : -1)) || !Number.isFinite(entry.unitCost) || entry.unitCost < 0) await finding("LEDGER_INVALID", "error", entry, "Dấu/số lượng/giá vốn ledger không hợp lệ.");
    if (!await find("balances", identity(entry))) await finding("LEDGER_BALANCE_MISSING", "error", entry, "Ledger không có bản ghi tồn tương ứng.");
    const source = sources[entry.sourceType];
    if (source) {
      const doc = await reference(source, entry.sourceId);
      if (!doc || (source === "transfers" ? ![doc.fromBranchId, doc.toBranchId].includes(entry.branchId) : doc.branchId !== entry.branchId)) await finding("LEDGER_SOURCE_MISSING", "error", entry, "Chứng từ nguồn ledger bị thiếu hoặc sai phạm vi.", { sourceType: entry.sourceType, sourceId: entry.sourceId });
    } else if (entry.purpose !== "opening") await finding("SOURCE_TYPE_UNVERIFIED", "review", entry, "Chưa có bộ kiểm tra chứng từ nguồn loại này.", { sourceType: entry.sourceType, sourceId: entry.sourceId });
  }
  for await (const unit of scan("units")) {
    if (!["in_stock", "in_transit", "internal_use", "sold", "returned", "defective", "repairing", "scrapped", "lost"].includes(unit.status)) await finding("SERIAL_STATUS_INVALID", "error", unit, "Trạng thái máy không được nhận diện.");
    const warehouse = await validLocation(unit);
    const variant = await reference("variants", unit.variantId);
    if (!variant || variant.productId !== unit.productId || !tracked(variant.trackingMode)) await finding("SERIAL_SKU_INVALID", "error", unit, "Máy không có SKU theo dõi từng đơn vị hợp lệ.");
    if (["in_stock", "in_transit"].includes(unit.status) && !await find("balances", identity(unit))) await finding("SERIAL_BALANCE_MISSING", "error", unit, "Máy tồn/vận chuyển không có balance tương ứng.");
    if (unit.status === "in_transit") {
      const transfer = unit.currentDocumentType === "inventory-transfer" ? await reference("transfers", unit.currentDocumentId) : null;
      if (!transfer || transfer.status !== "in_transit" || transfer.transitWarehouseId !== unit.warehouseId || transfer.fromBranchId !== unit.branchId || transfer.toBranchId !== unit.transferToBranchId || transfer.toWarehouseId !== unit.transferToWarehouseId || !transfer.items?.some((line: any) => line.serialUnitIds?.includes(id(unit._id)))) await finding("TRANSIT_DOCUMENT_MISMATCH", "error", unit, "Máy chuyển dở không khớp chứng từ/vị trí transit; cần đối soát lịch sử.");
    } else if (warehouse?.kind === "transit") await finding("SERIAL_TRANSIT_STATUS", "error", unit, "Máy ở kho transit nhưng không ở trạng thái vận chuyển.");
    if (unit.status === "internal_use") {
      const log = await reference("logs", unit.internalUse?.stockLogId);
      if (!log || log.branchId !== unit.branchId || log.warehouseId !== unit.warehouseId || log.purpose !== "nội bộ" || !["Hoàn thành", "Thành công"].includes(log.status) || log.reversalId || unit.currentDocumentId !== id(log._id) || unit.currentDocumentType !== "manual-stock-log" || !unit.internalUse?.recipientName || unit.internalUse.recipientName !== String(log.customerName || "").trim()) await finding("INTERNAL_USE_MISMATCH", "error", unit, "Máy sử dụng nội bộ không khớp lần cấp phát hiện hành.");
      const knownIdentifiers = [unit.normalizedSerialNumber, unit.normalizedInternalBarcode, ...(unit.normalizedBarcodeAliases || [])];
      const line = log?.items?.find((item: any) => item.productId === unit.productId && item.variantId === unit.variantId && [...(item.unitIdentifiers || []), ...(item.serialNumbers || [])].some((code: string) => knownIdentifiers.includes(String(code).trim().toUpperCase())));
      if (!line || !Number.isFinite(unit.internalUse?.unitCost) || unit.internalUse.unitCost < 0 || !same(line.unitCost, unit.internalUse.unitCost, 0.01)) await finding("INTERNAL_USE_VALUE_MISMATCH", "error", unit, "Định danh/giá vốn cấp phát không khớp dòng phiếu gốc.");
    } else if (unit.internalUse) await finding("STALE_INTERNAL_USE", "error", unit, "Thông tin cấp phát còn lưu khi máy không ở trạng thái nội bộ.");
  }
  for await (const receipt of scan("receipts", { ...scoped, status: "confirmed" })) {
    const ledgerCount = await count("ledger", { companyCode: scope.companyCode, branchId: receipt.branchId, sourceType: "goods-receipt", sourceId: id(receipt._id) });
    if (!ledgerCount || ledgerCount !== receipt.items?.length) await finding("RECEIPT_LEDGER_MISSING", "review", receipt, "Phiếu nhập xác nhận thiếu ledger gắn đúng nguồn; kiểm tra migration/backfill trước khi sửa.");
    // Registration events remain after sale/transfer; current stock is not proof
    // that a historical receipt failed to register its machines.
    for (const [index, line] of (receipt.items || []).entries()) {
      const entry = await find("ledger", { companyCode: scope.companyCode, branchId: receipt.branchId, sourceType: "goods-receipt", sourceId: id(receipt._id), sourceLine: index });
      if (entry && (entry.direction !== "in" || entry.warehouseId !== receipt.warehouseId || entry.productId !== line.productId || id(entry.variantId) !== id(line.variantId) || !same(entry.quantity, line.quantity) || !same(entry.unitCost, line.unitCost, 0.01))) await finding("RECEIPT_LEDGER_MISMATCH", "error", { ...receipt, ...line }, "Dòng phiếu nhập không khớp lượng/giá vốn/vị trí ghi sổ.");
      const variant = await reference("variants", line.variantId);
      if (!tracked(line.trackingMode || variant?.trackingMode)) continue;
      const codes: string[] = line.unitDetails?.length ? line.unitDetails.map((unit: any) => id(unit.internalBarcode).trim().toUpperCase()) : (line.serialNumbers || []).map((code: string) => code.trim().toUpperCase());
      if (codes.length !== line.quantity || new Set(codes).size !== codes.length) { await finding("RECEIPT_IDENTIFIERS_MISSING", "error", { ...receipt, ...line }, "Phiếu nhập xác nhận thiếu/trùng định danh máy."); continue; }
      for (const code of codes) {
        const unit = await find("units", { companyCode: scope.companyCode, productId: line.productId, variantId: line.variantId, $or: [{ normalizedInternalBarcode: code }, { normalizedBarcodeAliases: code }, { normalizedSerialNumber: code }, { normalizedImeis: code }] });
        const event = unit && await find("events", { companyCode: scope.companyCode, serialUnitId: id(unit._id), documentType: "goods-receipt", documentId: id(receipt._id), toStatus: "in_stock" });
        if (!unit || !event) await finding("RECEIPT_SERIAL_EVIDENCE_MISSING", "review", { ...receipt, ...line }, "Không đủ máy/sự kiện gắn phiếu nhập; cần kiểm tra lịch sử và backfill.", { identifier: code });
      }
    }
  }
  const transferScope = { companyCode: scope.companyCode, ...(scope.branchId ? { $or: [{ fromBranchId: scope.branchId }, { toBranchId: scope.branchId }] } : {}), ...(scope.warehouseId ? { $and: [{ $or: [{ fromWarehouseId: scope.warehouseId }, { toWarehouseId: scope.warehouseId }, { transitWarehouseId: scope.warehouseId }] }] } : {}) };
  for await (const transfer of scan("transfers", transferScope)) {
    if (!["in_transit", "received", "cancelled"].includes(transfer.status)) await finding("TRANSFER_STATUS_INVALID", "error", transfer, "Trạng thái điều chuyển không hợp lệ.");
    for (const line of transfer.items || []) {
      const row = { ...transfer, ...line, _id: transfer._id, branchId: transfer.fromBranchId, warehouseId: transfer.transitWarehouseId };
      const balance = await find("balances", identity(row));
      const expected = transfer.status === "in_transit" ? line.quantity : 0;
      if (!balance || !same(balance.quantity, expected) || (expected > 0 && !same(balance.averageCost, line.unitCost, 0.01))) await finding("TRANSFER_BALANCE_MISMATCH", "error", row, "Tồn/giá vốn transit không khớp trạng thái phiếu chuyển.", { expectedQuantity: expected, actualQuantity: balance?.quantity });
      const expectedEntries = transfer.status === "in_transit" ? 2 : 4;
      const entries = await col("ledger").find({ companyCode: scope.companyCode, sourceType: "inventory-transfer", sourceId: id(transfer._id), variantId: line.variantId }, read).limit(5).toArray();
      const legs = [[transfer.fromBranchId, transfer.fromWarehouseId, "out"], [transfer.fromBranchId, transfer.transitWarehouseId, "in"]];
      if (transfer.status !== "in_transit") legs.push([transfer.fromBranchId, transfer.transitWarehouseId, "out"], transfer.status === "received" ? [transfer.toBranchId, transfer.toWarehouseId, "in"] : [transfer.fromBranchId, transfer.fromWarehouseId, "in"]);
      const validLegs = legs.every(([branchId, warehouseId, direction]) => entries.filter((entry) => entry.branchId === branchId && entry.warehouseId === warehouseId && entry.direction === direction && entry.productId === line.productId && same(entry.quantity, line.quantity) && same(entry.unitCost, line.unitCost, 0.01)).length === 1);
      if (entries.length !== expectedEntries || !validLegs || !same(entries.reduce((sum, e) => sum + e.quantityDelta, 0), 0) || !same(entries.reduce((sum, e) => sum + e.quantityDelta * e.unitCost, 0), 0, 0.01)) await finding("TRANSFER_LEDGER_MISMATCH", "error", row, "Chuyến chuyển thiếu/sai chặng ledger hoặc không bảo toàn lượng/giá trị.");
      if (transfer.status === "in_transit" && tracked(line.trackingMode)) {
        const identifiers = line.serialUnitIds || [];
        const actual = await count("units", { companyCode: scope.companyCode, branchId: transfer.fromBranchId, warehouseId: transfer.transitWarehouseId, variantId: line.variantId, _id: { $in: identifiers.map(oid) }, status: "in_transit", currentDocumentType: "inventory-transfer", currentDocumentId: id(transfer._id) });
        if (identifiers.length !== line.quantity || actual !== line.quantity) await finding("TRANSFER_SERIAL_MISSING", "error", row, "Phiếu đang vận chuyển thiếu máy ở đúng trạng thái/vị trí.");
      }
    }
  }
  for await (const log of scan("logs", { ...scoped, status: { $in: ["Hoàn thành", "Thành công"] } })) {
    // Generated compatibility logs reference other workflows and are checked
    // through their source ledger, never assumed to be manual postings.
    if (log.refType && log.refType !== "stock-log-reversal") continue;
    const sourceType = log.reversalOf ? "stock-log-reversal" : "manual-stock-log";
    const entries = await count("ledger", { companyCode: scope.companyCode, branchId: log.branchId, sourceType, sourceId: id(log._id) });
    if (!entries || entries !== log.items?.length) await finding("POSTED_LOG_LEDGER_MISSING", "review", log, "Phiếu hoàn thành thiếu ledger tương ứng; có thể cần đối soát dữ liệu cũ.");
    for (const [index, line] of (log.items || []).entries()) {
      const entry = await find("ledger", { companyCode: scope.companyCode, branchId: log.branchId, sourceType, sourceId: id(log._id), sourceLine: index });
      if (entry && (entry.direction !== (log.type === "nhập" ? "in" : "out") || entry.warehouseId !== log.warehouseId || entry.productId !== line.productId || id(entry.variantId) !== id(line.variantId) || !same(entry.quantity, line.quantity) || !same(entry.unitCost, line.unitCost, 0.01))) await finding("POSTED_LOG_LEDGER_MISMATCH", "error", { ...log, ...line }, "Dòng phiếu kho không khớp ledger gốc.");
    }
    if (log.reversalId) {
      const reverse = await reference("logs", log.reversalId);
      if (!reverse || reverse.branchId !== log.branchId || reverse.reversalOf !== id(log._id)) await finding("REVERSAL_LINK_INVALID", "error", log, "Liên kết chứng từ đảo không hợp lệ.");
    }
    if (log.reversalOf) {
      const original = await reference("logs", log.reversalOf);
      if (!original || original.branchId !== log.branchId || original.reversalId !== id(log._id)) await finding("REVERSAL_LINK_INVALID", "error", log, "Phiếu đảo không được phiếu gốc tham chiếu.");
    }
  }
  if (!examined) await finding("EMPTY_SCOPE", "review", {}, "Không có bản ghi trong phạm vi; không coi là đã chứng minh dữ liệu kho đúng.");
  summary.complete = true;
  summary.status = summary.errors ? "issues" : summary.reviews ? "needs-review" : "clean";
  summary.snapshotTime = String((session as any).snapshotTime || "");
  return summary;
}
