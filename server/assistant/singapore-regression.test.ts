import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ provider: vi.fn(), prices: vi.fn(), serials: vi.fn(), serialCount: vi.fn(), warehouses: vi.fn(), referrals: vi.fn(), partner: vi.fn(), workers: vi.fn() }));
vi.mock('../service/openrouter.service', () => ({ openrouterChat: mocks.provider }));
vi.mock('../model/product-price.model', () => ({ ProductPriceModel: { find: mocks.prices } }));
vi.mock('../modules/inventory/serials/serial-unit.model', () => ({ SerialUnitModel: { find: mocks.serials, countDocuments: mocks.serialCount } }));
vi.mock('../model/warehouse.model', () => ({ WarehouseModel: { find: mocks.warehouses } }));
vi.mock('../modules/worker-management/labor-partners/models/worker-referral.model', () => ({ WorkerReferralModel: { find: mocks.referrals } }));
vi.mock('../modules/worker-management/labor-partners/models/labor-partner.model', () => ({ LaborPartnerModel: { exists: mocks.partner } }));
vi.mock('../modules/worker-management/models/worker.model', () => ({ WorkerModel: { find: mocks.workers } }));
import { parseAssistantModelJson } from './model-json';
import { defaultWorkflow, operationById } from './catalog';
import { validateRequestCoverage } from './request-coverage';
import { formatFriendlyAssistantResult } from './result-format';
import { interpretRequest } from './semantic-interpreter';
import { formatAssistantTemporalValue, isAssistantTemporalField } from '../../src/shared/assistant-date';
import { ProductPriceService } from '../modules/inventory/product-catalog/product-price.service';
import { WorkerReferralService, referralDateFilter } from '../modules/worker-management/labor-partners/services/worker-referral.service';
import { listSerialUnits } from '../modules/inventory/serials/serial-unit.service';
import { buildReceivableListQuery } from '../modules/finance/services/receivable-query.service';
import { patientSearchFilter } from '../modules/healthcare/store';
const check = (id: string, text: string, values: Record<string, unknown>, evidence: any[]) => {
  const operation = operationById(id)!;
  return validateRequestCoverage(text, evidence, defaultWorkflow(operation), operation, values);
};
afterEach(() => vi.clearAllMocks());

