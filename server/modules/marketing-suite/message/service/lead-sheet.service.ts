import { createHash, randomUUID } from "node:crypto";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadSheetSyncModel } from "../model/lead-sheet-sync.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { googleCustomerSheetService } from "./google-customer-sheet.service";

export const LEAD_SHEET_MAX_ATTEMPTS = 5;
const platformNames = { facebook: "Facebook", zalo: "Zalo", tiktok: "TikTok" } as const;
const sheetDestination = (config: { spreadsheetId: string; sheetName: string }) => `${config.spreadsheetId}/${config.sheetName}`;
function leadSheetPayload(lead: any) {
  return {
    customerName: lead.customerName, phone: lead.phone, email: lead.email, company: lead.company,
    productOfChoice: lead.productOfChoice, value: lead.value, status: lead.status,
    collectionStatus: lead.collectionStatus, sourcePlatform: lead.sourcePlatform, sourceAccountId: lead.sourceAccountId,
    intakeFields: lead.intakeFields || [], answers: lead.answers || {}, createdAt: lead.createdAt, updatedAt: lead.updatedAt,
  };
}
function leadSheetHash(destination: string, payload: unknown) {
  return createHash("sha256").update(JSON.stringify({ destination, payload })).digest("hex");
}

/** Queue an explicitly selected ERP Lead for the optional Google Sheets export. */
export async function queueLeadSheet(companyCode: string, platform: keyof typeof platformNames, accountId: string, leadId: string) {
  const [integration, lead] = await Promise.all([
    SocialIntegrationModel.findOne({ companyCode, platform: platformNames[platform], username: accountId, isConnected: true })
      .select("crmLeadSheetConfig").lean(),
    CRMTicketModel.findOne({ companyCode, _id: leadId })
      .select("customerName phone email company productOfChoice value status collectionStatus sourcePlatform sourceAccountId intakeFields answers createdAt updatedAt").lean(),
  ]);
  const config = integration?.crmLeadSheetConfig;
  if (!integration || !config?.enabled || !config.spreadsheetId || !lead) return false;
  const payload = leadSheetPayload(lead);
  const destination = sheetDestination(config);
  const contentHash = leadSheetHash(destination, payload);
  const key = { companyCode, integrationId: String(integration._id), leadId };
  const existing = await LeadSheetSyncModel.findOne(key).select("contentHash status destination").lean();
  if (existing?.contentHash === contentHash && ["pending", "syncing", "synced"].includes(existing.status)) return true;
  await LeadSheetSyncModel.findOneAndUpdate(key, {
    $set: { destination, payload, contentHash, status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: "" },
    ...(existing?.destination && existing.destination !== destination ? { $unset: { sheetRow: 1 } } : {}),
    $inc: { revision: 1 },
  }, { upsert: true, setDefaultsOnInsert: true });
  return true;
}

let running = false;
let timer: NodeJS.Timeout | undefined;

export async function processLeadSheets() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await LeadSheetSyncModel.updateMany({ status: "syncing", attempts: { $gte: LEAD_SHEET_MAX_ATTEMPTS }, leaseUntil: { $lte: now } }, {
      $set: { status: "failed", lastError: "Đã hết số lần tự đồng bộ. Kiểm tra quyền truy cập Sheet rồi chọn Thử đồng bộ lại." },
      $unset: { leaseId: 1, leaseUntil: 1 },
    });
    for (let count = 0; count < 20; count++) {
      const leaseTime = new Date();
      const leaseId = randomUUID();
      const job = await LeadSheetSyncModel.findOneAndUpdate({
        attempts: { $lt: LEAD_SHEET_MAX_ATTEMPTS }, nextAttemptAt: { $lte: leaseTime },
        $and: [
          { $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: leaseTime } }] },
          { $or: [{ status: { $in: ["pending", "failed"] } }, { status: "syncing", leaseUntil: { $lte: leaseTime } }] },
        ],
      }, { $set: { status: "syncing", leaseId, leaseUntil: new Date(leaseTime.getTime() + 120_000) }, $inc: { attempts: 1 } },
      { new: true, sort: { nextAttemptAt: 1 } }).lean();
      if (!job) break;
      const lease = { _id: job._id, companyCode: job.companyCode, leaseId };
      const heartbeat = setInterval(() => {
        void LeadSheetSyncModel.updateOne(lease, { $set: { leaseUntil: new Date(Date.now() + 120_000) } }).catch(() => undefined);
      }, 30_000);
      heartbeat.unref();
      try {
        const integration = await SocialIntegrationModel.findOne({ _id: job.integrationId, companyCode: job.companyCode, isConnected: true })
          .select("platform username crmLeadSheetConfig").lean();
        const config = integration?.crmLeadSheetConfig;
        const lead = await CRMTicketModel.findOne({ _id: job.leadId, companyCode: job.companyCode })
          .select("customerName phone email company productOfChoice value status collectionStatus sourcePlatform sourceAccountId intakeFields answers createdAt updatedAt").lean();
        const expectedPlatform = integration?.platform === "Facebook" ? "facebook" : integration?.platform === "Zalo" ? "zalo" : integration?.platform === "TikTok" ? "tiktok" : "";
        const enabled = Boolean(config?.enabled && config.spreadsheetId && lead && expectedPlatform
          && config.spreadsheetId + "/" + config.sheetName === job.destination
          && lead.sourcePlatform === expectedPlatform && lead.sourceAccountId === integration?.username);
        let sheetRow = job.sheetRow;
        if (enabled && lead) sheetRow = await googleCustomerSheetService.upsertLead(config!.spreadsheetId, config!.sheetName, {
          key: `${job.companyCode}:${job.integrationId}:${job.leadId}`,
          customerName: lead.customerName,
          phone: lead.phone,
          email: lead.email,
          company: lead.company,
          productOfChoice: lead.productOfChoice,
          value: lead.value,
          status: lead.status,
          collectionStatus: lead.collectionStatus,
          sourcePlatform: lead.sourcePlatform,
          sourceAccountId: lead.sourceAccountId,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
          answers: lead.answers as Record<string, string> | undefined,
          intakeFields: (lead.intakeFields || []).map(field => ({ key: field.key, label: field.label })),
        }, job.sheetRow, job.attempts > 1);
        await LeadSheetSyncModel.updateOne({ ...lease, revision: job.revision }, {
          $set: { status: enabled ? "synced" : "skipped", lastError: "", ...(enabled ? { sheetRow, syncedAt: new Date() } : {}) },
          $unset: { leaseId: 1, leaseUntil: 1 },
        });
      } catch (error) {
        await LeadSheetSyncModel.updateOne({ ...lease, revision: job.revision }, {
          $set: { status: "failed", lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            nextAttemptAt: new Date(Date.now() + Math.min(1_800_000, 30_000 * 2 ** job.attempts)) },
          $unset: { leaseId: 1, leaseUntil: 1 },
        });
      } finally {
        clearInterval(heartbeat);
        await LeadSheetSyncModel.updateOne({ ...lease, revision: { $ne: job.revision } }, {
          $set: { status: "pending", attempts: 0, nextAttemptAt: new Date() }, $unset: { leaseId: 1, leaseUntil: 1 },
        });
      }
    }
  } finally { running = false; }
}

export function startLeadSheetWorker() {
  if (timer) return;
  const tick = () => { void processLeadSheets().catch(error => console.error("[LeadSheet] Worker failed:", error)); };
  timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
}
