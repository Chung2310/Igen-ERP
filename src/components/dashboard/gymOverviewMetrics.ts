export interface GymDashboardCustomerRow {
  customerId: string;
  fullName: string;
  phone?: string;
  status?: string;
  initialGoal?: string;
  dataStatus: "READY" | "INSUFFICIENT_DATA";
  score: number | null;
  progressCategory: "GOOD" | "SLOW" | "POOR" | "INSUFFICIENT_DATA";
  measurementCount: number;
  changes?: {
    bodyFatChange: number;
    muscleChange: number;
    weightChange: number;
    daysBetween: number;
  } | null;
  openAlerts?: number;
  improvementTips?: string[];
}

export interface GymPeriodCount {
  current: number;
  previous: number | null;
}

export interface GymDashboardAnalytics {
  period: {
    from: string;
    to: string;
    previousFrom: string | null;
    previousTo: string | null;
  };
  periodMetrics: {
    newCustomers: GymPeriodCount;
    sessions: GymPeriodCount;
    measurements: GymPeriodCount;
  };
  summary: {
    attendanceRate: number | null;
    averageScore: number | null;
    averageBodyFatDelta: number | null;
    averageMuscleDelta: number | null;
    activePackages: number;
    expiringPackages: number;
    totalMeasurements: number;
    totalGoals: number;
    totalPackages: number;
    pendingTransfers: number;
  };
  activityTrend: Array<{
    date: string;
    label: string;
    sessions: number;
    measurements: number;
    newCustomers: number;
  }>;
  customerStatus: { ACTIVE: number; LEAD: number; INACTIVE: number };
  gender: { MALE: number; FEMALE: number; OTHER: number };
  attendance: { PRESENT: number; LATE: number; ABSENT: number };
  goalTypes: Record<string, number>;
  packageStatus: {
    ACTIVE: number;
    COMPLETED: number;
    EXPIRED: number;
    CANCELLED: number;
  };
  planCoverage: Array<{
    key: string;
    name: string;
    published: number;
    draft: number;
  }>;
  trainerWorkload: Array<{
    id: string;
    name: string;
    customers: number;
    sessions: number;
  }>;
}

export interface GymDashboardPayload {
  totalCustomers: number;
  customers: number;
  activeCustomers: number;
  sessions?: number;
  plans?: number;
  openAlerts: number;
  goodProgressCount: number;
  slowProgressCount: number;
  poorProgressCount: number;
  insufficientDataCount?: number;
  customerRows: GymDashboardCustomerRow[];
  canAdmin?: boolean;
  analytics?: GymDashboardAnalytics;
}

const GOAL_LABELS: Record<string, string> = {
  WEIGHT_LOSS: "Giảm cân",
  FAT_LOSS: "Giảm mỡ",
  MUSCLE_GAIN: "Tăng cơ",
  RECOMPOSITION: "Tăng cơ giảm mỡ",
  WEIGHT_GAIN: "Tăng cân",
  FITNESS: "Cải thiện thể lực",
};

export interface NamedCount {
  name: string;
  value: number;
}

export interface ScoreRow {
  customerId: string;
  name: string;
  score: number;
  bodyFatChange: number;
  muscleChange: number;
  daysBetween: number;
}

export interface GymOverviewViewModel {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: GymPeriodCount;
  sessionsInPeriod: GymPeriodCount;
  measurementsInPeriod: GymPeriodCount;
  goodProgress: number;
  attentionCount: number;
  attendanceRate: number | null;
  averageScore: number | null;
  averageBodyFatDelta: number | null;
  averageMuscleDelta: number | null;
  activePackages: number;
  expiringPackages: number;
  pendingTransfers: number;
  activityTrend: GymDashboardAnalytics["activityTrend"];
  progressDistribution: NamedCount[];
  customerStatus: NamedCount[];
  attendance: NamedCount[];
  goalTypes: NamedCount[];
  packageStatus: NamedCount[];
  gender: NamedCount[];
  planCoverage: GymDashboardAnalytics["planCoverage"];
  trainerWorkload: GymDashboardAnalytics["trainerWorkload"];
  topScores: ScoreRow[];
  attentionRows: GymDashboardCustomerRow[];
}

