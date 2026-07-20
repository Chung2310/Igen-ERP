// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../lib/api";
import type { Batch, Course, ExamSession } from "../types";
import { CoursesPage } from "../pages/Courses/CoursesPage";
import { BatchesPage } from "../pages/Batches/BatchesPage";
import { AddExamModal } from "./Exams/AddExamModal";
import { ExamCard } from "./Exams/ExamCard";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy({}, { get: (_target, tag) => tag }),
}));
vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "admin" } }) }));
vi.mock("../../../services/authService", () => ({ authService: { getAllUsers: vi.fn(async () => []), getUsersByCompany: vi.fn(async () => []) } }));
vi.mock("../hooks/useCourses", () => ({ useCourses: vi.fn() }));
vi.mock("../hooks/useCourseCategories", () => ({ useCourseCategories: vi.fn() }));
vi.mock("../hooks/useBatches", () => ({ useBatches: vi.fn() }));
vi.mock("../hooks/useStudents", () => ({ useStudents: () => ({ students: [] }) }));
vi.mock("../custom-fields/CustomFieldsSection", () => ({
  CustomFieldsSection: ({ moduleKey, values, onChange }: { moduleKey: string; values: Record<string, unknown>; onChange(values: Record<string, unknown>): void }) => (
    <input aria-label={`custom-${moduleKey}`} value={String(values.extra ?? "")} onChange={(event) => onChange({ ...values, extra: event.target.value })} />
  ),
}));
vi.mock("../custom-fields/CustomFieldDetails", () => ({
  CustomFieldDetails: ({ moduleKey, values }: { moduleKey: string; values: Record<string, unknown> }) => <span>{`details-${moduleKey}-${String(values.extra ?? "")}`}</span>,
}));

import { useCourses } from "../hooks/useCourses";
import { useCourseCategories } from "../hooks/useCourseCategories";
import { useBatches } from "../hooks/useBatches";

const mockedApiFetch = vi.mocked(apiFetch);
const mockedCourses = vi.mocked(useCourses);
const mockedCategories = vi.mocked(useCourseCategories);
const mockedBatches = vi.mocked(useBatches);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Set<{ root: Root; container: HTMLDivElement }>();

function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.add({ root, container });
  act(() => root.render(node));
  return { container, rerender(next: ReactNode) { act(() => root.render(next)); } };
}

