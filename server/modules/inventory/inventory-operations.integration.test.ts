import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchModel } from '../../model/branch.model';
import { WarehouseModel } from '../../model/warehouse.model';
import { ProductCatalogModel } from '../../model/product-catalog.model';
import { ProductVariantModel } from '../../model/product-variant.model';
import { InventoryBalanceModel } from '../../model/inventory-balance.model';
import { InventoryLedgerEntryModel } from '../../model/inventory-ledger-entry.model';
import { StockLogModel } from '../../model/stock-log.model';
import { SerialUnitModel } from './serials/serial-unit.model';
import { SerialEventModel } from './serials/serial-event.model';
import { InventoryTransferModel } from './transfers/transfer.model';
import { InventoryStockReversalModel } from './transfers/stock-reversal.model';
import { requestInventoryTransfer, receiveInventoryTransfer, cancelInventoryTransfer, reverseInventoryTransfer } from './transfers/transfer.service';
import { collections, reconcileInventory, type Finding } from './reconciliation/reconciliation.service';
import { reverseManualOutbound } from './stock-log-reversal.service';
import { inInventoryTransaction } from './inventory-transaction';
import { writeStockMovement } from '../../integrations/shared/stock-movement.service';
import { nextReceiptCode, receiptBusinessDay } from './receiving/receipt-number.service';
import { ReceiptCounterModel } from './receiving/receipt-counter.model';
import { createReceipt, submitReceipt, startReceiving, confirmReceipt } from './receiving/receiving.service';
import { GoodsReceiptModel } from '../../model/goods-receipt.model';
import { SupplierModel } from '../../model/supplier.model';
import { FinanceDebtModel } from '../finance/models/financial-reporting.model';
import { ProductModel } from '../../model/product.model';

const oid = () => new mongoose.Types.ObjectId().toString();
const companyCode = 'GENERAL_INVENTORY', fromBranchId = oid(), toBranchId = oid(), fromWarehouseId = oid(), toWarehouseId = oid(), productId = oid(), fabricId = oid(), toolId = oid();
const actor = { id: 'operator', name: 'Người vận hành' };
const source = { companyCode, branchId: fromBranchId }, destination = { companyCode, branchId: toBranchId };
const models = [BranchModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, InventoryBalanceModel, InventoryLedgerEntryModel, StockLogModel, SerialUnitModel, SerialEventModel, InventoryTransferModel, InventoryStockReversalModel, ReceiptCounterModel, GoodsReceiptModel, SupplierModel, FinanceDebtModel, ProductModel];
let replica: MongoMemoryReplSet;
const commands: string[] = [];
const quantity = async (warehouseId: string, variantId = fabricId) => Number((await InventoryBalanceModel.findOne({ companyCode, warehouseId, variantId }).lean())?.quantity || 0);
const request = (key = 'transfer-fabric') => ({ idempotencyKey: key, fromWarehouseId, toWarehouseId, toBranchId, reason: 'Cấp hàng cho chi nhánh', items: [{ variantId: fabricId, quantity: 2.5 }] });

async function audit(options: { ledgerComplete?: boolean; maxDocuments?: number } = {}) {
  const session = mongoose.connection.getClient().startSession({ snapshot: true });
  const findings: Finding[] = [];
  try { const summary = await reconcileInventory(mongoose.connection.db!, session, source, async (finding) => { findings.push(finding); }, options); return { summary, findings }; }
  finally { await session.endSession(); }
}

