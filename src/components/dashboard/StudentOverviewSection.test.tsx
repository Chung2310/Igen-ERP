// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentOverviewSection from "./StudentOverviewSection";

vi.mock("../../modules/student-management/hooks/useStudents", () => ({ useStudents: vi.fn() }));
vi.mock("../../modules/student-management/hooks/useCourses", () => ({ useCourses: vi.fn() }));
vi.mock("../../modules/student-management/hooks/useBatches", () => ({ useBatches: vi.fn() }));
vi.mock("./OverviewPeriodContext", () => ({
  useOverviewPeriod: () => ({ from: "2026-11-01", to: "2026-11-06", previousFrom: "2026-10-01", previousTo: "2026-10-31" }),
  OverviewPeriodActions: ({ children }: { children: import("react").ReactNode }) => children,
}));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => ({ activeBranch: { name: "Trụ sở chính" } }) }));

import { useStudents } from "../../modules/student-management/hooks/useStudents";
import { useCourses } from "../../modules/student-management/hooks/useCourses";
import { useBatches } from "../../modules/student-management/hooks/useBatches";

describe("StudentOverviewSection", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.mocked(useStudents).mockReturnValue({ students: [{ id: "s1", fullName: "Học viên An", phone: "", birthday: "", idCard: "", registrationDate: "02/11/2026", fee: "5.000.000", paidAmount: 2_000_000, address: "", status: ["Đang học"], ownerId: "owner", courseId: "c1", paymentHistory: [{ id: "p1", amount: 2_000_000, date: "03/11/2026", method: "Tiền mặt", recipient: "A" }] }], loading: false, error: "", refetch: vi.fn(async () => {}) } as ReturnType<typeof useStudents>);
    vi.mocked(useCourses).mockReturnValue({ courses: [{ id: "c1", title: "Tin học", code: "TH", category: "Cơ bản", fee: "5.000.000", duration: "3 tháng", maxLearners: 20, activeBatches: 1, status: "Hoạt động", ownerId: "owner" }], loading: false, error: "", refetch: vi.fn(async () => {}) });
    vi.mocked(useBatches).mockReturnValue({ batches: [{ id: "b1", code: "L01", courseId: "c1", learnerIds: ["s1"], daysOfWeek: [1], startTime: "08:00", endTime: "10:00", startDate: "2026-11-01", endDate: "2027-01-31", status: "Đang học", ownerId: "owner", courseCode: "TH", courseTitle: "Tin học", maxLearners: 20, instructorName: "Giáo viên" }], loading: false, error: "", refetch: vi.fn(async () => {}) });
  });

  it("shows tuition figures and several chart types within the shared overview style", () => {
    const view = render(<StudentOverviewSection />);
    expect(screen.getByText("Tổng quan Học viên")).toBeTruthy();
    expect(screen.getByText("Số liệu học phí chi tiết")).toBeTruthy();
    expect(screen.getByText("Xu hướng đăng ký học viên")).toBeTruthy();
    expect(screen.getByText("Cơ cấu học phí")).toBeTruthy();
    expect(screen.getByText("Học phí theo khóa học")).toBeTruthy();
    expect(screen.getByText("Sĩ số lớp đang mở")).toBeTruthy();
    expect(view.container.querySelectorAll(".finance-detail-value").length).toBeGreaterThanOrEqual(4);
  });

  it("keeps KPI and chart cards visible when the branch has no students", () => {
    vi.mocked(useStudents).mockReturnValue({ students: [], loading: false, error: "", refetch: vi.fn(async () => {}) });
    vi.mocked(useCourses).mockReturnValue({ courses: [], loading: false, error: "", refetch: vi.fn(async () => {}) });
    vi.mocked(useBatches).mockReturnValue({ batches: [], loading: false, error: "", refetch: vi.fn(async () => {}) });
    render(<StudentOverviewSection />);
    expect(screen.getByText("Tình hình học viên")).toBeTruthy();
    expect(screen.getByText("Số liệu học phí chi tiết")).toBeTruthy();
    expect(screen.getByText("Xu hướng đăng ký học viên")).toBeTruthy();
    expect(screen.getByText("Thu học phí trong kỳ")).toBeTruthy();
    expect(screen.getByText("Cơ cấu học phí")).toBeTruthy();
  });
});
