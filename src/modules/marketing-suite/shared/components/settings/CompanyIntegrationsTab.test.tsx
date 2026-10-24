// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CompanyIntegrationsTab from "./CompanyIntegrationsTab";
import { socialIntegrationService, type SocialIntegration } from "../../services/socialIntegrationService";

vi.mock("../../services/socialIntegrationService", () => ({ socialIntegrationService: {
  getIntegrations: vi.fn(), updateIntegration: vi.fn(), createIntegration: vi.fn(),
  validateFacebookIntegration: vi.fn(), validateZaloIntegration: vi.fn(), validateTikTokIntegration: vi.fn(),
} }));
vi.mock("../../services/authService", () => ({ getAccessToken: () => "test-session" }));
vi.mock("../../../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("./OrderSheetConfigCard", () => ({ default: () => null }));
vi.mock("./TelegramOrderConfigCard", () => ({ default: () => null }));
vi.mock("./SepayConfigCard", () => ({ default: () => null }));

const originalDialogMethods = ["showModal", "close"].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)] as const);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.open = false; } });
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.mocked(socialIntegrationService.updateIntegration).mockResolvedValue({} as SocialIntegration);
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const [name, descriptor] of originalDialogMethods) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

async function editAccount(platform: SocialIntegration["platform"]) {
  vi.mocked(socialIntegrationService.getIntegrations).mockResolvedValue([{
    _id: "account", platform, username: "123456", displayName: "Original name", isConnected: true,
    createdBy: "user", hasAccessToken: true, hasAppSecret: true, hasVerifyToken: true,
  }]);
  render(<CompanyIntegrationsTab userProfile={{ email: "user@erp.test", companyCode: "ERP", role: "admin" }} />);
  await waitFor(() => expect(socialIntegrationService.getIntegrations).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Xem danh sách tài khoản" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
  return screen.getByRole("button", { name: "Cập nhật" }).closest("form")!;
}

it.each(["Facebook", "Zalo", "TikTok"] as const)("edits %s metadata while preserving the hidden token", async (platform) => {
  const form = await editAccount(platform);
  fireEvent.change(screen.getAllByDisplayValue("Original name")[0], { target: { value: "Updated name" } });
  expect(form.checkValidity()).toBe(true);
  fireEvent.submit(form);
  await waitFor(() => expect(socialIntegrationService.updateIntegration).toHaveBeenCalledWith("account", expect.objectContaining({ displayName: "Updated name", accessToken: undefined })));
  expect(socialIntegrationService.createIntegration).not.toHaveBeenCalled();
  expect(socialIntegrationService.validateFacebookIntegration).not.toHaveBeenCalled();
  expect(socialIntegrationService.validateZaloIntegration).not.toHaveBeenCalled();
  expect(socialIntegrationService.validateTikTokIntegration).not.toHaveBeenCalled();
});

it("requires a new token when changing the account identity", async () => {
  const form = await editAccount("Facebook");
  fireEvent.change(screen.getByDisplayValue("123456"), { target: { value: "654321" } });
  expect(form.checkValidity()).toBe(false);
  fireEvent.submit(form);
  expect(socialIntegrationService.updateIntegration).not.toHaveBeenCalled();
});
