import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchModel } from '../../model/branch.model';
import { WarehouseModel } from '../../model/warehouse.model';
import { ProductCatalogModel } from '../../model/product-catalog.model';
import { ProductVariantModel } from '../../model/product-variant.model';
import { InventoryBalanceModel } from '../../model/inventory-balance.model';
import { InventoryLedgerEntryModel } from '../../model/inventory-ledger-entry.model';
import { CustomerModel } from '../customer-management/models/customer.model';
import { SerialUnitModel } from '../inventory/serials/serial-unit.model';
import { SerialEventModel } from '../inventory/serials/serial-event.model';
import { RepairTicketModel } from './repair-ticket.model';
import { RepairPartModel } from './repair-part.model';
import { createRepairTicket, cancelRepairTicket, deliverRepairTicket, transitionRepairTicket, quoteRepairTicket } from './repair-ticket.service';
import { issueRepairPart, returnRepairPart } from './repair-part.service';
import { writeStockMovement } from '../../integrations/shared/stock-movement.service';
import { getCustomerRepairHistory } from '../customer-management/customer-repairs.router';

vi.mock('./services/repair-notify.service', () => ({ dispatchRepairNotification: async () => undefined }));
vi.mock('./services/repair-events', () => ({ publishRepairTicketEvent: async () => undefined }));
const oid = () => new mongoose.Types.ObjectId().toString();
const companyCode = 'GENERAL_REPAIR', branchId = oid(), warehouseId = oid(), customerId = oid(), productId = oid(), variantId = oid();
const scope = { companyCode, branchId }, actor = { id: 'staff-a', name: 'Người tiếp nhận' };
const models = [BranchModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, InventoryBalanceModel, InventoryLedgerEntryModel, CustomerModel, SerialUnitModel, SerialEventModel, RepairTicketModel, RepairPartModel];
let replica: MongoMemoryReplSet;
const request = (idempotencyKey = 'intake-general-001') => ({ idempotencyKey, ticketType: 'service', subjectType: 'equipment', intakeSource: 'external', customerId, device: { name: 'Máy bơm của khách', condition: 'Vỏ xước', accessories: [] }, symptom: 'Kiểm tra tiếng ồn' });
const balance = async () => (await InventoryBalanceModel.findOne({ ...scope, warehouseId, variantId }).lean())!.quantity;
async function ready(key = 'intake-general-001') { const ticket = await createRepairTicket(scope, request(key), actor); await RepairTicketModel.updateOne({ _id: ticket._id }, { $set: { status: 'approved' } }); return ticket; }