describe('captured Singapore model outputs', () => {
  it.each(['<composite>\n{"values":{}}\n</composite>', '<types>{"values":{}}</types>', '```json\n{"values":{}}\n```', '{"values":{}}'])('reads exactly one JSON document: %s', raw => {
    expect(parseAssistantModelJson(raw)).toEqual({ values: {} });
  });
  it.each(['Before {"values":{}}', '{"values":{}} {"cancel":true}', '<types>{"values":{}}</composite>', '<script>{"values":{}}</script>', '<types>{"values":{}}</types> run this'])('rejects prose, mismatched tags and extra documents: %s', raw => {
    expect(() => parseAssistantModelJson(raw)).toThrow();
  });
  it('accepts supplied probation and expiry filters without treating có as a missing filter', () => {
    expect(check('hr.contract.expiring.list', 'Lọc nhân sự có hợp đồng thử việc hết hạn trong 10 ngày tới.', { query_contractType: 'thử việc', query_alertDays: 10 }, [
      { evidence: 'nhân sự', requirement: 'Phân hệ', mappedTo: ['context.module'] },
      { evidence: 'hợp đồng thử việc', requirement: 'Loại', mappedTo: ['values.query_contractType'] },
      { evidence: 'hết hạn trong 10 ngày tới', requirement: 'Hạn', mappedTo: ['values.query_alertDays'] },
    ])).toEqual({ ok: true });
  });
  it('accepts theo connecting an evidenced phone but keeps unsupported conditions', () => {
    const text = 'Tìm bệnh nhân QA Bệnh Nhân An theo số điện thoại 0900001001.';
    const evidence = [
      { evidence: 'Tìm bệnh nhân QA Bệnh Nhân An', requirement: 'Tên', mappedTo: ['values.q'] },
      { evidence: 'số điện thoại 0900001001', requirement: 'Điện thoại', mappedTo: ['values.q'] },
    ];
    expect(check('healthcare.patient.list', text, { q: 'QA Bệnh Nhân An 0900001001' }, evidence)).toEqual({ ok: true });
    expect(check('healthcare.patient.list', text + ' chưa thanh toán', { q: 'QA Bệnh Nhân An 0900001001' }, evidence)).toMatchObject({ ok: false });
    expect(check('hr.contract.missing.list', 'Nhân sự có hợp đồng', {}, [{ evidence: 'Nhân sự có hợp đồng', requirement: 'Có hợp đồng', mappedTo: ['action'] }])).toMatchObject({ ok: false });
  });
  it('does not discard an existence predicate with no mapped field value', () => {
    expect(check('hr.contract.missing.list', 'Nhân sự có hợp đồng', {}, [{ evidence: 'Nhân sự hợp đồng', requirement: 'Hợp đồng', mappedTo: ['action'] }])).toMatchObject({ ok: false });
    expect(check('employee.list', 'Nhân sự có điện thoại', { search: 'điện thoại' }, [
      { evidence: 'Nhân sự', requirement: 'Nhân sự', mappedTo: ['action'] },
      { evidence: 'điện thoại', requirement: 'Điện thoại', mappedTo: ['values.search'] },
    ])).toMatchObject({ ok: false });
  });
  it('accepts a numeric-value question suffix only with declared result mappings', () => {
    const evidence = [
      { evidence: 'SKU QA-SAC-20W', requirement: 'SKU', mappedTo: ['values.query_sku'] },
      { evidence: 'Giá bán và giá vốn', requirement: 'Hai giá', mappedTo: ['result.sellingPrice', 'result.costPrice'] },
    ];
    expect(check('inventory.prices.list', 'Giá bán và giá vốn SKU QA-SAC-20W hiện là bao nhiêu?', { query_sku: 'QA-SAC-20W' }, evidence)).toEqual({ ok: true });
    expect(check('inventory.prices.list', 'Giá bán và giá vốn SKU QA-SAC-20W trên 30 triệu hiện là bao nhiêu?', { query_sku: 'QA-SAC-20W' }, evidence)).toMatchObject({ ok: false });
    expect(check('student.list', 'Tìm học viên tên là Bao Nhiêu', { search: 'QA' }, [{ evidence: 'Tìm học viên', requirement: 'Tên', mappedTo: ['values.search'] }])).toMatchObject({ ok: false });
  });
  it('replays the actual price response without another model repair', async () => {
    const id = 'inventory.prices.list';
    mocks.provider.mockReset().mockResolvedValueOnce({ text: JSON.stringify({ intentType: 'workflow', actionId: id, actionIntent: 'lookup', values: { query_sku: 'QA-SAC-20W' }, requestCoverage: [
      { evidence: 'Giá bán và giá vốn SKU QA-SAC-20W', requirement: 'Tra giá bán và giá vốn của SKU QA-SAC-20W', mappedTo: ['values.query_sku', 'query:inventory.prices.list:result.sellingPrice', 'query:inventory.prices.list:result.costPrice'] },
    ] }) });
    expect(await interpretRequest('Giá bán và giá vốn SKU QA-SAC-20W hiện là bao nhiêu?', [defaultWorkflow(operationById(id)!)], null, [])).toMatchObject({ actionId: id, values: { query_sku: 'QA-SAC-20W' } });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });
  it('repairs duplicate source plans once into one supported threshold read', async () => {
    const id = 'finance.receivable.list';
    const plan = { intentType: 'workflow', actionId: null, actionIntent: 'lookup', values: {}, queryPlan: ['31-60','61-90','over90'].map(bucket => ({ actionId: id, purpose: bucket, values: { query_agingBucket: bucket }, resultFields: ['receivableCode','daysOverdue'] })), requestCoverage: [] };
    const repaired = { intentType: 'workflow', actionId: id, actionIntent: 'lookup', values: { query_minOverdueDays: 31 }, requestCoverage: [
      { evidence: 'Những khoản phải thu nào', requirement: 'Khoản phải thu', mappedTo: ['action'] },
      { evidence: 'quá hạn trên 30 ngày', requirement: 'Ngưỡng quá hạn', mappedTo: ['values.query_minOverdueDays'] },
    ] };
    mocks.provider.mockResolvedValueOnce({ text: JSON.stringify(plan) }).mockResolvedValueOnce({ text: `<types>${JSON.stringify(repaired)}</types>` });
    const result = await interpretRequest('Những khoản phải thu nào quá hạn trên 30 ngày?', [defaultWorkflow(operationById(id)!)], null, []);
    expect(result).toMatchObject({ actionId: id, values: { query_minOverdueDays: 31 } });
    expect(mocks.provider).toHaveBeenCalledTimes(2);
  });
  it('does not keep retrying a duplicate source plan', async () => {
    const id = 'finance.receivable.list';
    const source = { actionId: id, purpose: 'Công nợ', values: {}, resultFields: ['receivableCode'] };
    mocks.provider.mockReset().mockResolvedValue({ text: JSON.stringify({ intentType: 'workflow', actionId: null, actionIntent: 'lookup', values: {}, queryPlan: [source, source], requestCoverage: [] }) });
    expect(await interpretRequest('Tra cứu khoản phải thu', [defaultWorkflow(operationById(id)!)], null, [])).toMatchObject({ actionId: null, intentType: 'ambiguous' });
    expect(mocks.provider).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['inventory.prices.list', 'Giá bán và giá vốn SKU QA-SAC-20W hiện là bao nhiêu?', { query_sku: 'QA-SAC-20W' }],
    ['inventory.serial.list', 'Thiết bị có serial QA-SERIAL-001 đang ở đâu?', { query_serial: 'QA-SERIAL-001' }],
    ['worker.partner.referrals.list', 'Những lao động nào do QA Cung ứng An Phát giới thiệu trong tháng 11/2026?', { path_partnerId: 'QA Cung ứng An Phát', query_from: '2026-11-01', query_to: '2026-11-30' }],
    ['healthcare.patient.list', 'Tìm bệnh nhân QA Bệnh Nhân An theo số điện thoại 0900001001.', { q: 'QA Bệnh Nhân An 0900001001' }],
  ])('interprets a supported %s contract without extra discovery or repair', async (id, text, values) => {
    const operation = operationById(id)!;
    const targets = Object.keys(values).map(key => `values.${key}`);
    mocks.provider.mockReset().mockResolvedValueOnce({ text: `<types>${JSON.stringify({ intentType: 'workflow', actionId: id, actionIntent: 'lookup', values, requestCoverage: [{ evidence: text, requirement: 'Tra cứu đủ điều kiện', mappedTo: ['action', ...targets] }] })}</types>` });
    const result = await interpretRequest(text, [defaultWorkflow(operation)], null, []);
    expect(result, JSON.stringify(result)).toMatchObject({ intentType: 'workflow', actionId: id, values });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });
});