describe('kho đa ngành và đối soát chỉ đọc', () => {
  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replica.getUri(), { monitorCommands: true });
    await Promise.all(models.map((model) => model.init()));
    const existing = new Set((await mongoose.connection.db!.listCollections().toArray()).map((entry) => entry.name));
    for (const name of Object.values(collections)) if (!existing.has(name)) await mongoose.connection.db!.createCollection(name);
    mongoose.connection.getClient().on('commandStarted', (event) => commands.push(event.commandName));
  }, 60_000);
  beforeEach(async () => {
    for (const name of new Set([...Object.values(collections), ...models.map((model) => model.collection.name)])) await mongoose.connection.db!.collection(name).deleteMany({});
    await BranchModel.create([{ _id: fromBranchId, companyCode, code: 'A', name: 'Chi nhánh A', isActive: true }, { _id: toBranchId, companyCode, code: 'B', name: 'Chi nhánh B', isActive: true }]);
    await WarehouseModel.create([{ _id: fromWarehouseId, ...source, code: 'KHO-A', name: 'Kho vật tư', isActive: true, isDefault: true }, { _id: toWarehouseId, ...destination, code: 'KHO-B', name: 'Kho nhận', isActive: true, isDefault: true }]);
    await ProductCatalogModel.create({ _id: productId, companyCode, productCode: 'MATERIAL', name: 'Hàng hóa đa ngành', normalizedName: 'hang hoa da nganh', productType: 'physical', categoryCode: 'GENERAL', baseUnitCode: 'M', status: 'active', createdBy: actor.id, updatedBy: actor.id });
    await ProductVariantModel.create([{ _id: fabricId, companyCode, productId, sku: 'FABRIC', unitCode: 'M', trackingMode: 'quantity', status: 'active', createdBy: actor.id, updatedBy: actor.id }, { _id: toolId, companyCode, productId, sku: 'TOOL', unitCode: 'PCS', trackingMode: 'serial', status: 'active', createdBy: actor.id, updatedBy: actor.id }]);
    await writeStockMovement({ ...source, warehouseId: fromWarehouseId, direction: 'in', purpose: 'opening', sourceType: 'opening', sourceId: 'initial', idempotencyKey: 'initial', operatorName: actor.name, writeLegacyStockLog: false, items: [{ productId, variantId: fabricId, sku: 'FABRIC', productName: 'Vải', quantity: 10.5, unitCost: 100 }, { productId, variantId: toolId, sku: 'TOOL', productName: 'Thiết bị', quantity: 2, unitCost: 250 }] });
    await SerialUnitModel.create([1, 2].map((index) => ({ ...source, warehouseId: fromWarehouseId, productId, variantId: toolId, sku: 'TOOL', productName: 'Thiết bị', serialNumber: `SERIAL-${index}`, normalizedSerialNumber: `SERIAL-${index}`, internalBarcode: `BARCODE-${index}`, normalizedInternalBarcode: `BARCODE-${index}`, status: 'in_stock' as const, createdBy: actor.id, updatedBy: actor.id })));
    commands.length = 0;
  });
  afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });

  it('chuyển số lượng lẻ, giữ tồn/giá trị ở vị trí vận chuyển, nhận lặp không ghi thêm', async () => {
    const transfer = await requestInventoryTransfer(source, request(), actor);
    expect(await quantity(fromWarehouseId)).toBe(8);
    expect(await quantity(transfer.transitWarehouseId!)).toBe(2.5);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
    await expect(receiveInventoryTransfer({ companyCode: 'OTHER', branchId: toBranchId }, String(transfer._id), actor)).rejects.toThrow();
    await receiveInventoryTransfer(destination, String(transfer._id), actor);
    const before = await InventoryLedgerEntryModel.countDocuments({ companyCode });
    await receiveInventoryTransfer(destination, String(transfer._id), actor);
    expect(await InventoryLedgerEntryModel.countDocuments({ companyCode })).toBe(before);
    expect(await quantity(toWarehouseId)).toBe(2.5);
    expect(await quantity(transfer.transitWarehouseId!)).toBe(0);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });

  it('gửi đồng thời cùng khóa chỉ tạo một phiếu và cùng khóa khác nội dung bị từ chối', async () => {
    const [one, two] = await Promise.all([requestInventoryTransfer(source, request(), actor), requestInventoryTransfer(source, request(), actor)]);
    expect(String(one._id)).toBe(String(two._id)); expect(await quantity(fromWarehouseId)).toBe(8);
    await expect(requestInventoryTransfer(source, { ...request(), reason: 'Khác' }, actor)).rejects.toThrow();
  });

  it('chuyển hết số lượng thập phân sau nhiều lần trừ không bị báo thiếu tồn do sai số', async () => {
    await InventoryBalanceModel.updateOne({ companyCode, warehouseId: fromWarehouseId, variantId: fabricId }, { $set: { quantity: 0.3 } });
    await InventoryLedgerEntryModel.updateOne({ companyCode, variantId: fabricId, sourceType: 'opening' }, { $set: { quantity: 0.3, quantityDelta: 0.3 } });
    const first = await requestInventoryTransfer(source, { ...request('decimal-first'), items: [{ variantId: fabricId, quantity: 0.1 }] }, actor);
    const second = await requestInventoryTransfer(source, { ...request('decimal-second'), items: [{ variantId: fabricId, quantity: 0.2 }] }, actor);
    expect(await quantity(fromWarehouseId)).toBe(0);
    await receiveInventoryTransfer(destination, String(first._id), actor); await receiveInventoryTransfer(destination, String(second._id), actor);
    expect(await quantity(toWarehouseId)).toBeCloseTo(0.3, 12);
    await expect(requestInventoryTransfer(source, { ...request('decimal-overdraw'), items: [{ variantId: fabricId, quantity: 0.000001 }] }, actor)).rejects.toThrow(/không đủ tồn/);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });

  it('không lấy vào tồn giữ chỗ khi số lượng thập phân có sai số', async () => {
    await InventoryBalanceModel.updateOne({ companyCode, warehouseId: fromWarehouseId, variantId: fabricId }, { $set: { quantity: 0.3, reservedQuantity: 0.1 } });
    await requestInventoryTransfer(source, { ...request('decimal-reserved'), items: [{ variantId: fabricId, quantity: 0.2 }] }, actor);
    expect(await quantity(fromWarehouseId)).toBe(0.1);
    await expect(requestInventoryTransfer(source, { ...request('reserved-overdraw'), items: [{ variantId: fabricId, quantity: 0.000001 }] }, actor)).rejects.toThrow(/không đủ tồn/);
  });

  it('xuất hết hàng số lẻ của danh mục cũ không để tồn âm cực nhỏ', async () => {
    const product = await ProductModel.create({ ...source, sku: 'LEGACY-FABRIC', name: 'Vải cũ', unit: 'm', category: 'Vật tư', price: 100, costPrice: 50, stock: 0.3 });
    const legacyId = String(product._id);
    for (const [index, amount] of [0.1, 0.2].entries()) await writeStockMovement({ ...source, warehouseId: fromWarehouseId, direction: 'out', purpose: 'other', sourceType: 'test-fractional', sourceId: `legacy-${index}`, idempotencyKey: `legacy-${index}`, operatorName: actor.name, writeLegacyStockLog: false, items: [{ productId: legacyId, legacyProductId: legacyId, sku: product.sku, productName: product.name, quantity: amount }] });
    expect((await ProductModel.findById(legacyId).lean())?.stock).toBe(0);
    expect((await InventoryBalanceModel.findOne({ companyCode, productId: legacyId }).lean())?.quantity).toBe(0);
  });

  it('thiết bị nhận barcode nội bộ nhưng vẫn bắt buộc số lượng nguyên', async () => {
    await expect(requestInventoryTransfer(source, { ...request(), items: [{ variantId: toolId, quantity: 1.5, serialNumbers: ['BARCODE-1'] }] }, actor)).rejects.toThrow();
    const transfer = await requestInventoryTransfer(source, { ...request(), items: [{ variantId: toolId, quantity: 1, serialNumbers: ['BARCODE-1'] }] }, actor);
    expect(await SerialUnitModel.countDocuments({ companyCode, warehouseId: transfer.transitWarehouseId, status: 'in_transit' })).toBe(1);
    await cancelInventoryTransfer(source, String(transfer._id), 'Hủy cấp phát', actor);
    expect(await quantity(fromWarehouseId, toolId)).toBe(2);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });

  it('nhận/hủy cạnh tranh chỉ ghi một kết quả và bảo toàn tổng tồn', async () => {
    const transfer = await requestInventoryTransfer(source, request(), actor);
    await Promise.allSettled([receiveInventoryTransfer(destination, String(transfer._id), actor), cancelInventoryTransfer(source, String(transfer._id), 'Hủy', actor)]);
    expect(await quantity(fromWarehouseId) + await quantity(toWarehouseId) + await quantity(transfer.transitWarehouseId!)).toBe(10.5);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });

  it('đảo phiếu đã nhận giữ nguyên giá trị và phát hiện giá vốn đã thay đổi', async () => {
    const transfer = await requestInventoryTransfer(source, request(), actor); await receiveInventoryTransfer(destination, String(transfer._id), actor);
    await InventoryBalanceModel.updateOne({ companyCode, warehouseId: toWarehouseId, variantId: fabricId }, { $set: { averageCost: 110 } });
    await expect(reverseInventoryTransfer(destination, String(transfer._id), 'Sai kho', actor)).rejects.toThrow(/Giá vốn/);
    await InventoryBalanceModel.updateOne({ companyCode, warehouseId: toWarehouseId, variantId: fabricId }, { $set: { averageCost: 100 } });
    await reverseInventoryTransfer(destination, String(transfer._id), 'Sai kho', actor);
    expect(await quantity(fromWarehouseId)).toBe(10.5); expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });

  it('đối soát không ghi DB và không coi ledger đầy đủ khi chưa xác nhận', async () => {
    commands.length = 0;
    const report = await audit();
    expect(report.summary.status).toBe('needs-review'); expect(report.findings.some((finding) => finding.code === 'BASELINE_UNVERIFIED')).toBe(true);
    expect(commands.some((command) => /^(insert|update|delete|findAndModify|create|createIndexes)$/.test(command))).toBe(false);
    expect((await audit({ ledgerComplete: true })).summary.status).toBe('clean');
  });

  it('phát hiện chênh lệch giá trị và từ chối báo cáo bị cắt dở', async () => {
    await InventoryBalanceModel.updateOne({ companyCode, variantId: fabricId }, { $set: { averageCost: 101 } });
    expect((await audit({ ledgerComplete: true })).findings.some((finding) => finding.code === 'VALUE_LEDGER_MISMATCH')).toBe(true);
    await expect(audit({ maxDocuments: 1 })).rejects.toThrow(/chưa hoàn tất/);
  });

  it('cấp mã phiếu nhập đồng thời không trùng và không dùng lại sau xóa chứng từ', async () => {
    const codes = await Promise.all(Array.from({ length: 8 }, () => nextReceiptCode(source, receiptBusinessDay())));
    expect(new Set(codes).size).toBe(8); expect(await nextReceiptCode(source, receiptBusinessDay())).not.toEqual(codes[0]);
  });

  async function receivingDocument() {
    const supplier = await SupplierModel.create({ companyCode, code: 'VATTU', name: 'Nhà cung cấp vật tư', status: 'active', createdBy: actor.id, updatedBy: actor.id });
    const receipt = await createReceipt(source, { supplierId: String(supplier._id), warehouseId: fromWarehouseId, financeTerms: { dueOn: '2026-11-30', paidAmount: 0 }, items: [{ productId, variantId: fabricId, quantity: 1.25, unitCost: 100 }, { productId, variantId: toolId, quantity: 1, unitCost: 250, serialNumbers: ['SERIAL-3'], unitDetails: [{ internalBarcode: 'BARCODE-3', serialNumber: 'SERIAL-3' }] }] }, actor);
    await submitReceipt(source, String(receipt._id), actor); await startReceiving(source, String(receipt._id), actor);
    return receipt;
  }

  it('nhập hàng số lẻ và hàng theo đơn vị cùng phiếu; xác nhận lặp không tăng tồn/công nợ', async () => {
    const receipt = await receivingDocument();
    await confirmReceipt(source, String(receipt._id), actor); await confirmReceipt(source, String(receipt._id), actor);
    expect(await quantity(fromWarehouseId)).toBe(11.75); expect(await quantity(fromWarehouseId, toolId)).toBe(3);
    expect(await SerialUnitModel.countDocuments({ companyCode, serialNumber: 'SERIAL-3', status: 'in_stock' })).toBe(1);
    expect(await FinanceDebtModel.countDocuments({ companyCode, sourceReceiptId: String(receipt._id) })).toBe(1);
    expect((await FinanceDebtModel.findOne({ companyCode, sourceReceiptId: String(receipt._id) }).lean())?.balance).toBe(375);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });

  it('lỗi tạo đơn vị hàng khi nhập hoàn tác tồn, công nợ và trạng thái phiếu', async () => {
    const receipt = await receivingDocument();
    const failure = vi.spyOn(SerialEventModel.prototype, 'save').mockRejectedValueOnce(new Error('Lỗi sự kiện nhập kho thử nghiệm'));
    try { await expect(confirmReceipt(source, String(receipt._id), actor)).rejects.toThrow(); } finally { failure.mockRestore(); }
    expect(await quantity(fromWarehouseId)).toBe(10.5); expect(await quantity(fromWarehouseId, toolId)).toBe(2);
    expect(await FinanceDebtModel.countDocuments({ companyCode, sourceReceiptId: String(receipt._id) })).toBe(0);
    expect((await GoodsReceiptModel.findById(receipt._id).lean())?.status).toBe('receiving');
    expect(await SerialUnitModel.countDocuments({ companyCode, serialNumber: 'SERIAL-3' })).toBe(0);
  });

  it('rollback toàn bộ phiếu, hai chặng tồn và trạng thái đơn vị khi ghi sự kiện lỗi', async () => {
    const failure = vi.spyOn(SerialEventModel, 'create').mockRejectedValueOnce(new Error('Lỗi lưu sự kiện thử nghiệm'));
    try { await expect(requestInventoryTransfer(source, { ...request(), items: [{ variantId: fabricId, quantity: 2.5 }, { variantId: toolId, quantity: 1, serialNumbers: ['BARCODE-1'] }] }, actor)).rejects.toThrow(/Lỗi lưu/); }
    finally { failure.mockRestore(); }
    expect(await quantity(fromWarehouseId)).toBe(10.5); expect(await quantity(fromWarehouseId, toolId)).toBe(2);
    expect(await WarehouseModel.countDocuments({ companyCode, kind: 'transit' })).toBe(0);
    expect(await InventoryTransferModel.countDocuments({ companyCode })).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments({ companyCode })).toBe(2);
    expect(await SerialUnitModel.countDocuments({ companyCode, status: 'in_stock' })).toBe(2);
  });

  it('không nhận/hủy nếu giá vốn vận chuyển sai và không làm mất chứng từ đang chờ', async () => {
    const transfer = await requestInventoryTransfer(source, request(), actor);
    await InventoryBalanceModel.updateOne({ companyCode, warehouseId: transfer.transitWarehouseId, variantId: fabricId }, { $set: { averageCost: 101 } });
    await expect(receiveInventoryTransfer(destination, String(transfer._id), actor)).rejects.toThrow(/đối soát/);
    await expect(cancelInventoryTransfer(source, String(transfer._id), 'Hủy', actor)).rejects.toThrow(/đối soát/);
    expect(await quantity(fromWarehouseId)).toBe(8); expect(await quantity(toWarehouseId)).toBe(0);
    expect((await InventoryTransferModel.findById(transfer._id).lean())?.status).toBe('in_transit');
  });

  it('nhận tiếp phiếu cũ không có kho trung chuyển và đánh dấu cần kiểm tra lịch sử', async () => {
    const legacy = await InventoryTransferModel.create({ companyCode, fromBranchId, fromWarehouseId, toBranchId, toWarehouseId, code: 'LEGACY', idempotencyKey: 'legacy-key', requestFingerprint: 'legacy', status: 'in_transit', reason: 'Phiếu trước nâng cấp', createdBy: actor.id, version: 0, items: [{ productId, variantId: fabricId, sku: 'FABRIC', productName: 'Vải', quantity: 3, unitCost: 100, serialUnitIds: [] }] });
    await writeStockMovement({ ...source, warehouseId: fromWarehouseId, direction: 'out', purpose: 'transfer', sourceType: 'inventory-transfer', sourceId: String(legacy._id), idempotencyKey: 'legacy-out', operatorName: actor.name, items: legacy.items, writeLegacyStockLog: false });
    await receiveInventoryTransfer(destination, String(legacy._id), actor);
    expect(await quantity(fromWarehouseId)).toBe(7.5); expect(await quantity(toWarehouseId)).toBe(3);
    expect((await audit({ ledgerComplete: true })).findings.some((finding) => finding.code === 'LEGACY_TRANSFER_UNVERIFIED')).toBe(true);
  });

  it('đối soát giới hạn trong doanh nghiệp và từ chối baseline của công ty khác', async () => {
    await mongoose.connection.db!.collection(collections.balances).insertOne({ companyCode: 'FOREIGN', branchId: fromBranchId, warehouseId: fromWarehouseId, sku: 'SECRET', quantity: -10 });
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
    const session = mongoose.connection.getClient().startSession({ snapshot: true });
    try { await expect(reconcileInventory(mongoose.connection.db!, session, source, async () => {}, { baseline: { schemaVersion: 1, companyCode: 'FOREIGN', asOf: '2020-01-01T00:00:00.000Z', balances: [] } })).rejects.toThrow(/cùng công ty/); }
    finally { await session.endSession(); }
  });

  it('đảo xuất nội bộ số lượng lẻ theo giá vốn gốc, replay không cộng tồn hai lần', async () => {
    const log = await inInventoryTransaction(async (session) => {
      const [record] = await StockLogModel.create([{ ...source, warehouseId: fromWarehouseId, type: 'xuất', purpose: 'nội bộ', title: 'Cấp vật tư', operatorName: actor.name, status: 'Hoàn thành', customerName: 'Vận hành', sku: 'FABRIC', productName: 'Vải', quantity: 1.5, items: [{ productId, variantId: fabricId, sku: 'FABRIC', productName: 'Vải', quantity: 1.5, unitCost: 100 }] }], { session });
      await writeStockMovement({ ...source, warehouseId: fromWarehouseId, direction: 'out', purpose: 'other', sourceType: 'manual-stock-log', sourceId: String(record._id), idempotencyKey: 'manual-out', operatorName: actor.name, items: record.items, writeLegacyStockLog: false, session }); return record;
    });
    expect(await quantity(fromWarehouseId)).toBe(9);
    const first = await reverseManualOutbound(source, String(log._id), { reason: 'Thu hồi vật tư' }, actor);
    const replay = await reverseManualOutbound(source, String(log._id), { reason: 'Thu hồi vật tư' }, actor);
    expect(String(first._id)).toBe(String(replay._id)); expect(await quantity(fromWarehouseId)).toBe(10.5);
    expect((await audit({ ledgerComplete: true })).findings).toEqual([]);
  });
});
