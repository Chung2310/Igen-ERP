import { createHash } from "node:crypto";
import type { Model, Schema } from "mongoose";

export const fixtureId = (key: string) => createHash("sha256").update(`igen-local-qa-v1:${key}`).digest("hex").slice(0, 24);
const fixturePhone = (key: string) => `09${String(parseInt(fixtureId(key).slice(0, 8), 16) % 100000000).padStart(8, "0")}`;
export type Scope = { companyCode: string; branchId: string; adminId: string; employeeId: string; tag: string; index: number; today: string; id: (key: string) => string };
type Recipe = { key: string; module: string; file: string; data?: (scope: Scope) => Record<string, unknown>; only?: "education" | "labor"; count?: number };
const core = (key: string, module: string, file: string, data?: Recipe["data"]): Recipe => ({ key, module, file: `model/${file}.model.ts`, data });
const student = (key: string, file: string, data?: Recipe["data"]): Recipe => ({ key, module: "student", file: `modules/student-management/models/${file}.model.ts`, data, only: "education" });
const moduleRecipe = (key: string, module: string, file: string, data?: Recipe["data"]): Recipe => ({ key, module, file: `modules/${file}.model.ts`, data });

export const recipes: Recipe[] = [
  core("department", "hr", "hr-department", s => ({ name: `Phòng vận hành ${s.tag}`, normalizedName: `van-hanh-${s.tag}`, managerUid: s.adminId })),
  core("contract", "hr", "hr-contract", s => ({ contractType: "Hợp đồng lao động", employeeId: s.employeeId, employeeName: "Nhân viên kiểm thử", startDate: "2026-01-01", endDate: "2027-12-31", salaryTerms: [{ salaryEffectiveFrom: "2026-01-01", contractSalary: 12000000, insuranceSalary: 8000000, payrollSalary: 12000000, salaryType: "monthly", currency: "VND" }] })),
  core("attendance", "hr", "timekeeping", s => ({ uid: s.employeeId, date: s.today, checkIn: { time: `${s.today}T01:00:00Z`, latitude: 10.7769, longitude: 106.7009, distance: 0, deviceInfo: "Thiết bị QA local" }, checkOut: { time: `${s.today}T10:00:00Z`, latitude: 10.7769, longitude: 106.7009, distance: 0 } })),
  core("payrollProfile", "hr", "payroll-profile", s => ({ employeeId: s.employeeId })),
  core("leave", "hr", "hr-leave-application", s => ({ employeeId: s.employeeId, employeeName: "Nhân viên kiểm thử", startDate: s.today, endDate: s.today })),
  core("calendar", "hr", "hr-calendar-event", s => ({ employeeId: s.employeeId, uid: s.employeeId, title: `Lịch làm việc ${s.tag}`, date: s.today })),
  core("project", "hr", "project", s => ({ name: `Dự án triển khai ERP ${s.tag}`, status: "in_progress", creatorUid: s.adminId })),
  core("task", "hr", "kanban-task", s => ({ title: `Kiểm thử nghiệp vụ ${s.tag}`, projectId: s.id("project"), assigneeUid: s.employeeId, assignee: "Nhân viên kiểm thử", creatorUid: s.adminId, dueDate: s.today, status: ["Todo", "In Progress", "Done"][s.index], progress: s.index * 50 })),
  core("training", "hr", "training-course", s => ({ title: `Đào tạo quy trình ${s.tag}`, category: "Onboarding", duration: "2 giờ", instructor: "Quản trị viên QA", creatorUid: s.adminId, icon: "BookOpen", lessons: [{ title: "Quy trình nội bộ", type: "text", content: "Tài liệu kiểm thử nội bộ." }] })),
  core("recruitmentJob", "hr", "recruitment-job", s => ({ title: `Tuyển nhân viên ${s.tag}`, createdBy: s.adminId })),
  core("applicant", "hr", "recruitment-applicant", s => ({ jobId: s.id("recruitmentJob"), fullName: `Ứng viên ${s.tag}`, email: `candidate-${s.tag}@example.test`, phone: `090${s.branchId.slice(-7).replace(/[a-f]/g, "1")}` })),
  core("category", "inventory", "category", s => ({ name: `Thiết bị kiểm thử ${s.tag}`, type: "product" })),
  core("warehouse", "inventory", "warehouse", s => ({ code: `KHO-${s.tag}`, name: `Kho kiểm thử ${s.tag}`, kind: "selling", isDefault: s.index === 0 })),
  core("product", "inventory", "product", s => ({ sku: `QA-${s.tag}`, name: `Thiết bị mẫu ${s.tag}`, category: "Thiết bị", price: 150000, costPrice: 100000, stock: 0 })),
  core("catalog", "inventory", "product-catalog", s => ({ productCode: `SP-${s.tag}`, name: `Thiết bị mẫu ${s.tag}`, normalizedName: `thiet-bi-${s.tag}`, productType: "physical", categoryCode: "QA", baseUnitCode: "CAI", status: "active" })),
  core("variant", "inventory", "product-variant", s => ({ productId: s.id("catalog"), sku: `BT-${s.tag}`, displayName: `Mặc định ${s.tag}`, unitCode: "CAI", trackingMode: "quantity", status: "active" })),
  core("price", "inventory", "product-price", s => ({ productId: s.id("catalog"), variantId: s.id("variant"), sku: `BT-${s.tag}`, sellingPrice: 150000, costPrice: 100000 })),
  core("supplier", "inventory", "supplier", s => ({ code: `NCC-${s.tag}`, name: `Nhà cung cấp ${s.tag}`, phone: "0900000001", email: `supplier-${s.tag}@example.test` })),
  core("resource", "resource", "resource-item", s => ({ name: `Tài liệu quy trình ${s.tag}`, type: "folder", section: "local", creatorUid: s.adminId, creatorName: "Quản trị viên QA", parentId: null })),
  core("room", "chat", "chat-room", s => ({ name: `Nhóm vận hành ${s.tag}`, isGroup: true, creatorId: s.adminId, members: [{ userId: s.adminId, role: "admin" }, { userId: s.employeeId, role: "member" }] })),
  core("message", "chat", "chat-message", s => ({ roomId: s.id("room"), senderId: s.employeeId, senderName: "Nhân viên kiểm thử", content: `Tin nhắn kiểm thử ${s.tag}. Không gửi ra ngoài hệ thống.` })),
  student("course", "course", s => ({ code: `KH-${s.tag}`, title: `Khóa đào tạo ${s.tag}`, category: "Nghiệp vụ", fee: "1500000", duration: "3 tháng" })),
  student("student", "student", s => ({ fullName: `Học viên ${s.tag}`, phone: `091${s.branchId.slice(-7).replace(/[a-f]/g, "2")}`, email: `student-${s.tag}@example.test`, registrationDate: s.today, fee: "1500000", courseId: s.id("course"), status: ["Đang học"] })),
  student("batch", "batch", s => ({ code: `LOP-${s.tag}`, name: `Lớp kiểm thử ${s.tag}`, courseId: s.id("course"), learnerIds: [s.id("student")], instructorId: s.adminId, startTime: "08:00", endTime: "10:00", startDate: s.today, endDate: "2027-12-31", status: "Đang học", daysOfWeek: [1, 3, 5], quota: 20 })),
  student("assignment", "assignment", s => ({ batchId: s.id("batch"), courseId: s.id("course"), title: `Bài tập ${s.tag}`, description: "Bài tập kiểm thử", dueDate: "2027-12-31" })),
  student("exam", "exam", s => ({ batchId: s.id("batch"), courseId: s.id("course"), name: `Bài thi ${s.tag}`, date: s.today })),
  student("educationPartner", "partner", s => ({ name: `Đối tác tuyển sinh ${s.tag}`, phone: fixturePhone(s.tag), code: `DT-${s.tag}` })),
  { ...moduleRecipe("worker", "worker", "worker-management/models/worker", s => ({ fullName: `Lao động ${s.tag}`, status: ["active", "inactive", "placed"][s.index], email: `worker-${s.tag}@example.test`, phone: "0900000003" })), only: "labor" },
  { ...moduleRecipe("workerProject", "worker", "worker-management/models/worker-project", s => ({ name: `Dự án cung ứng ${s.tag}`, workerIds: [s.id("worker")] })), only: "labor" },
  { ...moduleRecipe("laborPartner", "partner", "worker-management/labor-partners/models/labor-partner", s => ({ code: `LD-${s.tag}`, name: `Đối tác cung ứng ${s.tag}`, phone: "0900000004" })), only: "labor" },
  moduleRecipe("customer", "customer", "customer-management/models/customer", s => ({ customerCode: `KH-${s.tag}`, name: `Khách hàng ${s.tag}`, phone: `092${s.branchId.slice(-5).replace(/[a-f]/g, "3")}${s.index}0`, normalizedPhone: `092${s.branchId.slice(-5).replace(/[a-f]/g, "3")}${s.index}0`, email: `customer-${s.tag}@example.test`, createdBy: s.adminId, createdByName: "Quản trị viên QA" })),
  moduleRecipe("retailPartner", "retail-partner", "retail/models/retail-partner", s => ({ code: `CTV-${s.tag}`, name: `Cộng tác viên ${s.tag}`, roles: ["collaborator"], status: "active" })),
  { ...moduleRecipe("shift", "retail", "retail/models/cashier-shift", s => ({ shiftCode: `CA-${s.tag}`, cashierId: s.employeeId, cashierName: "Thu ngân QA", openingFloat: 500000, expectedCash: 500000, openedAt: new Date(), openedBy: s.adminId, businessDate: s.today })), count: 1 },
  moduleRecipe("order", "retail", "retail/models/retail-order", s => ({ orderCode: `DH-${s.tag}`, status: "draft", customerId: s.id("customer"), customerName: `Khách hàng ${s.tag}`, items: [{ productId: s.id("catalog"), variantId: s.id("variant"), sku: `BT-${s.tag}`, productName: `Thiết bị mẫu ${s.tag}`, unit: "Cái", quantity: 2, unitPrice: 150000, unitCost: 100000, discountAmount: 0, lineTotal: 300000 }], subtotal: 300000, grandTotal: 300000, totalCost: 200000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, dueAmount: 300000, salespersonId: s.employeeId, salespersonName: "Thu ngân QA", createdBy: s.adminId, createdByName: "Quản trị viên QA", businessDate: s.today })),
  moduleRecipe("coupon", "retail", "retail/models/retail-coupon", s => ({ code: `QA-${s.tag}`, name: `Ưu đãi ${s.tag}` })),
  moduleRecipe("ticket", "repair", "repair/repair-ticket", s => ({ ticketCode: `SC-${s.tag}`, customerId: s.id("customer"), customerName: `Khách hàng ${s.tag}`, customerPhone: "0900000005", device: { name: "Thiết bị kiểm thử", condition: "Không khởi động", accessories: [] }, coverage: { costBearer: "customer", checkedAt: new Date() }, symptom: "Thiết bị không hoạt động", receivedAt: new Date(), createdBy: s.adminId, createdByName: "Quản trị viên QA", status: ["received", "diagnosing", "awaiting_approval"][s.index] })),
  moduleRecipe("receivable", "finance", "finance/models/receivable", s => ({ receivableCode: `CN-${s.tag}`, customerId: s.id("customer"), customerName: `Khách hàng ${s.tag}`, sourceType: "manual", sourceId: s.id("receivable"), sourceEventId: `qa-opening-${s.tag}`, occurredAt: new Date(), dueDate: new Date(Date.now() - 3 * 86400000), originalAmount: 500000, paidAmount: 0, adjustedAmount: 0, balance: 500000, daysOverdue: 3, status: "open" })),
  moduleRecipe("asset", "finance", "finance/models/fixed-asset", s => ({ assetCode: `TS-${s.tag}`, name: `Máy tính văn phòng ${s.tag}`, purchaseDate: s.today, inServiceDate: s.today, usefulLifeMonths: 36, originalCost: 12000000, netBookValue: 12000000 })),
  moduleRecipe("campaign", "marketing", "marketing/models/marketing-campaign", s => ({ name: `Chiến dịch kiểm thử ${s.tag}`, runDate: "2027-12-31", channels: ["email"], subject: "Email kiểm thử local", html: "<p>Dữ liệu kiểm thử, không gửi ra ngoài.</p>", enabled: false })),
];

