// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CelebrationEmailTab from "./CelebrationEmailTab";

const getCelebration = vi.hoisted(() => vi.fn());
const history = vi.hoisted(() => vi.fn());

vi.mock("../../services/companyEmailService", () => ({
  companyEmailApi: {
    getCelebration,
    history,
    saveCelebration: vi.fn(),
    preview: vi.fn(),
  },
}));

vi.mock("../../services/authService", () => ({
  authService: {
    uploadManagedFile: vi.fn(),
  },
}));

vi.mock("../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CelebrationEmailTab variable palettes", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("limits each HR email template to its relevant variable palette", async () => {
    getCelebration.mockResolvedValue({
      birthdayEnabled: true,
      holidayEnabled: true,
      sendTime: "08:00",
      birthdayTemplate: {
        subject: "Chúc mừng sinh nhật {{employeeName}}",
        html: "<p>Thân gửi {{employeeName}} từ {{companyName}}</p>",
      },
      holidayTemplate: {
        subject: "Chúc mừng {{holidayName}}",
        html: "<p>{{companyName}} chúc mừng {{holidayName}}</p>",
      },
      holidayOverrides: [],
    });
    history.mockResolvedValue([]);

    render(<CelebrationEmailTab />);

    const birthdayTitle = await screen.findByText(/Mẫu thư chúc mừng sinh nhật/i);
    expect(birthdayTitle).toBeTruthy();

    const birthdaySection = birthdayTitle.closest("section");
    const holidayTitle = screen.getByText(/Mẫu thư chúc mừng lễ\/Tết/i);
    const holidaySection = holidayTitle.closest("section");

    if (!(birthdaySection instanceof HTMLElement) || !(holidaySection instanceof HTMLElement)) {
      throw new Error("Template sections are not present");
    }

    expect(within(birthdaySection).getByText(/\[Tên nhân sự\]/i)).toBeTruthy();
    expect(within(birthdaySection).getAllByRole("button", { name: /Tên nhân sự/i }).length).toBeGreaterThan(0);
    expect(within(birthdaySection).queryByRole("button", { name: /Tên ngày lễ/i })).toBeNull();

    expect(within(holidaySection).getByRole("button", { name: /Tên ngày lễ/i })).toBeTruthy();
  });
});
