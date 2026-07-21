// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarTab from "./CalendarTab";

vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const holidayDate = `${currentYear}-${currentMonth}-15`;

describe("CalendarTab applied holiday overlay", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("/work-calendar")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [
                { _id: "h1", date: holidayDate, name: "Ngày Lễ Test", dayType: "holiday", source: "system", sourceYear: currentYear, isApplied: true },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }) as any
    );
  });

  it("shows the applied holiday label on its calendar cell without creating a calendar event", async () => {
    const { container } = render(
      <CalendarTab
        userProfile={{ uid: "u1", role: "admin" } as any}
        selectedCompanyCode="IGEN"
        isManager={true}
        usersList={[]}
        employees={[]}
      />
    );

    await waitFor(() => {
      expect(container.innerHTML).toContain("Ngày Lễ Test");
    });

    const calls: any[][] = (global.fetch as any).mock.calls;
    expect(calls.some(([url]) => String(url).includes("/work-calendar"))).toBe(true);
    expect(calls.some(([url, init]) => String(url).includes("/hr-calendar-events") && init?.method === "POST")).toBe(false);
  });
});
