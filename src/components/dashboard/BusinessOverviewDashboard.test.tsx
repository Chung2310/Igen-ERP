// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BusinessOverview } from '../../../shared/business-overview';
import { BusinessOverviewDashboard } from './BusinessOverviewDashboard';
import { buildOverviewSeries } from './businessOverviewCharts';
import { businessOverviewPresentation } from './businessOverviewPresentation';

afterEach(cleanup);
const fixture = (): BusinessOverview => ({
  businessType: 'education', range: { from: '2026-10-01', to: '2026-10-28' }, generatedAt: '2026-10-28T08:00:00Z',
  access: { education: true, labor: true, retail: false, partners: false, hr: false, inventory: false, repair: false, finance: false, customer: false }, errors: [],
  education: { students: 120, newStudents: 12, activeClasses: 4, tuition: 15000000, previousTuition: 10000000, todayTuition: 1000000, yesterdayTuition: 800000, series: [{ date: '2026-10-03', value: 15000000 }], classes: [{ label: 'Đang học', value: 4 }], topClasses: [{ id: 'b1', name: 'Lớp tiếng Anh', status: 'Đang học', allocated: 12, quota: 20 }], missingTeachers: 1, unpaidStudents: 8 },
  labor: { workers: 300, newWorkers: 20, previousNewWorkers: 10, activeWorkers: 250, placedWorkers: 30, activeProjects: 8, series: [{ date: '2026-10-01', value: 20 }], statuses: [{ label: 'Đang hoạt động', value: 250 }], topProjects: [{ id: 'p1', name: 'Dự án may mặc', status: 'Đang triển khai', allocated: 25, quota: 50 }], unfilledProjects: 2 },
  partners: null, hr: null, inventory: null, repair: null, finance: null, customer: null,
});
const withHr = (): BusinessOverview => {
  const data = fixture(); data.access.hr = true;
  data.hr = { employees: 48, checkedIn: 43, late: 2, approvedLeave: 3, absent: 2, contracts: [{ id: 'c1', employeeName: 'Nguyễn Văn An', endDate: '2026-11-01T00:00:00+07:00' }], tasks: { todo: 3, doing: 4, done: 5, total: 12 }, overdueTasks: 0, pendingApprovals: 0, expiringContracts: 1 };
  return data;
};
const withRetail = (): BusinessOverview => {
  const data = fixture(); data.access.retail = true;
  data.retail = { todaySales: 3000000, yesterdaySales: 2000000, netSales: 15000000, previousSales: 12000000, orderCount: 14, refunds: 500000, series: [{ date: '2026-10-03', value: 15000000 }], products: Array.from({ length: 7 }, (_, index) => ({ productId: 'product-' + index, sku: 'SKU-' + index, productName: 'Sản phẩm ' + (index + 1), netSales: (7 - index) * 100000 })) };
  return data;
};

