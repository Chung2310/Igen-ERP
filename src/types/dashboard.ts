export type DashboardDateFilter = "day" | "week" | "year" | "custom";

/** Kết quả GET /api/v1/dashboard/summary — số liệu tổng hợp tất cả module */
export interface DashboardSummary {
  range: {
    start: string;
    end: string;
    filter: string;
  };
  projects: {
    activeProjects: number;
    tasks: {
      todo: number;
      doing: number;
      done: number;
      total: number;
    };
    overdueTasks: number;
  };
  students: {
    totalStudents: number;
    newStudents: number;
    tuitionRevenue: number;
    paymentCount: number;
    outstandingDebt: number;
    activeCourses: number;
    activeBatches: number;
    expiringStudentCount?: number;
    unpaidStudentCount?: number;
    revenueToday?: number;
  };
  batches?: {
    activeCount: number;
    openingTodayCount: number;
    endingSoonCount: number;
    missingInstructorCount: number;
    frequentAbsentStudents: number;
  };
  instructors?: {
    onLeaveToday: number;
    onLeaveTodayNames: string[];
  };
  timekeeping: {
    checkedInToday: number;
    lateToday: number;
    totalEmployees: number;
    date: string;
    onApprovedLeaveToday?: number;
    absentWithoutLeave?: number;
  };
  receivables?: {
    overdueAmount: number;
    overdueCount: number;
    dueTodayAmount: number;
    collectedTodayAmount: number;
  };
  chat: {
    unreadMessages: number;
    roomCount: number;
  };
  resources: {
    fileCount: number;
    recentUploads: number;
    totalSize: number;
  };
  training: {
    totalCourses: number;
    ongoingCourses: number;
    enrollments: {
      notStarted: number;
      inProgress: number;
      completed: number;
      total: number;
    };
  };
}

/** Kết quả GET /api/v1/dashboard/action-items — việc cần xử lý hôm nay */
export interface DashboardActionItems {
  overdueTasks: { id: string; title: string; dueDate: string }[];
  pendingApprovals: { id: string; type: "leave"; employeeName: string; since: string }[];
  lowStockAlerts: { id: string; name: string; sku: string; stock: number; minStockAlert: number }[];
}
