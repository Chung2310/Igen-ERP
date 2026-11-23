import { describe, expect, it } from "vitest";
import { buildGymOverview, type GymDashboardPayload } from "./gymOverviewMetrics";

describe("buildGymOverview", () => {
  it("maps full analytics payload into chart series and KPI metrics", () => {
    const payload: GymDashboardPayload = {
      totalCustomers: 12,
      customers: 12,
      activeCustomers: 9,
      sessions: 45,
      plans: 8,
      openAlerts: 1,
      goodProgressCount: 5,
      slowProgressCount: 2,
      poorProgressCount: 1,
      insufficientDataCount: 4,
      customerRows: [
        {
          customerId: "c1",
          fullName: "Nguyễn Văn A",
          initialGoal: "Giảm mỡ",
          dataStatus: "READY",
          score: 86,
          progressCategory: "GOOD",
          measurementCount: 3,
          changes: { bodyFatChange: 3.2, muscleChange: 1.1, weightChange: -2.4, daysBetween: 30 },
          openAlerts: 0,
        },
        {
          customerId: "c2",
          fullName: "Trần Thị B",
          initialGoal: "Tăng cơ",
          dataStatus: "READY",
          score: 42,
          progressCategory: "POOR",
          measurementCount: 2,
          changes: { bodyFatChange: -1.5, muscleChange: -0.5, weightChange: 1.0, daysBetween: 20 },
          openAlerts: 1,
        },
      ],
      analytics: {
        period: { from: "2026-11-01", to: "2026-11-23", previousFrom: "2026-10-01", previousTo: "2026-10-23" },
        periodMetrics: {
          newCustomers: { current: 4, previous: 2 },
          sessions: { current: 28, previous: 20 },
          measurements: { current: 10, previous: 8 },
        },
        summary: {
          attendanceRate: 89.3,
          averageScore: 64,
          averageBodyFatDelta: 0.9,
          averageMuscleDelta: 0.3,
          activePackages: 7,
          expiringPackages: 2,
          totalMeasurements: 18,
          totalGoals: 9,
          totalPackages: 10,
          pendingTransfers: 1,
        },
        activityTrend: [
          { date: "2026-11-01", label: "01/11", sessions: 4, measurements: 2, newCustomers: 1 },
          { date: "2026-11-02", label: "02/11", sessions: 6, measurements: 1, newCustomers: 0 },
        ],
        customerStatus: { ACTIVE: 9, LEAD: 2, INACTIVE: 1 },
        gender: { MALE: 7, FEMALE: 5, OTHER: 0 },
        attendance: { PRESENT: 22, LATE: 3, ABSENT: 3 },
        goalTypes: { FAT_LOSS: 4, MUSCLE_GAIN: 3, FITNESS: 2 },
        packageStatus: { ACTIVE: 7, COMPLETED: 2, EXPIRED: 1, CANCELLED: 0 },
        planCoverage: [
          { key: "workoutPlans", name: "Giáo án tập", published: 6, draft: 2 },
          { key: "nutritionPlans", name: "Thực đơn", published: 4, draft: 1 },
        ],
        trainerWorkload: [
          { id: "pt1", name: "HLV Minh", customers: 7, sessions: 18 },
          { id: "pt2", name: "HLV Lan", customers: 5, sessions: 10 },
        ],
      },
    };

    const result = buildGymOverview(payload);
    expect(result.totalCustomers).toBe(12);
    expect(result.newCustomers).toEqual({ current: 4, previous: 2 });
    expect(result.sessionsInPeriod).toEqual({ current: 28, previous: 20 });
    expect(result.measurementsInPeriod).toEqual({ current: 10, previous: 8 });
    expect(result.attentionCount).toBe(3);
    expect(result.progressDistribution).toHaveLength(4);
    expect(result.customerStatus.map((item) => item.name)).toEqual(["Đang tập", "Tiềm năng", "Tạm ngưng"]);
    expect(result.gender.map((item) => item.name)).toEqual(["Nam", "Nữ"]);
    expect(result.goalTypes[0]).toEqual({ name: "Giảm mỡ", value: 4 });
    expect(result.topScores.map((row) => row.customerId)).toEqual(["c1", "c2"]);
    expect(result.attentionRows.map((row) => row.customerId)).toEqual(["c2"]);
    expect(result.trainerWorkload).toHaveLength(2);
  });

  it("handles minimal legacy payload without analytics gracefully", () => {
    const result = buildGymOverview({
      totalCustomers: 1,
      customers: 1,
      activeCustomers: 1,
      openAlerts: 0,
      goodProgressCount: 0,
      slowProgressCount: 0,
      poorProgressCount: 0,
      customerRows: [
        {
          customerId: "c1",
          fullName: "Nguyễn Văn Anh",
          dataStatus: "INSUFFICIENT_DATA",
          score: null,
          progressCategory: "INSUFFICIENT_DATA",
          measurementCount: 1,
        },
      ],
    });

    expect(result.totalCustomers).toBe(1);
    expect(result.progressDistribution).toEqual([{ name: "Chưa đủ InBody", value: 1 }]);
    expect(result.topScores).toEqual([]);
    expect(result.attentionRows).toEqual([]);
    expect(result.attendanceRate).toBeNull();
  });
});
