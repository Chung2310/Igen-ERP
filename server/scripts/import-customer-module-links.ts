import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { CustomerModel } from "../modules/customer-management/models/customer.model";
import { CustomerModuleLinkModel, type CustomerSourceModule } from "../modules/customer-management/models/customer-module-link.model";
import { linkExistingModuleRecord } from "../modules/customer-management/customer-module-links.router";
import { BranchModel } from "../model/branch.model";
import { UserModel } from "../model/user.model";
import { Student } from "../modules/student-management/models/student.model";
import { records } from "../modules/healthcare/store";

type Mapping = { module: CustomerSourceModule; sourceId: string; customerId: string; branchId: string };

async function main() {
  const [file, rawCompany, batchId, ...options] = process.argv.slice(2);
  const companyCode = rawCompany?.trim().toUpperCase();
  if (!file || !companyCode || !/^[a-z0-9_-]{1,80}$/i.test(batchId || "")
    || options.length > 1 || options.some(option => option !== "--apply")) {
    throw new Error("Cách chạy: npm run import:customer-module-links -- <file-json> <ma-cong-ty> <ma-lo> [--apply]");
  }
  const apply = options.includes("--apply");
  const mappings: unknown = JSON.parse(await readFile(file, "utf-8"));
  if (!Array.isArray(mappings) || !mappings.length || mappings.length > 1000) {
    throw new Error("Cung cấp danh sách từ 1 đến 1000 liên kết đã đối chiếu.");
  }
  const objectId = /^[a-f0-9]{24}$/i;
  const seen = new Set<string>();
  const rows = mappings.map((row: Partial<Mapping> | null, index) => {
    if (!row || (row.module !== "students" && row.module !== "healthcare")
      || typeof row.sourceId !== "string" || !row.sourceId || row.sourceId.length > 100
      || (row.module === "students" && !objectId.test(row.sourceId))
      || typeof row.customerId !== "string" || !objectId.test(row.customerId)
      || typeof row.branchId !== "string" || !objectId.test(row.branchId)) {
      throw new Error(`Dòng ${index + 1} cần module, sourceId, customerId và branchId hợp lệ.`);
    }
    const sourceId = row.module === "students" ? row.sourceId.toLowerCase() : row.sourceId;
    const key = `${row.module}:${sourceId}`;
    if (seen.has(key)) throw new Error(`Dòng ${index + 1} bị trùng hồ sơ nguồn.`);
    seen.add(key);
    return { module: row.module, sourceId,
      customerId: row.customerId.toLowerCase(), branchId: row.branchId.toLowerCase() } as Mapping;
  });

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Cần cung cấp MONGODB_URI của cơ sở dữ liệu đích.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, retryWrites: false });
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Chưa kết nối được cơ sở dữ liệu.");
    const verdicts = [];
    for (const [index, row] of rows.entries()) {
      const result = { row: index + 1, ...row };
      const branch = await BranchModel.exists({ _id: row.branchId, companyCode, isActive: true });
      const customer = await CustomerModel.exists({ _id: row.customerId, companyCode, status: "active", customerKind: { $ne: "business" } });
      if (!branch || !customer) {
        verdicts.push({ ...result, status: "outside_scope" });
        continue;
      }
      const source = row.module === "healthcare"
        ? await records(db, "patients").findOne({ companyCode, branchId: row.branchId, _id: row.sourceId }, { projection: { customerId: 1 } })
        : await Student.findOne({ _id: row.sourceId, branchId: row.branchId }).select("ownerId customerId").lean();
      if (!source || ("ownerId" in source && ![companyCode, row.branchId].includes(source.ownerId)
        && (!objectId.test(source.ownerId) || !await UserModel.exists({ _id: source.ownerId, companyCode })))) {
        verdicts.push({ ...result, status: "outside_scope" });
        continue;
      }
      const link = await CustomerModuleLinkModel.findOne({ companyCode, module: row.module, sourceId: row.sourceId }).select("customerId").lean();
      const linked = new Set([source.customerId, link?.customerId].filter(Boolean));
      const status = [...linked].some(customerId => customerId !== row.customerId)
        ? "conflict" : linked.has(row.customerId) ? "unchanged" : "ready";
      verdicts.push({ ...result, status });
    }
    console.log(JSON.stringify({ companyCode, batchId, mode: "preview", rows: verdicts }, null, 2));
    if (!apply) return;
    if (verdicts.some(row => row.status === "conflict" || row.status === "outside_scope")) {
      throw new Error("Lô có dòng mâu thuẫn hoặc sai phạm vi. Sửa danh sách rồi chạy kiểm tra lại.");
    }
    if (!verdicts.some(row => row.status === "ready")) return;
    await CustomerModuleLinkModel.createIndexes();
    for (const row of verdicts) {
      if (row.status === "ready") await linkExistingModuleRecord(companyCode, row.module, row.sourceId, row.customerId, "customer-link-import", batchId);
    }
    console.log(JSON.stringify({ companyCode, batchId, mode: "apply", linked: verdicts.filter(row => row.status === "ready").length }));
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : "Không nhập được các liên kết khách hàng.");
  process.exitCode = 1;
});
