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
      updateOne: vi.fn(async (_filter, update) => { state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 }; apply(state.session, update); }),
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => { const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" }; state.turns.push(turn); return turn; }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId
        ? turn.requestId === filter.requestId : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "healthcare").map(defaultWorkflow)),
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

const branchId = "507f1f77bcf86cd799439012";
const patientId = "b9e8f6dc-70c8-4b29-8f89-423405600031";
const secondPatientId = "b9e8f6dc-70c8-4b29-8f89-423405600032";
const appointmentId = "b9e8f6dc-70c8-4b29-8f89-423405600033";
const staffId = "507f1f77bcf86cd799439013";
const careId = "b9e8f6dc-70c8-4b29-8f89-423405600034";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId, role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "healthcare-conversation", requestId: randomUUID(), ...input });
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let patients: any[];
let appointments: any[];
let fetcher: ReturnType<typeof vi.fn>;
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");

beforeEach(() => {
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset(); patients = []; appointments = [];
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const requestUrl = new URL(String(url)); const path = requestUrl.pathname; const method = init?.method || "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (path === "/api/v1/healthcare/patients/search" && method === "POST") {
      const q = normalize(body.q); const items = patients.filter(patient => !q || [patient.name, patient.code, patient.phone].some(value => normalize(value).includes(q)));
      return json({ items, total: items.length, page: body.page || 1, pageSize: body.pageSize || 25 });
    }
    const patientDetail = path.match(/^\/api\/v1\/healthcare\/patients\/([^/]+)$/);
    if (patientDetail && method === "GET") {
      const patient = patients.find(row => row._id === patientDetail[1]);
      return patient ? json(patient) : new Response(JSON.stringify({ message: "Không tìm thấy bệnh nhân" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (path === "/api/v1/healthcare/patients" && method === "POST") {
      const patient = { _id: patientId, revision: 1, code: "BN-031", phone: "", dateOfBirth: "", address: "", note: "", ...body };
      patients.push(patient); return json(patient);
    }
    if (patientDetail && method === "PATCH") {
      const patient = patients.find(row => row._id === patientDetail[1]); Object.assign(patient, body, { revision: patient.revision + 1 }); return json(patient);
    }
    if (path === "/api/v1/healthcare/catalog" && method === "GET") return json([]);
    if (path === "/api/v1/healthcare/staff" && method === "GET") return json([{ _id: staffId, name: "Điều dưỡng An" }]);
    if (path === "/api/v1/healthcare/appointments" && method === "POST") {
      const appointment = { _id: appointmentId, revision: 1, status: "scheduled", ...body };
      appointments.push(appointment); return json(appointment);
    }
    if (path === "/api/v1/healthcare/appointments/search" && method === "POST") {
      const items = appointments.filter(row => !body.id || row._id === body.id);
      return json({ items, total: items.length, page: body.page || 1, pageSize: body.pageSize || 25,
        patientReferences: patients.filter(patient => items.some(row => row.patientId === patient._id)).map(({ _id, code, name, phone }) => ({ _id, code, name, phone })) });
    }
    if (path === "/api/v1/healthcare/care" && method === "POST") {
      const care = { _id: careId, revision: 1, status: "open", ...body };
      return json(care);
    }
    if (path === "/api/v1/healthcare/patients/bulk-delete-preview" && method === "POST") return json({ items: body.ids.map((id: string) => {
      const patient = patients.find(row => row._id === id);
      return { _id: id, code: patient?.code, name: patient?.name, phone: patient?.phone, visits: 2, appointments: 1, care: 3 };
    }) });
    if (path === "/api/v1/healthcare/patients/bulk-delete" && method === "POST") {
      const count = body.ids.length; patients = patients.filter(patient => !body.ids.includes(patient._id));
      return json({ deletedCount: count, deletedVisits: count * 2, deletedAppointments: count, deletedCare: count * 3 });
    }
    if (path === "/api/v1/healthcare/imports/preview/visits" && method === "POST") return json({ status: "queued", filename: "luot-kham.xlsx" });
    throw new Error(`Unexpected API: ${method} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

it("understands a patient profile question by name and renders a readable table", async () => {
  patients = [
    { _id: patientId, revision: 1, code: "BN-031", name: "La Văn Sến", phone: "0987217127", dateOfBirth: "1990-02-03", address: "Cần Thơ", note: "" },
    { _id: secondPatientId, revision: 1, code: "BN-032", name: "La Văn Sơn", phone: "0987217000", dateOfBirth: "1991-02-03", address: "Vĩnh Long", note: "" },
  ];
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));

  const result = await turn({ text: "Thông tin bệnh nhân La Văn Sến" });

  expect(result.status).toBe("completed");
  const rows = parseAssistantResultTable(result.reply)?.rows;
  expect(rows).toHaveLength(1);
  expect(rows?.[0].values).toMatchObject({ "Họ tên bệnh nhân": "La Văn Sến", "Mã bệnh nhân": "BN-031", "Số điện thoại": "0987217127", "Ngày sinh": "03/02/1990" });
  expect(JSON.stringify(rows)).not.toContain("La Văn Sơn");
  expect(result.reply).not.toContain(patientId);
  expect(result.reply).not.toContain("không được hỗ trợ");
  expect(state.provider).not.toHaveBeenCalled();
});

it("shows patient choices in chat before creating an appointment and confirms the selected person", async () => {
  patients = [
    { _id: patientId, revision: 1, code: "BN-031", name: "La Văn Sến", phone: "0987217127", dateOfBirth: "", address: "", note: "" },
    { _id: secondPatientId, revision: 1, code: "BN-032", name: "La Văn Sơn", phone: "0987217000", dateOfBirth: "", address: "", note: "" },
  ];
  state.interpret.mockResolvedValueOnce({ actionId: "healthcare.appointment.create", values: {
    startsAt: "2026-11-15T09:00:00+07:00", endsAt: "2026-11-15T10:00:00+07:00", note: "Tái khám",
  }, intentType: "workflow", newRequest: true });

  const choosing = await turn({ text: "Đặt lịch tái khám ngày mai từ 9 giờ đến 10 giờ" });
  const patientChoices = choosing.referenceSelections?.find(group => group.key === "patientId");
  expect(choosing.status).toBe("collecting");
  expect(patientChoices?.options.map(option => option.label)).toEqual(expect.arrayContaining(["La Văn Sến · BN-031 · 0987217127", "La Văn Sơn · BN-032 · 0987217000"]));
  expect(choosing.reply).not.toContain(patientId);
  expect(appointments).toHaveLength(0);

  const preview = await turn({ referenceSelections: { patientId: [patientChoices!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("La Văn Sến");
  expect(JSON.stringify(preview)).not.toContain(patientId);
  expect(appointments).toHaveLength(0);

  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(appointments).toHaveLength(1);
  expect(appointments[0]).toMatchObject({ patientId, startsAt: "2026-11-15T09:00:00+07:00", endsAt: "2026-11-15T10:00:00+07:00", note: "Tái khám" });
  expect(parseAssistantResultTable(created.reply)?.rows[0].values).toMatchObject({ "Bệnh nhân": "La Văn Sến", "Bắt đầu": "09:00, 15/11/2026", "Ghi chú": "Tái khám" });
  expect(created.reply).not.toContain(patientId);
});

it("creates a patient, asks about optional information, and supplements the same record", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "healthcare.patient.create", values: { name: "La Văn Sến" }, intentType: "workflow" });
  const preview = await turn({ text: "Thêm bệnh nhân tên La Văn Sến" });
  expect(preview.status).toBe("confirmation");
  expect(patients).toHaveLength(0);

  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(created.reply).toContain("Bạn có muốn bổ sung không?");
  expect(patients).toHaveLength(1);
  expect(parseAssistantResultTable(created.reply)?.rows[0].values).toMatchObject({ "Họ tên bệnh nhân": "La Văn Sến", "Mã bệnh nhân": "BN-031" });

  const agreed = await turn({ text: "Có" });
  expect(agreed.status, JSON.stringify({ agreed, state: state.session })).toBe("collecting");
  state.interpret.mockResolvedValueOnce({ actionId: "healthcare.patient.update", values: { phone: "0987217127" }, intentType: "workflow", newRequest: false });
  const updatePreview = await turn({ text: "Bổ sung thông tin bệnh nhân vừa tạo, số điện thoại 0987217127" });
  expect(updatePreview.status, JSON.stringify(updatePreview)).toBe("confirmation");
  expect(JSON.stringify(updatePreview)).not.toContain(patientId);

  const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
  expect(updated.status).toBe("completed");
  expect(patients).toHaveLength(1);
  expect(patients[0]).toMatchObject({ _id: patientId, name: "La Văn Sến", phone: "0987217127", revision: 2 });
  expect(parseAssistantResultTable(updated.reply)?.rows[0].values).toMatchObject({ "Họ tên bệnh nhân": "La Văn Sến", "Số điện thoại": "0987217127" });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/healthcare/patients" && init?.method === "POST")).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/healthcare/patients/${patientId}` && init?.method === "PATCH")).toHaveLength(1);
});

it("lets a user choose both a patient and care staff before creating a care task", async () => {
  patients = [{ _id: patientId, revision: 1, code: "BN-031", name: "La Văn Sến", phone: "0987217127", dateOfBirth: "", address: "", note: "" }];
  state.interpret.mockResolvedValueOnce({ actionId: "healthcare.care.create", values: { title: "Gọi hỏi thăm", dueOn: "2026-11-16" }, intentType: "workflow", newRequest: true });

  const choosing = await turn({ text: "Tạo việc chăm sóc bệnh nhân, gọi hỏi thăm vào ngày mai" });
  const patientChoices = choosing.referenceSelections?.find(group => group.key === "patientId");
  const staffChoices = choosing.referenceSelections?.find(group => group.key === "assigneeId");
  expect(choosing.status).toBe("collecting");
  expect(patientChoices?.options.map(option => option.label)).toContain("La Văn Sến · BN-031 · 0987217127");
  expect(staffChoices?.options.map(option => option.label)).toContain("Điều dưỡng An");

  const preview = await turn({ referenceSelections: {
    patientId: [patientChoices!.options[0].value], assigneeId: [staffChoices!.options[0].value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("La Văn Sến");
  expect(JSON.stringify(preview)).toContain("Điều dưỡng An");
  expect(JSON.stringify(preview)).not.toContain(patientId);
  expect(JSON.stringify(preview)).not.toContain(staffId);
  expect(fetcher.mock.calls.every(([url, init]) => !(new URL(String(url)).pathname === "/api/v1/healthcare/care" && init?.method === "POST"))).toBe(true);

  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(parseAssistantResultTable(created.reply)?.rows[0].values).toMatchObject({ "Bệnh nhân": "La Văn Sến", "Nội dung chăm sóc": "Gọi hỏi thăm", "Người phụ trách": "Điều dưỡng An" });
  expect(created.reply).not.toContain(staffId);
});

it("previews related data and asks for confirmation before deleting a patient", async () => {
  patients = [{ _id: patientId, revision: 1, code: "BN-031", name: "La Văn Sến", phone: "0987217127", dateOfBirth: "", address: "", note: "" }];
  state.interpret.mockResolvedValueOnce({ actionId: "healthcare.patient.bulk-delete", values: { patientIds: JSON.stringify(["La Văn Sến"]) }, intentType: "workflow", newRequest: true });

  const preview = await turn({ text: "Xóa hồ sơ bệnh nhân La Văn Sến" });
  expect(preview.status).toBe("confirmation");
  expect(JSON.stringify(preview)).toContain("2 lượt khám");
  expect(JSON.stringify(preview)).toContain("1 lịch hẹn");
  expect(JSON.stringify(preview)).toContain("3 việc chăm sóc");
  expect(JSON.stringify(preview)).not.toContain(patientId);
  expect(patients).toHaveLength(1);

  const deleted = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(deleted.status).toBe("completed");
  expect(parseAssistantResultTable(deleted.reply)?.rows[0].values).toMatchObject({ "Bệnh nhân đã xóa": "1", "Lượt khám đã xóa": "2", "Lịch hẹn đã xóa": "1", "Việc chăm sóc đã xóa": "3" });
  expect(patients).toHaveLength(0);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/healthcare/patients/bulk-delete-preview" && init?.method === "POST")).toHaveLength(3);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/healthcare/patients/bulk-delete" && init?.method === "POST")).toHaveLength(1);
});

it("checks an attached Excel file for visits and asks before starting the import", async () => {
  const { interpretRequest } = await vi.importActual<typeof import("./interpreter")>("./interpreter");
  state.interpret.mockImplementationOnce((...args: Parameters<typeof interpretRequest>) => interpretRequest(...args));
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

  const preview = await turn({ text: "Tải lên tệp Excel lượt khám", attachment: {
    fileName: "luot-kham.xlsx", headers: ["Mã lượt", "Mã bệnh nhân"], rows: [{ code: "LK-01", patientCode: "BN-031" }],
  } });

  expect(preview.status).toBe("confirmation");
  expect(preview.action?.values).toContainEqual({ label: "Loại dữ liệu nhập", value: "Lượt khám", defaulted: false });
  expect(fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === "/api/v1/healthcare/imports/preview/visits")).toHaveLength(0);

  const queued = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(queued.status).toBe("completed");
  expect(queued.reply).toContain("Đã xếp hàng kiểm tra tệp luot-kham.xlsx");
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/healthcare/imports/preview/visits" && init?.method === "POST")).toHaveLength(1);
});
