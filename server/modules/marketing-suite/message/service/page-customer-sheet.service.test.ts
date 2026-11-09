import { beforeEach, describe, expect, it, vi } from "vitest";
import { queuePageCustomerSheet, processPageCustomerSheets, CUSTOMER_SHEET_MAX_ATTEMPTS } from "./page-customer-sheet.service";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { PageCustomerSheetSyncModel } from "../model/page-customer-sheet-sync.model";
import { googleCustomerSheetService } from "./google-customer-sheet.service";

vi.mock("../../shared/model/social-integration.model", () => ({ SocialIntegrationModel: { findOne: vi.fn() } }));
vi.mock("../../../customer-management/models/customer.model", () => ({ CustomerModel: { findOne: vi.fn(), exists: vi.fn() } }));
vi.mock("../model/page-customer-sheet-sync.model", () => ({ PageCustomerSheetSyncModel: {
  findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(),
} }));
vi.mock("./google-customer-sheet.service", () => ({ googleCustomerSheetService: { upsert: vi.fn() } }));
const selected = (value: unknown) => ({ select: () => ({ lean: async () => value }) }) as never;
const leased = (value: unknown) => ({ lean: async () => value }) as never;
const config = { enabled: true, spreadsheetId: "SHEET", sheetName: "Leads" };
const job = { _id: "JOB", companyCode: "ACME", integrationId: "PAGE", customerId: "CUSTOMER", destination: "SHEET/Leads",
  revision: 2, attempts: 1, payload: { name: "An", phone: "0901234567" } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(SocialIntegrationModel.findOne).mockReturnValue(selected({ _id: "PAGE", leadSheetConfig: config, displayName: "Page ACME" }));
  vi.mocked(CustomerModel.findOne).mockReturnValue(selected({ customerCode: "KH01", name: "An", phone: "0901234567", notes: "Cần tư vấn" }));
  vi.mocked(CustomerModel.exists).mockResolvedValue({ _id: "CUSTOMER" } as never);
  vi.mocked(PageCustomerSheetSyncModel.findOne).mockReturnValue(selected(null));
  vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mockReturnValue(leased(null));
  vi.mocked(PageCustomerSheetSyncModel.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
  vi.mocked(PageCustomerSheetSyncModel.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
  vi.mocked(googleCustomerSheetService.upsert).mockResolvedValue(undefined);
});
describe("ERP customer to Sheet synchronization", () => {
  it("does not queue exports while the Page setting is disabled", async () => {
    vi.mocked(SocialIntegrationModel.findOne).mockReturnValue(selected({ leadSheetConfig: { enabled: false } }));
    await queuePageCustomerSheet("ACME", "PAGE-ID", "CUSTOMER");
    expect(CustomerModel.findOne).not.toHaveBeenCalled();
    expect(PageCustomerSheetSyncModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("queues a tenant-scoped snapshot of the already saved ERP customer", async () => {
    await queuePageCustomerSheet("ACME", "PAGE-ID", "CUSTOMER");
    expect(CustomerModel.findOne).toHaveBeenCalledWith({ companyCode: "ACME", _id: "CUSTOMER" });
    expect(PageCustomerSheetSyncModel.findOneAndUpdate).toHaveBeenCalledWith(
      { companyCode: "ACME", integrationId: "PAGE", customerId: "CUSTOMER" },
      expect.objectContaining({ $set: expect.objectContaining({ destination: "SHEET/Leads", status: "pending",
        payload: expect.objectContaining({ customerCode: "KH01", notes: "Cần tư vấn" }) }) }), expect.objectContaining({ upsert: true }));
  });
  it("does not queue the same unchanged customer snapshot again", async () => {
    await queuePageCustomerSheet("ACME", "PAGE-ID", "CUSTOMER");
    const update = vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mock.calls[0][1] as { $set: { contentHash: string } };
    vi.mocked(PageCustomerSheetSyncModel.findOne).mockReturnValue(selected({ contentHash: update.$set.contentHash }));
    vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mockClear();
    await queuePageCustomerSheet("ACME", "PAGE-ID", "CUSTOMER");
    expect(PageCustomerSheetSyncModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("leases and syncs a job without exporting into another company's integration", async () => {
    vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mockReturnValueOnce(leased(job));
    await processPageCustomerSheets();
    expect(SocialIntegrationModel.findOne).toHaveBeenCalledWith({ _id: "PAGE", companyCode: "ACME", platform: "Facebook", isConnected: true });
    expect(googleCustomerSheetService.upsert).toHaveBeenCalledWith("SHEET", "Leads", expect.objectContaining({ key: "ACME:PAGE:CUSTOMER" }));
    expect(PageCustomerSheetSyncModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, companyCode: "ACME", leaseId: expect.any(String) }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "synced", lastError: "" }) }));
    expect(vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mock.calls[0][0]).toEqual(expect.objectContaining({ attempts: { $lt: CUSTOMER_SHEET_MAX_ATTEMPTS } }));
  });
  it("retains a failed job with capped retry and leaves ERP customers untouched", async () => {
    vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mockReturnValueOnce(leased(job));
    vi.mocked(googleCustomerSheetService.upsert).mockRejectedValueOnce(new Error("Google Sheet permission denied"));
    await processPageCustomerSheets();
    expect(PageCustomerSheetSyncModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "failed", lastError: "Google Sheet permission denied", nextAttemptAt: expect.any(Date) }) }));
  });
  it("skips an export if the Sheet destination changed or was disabled", async () => {
    vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mockReturnValueOnce(leased(job));
    vi.mocked(SocialIntegrationModel.findOne).mockReturnValue(selected({ leadSheetConfig: { ...config, spreadsheetId: "OTHER" } }));
    await processPageCustomerSheets();
    expect(googleCustomerSheetService.upsert).not.toHaveBeenCalled();
    expect(PageCustomerSheetSyncModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }), expect.objectContaining({ $set: expect.objectContaining({ status: "skipped" }) }));
  });
  it("keeps a newer revision pending when an older Sheet request finishes", async () => {
    vi.mocked(PageCustomerSheetSyncModel.findOneAndUpdate).mockReturnValueOnce(leased(job));
    await processPageCustomerSheets();
    expect(PageCustomerSheetSyncModel.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ revision: { $ne: 2 }, leaseId: expect.any(String) }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "pending", attempts: 0 }) }));
  });
});
