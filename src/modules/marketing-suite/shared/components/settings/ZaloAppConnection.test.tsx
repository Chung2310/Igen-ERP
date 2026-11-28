// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ZaloAppConnection from "./ZaloAppConnection";
import { socialIntegrationService, type SocialIntegration } from "../../services/socialIntegrationService";
vi.mock("../../services/socialIntegrationService", () => ({ socialIntegrationService: { startZaloOAuth: vi.fn() } }));
const navigate = vi.fn();
const stored = { _id: "oa-connection", zaloAppMode: "custom", zaloAppId: "200", hasZaloAppSecret: true, hasZaloWebhookSecret: true } as SocialIntegration;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(socialIntegrationService.startZaloOAuth).mockResolvedValue("https://oauth.zaloapp.com/v4/oa/permission?app_id=200"); });
afterEach(cleanup);
it("uses the shared App when connecting by default", async () => {
  render(<ZaloAppConnection navigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Kết nối Zalo OA" }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(socialIntegrationService.startZaloOAuth).toHaveBeenCalledExactlyOnceWith({ appMode: "default" });
});
it("keeps saved secrets blank on reconnect and sends only the owned connection and App ID", async () => {
  render(<ZaloAppConnection integration={stored} navigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Cấu hình App / Kết nối lại" }));
  expect((screen.getByLabelText(/App Secret/) as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Cấp quyền lại cho OA này" }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(socialIntegrationService.startZaloOAuth).toHaveBeenCalledExactlyOnceWith({ appMode: "custom", integrationId: stored._id, appId: "200" });
});
it("requires new credentials after changing App and clears secrets after starting OAuth", async () => {
  render(<ZaloAppConnection integration={stored} navigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Cấu hình App / Kết nối lại" }));
  fireEvent.change(screen.getByLabelText(/App ID/), { target: { value: "400" } });
  fireEvent.click(screen.getByRole("button", { name: "Cấp quyền lại cho OA này" }));
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  expect(screen.getByLabelText(/App Secret/).getAttribute("aria-invalid")).toBe("true");
  expect(socialIntegrationService.startZaloOAuth).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/App Secret/), { target: { value: "private-key" } });
  fireEvent.change(screen.getByLabelText(/Khóa xác minh webhook/), { target: { value: "webhook-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Cấp quyền lại cho OA này" }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(socialIntegrationService.startZaloOAuth).toHaveBeenCalledExactlyOnceWith({ appMode: "custom", integrationId: stored._id, appId: "400", appSecret: "private-key", webhookSecret: "webhook-key" });
  expect((screen.getByLabelText(/App Secret/) as HTMLInputElement).value).toBe("");
});
it("shows a failed connection inline and allows retry", async () => {
  vi.mocked(socialIntegrationService.startZaloOAuth).mockRejectedValue(new Error("Không thể kết nối Zalo"));
  render(<ZaloAppConnection navigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Kết nối Zalo OA" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Không thể kết nối Zalo");
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Kết nối Zalo OA" }).hasAttribute("disabled")).toBe(false);
});