describe('sửa chữa dùng chung và hàng khách gửi', () => {
  beforeAll(async () => { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri()); await Promise.all(models.map((model) => model.init())); }, 60000);
  beforeEach(async () => {
    for (const model of models) await model.collection.deleteMany({});
    await BranchModel.create({ _id: branchId, companyCode, code: 'MAIN', name: 'Chi nhánh', isActive: true });
    await WarehouseModel.create({ _id: warehouseId, ...scope, code: 'KHO', name: 'Kho vật tư', isDefault: true, isActive: true });
    await CustomerModel.create({ _id: customerId, companyCode, customerCode: 'KH-GENERAL-001', name: 'Công ty khách hàng', phone: '0901000001', normalizedPhone: '0901000001', customerKind: 'business', contactName: 'Người liên hệ', createdBy: actor.id, createdByName: actor.name });
    await ProductCatalogModel.create({ _id: productId, companyCode, productCode: 'CABLE', name: 'Dây dẫn', normalizedName: 'day dan', productType: 'physical', categoryCode: 'GENERAL', baseUnitCode: 'M', status: 'active', createdBy: actor.id, updatedBy: actor.id });
    await ProductVariantModel.create({ _id: variantId, companyCode, productId, sku: 'CABLE', unitCode: 'M', trackingMode: 'quantity', status: 'active', createdBy: actor.id, updatedBy: actor.id });
    await writeStockMovement({ ...scope, warehouseId, direction: 'in', purpose: 'opening', sourceType: 'opening', sourceId: 'initial', idempotencyKey: 'initial', operatorName: actor.name, writeLegacyStockLog: false, items: [{ productId, variantId, sku: 'CABLE', productName: 'Dây dẫn', quantity: 10, unitCost: 100 }] });
  });
  afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });

  it('nhận hàng ngoài không serial, lấy đúng hồ sơ khách và bỏ số tiền/quyền lợi giả từ client', async () => {
    const ticket = await createRepairTicket(scope, { ...request(), customerName: 'Tên giả', coverage: { customer: { covered: true }, costBearer: 'shop' }, totalAmount: 999, paidAmount: 999 }, actor);
    expect(ticket.customerName).toBe('Công ty khách hàng'); expect(ticket.customerId).toBe(customerId);
    expect(ticket.totalAmount).toBe(0); expect(ticket.paidAmount).toBe(0); expect(ticket.coverage.costBearer).toBe('customer');
    expect(await balance()).toBe(10); expect(await SerialUnitModel.countDocuments()).toBe(0);
  });

  it('chống tiếp nhận trùng và chặn cùng khóa khác nội dung', async () => {
    const [a, b] = await Promise.all([createRepairTicket(scope, request(), actor), createRepairTicket(scope, request(), actor)]);
    expect(String(a._id)).toBe(String(b._id)); expect(await RepairTicketModel.countDocuments()).toBe(1);
    await expect(createRepairTicket(scope, { ...request(), symptom: 'Nội dung khác' }, actor)).rejects.toThrow(/Khóa tiếp nhận/);
  });

  it('lịch sử khách hàng giới hạn đúng doanh nghiệp/chi nhánh và nhận cả mã khách cũ', async () => {
    const ticket = await createRepairTicket(scope, request(), actor);
    await RepairTicketModel.create({ ...ticket, _id: new mongoose.Types.ObjectId(), ticketCode: 'LEGACY-REPAIR', customerId: 'KH-GENERAL-001', intakeRequestKey: undefined, intakeRequestFingerprint: undefined });
    await RepairTicketModel.create({ ...ticket, _id: new mongoose.Types.ObjectId(), ticketCode: 'OTHER-BRANCH', branchId: oid(), intakeRequestKey: undefined, intakeRequestFingerprint: undefined });
    const history = await getCustomerRepairHistory(scope, customerId);
    expect(history.total).toBe(2); expect(history.items.map((row) => row.ticketCode)).not.toContain('OTHER-BRANCH');
    await expect(getCustomerRepairHistory({ companyCode: 'OTHER', branchId }, customerId)).rejects.toThrow();
  });

  it('không nhận khách của doanh nghiệp khác và không tự liên kết serial trùng của hàng ngoài', async () => {
    await expect(createRepairTicket({ companyCode: 'OTHER', branchId }, request(), actor)).rejects.toThrow();
    const unit = await SerialUnitModel.create({ ...scope, warehouseId, productId, variantId, sku: 'CABLE', productName: 'Hàng trong kho', serialNumber: 'SAME-CODE', normalizedSerialNumber: 'SAME-CODE', internalBarcode: 'BC-1', normalizedInternalBarcode: 'BC-1', status: 'in_stock', createdBy: actor.id, updatedBy: actor.id });
    const ticket = await createRepairTicket(scope, { ...request(), device: { ...request().device, serialNumber: 'SAME-CODE' } }, actor);
    await cancelRepairTicket(scope, String(ticket._id), 'Khách nhận lại', actor);
    expect((await SerialUnitModel.findById(unit._id).lean())?.status).toBe('in_stock'); expect(await SerialEventModel.countDocuments()).toBe(0);
  });

  it('bảo hành ngoài phải có chứng từ còn hạn và lưu đúng người xác minh', async () => {
    await expect(createRepairTicket(scope, { ...request(), ticketType: 'warranty' }, actor)).rejects.toThrow(/chứng từ/);
    const ticket = await createRepairTicket(scope, { ...request(), ticketType: 'warranty', subjectType: 'service', warrantyEvidence: { reference: 'Hợp đồng bảo trì HD-01', endAt: '2099-12-31T16:59:59Z', confirmed: true, verifiedBy: 'forged' } }, actor);
    expect(ticket.warrantyEvidence?.verifiedBy).toBe(actor.id); expect(ticket.coverage.costBearer).toBe('shop');
  });

  it('serial đã bán phải đúng khách, tiếp nhận và hủy cùng ghi vòng đời', async () => {
    const unit = await SerialUnitModel.create({ ...scope, warehouseId, productId, variantId, sku: 'CABLE', productName: 'Thiết bị', serialNumber: 'SOLD-1', normalizedSerialNumber: 'SOLD-1', internalBarcode: 'SOLD-BC', normalizedInternalBarcode: 'SOLD-BC', status: 'sold', customerId, createdBy: actor.id, updatedBy: actor.id });
    const ticket = await createRepairTicket(scope, { ...request(), intakeSource: 'company_sale', device: { ...request().device, serialNumber: 'SOLD-BC' } }, actor);
    expect(ticket.device.serialNumber).toBe('SOLD-1'); expect(ticket.device.productId).toBe(productId);
    expect((await SerialUnitModel.findById(unit._id).lean())?.status).toBe('repairing');
    await cancelRepairTicket(scope, String(ticket._id), 'Không thực hiện', actor);
    await cancelRepairTicket(scope, String(ticket._id), 'Không thực hiện', actor);
    expect((await SerialUnitModel.findById(unit._id).lean())?.status).toBe('sold');
    expect(await SerialEventModel.countDocuments({ documentId: String(ticket._id) })).toBe(2);
  });

  it('lỗi lưu sự kiện tiếp nhận không để lại phiếu hoặc serial đang sửa', async () => {
    const unit = await SerialUnitModel.create({ ...scope, warehouseId, productId, variantId, sku: 'CABLE', productName: 'Thiết bị', serialNumber: 'ROLLBACK-1', normalizedSerialNumber: 'ROLLBACK-1', internalBarcode: 'ROLLBACK-BC', normalizedInternalBarcode: 'ROLLBACK-BC', status: 'sold', customerId, createdBy: actor.id, updatedBy: actor.id });
    const failure = vi.spyOn(SerialEventModel, 'create').mockRejectedValueOnce(new Error('Lỗi ghi sự kiện thử nghiệm'));
    try { await expect(createRepairTicket(scope, { ...request(), intakeSource: 'company_sale', device: { ...request().device, serialNumber: 'ROLLBACK-1' } }, actor)).rejects.toThrow(); } finally { failure.mockRestore(); }
    expect(await RepairTicketModel.countDocuments()).toBe(0); expect((await SerialUnitModel.findById(unit._id).lean())?.status).toBe('sold');
  });

  it('xuất/hoàn vật tư số lẻ dùng giá vốn kho và chống gửi lặp', async () => {
    const ticket = await ready();
    const input = { productId, sku: 'CABLE', productName: 'Tên giả', quantity: 1.25, unitCost: 9999, unitPrice: 200, idempotencyKey: 'part-request-001' };
    const part = await issueRepairPart(scope, String(ticket._id), input, actor);
    expect(part.unitCost).toBe(100); expect(await balance()).toBe(8.75);
    await issueRepairPart(scope, String(ticket._id), input, actor); expect(await balance()).toBe(8.75);
    await returnRepairPart(scope, String(ticket._id), String(part._id), 'Dư vật tư', actor);
    await returnRepairPart(scope, String(ticket._id), String(part._id), 'Dư vật tư', actor);
    expect(await balance()).toBe(10);
  });

  it('lỗi ghi vật tư rollback cả tồn và phiếu; hủy hoàn toàn bộ vật tư', async () => {
    const ticket = await ready();
    const input = { productId, sku: 'CABLE', productName: 'Dây dẫn', quantity: 2, unitCost: 1, unitPrice: 200, idempotencyKey: 'part-rollback-001' };
    const failure = vi.spyOn(RepairPartModel, 'create').mockRejectedValueOnce(new Error('Lỗi lưu vật tư thử nghiệm'));
    try { await expect(issueRepairPart(scope, String(ticket._id), input, actor)).rejects.toThrow(); } finally { failure.mockRestore(); }
    expect(await balance()).toBe(10);
    await issueRepairPart(scope, String(ticket._id), input, actor); await cancelRepairTicket(scope, String(ticket._id), 'Khách hủy', actor);
    expect(await balance()).toBe(10); expect(await RepairPartModel.countDocuments({ ticketId: String(ticket._id), status: 'issued' })).toBe(0);
  });

  it('chặn vật tư theo từng đơn vị và bàn giao khi còn nợ', async () => {
    const ticket = await ready();
    await ProductVariantModel.updateOne({ _id: variantId }, { $set: { trackingMode: 'serial' } });
    await expect(issueRepairPart(scope, String(ticket._id), { productId, sku: 'CABLE', productName: 'Thiết bị', quantity: 1, unitCost: 0, unitPrice: 0, idempotencyKey: 'tracked-part-001' }, actor)).rejects.toThrow(/quy trình riêng/);
    await RepairTicketModel.updateOne({ _id: ticket._id }, { $set: { status: 'done', totalAmount: 100, paidAmount: 0 } });
    await expect(deliverRepairTicket(scope, String(ticket._id), actor)).rejects.toThrow(/công nợ/);
    await RepairTicketModel.updateOne({ _id: ticket._id }, { $set: { totalAmount: 0 } });
    expect((await transitionRepairTicket(scope, String(ticket._id), 'delivered', actor)).status).toBe('delivered');
    expect((await deliverRepairTicket(scope, String(ticket._id), actor)).status).toBe('delivered');
  });

  it('lỗi hoàn vật tư khi hủy rollback cả tồn, vật tư và trạng thái phiếu', async () => {
    const ticket = await ready();
    const part = await issueRepairPart(scope, String(ticket._id), { productId, sku: 'CABLE', productName: 'Dây dẫn', quantity: 1.25, unitCost: 1, unitPrice: 200, idempotencyKey: 'cancel-rollback-001' }, actor);
    const failure = vi.spyOn(RepairPartModel.prototype, 'save').mockRejectedValueOnce(new Error('Lỗi hoàn vật tư thử nghiệm'));
    try { await expect(cancelRepairTicket(scope, String(ticket._id), 'Hủy', actor)).rejects.toThrow(); } finally { failure.mockRestore(); }
    expect(await balance()).toBe(8.75); expect((await RepairPartModel.findById(part._id).lean())?.status).toBe('issued');
    expect((await RepairTicketModel.findById(ticket._id).lean())?.status).toBe('approved');
  });

  it('không ghi vật tư hoặc báo giá tạo số dư lẻ không thể thu bằng VND', async () => {
    const ticket = await ready();
    await expect(issueRepairPart(scope, String(ticket._id), { productId, sku: 'CABLE', productName: 'Dây dẫn', quantity: 1.25, unitCost: 100, unitPrice: 1, idempotencyKey: 'fractional-currency' }, actor)).rejects.toThrow(/số nguyên VND/);
    expect(await balance()).toBe(10);
    await RepairTicketModel.updateOne({ _id: ticket._id }, { $set: { status: 'diagnosing' } });
    await expect(quoteRepairTicket(scope, String(ticket._id), 100.5, actor)).rejects.toThrow(/số nguyên VND/);
  });

  it('phép nhân vật tư chỉ có sai số máy vẫn ghi đúng tổng tiền nguyên VND', async () => {
    const ticket = await ready();
    const part = await issueRepairPart(scope, String(ticket._id), { productId, sku: 'CABLE', productName: 'Dây dẫn', quantity: 1.1, unitCost: 100, unitPrice: 100, idempotencyKey: 'whole-vnd-noise-001' }, actor);
    expect(part.lineTotal).toBe(110); expect((await RepairTicketModel.findById(ticket._id).lean())?.totalAmount).toBe(110);
  });

  it('không chấp nhận session bên ngoài chưa mở transaction', async () => {
    const ticket = await ready(); const session = await mongoose.startSession();
    try { await expect(transitionRepairTicket(scope, String(ticket._id), 'repairing', actor, undefined, false, session)).rejects.toMatchObject({ statusCode: 503 }); }
    finally { await session.endSession(); }
    expect((await RepairTicketModel.findById(ticket._id).lean())?.status).toBe('approved');
  });
});
