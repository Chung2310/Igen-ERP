import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBusinessOverview, overviewAccess, overviewComparison } from './business-overview.service';
import type { DashboardUser } from './dashboard.service';
import { Types } from 'mongoose';

const db = vi.hoisted(() => {
  const chain = (rows: unknown = []) => {
    const query = { select: vi.fn(), sort: vi.fn(), limit: vi.fn(), lean: vi.fn(async () => rows) };
    query.select.mockReturnValue(query); query.sort.mockReturnValue(query); query.limit.mockReturnValue(query);
    return query;
  };
  const model = () => ({ countDocuments: vi.fn(async () => 0), aggregate: vi.fn(async (): Promise<unknown[]> => []), find: vi.fn(() => chain()), findOne: vi.fn(() => chain({ businessType: 'education' })) });
  return { chain, company: model(), users: model(), student: model(), batch: model(), payment: model(), worker: model(), project: model(), partner: model(), settlement: model(), inventory: model(), repair: model(), finance: model(), customer: model(), retail: vi.fn(), owners: vi.fn(async (): Promise<string[] | string> => ['owner-a']), personnel: vi.fn(), projects: vi.fn(), attendance: vi.fn() };
});
vi.mock('../model/company.model', () => ({ CompanyModel: db.company }));
vi.mock('../model/user.model', () => ({ UserModel: db.users }));
vi.mock('../model/inventory-balance.model', () => ({ InventoryBalanceModel: db.inventory }));
vi.mock('../modules/student-management/models/student.model', () => ({ Student: db.student }));
vi.mock('../modules/student-management/models/batch.model', () => ({ Batch: db.batch }));
vi.mock('../modules/student-management/models/payment.model', () => ({ Payment: db.payment }));
vi.mock('../modules/student-management/utils/auth.util', () => ({ getAllowedOwnerIds: db.owners }));
vi.mock('../modules/worker-management/models/worker.model', () => ({ WorkerModel: db.worker }));
vi.mock('../modules/worker-management/models/worker-project.model', () => ({ WorkerProjectModel: db.project }));
vi.mock('../modules/worker-management/labor-partners/models/labor-partner.model', () => ({ LaborPartnerModel: db.partner }));
vi.mock('../modules/worker-management/labor-partners/models/settlement.model', () => ({ LaborPartnerSettlementModel: db.settlement }));
vi.mock('../modules/repair/repair-ticket.model', () => ({ RepairTicketModel: db.repair }));
vi.mock('../modules/finance/models/receivable.model', () => ({ ReceivableModel: db.finance }));
vi.mock('../modules/customer-management/models/customer.model', () => ({ CustomerModel: db.customer }));
vi.mock('./dashboard.service', () => ({ getPersonnelNow: db.personnel, getProjectStats: db.projects, getTimekeepingStats: db.attendance }));
vi.mock('./business-overview-retail', () => ({ getRetailBusinessOverview: db.retail }));

const branchId = '507f1f77bcf86cd799439011';
const actor = (enabledModules: string[], permissions: string[]): DashboardUser => ({ id: 'actor-a', role: 'admin', companyCode: 'ACME', branchId, enabledModules, permissions: new Set(permissions) });
const range = { start: new Date('2026-10-01T00:00:00+07:00'), end: new Date('2026-10-28T23:59:59.999+07:00'), filter: 'custom' };
beforeEach(() => {
  vi.clearAllMocks();
  db.company.findOne.mockImplementation(() => db.chain({ businessType: 'education' }));
  db.owners.mockResolvedValue(['owner-a']);
  for (const model of [db.users, db.student, db.batch, db.payment, db.worker, db.project, db.partner, db.settlement, db.inventory, db.repair, db.finance, db.customer]) {
    model.countDocuments.mockResolvedValue(0); model.aggregate.mockResolvedValue([]); model.find.mockImplementation(() => db.chain());
  }
});