// Fill only required schema fields; business values and relationships come from recipes.
export function fixtureDocument(model: Model<any>, scope: Scope, recipe: Recipe) {
  const values: Record<string, unknown> = {
    _id: scope.id(recipe.key), companyCode: scope.companyCode, branchId: scope.branchId,
    ownerId: scope.adminId, createdBy: scope.adminId, updatedBy: scope.adminId,
    code: `QA-${scope.tag}`, name: `Dữ liệu kiểm thử ${scope.tag}`, description: "Dữ liệu tổng hợp QA local",
    ...(recipe.data?.(scope) || {}),
  };
  const document = new model(values);
  const fill = (schema: Schema, prefix = "") => schema.eachPath((key, field: any) => {
    const name = prefix + key;
    if (field.schema && field.isRequired && !document.get(name)) document.set(name, {});
    if (field.schema && document.get(name)) { fill(field.schema, `${name}.`); return; }
    if (!field.isRequired || document.get(name) != null) return;
    const enums = field.enumValues || [];
    let value: unknown;
    if (enums.length) value = enums[0];
    else if (field.instance === "Date") value = new Date();
    else if (field.instance === "Number") value = Math.min(field.options.max ?? Infinity, Math.max(field.options.min ?? 0, 1));
    else if (field.instance === "Boolean") value = false;
    else if (field.instance === "Array") value = [];
    else if (field.instance === "ObjectId") throw new Error(`Missing explicit relationship: ${model.modelName}.${name}`);
    else if (/email/i.test(key)) value = `qa-${scope.tag}@example.test`;
    else if (/phone/i.test(key)) value = "0900000000";
    else if (/date/i.test(key)) value = scope.today;
    else if (/time/i.test(key)) value = "08:00";
    else if (/(?:uid|userId|employeeId|creatorId|assignedTo)$/i.test(key)) value = scope.employeeId;
    else value = `QA-${scope.tag}-${key}`;
    document.set(name, value);
  });
  fill(model.schema);
  return document;
}
