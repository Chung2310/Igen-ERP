// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import IntegrationSettingsTab from "./IntegrationSettingsTab";
import { socialIntegrationService } from "../../services/socialIntegrationService";
import { leadModuleDestinationService } from "../../services/leadModuleDestinationService";
import type { UserProfile } from "../../types/index";

vi.mock("./TelegramOrderConfigCard", () => ({
  default: ({ userProfile }: { userProfile: unknown }) => (
    <div data-testid="telegram-card">Telegram Card for {JSON.stringify(userProfile)}</div>
  ),
}));

vi.mock("./SepayConfigCard", () => ({
  default: ({ userProfile }: { userProfile: unknown }) => (
    <div data-testid="sepay-card">Sepay Card for {JSON.stringify(userProfile)}</div>
  ),
}));

it("renders both Telegram and SePay config cards with userProfile", () => {
  const profile = { email: "admin@erp.test", role: "admin", companyCode: "ERP" } as any;
  render(<IntegrationSettingsTab userProfile={profile} />);

  expect(screen.getByTestId("telegram-card")).toBeDefined();
  expect(screen.getByTestId("sepay-card")).toBeDefined();
  expect(screen.getByText(/Telegram Card for/)).toBeDefined();
  expect(screen.getByText(/Sepay Card for/)).toBeDefined();
  expect(screen.queryByText("Quản lý dữ liệu chat")).toBeNull();
  cleanup();
});

it("keeps chat reset collapsed and requires explicit company confirmation", async () => {
  const reset = vi.spyOn(socialIntegrationService, "resetCompanyChat").mockResolvedValue({ conversationCount: 2, messageCount: 5 });
  try {
    const profile = {
      email: "admin@erp.test", role: "admin", companyCode: "ERP", companyName: "Igen",
      permissions: ["social-integration:manage", "omni-inbox:manage"],
    } as UserProfile;
    render(<IntegrationSettingsTab userProfile={profile} />);
    const disclosure = screen.getByText("Quản lý dữ liệu chat").closest("details")!;
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Xóa dữ liệu chat" }));
    let dialog = screen.getByRole("alertdialog", { name: "Xóa dữ liệu chat của Igen (ERP)?" });
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xóa dữ liệu chat" }));
    dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa vĩnh viễn" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledWith("ERP");
    expect(await screen.findByText("Đã xóa 2 hội thoại và 5 tin nhắn.")).toBeDefined();
  } finally {
    cleanup();
    reset.mockRestore();
  }
});

it("configures a destination for a connected OA and lets it return to manual selection", async () => {
  const load = vi.spyOn(leadModuleDestinationService, "readSettings").mockResolvedValue({
    availableModules: ["students", "healthcare"],
    channels: [
      { platform: "zalo", accountId: "clinic", displayName: "OA Phòng khám", targetModule: null },
      { platform: "facebook", accountId: "school", displayName: "Page Tuyển sinh", targetModule: "students" },
    ],
  });
  const save = vi.spyOn(leadModuleDestinationService, "save").mockImplementation(async ({ targetModule }) => ({ targetModule }));
  try {
    render(<IntegrationSettingsTab userProfile={{
      companyCode: "ERP", permissions: ["social-integration:read", "social-integration:manage"],
    } as UserProfile} />);
    const clinic = await screen.findByRole<HTMLSelectElement>("combobox", { name: "OA Phòng khám" });
    const school = screen.getByRole<HTMLSelectElement>("combobox", { name: "Page Tuyển sinh" });
    const button = screen.getByRole("button", { name: "Lưu phân hệ nhận Lead cho OA Phòng khám" });
    expect(clinic.value).toBe("");
    expect(school.value).toBe("students");
    fireEvent.change(clinic, { target: { value: "healthcare" } });
    fireEvent.click(button);
    await screen.findByText("Đã lưu.");
    expect(save).toHaveBeenCalledWith({ platform: "zalo", accountId: "clinic", targetModule: "healthcare" });
    fireEvent.change(clinic, { target: { value: "" } });
    fireEvent.click(button);
    await screen.findByText("Đã lưu.");
    expect(save).toHaveBeenLastCalledWith({ platform: "zalo", accountId: "clinic", targetModule: null });
    expect(school.value).toBe("students");
  } finally {
    cleanup();
    load.mockRestore();
    save.mockRestore();
  }
});

