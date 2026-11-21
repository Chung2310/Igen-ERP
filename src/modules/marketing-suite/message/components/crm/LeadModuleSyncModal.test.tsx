// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { leadModuleDestinationService } from "../../../shared/services/leadModuleDestinationService";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";
import { LeadModuleSyncModal } from "./LeadModuleSyncModal";

const lead = {
  id: "lead", customerName: "Khách thử", phone: "0912345678", email: "test@erp.invalid", sourcePlatform: "zalo", sourceAccountId: "oa",
} as ExtendedLeadCard;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preselects the source destination and creates the record only after confirmation", async () => {
  const resolve = vi.spyOn(leadModuleDestinationService, "resolveForLead").mockResolvedValue({
    targetModule: "healthcare", availableModules: ["students", "healthcare"],
  });
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { _id: "patient-1" } }) });
  vi.stubGlobal("fetch", fetch);
  const target = { targetModule: "healthcare", targetRecordId: "patient-1" } as const;
  const linked = { ...target, syncedAt: "2026-11-18T00:00:00Z", syncedBy: "staff" };
  const sync = vi.spyOn(crmService, "markLeadModuleSynced").mockResolvedValue(linked);
  const onCompleted = vi.fn();
  render(<LeadModuleSyncModal lead={lead} companyCode="ACME" branchId="main" onCompleted={onCompleted} onClose={vi.fn()} />);
  const confirm = await screen.findByRole("button", { name: "Tạo hồ sơ bệnh nhân" });
  expect(screen.getByRole("button", { name: "Phân hệ đích" }).textContent).toContain("Y tế");
  expect(resolve).toHaveBeenCalledWith("lead", expect.any(AbortSignal));
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(linked));
  expect(fetch).toHaveBeenCalledWith("/api/v1/healthcare/patients", expect.objectContaining({ method: "POST" }));
  expect(sync).toHaveBeenCalledWith("lead", target);
});

it("requires an explicit destination for a shared OA, even when only one module is available", async () => {
  vi.spyOn(leadModuleDestinationService, "resolveForLead").mockResolvedValue({
    targetModule: null, availableModules: ["healthcare"],
  });
  render(<LeadModuleSyncModal lead={lead} companyCode="ACME" branchId="main" onCompleted={vi.fn()} onClose={vi.fn()} />);
  const select = screen.getByRole<HTMLButtonElement>("button", { name: "Phân hệ đích" });
  await waitFor(() => expect(select.disabled).toBe(false));
  expect(select.textContent).toContain("Chọn phân hệ");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Tạo hồ sơ" }).disabled).toBe(true);
  fireEvent.click(select);
  fireEvent.click(screen.getByRole("option", { name: /Y tế/ }));
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Tạo hồ sơ bệnh nhân" }).disabled).toBe(false);
});
