import { createHash } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import { RepairPartModel } from '../repair-part.model';
import { RepairTicketModel } from '../repair-ticket.model';
import { InventoryLedgerEntryModel } from '../../../model/inventory-ledger-entry.model';
import { ProductCatalogLegacyMappingModel } from '../../../model/product-catalog-legacy-mapping.model';
import { inInventoryTransaction } from '../../inventory/inventory-transaction';
import { resolveInventoryVariant, resolveInventoryWarehouse } from '../../inventory/inventory-scope';
import { writeStockMovement } from '../../../integrations/shared/stock-movement.service';
import { defaultPartBilling, recomputeRepairTicketAmounts } from '../repair-part.service';
import { wholeVndCharge } from '../../../../shared/repair-money';
import type { RepairActor, RepairScope } from '../repair-ticket.service';

type Input = { productId: string; variantId?: string; warehouseId?: string; sku: string; productName: string; quantity: number; unitCost: number; unitPrice: number; serialNumbers?: string[]; idempotencyKey: string; billing?: 'customer' | 'warranty_shop' | 'warranty_supplier'; manual?: boolean };
const fail = (message: string, statusCode = 409, code = 'REPAIR_PART_REJECTED'): never => { throw Object.assign(new Error(message), { statusCode, code }); };

export async function issueGeneralRepairPart(scope: RepairScope, ticketId: string, input: Input, actor: RepairActor) {
  const key = String(input.idempotencyKey || '').trim(), quantity = Number(input.quantity), unitPrice = Number(input.unitPrice), manual = input.manual === true;
  if (!key || key.length > 100 || !actor.id || !actor.name || !Number.isFinite(quantity) || quantity < 0.000001 || quantity > Number.MAX_SAFE_INTEGER || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity * unitPrice) || (manual && (!Number.isFinite(Number(input.unitCost)) || input.unitCost < 0))) fail('Kiểm tra khóa yêu cầu, người thao tác, số lượng và giá vật tư.', 400);
  if (input.serialNumbers?.length) fail('Vật tư theo từng đơn vị cần quy trình xuất có đủ định danh; hãy dùng vật tư quản lý theo số lượng tại đây.', 400);
  if (input.billing && !['customer', 'warranty_shop', 'warranty_supplier'].includes(input.billing)) fail('Diện chi phí vật tư không hợp lệ.', 400);
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...scope, ticketId, actorId: actor.id, productId: input.productId, variantId: input.variantId, warehouseId: input.warehouseId, sku: input.sku, productName: input.productName, quantity, unitPrice, manual, unitCost: manual ? Number(input.unitCost) : undefined, billing: input.billing })).digest('hex');
  const work = async (session: ClientSession) => {
    const ticket = await RepairTicketModel.findOneAndUpdate({ _id: ticketId, ...scope }, { $inc: { partsVersion: 1 } }, { returnDocument: 'after', session });
    if (!ticket) fail('Không tìm thấy phiếu trong chi nhánh.', 404);
    const prior = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).session(session).lean();
    if (prior) { if (prior.requestFingerprint !== fingerprint) fail('Khóa xuất vật tư đã dùng cho nội dung khác.', 409, 'REPAIR_REQUEST_KEY_CONFLICT'); return prior; }
    if (!['approved', 'repairing'].includes(ticket.status)) fail('Chỉ xuất vật tư khi phiếu đã duyệt hoặc đang thực hiện.');
    const billing = defaultPartBilling(ticket.coverage.costBearer), chargeable = billing === 'customer';
    const lineTotal = chargeable ? wholeVndCharge(quantity * unitPrice) : 0;
    if (lineTotal === undefined) fail('Tổng tiền vật tư cần là số nguyên VND. Điều chỉnh đơn giá hoặc số lượng trước khi ghi nhận.', 400);
    let productId = manual ? `manual:${key}` : input.productId, sku = String(input.sku || '').trim(), productName = String(input.productName || '').trim();
    let unitCost = Number(input.unitCost || 0), variantId: string | undefined, warehouseId: string | undefined, issueLedgerId: string | undefined, unitCode: string | undefined;
    if (!manual) {
      const mapping = await ProductCatalogLegacyMappingModel.findOne({ companyCode: scope.companyCode, legacyProductId: productId }).session(session).lean();
      if (mapping && mapping.legacyBranchId !== scope.branchId) fail('Vật tư cũ không thuộc chi nhánh.');
      productId = mapping?.productId || productId;
      const resolved = await resolveInventoryVariant(scope.companyCode, { productId, variantId: input.variantId || mapping?.variantId, sku }, session);
      if (resolved.variant.trackingMode !== 'quantity') fail('Vật tư theo serial/mã đơn vị hoặc lô cần quy trình riêng; không được trừ tồn tổng tại đây.');
      variantId = String(resolved.variant._id); sku = resolved.variant.sku; productName = resolved.product.name; unitCode = resolved.variant.unitCode;
      const warehouse = await resolveInventoryWarehouse(scope, input.warehouseId, session); warehouseId = String(warehouse._id);
      const movement = await writeStockMovement({ ...scope, warehouseId, direction: 'out', purpose: 'other', sourceType: 'repair-ticket', sourceId: ticketId, idempotencyKey: `repair-part:${key}`, operatorName: actor.name, writeLegacyStockLog: false, session, items: [{ productId, variantId, sku, productName, quantity, unitPrice }] });
      if (movement.replayed) fail('Đã có sổ xuất nhưng thiếu dòng vật tư; cần đối soát.', 409, 'REPAIR_MOVEMENT_UNRECONCILED');
      unitCost = Number(movement.entries[0].unitCost); issueLedgerId = String(movement.entries[0]._id);
    }
    if (!sku || !productName) fail('Tên và mã vật tư là bắt buộc.', 400);
    if (!Number.isFinite(quantity * unitCost)) fail('Tổng giá trị vật tư vượt giới hạn cho phép.', 400);
    if (input.billing && input.billing !== billing) fail('Diện chi phí phải khớp quyền lợi đã xác minh trên phiếu.', 400);
    const [part] = await RepairPartModel.create([{ ...scope, ticketId, productId, variantId, warehouseId, issueLedgerId, unitCode, sku, productName, quantity, unitCost, unitPrice, manual, billing, chargeable, lineTotal, status: 'issued', idempotencyKey: key, requestFingerprint: fingerprint, issuedBy: actor.id, issuedByName: actor.name, issuedAt: new Date() }], { session });
    const ticketAmounts = await recomputeRepairTicketAmounts(ticket, session);
    return { ...part.toObject(), ticketAmounts };
  };
  try { return await inInventoryTransaction(work); }
  catch (cause) { if ((cause as { code?: number }).code !== 11000) throw cause; return inInventoryTransaction(work); }
}