function change(element: HTMLInputElement, value: string) {
  if (!element) throw new Error(`Missing input. Body: ${document.body.textContent}`);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function waitFor(assertion: () => void) {
  let error: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { assertion(); return; } catch (caught) { error = caught; await act(async () => { await Promise.resolve(); }); }
  }
  throw error;
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const course = {
  id: "course-1", code: "C01", title: "Course", category: "General", fee: "100d", duration: "1 month",
  maxLearners: 20, activeBatches: 0, status: "Hoạt động", ownerId: "owner", customFields: { extra: "course-existing" },
} as Course;
const batch = {
  id: "batch-1", code: "B01", courseId: course.id, instructorId: "", learnerIds: [], daysOfWeek: [1], startTime: "18:00",
  endTime: "20:00", location: "Room", startDate: "2026-07-20", endDate: "2026-08-20", status: "Sắp khai giảng",
  ownerId: "owner", courseCode: course.code, courseTitle: course.title, maxLearners: 20, instructorName: "", customFields: { extra: "batch-existing" },
} as Batch;
const exam = {
  id: "exam-1", name: "Exam", status: "Sắp diễn ra", tentativeDate: "20/07/2026", location: "Room",
  studentCount: 0, passCount: 0, failCount: 0, customFields: { extra: "exam-existing" },
} as ExamSession;

beforeEach(() => {
  mockedCourses.mockReturnValue({ courses: [course], loading: false, refetch: vi.fn() });
  mockedCategories.mockReturnValue({ categories: [{ id: "cat-1", name: "General" }], loading: false, refetch: vi.fn() });
  mockedBatches.mockReturnValue({ batches: [batch], loading: false, refetch: vi.fn() });
  mockedApiFetch.mockResolvedValue({ success: true, data: { _id: "created" } });
});

afterEach(() => {
  roots.forEach(({ root, container }) => { act(() => root.unmount()); container.remove(); });
  roots.clear();
  vi.clearAllMocks();
});

describe("course, batch and exam custom-field integration", () => {
  it("uses the courses module, preserves dirty create values, sends them, and hydrates edit", async () => {
    const view = render(<CoursesPage />);
    const add = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("Thêm khóa học mới"));
    act(() => add?.click());
    const form = view.container.querySelector("form")!;
    const text = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="text"]'));
    change(text[0], "c02"); change(text[1], "New course"); change(text[2], "2 months"); change(text[3], "200");
    change(form.querySelector('[aria-label="custom-courses"]')!, "course-dirty");
    view.rerender(<CoursesPage />);
    expect((view.container.querySelector('[aria-label="custom-courses"]') as HTMLInputElement).value).toBe("course-dirty");
    await submit(form);
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith("/courses", expect.objectContaining({ method: "POST" })));
    const body = JSON.parse(String(mockedApiFetch.mock.calls.find(([path]) => path === "/courses")?.[1]?.body));
    expect(body.customFields).toEqual({ extra: "course-dirty" });

    const edit = Array.from(view.container.querySelectorAll("button")).find((button) => button.title.includes("Chỉnh sửa khóa học"));
    act(() => edit?.click());
    await waitFor(() => expect((view.container.querySelector('[aria-label="custom-courses"]') as HTMLInputElement).value).toBe("course-existing"));
  });

  it("uses the batches module, sends create values, and hydrates edit", async () => {
    const view = render(<BatchesPage />);
    const add = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("Mở lớp mới"));
    act(() => add?.click());
    const form = view.container.querySelector("form")!;
    change(form.querySelector('input[type="text"]')!, "b02");
    const dates = form.querySelectorAll<HTMLInputElement>('input[type="date"]');
    change(dates[0], "2026-09-01"); change(dates[1], "2026-10-01");
    act(() => Array.from(form.querySelectorAll("button")).find((button) => button.textContent === "T2")?.click());
    change(form.querySelector('[aria-label="custom-batches"]')!, "batch-dirty");
    await submit(form);
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith("/batches", expect.objectContaining({ method: "POST" })));
    const body = JSON.parse(String(mockedApiFetch.mock.calls.find(([path]) => path === "/batches")?.[1]?.body));
    expect(body.customFields).toEqual({ extra: "batch-dirty" });

    const edit = Array.from(view.container.querySelectorAll("button")).find((button) => button.title.includes("Chỉnh sửa lớp"));
    act(() => edit?.click());
    expect((view.container.querySelector('[aria-label="custom-batches"]') as HTMLInputElement).value).toBe("batch-existing");
  });

  it("uses the exams module, preserves errors and dirty values, hydrates edit, and renders existing details", async () => {
    const onClose = vi.fn();
    const view = render(<AddExamModal isOpen onClose={onClose} onSuccess={vi.fn()} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const form = view.container.querySelector("form")!;
    change(form.querySelector('[name="name"]')!, "New exam");
    change(form.querySelector('[name="tentativeDate"]')!, "2026-07-30");
    change(form.querySelector('[name="location"]')!, "Room 2");
    change(form.querySelector('[aria-label="custom-exams"]')!, "exam-dirty");
    mockedApiFetch.mockRejectedValueOnce(new Error("server validation"));
    const expectedError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await submit(form);
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith("/exams", expect.objectContaining({ method: "POST" })));
    expect((view.container.querySelector('[aria-label="custom-exams"]') as HTMLInputElement).value).toBe("exam-dirty");
    expect(onClose).not.toHaveBeenCalled();
    expect(expectedError).toHaveBeenCalled();
    expect(JSON.parse(String(mockedApiFetch.mock.calls[0][1]?.body)).customFields).toEqual({ extra: "exam-dirty" });

    view.rerender(<AddExamModal isOpen onClose={onClose} onSuccess={vi.fn()} initialData={exam} />);
    await waitFor(() => expect((view.container.querySelector('[aria-label="custom-exams"]') as HTMLInputElement).value).toBe("exam-existing"));

    const card = render(<ExamCard exam={exam} assignedStudents={[]} getStatusInfo={() => ({ color: "", icon: () => null, label: exam.status })} onDelete={vi.fn()} onEdit={vi.fn()} onStatusClick={vi.fn()} onAssignClick={vi.fn()} />);
    act(() => Array.from(card.container.querySelectorAll("button")).find((button) => button.title === "Xem học viên")?.click());
    expect(card.container.textContent).toContain("details-exams-exam-existing");
  });
});
