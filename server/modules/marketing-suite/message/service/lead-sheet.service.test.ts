import { beforeEach, describe, expect, it, vi } from "vitest";
import { queueLeadSheet, processLeadSheets } from "./lead-sheet.service";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadSheetSyncModel } from "../model/lead-sheet-sync.model";
import { googleCustomerSheetService } from "./google-customer-sheet.service";

vi.mock("../../shared/model/social-integration.model", () => ({ SocialIntegrationModel: { findOne: vi.fn() } }));
vi.mock("../model/crm-ticket.model", () => ({ CRMTicketModel: { findOne: vi.fn() } }));
vi.mock("../model/lead-sheet-sync.model", () => ({ LeadSheetSyncModel: {
  findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(),
} }));
vi.mock("./google-customer-sheet.service", () => ({ googleCustomerSheetService: { upsertLead: vi.fn() } }));

const selected = (value: unknown) => ({ select: () => ({ lean: async () => value }) }) as never;
const leased = (value: unknown) => ({ lean: async () => value }) as never;
const config = { enabled: true, spreadsheetId: "SHEET", sheetName: "Leads" };
const lead = { customerName: "An", phone: "0901234567", status: "warm", sourcePlatform: "zalo", sourceAccountId: "OA",
  intakeFields: [{ key: "need", label: "Nhu cầu" }], answers: { need: "Tư vấn" } };
const job = { _id: "JOB", companyCode: "ACME", integrationId: "OA-INTEGRATION", leadId: "LEAD", destination: "SHEET/Leads",
  revision: 2, attempts: 1, sheetRow: undefined };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(SocialIntegrationModel.findOne).mockReturnValue(selected({ _id: "OA-INTEGRATION", platform: "Zalo", username: "OA",
    isConnected: true, crmLeadSheetConfig: config }));
  vi.mocked(CRMTicketModel.findOne).mockReturnValue(selected(lead));
  vi.mocked(LeadSheetSyncModel.findOne).mockReturnValue(selected(null));
  vi.mocked(LeadSheetSyncModel.findOneAndUpdate).mockReturnValue(leased(null));
  vi.mocked(LeadSheetSyncModel.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
  vi.mocked(LeadSheetSyncModel.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
  vi.mocked(googleCustomerSheetService.upsertLead).mockResolvedValue(12);
});

describe("Lead Sheet synchronization", () => {
  it("queues a tenant and account scoped Lead snapshot, without duplicating an unchanged snapshot", async () => {
    await queueLeadSheet("ACME", "zalo", "OA", "LEAD");
    expect(SocialIntegrationModel.findOne).toHaveBeenCalledWith({ companyCode: "ACME", platform: "Zalo", username: "OA", isConnected: true });
    expect(LeadSheetSyncModel.findOneAndUpdate).toHaveBeenCalledWith(
      { companyCode: "ACME", integrationId: "OA-INTEGRATION", leadId: "LEAD" },
      expect.objectContaining({ $set: expect.objectContaining({ destination: "SHEET/Leads", status: "pending",
        payload: expect.objectContaining({ customerName: "An", answers: { need: "Tư vấn" } }) }) }), expect.objectContaining({ upsert: true }));
  });

  it("sends the Lead to its configured account Sheet and stores its stable row number", async () => {
    vi.mocked(LeadSheetSyncModel.findOneAndUpdate).mockReturnValueOnce(leased(job)).mockReturnValue(leased(null));
    await processLeadSheets();
    expect(SocialIntegrationModel.findOne).toHaveBeenCalledWith({ _id: "OA-INTEGRATION", companyCode: "ACME", isConnected: true });
    expect(googleCustomerSheetService.upsertLead).toHaveBeenCalledWith("SHEET", "Leads", expect.objectContaining({
      key: "ACME:OA-INTEGRATION:LEAD", customerName: "An", answers: { need: "Tư vấn" },
    }), undefined, false);
    expect(LeadSheetSyncModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, companyCode: "ACME", leaseId: expect.any(String) }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "synced", sheetRow: 12 }) }));
  });

  it("does not write a Lead into a connected account that does not own its source conversation", async () => {
    vi.mocked(LeadSheetSyncModel.findOneAndUpdate).mockReturnValueOnce(leased(job)).mockReturnValue(leased(null));
    vi.mocked(CRMTicketModel.findOne).mockReturnValue(selected({ ...lead, sourceAccountId: "OTHER-OA" }));
    await processLeadSheets();
    expect(googleCustomerSheetService.upsertLead).not.toHaveBeenCalled();
    expect(LeadSheetSyncModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "skipped" }) }));
  });
});
