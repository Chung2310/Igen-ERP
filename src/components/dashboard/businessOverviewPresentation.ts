import type { BusinessOverview, OverviewSection } from '../../../shared/business-overview';

export type DashboardMetric = {
  id: string; icon: 'people' | 'money' | 'book' | 'project' | 'receipt' | 'partner' | 'stock' | 'repair' | 'check';
  label: string; value: number; total?: number; money?: boolean; detail: string; href: string; change?: number | null;
};
export type DashboardAlert = { id: string; label: string; healthyLabel: string; detail: string; healthyDetail: string; value: number; href: string };

export const overviewDestinations = {
  students: '/quan-ly-hoc-vien?sub=hoc-vien', classes: '/quan-ly-hoc-vien?sub=lop-hoc', tuition: '/quan-ly-hoc-vien?sub=hoc-phi',
  workers: '/quan-ly-lao-dong?sub=lao-dong', projects: '/quan-ly-lao-dong?sub=du-an', partners: '/doi-tac-lao-dong',
  hr: '/nhan-su?sub=kanban', attendance: '/nhan-su?sub=lich&section=attendance', contracts: '/nhan-su?sub=hop-dong', requests: '/nhan-su?sub=lich&section=requests',
  inventory: '/kho-san-pham', repair: '/sua-chua-bao-hanh', finance: '/tai-chinh', customers: '/quan-ly-khach-hang',
  retail: '/ban-le',
};

