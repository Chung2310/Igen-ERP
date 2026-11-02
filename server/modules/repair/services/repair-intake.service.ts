import { createHash, randomUUID } from 'node:crypto';
import { Types, type ClientSession } from 'mongoose';
import Joi from 'joi';
import { CustomerModel } from '../../customer-management/models/customer.model';
import { BranchModel } from '../../../model/branch.model';
import { SerialUnitModel } from '../../inventory/serials/serial-unit.model';
import { snapshotCoverage } from '../../inventory/serials/warranty-clock';
import { RepairTicketModel } from '../repair-ticket.model';
import { inInventoryTransaction } from '../../inventory/inventory-transaction';
import { recordRepairSerialLifecycle } from './repair-serial-lifecycle';
import type { RepairActor, RepairScope } from '../repair-ticket.service';
import type { RepairCoverage } from '../repair-ticket.interface';
import { RetailPartnerModel } from '../../retail/models/retail-partner.model';

type Intake = {
  ticketCode?: string; idempotencyKey?: string; ticketType?: 'service' | 'warranty'; subjectType?: 'product' | 'equipment' | 'service'; intakeSource?: 'external' | 'company_sale';
  customerId: string; symptom: string; promisedAt?: string; retailPartnerId?: string;
  device: { productId?: string; serialNumber?: string; imei?: string; name: string; condition: string; accessories?: string[] };
  warrantyEvidence?: { reference: string; endAt: string; confirmed: boolean };
};
const schema = Joi.object<Intake>({
  ticketCode: Joi.string().trim().max(100), idempotencyKey: Joi.string().pattern(/^[A-Za-z0-9_-]{8,100}$/),
  ticketType: Joi.string().valid('service', 'warranty'), subjectType: Joi.string().valid('product', 'equipment', 'service').default('equipment'), intakeSource: Joi.string().valid('external', 'company_sale'),
  customerId: Joi.string().trim().max(100).required(), symptom: Joi.string().trim().max(5000).required(), promisedAt: Joi.string().isoDate(),
  retailPartnerId: Joi.string().hex().length(24),
  device: Joi.object({ productId: Joi.string().hex().length(24).allow(''), serialNumber: Joi.string().trim().max(200).allow(''), imei: Joi.string().trim().max(200).allow(''), name: Joi.string().trim().max(300).required(), condition: Joi.string().trim().max(2000).required(), accessories: Joi.array().items(Joi.string().trim().max(200)).max(30).default([]) }).unknown(true).required(),
  warrantyEvidence: Joi.object({ reference: Joi.string().trim().max(500).required(), endAt: Joi.string().isoDate().required(), confirmed: Joi.boolean().valid(true).required() }).unknown(true),
}).unknown(true).required();
const fail = (message: string, statusCode = 400, code = 'REPAIR_INTAKE_REJECTED'): never => { throw Object.assign(new Error(message), { statusCode, code }); };

