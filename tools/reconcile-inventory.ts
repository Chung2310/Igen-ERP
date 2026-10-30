import { mongo } from "mongoose";
import { mkdir, open, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { AuditInputError, reconcileInventory, validateBaseline } from "../server/modules/inventory/reconciliation/reconciliation.service";
import { csvColumns, csvFinding } from "../server/modules/inventory/reconciliation/reconciliation-output";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Read-only inventory reconciliation.\nSet INVENTORY_AUDIT_MONGODB_URI explicitly.\nUsage: npm run audit:inventory -- --company CODE --db DATABASE --out NEW_DIRECTORY [--branch OBJECT_ID] [--warehouse OBJECT_ID] [--baseline FILE.json | --ledger-complete] [--batch-size 200] [--max-documents 100000]\nOutputs: findings.jsonl, findings.csv, summary.json. Without summary.complete=true the run is incomplete. Exit 0=clean, 2=findings/review, 1=incomplete/failure. Requires MongoDB snapshot reads (replica set/sharded cluster, MongoDB 5+). No application initialization or database writes.");
    return;
  }
  const values: Record<string, string> = {};
  const flags = new Set(["company", "db", "out", "branch", "warehouse", "baseline", "batch-size", "max-documents"]);
  let ledgerComplete = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ledger-complete" && !ledgerComplete) { ledgerComplete = true; continue; }
    const key = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || !flags.has(key) || values[key] !== undefined || !args[i + 1] || args[i + 1].startsWith("--")) throw new AuditInputError("Tham số không hợp lệ/trùng; xem --help.");
    values[key] = args[++i];
  }
  if (!values.company?.trim() || !values.db?.trim() || !values.out?.trim()) throw new AuditInputError("Bắt buộc --company, --db, --out; không tự chọn database hay nơi ghi báo cáo.");
  const uri = process.env.INVENTORY_AUDIT_MONGODB_URI;
  if (!uri) throw new AuditInputError("Thiếu biến INVENTORY_AUDIT_MONGODB_URI. Khuyến nghị tài khoản MongoDB chỉ có quyền read.");
  const companyCode = values.company.trim().toUpperCase();
  let baseline, baselineSha256: string | undefined;
  if (values.baseline) {
    if ((await stat(values.baseline)).size > 10 * 1024 * 1024) throw new AuditInputError("Baseline vượt 10 MB; chia phạm vi chi nhánh/kho.");
    const raw = await readFile(values.baseline, "utf8");
    baseline = validateBaseline(JSON.parse(raw), companyCode);
    baselineSha256 = createHash("sha256").update(raw).digest("hex");
  }
  if (baseline && ledgerComplete) throw new AuditInputError("Không dùng đồng thời --baseline và --ledger-complete.");
  const output = path.resolve(values.out);
  // A fresh directory prevents overwriting an earlier report. Partial artifacts
  // deliberately remain on failure and are never advertised as a complete run.
  await mkdir(output);
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 15000, appName: "inventory-readonly-reconciliation" });
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once("SIGINT", stop);
  let json: Awaited<ReturnType<typeof open>> | undefined, csv: Awaited<ReturnType<typeof open>> | undefined;
  const startedAt = new Date().toISOString();
  try {
    json = await open(path.join(output, "findings.jsonl.partial"), "wx");
    csv = await open(path.join(output, "findings.csv.partial"), "wx");
    await csv.writeFile("\uFEFF" + csvColumns.join(",") + "\r\n");
    await client.connect();
    const session = client.startSession({ snapshot: true });
    try {
      const result = await reconcileInventory(client.db(values.db), session, { companyCode, branchId: values.branch, warehouseId: values.warehouse }, async (finding) => {
        await json!.writeFile(JSON.stringify(finding) + "\n");
        await csv!.writeFile(csvFinding(finding));
      }, { baseline, ledgerComplete, batchSize: values["batch-size"] ? Number(values["batch-size"]) : undefined, maxDocuments: values["max-documents"] ? Number(values["max-documents"]) : undefined, signal: abort.signal });
      await json.close(); json = undefined;
      await csv.close(); csv = undefined;
      await rename(path.join(output, "findings.jsonl.partial"), path.join(output, "findings.jsonl"));
      await rename(path.join(output, "findings.csv.partial"), path.join(output, "findings.csv"));
      const summary = await open(path.join(output, "summary.json"), "wx");
      try { await summary.writeFile(JSON.stringify({ ...result, startedAt, completedAt: new Date().toISOString(), baselineSha256 }, null, 2)); } finally { await summary.close(); }
      console.log(JSON.stringify({ output, status: result.status, errors: result.errors, reviews: result.reviews, examined: result.examined }));
      process.exitCode = result.findings ? 2 : 0;
    } finally { await session.endSession(); }
  } finally {
    await json?.close(); await csv?.close(); await client.close(); process.removeListener("SIGINT", stop);
  }
}
main().catch((error) => {
  // Driver errors can embed connection details. Never print URI, stack or raw
  // database error messages into a report/log intended for sharing.
  console.error(error instanceof AuditInputError ? error.message : `Đối soát chưa hoàn tất (${error?.codeName || error?.name || "Error"}). Kiểm tra kết nối/quyền/snapshot và thư mục báo cáo.`);
  process.exitCode = 1;
});
