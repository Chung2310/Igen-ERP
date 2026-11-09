import { createHash, randomUUID } from "node:crypto";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { PageCustomerSheetSyncModel } from "../model/page-customer-sheet-sync.model";
import { googleCustomerSheetService } from "./google-customer-sheet.service";

export const CUSTOMER_SHEET_MAX_ATTEMPTS = 5;
export const customerSheetDestination = (config: { spreadsheetId: string; sheetName: string }) =>
  `${config.spreadsheetId}/${config.sheetName}`;

/** Queue only the customer already saved in ERP; a Sheets failure must never undo that save. */
export async function queuePageCustomerSheet(companyCode: string, pageId: string, customerId: string) {
  const integration = await SocialIntegrationModel.findOne({ companyCode, platform: "Facebook", username: pageId, isConnected: true })
    .select("leadSheetConfig displayName").lean();
  const config = integration?.leadSheetConfig;
  if (!integration || !config?.enabled || !config.spreadsheetId) return;
  const customer = await CustomerModel.findOne({ companyCode, _id: customerId })
    .select("customerCode name phone email address notes").lean();
  if (!customer) return;
  const payload = { customerCode: customer.customerCode, name: customer.name, phone: customer.phone,
    email: customer.email || "", address: customer.address || "", notes: customer.notes || "", pageName: integration.displayName };
  const destination = customerSheetDestination(config);
  const contentHash = createHash("sha256").update(JSON.stringify({ destination, payload })).digest("hex");
  const key = { companyCode, integrationId: String(integration._id), customerId };
  const existing = await PageCustomerSheetSyncModel.findOne(key).select("contentHash").lean();
  if (existing?.contentHash === contentHash) return;
  await PageCustomerSheetSyncModel.findOneAndUpdate(key, {
    $set: { destination, payload, contentHash, status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: "" },
    $inc: { revision: 1 },
  }, { upsert: true, setDefaultsOnInsert: true });
}

let running = false;
let timer: NodeJS.Timeout | undefined;

export async function processPageCustomerSheets() {
  if (running) return;
  running = true;
  try {
    await PageCustomerSheetSyncModel.updateMany({ status: "syncing", attempts: { $gte: CUSTOMER_SHEET_MAX_ATTEMPTS },
      leaseUntil: { $lte: new Date() } }, {
      $set: { status: "failed", lastError: "Đã hết số lần tự thử đồng bộ. Hãy kiểm tra kết nối Sheet và chọn Thử đồng bộ lại." },
      $unset: { leaseId: 1, leaseUntil: 1 },
    });
    for (let count = 0; count < 10; count++) {
      const now = new Date();
      const leaseId = randomUUID();
      const job = await PageCustomerSheetSyncModel.findOneAndUpdate({
        attempts: { $lt: CUSTOMER_SHEET_MAX_ATTEMPTS }, nextAttemptAt: { $lte: now },
        $and: [
          { $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
          { $or: [{ status: { $in: ["pending", "failed"] } }, { status: "syncing", leaseUntil: { $lte: now } }] },
        ],
      }, { $set: { status: "syncing", leaseId, leaseUntil: new Date(now.getTime() + 120_000) }, $inc: { attempts: 1 } },
      { new: true, sort: { nextAttemptAt: 1 } }).lean();
      if (!job) break;
      const lease = { _id: job._id, companyCode: job.companyCode, leaseId };
      const heartbeat = setInterval(() => {
        void PageCustomerSheetSyncModel.updateOne(lease, { $set: { leaseUntil: new Date(Date.now() + 120_000) } }).catch(() => undefined);
      }, 30_000);
      heartbeat.unref();
      try {
        const integration = await SocialIntegrationModel.findOne({ _id: job.integrationId, companyCode: job.companyCode,
          platform: "Facebook", isConnected: true }).select("leadSheetConfig").lean();
        const config = integration?.leadSheetConfig;
        const customerExists = await CustomerModel.exists({ _id: job.customerId, companyCode: job.companyCode });
        const enabled = config?.enabled && config.spreadsheetId && customerExists
          && customerSheetDestination(config) === job.destination;
        if (enabled) await googleCustomerSheetService.upsert(config.spreadsheetId, config.sheetName, {
          ...job.payload, key: `${job.companyCode}:${job.integrationId}:${job.customerId}`,
        });
        await PageCustomerSheetSyncModel.updateOne({ ...lease, revision: job.revision }, {
          $set: { status: enabled ? "synced" : "skipped", lastError: "", ...(enabled ? { syncedAt: new Date() } : {}) },
          $unset: { leaseId: 1, leaseUntil: 1 },
        });
      } catch (error) {
        await PageCustomerSheetSyncModel.updateOne({ ...lease, revision: job.revision }, {
          $set: { status: "failed", lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            nextAttemptAt: new Date(Date.now() + Math.min(1_800_000, 30_000 * 2 ** job.attempts)) },
          $unset: { leaseId: 1, leaseUntil: 1 },
        });
      } finally {
        clearInterval(heartbeat);
        // An update arriving during the request remains pending and must not be marked synced by an older revision.
        await PageCustomerSheetSyncModel.updateOne({ ...lease, revision: { $ne: job.revision } }, {
          $set: { status: "pending", attempts: 0, nextAttemptAt: new Date() }, $unset: { leaseId: 1, leaseUntil: 1 },
        });
      }
    }
  } finally { running = false; }
}

export function startPageCustomerSheetWorker() {
  if (timer) return;
  const tick = () => { void processPageCustomerSheets().catch(error => console.error("[PageCustomerSheet] Worker failed:", error)); };
  timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
}
