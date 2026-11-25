import { randomUUID } from "node:crypto";
import { conversationAudit } from "./testing/conversation-audit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), provider: vi.fn(), assertOperation: vi.fn() }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: state.provider }));
vi.mock("./models", () => {
  const apply = (record: any, updates: any) => {
    for (const [key, value] of Object.entries(updates.$set || {})) {
      const path = key.split("."); let target = record;
      for (const part of path.slice(0, -1)) target = target[part] ??= {};
      target[path.at(-1)!] = structuredClone(value);
    }
  };
  const chain = (getter: () => any): any => ({ sort: () => chain(getter), select: () => chain(getter), lean: async () => structuredClone(getter()) });
  return {
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: vi.fn() },
    AssistantSessionModel: {
      updateOne: vi.fn(async (_filter, update) => {
        state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 };
        apply(state.session, update);
      }),
      findOneAndUpdate: vi.fn(async () => { if (state.session.busy) return null; state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => {
        if (state.turns.some(turn => turn.requestId === input.requestId)) throw { code: 11000 };
        const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" };
        state.turns.push(turn); return turn;
      }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId
        ? turn.requestId === filter.requestId
        : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: state.assertOperation,
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "student" || op.id === "dashboard.business-overview").map(defaultWorkflow)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from "./service";
import { operationById } from "./catalog";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const studentId = "64b000000000000000000002";
const secondStudentId = "64b000000000000000000007";
const paymentId = "64b000000000000000000004";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const audit = conversationAudit("student-real-db");
const turn = (input: any) => audit.turn(input, () => processTurn(req, { conversationId: "student-conversation", requestId: randomUUID(), ...input }));
const confirm = (reply: any) => turn({ decision: { id: reply.action.id, confirmed: true } });
let fetcher: ReturnType<typeof vi.fn>;
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

import { beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Student } from "../modules/student-management/models/student.model";
import { Payment } from "../modules/student-management/models/payment.model";
import { StudentService } from "../modules/student-management/services/student.service";
import { PaymentService } from "../modules/student-management/services/payment.service";
import { createStudentSchema, updateStudentSchema } from "../modules/student-management/validations/student.validation";
import { createPaymentSchema } from "../modules/student-management/validations/payment.validation";
import { getBusinessOverview } from "../service/business-overview.service";
import { CompanyModel } from "../model/company.model";
import { parseBusinessDate } from "../../shared/business-calendar";
import * as XLSX from "xlsx";
import { readAssistantTableFile } from "../../src/components/common/assistant-table-file";
import { requireAnyPermission } from "../middleware/auth";
import { UserModel } from "../model/user.model";
import { RolePermissionModel } from "../model/role-permission.model";

let mongo: MongoMemoryReplSet;
const branch = req.user.branchId;
const otherBranch = "507f1f77bcf86cd799439099";
const owner = "actor";
const fieldContext = { tenantId: "TEST", moduleKey: "students" as const, actorRole: "admin", actorId: owner, branchId: branch };
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { dbName: "assistant_business_acceptance", count: 1, storageEngine: "wiredTiger" } });
  const uri = mongo.getUri();
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error("Only isolated loopback MongoDB is allowed");
  await mongoose.connect(uri);
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

beforeEach(async () => {
  audit.reset(); state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();
  state.assertOperation.mockReset().mockImplementation(async (_req: unknown, id: string) => operationById(id));
  await Student.deleteMany({}); await Payment.deleteMany({});
  await CompanyModel.deleteMany({ code: "TEST" });
  await CompanyModel.create({ code: "TEST", name: "Business acceptance test", ownerEmail: "owner@example.com", businessType: "education" });
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const u = new URL(String(url));
    if (!["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) throw new Error("External HTTP forbidden");
    const path = u.pathname.replace(/^\/api\/v1/, ""), method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const query = Object.fromEntries(u.searchParams);
    try {
      if (path === "/branches") return json({ success: true, branches: [{ _id: branch, name: "Trụ sở chính", code: "HQ" }] });
      if (path === "/students" && method === "GET") return json({ success: true, ...await StudentService.getStudents(owner, query, branch) });
      if (path === "/students" && method === "POST") {
        const { value, error } = createStudentSchema.validate(body);
        if (error) throw error;
        return json({ success: true, data: await StudentService.createStudent(owner, owner, { ...value, branchId: branch }, fieldContext) });
      }
      if (path === "/payments" && method === "POST") {
        const { value, error } = createPaymentSchema.validate(body);
        if (error) throw error;
        return json({ success: true, data: await PaymentService.createPayment(owner, value, branch) });
      }
      if (path === "/payments" && method === "GET") return json({ success: true, ...await PaymentService.getPayments(owner, query, branch) });
      const reconciliation = path.match(/^\/payments\/reconciliation\/([^/]+)$/);
      if (reconciliation) return json({ success: true, data: await PaymentService.reconcileStudent(owner, reconciliation[1], branch) });
      if (path === "/dashboard/business-overview") {
        const start = parseBusinessDate(query.startDate)!;
        const last = parseBusinessDate(query.endDate)!;
        return json({ status: "success", data: await getBusinessOverview({ id: owner, role: "admin", companyCode: "TEST", branchId: branch, enabledModules: ["student"], permissions: new Set(["people:read", "dashboard:read"]) }, { start, end: new Date(last.getTime() + 86400000 - 1), filter: "custom" }) });
      }
      if (path === "/students/bulk-preview" && method === "POST") return json({ success: true, ...await StudentService.previewBulkStudents(owner, body.students, branch) });
      if (path === "/students/bulk" && method === "POST") return json({ success: true, ...await StudentService.bulkCreateStudents(owner, owner, body.students, owner, branch) });
      const detail = path.match(/^\/students\/([^/]+)$/);
      if (detail && method === "GET") return json({ success: true, data: await StudentService.getStudentById(owner, detail[1], branch) });
      if (detail && method === "PATCH") {
        const { value, error } = updateStudentSchema.validate(body);
        if (error) throw error;
        return json({ success: true, data: await StudentService.updateStudent(owner, owner, detail[1], value, fieldContext, branch) });
      }
      const installment = path.match(/^\/students\/([^/]+)\/installments(?:\/(\d+))?$/);
      if (installment && method === "GET") return json({ success: true, data: await StudentService.getStudentInstallments(owner, installment[1], branch) });
      if (installment && method === "PATCH") return json({ success: true, data: await StudentService.updateStudentInstallment(owner, installment[1], Number(installment[2]), body, branch) });
      throw new Error(`Unimplemented test transport: ${method} ${path}`);
    } catch (error) { return new Response(JSON.stringify({ success: false, error: String((error as Error).message) }), { status: 422, headers: { "Content-Type": "application/json" } }); }
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(async context => {
  await audit.write(context, state, { persistence: "isolated real MongoDB", students: await Student.find({}).lean(), payments: await Payment.find({}).lean(), pending: state.session?.pending });
  vi.unstubAllGlobals();
});

async function seedStudent(extra: Record<string, unknown> = {}) {
  return Student.create({ _id: studentId, fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", registrationDate: "19/11/2026",
    fee: "2.000.000", paidAmount: 0, ownerId: owner, branchId: branch,
    installmentStatus: [1, 2].map(installmentNo => ({ installmentNo, percent: 50, amountDue: 1000000, originalAmountDue: 1000000, status: "Chưa gửi" })), ...extra });
}
const interpret = (actionId: string, values: Record<string, unknown>, extra = {}) => state.interpret.mockResolvedValueOnce({ actionId, values, intentType: "workflow", ...extra });

it.each([999500, 1000000, 1000500])("ST-B03 real DB: collect %s VND, reload receipt and debt through conversation", async amount => {
  await seedStudent();
  interpret("student.payment.create", { studentId: "Nguyễn An", amount, method: "Tiền mặt", date: "2026-11-19" });
  const preview = await turn({ text: `Thu của Nguyễn An ${amount} đồng tiền mặt ngày 19/11/2026` });
  expect(preview.status).toBe("confirmation");
  expect(await Payment.countDocuments()).toBe(0);
  const result = await confirm(preview);
  expect(result.status, result.reply).toBe("completed");
  const saved = await Student.findById(studentId).lean();
  expect(saved?.paidAmount).toBe(amount);
  expect(saved?.fee).toBe("2.000.000");
  expect(saved?.installmentStatus.reduce((sum, row) => sum + row.amountDue, 0)).toBe(2000000 - amount);
  expect(await Payment.countDocuments({ studentId, amount })).toBe(1);
  interpret("student.list", { search: "Nguyễn An" }, { newRequest: true });
  const reply = await turn({ text: "An còn thiếu bao nhiêu?" });
  expect(reply.reply).toContain((2000000 - amount).toLocaleString("vi-VN"));
  expect(parseAssistantResultTable(reply.reply)?.rows).toHaveLength(1);
});

it("ST-B02 real DB: create, agree to supplement, update the same record, read it back", async () => {
  interpret("student.create", { fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", registrationDate: "19/11/2026" });
  const preview = await turn({ text: "Thêm Nguyễn An, 0900000000, email an@example.com, đăng ký 19/11/2026" });
  expect(preview.status).toBe("confirmation");
  expect(await Student.countDocuments()).toBe(0);
  const created = await confirm(preview);
  expect(created.status, created.reply).toBe("completed");
  expect(created.reply).toMatch(/Bạn có muốn bổ sung(?: [^?\n]+)? không\?/);
  const original = await Student.findOne({ phone: "0900000000" }).lean();
  await turn({ text: "Có" });
  interpret("student.update", { address: "12 Nguyễn Trãi" });
  const update = await turn({ text: "Địa chỉ 12 Nguyễn Trãi" });
  expect(update.status, update.reply).toBe("confirmation");
  const updated = await confirm(update);
  expect(updated.status).toBe("completed");
  expect(parseAssistantResultTable(updated.reply)).not.toBeNull();
  expect(updated.reply).toContain("12 Nguyễn Trãi");
  expect(updated.reply).not.toContain(String(original!._id));
  expect(await Student.countDocuments()).toBe(1);
  expect(await Student.findById(original!._id).lean()).toMatchObject({ phone: "0900000000", address: "12 Nguyễn Trãi" });
});

it.each(["cancel", "new-goal"])("ST-B10 real DB: %s invalidates a payment preview without creating a receipt", async kind => {
  await seedStudent();
  interpret("student.payment.create", { studentId: "Nguyễn An", amount: 1000000, method: "Tiền mặt", date: "2026-11-19" });
  const preview = await turn({ text: "Thu An một triệu tiền mặt ngày 19/11/2026" });
  expect(preview.status).toBe("confirmation");
  if (kind === "cancel") await turn({ decision: { id: preview.action.id, confirmed: false } });
  else { interpret("student.list", {}, { newRequest: true }); await turn({ text: "Bỏ phiếu thu, xem danh sách thôi" }); }
  expect((await confirm(preview)).status).toBe("failed");
  expect(await Payment.countDocuments()).toBe(0);
  expect((await Student.findById(studentId).lean())?.paidAmount).toBe(0);
});

it("ST-B09 real DB: same owner in another branch is neither listed nor charged", async () => {
  await seedStudent();
  await seedStudent({ _id: secondStudentId, branchId: otherBranch, fullName: "Nguyễn An chi nhánh khác", phone: "0911111111", email: "other@example.test" });
  interpret("student.list", { search: "Nguyễn An" });
  const reply = await turn({ text: "Tìm Nguyễn An ở chi nhánh của tôi" });
  expect(parseAssistantResultTable(reply.reply)?.rows).toHaveLength(1);
  expect(reply.reply).not.toContain("chi nhánh khác");
  await expect(PaymentService.createPayment(owner, { studentId: secondStudentId, amount: 1000000, date: "2026-11-19", method: "Tiền mặt" }, branch)).rejects.toThrow("Không tìm thấy học viên");
  expect(await Payment.countDocuments()).toBe(0);
});

it("ST-B05 real DB: bulk import records exact fees and rejects an invalid row without a phantom record", async () => {
  const rows = [
    { sourceRow: 2, fullName: "Học viên hợp lệ", phone: "0910000001", email: "one@example.test", fee: "1.500.000", feeProvided: true, paidAmount: 0 },
    { sourceRow: 3, fullName: "Học viên sai phí", phone: "0910000002", email: "two@example.test", fee: "abc", feeProvided: true, paidAmount: 0 },
  ];
  const preview = await StudentService.previewBulkStudents(owner, rows, branch);
  expect(preview.errors).toHaveLength(1);
  expect(preview.errors.some(row => row.row === 3)).toBe(true);
  const result = await StudentService.bulkCreateStudents(owner, owner, rows, owner, branch);
  expect(result.importedCount).toBe(1);
  expect(await Student.countDocuments()).toBe(1);
  expect(await Student.findOne({ phone: "0910000001" }).lean()).toMatchObject({ fee: "1.500.000", paidAmount: 0, branchId: branch });
});

it("ST-B05 real DB: actual Excel bytes to conversation confirmation to persisted students and read-back", async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Họ tên", "Số điện thoại", "Email", "Học phí"],
    ["Học viên Excel An", "0910000001", "excel.an@example.com", 1500000],
    ["Học viên Excel Bình", "0910000002", "excel.binh@example.com", 2500000],
  ]), "Học viên");
  const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  const attachment = await readAssistantTableFile({ name: "hoc-vien.xlsx", size: bytes.length, arrayBuffer: async () => bytes } as File);
  expect(attachment.rows[0]["Số điện thoại"]).toBe("0910000001");
  interpret("student.bulk.create", {});
  const preview = await turn({ text: "Nhập hai học viên từ Excel, giữ đúng số điện thoại và học phí trong file", attachment });
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(await Student.countDocuments()).toBe(0);
  const result = await confirm(preview);
  expect(result.status, result.reply).toBe("completed");
  const saved = await Student.find({}).sort({ phone: 1 }).lean();
  expect(saved).toHaveLength(2);
  expect(saved[0]).toMatchObject({ phone: "0910000001", paidAmount: 0 });
  expect(saved[1]).toMatchObject({ phone: "0910000002", paidAmount: 0 });
  expect(saved.map(row => Number(row.fee.replace(/\D/g, "")))).toEqual([1500000, 2500000]);
  interpret("student.list", { search: "Học viên Excel" }, { newRequest: true });
  expect(parseAssistantResultTable((await turn({ text: "Kiểm tra lại các học viên Excel vừa nhập" })).reply)?.rows).toHaveLength(2);
});

it.each([0, 250000])("ST-B08 real DB: change a due date after %s VND paid without changing finances", async paid => {
  await seedStudent();
  if (paid) await PaymentService.createPayment(owner, { studentId, amount: paid, method: "Tiền mặt", date: "2026-11-19" }, branch);
  const before = await Student.findById(studentId).lean();
  interpret("student.installment.update", { path_id: "Nguyễn An", path_no: "1", dueDate: "2026-12-20" });
  const preview = await turn({ text: "Dời hạn thu đợt 1 của Nguyễn An sang 20/12/2026, giữ nguyên số tiền" });
  expect(preview.status, preview.reply).toBe("confirmation");
  const result = await confirm(preview);
  expect(result.status, result.reply).toBe("completed");
  const after = await Student.findById(studentId).lean();
  expect(after?.fee).toBe(before?.fee);
  expect(after?.paidAmount).toBe(before?.paidAmount);
  expect(after?.paymentHistory).toEqual(before?.paymentHistory);
  expect(after?.installmentStatus[0].amountDue).toBe(before?.installmentStatus[0].amountDue);
  expect(new Date(after!.installmentStatus[0].dueAt!).toISOString().slice(0, 10)).toBe("2026-12-20");
  expect(after?.installmentStatus[1]).toEqual(before?.installmentStatus[1]);
});

it("ST-B07 real DB: monthly report includes all 530 receipts and excludes another branch and out-of-period receipts", async () => {
  await seedStudent();
  await Payment.insertMany([
    ...Array.from({ length: 530 }, (_, i) => ({ studentId, studentName: "Nguyễn An", amount: 1000, method: "Tiền mặt", date: "15/11/2026", paidOn: parseBusinessDate("2026-11-15"), ownerId: owner, branchId: branch, note: String(i) })),
    { studentId, studentName: "Nguyễn An", amount: 800000, method: "Tiền mặt", date: "15/10/2026", paidOn: parseBusinessDate("2026-10-15"), ownerId: owner, branchId: branch },
    { studentId, studentName: "Nguyễn An", amount: 9000000, method: "Tiền mặt", date: "15/11/2026", paidOn: parseBusinessDate("2026-11-15"), ownerId: owner, branchId: otherBranch },
  ]);
  interpret("dashboard.business-overview", { query_filter: "custom", query_startDate: "2026-11-01", query_endDate: "2026-11-30" });
  const reply = await turn({ text: "Báo cáo học viên từ 01/11/2026 đến 30/11/2026" });
  expect(reply.status, reply.reply).toBe("completed");
  const rows = parseAssistantResultTable(reply.reply)?.rows;
  expect(rows?.some(row => Object.values(row.values).includes("530.000 ₫"))).toBe(true);
  expect(reply.reply).toContain("01/11/2026");
  expect(reply.reply).toContain("30/11/2026");
  expect(reply.reply).toContain("02/10/2026");
  expect(reply.reply).toContain("31/10/2026");
  expect(reply.reply).toContain("800.000");
  expect(reply.reply).toContain("Chi nhánh đang chọn");
  expect(reply.reply).not.toContain("2.000.000");
  expect(reply.reply).not.toContain("9.000.000");
  expect(await Payment.countDocuments()).toBe(532);
});

it.each(["matching", "receipt-only", "history-only", "foreign-branch"])("ST-B04 real DB: reconcile %s without collecting or modifying money", async kind => {
  await seedStudent({ paidAmount: 500000, paymentHistory: [{ id: paymentId, amount: kind === "history-only" ? 300000 : 500000, date: "19/11/2026", method: "Tiền mặt", recipient: "Thu ngân" }] });
  await Payment.create({ _id: paymentId, studentId, studentName: "Nguyễn An", amount: kind === "receipt-only" ? 700000 : 500000, method: "Tiền mặt", date: "19/11/2026", ownerId: owner, branchId: branch });
  if (kind === "foreign-branch") await Payment.create({ studentId, studentName: "Nguyễn An", amount: 9000000, method: "Tiền mặt", date: "19/11/2026", ownerId: owner, branchId: otherBranch });
  const before = JSON.stringify({ student: await Student.findById(studentId).lean(), payments: await Payment.find({}).lean() });
  interpret("student.payment.reconcile", { path_id: "Nguyễn An" });
  const reply = await turn({ text: "An nói đã đóng mà vẫn báo nợ, kiểm tra giúp tôi, không thu thêm" });
  expect(reply.status, reply.reply).toBe("completed");
  expect(parseAssistantResultTable(reply.reply)).not.toBeNull();
  expect(reply.reply).toContain(["matching", "foreign-branch"].includes(kind) ? "Số liệu khớp" : "Có chênh lệch");
  expect(reply.reply).not.toContain("9.000.000");
  expect(JSON.stringify({ student: await Student.findById(studentId).lean(), payments: await Payment.find({}).lean() })).toBe(before);
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
});

it("ST-B04 real DB: duplicate names require selecting the student before reconciliation", async () => {
  await seedStudent();
  await seedStudent({ _id: secondStudentId, phone: "0911111111", email: "second@example.com" });
  interpret("student.payment.reconcile", { path_id: "Nguyễn An" });
  const choice = await turn({ text: "Kiểm tra tiền đã đóng của Nguyễn An" });
  expect(choice.status).toBe("collecting");
  const selection = choice.referenceSelections?.find(group => group.key === "path_id");
  expect(selection?.options).toHaveLength(2);
  expect(fetcher.mock.calls.some(([url]) => String(url).includes("/reconciliation/"))).toBe(false);
  const selected = await turn({ referenceSelections: { path_id: [selection!.options[0].value] } });
  expect(selected.status).toBe("completed");
  expect(parseAssistantResultTable(selected.reply)).not.toBeNull();
  expect(await Payment.countDocuments()).toBe(0);
});

it.each([[], ["people:read"], ["people:manage"]].map(permissions => ({ permissions })))("ST-B09 real DB: actual permission middleware distinguishes reading from collecting ($permissions)", async ({ permissions }) => {
  const userId = new mongoose.Types.ObjectId();
  await RolePermissionModel.deleteMany({ companyCode: "TEST", role: "user" });
  await RolePermissionModel.create({ companyCode: "TEST", role: "user", permissions: [], level: 1 });
  await UserModel.collection.insertOne({ _id: userId, email: `${userId}@example.com`, role: "user", companyCode: "TEST", permissions } as any);
  const actor: any = { user: { id: String(userId), role: "user", companyCode: "TEST" } };
  const check = async (required: string[]) => {
    let allowed = false;
    const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await requireAnyPermission(required)(actor, response, () => { allowed = true; });
    return { allowed, status: response.statusCode };
  };
  expect((await check(["people:read", "people:manage"])).allowed).toBe(permissions.length > 0);
  expect((await check(["people:manage"])).allowed).toBe(permissions.includes("people:manage"));
  expect(await Payment.countDocuments()).toBe(0);
});

it("ST-B03 real DB: concurrent collections never lose a receipt or overwrite the paid total", async () => {
  await seedStudent();
  await Promise.all([300000, 400000].map(amount => PaymentService.createPayment(owner, { studentId, amount, method: "Tiền mặt", date: "2026-11-19" }, branch)));
  const saved = await Student.findById(studentId).lean();
  expect(await Payment.countDocuments()).toBe(2);
  expect(saved?.paidAmount).toBe(700000);
  expect(saved?.paymentHistory).toHaveLength(2);
  expect(saved?.installmentStatus.reduce((sum, row) => sum + row.amountDue, 0)).toBe(1300000);
});

it("ST-B03 real DB: a failure updating the learner cannot leave a saved receipt behind", async () => {
  await seedStudent();
  const update = vi.spyOn(Student, "updateOne").mockRejectedValueOnce(new Error("simulated storage failure"));
  try { await expect(PaymentService.createPayment(owner, { studentId, amount: 400000, method: "Tiền mặt", date: "2026-11-19" }, branch)).rejects.toThrow(); }
  finally { update.mockRestore(); }
  expect(await Payment.countDocuments()).toBe(0);
  expect((await Student.findById(studentId).lean())?.paidAmount).toBe(0);
});

it.each([0, -100, 99.5, "một triệu", 2000001])("ST-B03 real DB: invalid or excessive amount %s never writes either ledger", async amount => {
  await seedStudent();
  await expect(PaymentService.createPayment(owner, { studentId, amount, method: "Tiền mặt", date: "2026-11-19" }, branch)).rejects.toThrow();
  expect(await Payment.countDocuments()).toBe(0);
  const saved = await Student.findById(studentId).lean();
  expect(saved?.paidAmount).toBe(0);
  expect(saved?.paymentHistory).toHaveLength(0);
  expect(saved?.installmentStatus.map(row => row.amountDue)).toEqual([1000000, 1000000]);
});