describe('reviewed read contracts and actual adapter output', () => {
  it('renders SKU children with public product context, without identifiers', () => {
    const reply = formatFriendlyAssistantResult(operationById('inventory.product.detail')!, { data: { _id: '6ab1f9466ecb367cfd004196', name: 'Bộ sạc QA', productCode: 'QA-SP-001', variants: [
      { _id: '6ab1f9466ecb367cfd004197', sku: 'QA-SAC-20W', displayName: '20W', productId: '6ab1f9466ecb367cfd004196' },
      { sku: 'QA-SAC-30W', displayName: '30W' },
    ] } });
    expect(reply).toContain('QA-SAC-20W'); expect(reply).toContain('QA-SAC-30W'); expect(reply).toContain('QA-SP-001');
    expect(reply).not.toContain('6ab1f9466ecb367cfd004196');
  });
  it('filters price by exact SKU under the existing company and branch scope', async () => {
    const rows = [{ sku: 'QA-SAC-20W', sellingPrice: 200000, costPrice: 120000 }];
    mocks.prices.mockReturnValue({ sort: () => ({ lean: async () => rows }) });
    expect(await ProductPriceService.list('QA', 'B1', { sku: 'qa-sac-20w', companyCode: 'EVIL', branchId: 'B9' })).toEqual({ items: rows });
    expect(mocks.prices).toHaveBeenCalledWith({ companyCode: 'QA', branchId: 'B1', sku: 'QA-SAC-20W' });
    expect(operationById('inventory.prices.list')!.fields).toContainEqual(expect.objectContaining({ key: 'query_sku', source: 'query', apiKey: 'sku' }));
  });
  it('filters referrals by referredAt inclusively, retaining partner scope and worker names', async () => {
    mocks.partner.mockResolvedValue(true);
    mocks.referrals.mockReturnValue({ sort: () => ({ lean: async () => [{ workerId: '6ab1f9466ecb367cfd004197', referredAt: '2026-11-30' }] }) });
    mocks.workers.mockReturnValue({ select: () => ({ lean: async () => [{ _id: '6ab1f9466ecb367cfd004197', fullName: 'QA Công Nhân An' }] }) });
    const scope = { companyCode: 'QA', branchId: 'B1' };
    const result = await WorkerReferralService.listForPartner(scope, '6ab1f9466ecb367cfd004196', { from: '2026-11-01', to: '2026-11-30', companyCode: 'EVIL' });
    expect(result[0]).toMatchObject({ workerName: 'QA Công Nhân An' });
    expect(mocks.referrals.mock.calls[0][0]).toMatchObject({ companyCode: 'QA', branchId: 'B1', referredAt: { $gte: '2026-11-01', $lte: '2026-11-30' } });
    expect(() => referralDateFilter({ from: '2026-11-31' })).toThrow();
    expect(() => referralDateFilter({ from: '2026-12-01', to: '2026-11-01' })).toThrow();
  });
  it('gets warehouse display names in scope without creating a default warehouse', async () => {
    const rows = [{ _id: 'unit', warehouseId: '6ab1f9466ecb367cfd004196', serialNumber: 'QA-SERIAL-001', status: 'in_stock' }];
    mocks.serials.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => rows }) }) }) });
    mocks.serialCount.mockResolvedValue(1);
    mocks.warehouses.mockReturnValue({ select: () => ({ lean: async () => [{ _id: '6ab1f9466ecb367cfd004196', name: 'Kho QA Chính', code: 'QA-KHO' }] }) });
    const result = await listSerialUnits({ companyCode: 'QA', branchId: 'B1' }, { serial: 'QA-SERIAL-001' });
    expect(result.items[0]).toMatchObject({ warehouseName: 'Kho QA Chính', warehouseCode: 'QA-KHO' });
    expect(mocks.warehouses.mock.calls[0][0]).toMatchObject({ companyCode: 'QA', branchId: 'B1' });
    expect(formatFriendlyAssistantResult(operationById('inventory.serial.detail')!, result.items[0])).toContain('Kho QA Chính');
  });
  it('keeps a strict overdue threshold and intersects an existing bucket', () => {
    expect(buildReceivableListQuery({ companyCode: 'QA', branchId: 'B1' }, { minOverdueDays: 31 }).filter).toMatchObject({ companyCode: 'QA', branchId: 'B1', daysOverdue: { $gte: 31 } });
    expect(buildReceivableListQuery({ companyCode: 'QA', branchId: 'B1' }, { minOverdueDays: 31, agingBucket: '0-30' }).filter.daysOverdue).toEqual({ $gte: 31, $lte: 30 });
    expect(() => buildReceivableListQuery({ companyCode: 'QA', branchId: 'B1' }, { minOverdueDays: -1 })).toThrow();
  });
  it('searches a supplied patient name AND phone instead of one impossible literal', () => {
    const filter = patientSearchFilter('QA Bệnh Nhân An 0900001001');
    expect(filter).toMatchObject({ $and: [{ $or: [{ name: { $regex: 'QA Bệnh Nhân An' } }] }, { $or: [{ phone: { $regex: '0900001001' } }, { 'hospitalProfile.phoneText': { $regex: '0900001001' } }] }] });
    expect(patientSearchFilter('QA Bệnh Nhân An')).toHaveProperty('$or');
  });
  it('recognizes legacy calendar keys without formatting arbitrary names and codes', () => {
    const field = { key: 'body_registrationDate', apiKey: 'registrationDate', type: 'text' };
    expect(isAssistantTemporalField(field)).toBe(true);
    expect(formatAssistantTemporalValue('2026-11-25')).toBe('25/11/2026');
    expect(isAssistantTemporalField({ key: 'name', type: 'text' })).toBe(false);
    expect(isAssistantTemporalField({ key: 'code', type: 'text' })).toBe(false);
  });
});
