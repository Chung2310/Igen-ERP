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

const SEED = "local-student-overview-v1";
const BRANCH = "6adeafc1bac4808f722790b5";
const OWNER = "6ae94fdacd18372f69eca48d";
const id = (key) => new mongoose.Types.ObjectId(createHash("sha256").update(`${SEED}:${key}`).digest("hex").slice(0, 24));
const connection = mongoose.createConnection(uri, options);
try {
  await connection.asPromise();
  const db = connection.db;
  const branch = await db.collection("branches").findOne({ _id: new mongoose.Types.ObjectId(BRANCH), companyCode: "AKM", isActive: true });
  const owner = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(OWNER), companyCode: "AKM", branchId: BRANCH, isActive: { $ne: false } });
  if (!branch || !owner) throw new Error("Không tìm thấy chi nhánh và tài khoản AKM local để tạo dữ liệu mẫu.");

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [year, month, day] = today.split("-").map(Number);
  const current = (number) => `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, number)).padStart(2, "0")}`;
  const priorMonth = new Date(Date.UTC(year, month - 2, 1));
  const prior = (number) => `${priorMonth.getUTCFullYear()}-${String(priorMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(number).padStart(2, "0")}`;
  const display = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
  const stamp = (date) => new Date(`${date}T10:00:00+07:00`);
  const courseIds = [0, 1, 2].map(index => id(`course:${index}`));
  const courseSpecs = [
    ["DEMO-KNS", "Kỹ năng số ứng dụng", "Kỹ năng", "5.000.000"],
    ["DEMO-TA", "Tiếng Anh giao tiếp", "Ngoại ngữ", "6.000.000"],
    ["DEMO-TH", "Thiết kế thực hành", "Nghề nghiệp", "8.000.000"],
  ];
  const courses = courseSpecs.map(([code, title, category, fee], index) => ({ _id: courseIds[index], code, title, category, fee, duration: "3 tháng", maxLearners: 20, activeBatches: 1, status: "Hoạt động", ownerId: OWNER, branchId: BRANCH, companyCode: "AKM", demoSeed: SEED, createdAt: now, updatedAt: now }));
  const specs = [
    ["An", 0, current(1), "Đang học", 5_000_000, 2_000_000, "Facebook", "Tiền mặt", current(2)],
    ["Bình", 0, current(2), "Đang học", 6_000_000, 6_000_000, "Trực tiếp", "Chuyển khoản", current(3)],
    ["Chi", 1, current(2), "Đang học", 4_500_000, 1_500_000, "Zalo", "Tiền mặt", current(4)],
    ["Dũng", 2, current(3), "Đang thi", 8_000_000, 4_000_000, "CTV", "Chuyển khoản", current(5)],
    ["Hạnh", 1, current(4), "Đã nộp HS", 3_200_000, 0, "Trực tiếp", "Tiền mặt", current(4)],
    ["Khánh", 0, current(5), "Đã đậu", 5_500_000, 5_500_000, "Facebook", "Chuyển khoản", current(5)],
    ["Linh", 2, current(6), "Đang thi", 7_500_000, 2_000_000, "Zalo", "Tiền mặt", current(6)],
    ["Minh", 0, prior(3), "Đã đậu", 5_000_000, 5_000_000, "Trực tiếp", "Chuyển khoản", prior(4)],
    ["Ngọc", 1, prior(8), "Đang học", 6_000_000, 2_000_000, "CTV", "Chuyển khoản", current(2)],
    ["Phúc", 1, prior(12), "Thi lại", 4_000_000, 0, "Facebook", "Tiền mặt", prior(12)],
    ["Quỳnh", 2, prior(16), "Đã đậu", 8_000_000, 8_000_000, "Trực tiếp", "Chuyển khoản", prior(17)],
    ["Sơn", 0, prior(22), "Nghỉ học", 3_500_000, 1_000_000, "Zalo", "Tiền mặt", prior(23)],
  ];
  const integerFee = (amount) => new Intl.NumberFormat("vi-VN").format(amount);
  const students = [];
  const payments = [];
  for (const [index, [name, courseIndex, registered, status, fee, paid, referral, method, paidDate]] of specs.entries()) {
    const studentId = id(`student:${index}`);
    const paymentId = id(`payment:${index}`);
    const paymentHistory = paid > 0 ? [{ id: String(paymentId), amount: paid, date: display(paidDate), method, note: "Dữ liệu mẫu Tổng quan local", recipient: "Dữ liệu mẫu" }] : [];
    students.push({ _id: studentId, fullName: `Học viên mẫu ${name}`, phone: `090900${String(index).padStart(4, "0")}`, email: `hocvien-mau-${index}@example.invalid`, idCard: `DEMO-HV-${index}`,
      registrationDate: display(registered), enrollmentDate: display(registered), fee: integerFee(fee), paidAmount: paid, paymentHistory, status: [status], referral,
      courseId: String(courseIds[courseIndex]), ownerId: OWNER, branchId: BRANCH, centerId: "AKM", companyCode: "AKM", address: "Dữ liệu mẫu local",
      demoSeed: SEED, createdAt: stamp(registered), updatedAt: now });
    if (paid > 0) payments.push({ _id: paymentId, studentId: String(studentId), studentName: `Học viên mẫu ${name}`, amount: paid, method,
      date: display(paidDate), paidOn: new Date(`${paidDate}T00:00:00Z`), note: "Dữ liệu mẫu Tổng quan local", ownerId: OWNER, branchId: BRANCH, companyCode: "AKM", demoSeed: SEED, createdAt: stamp(paidDate), updatedAt: now });
  }
  const batchSpecs = [
    ["DEMO-L01", "Lớp Kỹ năng số A", 0, "Đang học", [0, 1, 7]],
    ["DEMO-L02", "Lớp Tiếng Anh B", 1, "Đang học", [2, 8]],
    ["DEMO-L03", "Lớp Thiết kế C", 2, "Sắp khai giảng", [3, 6]],
  ];
  const batches = batchSpecs.map(([code, name, courseIndex, status, indexes]) => ({ _id: id(`batch:${code}`), code, name, courseId: String(courseIds[courseIndex]),
    learnerIds: indexes.map(index => String(id(`student:${index}`))), daysOfWeek: [1, 3, 5], startTime: "08:00", endTime: "10:00", startDate: current(1), endDate: `${year + 1}-01-31`,
    status, ownerId: OWNER, branchId: BRANCH, companyCode: "AKM", instructorText: "Giáo viên mẫu", quota: 15, demoSeed: SEED, createdAt: now, updatedAt: now }));

  const result = {};
  for (const [name, records] of Object.entries({ courses, students, batches, payments })) {
    let inserted = 0;
    const collection = db.collection(name);
    for (const record of records) {
      const existing = await collection.findOne({ _id: record._id }, { projection: { demoSeed: 1 } });
      if (existing) { if (existing.demoSeed !== SEED) throw new Error(`ID mẫu trùng bản ghi thật trong ${name}`); continue; }
      await collection.insertOne(record);
      inserted++;
    }
    result[name] = { expected: records.length, inserted };
  }
  console.log(JSON.stringify({ database: "igen-erp", companyCode: "AKM", branch: branch.name, seed: SEED, result }, null, 2));
} finally {
  await connection.close();
}
