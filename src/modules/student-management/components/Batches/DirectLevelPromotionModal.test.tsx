// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiFetch } from "../../lib/api";
import type { Batch, Course } from "../../types";
import { DirectLevelPromotionModal } from "./DirectLevelPromotionModal";

vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../../../pages/Toast", () => ({ toast: { success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("preserves the next roadmap step and schedules the new class using its course duration", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 16, 12)); // Monday
  const source = { id: "source-step", order: 1, courseId: "basic" };
  const target = { id: "target-step", order: 3, courseId: "advanced" };
  const batch = { id: "source", code: "B01", courseId: "basic", courseTitle: "Cơ bản", roadmapId: "roadmap", daysOfWeek: [1, 3] } as Batch;
  const courses = [{ id: "basic", title: "Cơ bản", duration: "2" }, { id: "advanced", title: "Nâng cao", duration: "4" }] as Course[];
  const request = vi.mocked(apiFetch);
  request.mockResolvedValueOnce({ success: true, data: {
    batch, selectedRoadmapId: "roadmap", sourceStep: source, targetStep: target,
    roadmaps: [{ id: "roadmap", name: "Lộ trình giao tiếp", status: "active" }],
    rows: [{ studentId: "student", studentName: "Học viên A", enrollmentStatus: "Đang học" }],
  } }).mockResolvedValueOnce({ success: true, data: { id: "destination" } }).mockResolvedValueOnce({ success: true });
  const onPromoted = vi.fn();
  render(<DirectLevelPromotionModal batch={batch} batches={[batch]} courses={courses} classrooms={[]} onClose={vi.fn()} onPromoted={onPromoted} />);

  await screen.findByText("Lộ trình giao tiếp");
  expect(screen.getByText("Chặng 1 → Chặng 3: Nâng cao")).toBeTruthy();
  const endDate = screen.getByRole<HTMLInputElement>("textbox", { name: "Ngày bế giảng lớp mới" });
  expect(endDate.value).toBe("25/11/2026");
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày khai giảng lớp mới" }));
  fireEvent.click(screen.getByRole("button", { name: "18 tháng 11 năm 2026" }));
  expect(endDate.value).toBe("30/11/2026");
  fireEvent.click(screen.getByRole("button", { name: "T4" }));
  expect(endDate.value).toBe("14/12/2026");
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày bế giảng lớp mới" }));
  fireEvent.click(screen.getByRole("button", { name: "15 tháng 12 năm 2026" }));
  expect(endDate.value).toBe("15/12/2026");
  fireEvent.click(screen.getByRole("button", { name: "Tạo lớp và chuyển 1 học viên" }));

  await waitFor(() => expect(onPromoted).toHaveBeenCalledOnce());
  expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toMatchObject({
    courseId: "advanced", roadmapId: "roadmap", roadmapStepId: "target-step",
    startDate: "2026-11-18", endDate: "2026-12-15", daysOfWeek: [1],
  });
  expect(JSON.parse(String(request.mock.calls[2][1]?.body))).toEqual({ roadmapId: "roadmap", targetBatchId: "destination", studentIds: ["student"] });
});
