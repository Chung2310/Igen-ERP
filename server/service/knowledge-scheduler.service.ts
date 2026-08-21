import { CompanyModel } from "../model/company.model";
import { knowledgeIngestService } from "./knowledge-ingest.service";

/** Runs once per server day at 02:00 Vietnam local time; each company is isolated on failure. */
export async function runKnowledgeSyncScan(now = new Date()) {
  const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (localHour !== 2) return { synced: 0, skipped: true };
  const companies: any[] = await CompanyModel.find({ lifecycleStatus: "active", driveFolderId: { $ne: "" }, "driveOAuth.refreshToken": { $ne: "" } }).select("code").lean();
  let synced = 0;
  for (const company of companies) {
    try { await knowledgeIngestService.syncCompanyDrive(company.code); synced++; }
    catch (error) { console.error("[KnowledgeScheduler]", company.code, error); }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return { synced, skipped: false };
}

export function startKnowledgeScheduler() {
  let running = false;
  const timer = setInterval(async () => { if (running) return; running = true; try { await runKnowledgeSyncScan(); } finally { running = false; } }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
