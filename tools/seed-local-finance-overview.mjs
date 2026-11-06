import "dotenv/config";
import mongoose from "mongoose";
import { createHash } from "node:crypto";

// Deliberately limited to the local AKM head office used for UI previews.
const COMPANY = "AKM";
const BRANCH = "6adeafc1bac4808f722790b5";
const SEED = "local-finance-overview-v1";
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

const connection = mongoose.createConnection(uri, options);
try {
  await connection.asPromise();
  const db = connection.db;
  const branch = await db.collection("branches").findOne({ _id: new mongoose.Types.ObjectId(BRANCH), companyCode: COMPANY, isActive: true });
  if (!branch) throw new Error("Không tìm thấy chi nhánh Trụ sở chính của AKM trong DB local.");

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [year, month, day] = today.split("-").map(Number);
  const currentDate = (requestedDay) => `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, requestedDay)).padStart(2, "0")}`;
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  const priorDate = (requestedDay) => `${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(requestedDay).padStart(2, "0")}`;
  const at = (date) => new Date(`${date}T10:00:00+07:00`);
  const scope = { companyCode: COMPANY, branchId: BRANCH };
  const receiptIds = ["supplier-soon", "supplier-later"].map(key => new mongoose.Types.ObjectId(createHash("sha256").update(`${SEED}:${key}`).digest("hex").slice(0, 24)));
  const data = {
    retailorders: [
      ["01", currentDate(1), "Điện thoại Android", "Điện thoại", "Nova", 1, 9200000, 6900000, "transfer"],
      ["02", currentDate(2), "Tai nghe không dây", "Phụ kiện", "Wave", 3, 1450000, 890000, "cash"],
      ["03", currentDate(3), "Máy tính bảng", "Máy tính bảng", "Nova", 1, 7100000, 5200000, "card"],
      ["04", currentDate(4), "Ốp lưng chống sốc", "Phụ kiện", "Flex", 4, 360000, 160000, "cash"],
      ["05", currentDate(5), "Điện thoại phổ thông", "Điện thoại", "Orbit", 2, 3300000, 2350000, "transfer"],
      ["P1", priorDate(5), "Điện thoại Android", "Điện thoại", "Nova", 1, 8700000, 6700000, "transfer"],
      ["P2", priorDate(12), "Tai nghe không dây", "Phụ kiện", "Wave", 2, 1350000, 850000, "cash"],
      ["P3", priorDate(22), "Máy tính bảng", "Máy tính bảng", "Nova", 1, 6900000, 5100000, "card"],
    ].map(([key, date, name, category, brand, quantity, price, cost, method]) => {
      const subtotal = quantity * price;
      return { demoKey: key, orderCode: `LOCAL-DEMO-${today.slice(0, 7).replace("-", "")}-${key}`, status: "completed", businessDate: date,
        items: [{ productId: `LOCAL-DEMO-${key}`, sku: `LOCAL-DEMO-${key}`, productName: name, unit: "cái", category, brand, quantity, unitPrice: price, unitCost: cost, discountAmount: 0, lineTotal: subtotal }],
        subtotal, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: subtotal, totalCost: quantity * cost,
        payments: [{ businessDate: date, amount: subtotal, method, paidAt: at(date), receivedBy: "LOCAL-DEMO", receivedByName: "Dữ liệu mẫu" }],
        paidAmount: subtotal, dueAmount: 0, paymentStatus: "paid", salespersonId: "LOCAL-DEMO", salespersonName: "Dữ liệu mẫu",
        createdBy: "LOCAL-DEMO", createdByName: "Dữ liệu mẫu", confirmedAt: at(date), completedAt: at(date), createdAt: at(date), updatedAt: at(date) };
    }),
    financevouchers: [
      ["rent", currentDate(1), "rent", "fixed", 4200000, "transfer"],
      ["salary", currentDate(3), "salary", "fixed", 3100000, "transfer"],
      ["marketing", currentDate(4), "marketing", "variable", 1250000, "card"],
      ["utilities", currentDate(5), "utilities", "fixed", 680000, "cash"],
      ["prior-rent", priorDate(2), "rent", "fixed", 4000000, "transfer"],
      ["prior-marketing", priorDate(15), "marketing", "variable", 950000, "card"],
    ].map(([key, date, category, expenseClass, amount, method]) => ({ demoKey: key, code: `LOCAL-DEMO-PC-${today.slice(0, 7)}-${key}`, kind: "payment", category, expenseClass,
      amount, date, method, counterparty: "Chi phí mẫu", note: "Dữ liệu mẫu tổng quan tài chính trên MongoDB local", createdBy: "LOCAL-DEMO", createdByName: "Dữ liệu mẫu",
      idempotencyKey: `${SEED}:${today.slice(0, 7)}:${key}`, fingerprint: `${SEED}:${key}`, createdAt: at(date), updatedAt: at(date) })),
    financetaxes: [
      ["output-1", currentDate(2), "output", 5000000, 500000, false],
      ["output-2", currentDate(5), "output", 3500000, 350000, false],
      ["input-1", currentDate(3), "input", 2000000, 200000, true],
    ].map(([key, date, direction, base, vat, deductible]) => ({ demoKey: key, direction, invoiceNumber: `LOCAL-DEMO-${today.slice(0, 7)}-${key}`, taxId: "LOCAL-DEMO-TAX",
      counterparty: "Đối tác mẫu", date, base, rate: 10, vat, deductible, createdBy: "LOCAL-DEMO", note: "Dữ liệu mẫu local", createdAt: at(date), updatedAt: at(date) })),
    financereceivables: [
      ["overdue", "Khách hàng An", -9, 3600000],
      ["soon", "Khách hàng Bình", 4, 2200000],
      ["later", "Khách hàng Châu", 23, 4850000],
    ].map(([key, customerName, daysFromNow, balance]) => {
      const due = new Date(`${today}T00:00:00+07:00`);
      due.setDate(due.getDate() + daysFromNow);
      return { demoKey: key, receivableCode: `LOCAL-DEMO-CN-${key}`, customerId: `LOCAL-DEMO-${key}`, customerName, sourceType: "local_demo", sourceId: `${SEED}:${key}`,
        sourceEventId: `${SEED}:${key}`, occurredAt: at(currentDate(1)), dueDate: due, originalAmount: balance, paidAmount: 0, adjustedAmount: 0,
        balance, status: "open", daysOverdue: Math.max(0, -daysFromNow), reminderCount: 0, createdAt: now, updatedAt: now };
    }),
    goodsreceipts: [
      ["supplier-soon", receiptIds[0], "Nhà cung cấp Minh", 6200000],
      ["supplier-later", receiptIds[1], "Nhà cung cấp Lan", 3800000],
    ].map(([key, id, supplierName, subtotal]) => ({ _id: id, demoKey: key, warehouseId: "6adeafc8aea624c0978e178f", receiptCode: `LOCAL-DEMO-PN-${key}`,
      receiptKind: "purchase", supplierId: `LOCAL-DEMO-${key}`, supplierName, status: "confirmed", receivedAt: at(currentDate(1)),
      items: [{ productId: `LOCAL-DEMO-${key}`, variantId: `LOCAL-DEMO-${key}`, sku: `LOCAL-DEMO-${key}`, productName: "Hàng mẫu công nợ", quantity: 1, unitCost: subtotal, lineTotal: subtotal }],
      subtotal, createdBy: "LOCAL-DEMO", createdByName: "Dữ liệu mẫu", confirmedBy: "LOCAL-DEMO", confirmedAt: at(currentDate(1)), createdAt: at(currentDate(1)), updatedAt: at(currentDate(1)) })),
    financepayables: [
      ["supplier-soon", receiptIds[0], "Nhà cung cấp Minh", 6200000, 2],
      ["supplier-later", receiptIds[1], "Nhà cung cấp Lan", 3800000, 18],
    ].map(([key, id, supplierName, balance, daysFromNow]) => {
      const due = new Date(`${today}T00:00:00+07:00`);
      due.setDate(due.getDate() + daysFromNow);
      return { demoKey: key, payableCode: `LOCAL-DEMO-GN-${key}`, receiptId: String(id), receiptCode: `LOCAL-DEMO-PN-${key}`,
        supplierId: `LOCAL-DEMO-${key}`, supplierName, originalAmount: balance, openingPaid: 0, paidAmount: 0, balance,
        dueDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(due),
        createdBy: "LOCAL-DEMO", note: "Dữ liệu mẫu local", createdAt: now, updatedAt: now };
    }),
  };

  const result = {};
  for (const [collectionName, records] of Object.entries(data)) {
    const collection = db.collection(collectionName);
    let inserted = 0;
    for (const record of records) {
      const { demoKey, ...fields } = record;
      const existing = await collection.findOne({ ...scope, demoSeed: SEED, demoKey });
      if (existing) continue;
      const matchingCode = fields.orderCode || fields.code || fields.receivableCode || fields.payableCode || fields.receiptCode || fields.invoiceNumber;
      if (matchingCode && await collection.findOne({ ...scope, $or: [
        ...["orderCode", "code", "receivableCode", "payableCode", "receiptCode", "invoiceNumber"].map(field => ({ [field]: matchingCode })),
      ] })) throw new Error(`Trùng mã dữ liệu mẫu ở ${collectionName}: ${matchingCode}`);
      await collection.insertOne({ ...scope, ...fields, demoSeed: SEED, demoKey });
      inserted++;
    }
    result[collectionName] = { expected: records.length, inserted };
  }
  console.log(JSON.stringify({ database: "igen-erp", companyCode: COMPANY, branch: branch.name, seed: SEED, date: today, result }, null, 2));
} finally {
  await connection.close();
}
