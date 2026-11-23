// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GymOverviewSection from "./GymOverviewSection";
import { OverviewPeriodProvider } from "./OverviewPeriodContext";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { uid: "u1", role: "admin", companyCode: "ACME" },
  }),
}));

vi.mock("../../context/BranchContext", () => ({
  useBranch: () => ({
    activeBranchId: "branch-1",
    activeBranch: { name: "Trụ sở chính" },
    loading: false,
    error: null,
  }),
}));

vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-stub">{children}</div>
  );
  return {
    Area: Stub,
    AreaChart: Stub,
    Bar: Stub,
    BarChart: Stub,
    CartesianGrid: Stub,
    Cell: Stub,
    ComposedChart: Stub,
    LabelList: Stub,
    Legend: Stub,
    Pie: Stub,
    PieChart: Stub,
    ResponsiveContainer: Stub,
    Tooltip: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

describe("GymOverviewSection", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders unified KPI strip, detail metrics, and charts using shared period query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        totalCustomers: 5,
        customers: 5,
        activeCustomers: 4,
        sessions: 14,
        plans: 3,
        openAlerts: 1,
        goodProgressCount: 2,
        slowProgressCount: 1,
        poorProgressCount: 1,
        insufficientDataCount: 1,
        customerRows: [
          {
            customerId: "c1",
            fullName: "Nguyễn Văn A",
            initialGoal: "Giảm 5 kg",
            dataStatus: "READY",
            score: 82,
            progressCategory: "GOOD",
            measurementCount: 3,
            changes: { bodyFatChange: 2.5, muscleChange: 0.8, weightChange: -2.0, daysBetween: 30 },
            openAlerts: 0,
          },
          {
            customerId: "c2",
            fullName: "Lê Thị B",
            initialGoal: "Tăng cơ",
            dataStatus: "READY",
            score: 45,
            progressCategory: "POOR",
            measurementCount: 2,
            changes: { bodyFatChange: -1.0, muscleChange: -0.4, weightChange: 0.5, daysBetween: 21 },
            openAlerts: 1,
          },
        ],
        analytics: {
          period: { from: "2026-11-01", to: "2026-11-23", previousFrom: "2026-10-01", previousTo: "2026-10-23" },
          periodMetrics: {
            newCustomers: { current: 2, previous: 1 },
            sessions: { current: 14, previous: 10 },
            measurements: { current: 6, previous: 4 },
          },
          summary: {
            attendanceRate: 92.5,
            averageScore: 63.5,
            averageBodyFatDelta: 0.8,
            averageMuscleDelta: 0.2,
            activePackages: 4,
            expiringPackages: 1,
            totalMeasurements: 12,
            totalGoals: 5,
            totalPackages: 6,
            pendingTransfers: 0,
          },
          activityTrend: [
            { date: "2026-11-01", label: "01/11", sessions: 5, measurements: 2, newCustomers: 1 },
          ],
          customerStatus: { ACTIVE: 4, LEAD: 1, INACTIVE: 0 },
          gender: { MALE: 3, FEMALE: 2, OTHER: 0 },
          attendance: { PRESENT: 12, LATE: 1, ABSENT: 1 },
          goalTypes: { FAT_LOSS: 3, MUSCLE_GAIN: 2 },
          packageStatus: { ACTIVE: 4, COMPLETED: 2, EXPIRED: 0, CANCELLED: 0 },
          planCoverage: [
            { key: "workoutPlans", name: "Giáo án tập", published: 3, draft: 1 },
          ],
          trainerWorkload: [{ id: "pt1", name: "HLV Nam", customers: 5, sessions: 14 }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OverviewPeriodProvider inlineNavigation>
        <GymOverviewSection />
      </OverviewPeriodProvider>,
    );

    expect(await screen.findByText("Tình hình Phòng Gym")).toBeTruthy();
    expect(screen.getByText("Chỉ số chuyên môn & vận hành")).toBeTruthy();
    expect(screen.getByText("Xu hướng tập luyện & đo InBody")).toBeTruthy();
    expect(screen.getByText("Phân bổ tiến độ BF-AT")).toBeTruthy();
    expect(screen.getByText("Trạng thái học viên")).toBeTruthy();
    expect(screen.getByText("Chuyên cần buổi tập trong kỳ")).toBeTruthy();
    expect(screen.getByText("Phân bổ mục tiêu tập luyện")).toBeTruthy();
    expect(screen.getByText("Độ phủ giáo án, dinh dưỡng & lộ trình")).toBeTruthy();
    expect(screen.getByText("Tình trạng gói tập PT")).toBeTruthy();
    expect(screen.getByText("Điểm tiến độ BF-AT nổi bật")).toBeTruthy();
    expect(screen.getByText("Cơ cấu giới tính học viên")).toBeTruthy();
    expect(screen.getByText("Khối lượng phụ trách theo Huấn luyện viên")).toBeTruthy();
    expect(screen.getByText("Học viên cần quan tâm")).toBeTruthy();
    expect(screen.getByText("Lê Thị B")).toBeTruthy();

    const calledUrl = String(fetchMock.mock.calls[0]?.[0] || "");
    expect(calledUrl).toMatch(/^\/api\/v1\/gym\/dashboard\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}&previousFrom=/);
  });
});