describe('business dashboard content', () => {
  it('renders education content even when the worker module is also available, and links to the actual education route', () => {
    render(<BusinessOverviewDashboard data={fixture()} loading={false} businessType="education" onRetry={vi.fn()} />);
    const kpis = within(screen.getByRole('region', { name: 'Chỉ số chính' }));
    expect(kpis.getByText('Học phí thực thu')).toBeTruthy();
    expect(kpis.queryByText('Tổng lao động')).toBeNull();
    fireEvent.click(kpis.getByRole('button', { name: /Tổng học viên/ }));
    expect(location.pathname + location.search).toBe('/quan-ly-hoc-vien?sub=hoc-vien');
    expect(screen.getByText('Lớp tiếng Anh')).toBeTruthy();
  });
  it('shows labor projects and partner payable without labeling commissions as revenue', () => {
    const data = fixture(); data.partners = { active: 5, payable: 4500000, pendingSettlements: 2 }; data.access.partners = true;
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="labor" onRetry={vi.fn()} />);
    expect(screen.getByText('Tổng lao động')).toBeTruthy();
    expect(screen.getByText('Đối tác hoạt động')).toBeTruthy();
    expect(screen.getByText('Còn phải chi đối tác')).toBeTruthy();
    expect(screen.queryByText('Học phí thực thu')).toBeNull();
    expect(screen.getByText('Dự án may mặc')).toBeTruthy();
    expect(screen.queryByText('Doanh thu tháng')).toBeNull();
  });
  it('keeps permitted operations usable without access to HR or the primary module', () => {
    const data = fixture(); data.education = null; data.labor = null;
    data.inventory = { quantity: 38, lowStock: 2 };
    data.access.inventory = true;
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.getByText('Tổng tồn kho')).toBeTruthy();
    expect(screen.queryByText('Nhân sự hôm nay')).toBeNull();
    expect(screen.queryByText('Khoản phải thu')).toBeNull();
  });
  it('reports a failed section while keeping other data, and retries on request', () => {
    const data = fixture(); data.education = null; data.labor = null; data.errors = ['education']; data.inventory = { quantity: 38, lowStock: 0 }; data.access.inventory = true;
    const retry = vi.fn();
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={retry} />);
    expect(screen.getByRole('alert').textContent).toContain('Học viên & học phí');
    expect(screen.queryByText('Tổng học viên')).toBeNull();
    expect(screen.getByText('Tổng tồn kho')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); expect(retry).toHaveBeenCalledOnce();
  });
  it('announces loading without zero-value KPI cards', () => {
    render(<BusinessOverviewDashboard data={null} loading businessType="labor" onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Chỉ số chính' })).toBeNull();
  });
  it('puts cross-module KPIs above the analysis row and keeps the three HR panels separate', () => {
    const data = withHr(); data.access.inventory = true; data.inventory = { quantity: 38, lowStock: 0 };
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    const kpis = within(screen.getByRole('region', { name: 'Chỉ số chính' }));
    expect(kpis.getAllByRole('button')).toHaveLength(5);
    for (const label of ['Học phí hôm nay', 'Học phí hôm qua', 'Tổng tồn kho', 'Nhân sự hôm nay', 'Học phí thực thu']) expect(kpis.getByText(label)).toBeTruthy();
    const analysis = within(screen.getByRole('region', { name: 'Phân tích và cảnh báo' }));
    for (const label of ['Tổng quan học phí thực thu', 'Tình hình lớp học', 'Cảnh báo & nhắc việc']) expect(analysis.getByRole('heading', { name: label })).toBeTruthy();
    const hr = within(screen.getByRole('region', { name: 'Điều hành nhân sự' }));
    for (const label of ['Hợp đồng & cảnh báo đến hạn', 'Tiến độ công việc', 'Tổng hợp chấm công']) expect(hr.getByRole('heading', { name: label })).toBeTruthy();
    expect(hr.getByText('Nguyễn Văn An')).toBeTruthy();
  });
  it('hides disabled modules and attendance details that were not authorized', () => {
    const data = withHr(); data.hr!.checkedIn = null; data.hr!.late = null;
    data.inventory = { quantity: 999, lowStock: 999 }; data.access.inventory = false;
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.queryByText('Tổng tồn kho')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tổng hợp chấm công' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tiến độ công việc' })).toBeTruthy();
  });
  it('keeps an enabled secondary module usable when the business-type primary module is absent', () => {
    const data = fixture(); data.primary = 'labor'; data.education = null; data.access.education = false;
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.getByText('Tổng lao động')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cơ cấu lao động' })).toBeTruthy();
    expect(screen.queryByText('Học phí hôm nay')).toBeNull();
  });
  it('shows healthy module states and expands the alert list on request', () => {
    const data = withHr(); data.hr!.expiringContracts = 0; data.education!.missingTeachers = 0;
    data.access.inventory = true; data.inventory = { quantity: 38, lowStock: 0 };
    data.access.repair = true; data.repair = { open: 0, overdue: 0, waitingParts: 0 };
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.getByText('Không có việc quá hạn')).toBeTruthy();
    const alerts = screen.getByRole('heading', { name: 'Cảnh báo & nhắc việc' }).closest('section')!;
    fireEvent.click(within(alerts).getByRole('button', { name: 'Xem tất cả' }));
    expect(within(alerts).getByRole('button', { name: 'Thu gọn' }).getAttribute('aria-expanded')).toBe('true');
    expect(within(alerts).getByText('Không có phiếu sửa quá hẹn')).toBeTruthy();
  });
  it('uses sales KPIs and top products when POS is the active primary module', () => {
    const data = withRetail(); data.primary = 'retail'; data.education = null; data.labor = null;
    data.access.education = false; data.access.labor = false;
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.getByText('Doanh số hôm nay')).toBeTruthy();
    expect(screen.getByText('Doanh số hôm qua')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tổng quan doanh số bán hàng' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sản phẩm bán chạy' })).toBeTruthy();
    expect(screen.getByText('Khác')).toBeTruthy();
    expect(screen.queryByText('Học phí hôm nay')).toBeNull();
  });
  it('keeps tuition and POS sales separate when both modules are active', () => {
    const data = withRetail(); data.primary = 'education';
    const first = render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Tổng quan học phí thực thu' })).toBeTruthy();
    expect(screen.getByText('Doanh số bán hàng trong kỳ')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sản phẩm bán chạy' })).toBeTruthy();
    first.unmount(); data.access.retail = false;
    render(<BusinessOverviewDashboard data={data} loading={false} businessType="education" onRetry={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Sản phẩm bán chạy' })).toBeNull();
    expect(screen.queryByText('Doanh số bán hàng trong kỳ')).toBeNull();
  });
});

it('selects labor KPIs from the active modules without introducing education revenue', () => {
  const data = withHr(); data.primary = 'labor'; data.businessType = 'labor'; data.access.inventory = true; data.inventory = { quantity: 38, lowStock: 0 };
  const view = businessOverviewPresentation(data, 'labor');
  expect(view.metrics.map(row => row.label)).toEqual(['Tổng lao động', 'Hồ sơ tạo mới', 'Tổng tồn kho', 'Nhân sự hôm nay', 'Dự án đang triển khai']);
  expect(view.metrics.some(row => row.money)).toBe(false);
});

it('fills daily gaps and excludes values outside the exact selected range', () => {
  expect(buildOverviewSeries([{ date: '2026-10-01', value: 8 }, { date: '2026-10-03', value: 5 }, { date: '2026-11-01', value: 99 }], '2026-10-01', '2026-10-03')).toEqual([{ date: '2026-10-01', value: 8 }, { date: '2026-10-02', value: 0 }, { date: '2026-10-03', value: 5 }]);
  expect(buildOverviewSeries([{ date: '2026-01-02', value: 8 }, { date: '2026-02-10', value: 4 }], '2026-01-01', '2026-12-31').slice(0, 2)).toEqual([{ date: '2026-01', value: 8 }, { date: '2026-02', value: 4 }]);
});
