import type { BusinessOverview, OverviewPoint, OverviewSection } from '../../shared/business-overview';
import { Types } from 'mongoose';
import { businessDateKey, parseBusinessDate } from '../../shared/business-calendar';
import { CompanyModel } from '../model/company.model';
import { UserModel } from '../model/user.model';
import { InventoryBalanceModel } from '../model/inventory-balance.model';
import { Student } from '../modules/student-management/models/student.model';
import { Batch } from '../modules/student-management/models/batch.model';
import { Payment } from '../modules/student-management/models/payment.model';
import { getAllowedOwnerIds } from '../modules/student-management/utils/auth.util';
import { WorkerModel } from '../modules/worker-management/models/worker.model';
import { WorkerProjectModel } from '../modules/worker-management/models/worker-project.model';
import { LaborPartnerModel } from '../modules/worker-management/labor-partners/models/labor-partner.model';
import { LaborPartnerSettlementModel } from '../modules/worker-management/labor-partners/models/settlement.model';
import { RepairTicketModel } from '../modules/repair/repair-ticket.model';
import { ReceivableModel } from '../modules/finance/models/receivable.model';
import { CustomerModel } from '../modules/customer-management/models/customer.model';
import { getPersonnelNow, getProjectStats, getTimekeepingStats, type DashboardRange, type DashboardUser } from './dashboard.service';
import { getRetailBusinessOverview } from './business-overview-retail';

export function overviewAccess(user: DashboardUser): BusinessOverview['access'] {
  const module = (key: string) => user.role === 'superadmin' || (user.enabledModules?.length ? user.enabledModules.includes(key) : !['finance', 'retail'].includes(key));
  const permission = (...codes: string[]) => user.role === 'superadmin' || Boolean(user.permissions?.has('*') || codes.some(code => user.permissions?.has(code)));
  return {
    education: module('student') && permission('people:read', 'people:manage'),
    labor: module('worker') && permission('people:read', 'people:manage'),
    retail: module('retail') && permission('pos:manage', 'retail:manage'),
    partners: module('worker') && module('partner') && permission('labor-partner:read', 'labor-partner:manage'),
    hr: module('hr') && permission('hr:read'),
    inventory: module('inventory') && permission('inventory:read'),
    repair: module('repair') && permission('repair:read', 'repair:manage'),
    finance: module('finance') && permission('finance-receivable:read', 'finance-receivable:manage'),
    customer: module('customer') && permission('customer:read', 'customer:manage'),
  };
}

/** Inclusive date ranges, with an equally long, immediately preceding comparison. */
export function overviewComparison(range: DashboardRange) {
  const duration = range.end.getTime() - range.start.getTime() + 1;
  return { start: new Date(range.start.getTime() - duration), end: new Date(range.start.getTime() - 1) };
}

type AggregateTotal = { _id?: unknown; value: number };
const amount = (rows: AggregateTotal[]) => rows[0]?.value || 0;
const pointRows = (rows: Array<{ _id: string; value: number }>): OverviewPoint[] => rows.map(row => ({ date: row._id, value: row.value }));
const dateGroup = (field: string) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'Asia/Ho_Chi_Minh' } });
const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

