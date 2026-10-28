export type OverviewSection = 'education' | 'labor' | 'retail' | 'partners' | 'hr' | 'inventory' | 'repair' | 'finance' | 'customer';
export type OverviewPoint = { date: string; value: number };
export type OverviewStatus = { label: string; value: number };
export type OverviewProject = { id: string; name: string; status: string; allocated: number; quota: number };

export interface BusinessOverview {
  businessType: 'education' | 'labor';
  primary?: 'education' | 'labor' | 'retail' | null;
  range: { from: string; to: string };
  generatedAt: string;
  access: Record<OverviewSection, boolean>;
  errors: OverviewSection[];
  education: null | {
    students: number; newStudents: number; activeClasses: number; tuition: number; previousTuition: number;
    todayTuition?: number; yesterdayTuition?: number;
    series: OverviewPoint[]; classes: OverviewStatus[]; topClasses: OverviewProject[];
    missingTeachers: number; unpaidStudents: number;
  };
  labor: null | {
    workers: number; newWorkers: number; previousNewWorkers: number; activeWorkers: number; placedWorkers: number; activeProjects: number;
    series: OverviewPoint[]; statuses: OverviewStatus[]; topProjects: OverviewProject[]; unfilledProjects: number;
  };
  retail?: null | {
    todaySales: number; yesterdaySales: number; netSales: number; previousSales: number; orderCount: number; refunds: number;
    series: OverviewPoint[];
    products: Array<{ productId: string; sku: string; productName: string; netSales: number }>;
  };
  partners: null | { active: number; payable: number; pendingSettlements: number };
  hr: null | {
    employees: number; checkedIn: number | null; late: number | null;
    approvedLeave?: number | null; absent?: number | null;
    contracts?: Array<{ id: string; employeeName: string; endDate: string }>;
    tasks: { todo: number; doing: number; done: number; total: number };
    overdueTasks: number; pendingApprovals: number; expiringContracts: number;
  };
  inventory: null | { quantity: number; lowStock: number };
  repair: null | { open: number; overdue: number; waitingParts: number };
  finance: null | { receivable: number; overdue: number };
  customer: null | { total: number; newCustomers: number };
}
