// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HealthcareOverview } from "../../../shared/healthcare";
import HealthcareOverviewSection from "./HealthcareOverviewSection";

const mockOverview: HealthcareOverview = {
  today: "2026-11-23",
  patients: 1250,
  visitCount: 84,
  appointmentCount: 12,
  careCount: 5,
  todayAppointments: [
    {
      _id: "appt-1",
      patientId: "pat-1",
      scheduledOn: "2026-11-23",
      startsAt: "2026-11-23T09:00:00+07:00",
      status: "confirmed",
    },
  ],
  dueCare: [
    {
      _id: "care-1",
      patientId: "pat-1",
      dueOn: "2026-11-23",
      title: "Gọi tái khám sau điều trị",
    },
  ],
  patientReferences: [
    { _id: "pat-1", code: "KH001", name: "Nguyễn Văn An" },
  ],
  analytics: {
    newPatientsInPeriod: 45,
    previousPatientsInPeriod: 30,
    uniquePatientsVisited: 68,
    previousUniquePatientsVisited: 52,
    patientsByGender: [
      { name: "Nữ", value: 700 },
      { name: "Nam", value: 550 },
    ],
    patientsByAgeGroup: [
      { name: "18–30", value: 320 },
      { name: "31–45", value: 480 },
      { name: "46–60", value: 300 },
    ],
    patientVisitType: [
      { name: "Khách mới", value: 34 },
      { name: "Tái khám", value: 50 },
    ],
    previousVisitCount: 70,
    visitsInPeriodByStatus: [
      { name: "Hoàn tất", value: 72 },
      { name: "Đang khám", value: 12 },
    ],
    visitTrend: [
      { label: "20/11", visits: 18, appointments: 15, newPatients: 6, visitPayment: 12_500_000 },
      { label: "21/11", visits: 22, appointments: 19, newPatients: 9, visitPayment: 15_000_000 },
    ],
    visitsByDoctor: [
      { name: "BS. Trần Hữu Khiêm", value: 40, amount: 25_000_000 },
      { name: "BS. Nguyễn Hữu Vũ", value: 28, amount: 18_000_000 },
    ],
    visitsByDepartment: [
      { name: "Khoa Nội", value: 50 },
      { name: "Khoa Da liễu", value: 34 },
    ],
    visitsByService: [
      { name: "Khám tổng quát", value: 42, amount: 21_000_000 },
    ],
    visitsByCustomerType: [
      { name: "Thu phí", value: 64 },
      { name: "BHYT", value: 20 },
    ],
    topDiagnoses: [
      { name: "Viêm họng cấp", value: 19 },
    ],
    appointmentsInPeriod: 96,
    previousAppointmentsInPeriod: 80,
    totalPendingAppointments: 1956,
    appointmentByStatus: [
      { name: "Chờ xác nhận", value: 60 },
      { name: "Đã xác nhận", value: 36 },
    ],
    appointmentsByDoctor: [
      { name: "BS. Trần Hữu Khiêm", value: 58 },
    ],
    careByStatus: [
      { name: "Hoàn tất", value: 40 },
      { name: "Chờ xử lý", value: 10 },
    ],
    careTotal: 50,
    careCompletedCount: 40,
    careCompletionRate: 80,
    finance: {
      visitPaymentTotal: 48_500_000,
      previousVisitPaymentTotal: 40_000_000,
      paidVisitCount: 70,
      unpaidVisitCount: 14,
      averageVisitPayment: 692_857,
      paymentStatusBreakdown: [
        { name: "Đã thanh toán", value: 70 },
        { name: "Chưa thanh toán", value: 14 },
      ],
      receiptValue: 22_000_000,
      previousReceiptValue: 18_000_000,
      issueValue: 14_500_000,
      previousIssueValue: 11_000_000,
      receiptCount: 5,
      issueCount: 8,
      stockFlowTrend: [
        { label: "20/11", receiptValue: 10_000_000, issueValue: 6_500_000, visitPayment: 12_500_000 },
        { label: "21/11", receiptValue: 12_000_000, issueValue: 8_000_000, visitPayment: 15_000_000 },
      ],
    },
    inventory: {
      totalItems: 120,
      totalQuantity: 3400,
      totalValue: 185_000_000,
      inStock: 105,
      lowStock: 10,
      outOfStock: 5,
      expired: 1,
      expiringSoon: 3,
      byCategory: [
        { name: "Vật tư tiêu hao", count: 60, quantity: 2000, value: 95_000_000 },
      ],
      byWarehouse: [
        { name: "Kho chính", quantity: 3400, value: 185_000_000 },
      ],
    },
    equipment: {
      total: 18,
      byStatus: [
        { name: "Sẵn sàng", value: 14 },
        { name: "Đang sử dụng", value: 4 },
      ],
      byCategory: [{ name: "Chẩn đoán hình ảnh", value: 6 }],
      overdueInspection: 1,
      soonInspection: 2,
      pendingRequests: 1,
    },
  },
};

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { uid: "u1", companyCode: "IGEN" } }),
}));