export async function returnGeneralRepairPart(scope: RepairScope, ticketId: string, partId: string, reason: string, actor: RepairActor, existingSession?: ClientSession) {
  if (!reason.trim()) fail('Lý do hoàn vật tư là bắt buộc.', 400);
  return inInventoryTransaction(async (session) => {
    const ticket = await RepairTicketModel.findOneAndUpdate({ _id: ticketId, ...scope }, { $inc: { partsVersion: 1 } }, { returnDocument: 'after', session });
    const part = await RepairPartModel.findOne({ _id: partId, ticketId, ...scope }).session(session);
    if (!ticket || !part) fail('Không tìm thấy phiếu hoặc vật tư trong chi nhánh.', 404);
    if (part.status === 'returned' && part.returnReason === reason.trim()) return part.toObject();
    if (part.status !== 'issued' || ['delivered', 'cancelled', 'returned'].includes(ticket.status)) fail('Không thể hoàn vật tư ở trạng thái hiện tại.');
    if (!part.manual) {
      const entry = await InventoryLedgerEntryModel.findOne({ _id: part.issueLedgerId, ...scope, sourceType: 'repair-ticket', sourceId: ticketId, warehouseId: part.warehouseId, productId: part.productId, variantId: part.variantId, direction: 'out', quantity: part.quantity, unitCost: part.unitCost }).session(session).lean();
      if (!entry) fail('Dòng vật tư không khớp sổ xuất gốc; cần đối soát.');
      await resolveInventoryWarehouse(scope, part.warehouseId, session);
      await writeStockMovement({ ...scope, warehouseId: part.warehouseId, direction: 'in', purpose: 'other', sourceType: 'repair-ticket', sourceId: ticketId, idempotencyKey: `repair-part:${partId}:return`, operatorName: actor.name, reason: reason.trim(), session, writeLegacyStockLog: false, items: [{ productId: part.productId, variantId: part.variantId, sku: part.sku, productName: part.productName, quantity: part.quantity, unitCost: entry.unitCost }] });
    }
    part.status = 'returned'; part.returnedAt = new Date(); part.returnReason = reason.trim(); part.returnedByName = actor.name;
    await part.save({ session });
    const ticketAmounts = await recomputeRepairTicketAmounts(ticket, session);
    return { ...part.toObject(), ticketAmounts };
  }, existingSession);
}