export function businessOverviewPresentation(input: BusinessOverview, businessType: 'education' | 'labor') {
  // The server remains authoritative; also avoid displaying a retired section from a stale payload.
  const allowed = <K extends OverviewSection>(key: K) => input.access[key] ? input[key] : null;
  const data = { ...input, education: allowed('education'), labor: allowed('labor'), retail: allowed('retail'), partners: allowed('partners'), hr: allowed('hr'), inventory: allowed('inventory'), repair: allowed('repair'), finance: allowed('finance'), customer: allowed('customer') };
  const primary = input.primary === undefined
    ? businessType === 'labor' ? data.labor ? 'labor' : data.education ? 'education' : data.retail ? 'retail' : null : data.education ? 'education' : data.labor ? 'labor' : data.retail ? 'retail' : null
    : input.primary;
  const education = primary === 'education' ? data.education : null;
  const labor = primary === 'labor' ? data.labor : null;
  const retail = primary === 'retail' ? data.retail : null;
  const href = overviewDestinations;
  const change = (current: number, previous: number) => previous > 0 ? Math.round((current - previous) / previous * 100) : null;
  const stock: DashboardMetric | null = data.inventory ? { id: 'stock', icon: 'stock', label: 'Tổng tồn kho', value: data.inventory.quantity, detail: 'Số lượng hiện có trong kho', href: href.inventory } : null;
  const attendance: DashboardMetric | null = data.hr ? data.hr.checkedIn != null
    ? { id: 'attendance', icon: 'people', label: 'Nhân sự hôm nay', value: data.hr.checkedIn, total: data.hr.employees, detail: 'Đã chấm công / tổng nhân sự', href: href.attendance }
    : { id: 'employees', icon: 'people', label: 'Nhân sự', value: data.hr.employees, detail: 'Trong phạm vi đang xem', href: '/nhan-su' } : null;
  const operations: DashboardMetric[] = [
    ...(stock ? [stock] : []),
    ...(data.repair ? [{ id: 'repairs', icon: 'repair' as const, label: 'Phiếu chưa giao khách', value: data.repair.open, detail: `${data.repair.waitingParts.toLocaleString('vi-VN')} phiếu chờ linh kiện`, href: href.repair }] : []),
    ...(data.finance ? [{ id: 'receivable', icon: 'money' as const, label: 'Khoản phải thu', value: data.finance.receivable, money: true, detail: 'Công nợ hiện tại', href: href.finance }] : []),
    ...(data.partners ? [{ id: 'payable', icon: 'partner' as const, label: 'Còn phải chi đối tác', value: data.partners.payable, money: true, detail: 'Từ các kỳ đối soát đã duyệt', href: href.partners }] : []),
    ...(data.customer ? [{ id: 'customers', icon: 'people' as const, label: 'Khách hàng hoạt động', value: data.customer.total, detail: `${data.customer.newCustomers.toLocaleString('vi-VN')} khách hàng tạo mới trong kỳ`, href: href.customers }] : []),
    ...(data.retail ? [
      { id: 'retail-period', icon: 'money' as const, label: 'Doanh số bán hàng trong kỳ', value: data.retail.netSales, money: true, detail: 'Sau giảm giá và hoàn trả · nguồn POS', href: href.retail },
      { id: 'retail-orders', icon: 'receipt' as const, label: 'Đơn bán trong kỳ', value: data.retail.orderCount, detail: 'Số liệu từ báo cáo bán hàng', href: href.retail },
    ] : []),
  ];
  let candidates: Array<DashboardMetric | null> = [];
  if (education) {
    const students: DashboardMetric = { id: 'students', icon: 'people', label: 'Tổng học viên', value: education.students, detail: 'Hồ sơ hiện có', href: href.students };
    const newStudents: DashboardMetric = { id: 'new-students', icon: 'people', label: 'Học viên mới', value: education.newStudents, detail: 'Hồ sơ tạo trong kỳ', href: href.students };
    const classes: DashboardMetric = { id: 'classes', icon: 'book', label: 'Lớp đang học', value: education.activeClasses, detail: 'Trạng thái hiện tại', href: href.classes };
    const fees: DashboardMetric = { id: 'fees', icon: 'money', label: 'Học phí thực thu', value: education.tuition, money: true, detail: education.previousTuition > 0 ? 'so với kỳ liền trước' : 'Chưa có cơ sở so sánh', href: href.tuition, change: change(education.tuition, education.previousTuition) };
    const daily = typeof education.todayTuition === 'number' && typeof education.yesterdayTuition === 'number';
    candidates = daily ? [
      { id: 'fees-today', icon: 'money', label: 'Học phí hôm nay', value: education.todayTuition!, money: true, detail: education.yesterdayTuition! > 0 ? 'so với hôm qua' : 'Chưa có cơ sở so sánh', href: href.tuition, change: change(education.todayTuition!, education.yesterdayTuition!) },
      { id: 'fees-yesterday', icon: 'receipt', label: 'Học phí hôm qua', value: education.yesterdayTuition!, money: true, detail: 'Thực thu trong ngày hôm qua', href: href.tuition },
      stock || students, attendance || classes, fees,
    ] : [students, newStudents, stock || classes, attendance || { id: 'unpaid-students', icon: 'receipt', label: 'Học viên còn học phí', value: education.unpaidStudents, detail: 'Còn kỳ học phí chưa thu', href: href.tuition }, fees];
  } else if (labor) {
    const projects: DashboardMetric = { id: 'projects', icon: 'project', label: 'Dự án đang triển khai', value: labor.activeProjects, detail: `${labor.unfilledProjects.toLocaleString('vi-VN')} dự án chưa đủ chỉ tiêu`, href: href.projects };
    const placed: DashboardMetric = { id: 'placed', icon: 'check', label: 'Đã bố trí', value: labor.placedWorkers, detail: 'Trạng thái hiện tại', href: href.workers };
    candidates = [
      { id: 'workers', icon: 'people', label: 'Tổng lao động', value: labor.workers, detail: 'Hồ sơ hiện có', href: href.workers },
      { id: 'new-workers', icon: 'receipt', label: 'Hồ sơ tạo mới', value: labor.newWorkers, detail: labor.previousNewWorkers > 0 ? 'so với kỳ liền trước' : 'Chưa có cơ sở so sánh', href: href.workers, change: change(labor.newWorkers, labor.previousNewWorkers) },
      stock || placed, attendance || projects,
      attendance ? projects : data.partners ? { id: 'partners', icon: 'partner', label: 'Đối tác hoạt động', value: data.partners.active, detail: 'Đối tác cung ứng lao động', href: href.partners } : { id: 'active-workers', icon: 'people', label: 'Đang hoạt động', value: labor.activeWorkers, detail: 'Trạng thái hiện tại', href: href.workers },
    ];
  } else if (retail) {
    candidates = [
      { id: 'sales-today', icon: 'money', label: 'Doanh số hôm nay', value: retail.todaySales, money: true, detail: retail.yesterdaySales > 0 ? 'so với hôm qua' : 'Chưa có cơ sở so sánh', href: href.retail, change: change(retail.todaySales, retail.yesterdaySales) },
      { id: 'sales-yesterday', icon: 'receipt', label: 'Doanh số hôm qua', value: retail.yesterdaySales, money: true, detail: 'Sau giảm giá và hoàn trả', href: href.retail },
      stock || { id: 'retail-orders', icon: 'receipt', label: 'Đơn bán trong kỳ', value: retail.orderCount, detail: 'Số liệu từ báo cáo bán hàng', href: href.retail },
      attendance || (data.customer ? { id: 'customers', icon: 'people', label: 'Khách hàng hoạt động', value: data.customer.total, detail: 'Trong phạm vi đang xem', href: href.customers } : { id: 'retail-refunds', icon: 'receipt', label: 'Hoàn trả trong kỳ', value: retail.refunds, money: true, detail: 'Hoàn trả của các đơn trong báo cáo', href: href.retail }),
      { id: 'retail-period', icon: 'money', label: 'Doanh số bán hàng trong kỳ', value: retail.netSales, money: true, detail: retail.previousSales > 0 ? 'so với kỳ liền trước' : 'Chưa có cơ sở so sánh', href: href.retail, change: change(retail.netSales, retail.previousSales) },
    ];
  } else candidates = [stock, attendance, ...operations];
  const ids = new Set<string>();
  const metrics = candidates.filter((metric): metric is DashboardMetric => {
    if (!metric || ids.has(metric.id)) return false;
    ids.add(metric.id); return true;
  }).slice(0, 5);
  const remainingOperations = operations.filter(metric => !metrics.some(top => top.id === metric.id));
  const alerts: DashboardAlert[] = [];
  if (education) alerts.push({ id: 'teachers', label: 'Lớp chưa có giảng viên', healthyLabel: 'Lớp học đã có giảng viên', detail: 'Bổ sung phân công giảng dạy', healthyDetail: 'Các lớp đang học đã có phân công', href: href.classes, value: education.missingTeachers });
  if (labor) alerts.push({ id: 'quota', label: 'Dự án chưa đủ chỉ tiêu', healthyLabel: 'Dự án đủ chỉ tiêu', detail: 'Kiểm tra lao động đã bố trí', healthyDetail: 'Không có dự án thiếu lao động theo chỉ tiêu', href: href.projects, value: labor.unfilledProjects });
  if (data.hr) alerts.push(
    { id: 'overdue-tasks', label: 'Công việc quá hạn', healthyLabel: 'Không có việc quá hạn', detail: 'Công việc tạo trong kỳ', healthyDetail: 'Các công việc trong kỳ đang đúng hạn', href: href.hr, value: data.hr.overdueTasks },
    { id: 'contracts', label: 'Hợp đồng nhân sự sắp hết hạn', healthyLabel: 'Không có hợp đồng sắp hết hạn', detail: 'Trong 30 ngày tới', healthyDetail: 'Chưa có hợp đồng đến hạn trong 30 ngày tới', href: href.contracts, value: data.hr.expiringContracts },
    { id: 'approvals', label: 'Đơn chờ duyệt', healthyLabel: 'Không có phiếu chờ', detail: 'Kiểm tra đề nghị của nhân sự', healthyDetail: 'Đã xử lý hết đề nghị', href: href.requests, value: data.hr.pendingApprovals },
  );
  if (data.partners) alerts.push({ id: 'settlements', label: 'Kỳ đối soát chờ xử lý', healthyLabel: 'Không có kỳ đối soát chờ', detail: 'Kỳ nháp hoặc đã tính, chưa duyệt', healthyDetail: 'Không còn kỳ nháp hoặc kỳ tính chờ duyệt', href: href.partners, value: data.partners.pendingSettlements });
  if (data.inventory) alerts.push({ id: 'stock', label: 'Mức tồn cần bổ sung', healthyLabel: 'Tồn kho trong ngưỡng', detail: 'Số dòng tồn kho chạm ngưỡng tối thiểu', healthyDetail: 'Không có dòng tồn kho chạm ngưỡng tối thiểu', href: href.inventory, value: data.inventory.lowStock });
  if (data.repair) alerts.push({ id: 'repair', label: 'Phiếu sửa chữa quá hẹn', healthyLabel: 'Không có phiếu sửa quá hẹn', detail: 'Chưa giao khách và đã quá hẹn trả', healthyDetail: 'Chưa có phiếu chưa giao khách bị quá hẹn', href: href.repair, value: data.repair.overdue });
  return { data, primary, education, labor, retail, metrics, operations: remainingOperations, alerts: alerts.sort((a, b) => Number(b.value > 0) - Number(a.value > 0)) };
}
