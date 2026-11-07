import "dotenv/config";
import { createHash } from "node:crypto";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/igen-erp";
const parsed = new URL(uri);
if (parsed.protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname) || parsed.pathname !== "/igen-erp" || parsed.host.includes(",")) {
  throw new Error("Chỉ cho phép MongoDB local tại database igen-erp.");
}
const options = { serverSelectionTimeoutMS: 5000, autoIndex: false, retryWrites: false };
if (process.env.MONGODB_USER && process.env.MONGODB_PASSWORD && !parsed.username) {
  options.user = process.env.MONGODB_USER;
  options.pass = process.env.MONGODB_PASSWORD;
  options.authSource = process.env.MONGODB_AUTH_SOURCE || "admin";
}

const SEED = "local-worker-overview-v1";
const BRANCH = "6adeafc1bac4808f722790b5";
const OWNER = "6ae94fdacd18372f69eca48d";
const oid = (key) => new mongoose.Types.ObjectId(createHash("sha256").update(`${SEED}:${key}`).digest("hex").slice(0, 24));
const branchObjectId = new mongoose.Types.ObjectId(BRANCH);
const connection = mongoose.createConnection(uri, options);

try {
  await connection.asPromise();
  const db = connection.db;
  const branch = await db.collection("branches").findOne({ _id: branchObjectId, companyCode: "AKM", isActive: true });
  const owner = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(OWNER), companyCode: "AKM", branchId: BRANCH, isActive: { $ne: false } });
  if (!branch || !owner) throw new Error("Không tìm thấy chi nhánh và tài khoản AKM local.");

  const now = new Date();
  const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [year, month, day] = localToday.split("-").map(Number);
  const shift = (months, dayOfMonth) => {
    const date = new Date(Date.UTC(year, month - 1 + months, 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(dayOfMonth, last, months === 0 ? day : last)).padStart(2, "0")}`;
  };
  const plusDays = (days) => new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  const stamp = (date) => new Date(`${date}T10:00:00+07:00`);
  const base = { companyCode: "AKM", demoSeed: SEED, updatedAt: now };
  const partnerSpecs = [
    ["DEMO-LD-A", "Đối tác mẫu An Phát"],
    ["DEMO-LD-B", "Đối tác mẫu Bình Minh"],
    ["DEMO-LD-C", "Đối tác mẫu Thành Công"],
  ];
  const partners = partnerSpecs.map(([code, name], index) => ({ ...base, _id: oid(`partner:${index}`), branchId: BRANCH, code, name, phone: `090000${String(index + 1).padStart(4, "0")}`, email: `doitac-laodong-${index + 1}@example.invalid`, status: "active", note: "Dữ liệu mẫu local", deletedAt: null, createdAt: now }));
  const policyId = oid("policy");
  const policies = [{ ...base, _id: policyId, branchId: BRANCH, name: "Chính sách hoa hồng mẫu Lao động", version: 1, effectiveFrom: shift(-6, 1), effectiveTo: null, status: "active", settlementCycle: { type: "calendar_month" }, official: { enabled: true, maxMonths: 1, milestones: [{ month: 1, amount: 750_000, eligibilityRule: "manual_confirmation" }] }, seasonal: { enabled: true, aggregationScope: "partner_period", tierMode: "flat", minHoursPerWorker: 0, hourRounding: { unitMinutes: 15, mode: "nearest" }, moneyRounding: { unitVnd: 1, mode: "nearest" }, tiers: [{ minHours: 0, maxHours: null, hourlyRate: 15_000 }] }, createdBy: { id: OWNER, name: "Dữ liệu mẫu" }, activatedBy: { id: OWNER, name: "Dữ liệu mẫu" }, activatedAt: now, createdAt: now }];
  const workerSpecs = [
    ["Nguyễn Văn An", "active", "official", 0, 2, 0],
    ["Trần Thị Bình", "placed", "official", 0, 3, 0],
    ["Lê Minh Châu", "active", "seasonal", 0, 4, 1],
    ["Phạm Quốc Dũng", "placed", "seasonal", 0, 5, 1],
    ["Hoàng Thu Hà", "active", "official", 0, 6, 2],
    ["Đỗ Thanh Khoa", "inactive", "seasonal", 0, 6, null],
    ["Võ Ngọc Linh", "placed", "official", -1, 4, 0],
    ["Bùi Đức Minh", "active", "official", -1, 9, 0],
    ["Ngô Thị Ngân", "placed", "seasonal", -1, 13, 1],
    ["Đặng Phúc Quang", "inactive", "official", -2, 7, null],
    ["Phan Gia Sơn", "active", "foreign", -2, 17, 2],
    ["Hồ Anh Thư", "placed", "official", -2, 20, 0],
    ["Mai Văn Trí", "active", "seasonal", -3, 8, 1],
    ["Lý Tú Uyên", "placed", "foreign", -3, 14, 2],
    ["Cao Việt Vinh", "active", "official", -4, 10, null],
    ["Dương Thanh Xuân", "inactive", "seasonal", -5, 12, null],
  ];
  const workers = workerSpecs.map(([fullName, status, laborType, months, dayOfMonth], index) => {
    const registrationDate = shift(months, dayOfMonth);
    return { ...base, _id: oid(`worker:${index}`), branchId: BRANCH, fullName: `${fullName} (mẫu)`, phone: `090700${String(index).padStart(4, "0")}`, email: `laodong-mau-${index}@example.invalid`, idCard: `DEMO-LD-${String(index + 1).padStart(3, "0")}`, status, laborType, nationality: laborType === "foreign" ? "Nhật Bản" : "Việt Nam", registrationDate, address: "Dữ liệu mẫu local", note: "Dữ liệu mẫu Tổng quan Lao động", customFields: {}, deletedAt: null, createdAt: stamp(registrationDate) };
  });
  const projects = [
    ["DEMO-LD-P01", "Dự án mẫu Kho vận", "active", 8, [1, 6, 7, 11]],
    ["DEMO-LD-P02", "Dự án mẫu Bán lẻ", "planned", 6, [2, 3, 8]],
    ["DEMO-LD-P03", "Dự án mẫu Giáo dục", "completed", 5, [10, 13]],
  ].map(([code, name, status, quota, indexes], index) => ({ ...base, _id: oid(`project:${index}`), branchId: branchObjectId, code, name, status, quota, workerIds: indexes.map(i => workers[i]._id), daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00", startDate: shift(-2, 1), endDate: plusDays(90), location: "Dữ liệu mẫu local", note: "Dữ liệu mẫu Tổng quan Lao động", deletedAt: null, createdAt: now }));
  const contracts = [
    [0, "Dự án mẫu Kho vận", plusDays(12)],
    [1, "Dự án mẫu Kho vận", plusDays(25)],
    [2, "Dự án mẫu Bán lẻ", plusDays(-8)],
    [3, "Dự án mẫu Bán lẻ", plusDays(100)],
  ].map(([workerIndex, clientName, endDate], index) => {
    const contractId = oid(`contract:${index}`);
    return { ...base, _id: contractId, branchId: branchObjectId, workerId: workers[workerIndex]._id, code: `DEMO-LD-HD-${String(index + 1).padStart(3, "0")}`, clientName, startDate: shift(-2, 1), endDate, status: "active", rootContractId: contractId, sequence: 1, note: "Dữ liệu mẫu local", deletedAt: null, createdAt: now };
  });
  const referrals = workerSpecs.flatMap(([, , laborType, , , partnerIndex], index) => partnerIndex == null ? [] : [{ ...base, _id: oid(`referral:${index}`), branchId: BRANCH, partnerId: partners[partnerIndex]._id, workerId: workers[index]._id, policyId, commissionScheme: laborType === "seasonal" ? "seasonal_hourly" : "official_monthly", referredAt: workers[index].registrationDate, employmentStartDate: workers[index].registrationDate, effectiveFrom: workers[index].registrationDate, effectiveTo: null, status: "active", confirmationSource: "manual", confirmedBy: OWNER, confirmedAt: now, note: "Dữ liệu mẫu local", createdAt: now }]);
  const settlementSpecs = [[0, 2_400_000, 1_200_000], [1, 1_800_000, 0], [2, 900_000, 900_000]];
  const settlements = settlementSpecs.map(([partnerIndex, total, paid], index) => ({ ...base, _id: oid(`settlement:${index}`), branchId: BRANCH, partnerId: partners[partnerIndex]._id, settlementKey: `${SEED}:${index}`, revision: 1, periodStart: shift(-1, 1), periodEnd: shift(-1, 28), cutoffAt: now, status: paid === total ? "paid" : paid > 0 ? "partially_paid" : "approved", officialAmount: total, seasonalMinutes: 0, seasonalAmount: 0, adjustmentAmount: 0, totalAmount: total, paidAmount: paid, balanceAmount: total - paid, manualEntries: [], policySnapshots: [], warnings: [], calculatedBy: { id: OWNER, name: "Dữ liệu mẫu" }, calculatedAt: now, approvedBy: { id: OWNER, name: "Dữ liệu mẫu" }, approvedAt: now, version: 1, createdAt: now }));
  const payouts = [0, 2].map(index => ({ ...base, _id: oid(`payout:${index}`), branchId: BRANCH, partnerId: settlements[index].partnerId, settlementId: settlements[index]._id, amount: settlements[index].paidAmount, paidAt: now, method: "bank_transfer", reference: `DEMO-LD-CK-${index + 1}`, note: "Dữ liệu mẫu local", idempotencyKey: `${SEED}:${index}`, createdBy: { id: OWNER, name: "Dữ liệu mẫu" }, createdAt: now }));

  const result = {};
  for (const [name, records] of Object.entries({ workers, workerprojects: projects, workerlaborcontracts: contracts, laborpartners: partners, laborpartnercommissionpolicies: policies, workerreferrals: referrals, laborpartnersettlements: settlements, laborpartnerpayouts: payouts })) {
    const collection = db.collection(name);
    let inserted = 0;
    for (const record of records) {
      const existing = await collection.findOne({ _id: record._id }, { projection: { demoSeed: 1 } });
      if (existing) {
        if (existing.demoSeed !== SEED) throw new Error(`ID mẫu trùng bản ghi khác trong ${name}`);
        continue;
      }
      await collection.insertOne(record);
      inserted++;
    }
    result[name] = { expected: records.length, inserted };
  }
  console.log(JSON.stringify({ database: "igen-erp", companyCode: "AKM", branch: branch.name, seed: SEED, result }, null, 2));
} finally {
  await connection.close();
}
