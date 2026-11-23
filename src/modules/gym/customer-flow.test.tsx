// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CustomerForm from "./CustomerForm";
import CustomerDetail from "./CustomerDetail";
import { gymApi } from "./api";
import { GymWorkspace } from "./GymPage";
import { analyzeInBody } from "./inbodyAnalytics";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("preserves the 3S customer sections and submits a profile without creating a login", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ _id: "customer", revision: 1 }));
  vi.stubGlobal("fetch", fetch);
  const saved = vi.fn();
  render(
    <CustomerForm api={gymApi("branch")} onClose={() => {}} onSaved={saved} />,
  );
  for (const text of [
    "Thông tin cá nhân",
    "Liên hệ",
    "Chỉ số và sức khỏe",
    "Quản lý",
  ])
    expect(screen.getByText(text)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Họ tên *"), {
    target: { value: "Nguyễn An" },
  });
  fireEvent.change(screen.getByLabelText("Số điện thoại *"), {
    target: { value: "0912345678" },
  });
  fireEvent.click(screen.getByText("Tạo khách hàng"));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/gym/customers");
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.fullName).toBe("Nguyễn An");
  expect(body).not.toHaveProperty("role");
  expect(body).not.toHaveProperty("password");
});

it("opens on Customers by default and omits the Dashboard and Profile tabs from Gym sidebar", async () => {
  window.history.replaceState({}, "", "/gym?sub=dashboard");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    ),
  );
  render(<GymWorkspace branchId="branch" admin={false} canWrite />);
  expect(await screen.findByRole("button", { name: "Mục tiêu" })).toBeTruthy();
  expect(screen.queryByText("Dashboard PT")).toBeNull();
  expect(screen.queryByText("Hồ sơ cá nhân")).toBeNull();
});

it("renders 3S-parity compact Nutrition tab in CustomerDetail (published + empty states) and opens Today Nutrition modal", async () => {
  const customer = {
    _id: "c1",
    revision: 1,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    fullName: "Trần Thị Mai Phương",
    phone: "0987654321",
    email: "phuong.tranmai00@gmail.com",
    gender: "FEMALE",
    status: "ACTIVE",
  };
  const publishedPlan = {
    _id: "np1",
    revision: 1,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    title: "Thực Đơn Dinh Dưỡng - Trần Thị Mai Phương",
    status: "PUBLISHED",
    targetCalories: 1850,
    macros: { protein: 175, carbs: 195, fat: 41 },
    dailyPlans: [
      {
        dayNumber: 1,
        dayOfWeek: "Thứ Hai",
        meals: [
          {
            name: "Bữa sáng",
            timeSlot: "07:00 - 08:00",
            calories: 450,
            items: [{ name: "Ức gà áp chảo", amount: "150g", calories: 250 }],
          },
        ],
      },
    ],
  };

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/customers/c1")) return Promise.resolve(Response.json(customer));
      if (url.includes("/nutrition-plans")) {
        return Promise.resolve(
          Response.json({ data: [publishedPlan], meta: { page: 1, limit: 50, total: 1, totalPages: 1 } }),
        );
      }
      return Promise.resolve(
        Response.json({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
      );
    }),
  );

  render(
    <CustomerDetail
      api={gymApi("branch")}
      record={customer}
      onClose={() => {}}
      canWrite
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Thực đơn Dinh dưỡng/i }));
  expect(await screen.findByText("Kế hoạch Thực đơn Dinh dưỡng (1)")).toBeTruthy();
  expect(screen.getByText("Thực Đơn Dinh Dưỡng - Trần Thị Mai Phương")).toBeTruthy();
  expect(screen.getByText("Protein: 175g")).toBeTruthy();
  expect(screen.getByText("Carbs: 195g")).toBeTruthy();
  expect(screen.getByText("Fat: 41g")).toBeTruthy();
  // Must NOT embed the 5-tab NutritionPage calculator inside CustomerDetail
  expect(screen.queryByText("Tính BMR & Macro")).toBeNull();

  // Clicking "Xem Hôm Nay Ăn Gì" opens the realtime modal
  fireEvent.click(screen.getAllByRole("button", { name: /Xem Hôm Nay Ăn Gì/i })[0]);
  expect(await screen.findByText(/Hôm nay ăn gì: Trần Thị Mai Phương/i)).toBeTruthy();
});

it("shows 3S empty state in CustomerDetail Nutrition tab when no published plan exists and navigates to nutrition", async () => {
  const customer = {
    _id: "c2",
    revision: 1,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    fullName: "Nguyễn Văn Long",
    phone: "0376554244",
    gender: "MALE",
    status: "ACTIVE",
  };
  const onNavigateNutrition = vi.fn();

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/customers/c2")) return Promise.resolve(Response.json(customer));
      if (url.includes("/nutrition-plans")) {
        return Promise.resolve(
          Response.json({
            data: [{ _id: "draft1", status: "DRAFT", title: "Nháp", targetCalories: 2000 }],
            meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(
        Response.json({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
      );
    }),
  );

  render(
    <CustomerDetail
      api={gymApi("branch")}
      record={customer}
      onClose={() => {}}
      canWrite
      onNavigateNutrition={onNavigateNutrition}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Thực đơn Dinh dưỡng/i }));
  expect(await screen.findByText("Kế hoạch Thực đơn Dinh dưỡng (0)")).toBeTruthy();
  expect(
    screen.getByText("Học viên chưa có thực đơn dinh dưỡng nào được công bố áp dụng."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Thiết kế thực đơn ngay" }));
  expect(onNavigateNutrition).toHaveBeenCalledWith("c2");
});

it("computes 3S InBody segmental imbalance and goal alignment accurately", () => {
  const result = analyzeInBody(
    {
      _id: "m2",
      revision: 1,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      measurementDate: "2026-10-01",
      weight: 72,
      bmi: 24.1,
      bodyFatPercentage: 22,
      muscleMass: 33.5,
      visceralFatLevel: 11,
      inbodyScore: 76,
      segmentalMuscle: { rightArm: 3.5, leftArm: 3.0, trunk: 24, rightLeg: 9.2, leftLeg: 9.1 },
    },
    {
      _id: "m1",
      revision: 1,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      measurementDate: "2026-09-01",
      weight: 74,
      bodyFatPercentage: 24,
      muscleMass: 32.8,
      visceralFatLevel: 12,
    },
    { fullName: "Lê Hoàng Anh", gender: "MALE", height: 173 },
  );
  expect(result.comparison?.trendType).toBe("EXCELLENT");
  expect(result.segmentalAnalysis.muscleImbalanceArm.hasImbalance).toBe(true);
  expect(result.alerts.some((a) => a.id === "alert-visceral-danger")).toBe(true);
});
