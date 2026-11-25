// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrainingTab from "./TrainingTab";
import { TrainingCourse } from "../../types";

vi.mock("../../services/authService", () => ({
  getAccessToken: () => "test-token",
  authService: {
    getUsersByCompany: vi.fn().mockResolvedValue([]),
    uploadManagedFile: vi.fn(),
  },
}));

vi.mock("../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const baseUser = {
  uid: "user-1",
  displayName: "QA",
  email: "qa@example.com",
  companyCode: "MAIN",
  role: "admin",
  level: 1,
};

function TrainingTabHarness({ initialCourses }: { initialCourses: TrainingCourse[] }) {
  const [courses, setCourses] = useState<TrainingCourse[]>(initialCourses);
  return (
    <TrainingTab
      userProfile={baseUser}
      selectedCompanyCode="MAIN"
      isManager
      courses={courses}
      setCourses={setCourses}
      fetchCourses={vi.fn().mockResolvedValue(undefined)}
      employees={[]}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v1/crud/training-courses") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: { _id: "created-course-1" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TrainingTab required badge deduplication", () => {
  it("renders only one 'Bắt buộc' badge even when legacy course data has both isRequired and 'Bắt buộc' in tags", () => {
    const legacyCourse: TrainingCourse = {
      id: "course-legacy",
      title: "Khoá test 25/11/2026",
      description: "",
      category: "Văn hóa",
      tags: ["Bắt buộc", "Onboarding"],
      isRequired: true,
      icon: "book",
      duration: "1 giờ",
      instructor: "QA",
      companyCode: "MAIN",
      creatorUid: "user-1",
      createdAt: "2026-11-25T00:00:00.000Z",
      enrolledCount: 1,
      companyProgress: 0,
      autoAssignOnboarding: false,
      lessons: [],
      quizzes: [],
    };

    render(<TrainingTabHarness initialCourses={[legacyCourse]} />);

    const card = screen.getByRole("article");
    expect(within(card).getAllByText("Bắt buộc")).toHaveLength(1);
    expect(within(card).getByText("Onboarding")).toBeTruthy();
  });

  it("creates a required course without duplicating 'Bắt buộc' into tags and renders a single badge", async () => {
    render(<TrainingTabHarness initialCourses={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /Tạo khóa học/i }));

    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Quy chế bảo mật và ISO 27001"), {
      target: { value: "Khóa học nội bộ mới" },
    });
    fireEvent.click(screen.getByLabelText(/Khóa học bắt buộc/i));
    fireEvent.click(screen.getByRole("button", { name: "Đăng tải khóa học" }));

    await waitFor(() => {
      expect(screen.getByText("Khóa học nội bộ mới")).toBeTruthy();
    });

    const fetchMock = vi.mocked(fetch);
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/v1/crud/training-courses" && init?.method === "POST"
    );
    expect(createCall).toBeTruthy();
    const payload = JSON.parse(String(createCall?.[1]?.body));
    expect(payload.isRequired).toBe(true);
    expect(payload.tags).toEqual(["Văn hóa"]);

    const card = screen.getByRole("article");
    expect(within(card).getAllByText("Bắt buộc")).toHaveLength(1);
  });
});