async function education(user: DashboardUser, range: DashboardRange): Promise<NonNullable<BusinessOverview['education']>> {
  // Reuse the module's ownership policy; never accept owner/company filters from the browser.
  const owner = await getAllowedOwnerIds({ uid: user.id, role: user.role, centerId: user.companyCode!, companyCode: user.companyCode, branchId: user.branchId });
  const ownerIds = owner === 'ALL'
    ? [...(await UserModel.find({ companyCode: user.companyCode }).select('_id').lean()).map(row => String(row._id)), user.companyCode!]
    : Array.isArray(owner) ? owner : [owner];
  const query = { ownerId: { $in: [...new Set(ownerIds)] }, ...(user.branchId ? { branchId: user.branchId } : {}) };
  const previous = overviewComparison(range);
  const today = parseBusinessDate(businessDateKey(new Date()))!;
  const yesterday = new Date(today.getTime() - 86400000);
  const tomorrow = new Date(today.getTime() + 86400000);
  const [students, newStudents, activeClasses, payments, oldPayments, series, classes, topClasses, missingTeachers, unpaidStudents, dailyTuition] = await Promise.all([
    Student.countDocuments(query), Student.countDocuments({ ...query, createdAt: { $gte: range.start, $lte: range.end } }),
    Batch.countDocuments({ ...query, status: 'Đang học' }),
    Payment.aggregate<AggregateTotal>([{ $match: { ...query, paidOn: { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, value: { $sum: '$amount' } } }]),
    Payment.aggregate<AggregateTotal>([{ $match: { ...query, paidOn: { $gte: previous.start, $lte: previous.end } } }, { $group: { _id: null, value: { $sum: '$amount' } } }]),
    Payment.aggregate<{ _id: string; value: number }>([{ $match: { ...query, paidOn: { $gte: range.start, $lte: range.end } } }, { $group: { _id: dateGroup('$paidOn'), value: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    Batch.aggregate<{ _id: string; value: number }>([{ $match: query }, { $group: { _id: '$status', value: { $sum: 1 } } }]),
    Batch.find({ ...query, status: { $in: ['Đang học', 'Sắp khai giảng'] } }).select('code name status learnerIds quota').sort({ createdAt: -1 }).limit(5).lean(),
    Batch.countDocuments({ ...query, status: 'Đang học', $and: [{ $or: [{ instructorId: null }, { instructorId: '' }] }, { $or: [{ instructorText: null }, { instructorText: '' }] }] }),
    Student.countDocuments({ ...query, installmentStatus: { $elemMatch: { status: { $ne: 'Đã thu' }, amountDue: { $gt: 0 } } } }),
    Payment.aggregate<{ _id: 'today' | 'yesterday'; value: number }>([
      { $match: { ...query, paidOn: { $gte: yesterday, $lt: tomorrow } } },
      { $group: { _id: { $cond: [{ $gte: ['$paidOn', today] }, 'today', 'yesterday'] }, value: { $sum: '$amount' } } },
    ]),
  ]);
  return { students, newStudents, activeClasses, tuition: amount(payments), previousTuition: amount(oldPayments), todayTuition: dailyTuition.find(row => row._id === 'today')?.value || 0, yesterdayTuition: dailyTuition.find(row => row._id === 'yesterday')?.value || 0, series: pointRows(series),
    classes: classes.map(row => ({ label: row._id, value: row.value })),
    topClasses: topClasses.map(row => ({ id: String(row._id), name: row.name || row.code, status: row.status, allocated: row.learnerIds?.length || 0, quota: row.quota || 0 })), missingTeachers, unpaidStudents };
}

async function labor(query: Record<string, unknown>, range: DashboardRange): Promise<NonNullable<BusinessOverview['labor']>> {
  const live = { ...query, deletedAt: null };
  // Project branch IDs are ObjectIds; aggregation does not perform Mongoose query casting.
  const projectQuery = { ...live, ...(query.branchId ? { branchId: new Types.ObjectId(String(query.branchId)) } : {}) };
  const previous = overviewComparison(range);
  const [workers, newWorkers, previousNewWorkers, statuses, activeProjects, series, projectRows] = await Promise.all([
    WorkerModel.countDocuments(live), WorkerModel.countDocuments({ ...live, createdAt: { $gte: range.start, $lte: range.end } }),
    WorkerModel.countDocuments({ ...live, createdAt: { $gte: previous.start, $lte: previous.end } }),
    WorkerModel.aggregate<{ _id: string; value: number }>([{ $match: live }, { $group: { _id: '$status', value: { $sum: 1 } } }]),
    WorkerProjectModel.countDocuments({ ...projectQuery, status: 'active' }),
    WorkerModel.aggregate<{ _id: string; value: number }>([{ $match: { ...live, createdAt: { $gte: range.start, $lte: range.end } } }, { $group: { _id: dateGroup('$createdAt'), value: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    WorkerProjectModel.aggregate<{ unfilled: Array<{ value: number }>; projects: Array<{ _id: Types.ObjectId; name: string; status: string; allocated: number; quota: number }> }>([
      { $match: { ...projectQuery, status: { $in: ['active', 'planned'] } } },
      { $project: { name: 1, status: 1, createdAt: 1, quota: { $ifNull: ['$quota', 0] }, allocated: { $size: { $ifNull: ['$workerIds', []] } } } },
      { $addFields: { missing: { $max: [{ $subtract: ['$quota', '$allocated'] }, 0] } } },
      { $facet: {
        unfilled: [{ $match: { missing: { $gt: 0 } } }, { $count: 'value' }],
        projects: [{ $sort: { missing: -1, createdAt: -1, _id: 1 } }, { $limit: 5 }, { $project: { name: 1, status: 1, allocated: 1, quota: 1 } }],
      } },
    ]),
  ]);
  const count = (status: string) => statuses.find(row => row._id === status)?.value || 0;
  const top = (projectRows[0]?.projects || []).map(row => ({ id: String(row._id), name: row.name, status: row.status === 'active' ? 'Đang triển khai' : 'Sắp triển khai', allocated: row.allocated, quota: row.quota }));
  return { workers, newWorkers, previousNewWorkers, activeWorkers: count('active'), placedWorkers: count('placed'), activeProjects,
    series: pointRows(series), statuses: [{ label: 'Đang hoạt động', value: count('active') }, { label: 'Đã bố trí', value: count('placed') }, { label: 'Ngừng hoạt động', value: count('inactive') }],
    unfilledProjects: projectRows[0]?.unfilled[0]?.value || 0, topProjects: top };
}

export async function getBusinessOverview(user: DashboardUser, range: DashboardRange): Promise<BusinessOverview> {
  if (!user.companyCode) throw new Error('Thiếu phạm vi doanh nghiệp.');
  const company = await CompanyModel.findOne({ code: user.companyCode }).select('businessType').lean();
  if (!company) throw new Error('Không tìm thấy doanh nghiệp.');
  const query = { companyCode: user.companyCode, ...(user.branchId ? { branchId: user.branchId } : {}) };
  const access = overviewAccess(user);
  const businessType = company.businessType === 'labor' ? 'labor' : 'education';
  const preferred = businessType === 'labor' ? 'labor' : 'education';
  const alternative = preferred === 'labor' ? 'education' : 'labor';
  const primary = access[preferred] ? preferred : access[alternative] ? alternative : access.retail ? 'retail' : null;
  // Business type selects priority, while independently enabled/authorized modules determine availability.
  const result: BusinessOverview = { businessType, primary, range: { from: dateKey(range.start), to: dateKey(range.end) }, generatedAt: new Date().toISOString(), access, errors: [], education: null, labor: null, retail: null, partners: null, hr: null, inventory: null, repair: null, finance: null, customer: null };
  const read = async <K extends OverviewSection>(key: K, load: () => Promise<BusinessOverview[K]>) => {
    if (!access[key]) return;
    if ((key === 'education' || key === 'labor') && key !== primary) return;
    try { result[key] = await load(); }
    catch (error) { console.error(`[business-overview:${key}]`, error); result.errors.push(key); }
  };
  await Promise.all([
    read('education', () => education(user, range)), read('labor', () => labor(query, range)),
    read('retail', () => getRetailBusinessOverview(query, range)),
    read('partners', async () => {
      const [active, pendingSettlements, totals] = await Promise.all([
        LaborPartnerModel.countDocuments({ ...query, deletedAt: null, status: 'active' }),
        LaborPartnerSettlementModel.countDocuments({ ...query, status: { $in: ['draft', 'calculated'] } }),
        LaborPartnerSettlementModel.aggregate<AggregateTotal>([{ $match: { ...query, status: { $in: ['approved', 'partially_paid'] } } }, { $group: { _id: null, value: { $sum: '$balanceAmount' } } }]),
      ]);
      return { active, pendingSettlements, payable: amount(totals) };
    }),
    read('hr', async () => {
      const timekeeping = user.role === 'superadmin' || user.permissions?.has('*') || user.permissions?.has('timekeeping:read');
      const [employees, projects, personnel, attendance] = await Promise.all([
        UserModel.countDocuments({ ...query, role: { $ne: 'superadmin' } }), getProjectStats(query, range), getPersonnelNow(user), timekeeping ? getTimekeepingStats(user) : null,
      ]);
      return { employees, checkedIn: attendance?.checkedInToday ?? null, late: attendance?.lateToday ?? null, approvedLeave: attendance?.onApprovedLeaveToday ?? null, absent: attendance?.absentWithoutLeave ?? null, contracts: personnel.expiringContracts.map(contract => ({ id: contract.id, employeeName: contract.employeeName, endDate: new Date(contract.endDate).toISOString() })), tasks: projects.tasks, overdueTasks: projects.overdueTasks, pendingApprovals: personnel.pendingApprovalCount, expiringContracts: personnel.expiringContractCount };
    }),
    read('inventory', async () => {
      const [totals, lowStock] = await Promise.all([
        InventoryBalanceModel.aggregate<AggregateTotal>([{ $match: query }, { $group: { _id: null, value: { $sum: '$quantity' } } }]),
        InventoryBalanceModel.countDocuments({ ...query, minStock: { $gt: 0 }, $expr: { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$minStock'] } }),
      ]);
      return { quantity: amount(totals), lowStock };
    }),
    read('repair', async () => {
      const open = { ...query, status: { $nin: ['delivered', 'cancelled', 'returned'] as const } };
      const [count, overdue, waitingParts] = await Promise.all([RepairTicketModel.countDocuments(open), RepairTicketModel.countDocuments({ ...open, promisedAt: { $lt: new Date() } }), RepairTicketModel.countDocuments({ ...query, status: 'waiting_parts' })]);
      return { open: count, overdue, waitingParts };
    }),
    read('finance', async () => {
      const today = new Date(`${dateKey(new Date())}T00:00:00+07:00`);
      const rows = await ReceivableModel.aggregate<{ _id: null; value: number; overdue: number }>([{ $match: { ...query, status: { $in: ['open', 'partially_paid'] } } }, { $group: { _id: null, value: { $sum: '$balance' }, overdue: { $sum: { $cond: [{ $lt: ['$dueDate', today] }, '$balance', 0] } } } }]);
      return { receivable: amount(rows), overdue: rows[0]?.overdue || 0 };
    }),
    read('customer', async () => ({ total: await CustomerModel.countDocuments({ ...query, status: 'active' }), newCustomers: await CustomerModel.countDocuments({ ...query, createdAt: { $gte: range.start, $lte: range.end } }) })),
  ]);
  return result;
}