describe('business overview security and data', () => {
  it('requires both an enabled module and explicit permission, including for admins', async () => {
    const user = actor(['student', 'hr', 'inventory', 'finance'], ['dashboard:read']);
    const result = await getBusinessOverview(user, range);
    expect(Object.values(result.access).every(value => !value)).toBe(true);
    expect(result.education).toBeNull(); expect(result.hr).toBeNull();
    expect(db.student.countDocuments).not.toHaveBeenCalled(); expect(db.inventory.aggregate).not.toHaveBeenCalled(); expect(db.personnel).not.toHaveBeenCalled();
    expect(overviewAccess(actor(['worker'], ['*'])).education).toBe(false);
    expect(overviewAccess(actor(['finance'], ['finance-wallet:read'])).finance).toBe(false);
  });
  it('isolates education by owner and branch, and uses the selected paidOn range rather than the current month', async () => {
    db.payment.aggregate.mockResolvedValueOnce([{ value: 1200000 }]).mockResolvedValueOnce([{ value: 1000000 }]).mockResolvedValueOnce([{ _id: '2026-10-03', value: 1200000 }]);
    const result = await getBusinessOverview(actor(['student'], ['people:read']), range);
    expect(result.education?.tuition).toBe(1200000); expect(result.education?.previousTuition).toBe(1000000);
    expect(result.education?.series).toEqual([{ date: '2026-10-03', value: 1200000 }]);
    expect(db.student.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ ownerId: { $in: ['owner-a'] }, branchId }));
    expect(db.payment.aggregate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ $match: expect.objectContaining({ branchId, paidOn: { $gte: range.start, $lte: range.end } }) })]));
    expect(result.range).toEqual({ from: '2026-10-01', to: '2026-10-28' });
    expect(db.worker.countDocuments).not.toHaveBeenCalled();
  });
  it('reads the business type from the authenticated company and scopes independent worker data', async () => {
    db.company.findOne.mockImplementation(() => db.chain({ businessType: 'labor' }));
    db.worker.aggregate.mockResolvedValueOnce([{ _id: 'active', value: 8 }, { _id: 'placed', value: 2 }]);
    db.project.aggregate.mockResolvedValue([{ unfilled: [{ value: 9 }], projects: [{ _id: 'p1', name: 'Dự án A', status: 'active', quota: 20, allocated: 2 }] }]);
    const result = await getBusinessOverview(actor(['worker'], ['people:read']), range);
    expect(result.businessType).toBe('labor'); expect(result.labor?.placedWorkers).toBe(2);
    expect(result.labor?.unfilledProjects).toBe(9);
    expect(result.labor?.topProjects[0].allocated).toBe(2);
    expect(db.project.find).not.toHaveBeenCalled();
    expect(db.project.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      { $match: { companyCode: 'ACME', branchId: new Types.ObjectId(branchId), deletedAt: null, status: { $in: ['active', 'planned'] } } },
      expect.objectContaining({ $facet: expect.objectContaining({ projects: expect.arrayContaining([{ $limit: 5 }]) }) }),
    ]));
    expect(result.education).toBeNull();
  });
  it('keeps a staff member restricted to the student owners granted by the existing module', async () => {
    db.owners.mockResolvedValue('staff-a');
    await getBusinessOverview({ ...actor(['student'], ['people:read']), role: 'user', id: 'staff-a' }, range);
    expect(db.student.countDocuments).toHaveBeenCalledWith({ ownerId: { $in: ['staff-a'] }, branchId });
  });
  it('does not load partner money without its own permission, and only sums approved outstanding settlements', async () => {
    db.company.findOne.mockImplementation(() => db.chain({ businessType: 'labor' }));
    await getBusinessOverview(actor(['worker', 'partner'], ['people:read']), range);
    expect(db.settlement.aggregate).not.toHaveBeenCalled();
    await getBusinessOverview(actor(['worker', 'partner'], ['labor-partner:read']), range);
    expect(db.settlement.aggregate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ $match: { companyCode: 'ACME', branchId, status: { $in: ['approved', 'partially_paid'] } } })]));
  });
  it('queries only the business-type primary section when both independent modules are enabled', async () => {
    const result = await getBusinessOverview(actor(['student', 'worker', 'partner'], ['*']), range);
    expect(result.education).not.toBeNull(); expect(result.labor).toBeNull(); expect(result.partners).not.toBeNull();
    expect(db.worker.countDocuments).not.toHaveBeenCalled(); expect(db.settlement.aggregate).toHaveBeenCalled();
  });
  it('keeps other sections usable on partial failure instead of returning fake zeros', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.payment.aggregate.mockRejectedValue(new Error('Storage unavailable'));
    db.inventory.aggregate.mockResolvedValue([{ value: 38 }]);
    const result = await getBusinessOverview(actor(['student', 'inventory'], ['people:read', 'inventory:read']), range);
    expect(result.errors).toEqual(['education']); expect(result.education).toBeNull(); expect(result.inventory?.quantity).toBe(38);
    log.mockRestore();
  });
  it('rejects a missing tenant before any business query', async () => {
    await expect(getBusinessOverview({ ...actor(['worker'], ['*']), companyCode: undefined }, range)).rejects.toThrow('Thiếu phạm vi');
    expect(db.company.findOne).not.toHaveBeenCalled(); expect(db.worker.countDocuments).not.toHaveBeenCalled();
  });
  it('keeps receivables due today out of the overdue total until the business date changes', async () => {
    await getBusinessOverview(actor(['finance'], ['finance-receivable:read']), range);
    const pipeline = db.finance.aggregate.mock.calls[0] as unknown as [Array<{ $group?: { overdue: { $sum: { $cond: [{ $lt: [string, Date] }, string, number] } } } }>];
    const cutoff = pipeline[0][1].$group!.overdue.$sum.$cond[0].$lt[1];
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    expect(cutoff).toEqual(new Date(`${today}T00:00:00+07:00`));
  });
  it('does not report a manually entered instructor as a missing teacher', async () => {
    await getBusinessOverview(actor(['student'], ['people:read']), range);
    expect(db.batch.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Đang học', $and: [
        { $or: [{ instructorId: null }, { instructorId: '' }] },
        { $or: [{ instructorText: null }, { instructorText: '' }] },
      ],
    }));
  });
  it('uses the enabled alternative module while retaining the actual company business type', async () => {
    const result = await getBusinessOverview(actor(['worker'], ['people:read']), range);
    expect(result.businessType).toBe('education'); expect(result.primary).toBe('labor');
    expect(result.labor).not.toBeNull(); expect(result.education).toBeNull();
    expect(db.student.countDocuments).not.toHaveBeenCalled();
  });
  it('loads daily tuition independently of the selected reporting range', async () => {
    db.payment.aggregate.mockResolvedValueOnce([{ value: 1200000 }]).mockResolvedValueOnce([{ value: 1000000 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ _id: 'today', value: 600000 }, { _id: 'yesterday', value: 400000 }]);
    const result = await getBusinessOverview(actor(['student'], ['people:read']), range);
    expect(result.education).toMatchObject({ tuition: 1200000, todayTuition: 600000, yesterdayTuition: 400000 });
  });
  it('returns contract details and preserves the separate permission for attendance', async () => {
    db.projects.mockResolvedValue({ tasks: { todo: 1, doing: 2, done: 3, total: 6 }, overdueTasks: 0 });
    db.personnel.mockResolvedValue({ expiringContractCount: 1, pendingApprovalCount: 0, expiringContracts: [{ id: 'c1', employeeName: 'Nguyễn Văn An', endDate: new Date('2026-11-01T00:00:00+07:00') }] });
    const result = await getBusinessOverview(actor(['hr'], ['hr:read']), range);
    expect(result.hr?.contracts?.[0]).toMatchObject({ employeeName: 'Nguyễn Văn An', endDate: '2026-10-31T17:00:00.000Z' });
    expect(result.hr?.checkedIn).toBeNull(); expect(db.attendance).not.toHaveBeenCalled();
    db.attendance.mockResolvedValue({ checkedInToday: 4, lateToday: 1, onApprovedLeaveToday: 2, absentWithoutLeave: 3 });
    const authorized = await getBusinessOverview(actor(['hr'], ['hr:read', 'timekeeping:read']), range);
    expect(authorized.hr).toMatchObject({ checkedIn: 4, late: 1, approvedLeave: 2, absent: 3 });
  });
  it('requires POS report permission and selects sales only when the type-specific modules are unavailable', async () => {
    const hidden = await getBusinessOverview(actor(['retail'], ['retail:read']), range);
    expect(hidden.access.retail).toBe(false); expect(db.retail).not.toHaveBeenCalled();
    db.retail.mockResolvedValue({ netSales: 1500000, todaySales: 1000000, yesterdaySales: 500000, previousSales: 0, orderCount: 2, refunds: 0, products: [], series: [] });
    const allowed = await getBusinessOverview(actor(['retail'], ['pos:manage']), range);
    expect(allowed.primary).toBe('retail'); expect(allowed.retail?.netSales).toBe(1500000);
    expect(db.retail).toHaveBeenCalledWith({ companyCode: 'ACME', branchId }, range);
  });
});

it('compares equally long adjacent inclusive periods', () => {
  const previous = overviewComparison(range);
  expect(previous.end.getTime() + 1).toBe(range.start.getTime());
  expect(previous.end.getTime() - previous.start.getTime()).toBe(range.end.getTime() - range.start.getTime());
});