export function buildGymOverview(data: GymDashboardPayload): GymOverviewViewModel {
  const rows = data.customerRows ?? [];
  const analytics = data.analytics;
  const totalCustomers = data.totalCustomers ?? data.customers ?? rows.length;
  const activeCustomers = data.activeCustomers ?? rows.filter((r) => (r.status || "ACTIVE") === "ACTIVE").length;
  const goodProgress = data.goodProgressCount ?? 0;
  const slowProgress = data.slowProgressCount ?? 0;
  const poorProgress = data.poorProgressCount ?? 0;
  const insufficientData =
    data.insufficientDataCount ??
    rows.filter((r) => r.progressCategory === "INSUFFICIENT_DATA").length;

  const progressDistribution: NamedCount[] = [
    { name: "Tiến bộ tốt", value: goodProgress },
    { name: "Tiến bộ chậm", value: slowProgress },
    { name: "Cần quan tâm", value: poorProgress },
    { name: "Chưa đủ InBody", value: insufficientData },
  ].filter((item) => item.value > 0);

  const rawCustomerStatus = analytics?.customerStatus ?? {
    ACTIVE: activeCustomers,
    LEAD: rows.filter((r) => r.status === "LEAD").length,
    INACTIVE: rows.filter((r) => r.status === "INACTIVE").length,
  };
  const customerStatus: NamedCount[] = [
    { name: "Đang tập", value: rawCustomerStatus.ACTIVE },
    { name: "Tiềm năng", value: rawCustomerStatus.LEAD },
    { name: "Tạm ngưng", value: rawCustomerStatus.INACTIVE },
  ].filter((item) => item.value > 0);

  const rawAttendance = analytics?.attendance ?? { PRESENT: 0, LATE: 0, ABSENT: 0 };
  const attendance: NamedCount[] = [
    { name: "Có mặt", value: rawAttendance.PRESENT },
    { name: "Đi muộn", value: rawAttendance.LATE },
    { name: "Vắng mặt", value: rawAttendance.ABSENT },
  ].filter((item) => item.value > 0);

  const goalTypes: NamedCount[] = Object.entries(analytics?.goalTypes ?? {})
    .map(([key, value]) => ({ name: GOAL_LABELS[key] || key, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const rawPackages = analytics?.packageStatus ?? {
    ACTIVE: 0,
    COMPLETED: 0,
    EXPIRED: 0,
    CANCELLED: 0,
  };
  const packageStatus: NamedCount[] = [
    { name: "Đang hiệu lực", value: rawPackages.ACTIVE },
    { name: "Hoàn thành", value: rawPackages.COMPLETED },
    { name: "Hết hạn", value: rawPackages.EXPIRED },
    { name: "Đã hủy", value: rawPackages.CANCELLED },
  ].filter((item) => item.value > 0);

  const rawGender = analytics?.gender ?? { MALE: 0, FEMALE: 0, OTHER: 0 };
  const gender: NamedCount[] = [
    { name: "Nam", value: rawGender.MALE },
    { name: "Nữ", value: rawGender.FEMALE },
    { name: "Khác", value: rawGender.OTHER },
  ].filter((item) => item.value > 0);

  const topScores: ScoreRow[] = rows
    .filter((r) => r.dataStatus === "READY" && typeof r.score === "number")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8)
    .map((r) => ({
      customerId: r.customerId,
      name: r.fullName,
      score: r.score ?? 0,
      bodyFatChange: r.changes?.bodyFatChange ?? 0,
      muscleChange: r.changes?.muscleChange ?? 0,
      daysBetween: r.changes?.daysBetween ?? 0,
    }));

  const attentionRows = rows
    .filter(
      (r) =>
        r.progressCategory === "POOR" ||
        r.progressCategory === "SLOW" ||
        (r.openAlerts ?? 0) > 0,
    )
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  return {
    totalCustomers,
    activeCustomers,
    newCustomers: analytics?.periodMetrics.newCustomers ?? { current: 0, previous: null },
    sessionsInPeriod: analytics?.periodMetrics.sessions ?? {
      current: data.sessions ?? 0,
      previous: null,
    },
    measurementsInPeriod: analytics?.periodMetrics.measurements ?? {
      current: rows.reduce((sum, r) => sum + (r.measurementCount || 0), 0),
      previous: null,
    },
    goodProgress,
    attentionCount: poorProgress + slowProgress,
    attendanceRate: analytics?.summary.attendanceRate ?? null,
    averageScore: analytics?.summary.averageScore ?? null,
    averageBodyFatDelta: analytics?.summary.averageBodyFatDelta ?? null,
    averageMuscleDelta: analytics?.summary.averageMuscleDelta ?? null,
    activePackages: analytics?.summary.activePackages ?? 0,
    expiringPackages: analytics?.summary.expiringPackages ?? 0,
    pendingTransfers: analytics?.summary.pendingTransfers ?? 0,
    activityTrend: analytics?.activityTrend ?? [],
    progressDistribution,
    customerStatus,
    attendance,
    goalTypes,
    packageStatus,
    gender,
    planCoverage: analytics?.planCoverage ?? [],
    trainerWorkload: analytics?.trainerWorkload ?? [],
    topScores,
    attentionRows,
  };
}
