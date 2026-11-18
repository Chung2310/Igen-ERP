import { randomUUID } from "node:crypto";
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
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "student").map(defaultWorkflow)),
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

import { conversationState, processTurn } from "./service";
import { AssistantDocumentModel } from "./models";
import { AssistantError } from "./policy";
import { operationById } from "./catalog";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMessageContent } from "../../src/components/common/AssistantMessageContent";

const studentId = "64b000000000000000000002";
const secondStudentId = "64b000000000000000000007";
const batchId = "64b000000000000000000003";
const paymentId = "64b000000000000000000004";
const examId = "64b000000000000000000005";
const resourceId = "64b000000000000000000006";
const roadmapCourseId = "64b000000000000000000008";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "student-conversation", requestId: randomUUID(), ...input });
const confirm = (reply: any) => turn({ decision: { id: reply.action.id, confirmed: true } });
let students: any[];
let courses: any[];
let batches: any[];
let payments: any[];
let exams: any[];
let eligibleExamStudents: any[];
let resources: any[];
let notifications: any[];
let assignments: any[];
let roadmaps: any[];
let waitlistEntries: any[];
let qualityRows: any[];
let placedWaitlist: any;
let fetcher: ReturnType<typeof vi.fn>;
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const normalizeSearch = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");

it("exports a filtered ERP list through the conversation and restores its file in history", async () => {
  students = [{ _id: studentId, fullName: "Nguyễn An", phone: "0900000000" }, { _id: secondStudentId, fullName: "Trần Bình", phone: "0900000001" }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.list", values: { search: "Nguyễn An" }, intentType: "workflow", newRequest: true });
  const reply = await turn({ mode: "work", text: "Xuất danh sách học viên Nguyễn An ra Excel" });
  expect(reply.status).toBe("completed");
  expect(reply.files).toHaveLength(1);
  expect(state.session.messages.at(-1).files).toEqual(reply.files);
  const saved = vi.mocked(AssistantDocumentModel.create).mock.calls.at(-1)?.[0] as any;
  expect(JSON.stringify(saved.content)).toContain("Nguyễn An");
  expect(JSON.stringify(saved.content)).not.toContain("Trần Bình");
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
});

it("reads a text document, honors explicit user values, confirms and creates exactly one student", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.create", values: { phone: "0909999999" }, intentType: "workflow", newRequest: true });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", registrationDate: "2026-11-14" }) });
  const preview = await turn({ mode: "work", text: "Tạo học viên theo hồ sơ, dùng số điện thoại 0909999999", conversationUpload: { fileName: "ho-so.txt", buffer: Buffer.from("Nguyễn An, 0900000000, an@example.com, đăng ký 14/11/2026") } });
  expect(preview.status).toBe("confirmation");
  expect(students).toHaveLength(0);
  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(students).toHaveLength(1);
  expect(students[0].phone).toBe("0909999999");
  expect(parseAssistantResultTable(created.reply)).not.toBeNull();
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
});

beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset(); state.assertOperation.mockReset().mockImplementation(async (_req: unknown, id: string) => operationById(id)); students = []; courses = []; batches = []; payments = []; exams = []; eligibleExamStudents = []; resources = []; notifications = []; assignments = []; roadmaps = []; waitlistEntries = []; qualityRows = []; placedWaitlist = undefined;
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const requestUrl = new URL(String(url));
    const path = requestUrl.pathname;
    const method = init?.method || "GET";
    const search = normalizeSearch(requestUrl.searchParams.get("search"));
    const filterBySearch = (records: any[], ...keys: string[]) => search
      ? records.filter(record => keys.some(key => normalizeSearch(record[key]).includes(search)))
      : records;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path === "/api/v1/courses" && method === "GET") { const rows = filterBySearch(courses, "title", "code"); return json({ success: true, courses: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/students" && method === "GET") { const rows = filterBySearch(students, "fullName", "phone", "email"); return json({ success: true, students: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/student-quality" && method === "GET") { const rows = filterBySearch(qualityRows, "studentName", "studentPhone", "batchCode", "courseTitle"); return json({ success: true, items: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/batches" && method === "GET") { const rows = filterBySearch(batches, "name", "code"); return json({ success: true, batches: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/branches" && method === "GET") return json({ success: true, branches: [{ _id: req.user.branchId, name: "Trụ sở chính", code: "HQ" }] });
    const batchEnrollmentsMatch = path.match(/^\/api\/v1\/batches\/([^/]+)\/enrollments$/);
    if (batchEnrollmentsMatch && method === "GET") return json({ success: true, data: [{
      _id: "64b000000000000000000031", studentId, __v: 2, branchId: req.user.branchId, studentName: "Nguyễn An", studentPhone: "0900000000", status: "Đang học",
    }] });
    const enrollmentStatusMatch = path.match(/^\/api\/v1\/batches\/([^/]+)\/learners\/([^/]+)\/enrollment-status$/);
    if (enrollmentStatusMatch && method === "PATCH") return json({ success: true, data: {
      status: body.status, suspensionReason: body.reason, attendedSessions: 2, allowedSessions: 10,
    } });
    if (path === "/api/v1/payments" && method === "GET") { const rows = filterBySearch(payments, "studentName", "note"); return json({ success: true, payments: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/exams" && method === "GET") { const rows = filterBySearch(exams, "name", "rank"); return json({ success: true, exams: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    const eligibleExamMatch = path.match(/^\/api\/v1\/exams\/([^/]+)\/eligible-students$/);
    if (eligibleExamMatch && method === "GET") return json({ success: true, data: eligibleExamStudents });
    if (path === "/api/v1/student-resources" && method === "GET") {
      const rows = filterBySearch(resources, "name", "identifier")
        .filter((record: any) => !requestUrl.searchParams.get("type") || record.type === requestUrl.searchParams.get("type"))
        .filter((record: any) => !requestUrl.searchParams.get("excludeType") || record.type !== requestUrl.searchParams.get("excludeType"));
      return json({ success: true, resources: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 });
    }
    if (path === "/api/v1/student-resources/categories" && method === "GET") return json({ success: true, data: [{ _id: "64b000000000000000000009", name: "Thiết bị" }] });
    if (path === "/api/v1/student-resources" && method === "POST") {
      const record = { _id: resourceId, ...body };
      resources.push(record);
      return json({ success: true, data: record });
    }
    if (path === "/api/v1/student-notifications" && method === "GET") { const rows = filterBySearch(notifications, "title", "content", "recipients"); return json({ success: true, notifications: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/learning-roadmaps" && method === "GET") return json({ success: true, data: filterBySearch(roadmaps, "name", "code", "description") });
    if (path === "/api/v1/learning-roadmaps" && method === "POST") {
      const record = { _id: "64b00000000000000000000a", ...body };
      roadmaps.push(record);
      return json({ success: true, data: record });
    }
    if (path === "/api/v1/learning-roadmaps/waitlist" && method === "GET") {
      const rows = filterBySearch(waitlistEntries, "studentName", "studentPhone");
      return json({ success: true, items: rows, total: rows.length, page: 1, totalPages: 1 });
    }
    if (path === "/api/v1/learning-roadmaps/waitlist/place" && method === "POST") {
      placedWaitlist = body;
      return json({ success: true, data: { batchCode: "GTA1", placedCount: body.entryIds.length } });
    }
    if (path === "/api/v1/assignments" && method === "GET") {
      const batchFilter = requestUrl.searchParams.get("batchId");
      const rows = filterBySearch(assignments, "title", "description").filter(record => !batchFilter || record.batchId === batchFilter);
      return json({ success: true, data: rows });
    }
    const studentInstallmentsMatch = path.match(/^\/api\/v1\/students\/([^/]+)\/installments(?:\/([^/]+))?$/);
    if (studentInstallmentsMatch) {
      const student = students.find(record => String(record._id || record.id) === studentInstallmentsMatch[1]);
      if (!student) return new Response(JSON.stringify({ success: false, error: "Không tìm thấy học viên" }), { status: 404, headers: { "Content-Type": "application/json" } });
      student.installmentStatus ??= [];
      if (method === "GET" && !studentInstallmentsMatch[2]) {
        return json({ success: true, data: student.installmentStatus.map((item: any) => ({
          id: String(item.installmentNo), studentName: student.fullName, installmentNo: item.installmentNo,
          amountDue: item.amountDue, status: item.status, dueDate: item.dueDate || "",
        })) });
      }
      if (method === "POST" && !studentInstallmentsMatch[2]) {
        const installmentNo = student.installmentStatus.reduce((max: number, item: any) => Math.max(max, item.installmentNo), 0) + 1;
        const totalFee = Number(String(student.fee || "0").replace(/\D/g, "")) + Number(body.amountDue);
        student.fee = totalFee.toLocaleString("vi-VN");
        const installment = {
          installmentNo, amountDue: Number(body.amountDue), status: "Chưa gửi", dueDate: body.dueDate || "",
          originalAmountDue: Number(body.amountDue),
        };
        student.installmentStatus.push(installment);
        return json({ success: true, data: {
          id: String(installmentNo), studentName: student.fullName, installmentNo,
          amountDue: installment.amountDue, totalFee, status: installment.status, dueDate: installment.dueDate,
        } });
      }
      if (method === "PATCH" && studentInstallmentsMatch[2]) {
        const installment = student.installmentStatus.find((item: any) => String(item.installmentNo) === studentInstallmentsMatch[2]);
        if (!installment) return new Response(JSON.stringify({ success: false, error: "Không tìm thấy đợt học phí" }), { status: 404, headers: { "Content-Type": "application/json" } });
        if (body.amountDue !== undefined) {
          student.fee = (Number(String(student.fee || "0").replace(/\D/g, "")) + Number(body.amountDue) - installment.amountDue).toLocaleString("vi-VN");
          installment.amountDue = Number(body.amountDue);
          installment.originalAmountDue = installment.amountDue;
        }
        if (body.dueDate !== undefined) installment.dueDate = body.dueDate;
        const totalFee = Number(String(student.fee || "0").replace(/\D/g, ""));
        return json({ success: true, data: {
          id: String(installment.installmentNo), studentName: student.fullName, installmentNo: installment.installmentNo,
          amountDue: installment.amountDue, totalFee, status: installment.status, dueDate: installment.dueDate || "",
        } });
      }
    }
    const studentDetailMatch = path.match(/^\/api\/v1\/students\/([^/]+)$/);
    if (studentDetailMatch && method === "GET") {
      const record = students.find(student => String(student._id || student.id) === studentDetailMatch[1]);
      return record ? json({ success: true, data: record }) : new Response(JSON.stringify({ success: false, error: "Không tìm thấy học viên" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (path === "/api/v1/students" && method === "POST") {
      const record = { _id: studentId, __v: 0, ...body, address: body.address || "", payments: [], steps: [] };
      students.push(record); return json({ success: true, data: record });
    }
    if (path === "/api/v1/payments" && method === "POST") {
      const payment = { _id: paymentId, ...body };
      payments.push(payment);
      return json({ success: true, data: payment });
    }
    if (path === "/api/v1/students/bulk-delete-preview" && method === "POST") return json({
      success: true, deletableCount: students.length, blockedCount: 0,
      items: students.map(student => ({ name: student.fullName, reasons: [{ label: "Buổi điểm danh", count: 0, details: [] }] })),
    });
    if (path === "/api/v1/students/bulk-delete" && method === "POST") {
      const deletedCount = Math.min(students.length, Array.isArray(body.ids) ? body.ids.length : 0);
      students.splice(0, deletedCount);
      return json({ success: true, deletedCount, blocked: [] });
    }
    if (studentDetailMatch && method === "PATCH") {
      const record = students.find(student => String(student._id || student.id) === studentDetailMatch[1]);
      if (body.expectedVersion !== record?.__v) return new Response(JSON.stringify({ success: false, error: "Phiên bản đã thay đổi" }), { status: 409, headers: { "Content-Type": "application/json" } });
      const { expectedVersion: _expectedVersion, ...changes } = body;
      Object.assign(record, changes, { __v: record.__v + 1 });
      return json({ success: true, data: record });
    }
    throw new Error(`Unexpected API: ${method} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

it("gives manual steps for a clearly understood student request with no chat workflow and makes no API call", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: null, values: {}, intentType: "unsupported", unsupportedModule: "student" });

  const result = await turn({ text: "Xuất báo cáo phân tích xu hướng học viên" });

  expect(result.status).toBe("unsupported");
  expect(result.reply).toContain("Mình hiểu bạn muốn thực hiện yêu cầu này");
  expect(result.reply).toContain("tab QUẢN LÝ HỌC VIÊN");
  expect(result.reply).toContain("Mở danh sách loại dữ liệu cần tra cứu");
  expect(result.reply).toContain("chưa có dữ liệu nào được thay đổi");
  expect(fetcher).not.toHaveBeenCalled();
});

it("guides manual handling when a recognized workflow is blocked by permissions", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.list", values: {}, intentType: "workflow", newRequest: true });
  state.assertOperation.mockRejectedValueOnce(new AssistantError("Bạn không có quyền dùng thao tác này.", 403));

  const result = await turn({ text: "Danh sách học viên" });

  expect(result.status).toBe("unsupported");
  expect(result.reply).toContain("Chưa thực hiện thay đổi dữ liệu");
  expect(result.reply).toContain("Mở Quản lý học viên → Học viên.");
  expect(result.reply).toContain("Chỉ tiếp tục sau khi được cấp quyền");
  expect(result.link).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});

it("shows the API validation reason without claiming a technical assistant failure or a successful write", async () => {
  const original = fetcher.getMockImplementation() as (...args: any[]) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    if (new URL(String(url)).pathname === "/api/v1/students" && init?.method === "POST") return new Response(JSON.stringify({
      status: "error", message: "Dữ liệu yêu cầu không hợp lệ", errors: { body: ['Trường "email" phải là email hợp lệ.'] },
    }), { status: 400, headers: { "Content-Type": "application/json" } });
    return original(url, init);
  });
  state.interpret.mockResolvedValueOnce({ actionId: "student.create", values: {
    fullName: "An", phone: "0900000000", email: "an@example.test", registrationDate: "18/11/2026",
  }, intentType: "workflow" });
  const preview = await turn({ text: "Tạo học viên An" });
  expect(preview.status).toBe("confirmation");
  const rejected = await confirm(preview);
  expect(rejected.status).toBe("failed");
  expect(rejected.reply).toContain('Trường "email" phải là email hợp lệ.');
  expect(rejected.reply).toContain("Dữ liệu chưa được chấp nhận");
  expect(rejected.reply).not.toContain("trục trặc");
  expect(students).toHaveLength(0);
});

it("creates one student, asks about missing optional fields, supplements that record, and renders shared result tables", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.create", values: {
    fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", registrationDate: "14/11/2026",
  }, intentType: "workflow", newRequest: false });
  const preview = await turn({ text: "Thêm hồ sơ học viên Nguyễn An, số điện thoại 0900000000, email an@example.com, ngày đăng ký 14/11/2026" });
  expect(preview.status).toBe("confirmation");
  expect(preview.reply).toBe("Bạn kiểm tra thông tin bên dưới nhé. Nếu đã đúng, bạn xác nhận để mình thực hiện.");
  expect(students).toHaveLength(0);

  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(students).toHaveLength(1);
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(parseAssistantResultTable(created.reply)?.rows[0].values).toMatchObject({ "Họ và tên": "Nguyễn An", Email: "an@example.com" });

  const agreed = await turn({ text: "Có" });
  expect(agreed.status).toBe("collecting");
  state.interpret.mockResolvedValueOnce({ actionId: "student.update", values: { rank: "B1" }, intentType: "workflow", newRequest: false });
  const update = await turn({ text: "Bổ sung hạng B1 cho học viên vừa tạo" });
  expect(update.status).toBe("confirmation");
  expect(JSON.stringify(update)).not.toContain(studentId);

  const saved = await confirm(update);
  expect(saved.status).toBe("completed");
  expect(students).toHaveLength(1);
  expect(students[0]).toMatchObject({ fullName: "Nguyễn An", rank: "B1", __v: 1 });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/students" && init?.method === "POST")).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/students/${studentId}` && init?.method === "PATCH")).toHaveLength(1);
  const table = parseAssistantResultTable(saved.reply);
  expect(table?.rows[0].values).toMatchObject({ "Họ và tên": "Nguyễn An", "Hạng": "B1" });
  const rendered = renderToStaticMarkup(createElement(AssistantMessageContent, { content: saved.reply }));
  expect(rendered).toContain("<table");
  expect(rendered).toContain("B1");
  expect(saved.reply).not.toContain(studentId);

  state.interpret.mockResolvedValueOnce({ actionId: "student.bulk.delete", values: { ids: JSON.stringify(["Nguyễn An"]) }, intentType: "workflow", newRequest: true });
  const deletePreview = await turn({ text: "Xóa hồ sơ học viên Nguyễn An" });
  expect(deletePreview.status).toBe("confirmation");
  expect(deletePreview.action?.values.some(value => value.label === "Ảnh hưởng khi xóa"
    && typeof value.value === "string" && value.value.includes("Nguyễn An"))).toBe(true);
  expect(students).toHaveLength(1);
  const deleted = await confirm(deletePreview);
  expect(deleted.status).toBe("completed");
  expect(students).toHaveLength(0);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/students/bulk-delete-preview" && init?.method === "POST")).toHaveLength(2);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/students/bulk-delete" && init?.method === "POST")).toHaveLength(1);
});

it("searches student quality and renders readable metrics in the chat table", async () => {
  qualityRows = [
    {
      studentName: "Ho\u00E0ng KHoa", studentPhone: "0983721827", batchCode: "LOPKIEMTIEN001", courseTitle: "Kh\u00F3a ki\u1EBFm ti\u1EC1n",
      attendanceAttended: 0, attendanceTotal: 0, attendanceRate: null,
      assignmentCompleted: 0, assignmentTotal: 0, assignmentRate: null,
      warningLevel: "unrated",
    },
    {
      studentName: "La V\u0103n S\u1EBFn", studentPhone: "0987217127", batchCode: "LOPKIEMTIEN001", courseTitle: "Kh\u00F3a ki\u1EBFm ti\u1EC1n",
      attendanceAttended: 0, attendanceTotal: 0, attendanceRate: null,
      assignmentCompleted: 0, assignmentTotal: 0, assignmentRate: null,
      warningLevel: "unrated",
    },
  ];
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Ki\u1EC3m tra ch\u1EA5t l\u01B0\u1EE3ng h\u1ECDc vi\u00EAn" });

  expect(result.status).toBe("completed");
  const table = parseAssistantResultTable(result.reply);
  expect(table?.rows).toHaveLength(2);
  expect(table?.rows[0].values).toMatchObject({
    "H\u1ECDc vi\u00EAn": "Ho\u00E0ng KHoa",
    "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i": "0983721827",
    "Chuy\u00EAn c\u1EA7n": "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u",
    "B\u00E0i t\u1EADp": "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u",
    "M\u1EE9c \u0111\u00E1nh gi\u00E1": "Ch\u01B0a \u0111\u00E1nh gi\u00E1",
  });
  expect(table?.rows[1].values["H\u1ECDc vi\u00EAn"]).toBe("La V\u0103n S\u1EBFn");
  expect(result.reply).not.toContain("unrated");
  expect(result.reply).not.toContain("Th\u00F4ng tin:");
  expect(state.provider).not.toHaveBeenCalled();
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/student-quality");
  expect(request).toBeDefined();
});

it("answers a plain-language tuition question with the student's fee summary", async () => {
  students = [
    { _id: studentId, fullName: "La V\u0103n S\u1EBFn", phone: "0987217127", fee: "4200000", paidAmount: 1200000, status: ["\u0110ang h\u1ECDc"] },
    { _id: secondStudentId, fullName: "La V\u0103n S\u01A1n", phone: "0987217000", fee: "3200000", paidAmount: 0, status: ["\u0110ang h\u1ECDc"] },
  ];
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Th\u00F4ng tin h\u1ECDc ph\u00ED c\u1EE7a La V\u0103n S\u1EBFn" });

  expect(result.status).toBe("completed");
  const rows = parseAssistantResultTable(result.reply)?.rows;
  expect(rows).toHaveLength(1);
  expect(rows?.[0].values).toMatchObject({
    "H\u1ECDc vi\u00EAn": "La V\u0103n S\u1EBFn",
    "H\u1ECDc ph\u00ED": "4.200.000 \u20AB",
    "\u0110\u00E3 thanh to\u00E1n": "1.200.000 \u20AB",
    "C\u00F2n ph\u1EA3i \u0111\u00F3ng": "3.000.000 \u20AB",
    "Tr\u1EA1ng th\u00E1i": "\u0110ang h\u1ECDc",
  });
  expect(JSON.stringify(rows?.[0].values)).not.toContain("La V\u0103n S\u01A1n");
  expect(result.reply).not.toContain("Tr\u01B0\u1EDDng kh\u00F4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3");
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/students");
  expect(request).toBeDefined();
  expect(new URL(String(request![0])).searchParams.get("search")).toBe("La V\u0103n S\u1EBFn");
});

it("creates a tuition installment, confirms the total increase, and adds its missing due date to the same installment", async () => {
  students = [{
    _id: studentId, __v: 0, fullName: "ABC", phone: "0900000000", fee: "5000000", paidAmount: 0,
    status: "Đang học", installmentStatus: [],
  }];
  state.interpret.mockResolvedValueOnce({
    actionId: "student.installment.create", values: { path_id: "ABC", amountDue: 5_000_000 },
    intentType: "workflow", newRequest: true,
  });

  const preview = await turn({ text: "Thêm học phí cho học viên ABC 5 triệu" });

  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("5.000.000 ₫");
  expect(JSON.stringify(preview)).toContain("10.000.000 ₫");
  expect(students[0].installmentStatus).toHaveLength(0);
  expect(JSON.stringify(preview)).not.toContain(studentId);

  const created = await confirm(preview);
  expect(created.status).toBe("completed");
  expect(students[0]).toMatchObject({ fee: "10.000.000", paidAmount: 0 });
  expect(students[0].installmentStatus).toHaveLength(1);
  expect(students[0].installmentStatus[0]).toMatchObject({ installmentNo: 1, amountDue: 5_000_000, status: "Chưa gửi", dueDate: "" });
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(JSON.stringify(created)).not.toContain(studentId);

  const agreed = await turn({ text: "Có" });
  expect(agreed.status).toBe("collecting");
  expect(agreed.reply).toContain("cập nhật");
  expect(JSON.stringify(agreed)).not.toContain(studentId);

  state.interpret.mockResolvedValueOnce({
    actionId: "student.installment.update", values: { dueDate: "2026-12-15" },
    intentType: "workflow", newRequest: false,
  });
  const datePreview = await turn({ text: "Đặt hạn thu đợt vừa tạo là ngày 15/12/2026" });
  expect(datePreview.status).toBe("confirmation");
  expect(JSON.stringify(datePreview)).toContain("15/12/2026");
  expect(JSON.stringify(datePreview)).not.toContain(studentId);

  const updated = await confirm(datePreview);
  expect(updated.status).toBe("completed");
  expect(students[0].installmentStatus).toHaveLength(1);
  expect(students[0].installmentStatus[0]).toMatchObject({ installmentNo: 1, amountDue: 5_000_000, dueDate: "2026-12-15" });
  expect(students[0].fee).toBe("10.000.000");
  const table = parseAssistantResultTable(updated.reply);
  expect(table?.rows).toHaveLength(1);
  expect(JSON.stringify(table?.rows[0].values)).toContain("ABC");
  expect(JSON.stringify(table?.rows[0].values)).toContain("15/12/2026");
  expect(updated.reply).not.toContain(studentId);
  expect(renderToStaticMarkup(createElement(AssistantMessageContent, { content: updated.reply }))).toContain("<table");
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/students/${studentId}/installments` && init?.method === "POST")).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/students/${studentId}/installments/1` && init?.method === "PATCH")).toHaveLength(1);
});

it("understands a request for tuition payment history and filters by the learner's name", async () => {
  payments = [
    { _id: paymentId, studentName: "La V\u0103n S\u1EBFn", amount: 1200000, method: "Chuy\u1EC3n kho\u1EA3n", date: "2026-11-01", note: "\u0110\u1EE3t 1" },
    { _id: secondStudentId, studentName: "La V\u0103n S\u01A1n", amount: 900000, method: "Ti\u1EC1n m\u1EB7t", date: "2026-11-02", note: "\u0110\u1EE3t 1" },
  ];
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "L\u1ECBch s\u1EED \u0111\u00F3ng h\u1ECDc ph\u00ED c\u1EE7a La V\u0103n S\u1EBFn" });

  expect(result.status).toBe("completed");
  const rows = parseAssistantResultTable(result.reply)?.rows;
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows?.[0].values)).toContain("La V\u0103n S\u1EBFn");
  expect(JSON.stringify(rows?.[0].values)).toContain("1.200.000");
  expect(JSON.stringify(rows?.[0].values)).not.toContain("La V\u0103n S\u01A1n");
  expect(result.reply).not.toContain("Tr\u01B0\u1EDDng kh\u00F4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3");
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/payments");
  expect(request).toBeDefined();
  expect(new URL(String(request![0])).searchParams.get("search")).toBe("La V\u0103n S\u1EBFn");
  expect(state.provider).not.toHaveBeenCalled();
});

it.each([
  { actionId: "student.list", values: { search: "Nguyễn An" }, text: "Tìm học viên Nguyễn An", path: "/api/v1/students", expected: "Nguyễn An", excluded: "Trần Bình" },
  { actionId: "course.list", values: { search: "Tiếng Anh A1" }, text: "Tìm khóa học Tiếng Anh A1", path: "/api/v1/courses", expected: "Tiếng Anh A1", excluded: "Tiếng Anh B1" },
  { actionId: "batch.list", values: { search: "Lớp giao tiếp A1" }, text: "Tìm lớp giao tiếp A1", path: "/api/v1/batches", expected: "Lớp giao tiếp A1", excluded: "Lớp giao tiếp A2" },
  { actionId: "student.payment.list", values: { query_search: "Nguyễn An" }, text: "Tìm giao dịch học phí của Nguyễn An", path: "/api/v1/payments", expected: "Nguyễn An", excluded: "Trần Bình" },
  { actionId: "student.exam.list", values: { query_search: "Kiểm tra đầu vào" }, text: "Tìm kỳ kiểm tra đầu vào", path: "/api/v1/exams", expected: "Kiểm tra đầu vào", excluded: "Kiểm tra cuối khóa" },
  { actionId: "student.resource.list", values: { query_search: "P101" }, text: "Tìm tài nguyên P101", path: "/api/v1/student-resources", expected: "Phòng học P101", excluded: "Phòng học P202" },
  { actionId: "student.notification.list", values: { query_search: "Lịch nghỉ lễ" }, text: "Tìm thông báo lịch nghỉ lễ", path: "/api/v1/student-notifications", expected: "Lịch nghỉ lễ", excluded: "Lịch thi cuối kỳ" },
  { actionId: "student.learning-roadmap.waitlist.list", values: { query_search: "Nguyễn An" }, text: "Tìm học viên Nguyễn An trong danh sách chờ lộ trình", path: "/api/v1/learning-roadmaps/waitlist", expected: "Nguyễn An", excluded: "Trần Bình" },
  { actionId: "student.assignment.list", values: { query_batchId: "Lớp giao tiếp A1", query_search: "Bài đọc A1" }, text: "Tìm bài đọc A1 của lớp giao tiếp A1", path: "/api/v1/assignments", expected: "Bài đọc A1", excluded: "Bài viết A1" },
  { actionId: "student.learning-roadmap.list", values: {}, text: "Xem danh sách lộ trình học", path: "/api/v1/learning-roadmaps", expected: "Lộ trình A1", excluded: "", expectedCount: 2 },
  { actionId: "student.learning-roadmap.list", values: { query_search: "Lộ trình A1" }, text: "Tìm lộ trình A1", path: "/api/v1/learning-roadmaps", expected: "Lộ trình A1", excluded: "Lộ trình B1", expectedCount: 1 },
])("searches or views $actionId and returns the matching records", async ({ actionId, values, text, path, expected, excluded, expectedCount }) => {
  students = [
    { _id: studentId, __v: 0, fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", rank: "A1", registrationDate: "2026-10-01", fee: 2500000, paidAmount: 1000000, status: "Đang học" },
    { _id: secondStudentId, __v: 0, fullName: "Trần Bình", phone: "0910000000", email: "binh@example.com", rank: "B1", registrationDate: "2026-10-02", fee: 3000000, paidAmount: 1500000, status: "Đang học" },
  ];
  courses = [
    { _id: "64b000000000000000000011", title: "Tiếng Anh A1", code: "TA-A1", status: "Hoạt động" },
    { _id: "64b000000000000000000012", title: "Tiếng Anh B1", code: "TA-B1", status: "Hoạt động" },
  ];
  batches = [
    { _id: batchId, code: "LOP-A1", name: "Lớp giao tiếp A1", status: "Đang học" },
    { _id: "64b000000000000000000013", code: "LOP-A2", name: "Lớp giao tiếp A2", status: "Đang học" },
  ];
  payments = [
    { _id: paymentId, __v: 0, studentName: "Nguyễn An", amount: 2500000, method: "Tiền mặt", date: "2026-10-10", note: "Học phí tháng 10" },
    { _id: "64b000000000000000000014", __v: 0, studentName: "Trần Bình", amount: 3000000, method: "Chuyển khoản", date: "2026-10-12", note: "Học phí tháng 10" },
  ];
  exams = [
    { _id: examId, name: "Kiểm tra đầu vào", code: "KT-01", status: "Sắp diễn ra" },
    { _id: "64b000000000000000000015", name: "Kiểm tra cuối khóa", code: "KT-02", status: "Sắp diễn ra" },
  ];
  resources = [
    { _id: resourceId, name: "Phòng học P101", type: "Phòng học", identifier: "P101", status: "Hoạt động" },
    { _id: "64b000000000000000000016", name: "Phòng học P202", type: "Phòng học", identifier: "P202", status: "Hoạt động" },
  ];
  notifications = [
    { _id: "64b000000000000000000017", title: "Lịch nghỉ lễ", content: "Trung tâm nghỉ ngày 20/11", recipients: "Học viên lớp A1", recipientCount: 12, channels: ["Email"], status: "Đã gửi", createdAt: "2026-11-01T03:00:00.000Z" },
    { _id: "64b000000000000000000018", title: "Lịch thi cuối kỳ", content: "Lịch kiểm tra cuối khóa", recipients: "Học viên lớp A1", recipientCount: 12, channels: ["Email"], status: "Đã gửi", createdAt: "2026-11-02T03:00:00.000Z" },
  ];
  assignments = [
    { _id: "64b000000000000000000019", batchId, title: "Bài đọc A1", description: "Đọc bài 1", dueDate: "2026-11-20", maxScore: 10 },
    { _id: "64b000000000000000000020", batchId, title: "Bài viết A1", description: "Viết đoạn văn", dueDate: "2026-11-22", maxScore: 10 },
  ];
  roadmaps = [
    { _id: "64b000000000000000000021", code: "LR-A1", name: "Lộ trình A1", description: "Tiếng Anh căn bản", status: "active" },
    { _id: "64b000000000000000000022", code: "LR-B1", name: "Lộ trình B1", description: "Tiếng Anh nâng cao", status: "active" },
  ];
  waitlistEntries = [
    { _id: studentId, studentName: "Nguyễn An", studentPhone: "0900000000", roadmapName: "Lộ trình A1", sourceBatchCode: "LOP-A0", learningFormat: "Trực tiếp", preferredTimeSlot: "Buổi sáng", waitingDays: 5 },
    { _id: secondStudentId, studentName: "Trần Bình", studentPhone: "0910000000", roadmapName: "Lộ trình B1", sourceBatchCode: "LOP-B0", learningFormat: "Trực tuyến", preferredTimeSlot: "Buổi tối", waitingDays: 2 },
  ];
  state.interpret.mockResolvedValueOnce({ actionId, values, intentType: "workflow", newRequest: true });

  const result = await turn({ text });

  expect(result.status).toBe("completed");
  const table = parseAssistantResultTable(result.reply);
  expect(table?.rows).toHaveLength(expectedCount ?? 1);
  expect(renderToStaticMarkup(createElement(AssistantMessageContent, { content: result.reply }))).toContain("<table");
  const displayed = JSON.stringify(table?.rows.map(row => row.values));
  expect(displayed).toContain(expected);
  if (excluded) expect(displayed).not.toContain(excluded);
  const apiRequest = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === path);
  expect(apiRequest).toBeDefined();
  expect(new URL(String(apiRequest![0])).searchParams.get("search") ?? undefined).toBe(values.search ?? values.query_search);
  if (actionId === "student.assignment.list") expect(new URL(String(apiRequest![0])).searchParams.get("batchId")).toBe(batchId);
});

it("searches the learning-roadmap waitlist and places the matching learner in the selected class", async () => {
  waitlistEntries = [
    { id: studentId, studentName: "Nguyễn An", studentPhone: "0900000000", roadmapName: "Lộ trình A1", sourceBatchCode: "LOP-A0", learningFormat: "Trực tiếp", preferredTimeSlot: "Buổi sáng", waitingDays: 5 },
    { id: secondStudentId, studentName: "Trần Bình", studentPhone: "0910000000", roadmapName: "Lộ trình B1", sourceBatchCode: "LOP-B0", learningFormat: "Trực tuyến", preferredTimeSlot: "Buổi tối", waitingDays: 2 },
  ];
  batches = [{ _id: batchId, code: "GTA1", name: "Lớp giao tiếp A1", courseTitle: "Tiếng Anh A1", status: "Sắp khai giảng" }];

  state.interpret.mockResolvedValueOnce({ actionId: "student.learning-roadmap.waitlist.list", values: { query_search: "Nguyễn An" }, intentType: "workflow", newRequest: true });
  const search = await turn({ text: "Tìm Nguyễn An trong danh sách chờ lộ trình" });
  expect(search.status).toBe("completed");
  expect(parseAssistantResultTable(search.reply)?.rows[0].values["Học viên"]).toBe("Nguyễn An");
  expect(parseAssistantResultTable(search.reply)?.rows).toHaveLength(1);
  const searchRequest = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/learning-roadmaps/waitlist");
  expect(new URL(String(searchRequest![0])).searchParams.get("search")).toBe("Nguyễn An");

  state.interpret.mockResolvedValueOnce({ actionId: "student.learning-roadmap.waitlist.place", values: { batchId: "Lớp giao tiếp A1", entryIds: ["Nguyễn An"] }, intentType: "workflow", newRequest: true });
  const preview = await turn({ text: "Xếp Nguyễn An trong danh sách chờ vào lớp giao tiếp A1" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Nguyễn An");
  expect(JSON.stringify(preview)).toContain("Lớp giao tiếp A1");
  expect(JSON.stringify(preview)).not.toContain(studentId);

  const placed = await confirm(preview);
  expect(placed.status).toBe("completed");
  expect(placedWaitlist).toEqual({ batchId, entryIds: [studentId] });
  expect(JSON.stringify(placed)).not.toContain(studentId);
});

it("accepts a studentName alias when the user searches tuition information", async () => {
  payments = [
    { _id: paymentId, __v: 0, studentName: "La Văn Sến", amount: 4200000, method: "Chuyển khoản", date: "2026-11-01", note: "Học phí đợt 1" },
    { _id: secondStudentId, __v: 0, studentName: "La Văn Sơn", amount: 3200000, method: "Tiền mặt", date: "2026-11-02", note: "Học phí đợt 1" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "student.payment.list", values: { studentName: "La Văn Sến" }, intentType: "workflow", newRequest: true });

  const result = await turn({ text: "Thông tin học phí của La Văn Sến" });

  expect(result.status).toBe("completed");
  const table = parseAssistantResultTable(result.reply);
  expect(table?.rows).toHaveLength(1);
  expect(JSON.stringify(table?.rows[0].values)).toContain("La Văn Sến");
  expect(JSON.stringify(table?.rows[0].values)).not.toContain("La Văn Sơn");
  const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname === "/api/v1/payments");
  expect(request).toBeDefined();
  expect(new URL(String(request![0])).searchParams.get("search")).toBe("La Văn Sến");
  expect(result.reply).not.toContain("Trường không được hỗ trợ");
});

it("opens and updates the same student found by a prior search", async () => {
  students = [{
    _id: studentId, __v: 4, fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com",
    rank: "A1", registrationDate: "2026-10-01", enrollmentDate: "2026-10-03", fee: 2500000, paidAmount: 1000000, status: "Đang học",
  }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.list", values: { search: "Nguyễn An" }, intentType: "workflow", newRequest: true });
  const searchResult = await turn({ text: "Tìm học viên Nguyễn An" });
  expect(searchResult.status).toBe("completed");
  expect(parseAssistantResultTable(searchResult.reply)?.rows[0].values["Học viên"]).toBe("Nguyễn An");

  state.interpret.mockResolvedValueOnce({ actionId: "student.detail", values: { path_id: "Nguyễn An" }, intentType: "workflow", newRequest: true });
  const detail = await turn({ text: "Mở hồ sơ học viên Nguyễn An" });
  expect(detail.status).toBe("completed");
  expect(parseAssistantResultTable(detail.reply)?.rows[0].values).toMatchObject({ "Họ và tên": "Nguyễn An", Email: "an@example.com" });
  expect(detail.reply).not.toContain(studentId);

  state.interpret.mockResolvedValueOnce({ actionId: "student.update", values: { path_id: "Nguyễn An", email: "an.moi@example.com" }, intentType: "workflow", newRequest: true });
  const update = await turn({ text: "Cập nhật email của học viên Nguyễn An thành an.moi@example.com" });
  expect(update.status).toBe("confirmation");
  expect(JSON.stringify(update)).toContain("Nguyễn An");
  expect(JSON.stringify(update)).not.toContain(studentId);
  const saved = await confirm(update);
  expect(saved.status).toBe("completed");
  expect(students[0]).toMatchObject({ _id: studentId, fullName: "Nguyễn An", email: "an.moi@example.com", __v: 5 });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/students/${studentId}` && init?.method === "PATCH")).toHaveLength(1);
});

it("asks which matching student to update when a search finds similar names", async () => {
  students = [
    { _id: studentId, __v: 1, fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", status: "Đang học" },
    { _id: secondStudentId, __v: 2, fullName: "Nguyễn Anh", phone: "0910000000", email: "anh@example.com", status: "Đang học" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "student.list", values: { search: "Nguyễn" }, intentType: "workflow", newRequest: true });
  const search = await turn({ text: "Tìm học viên tên Nguyễn" });
  expect(search.status).toBe("completed");
  expect(parseAssistantResultTable(search.reply)?.rows).toHaveLength(2);

  state.interpret.mockResolvedValueOnce({ actionId: "student.update", values: { path_id: "Nguyễn", email: "anh.moi@example.com" }, intentType: "workflow", newRequest: true });
  const choice = await turn({ text: "Cập nhật email cho học viên vừa tìm thấy thành anh.moi@example.com" });
  expect(choice.status).toBe("collecting");
  const studentChoice = choice.referenceSelections?.find(group => group.key === "path_id");
  expect(studentChoice?.options).toHaveLength(2);
  expect(studentChoice?.options.map(option => option.label).join(" ")).toContain("Nguyễn An");
  expect(studentChoice?.options.map(option => option.label).join(" ")).toContain("Nguyễn Anh");
  expect(JSON.stringify(choice)).not.toContain(studentId);
  expect(JSON.stringify(choice)).not.toContain(secondStudentId);

  const preview = await turn({ referenceSelections: { path_id: [studentChoice!.options.find(option => option.label.includes("Nguyễn Anh"))!.value] } });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Nguyễn Anh");
  expect(JSON.stringify(preview)).not.toContain(studentId);
  expect(JSON.stringify(preview)).not.toContain(secondStudentId);
  const saved = await confirm(preview);
  expect(saved.status).toBe("completed");
  expect(students[0]).toMatchObject({ fullName: "Nguyễn An", email: "an@example.com", __v: 1 });
  expect(students[1]).toMatchObject({ fullName: "Nguyễn Anh", email: "anh.moi@example.com", __v: 3 });
});

it("offers the full course list for class creation and accepts a course selected in chat", async () => {
  courses = Array.from({ length: 12 }, (_, index) => ({
    _id: (index + 1).toString(16).padStart(24, "0"),
    title: index === 11 ? "Khóa học nâng cao" : `Khóa học cơ bản ${String(index + 1).padStart(2, "0")}`,
    code: `KH${String(index + 1).padStart(2, "0")}`,
    status: "Hoạt động",
  }));
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "course.create", values: {
    code: "LOP-THU-01", daysOfWeek: [1], startTime: "09:00", endTime: "10:00", startDate: "2026-11-20", endDate: "2026-12-20",
  } }) });
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const selection = await turn({ text: "Tạo lớp LOP-THU-01, học thứ Hai từ 09:00 đến 10:00, khai giảng ngày 20/11/2026 và kết thúc ngày 20/12/2026" });

  expect(selection.status).toBe("collecting");
  expect(state.provider).toHaveBeenCalledOnce();
  const courseSelection = selection.referenceSelections?.find(group => group.key === "courseId");
  expect(courseSelection?.required).toBe(true);
  expect(courseSelection?.options).toHaveLength(12);
  expect(courseSelection?.options.map(option => option.label)).toContain("Khóa học nâng cao — mã KH12");
  expect(selection.reply).toContain("trong danh sách bên dưới");
  expect(selection.reply).not.toContain("Khóa học cơ bản 01 — mã KH01");
  expect(JSON.stringify(selection)).not.toContain(courses[11]._id);

  const selected = await turn({ referenceSelections: { courseId: [courseSelection!.options[11].value] } });
  expect(selected.status).toBe("confirmation");
  expect(selected.action?.title).toBe("Tạo lớp học");
  expect(selected.action?.values.some(value => value.label === "Tên hoặc mã khóa học" && String(value.value).includes("Khóa học nâng cao"))).toBe(true);
  expect(JSON.stringify(selected)).not.toContain(courses[11]._id);
});

it("lets the user select both a class and learner before adding the learner", async () => {
  batches = [{ _id: batchId, __v: 0, code: "LOP-A1", name: "Lớp giao tiếp A1", courseTitle: "Tiếng Anh A1", status: "Đang học" }];
  students = [{ _id: studentId, fullName: "Nguyễn An", phone: "0900000000" }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.batch.learner.add", values: {}, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Thêm Nguyễn An vào lớp giao tiếp A1" });

  expect(selection.status).toBe("collecting");
  const batchSelection = selection.referenceSelections?.find(group => group.key === "path_id");
  const learnerSelection = selection.referenceSelections?.find(group => group.key === "studentId");
  expect(batchSelection?.options.map(option => option.label).join(" ")).toContain("Lớp giao tiếp A1");
  expect(learnerSelection?.options.map(option => option.label).join(" ")).toContain("Nguyễn An");
  expect(selection.reply).toContain("trong danh sách bên dưới");

  const preview = await turn({ referenceSelections: {
    path_id: [batchSelection!.options[0].value],
    studentId: [learnerSelection!.options[0].value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Thêm học viên vào lớp");
  expect(JSON.stringify(preview)).toContain("Nguyễn An");
  expect(JSON.stringify(preview)).toContain("Lớp giao tiếp A1");
  expect(JSON.stringify(preview)).not.toContain(batchId);
  expect(JSON.stringify(preview)).not.toContain(studentId);
});

it("asks for the learner in the selected class before confirming a suspension", async () => {
  batches = [{ _id: batchId, code: "LOP-A1", name: "Lớp giao tiếp A1", courseTitle: "Tiếng Anh A1", status: "Đang học", branchId: req.user.branchId }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.batch.enrollment.update", values: {
    status: "Bảo lưu", reason: "Học viên xin tạm dừng",
  }, intentType: "workflow", newRequest: true });

  const classPrompt = await turn({ text: "Bảo lưu học viên" });

  expect(classPrompt.status).toBe("collecting");
  expect(classPrompt.reply).not.toContain("Chưa có lựa chọn khả dụng cho Tên hoặc số điện thoại học viên trong lớp");
  const classSelection = classPrompt.referenceSelections?.find(group => group.key === "path_id");
  expect(classSelection?.options.map(option => option.label).join(" ")).toContain("Lớp giao tiếp A1");
  expect(classPrompt.referenceSelections?.some(group => group.key === "path_studentId")).toBe(false);

  const learnerPrompt = await turn({ referenceSelections: { path_id: [classSelection!.options[0].value] } });

  expect(learnerPrompt.status).toBe("collecting");
  const learnerSelection = learnerPrompt.referenceSelections?.find(group => group.key === "path_studentId");
  expect(learnerSelection?.options.map(option => option.label).join(" ")).toContain("Nguyễn An");
  expect(learnerSelection?.options.map(option => option.label).join(" ")).not.toContain("Trụ sở chính");

  const preview = await turn({ referenceSelections: { path_studentId: [learnerSelection!.options[0].value] } });

  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Nguyễn An");
  expect(JSON.stringify(preview)).toContain("Bảo lưu");
  expect(JSON.stringify(preview)).not.toContain(batchId);
  expect(JSON.stringify(preview)).not.toContain(studentId);

  const updated = await confirm(preview);

  expect(updated.status).toBe("completed");
  const updateCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname.endsWith(`/learners/${studentId}/enrollment-status`) && init?.method === "PATCH");
  expect(updateCall).toBeDefined();
  expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ status: "Bảo lưu", reason: "Học viên xin tạm dừng" });
  expect(JSON.parse(String(updateCall?.[1]?.body))).not.toHaveProperty("expectedVersion");
});

it("collects a required suspension reason and reopens an older preview missing it", async () => {
  batches = [{ _id: batchId, code: "LOP-A1", name: "Lớp giao tiếp A1", courseTitle: "Tiếng Anh A1", status: "Đang học", branchId: req.user.branchId }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.batch.enrollment.update", values: {
    status: "Bảo lưu",
  }, intentType: "workflow", newRequest: true });

  const classPrompt = await turn({ text: "Bảo lưu học viên" });
  const classSelection = classPrompt.referenceSelections?.find(group => group.key === "path_id");
  const learnerPrompt = await turn({ referenceSelections: { path_id: [classSelection!.options[0].value] } });
  const learnerSelection = learnerPrompt.referenceSelections?.find(group => group.key === "path_studentId");
  const reasonPrompt = await turn({ referenceSelections: { path_studentId: [learnerSelection!.options[0].value] } });

  expect(classPrompt.status).toBe("collecting");
  expect(learnerPrompt.status).toBe("collecting");
  expect(reasonPrompt.status).toBe("collecting");
  expect(reasonPrompt.reply).toContain("Lý do");
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname.endsWith(`/learners/${studentId}/enrollment-status`) && init?.method === "PATCH")).toBe(false);

  state.interpret.mockResolvedValueOnce({ actionId: "student.batch.enrollment.update", values: {
    reason: "Học viên xin tạm dừng",
  }, intentType: "workflow", newRequest: false });
  const preview = await turn({ text: "Lý do: học viên xin tạm dừng" });
  expect(preview.status).toBe("confirmation");

  delete state.session.pending.provided.reason;
  delete state.session.pending.resolved.reason;
  const reopened = await confirm(preview);

  expect(reopened.status).toBe("collecting");
  expect(reopened.reply).toContain("Lý do");
  expect(fetcher.mock.calls.some(([url, init]) => new URL(String(url)).pathname.endsWith(`/learners/${studentId}/enrollment-status`) && init?.method === "PATCH")).toBe(false);

  state.interpret.mockResolvedValueOnce({ actionId: "student.batch.enrollment.update", values: {
    reason: "Học viên xin tạm dừng",
  }, intentType: "workflow", newRequest: false });
  const correctedPreview = await turn({ text: "Lý do: học viên xin tạm dừng" });
  expect(correctedPreview.status).toBe("confirmation");
  const updated = await confirm(correctedPreview);

  expect(updated.status).toBe("completed");
  const updateCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname.endsWith(`/learners/${studentId}/enrollment-status`) && init?.method === "PATCH");
  expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ status: "Bảo lưu", reason: "Học viên xin tạm dừng" });
  expect(JSON.parse(String(updateCall?.[1]?.body))).not.toHaveProperty("expectedVersion");
});

it("confirms tuition once even when reference resolution adds the learner's display name", async () => {
  students = [{ _id: studentId, fullName: "Nguyễn An", fee: "10000000", paidAmount: 0, __v: 0 }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.payment.create", values: {
    studentId: "Nguyễn An", amount: 3000000, method: "Tiền mặt", date: "2026-11-18",
  }, intentType: "workflow", newRequest: true });
  const preview = await turn({ text: "Thu học phí Nguyễn An 3 triệu tiền mặt ngày 18/11/2026" });
  expect(preview.status).toBe("confirmation");
  const result = await confirm(preview);
  expect(result.status).toBe("completed");
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({ studentId, amount: 3000000, date: "2026-11-18" });
});

async function paymentPreview() {
  students = [{ _id: studentId, fullName: "Nguyễn An", fee: "10000000", paidAmount: 0, __v: 0 }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.payment.create", values: {
    studentId: "Nguyễn An", amount: 3000000, method: "Tiền mặt", date: "2026-11-18",
  }, intentType: "workflow", newRequest: true });
  const preview = await turn({text:"Thu học phí Nguyễn An 3 triệu tiền mặt ngày 18/11/2026"});
  expect(preview.status).toBe("confirmation");
  return preview;
}

it("replays a completed request without collecting the tuition twice", async () => {
  const preview = await paymentPreview();
  const request = {requestId:randomUUID(),decision:{id:preview.action!.id,confirmed:true}};
  const first = await turn(request);
  expect(first.status).toBe("completed");
  expect(await turn(request)).toEqual(first);
  const repeatedConfirmation = await turn({decision:request.decision});
  expect(repeatedConfirmation.status).toBe("failed");
  expect(payments).toHaveLength(1);
});

it("allows only one simultaneous confirmation to reach the payment API", async () => {
  const preview=await paymentPreview();
  const ordinaryFetch=fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  let release!:()=>void, started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const entered=new Promise<void>(resolve=>{started=resolve;});
  fetcher.mockImplementation(async(url,init)=>{
    if(new URL(String(url)).pathname==="/api/v1/payments" && init?.method==="POST") {started();await gate;}
    return ordinaryFetch(url,init);
  });
  const decision={id:preview.action!.id,confirmed:true};
  const first=turn({decision});
  await entered;
  try {expect((await turn({decision})).status).toBe("failed");} finally {release();}
  expect((await first).status).toBe("completed");
  expect(payments).toHaveLength(1);
});

it("rejects reuse of a request ID with different content", async () => {
  const preview=await paymentPreview();
  const requestId=randomUUID();
  await turn({requestId,decision:{id:preview.action!.id,confirmed:true}});
  await expect(turn({requestId,text:"Thu thêm 3 triệu"})).rejects.toThrow("Mã yêu cầu đã được dùng cho nội dung khác");
  expect(payments).toHaveLength(1);
});

it("does not report success when HTTP 200 contains a business rejection", async () => {
  const preview=await paymentPreview();
  const ordinaryFetch=fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async(url,init)=>new URL(String(url)).pathname==="/api/v1/payments" && init?.method==="POST"
    ? json({success:false,message:"Số tiền vượt học phí còn nợ."}):ordinaryFetch(url,init));
  const result=await confirm(preview);
  expect(result.status).toBe("failed");
  expect(result.reply).toContain("Số tiền vượt học phí còn nợ");
  expect(payments).toHaveLength(0);
});

it("keeps the selected learner when a new record takes the old display name", async () => {
  students=[{_id:studentId,fullName:"Nguyễn An",email:"old@example.com",__v:1}];
  state.interpret.mockResolvedValueOnce({actionId:"student.update",values:{path_id:"Nguyễn An",email:"requested@example.com"},intentType:"workflow",newRequest:true});
  const preview=await turn({text:"Đổi email Nguyễn An thành requested@example.com"});
  expect(preview.status).toBe("confirmation");
  // Emulate a name import outside the assistant, without changing the ID.
  students[0].fullName="Nguyễn An đã đổi tên";
  students.push({_id:secondStudentId,fullName:"Nguyễn An",email:"other@example.com",__v:1});
  const result=await confirm(preview);
  expect(result.status).toBe("completed");
  expect(students[0].email).toBe("requested@example.com");
  expect(students[1].email).toBe("other@example.com");
});

it("does not replay a write whose response was lost after the API saved it", async () => {
  const preview = await paymentPreview();
  const ordinaryFetch = fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async (url, init) => {
    if (new URL(String(url)).pathname === "/api/v1/payments" && init?.method === "POST") {
      payments.push({_id:paymentId,...JSON.parse(String(init.body))});
      throw new TypeError("connection reset after commit");
    }
    return ordinaryFetch(url,init);
  });
  const request={requestId:randomUUID(),decision:{id:preview.action!.id,confirmed:true}};
  const result=await turn(request);
  expect(result.status).toBe("uncertain");
  expect(result.reply).toContain("Hướng dẫn dự phòng");
  expect(result.reply).toContain("không thực hiện lại");
  expect(result.reply).not.toContain("Chọn Thu học phí");
  expect(result.link).toBe("/quan-ly-hoc-vien?sub=hoc-phi");
  expect((await turn(request)).status).toBe("uncertain");
  expect((await turn({decision:request.decision})).status).toBe("failed");
  expect(payments).toHaveLength(1);
});

it("does not overwrite a learner changed after the confirmation preview", async () => {
  students=[{_id:studentId,fullName:"Nguyễn An",email:"old@example.com",__v:1}];
  state.interpret.mockResolvedValueOnce({actionId:"student.update",values:{path_id:"Nguyễn An",email:"requested@example.com"},intentType:"workflow",newRequest:true});
  const preview=await turn({text:"Đổi email học viên Nguyễn An thành requested@example.com"});
  expect(preview.status).toBe("confirmation");
  Object.assign(students[0],{email:"concurrent@example.com",__v:2});
  const result=await confirm(preview);
  expect(result.status).toBe("failed");
  expect(result.reply).toContain("Phiên bản đã thay đổi");
  expect(students[0].email).toBe("concurrent@example.com");
});

it("rechecks permission before writing an already confirmed tuition preview", async () => {
  const preview=await paymentPreview();
  state.assertOperation.mockImplementation(async (_req,id) => {if(id==="student.payment.create")throw new AssistantError("Không có quyền ghi học phí",403);return operationById(id);});
  const result=await confirm(preview);
  expect(result.status).not.toBe("completed");
  expect(payments).toHaveLength(0);
});

it("invalidates the old preview when the user corrects the payment amount", async () => {
  const old=await paymentPreview();
  state.interpret.mockResolvedValueOnce({actionId:"student.payment.create",values:{amount:2000000},intentType:"workflow",newRequest:false});
  const corrected=await turn({text:"Không, chỉ thu 2 triệu thôi"});
  expect(corrected.status).toBe("confirmation");
  expect(corrected.action!.id).not.toBe(old.action!.id);
  expect((await confirm(old)).status).toBe("failed");
  expect(payments).toHaveLength(0);
  expect((await confirm(corrected)).status).toBe("completed");
  expect(payments).toHaveLength(1);
  expect(payments[0].amount).toBe(2000000);
});

it("does not execute a cancelled preview when its old confirm button is used", async () => {
  const preview=await paymentPreview();
  expect((await turn({decision:{id:preview.action!.id,confirmed:false}})).status).toBe("cancelled");
  expect((await confirm(preview)).status).toBe("failed");
  expect(payments).toHaveLength(0);
});

it("refuses an update after the selected learner is deleted", async () => {
  students=[{_id:studentId,fullName:"Nguyễn An",email:"old@example.com",__v:1}];
  state.interpret.mockResolvedValueOnce({actionId:"student.update",values:{path_id:"Nguyễn An",email:"new@example.com"},intentType:"workflow",newRequest:true});
  const preview=await turn({text:"Đổi email Nguyễn An"});
  expect(preview.status).toBe("confirmation");
  students=[];
  const result=await confirm(preview);
  expect(result.status).toBe("failed");
  expect(fetcher.mock.calls.filter(([,init])=>init?.method==="PATCH")).toHaveLength(0);
});

it.each([0,-1,1.5])("does not send an invalid tuition amount to the API: %s", async amount => {
  students=[{_id:studentId,fullName:"Nguyễn An",fee:"10000000",paidAmount:0,__v:0}];
  state.interpret.mockResolvedValueOnce({actionId:"student.payment.create",values:{studentId:"Nguyễn An",amount,date:"2026-11-18",method:"Tiền mặt"},intentType:"workflow",newRequest:true});
  const reply=await turn({text:`Thu học phí ${amount} đồng cho Nguyễn An`});
  expect(reply.status).toBe("collecting");
  expect(fetcher.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(0);
  expect(payments).toHaveLength(0);
});

it("does not accept an injected record ID outside the offered learner choices", async () => {
  students=[{_id:studentId,fullName:"Nguyễn An",__v:1},{_id:secondStudentId,fullName:"Nguyễn Anh",__v:1}];
  state.interpret.mockResolvedValueOnce({actionId:"student.update",values:{path_id:"Nguyễn",email:"new@example.com"},intentType:"workflow",newRequest:true});
  const choice=await turn({text:"Đổi email học viên Nguyễn"});
  expect(choice.status).toBe("collecting");
  const result=await turn({referenceSelections:{path_id:["64b000000000000000000099"]}});
  expect(result.status).not.toBe("confirmation");
  expect(result.status).not.toBe("completed");
  expect(fetcher.mock.calls.filter(([,init])=>init?.method==="PATCH")).toHaveLength(0);
});

it.each(["html", "empty", "server-error"])("keeps an ambiguous API response uncertain and never replays the payment: %s", async kind => {
  const preview=await paymentPreview();
  const ordinaryFetch=fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  fetcher.mockImplementation(async(url,init)=>{
    if(new URL(String(url)).pathname==="/api/v1/payments" && init?.method==="POST") {
      payments.push({_id:paymentId,...JSON.parse(String(init.body))});
      return kind==="html" ? new Response("<html>Proxy error</html>",{status:200})
        : kind==="empty" ? new Response(null,{status:204})
        : new Response(JSON.stringify({success:false,message:"Internal error after commit"}),{status:500});
    }
    return ordinaryFetch(url,init);
  });
  const request={requestId:randomUUID(),decision:{id:preview.action!.id,confirmed:true}};
  expect((await turn(request)).status).toBe("uncertain");
  expect((await turn(request)).status).toBe("uncertain");
  expect(payments).toHaveLength(1);
});

it("does not retry a rate-limited write automatically", async () => {
  const preview=await paymentPreview();
  const ordinaryFetch=fetcher.getMockImplementation() as (url: URL, init?: RequestInit) => Promise<Response>;
  let attempts=0;
  fetcher.mockImplementation(async(url,init)=>{
    if(new URL(String(url)).pathname==="/api/v1/payments" && init?.method==="POST") {
      attempts++;
      return new Response(JSON.stringify({success:false,message:"Quá nhiều yêu cầu, vui lòng chờ."}),{status:429});
    }
    return ordinaryFetch(url,init);
  });
  const request={requestId:randomUUID(),decision:{id:preview.action!.id,confirmed:true}};
  const result=await turn(request);
  expect(result.status).toBe("failed");
  expect(result.reply).toContain("Quá nhiều yêu cầu");
  expect((await turn(request)).status).toBe("failed");
  expect(attempts).toBe(1);
  expect(payments).toHaveLength(0);
});

it("shows the matching tuition transaction before updating it", async () => {
  payments = [{ _id: paymentId, __v: 0, studentName: "Nguyễn An", amount: 2500000, method: "Tiền mặt", date: "2026-10-10", note: "Học phí tháng 10" }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.payment.update", values: { method: "Chuyển khoản", date: "2026-11-14", note: "Đã đối soát" }, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Sửa giao dịch học phí của Nguyễn An sang chuyển khoản, ngày 14/11/2026, ghi chú đã đối soát" });

  expect(selection.status).toBe("collecting");
  const transactionSelection = selection.referenceSelections?.find(group => group.key === "path_id");
  expect(transactionSelection?.options).toHaveLength(1);
  expect(transactionSelection?.options[0].label).toContain("Nguyễn An");
  const preview = await turn({ referenceSelections: { path_id: [transactionSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Sửa thông tin giao dịch học phí");
  expect(preview.action?.values.some(value => value.label === "Ngày thu (DD/MM/YYYY hoặc YYYY-MM-DD)" && value.value === "14/11/2026")).toBe(true);
  expect(JSON.stringify(preview)).not.toContain(paymentId);
});

it("asks for an exam first, then lets the user choose eligible learners", async () => {
  exams = [{ _id: examId, name: "Kiểm tra đầu vào", code: "KT-01", status: "Đang mở" }];
  eligibleExamStudents = [
    { _id: studentId, name: "Nguyễn An", phone: "0900000000" },
    { _id: secondStudentId, name: "Trần Bình", phone: "0910000000" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "student.exam.assign", values: {}, intentType: "workflow", newRequest: true });

  const examPrompt = await turn({ text: "Gán học viên đủ điều kiện vào kỳ kiểm tra đầu vào" });
  expect(examPrompt.status).toBe("collecting");
  const examSelection = examPrompt.referenceSelections?.find(group => group.key === "path_id");
  expect(examSelection?.options.map(option => option.label).join(" ")).toContain("Kiểm tra đầu vào");

  const learnerPrompt = await turn({ referenceSelections: { path_id: [examSelection!.options[0].value] } });
  expect(learnerPrompt.status).toBe("collecting");
  const learnerSelection = learnerPrompt.referenceSelections?.find(group => group.key === "studentIds");
  expect(learnerSelection?.multiple).toBe(true);
  expect(learnerSelection?.options.map(option => option.label).join(" ")).toContain("Nguyễn An");
  expect(learnerSelection?.options.map(option => option.label).join(" ")).toContain("Trần Bình");

  const preview = await turn({ referenceSelections: { studentIds: learnerSelection!.options.map(option => option.value) } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Gán học viên đủ điều kiện vào kỳ thi");
  expect(JSON.stringify(preview)).toContain("Nguyễn An");
  expect(JSON.stringify(preview)).toContain("Trần Bình");
  expect(JSON.stringify(preview)).not.toContain(examId);
  expect(JSON.stringify(preview)).not.toContain(studentId);
  expect(JSON.stringify(preview)).not.toContain(secondStudentId);
});

it("shows a resource picker before confirming a room booking", async () => {
  resources = [{ _id: resourceId, name: "Phòng học P101", type: "Phòng học", identifier: "P101", status: "Hoạt động" }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.booking.create", values: {
    purpose: "Học bù lớp A1", by: "Nguyễn An", date: "2026-11-20", startTime: "09:00", endTime: "10:00",
  }, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Đặt phòng P101 cho Nguyễn An học bù lớp A1 ngày 20/11/2026 từ 09:00 đến 10:00" });

  expect(selection.status).toBe("collecting");
  const resourceSelection = selection.referenceSelections?.find(group => group.key === "path_id");
  expect(resourceSelection?.options[0].label).toContain("Phòng học P101");
  const preview = await turn({ referenceSelections: { path_id: [resourceSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Đặt lịch phòng học hoặc thiết bị");
  expect(JSON.stringify(preview)).toContain("Phòng học P101");
  expect(JSON.stringify(preview)).not.toContain(resourceId);
});

it("lists equipment without classroom records when requested as equipment", async () => {
  resources = [
    { _id: resourceId, name: "Phòng học P101", type: "Phòng học", identifier: "P101", status: "Hoạt động" },
    { _id: "64b000000000000000000010", name: "Máy chiếu Epson", type: "Máy chiếu", identifier: "MC01", status: "Sẵn sàng" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.list", values: { query_excludeType: "Phòng học" }, intentType: "workflow", newRequest: true });

  const result = await turn({ text: "Danh sách thiết bị" });

  expect(result.status).toBe("completed");
  expect(result.reply).toContain("Máy chiếu Epson");
  expect(result.reply).not.toContain("Phòng học P101");
  const listCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/student-resources" && init?.method !== "POST");
  expect(new URL(String(listCall?.[0])).searchParams.get("excludeType")).toBe("Phòng học");
});

it("uses the classroom type set by the classroom form without asking for a resource category", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.create", values: {
    name: "Phòng học P101", identifier: "P101", capacity: "20", type: "Thiết bị",
  }, intentType: "workflow", newRequest: true });

  const preview = await turn({ text: "Tạo phòng học P101 sức chứa 20" });

  expect(preview.status).toBe("confirmation");
  expect(preview.reply).not.toContain("Loại tài nguyên");
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === "/api/v1/student-resources/categories")).toBe(false);

  const created = await confirm(preview);

  expect(created.status).toBe("completed");
  expect(resources).toHaveLength(1);
  expect(resources[0]).toMatchObject({ name: "Phòng học P101", identifier: "P101", capacity: "20", type: "Phòng học" });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/student-resources" && init?.method === "POST")).toHaveLength(1);
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === "/api/v1/student-resources/categories")).toBe(false);
});

it("keeps a general resource category selectable", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.create", values: {
    name: "Máy chiếu Epson", identifier: "MC01", capacity: "1", type: "Thiết bị",
  }, intentType: "workflow", newRequest: true });

  const preview = await turn({ text: "Tạo tài nguyên máy chiếu Epson mã MC01" });

  expect(preview.status).toBe("confirmation");
  const categoryCalls = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/student-resources/categories");
  expect(categoryCalls.length).toBeGreaterThan(0);

  const created = await confirm(preview);

  expect(created.status).toBe("completed");
  expect(resources).toHaveLength(1);
  expect(resources[0]).toMatchObject({ name: "Máy chiếu Epson", identifier: "MC01", capacity: "1", type: "Thiết bị" });
});

it("defaults direct equipment creation and accepts details in the next message", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.create", values: {}, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Thêm thiết bị cho học viên" });

  expect(selection.status).toBe("collecting");
  expect(selection.reply).not.toContain("Loại tài nguyên");
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === "/api/v1/student-resources/categories")).toBe(false);

  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.create", values: {
    name: "Máy chiếu 001", identifier: "MAYCHIEU001", capacity: "3",
  }, intentType: "workflow", newRequest: false });

  const preview = await turn({ text: "máy chiếu 001, MAYCHIEU001, 3" });

  expect(preview.status).toBe("confirmation");
  expect(preview.reply).not.toContain("Loại tài nguyên");
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === "/api/v1/student-resources/categories")).toBe(false);

  const created = await confirm(preview);

  expect(created.status).toBe("completed");
  expect(resources).toHaveLength(1);
  expect(resources[0]).toMatchObject({ name: "Máy chiếu 001", identifier: "MAYCHIEU001", capacity: "3", type: "Thiết bị" });
});

it("still asks for a category when creating a general resource", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.resource.create", values: {
    name: "Máy chiếu phòng học", identifier: "MC01", capacity: "1",
  }, intentType: "workflow", newRequest: true });

  const result = await turn({ text: "Tạo tài nguyên máy chiếu phòng học mã MC01" });

  expect(result.status).toBe("collecting");
  expect(result.referenceSelections?.find(selection => selection.key === "type")?.options.map(option => option.label)).toContain("Thiết bị");
  expect(resources).toHaveLength(0);
});

it("lets the user choose multiple notification channels in chat", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.notification.create", values: {
    title: "Lịch nghỉ lễ", content: "Trung tâm nghỉ ngày 20/11", recipients: "Học viên lớp A1", recipientCount: 12,
  }, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Tạo thông báo lịch nghỉ lễ cho 12 học viên lớp A1 qua email và SMS" });

  expect(selection.status).toBe("collecting");
  const channels = selection.referenceSelections?.find(group => group.key === "channels");
  expect(channels?.multiple).toBe(true);
  expect(channels?.required).toBe(true);
  expect(channels?.options.map(option => option.label)).toEqual(["Email", "SMS", "Zalo OA"]);

  const preview = await turn({ referenceSelections: { channels: [channels!.options[0].value, channels!.options[1].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Tạo bản ghi thông báo học viên");
  expect(JSON.stringify(preview)).toContain("Email");
  expect(JSON.stringify(preview)).toContain("SMS");
});

it("offers course choices inside each learning-roadmap step", async () => {
  const nextRoadmapCourseId = "64b000000000000000000009";
  courses = [
    { _id: roadmapCourseId, title: "Tiếng Anh căn bản", code: "TA01", status: "Hoạt động" },
    { _id: nextRoadmapCourseId, title: "Tiếng Anh nâng cao", code: "TA02", status: "Hoạt động" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "student.learning-roadmap.create", values: {
    code: "LOTRINH-A1", name: "Lộ trình tiếng Anh A1",
    steps: JSON.stringify([
      { id: "A1", order: 1, minClassSize: 0, maxClassSize: 12 },
      { id: "A2", order: 2, minClassSize: 0, maxClassSize: 12 },
    ]),
  }, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Tạo lộ trình tiếng Anh A1 gồm hai chặng A1 và A2, sĩ số tối đa 12" });

  expect(selection.status).toBe("collecting");
  const firstCourseSelection = selection.referenceSelections?.find(group => group.key === "steps[1].courseId");
  const secondCourseSelection = selection.referenceSelections?.find(group => group.key === "steps[2].courseId");
  expect(firstCourseSelection?.required).toBe(true);
  expect(secondCourseSelection?.required).toBe(true);
  expect(firstCourseSelection?.options.some(option => option.label.includes("Tiếng Anh căn bản"))).toBe(true);
  expect(secondCourseSelection?.options.some(option => option.label.includes("Tiếng Anh nâng cao"))).toBe(true);

  const preview = await turn({ referenceSelections: {
    "steps[1].courseId": [firstCourseSelection!.options.find(option => option.label.includes("Tiếng Anh căn bản"))!.value],
    "steps[2].courseId": [secondCourseSelection!.options.find(option => option.label.includes("Tiếng Anh nâng cao"))!.value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Tạo lộ trình học");
  expect(JSON.stringify(preview)).toContain("Tiếng Anh căn bản");
  expect(JSON.stringify(preview)).toContain("Tiếng Anh nâng cao");
  expect(JSON.stringify(preview)).not.toContain(roadmapCourseId);
  expect(JSON.stringify(preview)).not.toContain(nextRoadmapCourseId);
});

it("asks for the number of roadmap stages, then offers a course choice for each stage", async () => {
  const nextRoadmapCourseId = "64b000000000000000000009";
  courses = [
    { _id: roadmapCourseId, title: "Tiếng Anh căn bản", code: "TA01", status: "Hoạt động" },
    { _id: nextRoadmapCourseId, title: "Tiếng Anh nâng cao", code: "TA02", status: "Hoạt động" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "student.learning-roadmap.create", values: {}, intentType: "workflow", newRequest: true });
  const firstPrompt = await turn({ text: "Tạo lộ trình học viên" });

  expect(firstPrompt.status).toBe("collecting");
  expect(firstPrompt.referenceSelections?.find(group => group.key === "roadmapStepCount")?.options).toHaveLength(30);

  state.interpret.mockResolvedValueOnce({ actionId: "student.learning-roadmap.create", values: {
    code: "KIEMTIEN", name: "Lộ trình kiếm tiền từ a đến z",
  }, intentType: "workflow", newRequest: false });
  const namedPrompt = await turn({ text: "KIEMTIEN, lộ trình kiếm tiền từ a đến z" });
  expect(namedPrompt.status).toBe("collecting");
  expect(namedPrompt.referenceSelections?.some(group => group.key === "roadmapStepCount")).toBe(true);

  const countSelection = await turn({ referenceSelections: { roadmapStepCount: ["2"] } });
  const firstStage = countSelection.referenceSelections?.find(group => group.key === "steps[1].courseId");
  const secondStage = countSelection.referenceSelections?.find(group => group.key === "steps[2].courseId");
  expect(countSelection.status).toBe("collecting");
  expect(firstStage?.label).toContain("Chặng 1");
  expect(secondStage?.label).toContain("Chặng 2");
  expect(firstStage?.options.some(option => option.label.includes("Tiếng Anh căn bản"))).toBe(true);
  expect(secondStage?.options.some(option => option.label.includes("Tiếng Anh nâng cao"))).toBe(true);

  const preview = await turn({ referenceSelections: {
    "steps[1].courseId": [firstStage!.options.find(option => option.label.includes("Tiếng Anh căn bản"))!.value],
    "steps[2].courseId": [secondStage!.options.find(option => option.label.includes("Tiếng Anh nâng cao"))!.value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("Tiếng Anh căn bản");
  expect(JSON.stringify(preview)).toContain("Tiếng Anh nâng cao");
  const stagePreview = String(preview.action?.values.find(value => value.label === "Các chặng và khóa học được chọn theo tên")?.value);
  expect(stagePreview).toContain("Chặng 1: Tiếng Anh căn bản");
  expect(stagePreview).toContain("Chặng 2: Tiếng Anh nâng cao");
  expect(stagePreview).not.toContain('"courseId"');
  expect(stagePreview).not.toContain('"order"');

  const storedStages = state.session.lastReply.action.values.find((value: any) => value.label === "Các chặng và khóa học được chọn theo tên");
  storedStages.value = JSON.stringify([
    { id: "step-1", order: 1, courseId: "Tiếng Anh căn bản" },
    { id: "step-2", order: 2, courseId: "Tiếng Anh nâng cao" },
  ]);
  const restored = await conversationState(req, "student-conversation");
  const restoredStages = String(restored.lastReply?.action?.values.find(value => value.label === "Các chặng và khóa học được chọn theo tên")?.value);
  expect(restoredStages).toContain("Chặng 1: Tiếng Anh căn bản");
  expect(restoredStages).toContain("Chặng 2: Tiếng Anh nâng cao");
  expect(restoredStages).not.toContain('"courseId"');

  const created = await confirm(preview);
  const createCall = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === "/api/v1/learning-roadmaps" && init?.method === "POST");
  expect(created.status).toBe("completed");
  expect(JSON.parse(String(createCall?.[1]?.body)).steps).toEqual([
    { id: "step-1", courseId: roadmapCourseId, order: 1 },
    { id: "step-2", courseId: nextRoadmapCourseId, order: 2 },
  ]);
});
