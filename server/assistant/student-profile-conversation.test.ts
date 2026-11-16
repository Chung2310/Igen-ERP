import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), provider: vi.fn() }));
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
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => {
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
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "student").map(defaultWorkflow)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from "./service";
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

beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset(); students = []; courses = []; batches = []; payments = []; exams = []; eligibleExamStudents = []; resources = []; notifications = []; assignments = []; roadmaps = []; waitlistEntries = []; qualityRows = []; placedWaitlist = undefined;
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
    if (path === "/api/v1/payments" && method === "GET") { const rows = filterBySearch(payments, "studentName", "note"); return json({ success: true, payments: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/exams" && method === "GET") { const rows = filterBySearch(exams, "name", "rank"); return json({ success: true, exams: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    const eligibleExamMatch = path.match(/^\/api\/v1\/exams\/([^/]+)\/eligible-students$/);
    if (eligibleExamMatch && method === "GET") return json({ success: true, data: eligibleExamStudents });
    if (path === "/api/v1/student-resources" && method === "GET") { const rows = filterBySearch(resources, "name", "identifier"); return json({ success: true, resources: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/student-notifications" && method === "GET") { const rows = filterBySearch(notifications, "title", "content", "recipients"); return json({ success: true, notifications: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 }); }
    if (path === "/api/v1/learning-roadmaps" && method === "GET") return json({ success: true, data: filterBySearch(roadmaps, "name", "code", "description") });
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
    const studentDetailMatch = path.match(/^\/api\/v1\/students\/([^/]+)$/);
    if (studentDetailMatch && method === "GET") {
      const record = students.find(student => String(student._id || student.id) === studentDetailMatch[1]);
      return record ? json({ success: true, data: record }) : new Response(JSON.stringify({ success: false, error: "Không tìm thấy học viên" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (path === "/api/v1/students" && method === "POST") {
      const record = { _id: studentId, __v: 0, ...body, address: body.address || "" };
      students.push(record); return json({ success: true, data: record });
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

it("creates one student, asks about missing optional fields, supplements that record, and renders shared result tables", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "student.create", values: {
    fullName: "Nguyễn An", phone: "0900000000", email: "an@example.com", registrationDate: "14/11/2026",
  }, intentType: "workflow", newRequest: false });
  const preview = await turn({ text: "Thêm hồ sơ học viên Nguyễn An, số điện thoại 0900000000, email an@example.com, ngày đăng ký 14/11/2026" });
  expect(preview.status).toBe("confirmation");
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
  batches = [{ _id: batchId, code: "LOP-A1", name: "Lớp giao tiếp A1", courseTitle: "Tiếng Anh A1", status: "Đang học" }];
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
  expect(preview.action?.values.some(value => value.label === "Ngày thu (DD/MM/YYYY hoặc YYYY-MM-DD)" && value.value === "2026-11-14")).toBe(true);
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
  expect(preview.action?.title).toBe("Đặt lịch phòng học hoặc tài nguyên");
  expect(JSON.stringify(preview)).toContain("Phòng học P101");
  expect(JSON.stringify(preview)).not.toContain(resourceId);
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
  courses = [{ _id: roadmapCourseId, title: "Tiếng Anh căn bản", code: "TA01", status: "Hoạt động" }];
  state.interpret.mockResolvedValueOnce({ actionId: "student.learning-roadmap.create", values: {
    code: "LOTRINH-A1", name: "Lộ trình tiếng Anh A1",
    steps: JSON.stringify([{ id: "A1", order: 1, minClassSize: 0, maxClassSize: 12 }]),
  }, intentType: "workflow", newRequest: true });

  const selection = await turn({ text: "Tạo lộ trình tiếng Anh A1 gồm chặng A1, sĩ số tối đa 12" });

  expect(selection.status).toBe("collecting");
  const courseSelection = selection.referenceSelections?.find(group => group.key === "steps[1].courseId");
  expect(courseSelection?.required).toBe(true);
  expect(courseSelection?.options[0].label).toContain("Tiếng Anh căn bản");

  const preview = await turn({ referenceSelections: { "steps[1].courseId": [courseSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Tạo lộ trình học");
  expect(JSON.stringify(preview)).toContain("Tiếng Anh căn bản");
  expect(JSON.stringify(preview)).not.toContain(roadmapCourseId);
});