vi.mock("../../context/BranchContext", () => ({
  useBranch: () => ({
    loading: false,
    activeBranchId: "branch-1",
    activeBranch: { _id: "branch-1", name: "Trụ sở chính (MAIN)" },
    error: "",
    retry: vi.fn(),
  }),
}));

vi.mock("../../modules/healthcare/ui", async () => {
  const actual = await vi.importActual<typeof import("../../modules/healthcare/ui")>(
    "../../modules/healthcare/ui",
  );
  return {
    ...actual,
    useHealthcareQuery: () => ({
      data: mockOverview,
      loading: false,
      error: "",
      refresh: vi.fn(),
    }),
  };
});

afterEach(() => {
  cleanup();
});

describe("HealthcareOverviewSection", () => {
  it("renders KPI cards, financial detail strip, and comprehensive medical charts", () => {
    render(<HealthcareOverviewSection />);

    expect(screen.getByText("Tình hình y tế")).toBeTruthy();
    expect(screen.getByText("Tổng bệnh nhân")).toBeTruthy();
    expect(screen.getByText("Bệnh nhân mới")).toBeTruthy();
    expect(screen.getByText("Lượt khám trong kỳ")).toBeTruthy();
    expect(screen.getByText("Lịch hẹn trong kỳ")).toBeTruthy();
    expect(screen.getByText("Thanh toán khám")).toBeTruthy();
    expect(screen.getByText("Giá trị tồn kho")).toBeTruthy();

    // Financial detail strip
    expect(screen.getByText("Số liệu tài chính & vận hành chi tiết")).toBeTruthy();
    expect(screen.getByText("Thanh toán khám trong kỳ")).toBeTruthy();
    expect(screen.getByText("TB thanh toán / lượt")).toBeTruthy();

    // Charts covering patients, visits, money, appointments, supplies, equipment, care
    expect(screen.getByText("Xu hướng lượt khám, lịch hẹn & bệnh nhân mới")).toBeTruthy();
    expect(screen.getByText("Dòng tiền y tế (Thanh toán khám, Nhập & Xuất kho)")).toBeTruthy();
    expect(screen.getByText("Trạng thái thanh toán lượt khám")).toBeTruthy();
    expect(screen.getByText("Phân bổ giới tính bệnh nhân")).toBeTruthy();
    expect(screen.getByText("Phân bổ nhóm tuổi bệnh nhân")).toBeTruthy();
    expect(screen.getByText("Cơ cấu khách mới & tái khám")).toBeTruthy();
    expect(screen.getByText("Trạng thái lượt khám trong kỳ")).toBeTruthy();
    expect(screen.getByText("Lượt khám theo bác sĩ")).toBeTruthy();
    expect(screen.getByText("Lượt khám theo phòng ban / khoa")).toBeTruthy();
    expect(screen.getByText("Dịch vụ điều trị phổ biến")).toBeTruthy();
    expect(screen.getByText("Lịch hẹn theo bác sĩ")).toBeTruthy();
    expect(screen.getByText("Đối tượng khám")).toBeTruthy();
    expect(screen.getByText("Chẩn đoán phổ biến")).toBeTruthy();
    expect(screen.getByText("Tình trạng tồn kho & hạn dùng vật tư")).toBeTruthy();
    expect(screen.getByText("Giá trị tồn kho theo danh mục")).toBeTruthy();
    expect(screen.getByText("Giá trị tồn kho theo kho lưu trữ")).toBeTruthy();
    expect(screen.getByText("Trang thiết bị y tế & kiểm định")).toBeTruthy();
    expect(screen.getByText("Thiết bị y tế theo phân loại")).toBeTruthy();
    expect(screen.getByText("Tiến độ việc chăm sóc bệnh nhân")).toBeTruthy();

    // Actionable tables
    expect(screen.getByText("Lịch hẹn hôm nay")).toBeTruthy();
    expect(screen.getByText("Gọi tái khám sau điều trị")).toBeTruthy();
  });
});