export async function createGeneralRepairIntake(scope: RepairScope, raw: unknown, actor: RepairActor, existingSession?: ClientSession) {
  const { value, error } = schema.validate(raw, { abortEarly: false });
  if (error) fail('Chọn khách hàng, đối tượng tiếp nhận, tình trạng và mô tả yêu cầu hợp lệ.');
  if (!actor.id?.trim() || !actor.name?.trim()) fail('Thiếu người tiếp nhận.');
  const input = value as Intake;
  const ticketType = input.ticketType || 'warranty';
  const intakeSource = input.intakeSource || (input.ticketType === 'service' ? 'external' : 'company_sale');
  if (input.subjectType === 'service' && intakeSource === 'company_sale') fail('Hạng mục dịch vụ cần chứng từ bảo hành riêng, không liên kết vào serial hàng hóa.');
  const serial = String(input.device.serialNumber || input.device.imei || '').trim().toUpperCase();
  if (intakeSource === 'company_sale' && !serial) fail('Cần serial/mã định danh để liên kết hàng đã bán.');
  const key = input.idempotencyKey || (input.ticketCode ? `legacy:${input.ticketCode}` : '');
  if (!key) fail('Thiếu khóa yêu cầu tiếp nhận. Vui lòng tải lại biểu mẫu.');
  const identity = { branchId: scope.branchId, actorId: actor.id, customerId: input.customerId, ticketType, intakeSource, subjectType: input.subjectType, device: { name: input.device.name, condition: input.device.condition, accessories: input.device.accessories, productId: input.device.productId || '', serial }, symptom: input.symptom, promisedAt: input.promisedAt, warrantyEvidence: input.warrantyEvidence, retailPartnerId: input.retailPartnerId };
  const fingerprint = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  const work = async (session: ClientSession) => {
    const existing = await RepairTicketModel.findOne({ companyCode: scope.companyCode, intakeRequestKey: key }).session(session).lean();
    if (existing) {
      if (existing.intakeRequestFingerprint !== fingerprint) fail('Khóa tiếp nhận đã được dùng cho nội dung khác.', 409, 'REPAIR_REQUEST_KEY_CONFLICT');
      return existing;
    }
    if (!await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).session(session)) fail('Chi nhánh tiếp nhận không thuộc doanh nghiệp hoặc đã ngừng hoạt động.');
    const customer = await CustomerModel.findOne({ companyCode: scope.companyCode, status: 'active', $or: [{ customerCode: input.customerId }, ...(Types.ObjectId.isValid(input.customerId) ? [{ _id: input.customerId }] : [])] }).session(session).lean();
    if (!customer) fail('Chọn khách hàng đang hoạt động trong doanh nghiệp.', 404);
    const now = new Date();
    let coverage: RepairCoverage = { customer: { covered: false }, supplier: { covered: false }, costBearer: 'customer', checkedAt: now };
    const partner = input.retailPartnerId ? await RetailPartnerModel.findOne({ _id: input.retailPartnerId, companyCode: scope.companyCode, roles: 'collaborator', status: 'active' }).session(session).lean() : null;
    if (input.retailPartnerId && !partner) fail('CTV không thuộc doanh nghiệp hoặc đã ngừng hoạt động.');
    let linkedSerialUnitId: string | undefined;
    let linkedProductId: string | undefined;
    let canonicalSerial = serial;
    let warrantyEvidence: { reference: string; endAt: Date; verifiedBy: string; verifiedAt: Date } | undefined;
    if (intakeSource === 'company_sale') {
      const matches = await SerialUnitModel.find({ companyCode: scope.companyCode, $or: [{ normalizedSerialNumber: serial }, { normalizedInternalBarcode: serial }, { normalizedBarcodeAliases: serial }] }).limit(2).session(session).lean();
      const unit = matches[0];
      if (matches.length !== 1 || !unit || unit.status !== 'sold' || ![String(customer._id), customer.customerCode].includes(String(unit.customerId || '')) || (input.device.productId && input.device.productId !== unit.productId)) fail('Định danh không khớp hàng đã bán cho khách hàng đã chọn.', 409);
      linkedSerialUnitId = String(unit._id);
      linkedProductId = unit.productId; canonicalSerial = unit.serialNumber;
      if (ticketType === 'warranty') {
        coverage = snapshotCoverage(unit, now);
        if (!coverage.customer.covered) fail('Quyền lợi bảo hành đã hết hạn hoặc chưa có dữ liệu xác minh. Chọn phiếu dịch vụ hoặc bổ sung chứng từ.', 409);
      }
    } else if (ticketType === 'warranty') {
      const evidence = input.warrantyEvidence;
      if (!evidence?.confirmed || !evidence.reference || !Number.isFinite(Date.parse(evidence.endAt)) || new Date(evidence.endAt) < now) fail('Bảo hành bên ngoài cần chứng từ còn hiệu lực và xác nhận đã kiểm tra của người tiếp nhận.');
      warrantyEvidence = { reference: evidence.reference, endAt: new Date(evidence.endAt), verifiedBy: actor.id, verifiedAt: now };
      coverage = { customer: { covered: true, endAt: warrantyEvidence.endAt, daysLeft: Math.ceil((warrantyEvidence.endAt.getTime() - now.getTime()) / 86400000) }, supplier: { covered: false }, costBearer: 'shop', checkedAt: now };
    }
    const ticket = new RepairTicketModel({ ...scope, ticketCode: input.ticketCode || `REP-${randomUUID().toUpperCase()}`, intakeRequestKey: key, intakeRequestFingerprint: fingerprint, ticketType, subjectType: input.subjectType, intakeSource,
      ...(partner ? { retailPartnerId: String(partner._id), retailPartnerSnapshot: { partnerId: String(partner._id), code: partner.code, name: partner.name } } : {}),
      customerId: String(customer._id), customerCode: customer.customerCode, customerName: customer.name, customerPhone: customer.phone, linkedSerialUnitId, warrantyEvidence,
      device: { productId: linkedProductId, name: input.device.name, serialNumber: canonicalSerial || undefined, condition: input.device.condition, accessories: input.device.accessories, imeiVerified: Boolean(linkedSerialUnitId) },
      coverage, symptom: input.symptom, receivedAt: now, promisedAt: input.promisedAt, status: 'received', statusHistory: [{ to: 'received', at: now, by: actor.id, byName: actor.name, customerNotified: false }], createdBy: actor.id, createdByName: actor.name,
      laborFee: 0, partCost: 0, partRevenue: 0, discountAmount: 0, totalAmount: 0, paidAmount: 0, dueAmount: 0, paymentStatus: 'unpaid' });
    await recordRepairSerialLifecycle(ticket, 'received', actor, session);
    await ticket.save({ session });
    return ticket.toObject();
  };
  try { return await inInventoryTransaction(work, existingSession); }
  catch (cause) {
    if ((cause as { code?: number }).code !== 11000 || existingSession) throw cause;
    return inInventoryTransaction(work);
  }
}
