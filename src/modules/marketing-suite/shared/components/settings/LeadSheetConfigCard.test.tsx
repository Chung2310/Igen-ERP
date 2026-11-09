// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LeadSheetConfigCard from "./LeadSheetConfigCard";
import { leadSheetService } from "../../services/leadSheetService";

vi.mock("../../services/leadSheetService", () => ({ leadSheetService: { get: vi.fn(), save: vi.fn(), test: vi.fn(), retry: vi.fn() } }));
const integration = { _id: "1234567890abcdef12345678", platform: "Facebook" as const, displayName: "Ruby Queen", createdBy: "USER", isConnected: true };
const status = { config: { enabled: false, spreadsheetUrl: "", sheetName: "Leads" }, serviceAccountEmail: "sync@example.com", pending: 0, failed: 0, synced: 0, lastError: "" };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(leadSheetService.get).mockResolvedValue(status); });
afterEach(cleanup);
it("keeps the Sheet option off until the user enables and saves it", async () => {
  render(<LeadSheetConfigCard integration={integration} />);
  const toggle = await screen.findByRole("checkbox", { name: "Bật đồng bộ khách sang Sheet" });
  await waitFor(() => expect(toggle.hasAttribute("disabled")).toBe(false));
  expect((toggle as HTMLInputElement).checked).toBe(false);
  fireEvent.click(toggle);
  fireEvent.change(screen.getByRole("textbox", { name: "Link Google Sheet" }), { target: { value: "https://docs.google.com/spreadsheets/d/SHEET/edit" } });
  vi.mocked(leadSheetService.save).mockResolvedValue({ enabled: true, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/SHEET/edit", sheetName: "Leads" });
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình khách" }));
  await waitFor(() => expect(leadSheetService.save).toHaveBeenCalledWith(integration._id, { enabled: true, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/SHEET/edit", sheetName: "Leads" }));
});
it("reports a missing link inline without making a save request", async () => {
  render(<LeadSheetConfigCard integration={integration} />);
  await waitFor(() => expect(screen.getByRole("checkbox").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình khách" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Cần nhập link Google Sheet.");
  expect(leadSheetService.save).not.toHaveBeenCalled();
});
it("shows sync failures and allows an explicit retry", async () => {
  vi.mocked(leadSheetService.get).mockResolvedValue({ ...status, config: { ...status.config, enabled: true }, failed: 2, lastError: "Sheet permission denied" });
  vi.mocked(leadSheetService.retry).mockResolvedValue({ queued: 2 });
  render(<LeadSheetConfigCard integration={integration} />);
  fireEvent.click(await screen.findByRole("button", { name: "Thử đồng bộ lại" }));
  await waitFor(() => expect(leadSheetService.retry).toHaveBeenCalledWith(integration._id));
  expect(screen.getByText(/Hồ sơ khách vẫn được giữ trong ERP/)).toBeTruthy();
});
