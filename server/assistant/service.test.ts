import express from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ interpret: vi.fn(), shortlist: null as string[] | null, permissions: new Set(["*"]), modules: ["hr", "chat", "customer", "inventory"], actor: { id: "507f1f77bcf86cd799439011", email: "admin@example.test", role: "admin", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012" } }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: async (options: any) => {
  if (options.messages[0].content.startsWith("Tạo bản ghi nhớ ngắn để tiếp tục đúng cuộc trò chuyện ERP này")) return { text: JSON.stringify({ summary: "Ngữ cảnh của phiên cũ: đang xử lý phòng Kỹ thuật." }) };
  if (options.messages[1]?.content.includes('"sourceReply"') && options.messages[1]?.content.includes('"responseRules"')) {
    const payload = JSON.parse(options.messages[1].content);
    return { text: JSON.stringify({ reply: payload.responseRules.length < 100 ? "Mình đã ghi nhớ theo ý bạn." : payload.sourceReply }) };
  }
  if (options.messages[0].content.startsWith("Trích xuất ghi nhớ hữu ích")) return { text: JSON.stringify({ memories: ["Người dùng thích câu trả lời ngắn gọn và có các bước rõ ràng."] }) };
  if (options.messages[0].content.startsWith("Chọn tối đa 12 workflow")) {
    const index = JSON.parse(options.messages[0].content.split("DANH MỤC: ")[1]);
    if (mocks.shortlist) {
      const actionIds = mocks.shortlist.filter(id => index.some((entry: any) => entry.id === id));
      mocks.shortlist = null;
      return { text: JSON.stringify({ actionIds }) };
    }
    const preferred = ["employee.create", "employee.update", "employee.list", "department.create", "department.delete", "department.update", "department.list", "task.create", "customer.create", "product.list", "project.create", "category.create"];
    const partnerActions = index.filter((entry: any) => ["Cập nhật đối tác", "Cập nhật đối tác giới thiệu", "Cập nhật thông tin và cấu hình hoa hồng đối tác", "Tạo cấu hình hoa hồng", "Tạo cấp bậc hoa hồng đối tác"].includes(entry.title)).map((entry: any) => entry.id);
    const coreActions = preferred.filter(id => index.some((entry: any) => entry.id === id));
    const actionIds = partnerActions.length ? coreActions.slice(0, 12 - partnerActions.length) : coreActions;
    for (const partnerAction of partnerActions) if (!actionIds.includes(partnerAction)) actionIds.push(partnerAction);
    return { text: JSON.stringify({ actionIds }) };
  }
  return mocks.interpret(options);
} }));
vi.mock("../middleware/auth", async original => {
  const actual = await original<any>();
  return { ...actual, getEffectivePermissions: async () => mocks.permissions,
    requireAuth: (req: any, _res: any, next: any) => { req.user = { ...mocks.actor }; next(); },
    requirePermission: (permission: string | string[]) => (_req: any, res: any, next: any) => mocks.permissions.has("*") || [permission].flat().some(p => mocks.permissions.has(p)) ? next() : res.status(403).json({ message: "Không có quyền" }),
  };
});
vi.mock("../middleware/require-module", async original => ({ ...await original<any>(), getModuleStateForCompany: async () => ({ exists: true, modules: mocks.modules, businessType: "general" }), requireModule: () => (_req: any, _res: any, next: any) => next() }));
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { workerRoutes } from "../modules/worker-management/routes/worker.routes";
import { WorkerModel } from "../modules/worker-management/models/worker.model";
import { laborPartnerRoutes } from "../modules/worker-management/labor-partners/routes/labor-partner.routes";
import { LaborPartnerModel } from "../modules/worker-management/labor-partners/models/labor-partner.model";
import { LaborPartnerKpiModel } from "../modules/worker-management/labor-partners/models/partner-kpi.model";
import { assistantRouter } from "./router";
import { customWorkHoursFollowUpQuestion, inferCustomWorkHoursMode, inferTaskDeadline, inventoryReceiptFollowUpQuestion, missingCustomWorkHoursLabels, missingOptionalCreateFields, missingReferencePrompts, skippedReferenceTargets } from "./service";
import { authRouter } from "../router/auth.router";
import { hrDepartmentRouter } from "../router/hr-department.router";
import { leaveRouter } from "../router/leave.router";
import { AssistantDocumentModel, AssistantMemoryModel, AssistantSettingsModel, AssistantSessionModel, AssistantTurnModel, AssistantWorkflowModel } from "./models";
import { DOCUMENT_RULES_VERSION } from "./document-rules";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { HrDepartmentModel } from "../model/hr-department.model";
import { healthcareRouter } from "../modules/healthcare/router";
import { healthcareDb, records } from "../modules/healthcare/store";
import { processNextImport } from "../modules/healthcare/imports";
import { parseAssistantResultTable } from "../../src/components/common/assistant-message-format";

let mongo: MongoMemoryReplSet;

it("suggests only editable optional fields that remain empty after creation", () => {
  const create = ASSISTANT_OPERATIONS.find(operation => operation.id === "recruitment.job.create")!;
  const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "recruitment.job.update")!;
  const submitted = { code: "IT_IOT", title: "Tuyển dụng nhân sự IOT", department: "Phòng IT" };
  const result = { _id: "507f1f77bcf86cd799439099", ...submitted, headcount: 1, employmentType: "full_time", workplaceType: "onsite" };
  const missing = missingOptionalCreateFields(create, defaultWorkflow(create), submitted, result, update);

  expect(missing).toContain("Quyền lợi");
  expect(missing).toContain("Địa điểm");
  expect(missing).not.toContain("Phòng ban tuyển dụng");
  expect(missing).not.toContain("Mã");

  const applicantCreate = ASSISTANT_OPERATIONS.find(operation => operation.id === "recruitment.applicant.create")!;
  const applicantUpdate = ASSISTANT_OPERATIONS.find(operation => operation.id === "recruitment.applicant.update")!;
  const applicantMissing = missingOptionalCreateFields(applicantCreate, defaultWorkflow(applicantCreate),
    { jobId: "IT_IOT", fullName: "Nguyễn An" },
    { _id: "507f1f77bcf86cd799439098", jobId: "IT_IOT", fullName: "Nguyễn An" }, applicantUpdate);
  expect(applicantMissing).toContain("Kinh nghiệm");
  expect(applicantMissing).toContain("Trình độ học vấn");
  expect(applicantMissing).toContain("Kỹ năng");
  expect(applicantMissing).toContain("Lương mong muốn");
  expect(applicantMissing).toContain("Nguồn ứng viên");
  expect(applicantMissing).not.toContain("experience");
  expect(applicantMissing).not.toContain("education");
});
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let origin: string;
const reminderDeliveryId = "507f1f77bcf86cd799439901";
let reminderContent = { subject: "Nhắc thanh toán công nợ · SO-001", text: "Kính gửi Nguyễn An, đơn hàng SO-001 còn công nợ 1.000.000 ₫." };
let reminderRetryIds: string[] = [];
const skuContinuationProductId = "507f1f77bcf86cd799439902";
const skuContinuationVariantId = "507f1f77bcf86cd799439903";
let skuPriceWrites: Array<{ variantId: string; productId: string | null; body: Record<string, unknown> }> = [];
let workHoursWrites: Array<{ uid: string; body: Record<string, unknown> }> = [];
const send = async (path: string, body?: object, method = body ? "POST" : "GET") => {
  const res = await fetch(`${origin}/api/v1/chatbot/assistant${path}`, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer test" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json() as any };
};
const answer = (actionId: string | null, values: object = {}) => mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId, values }) });
const turn = (conversationId: string, text: string, requestId = randomUUID()) => send("/turns", { conversationId, requestId, text });
const configPayload = (workflow: any) => ({ version: workflow.version, enabled: workflow.enabled, instructions: workflow.instructions, requireConfirmation: workflow.requireConfirmation, fields: workflow.fields.map((f: any) => ({ key: f.key, required: Boolean(f.required || f.systemRequired), ...(f.defaultValue !== undefined ? { defaultValue: f.defaultValue } : {}) })) });

describe("shared completion across modules", () => {
  it.each([false, true])("keeps defaults in execution and only displays explicitly supplied fields (explicit: %s)", async explicit => {
    const workflow = (await send("/workflows")).body.data.find((item: any) => item.actionId === "department.create");
    const payload = configPayload(workflow);
    payload.fields = payload.fields.map((field: any) => field.key === "description" ? { ...field, defaultValue: "Mô tả tự điền" } : field);
    expect((await send("/workflows/department.create", payload, "PATCH")).status).toBe(200);
    const conversationId = randomUUID();
    mocks.shortlist = ["department.create"];
    answer("department.create", {});
    const collecting = (await turn(conversationId, "Tạo phòng ban")).body.data;
    expect(collecting.status, collecting.reply).toBe("collecting");
    expect(collecting.reply).not.toMatch(/workflow|mặc định|Mô tả tự điền/i);
    expect(collecting.action.values.some((item: any) => item.label === "Mô tả")).toBe(false);

    const name = `Phòng kiểm tra mặc định ${randomUUID().slice(0, 8)}`;
    answer("department.create", { name, ...(explicit ? { description: "Mô tả tự điền" } : {}) });
    const preview = (await turn(conversationId, explicit ? `${name}, mô tả: Mô tả tự điền` : name)).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");
    expect(preview.action.values.some((item: any) => item.value === "Mô tả tự điền")).toBe(explicit);
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.pending.resolved.description).toBe("Mô tả tự điền");
    expect(session.pending.defaultedKeys.includes("description")).toBe(!explicit);

    const created = (await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } })).body.data;
    expect(created.status, created.reply).toBe("completed");
    expect(created.reply.includes("Mô tả tự điền")).toBe(explicit);
    expect(created.reply).not.toMatch(/workflow/i);
    expect(parseAssistantResultTable(created.reply)).not.toBeNull();
    expect(await HrDepartmentModel.findOne({ name }).lean()).toMatchObject({ description: "Mô tả tự điền" });
  });

  it("offers and saves optional information for a legacy HR adapter through the same completion hook", async () => {
    const conversationId = randomUUID();
    const name = `Phòng kiểm tra ${randomUUID().slice(0, 8)}`;
    mocks.shortlist = ["department.create"];
    answer("department.create", { name });
    const preview = (await turn(conversationId, `Tạo phòng ban ${name}`)).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");
    const created = (await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } })).body.data;
    expect(created.status, created.reply).toBe("completed");
    expect(created.reply).toContain("Bạn có muốn bổ sung không?");
    expect(parseAssistantResultTable(created.reply)).not.toBeNull();
    const department = await HrDepartmentModel.findOne({ name }).lean();
    const stored = await AssistantTurnModel.findOne({ conversationId, actionId: "department.create" }).lean();
    expect(stored?.payload).toMatchObject({ __assistantFollowUp: { actionId: "department.update", values: { id: String(department!._id) } } });
    expect(created.reply).not.toContain(String(department!._id));

    const agreed = (await turn(conversationId, "Có")).body.data;
    expect(agreed.status, agreed.reply).toBe("collecting");
    mocks.shortlist = ["department.update"];
    answer("department.update", { description: "Phụ trách hỗ trợ khách hàng" });
    const update = (await turn(conversationId, "Bổ sung mô tả: Phụ trách hỗ trợ khách hàng")).body.data;
    expect(update.status, update.reply).toBe("confirmation");
    const updated = (await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: update.action.id, confirmed: true } })).body.data;
    expect(updated.status, updated.reply).toBe("completed");
    expect(parseAssistantResultTable(updated.reply)).not.toBeNull();
    expect(await HrDepartmentModel.findById(department!._id).lean()).toMatchObject({ name, description: "Phụ trách hỗ trợ khách hàng" });
    expect(await HrDepartmentModel.countDocuments({ name })).toBe(1);
  }, 30_000);
});

describe("healthcare assistant workflows", () => {
  async function useHealthcare(action: string, values: object) {
    mocks.modules = [...mocks.modules, "healthcare"];
    mocks.shortlist = [`healthcare.${action}`];
    answer(`healthcare.${action}`, values);
  }
  const confirm = (conversationId: string, id: string) => send("/turns", { conversationId, requestId: randomUUID(), decision: { id, confirmed: true } });
  const fixture = async (path: string, body: object) => {
    const res = await fetch(`${origin}/api/v1/healthcare${path}`, { method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect(res.status).toBe(201);
    return res.json() as Promise<any>;
  };

  it("upgrades old patient requirements and creates an automatically coded patient with an editable follow-up", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "healthcare.patient.create")!;
    const legacy = defaultWorkflow(operation);
    legacy.fields = legacy.fields.map(field => field.key === "code" ? { ...field, required: true, systemRequired: true } : field);
    await AssistantWorkflowModel.create({ userId: mocks.actor.id, companyCode: "TEST", actionId: operation.id, config: legacy, version: 2 });
    const name = `Bệnh nhân tự sinh ${randomUUID().slice(0, 8)}`;
    const conversationId = randomUUID();
    await useHealthcare("patient.create", { name });
    const preview = (await turn(conversationId, `Tạo bệnh nhân ${name}`)).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");
    expect(preview.action.values.some((item: any) => item.label === "Mã hồ sơ")).toBe(false);
    const created = (await confirm(conversationId, preview.action.id)).body.data;
    expect(created.status, created.reply).toBe("completed");
    const db = await healthcareDb();
    const patient = await records(db, "patients").findOne({ name });
    expect(patient?.code).toMatch(/^BN\d{6,}$/);
    expect(created.reply).toContain(patient!.code);
    expect(created.reply).not.toMatch(/workflow|mặc định/i);
    expect(created.reply).toContain("Bạn có muốn bổ sung không?");
    await useHealthcare("patient.update", { phone: "0911223344" });
    const update = (await turn(conversationId, "Bổ sung số điện thoại 0911223344")).body.data;
    expect(update.status, update.reply).toBe("confirmation");
    expect((await confirm(conversationId, update.action.id)).body.data.status).toBe("completed");
    expect(await records(db, "patients").findOne({ _id: patient!._id })).toMatchObject({ phone: "0911223344" });
    expect(await records(db, "patients").countDocuments({ name })).toBe(1);
  }, 60_000);

  it("creates a visit with an external doctor without requesting another doctor selection", async () => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const patient = await fixture("/patients", { name: `Bệnh nhân bác sĩ ngoài ${suffix}` });
    const room = await fixture("/catalog", { kind: "room", code: `P-${suffix}`, name: `Phòng ${suffix}` });
    const service = await fixture("/catalog", { kind: "service", code: `DV-${suffix}`, name: `Dịch vụ ${suffix}` });
    const code = `PK-${suffix}`;
    await useHealthcare("visit.create", { code, patientId: patient.code, visitedOn: "2026-11-10", doctorName: "Bác sĩ ngoài ERP Nguyễn Minh", roomId: room.name, serviceId: service.name });
    const conversationId = randomUUID();
    const preview = (await turn(conversationId, `Tạo lượt khám ${code}`)).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");
    expect(preview.referenceSelections?.some((item: any) => item.key === "doctorId")).not.toBe(true);
    const created = (await confirm(conversationId, preview.action.id)).body.data;
    expect(created.status, created.reply).toBe("completed");
    expect(created.reply).toContain("Bác sĩ ngoài ERP Nguyễn Minh");
    expect(parseAssistantResultTable(created.reply)?.after.join(" ")).not.toMatch(/Bác sĩ|Tên bác sĩ/);
    expect(await records(await healthcareDb(), "visits").findOne({ code })).toMatchObject({ doctorId: "", doctorName: "Bác sĩ ngoài ERP Nguyễn Minh" });
  }, 60_000);

  async function deletionFixture() {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const patients = await Promise.all([fixture("/patients", { name: `Bệnh nhân xóa A ${suffix}`, phone: "0911223344" }), fixture("/patients", { name: `Bệnh nhân xóa B ${suffix}` })]);
    const visit = await fixture("/visits", { code: `X-${suffix}`, patientId: patients[0]._id, visitedOn: "2026-11-10", doctorName: "Bác sĩ ngoài ERP" });
    const appointment = await fixture("/appointments", { patientId: patients[0]._id, visitId: visit._id, startsAt: "2026-11-20T01:00:00.000Z", endsAt: "2026-11-20T01:30:00.000Z" });
    const staffId = new mongoose.Types.ObjectId();
    await UserModel.collection.insertOne({ _id: staffId, companyCode: "TEST", branchId: mocks.actor.branchId, displayName: `Điều dưỡng xóa ${suffix}`, role: "member", isActive: true });
    const careBody = { patientId: patients[0]._id, visitId: visit._id, appointmentId: appointment._id, assigneeId: String(staffId), title: "Nhắc tái khám", dueOn: "2026-11-19" };
    await fixture("/care", careBody);
    return { patients, careBody };
  }

  it("previews exact cascades, allows cancellation, and only deletes after explicit confirmation", async () => {
    const { patients } = await deletionFixture();
    const conversationId = randomUUID();
    const values = { patientIds: JSON.stringify(patients.map(patient => patient.code)) };
    await useHealthcare("patient.bulk-delete", values);
    const preview = (await turn(conversationId, "Xóa hai bệnh nhân đã chọn cùng dữ liệu liên quan")).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");
    expect(preview.reply).toContain("toàn bộ lượt khám, lịch hẹn");
    expect(JSON.stringify(preview.action)).toContain("1 lượt khám · 1 lịch hẹn · 1 việc chăm sóc");
    for (const patient of patients) expect(JSON.stringify(preview.action)).not.toContain(patient._id);
    const db = await healthcareDb();
    const filter = { _id: { $in: patients.map(patient => patient._id) } };
    expect(await records(db, "patients").countDocuments(filter)).toBe(2);
    const cancelled = (await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: false } })).body.data;
    expect(cancelled.status).toBe("cancelled");
    expect(await records(db, "patients").countDocuments(filter)).toBe(2);
    await useHealthcare("patient.bulk-delete", values);
    const again = (await turn(conversationId, "Xóa hai bệnh nhân đã chọn cùng dữ liệu liên quan")).body.data;
    expect(again.status, again.reply).toBe("confirmation");
    const request = { conversationId, requestId: randomUUID(), decision: { id: again.action.id, confirmed: true } };
    const deleted = (await send("/turns", request)).body.data;
    expect(deleted.status, deleted.reply).toBe("completed");
    expect(parseAssistantResultTable(deleted.reply)?.rows[0].values).toMatchObject({ "Bệnh nhân đã xóa": "2", "Lượt khám đã xóa": "1", "Lịch hẹn đã xóa": "1", "Việc chăm sóc đã xóa": "1" });
    expect(await records(db, "patients").countDocuments(filter)).toBe(0);
    for (const kind of ["visits", "appointments", "care"] as const) expect(await records(db, kind).countDocuments({ patientId: patients[0]._id })).toBe(0);
    expect((await send("/turns", request)).body.data).toEqual(deleted);
  }, 60_000);

  it("keeps every record when cascade counts change after a deletion preview", async () => {
    const { patients, careBody } = await deletionFixture();
    const conversationId = randomUUID();
    await useHealthcare("patient.bulk-delete", { patientIds: JSON.stringify(patients.map(patient => patient.code)) });
    const preview = (await turn(conversationId, "Xóa hai hồ sơ bệnh nhân đã chọn")).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");
    await fixture("/care", { ...careBody, title: "Việc chăm sóc mới sau bản xem trước" });
    const result = (await confirm(conversationId, preview.action.id)).body.data;
    expect(result.status, result.reply).toBe("failed");
    expect(result.reply).toContain("đã thay đổi");
    const db = await healthcareDb();
    expect(await records(db, "patients").countDocuments({ _id: { $in: patients.map(patient => patient._id) } })).toBe(2);
    expect(await records(db, "care").countDocuments({ patientId: patients[0]._id })).toBe(2);
    expect(await records(db, "visits").countDocuments({ patientId: patients[0]._id })).toBe(1);
  }, 60_000);

  it("hides deletion previews and rejects deletion API access without manage permission", async () => {
    mocks.modules = [...mocks.modules, "healthcare"];
    mocks.permissions = new Set(["chat:read", "healthcare:read"]);
    expect((await send("/workflows")).body.data.some((item: any) => item.actionId.startsWith("healthcare.patient.bulk-delete"))).toBe(false);
    const response = await fetch(`${origin}/api/v1/healthcare/patients/bulk-delete-preview`, { method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" }, body: JSON.stringify({ ids: [randomUUID()] }) });
    expect(response.status).toBe(403);
  });

  it("asks for missing optional patient information after creation and continues with the same patient", async () => {
    const conversationId = randomUUID();
    const code = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    await useHealthcare("patient.create", { code, name: "Bệnh nhân bổ sung hồ sơ" });
    const preview = await turn(conversationId, `Tạo bệnh nhân ${code}`);
    expect(preview.body.data.status, JSON.stringify(preview.body)).toBe("confirmation");
    const created = (await confirm(conversationId, preview.body.data.action.id)).body.data;
    expect(created.status, created.reply).toBe("completed");
    const table = parseAssistantResultTable(created.reply);
    expect(table?.rows[0].values).toMatchObject({ "Mã bệnh nhân": code, "Số điện thoại": "—", "Ngày sinh": "—", "Địa chỉ": "—", "Ghi chú": "—" });
    for (const label of ["Số điện thoại", "Ngày sinh", "Địa chỉ", "Ghi chú"]) expect(table?.after.join(" ")).toContain(label);
    expect(created.reply).toContain("Bạn có muốn bổ sung không?");

    const agreed = (await turn(conversationId, "Có")).body.data;
    expect(agreed.status, agreed.reply).toBe("collecting");
    const session = await AssistantSessionModel.findOne({ conversationId }).lean();
    const createdRecord = await records(await healthcareDb() as any, "patients").findOne({ code });
    expect(session?.pending).toMatchObject({ actionId: "healthcare.patient.update", provided: { path_id: createdRecord!._id, targetBranch: mocks.actor.branchId } });
    await useHealthcare("patient.update", { phone: "0912345678", dateOfBirth: "1992-03-15", address: "Hà Nội" });
    const updatePreview = (await turn(conversationId, "Số điện thoại 0912345678, sinh ngày 15/03/1992, địa chỉ Hà Nội")).body.data;
    expect(updatePreview.status, updatePreview.reply).toBe("confirmation");
    const updated = (await confirm(conversationId, updatePreview.action.id)).body.data;
    expect(updated.status, updated.reply).toBe("completed");
    expect(parseAssistantResultTable(updated.reply)?.rows[0].values).toMatchObject({ "Mã bệnh nhân": code, "Số điện thoại": "0912345678", "Ngày sinh": "15/03/1992", "Địa chỉ": "Hà Nội" });
    const db = await healthcareDb();
    expect(await records(db as any, "patients").findOne({ code })).toMatchObject({ phone: "0912345678", dateOfBirth: "1992-03-15", address: "Hà Nội", revision: 2 });
    expect(await records(db as any, "patients").countDocuments({ code })).toBe(1);
  }, 30_000);

  it("accepts optional patient details directly after creation without asking for the patient again", async () => {
    const conversationId = randomUUID();
    const code = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    await useHealthcare("patient.create", { code, name: "Bệnh nhân bổ sung trực tiếp" });
    const preview = (await turn(conversationId, `Tạo bệnh nhân ${code}`)).body.data;
    await confirm(conversationId, preview.action.id);
    await useHealthcare("patient.update", { phone: "0901234567" });
    const update = (await turn(conversationId, "Bổ sung số điện thoại 0901234567")).body.data;
    expect(update.status, update.reply).toBe("confirmation");
    const updated = (await confirm(conversationId, update.action.id)).body.data;
    expect(updated.status, updated.reply).toBe("completed");
    expect(parseAssistantResultTable(updated.reply)?.rows[0].values).toMatchObject({ "Mã bệnh nhân": code, "Số điện thoại": "0901234567" });
  }, 30_000);

  it("lets users skip optional patient information and asks nothing when the profile is already complete", async () => {
    const conversationId = randomUUID();
    const code = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    await useHealthcare("patient.create", { code, name: "Bệnh nhân bỏ qua bổ sung" });
    const preview = (await turn(conversationId, `Tạo bệnh nhân ${code}`)).body.data;
    await confirm(conversationId, preview.action.id);
    const skipped = (await turn(conversationId, "Bỏ qua")).body.data;
    expect(skipped.status, skipped.reply).toBe("completed");
    const db = await healthcareDb();
    expect(await records(db as any, "patients").findOne({ code })).toMatchObject({ phone: "", dateOfBirth: "", address: "", note: "", revision: 1 });

    const fullCode = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    const fullConversation = randomUUID();
    await useHealthcare("patient.create", { code: fullCode, name: "Bệnh nhân đầy đủ", phone: "0901234567", dateOfBirth: "1990-01-01", address: "Hà Nội", note: "Liên hệ buổi sáng" });
    const fullPreview = (await turn(fullConversation, `Tạo bệnh nhân ${fullCode}`)).body.data;
    const created = (await confirm(fullConversation, fullPreview.action.id)).body.data;
    expect(created.status, created.reply).toBe("completed");
    expect(created.reply).not.toContain("Bạn có muốn bổ sung không?");
    expect(parseAssistantResultTable(created.reply)?.rows[0].values["Ghi chú"]).toBe("Liên hệ buổi sáng");
  }, 30_000);

  it("creates only after confirmation, searches without a mutation confirmation, and preserves patient fields on update", async () => {
    const conversationId = randomUUID();
    const code = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    await useHealthcare("patient.create", { code, name: "Nguyễn An Y Tế", phone: "0901234567", address: "Địa chỉ giữ nguyên", note: "Ghi chú giữ nguyên" });
    const preview = await turn(conversationId, "Tạo bệnh nhân Nguyễn An Y Tế");
    expect(preview.body.data.status, JSON.stringify(preview.body)).toBe("confirmation");
    const db = await healthcareDb();
    expect(await records(db as any, "patients").findOne({ code })).toBeNull();
    const created = await confirm(conversationId, preview.body.data.action.id);
    expect(created.body.data.status, JSON.stringify(created.body)).toBe("completed");
    const patient = await records(db as any, "patients").findOne({ code });
    expect(patient).toMatchObject({ phone: "0901234567", revision: 1 });
    expect(created.body.data.reply).not.toContain(patient!._id);

    await AssistantSettingsModel.updateOne({ userId: mocks.actor.id, companyCode: "TEST" }, { $set: { "config.alwaysConfirm": true } });
    await useHealthcare("patient.list", { q: code });
    const found = await turn(randomUUID(), `Tìm bệnh nhân ${code}`);
    expect(found.body.data.status, JSON.stringify(found.body)).toBe("completed");
    expect(found.body.data.reply).toContain(code);
    expect(found.body.data.reply).not.toContain(patient!._id);

    await useHealthcare("patient.update", { path_id: code, phone: "0912345678" });
    const updateId = randomUUID();
    const updatePreview = await turn(updateId, `Cập nhật số điện thoại bệnh nhân ${code}`);
    expect(updatePreview.body.data.status, JSON.stringify(updatePreview.body)).toBe("confirmation");
    const updated = await confirm(updateId, updatePreview.body.data.action.id);
    expect(updated.body.data.status, JSON.stringify(updated.body)).toBe("completed");
    expect(await records(db as any, "patients").findOne({ code })).toMatchObject({ phone: "0912345678", address: "Địa chỉ giữ nguyên", note: "Ghi chú giữ nguyên", revision: 2 });
  }, 30_000);

  it("rejects stale healthcare confirmation without overwriting the newer patient record", async () => {
    const db = await healthcareDb();
    const id = randomUUID();
    const code = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    await records(db as any, "patients").insertOne({ _id: id, revision: 1, companyCode: "TEST", branchId: mocks.actor.branchId,
      code, name: "Bệnh nhân phiên bản", phone: "0901234567", address: "", dateOfBirth: "", note: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: mocks.actor.id, updatedBy: mocks.actor.id, audit: [] });
    await useHealthcare("patient.update", { path_id: code, phone: "0912345678" });
    const conversationId = randomUUID();
    const preview = await turn(conversationId, `Cập nhật bệnh nhân ${code}`);
    expect(preview.body.data.status, JSON.stringify(preview.body)).toBe("confirmation");
    await records(db as any, "patients").updateOne({ _id: id }, { $set: { revision: 2, phone: "0987654321" } });
    const result = await confirm(conversationId, preview.body.data.action.id);
    expect(result.body.data.status, JSON.stringify(result.body)).toBe("failed");
    expect(result.body.data.reply).toContain("đã thay đổi");
    expect(await records(db as any, "patients").findOne({ _id: id })).toMatchObject({ revision: 2, phone: "0987654321" });
  }, 30_000);

  it("books an appointment by patient/catalog names and completes assigned care with a required result", async () => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const patient = await fixture("/patients", { code: `BN-${suffix}`, name: `Bệnh nhân ${suffix}` });
    const doctor = await fixture("/catalog", { kind: "doctor", code: `BS-${suffix}`, name: `Bác sĩ ${suffix}` });
    const room = await fixture("/catalog", { kind: "room", code: `P-${suffix}`, name: `Phòng ${suffix}` });
    const visit = await fixture("/visits", { code: `LK-${suffix}`, patientId: patient._id, visitedOn: "2026-11-12", doctorId: doctor._id, roomId: room._id });
    const staffId = new mongoose.Types.ObjectId();
    await UserModel.collection.insertOne({ _id: staffId, companyCode: "TEST", branchId: mocks.actor.branchId, displayName: `Điều dưỡng ${suffix}`, role: "member", isActive: true });
    await useHealthcare("appointment.create", { patientId: patient.code, visitId: visit.code, doctorId: doctor.name, roomId: room.name,
      startsAt: "2026-11-12T09:00:00+07:00", endsAt: "2026-11-12T09:30:00+07:00" });
    const conversationId = randomUUID();
    const preview = await turn(conversationId, `Đặt lịch khám cho bệnh nhân ${patient.code}`);
    expect(preview.body.data.status, JSON.stringify(preview.body)).toBe("confirmation");
    expect(JSON.stringify(preview.body.data.action)).not.toContain(patient._id);
    expect(JSON.stringify(preview.body.data.action)).toContain(doctor.name);
    const booked = await confirm(conversationId, preview.body.data.action.id);
    expect(booked.body.data.status, JSON.stringify(booked.body)).toBe("completed");
    const db = await healthcareDb();
    const appointment = await records(db as any, "appointments").findOne({ patientId: patient._id });
    expect(appointment).toMatchObject({ patientId: patient._id, doctorId: doctor._id, roomId: room._id, visitId: visit._id, status: "scheduled" });

    await useHealthcare("care.create", { patientId: patient.code, appointmentId: appointment!._id, visitId: visit.code, assigneeId: `Điều dưỡng ${suffix}`, title: `Nhắc tái khám ${suffix}`, dueOn: "2026-11-11" });
    const careConversation = randomUUID();
    const carePreview = await turn(careConversation, `Giao việc nhắc tái khám ${suffix}`);
    expect(carePreview.body.data.status, JSON.stringify(carePreview.body)).toBe("confirmation");
    const assigned = await confirm(careConversation, carePreview.body.data.action.id);
    expect(assigned.body.data.status, JSON.stringify(assigned.body)).toBe("completed");
    const care = await records(db as any, "care").findOne({ patientId: patient._id });
    expect(care).toMatchObject({ assigneeId: String(staffId), status: "open", appointmentId: appointment!._id, visitId: visit._id });

    await useHealthcare("care.update", { path_id: care!._id, status: "completed" });
    const completionConversation = randomUUID();
    const missingResult = await turn(completionConversation, "Hoàn tất việc chăm sóc bệnh nhân");
    expect(missingResult.body.data.status, JSON.stringify(missingResult.body)).toBe("collecting");
    expect(missingResult.body.data.reply).toContain("Kết quả chăm sóc");
    await useHealthcare("care.update", { path_id: care!._id, status: "completed", result: "Bệnh nhân xác nhận lịch tái khám" });
    const completionPreview = await turn(completionConversation, "Kết quả: Bệnh nhân xác nhận lịch tái khám");
    expect(completionPreview.body.data.status, JSON.stringify(completionPreview.body)).toBe("confirmation");
    const complete = await confirm(completionConversation, completionPreview.body.data.action.id);
    expect(complete.body.data.status, JSON.stringify(complete.body)).toBe("completed");
    expect(await records(db as any, "care").findOne({ _id: care!._id })).toMatchObject({ status: "completed", result: "Bệnh nhân xác nhận lịch tái khám", revision: 2 });
  }, 30_000);

  it("returns the real healthcare Excel template through the authenticated assistant download endpoint", async () => {
    const conversationId = randomUUID();
    await useHealthcare("import.template", { path_kind: "patients" });
    const result = await turn(conversationId, "Tải mẫu Excel bệnh nhân");
    expect(result.body.data.status, JSON.stringify(result.body)).toBe("completed");
    expect(result.body.data.files[0]).toMatchObject({ fileName: "mau-benh-nhan.xlsx", format: "xlsx" });
    const download = await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${result.body.data.files[0].id}`, { headers: { Authorization: "Bearer test" } });
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("spreadsheetml");
    expect((await download.arrayBuffer()).byteLength).toBeGreaterThan(100);
  }, 30_000);

  it("checks attached Excel first and requires a separate confirmed commit before creating patients", async () => {
    const conversationId = randomUUID();
    const code = `BN-${randomUUID().slice(0, 8).toUpperCase()}`;
    await useHealthcare("import.preview", { path_kind: "patients" });
    const attachment = { fileName: "benh-nhan-chat.xlsx", headers: ["ma_benh_nhan", "ho_ten", "so_dien_thoai", "ngay_sinh", "dia_chi", "ghi_chu"],
      rows: [{ ma_benh_nhan: code, ho_ten: "Bệnh nhân từ Excel", so_dien_thoai: "0901234567", ngay_sinh: "1990-01-01", dia_chi: "", ghi_chu: "" }] };
    const preview = await send("/turns", { conversationId, requestId: randomUUID(), text: "Kiểm tra tệp bệnh nhân đính kèm", attachment });
    expect(preview.body.data.status, JSON.stringify(preview.body)).toBe("confirmation");
    const queued = await confirm(conversationId, preview.body.data.action.id);
    expect(queued.body.data.reply, JSON.stringify(queued.body)).toContain("xếp hàng kiểm tra");
    const db = await healthcareDb();
    await processNextImport(db as any);
    const job = await db.collection("healthcare_imports").findOne({ companyCode: "TEST", filename: attachment.fileName });
    expect(job, "Import job must be queued by the actual multipart preview API").toBeTruthy();
    expect(await records(db as any, "patients").findOne({ code })).toBeNull();
    await useHealthcare("import.commit", { path_id: job!._id });
    const commitId = randomUUID();
    const commitPreview = await turn(commitId, "Ghi dữ liệu tệp bệnh nhân đã kiểm tra");
    expect(commitPreview.body.data.status, JSON.stringify(commitPreview.body)).toBe("confirmation");
    const commit = await confirm(commitId, commitPreview.body.data.action.id);
    expect(commit.body.data.reply, JSON.stringify(commit.body)).toContain("xếp hàng xử lý");
    await processNextImport(db as any);
    expect(await records(db as any, "patients").findOne({ code })).toMatchObject({ name: "Bệnh nhân từ Excel" });
  }, 30_000);
});

describe("kanban task deadline inference", () => {
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "task.create")!;

  it("sets the deadline to start plus the estimated duration when no deadline was requested", () => {
    const intent = "Tạo công việc Khởi tạo dự án, bắt đầu lúc 8 giờ sáng ngày 5/11, thời gian 24 giờ";
    const values = { title: "Khởi tạo dự án", startTime: "2026-11-05T08:00:00", estTime: 24, dueDate: "2026-11-05T00:00:00.000Z" } as any;
    expect(inferTaskDeadline(operation, values, intent)).toMatchObject({ dueDate: "2026-11-06T08:00:00.000" });
  });

  it("derives a missing deadline, while preserving an explicitly requested deadline", () => {
    const startTime = "2026-11-05T08:00:00";
    expect(inferTaskDeadline(operation, { startTime, estTime: 24 } as any, "Tạo công việc bắt đầu ngày 5/11 lúc 8 giờ, thời gian 24 giờ").dueDate)
      .toBe("2026-11-06T08:00:00.000");
    const explicit = { startTime, estTime: 24, dueDate: "2026-11-05T00:00:00.000Z" } as any;
    expect(inferTaskDeadline(operation, explicit, "Tạo công việc bắt đầu 8 giờ ngày 5/11, hạn hoàn thành ngày 5/11")).toBe(explicit);
  });
});

describe("individual work-hours mode inference", () => {
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.patch.6bc968347283a069")!;

  it("enables custom hours from the request or supplied schedule without asking for the toggle", () => {
    expect(inferCustomWorkHoursMode(operation, {}, "Sửa giờ làm việc riêng cho nhân sự")).toMatchObject({ useCustom: true });
    expect(inferCustomWorkHoursMode(operation, {}, "Sửa giờ làm việc riêng cho nhân sự", "9h30p sáng đến 7h tối, nghỉ trư từ 2h chiều đến 3h30 chiều"))
      .toMatchObject({ useCustom: true, checkInLimit: "09:30", checkOutLimit: "19:00", lunchBreakStart: "14:00", lunchBreakEnd: "15:30" });
    expect(inferCustomWorkHoursMode(operation, {
      checkInLimit: "09:30", checkOutLimit: "19:00", lunchBreakStart: "14:00", lunchBreakEnd: "15:30",
    }, "9h30 sáng đến 7h tối, nghỉ trưa từ 2h đến 3h30 chiều")).toMatchObject({ useCustom: true });
  });

  it("preserves an explicit request to disable individual hours", () => {
    expect(inferCustomWorkHoursMode(operation, { useCustom: false }, "Tắt giờ làm riêng cho nhân sự").useCustom).toBe(false);
  });

  it("requires a complete schedule before previewing private work hours", () => {
    const inferred = inferCustomWorkHoursMode(operation, {}, "Sửa giờ làm việc riêng cho nhân sự");
    const missing = missingCustomWorkHoursLabels(operation, inferred);
    expect(missing).toEqual([
      operation.fields.find(field => field.key === "checkInLimit")?.label,
      operation.fields.find(field => field.key === "checkOutLimit")?.label,
      operation.fields.find(field => field.key === "lunchBreakStart")?.label,
      operation.fields.find(field => field.key === "lunchBreakEnd")?.label,
    ]);
    expect(customWorkHoursFollowUpQuestion(operation, missing)).toContain("9h30 sáng đến 7h tối");
    expect(missingCustomWorkHoursLabels(operation, { useCustom: false })).toEqual([]);
    expect(missingCustomWorkHoursLabels(operation, {
      useCustom: true, checkInLimit: "09:30", checkOutLimit: "19:00", lunchBreakStart: "14:00", lunchBreakEnd: "15:30",
    })).toEqual([]);
  });
});

describe("employee custom work-hours collection", () => {
  it("asks for the schedule after selecting an employee instead of showing an incomplete preview", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "api.patch.6bc968347283a069")!;
    const conversationId = randomUUID();
    mocks.shortlist = [operation.id];
    answer(operation.id, {});

    const first = await turn(conversationId, "Sửa giờ làm việc riêng cho nhân sự");
    expect(first.body.data.status).toBe("collecting");
    const employeeSelection = first.body.data.referenceSelections.find((selection: any) => selection.key === "path_uid");
    expect(employeeSelection.options).toEqual([expect.objectContaining({ label: "Văn Hoàng" })]);

    const selected = await send("/turns", {
      conversationId,
      requestId: randomUUID(),
      referenceSelections: { path_uid: [employeeSelection.options[0].value] },
    });

    expect(selected.body.data.status).toBe("collecting");
    expect(selected.body.data.status).not.toBe("confirmation");
    expect(selected.body.data.reply).toContain("giờ vào, giờ ra và thời gian nghỉ trưa");
    expect(selected.body.data.reply).toContain("9h30 sáng đến 7h tối");
    expect(workHoursWrites).toEqual([]);
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.pending.provided).toMatchObject({ useCustom: true });
    expect(session.pending.provided).toHaveProperty("path_uid");
    expect(session.pending.resolved).toBeUndefined();
  });
});

describe("assistant spreadsheet import", () => {
  it("maps an uploaded worker list into the normal confirmation workflow", async () => {
    mocks.modules = ["hr", "chat", "customer", "inventory", "worker"];
    mocks.shortlist = ["worker.bulk.create"];
    answer("worker.bulk.create");
    const conversationId = randomUUID();
    const response = await send("/turns", {
      conversationId,
      requestId: randomUUID(),
      text: "Tạo hàng loạt lao động từ tệp này",
      attachment: {
        fileName: "lao-dong.csv",
        headers: ["Họ và tên", "SĐT", "Ngày sinh"],
        rows: [{ "Họ và tên": "Chung Abc", "SĐT": "0987654321", "Ngày sinh": "05/11/1998" }],
      },
    });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("confirmation");
    expect(response.body.data.action.values).toContainEqual({ label: "Danh sách lao động", value: "1 dòng từ lao-dong.csv", defaulted: false });
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(JSON.parse(session.pending.provided.workers)).toEqual([{ fullName: "Chung Abc", phone: "0987654321", birthday: "1998-11-05" }]);
    expect(await WorkerModel.countDocuments()).toBe(0);
  });
});

describe("assistant general questions", () => {
  it("continues a pending file request after the user supplies missing data, including after reload", async () => {
    const conversationId = randomUUID();
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Bạn cung cấp số liệu nhé.", sourceDocumentId: null, formats: ["xlsx"], document: null }) });
    const first = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Xuất Excel doanh thu theo tháng" })).body.data;
    expect(first.status).toBe("collecting");
    expect((await AssistantSessionModel.findOne({ conversationId }).lean())?.pendingDocumentRequest).toContain("Excel");
    expect((await send(`/conversations/${conversationId}`)).body.data.lastReply.status).toBe("collecting");
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Xong", sourceDocumentId: null, formats: ["xlsx"], document: { title: "Doanh thu", sections: [], sheets: [{ name: "Doanh thu", columns: ["Tháng", "Số tiền"], rows: [["Tháng 1", 1000000]] }] } }) });
    const completed = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Tháng 1: 1.000.000 đồng" })).body.data;
    expect(completed.status, completed.reply).toBe("completed");
    expect(completed.files).toHaveLength(1);
    const request = JSON.parse(mocks.interpret.mock.calls.at(-1)![0].messages[1].content);
    expect(request.question).toContain("Xuất Excel doanh thu theo tháng");
    expect(request.question).toContain("Tháng 1: 1.000.000 đồng");
    expect(completed.pendingDocumentRequest).toBeUndefined();
    expect((await AssistantSessionModel.findOne({ conversationId }).lean())?.pendingDocumentRequest).toBe("");
  });

  it("saves and forgets explicit memory commands in Q&A without claiming a model-only save", async () => {
    const conversationId = randomUUID();
    const saved = await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Ghi nhớ: Tôi thích kế hoạch trình bày theo tuần." });
    expect(saved.body.data.status).toBe("completed");
    expect(await AssistantMemoryModel.countDocuments({ companyCode: "TEST", userId: mocks.actor.id })).toBe(1);
    const forgotten = await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Xóa ghi nhớ: Tôi thích kế hoạch trình bày theo tuần." });
    expect(forgotten.body.data.reply).toContain("đã quên");
    expect(await AssistantMemoryModel.countDocuments({ companyCode: "TEST", userId: mocks.actor.id })).toBe(0);
    expect(mocks.interpret).not.toHaveBeenCalled();
  });

  it("creates downloadable files, preserves full source across revisions, and restores files in history", async () => {
    const conversationId = randomUUID();
    const requestId = randomUUID();
    const content = { title: "Kế hoạch tư vấn", sections: [{ heading: "Nội dung gốc", text: "Nội dung dài cần giữ. ".repeat(400) }], sheets: [{ name: "Kế hoạch", columns: ["Công việc", "Ngân sách"], rows: [["Tư vấn", 1200000]] }] };
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Sẵn sàng", sourceDocumentId: null, formats: ["xlsx", "pdf", "docx"], document: content }) });
    const created = (await send("/turns", { conversationId, requestId, mode: "qa", text: "Tạo kế hoạch tư vấn, xuất Excel, PDF và Word" })).body.data;
    expect(created.status, created.reply).toBe("completed");
    expect(created.files).toHaveLength(3);
    expect(mocks.interpret.mock.calls[0][0].messages[0].content).toContain("QUY ƯỚC TÀI LIỆU IGEN");
    expect(mocks.interpret.mock.calls[0][0].messages[0].content).toContain("WORD");
    expect((await AssistantDocumentModel.findOne({ conversationId }).lean())?.generationRulesVersion).toBe(DOCUMENT_RULES_VERSION);
    expect(JSON.stringify(created)).not.toContain('"bytes"');
    const file = created.files[0];
    const download = await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${file.id}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(download.headers.get("cache-control")).toBe("private, no-store");
    const bytes = new Uint8Array(await download.arrayBuffer());
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    const retried = (await send("/turns", { conversationId, requestId, mode: "qa", text: "Tạo kế hoạch tư vấn, xuất Excel, PDF và Word" })).body.data;
    expect(retried.files).toEqual(created.files);
    expect(await AssistantDocumentModel.countDocuments({ conversationId })).toBe(1);

    const revised = { ...content, sheets: [{ ...content.sheets[0], columns: ["Công việc", "Ngân sách", "Phụ trách"], rows: [["Tư vấn", 1200000, "An"]] }] };
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Đã bổ sung", sourceDocumentId: file.documentId, formats: ["xlsx"], document: revised }) });
    const updated = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Thêm cột Phụ trách, giao cho An" })).body.data;
    expect(updated.files[0]).toMatchObject({ documentId: file.documentId, version: 2 });
    const modelContext = JSON.parse(mocks.interpret.mock.calls.at(-1)![0].messages[1].content);
    expect(modelContext.sourceDocument.content).toEqual(content);
    const history = (await send(`/conversations/${conversationId}`)).body.data;
    expect(history.messages.filter((message: any) => message.files?.length)).toHaveLength(2);
    expect(await AssistantDocumentModel.countDocuments({ conversationId })).toBe(2);
    expect((await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${file.id}`)).status).toBe(200);

    mocks.interpret.mockResolvedValueOnce({ text: "Tài liệu có các cột Công việc, Ngân sách và Phụ trách." });
    const question = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Tài liệu vừa tạo có những cột nào?" })).body.data;
    expect(question.reply).toContain("Phụ trách");
    expect(question.files).toBeUndefined();
    expect(await AssistantDocumentModel.countDocuments({ conversationId })).toBe(2);
    expect(JSON.parse(mocks.interpret.mock.calls.at(-1)![0].messages[1].content).sourceDocument.content).toEqual(revised);

    const callsBeforeConversion = mocks.interpret.mock.calls.length;
    const converted = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Đổi sang PDF" })).body.data;
    expect(converted.status, converted.reply).toBe("completed");
    expect(converted.files[0]).toMatchObject({ documentId: file.documentId, version: 3, format: "pdf" });
    expect(mocks.interpret.mock.calls.length).toBe(callsBeforeConversion);
    expect((await AssistantDocumentModel.findOne({ conversationId, version: 3 }).select("+content").lean())?.content).toEqual(revised);
    const historical = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Xuất phiên bản 1 sang PDF" })).body.data;
    expect(historical.status, historical.reply).toBe("completed");
    expect(historical.files[0]).toMatchObject({ documentId: file.documentId, version: 4, format: "pdf" });
    expect((await AssistantDocumentModel.findOne({ conversationId, version: 4 }).select("+content").lean())?.content).toEqual(content);
    expect(mocks.interpret.mock.calls.length).toBe(callsBeforeConversion);

    mocks.actor.id = "507f1f77bcf86cd799439099";
    expect((await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${file.id}`)).status).toBe(404);
    mocks.actor.id = "507f1f77bcf86cd799439011";
    mocks.actor.branchId = "507f1f77bcf86cd799439098";
    expect((await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${file.id}`)).status).toBe(404);
    mocks.actor.branchId = "507f1f77bcf86cd799439012";
    mocks.actor.companyCode = "OTHER";
    expect((await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${file.id}`)).status).toBe(404);
    mocks.actor.companyCode = "TEST";
    expect((await send(`/conversations/${conversationId}`, undefined, "DELETE")).body.data.deleted).toBe(true);
    expect(await AssistantDocumentModel.countDocuments({ conversationId })).toBe(0);
    expect((await fetch(`${origin}/api/v1/chatbot/assistant/conversations/${conversationId}/files/${file.id}`)).status).toBe(404);
  });

  it("asks for missing data and rejects malformed generated documents without storing files", async () => {
    const conversationId = randomUUID();
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Bạn cung cấp số liệu doanh thu nhé.", sourceDocumentId: null, formats: ["xlsx"], document: null }) });
    const missing = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Xuất file Excel doanh thu tháng này" })).body.data;
    expect(missing.status).toBe("collecting");
    expect(missing.files).toBeUndefined();
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Xong", sourceDocumentId: null, formats: ["xlsx"], document: { title: "Test", sections: [], sheets: [{ name: "Bảng", columns: ["Tên"], rows: [["An", "thừa ô"]] }] } }) });
    const invalid = (await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Tạo file Excel từ dữ liệu này" })).body.data;
    expect(invalid.status).toBe("failed");
    expect(await AssistantDocumentModel.countDocuments({ conversationId })).toBe(0);
  });

  it("answers knowledge questions conversationally without creating an ERP record", async () => {
    mocks.interpret.mockResolvedValueOnce({ text: "Phòng ban là một nhóm nhân sự được tổ chức theo chuyên môn hoặc chức năng." });
    const response = await send("/turns", { conversationId: randomUUID(), requestId: randomUUID(), mode: "qa", text: "Phòng ban là gì?" });
    const reply = response.body.data;
    expect(reply.status).toBe("completed");
    expect(reply.reply).toContain("nhóm nhân sự");
    expect(reply.action).toBeUndefined();
    expect(await HrDepartmentModel.countDocuments()).toBe(0);
  });

  it("keeps ordinary knowledge answers out of the workflow tab", async () => {
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "general_question", actionId: null, values: {} }) });
    const response = await turn(randomUUID(), "Thủ đô của Việt Nam là gì?");
    expect(response.body.data.status).toBe("unsupported");
    expect(response.body.data.reply).toContain("tab Hỏi đáp");
    expect(mocks.interpret).toHaveBeenCalledOnce();
  });

  it("routes the Q&A mode directly to general answers and stores its conversation mode", async () => {
    const settings = (await send("/settings")).body.data;
    expect((await send("/settings", { ...settings, autoMemoryEnabled: false }, "PATCH")).status).toBe(200);
    mocks.interpret.mockResolvedValueOnce({ text: "Nước sôi ở khoảng 100°C tại áp suất khí quyển tiêu chuẩn." });
    const conversationId = randomUUID();
    const response = await send("/turns", { conversationId, requestId: randomUUID(), mode: "qa", text: "Nước sôi ở nhiệt độ bao nhiêu?" });

    expect(response.status).toBe(200);
    expect(response.body.data.reply).toContain("100°C");
    expect(mocks.interpret).toHaveBeenCalledOnce();
    expect(mocks.interpret.mock.calls[0][0].messages[0].content).toContain("Bạn là trợ lý AI trò chuyện thân thiện");
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.mode).toBe("qa");
    expect(session.pending).toBeNull();
    expect(await HrDepartmentModel.countDocuments()).toBe(0);
  });
});

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
  await Promise.all([AssistantMemoryModel.init(), AssistantSessionModel.init(), AssistantTurnModel.init(), AssistantWorkflowModel.init()]);
  const app = express(); app.use(express.json()); app.use("/api/v1/chatbot/assistant", assistantRouter); app.use("/api/v1/auth", authRouter); app.use("/api/v1/leave", leaveRouter); app.use("/api/v1/hr/departments", hrDepartmentRouter); app.get("/api/v1/partners", (_req, res) => res.json({ success: true, partners: [{ _id: "507f1f77bcf86cd799439055", name: "Nguyễn Hoàng Minh Phương", __v: 0 }] })); app.get("/api/v1/retail/debt-reminders/deliveries/retryable", (_req, res) => res.json({ success: true, data: { items: [{ _id: reminderDeliveryId, recipientName: "Nguyễn An", recipientEmail: "customer@example.com", orderCode: "SO-001", subject: reminderContent.subject, message: reminderContent.text, attempt: 1, maxAttempts: 3, createdAt: "2026-11-01T10:00:00.000Z" }], total: 1, page: 1, limit: 20 } })); app.post("/api/v1/retail/debt-reminders/deliveries/:id/retry", (req, res) => { reminderRetryIds.push(req.params.id); res.json({ success: true, data: { status: "queued", nextAttemptAt: "2026-11-01T10:00:00.000Z" } }); }); app.use("/api/v1/worker-management/workers", (req: any, _res: any, next: any) => { req.user = { ...mocks.actor }; next(); }, workerRoutes);
  app.use("/api/v1/worker-management/partners", (req: any, _res: any, next: any) => { req.user = { ...mocks.actor }; next(); }, laborPartnerRoutes);
  app.use("/api/v1/healthcare", (req: any, _res: any, next: any) => { req.user = { ...mocks.actor }; next(); }, healthcareRouter);
  app.get("/api/v1/timekeeping/work-hours", (_req, res) => res.json({ success: true, data: [{
    _id: "507f1f77bcf86cd799439999", displayName: "Văn Hoàng", fullName: "Văn Hoàng",
    email: "vanhaong21@gmail.com", branchId: mocks.actor.branchId, workHoursConfig: {},
  }] }));
  app.get("/api/v1/retail/shifts/cashiers", async (_req, res) => {
    const users = await UserModel.find({ companyCode: "TEST", branchId: mocks.actor.branchId, isActive: { $ne: false } }).select("_id displayName email").lean();
    res.json({ success: true, data: users.map(user => ({ id: String(user._id), name: user.displayName || user.email })) });
  });
  app.patch("/api/v1/timekeeping/work-hours/:uid", (req, res) => {
    workHoursWrites.push({ uid: req.params.uid, body: req.body });
    res.json({ success: true, data: { uid: req.params.uid } });
  });
  app.get("/api/v1/inventory/catalog/products", (_req, res) => res.json({ success: true, data: { items: [{ _id: skuContinuationProductId, name: "Cốc sứ tai mèo" }] } }));
  app.get("/api/v1/inventory/catalog/products/:id", (req, res) => res.json({ success: true, data: {
    _id: req.params.id,
    name: "Cốc sứ tai mèo",
    variants: [{ _id: skuContinuationVariantId, sku: "SKU-COC-MEO", displayName: "Màu trắng", status: "active" }],
  } }));
  app.put("/api/v1/inventory/catalog/prices/:variantId", (req, res) => {
    skuPriceWrites.push({ variantId: req.params.variantId, productId: req.query.productId?.toString() || null, body: req.body });
    res.json({ success: true, data: { sku: "SKU-COC-MEO", ...req.body, status: "active" } });
  });
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve)); origin = `http://127.0.0.1:${(server.address() as any).port}`;
}, 60000);
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  reminderContent = { subject: "Nhắc thanh toán công nợ · SO-001", text: "Kính gửi Nguyễn An, đơn hàng SO-001 còn công nợ 1.000.000 ₫." };
  reminderRetryIds = [];
  skuPriceWrites = [];
  workHoursWrites = [];
  mocks.shortlist = null;
  mocks.permissions = new Set(["*"]); mocks.modules = ["hr", "chat", "customer", "inventory"]; mocks.actor.id = "507f1f77bcf86cd799439011"; mocks.actor.role = "admin"; mocks.actor.companyCode = "TEST"; mocks.actor.branchId = "507f1f77bcf86cd799439012"; mocks.interpret.mockReset(); vi.restoreAllMocks();
  await Promise.all([WorkerModel.deleteMany({}), AssistantDocumentModel.deleteMany({}), AssistantMemoryModel.deleteMany({}), AssistantSettingsModel.deleteMany({}), AssistantSessionModel.deleteMany({}), AssistantTurnModel.deleteMany({}), AssistantWorkflowModel.deleteMany({}), UserModel.deleteMany({}), BranchModel.deleteMany({}), HrDepartmentModel.deleteMany({})]);
  await Promise.all([LaborPartnerModel.deleteMany({}), LaborPartnerKpiModel.deleteMany({})]);
  await BranchModel.create({ _id: mocks.actor.branchId, name: "Chi nhánh thử", code: "TEST", companyCode: "TEST", isActive: true });
});

describe("assistant action preview identifiers", () => {
  it("shows the selected branch name instead of its internal ID", async () => {
    mocks.modules = [...mocks.modules, "finance"];
    mocks.actor.branchId = "";
    mocks.shortlist = ["finance.reminders.run"];
    answer("finance.reminders.run", { targetBranch: "TEST" });

    const result = (await turn(randomUUID(), "Chạy nhắc công nợ tại TEST")).body.data;
    expect(result.status, result.reply).toBe("confirmation");
    const branchValue = result.action.values.find((item: any) => item.label === "Chi nhánh tài chính")?.value;
    expect(branchValue).toContain("Chi nhánh thử");
    expect(branchValue).not.toContain("507f1f77bcf86cd799439012");
  });
});

describe("pending repair request recovery", () => {
  it("keeps the repair draft after an invalid interpretation before dispatch", async () => {
    mocks.modules = [...mocks.modules, "repair"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/repair/tickets")!;
    const conversationId = randomUUID();
    const pendingId = randomUUID();
    await AssistantSessionModel.create({
      userId: mocks.actor.id,
      companyCode: mocks.actor.companyCode,
      branchId: mocks.actor.branchId,
      conversationId,
      messageCount: 1,
      messages: [{ role: "assistant", content: "Mình còn thiếu Mô tả lỗi/yêu cầu." }],
      pending: {
        id: pendingId,
        actionId: operation.id,
        provided: { symptom: "máy lỗi pin" },
        intent: "Tạo phiếu sửa chữa dịch vụ",
        workflowVersion: 0,
        preview: { id: pendingId, title: operation.title, values: [] },
        confirmationDetails: {},
        awaitingReferenceKeys: [],
        awaitingReferenceLabels: [],
        awaitingPathReferenceKeys: [],
        skippedReferenceKeys: [],
        referenceSelections: [],
      },
    });

    mocks.shortlist = [operation.id];
    answer("not-a-workflow", {});
    const response = await turn(conversationId, "Yêu cầu là thay pin");
    expect(response.body.data.status).toBe("failed");
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.pending).toMatchObject({ actionId: operation.id, provided: { symptom: "máy lỗi pin" } });
  });

  it("continues a pending POS shift when its action ID changed but its title is still unique", async () => {
    mocks.modules = [...mocks.modules, "retail"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/retail/shifts/open")!;
    const cashier = await UserModel.create({
      displayName: "IT1",
      email: "it1@example.test",
      role: "admin",
      companyCode: "TEST",
      branchId: mocks.actor.branchId,
    });
    const conversationId = randomUUID();
    const pendingId = randomUUID();
    await AssistantSessionModel.create({
      userId: mocks.actor.id,
      companyCode: mocks.actor.companyCode,
      branchId: mocks.actor.branchId,
      conversationId,
      messageCount: 1,
      messages: [{ role: "assistant", content: "Mình còn thiếu Tiền đầu ca." }],
      pending: {
        id: pendingId,
        actionId: "legacy.retail.shift.open",
        provided: { cashierId: String(cashier._id) },
        intent: "mở phiên bán hàng",
        workflowVersion: 0,
        preview: { id: pendingId, title: operation.title, values: [{ label: "Tên nhân viên thu ngân", value: "IT1" }] },
        confirmationDetails: {},
        awaitingReferenceKeys: [],
        awaitingReferenceLabels: {},
        awaitingPathReferenceKeys: [],
        skippedReferenceKeys: [],
        referenceSelections: [],
      },
    });

    mocks.shortlist = [operation.id];
    answer(operation.id, { openingFloat: 1_000_000 });
    const response = await turn(conversationId, "Tiền đầu ca là 1000000");

    expect(response.body.data.status, response.body.data.reply).toBe("confirmation");
    expect(response.body.data.action.values).toContainEqual({ label: "Tên nhân viên thu ngân", value: "IT1", defaulted: false });
    expect(response.body.data.action.values.some((item: any) => item.label === "Tiền đầu ca")).toBe(true);
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.pending).toMatchObject({ actionId: operation.id, provided: { cashierId: String(cashier._id), openingFloat: 1_000_000 } });
  });
});

describe("POS opening workflow", () => {
  it("offers a cashier choice when the user asks to open a sales session", async () => {
    mocks.modules = [...mocks.modules, "retail"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/retail/shifts/open")!;
    await UserModel.create({
      displayName: "IT1",
      email: "pos-it1@example.test",
      role: "admin",
      companyCode: "TEST",
      branchId: mocks.actor.branchId,
    });
    answer(operation.id, {});

    const response = await turn(randomUUID(), "mở phiên bán hàng");

    expect(response.body.data.status, response.body.data.reply).toBe("collecting");
    expect(response.body.data.referenceSelections).toContainEqual(expect.objectContaining({
      key: "cashierId",
      required: true,
      options: [expect.objectContaining({ label: "IT1" })],
    }));
    expect(response.body.data.reply).toContain("Tiền đầu ca");
    expect(mocks.interpret).toHaveBeenCalledOnce();
  });
});

describe("enum choice recovery", () => {
  it("shows selectable choices instead of asking for an invalid enum value", async () => {
    mocks.modules = [...mocks.modules, "retail"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.coupon.create")!;
    mocks.shortlist = [operation.id];
    answer(operation.id, { targetType: "all users" });

    const response = await turn(randomUUID(), "Tạo mã ưu đãi");

    expect(response.body.data.status).toBe("collecting");
    expect(response.body.data.referenceSelections).toContainEqual(expect.objectContaining({
      key: "targetType",
      options: [
        { value: "all_customers", label: "Tất cả khách hàng" },
        { value: "specific_customer", label: "Một khách hàng cụ thể" },
      ],
    }));
    expect(response.body.data.reply).not.toContain("Đối tượng áp dụng ưu đãi: chọn");
  });
});

describe("course category creation", () => {
  it("collects a category name and prepares a confirmation instead of losing the pending workflow", async () => {
    mocks.modules = [...mocks.modules, "student"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "course.category.create")!;
    const conversationId = randomUUID();
    answer(operation.id, {});

    const first = await turn(conversationId, "Tạo phân loại khóa học");
    expect(first.body.data.status).toBe("collecting");
    expect(first.body.data.reply).toContain("Tên phân loại khóa học");

    const second = await turn(conversationId, "Kiếm tiền");
    expect(second.body.data.status).toBe("confirmation");
    expect(second.body.data.action.title).toBe("Tạo phân loại khóa học");
    expect(second.body.data.action.values).toContainEqual({ label: "Tên phân loại khóa học", value: "Kiếm tiền", defaulted: false });
  });
});

describe("SKU price continuation", () => {
  it("keeps the selected product and SKU when the user adds purchase and sale prices", async () => {
    const conversationId = randomUUID();
    const variantUpdate = ASSISTANT_OPERATIONS.find(operation => operation.method === "PATCH" && operation.path === "/inventory/catalog/variants/:id")!;
    const priceUpdate = ASSISTANT_OPERATIONS.find(operation => operation.method === "PUT" && operation.path === "/inventory/catalog/prices/:variantId")!;

    mocks.shortlist = [variantUpdate.id];
    answer(variantUpdate.id, { query_productId: "Cốc sứ tai mèo" });
    const initial = await turn(conversationId, "sửa thông tin SKU của sản phẩm cốc sứ tai mèo");
    expect(initial.body.data.status).toBe("collecting");
    const skuChoice = initial.body.data.referenceSelections.find((selection: any) => selection.key === "path_id").options[0].value;

    const selected = await send("/turns", { conversationId, requestId: randomUUID(), referenceSelections: { path_id: [skuChoice] } });
    expect(selected.body.data.reply).toContain("cập nhật những thông tin nào");
    const pending = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(pending.pending.selectedProductVariant).toEqual({ productId: skuContinuationProductId, variantId: skuContinuationVariantId });
    await AssistantSessionModel.updateOne({ conversationId }, { $unset: { "pending.selectedProductVariant": 1 } });

    mocks.shortlist = [priceUpdate.id];
    answer(priceUpdate.id, { sellingPrice: 50000, costPrice: 10000 });
    const prices = await turn(conversationId, "giá nhập là 10000 giá bán là 50000");
    expect(prices.body.data.status).toBe("confirmation");
    expect(prices.body.data.action.title).toBe("Cập nhật giá nhập và giá bán SKU");
    expect(prices.body.data.action.values).toEqual(expect.arrayContaining([
      { label: "Giá bán", value: 50000, defaulted: false },
      { label: "Giá nhập (giá vốn)", value: 10000, defaulted: false },
    ]));
    expect(prices.body.data.action.values).toContainEqual(expect.objectContaining({ label: "SKU hoặc tên biến thể thuộc sản phẩm đã chọn", value: "Màu trắng — mã SKU-COC-MEO" }));
    expect(JSON.stringify(prices.body.data)).not.toContain(skuContinuationProductId);
    expect(JSON.stringify(prices.body.data)).not.toContain(skuContinuationVariantId);

    const confirmed = await send("/turns", {
      conversationId,
      requestId: randomUUID(),
      decision: { id: prices.body.data.action.id, confirmed: true },
    });
    expect(confirmed.body.data.status).toBe("completed");
    expect(skuPriceWrites).toEqual([{
      variantId: skuContinuationVariantId,
      productId: skuContinuationProductId,
      body: { sellingPrice: 50000, costPrice: 10000 },
    }]);
  }, 30000);
});

describe("class reference prompts", () => {
  it("shows selectable class options for viewing and editing class details", async () => {
    const option = "Lớp học kiếm tiền tỷ — LOPKIEMTIEN1000";
    for (const operationId of ["student.batch.detail", "student.batch.update"]) {
      const operation = ASSISTANT_OPERATIONS.find(item => item.id === operationId)!;
      const result = await missingReferencePrompts(
        {} as any,
        operation,
        defaultWorkflow(operation),
        {},
        operationId === "student.batch.detail" ? "xem thông tin lớp học" : "sửa thông tin lớp học",
        new Set(),
        vi.fn(async () => [option]),
      );

      expect(result.referenceSelections).toContainEqual(expect.objectContaining({
        key: "path_id",
        label: "Tên hoặc mã lớp",
        required: true,
        options: [{ value: option, label: option }],
      }));
      expect(result.prompts[0]).toContain(option);
    }
  });

  it("explains that a missing class must be created before adding a learner", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.batch.learner.add")!;
    const result = await missingReferencePrompts(
      {} as any,
      operation,
      defaultWorkflow(operation),
      {},
      "thêm học viên Sơn vào lớp học kiếm tiền",
      new Set(),
      vi.fn(async () => []),
    );

    expect(result.textPrompts[0]).toContain("M\u00ECnh ch\u01B0a t\u00ECm th\u1EA5y l\u1EDBp theo th\u00F4ng tin b\u1EA1n v\u1EEBa g\u1EEDi");
    expect(result.textPrompts[0]).toContain("một phần tên/mã lớp hoặc tên khóa học");
    expect(result.textPrompts[0]).toContain("nếu lớp chưa được tạo, hãy tạo lớp trước");
  });
});

describe("exam class reference filters", () => {
  it("does not use the exam status as the selected class status filter", async () => {
    mocks.modules = [...mocks.modules, "student"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.exam.create")!;
    const conversationId = randomUUID();
    const originalFetch = globalThis.fetch;
    const batchId = "507f1f77bcf86cd7994390a2";
    const batchRequests: Array<{ search: string; status: string }> = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/api/v1/batches") {
        const search = url.searchParams.get("search") || "";
        const status = url.searchParams.get("status") || "";
        batchRequests.push({ search, status });
        const batch = {
          _id: batchId,
          code: "BATCH-EXAM-001",
          name: "",
          courseTitle: "Lớp đang học",
          status: "Đang học",
        };
        const matched = (!status || status === batch.status)
          && (!search || batch.code.includes(search) || batch.courseTitle.includes(search));
        return new Response(JSON.stringify({ success: true, data: { batches: matched ? [batch] : [] } }), { status: 200 });
      }
      return originalFetch(input, init);
    });
    mocks.shortlist = [operation.id];
    answer(operation.id, {
      name: "Kỳ thi cấp bằng hát dạo",
      status: "Sắp diễn ra",
      tentativeDate: "2026-11-20",
      location: "200, Ngô Tân, Bắc Ninh, Hà Nội",
    });

    try {
      const first = await turn(conversationId, "tạo đợt thi mới");
      expect(first.body.data.status).toBe("collecting");
      const classSelection = first.body.data.referenceSelections.find((selection: any) => selection.key === "batchId");
      expect(classSelection).toMatchObject({ label: "Tên hoặc mã lớp", required: true });
      expect(classSelection.options).toHaveLength(1);

      const selected = await send("/turns", {
        conversationId,
        requestId: randomUUID(),
        referenceSelections: { batchId: [classSelection.options[0].value] },
      });
      expect(selected.body.data.status).toBe("confirmation");
      expect(batchRequests.every(request => request.status === "")).toBe(true);
      const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
      expect(session.pending.resolved.batchId).toBe(batchId);
      expect(session.pending.resolved.status).toBe("Sắp diễn ra");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("batch title update requests", () => {
  it("shows class choices first and asks what to edit after the class is selected", async () => {
    mocks.modules = [...mocks.modules, "student"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "student.batch.update")!;
    const conversationId = randomUUID();
    const originalFetch = globalThis.fetch;
    const batchId = "507f1f77bcf86cd7994390a1";
    const batchSearches: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/api/v1/batches") {
        batchSearches.push(url.searchParams.get("search") || "");
        return new Response(JSON.stringify({ success: true, data: [{
          _id: batchId,
          code: "LOPHOCKIEMTIEN001",
          name: "",
          __v: 0,
          courseTitle: "Lớp học kiếm tiền tỷ",
        }] }), { status: 200 });
      }
      return originalFetch(input, init);
    });
    mocks.shortlist = [operation.id];
    answer(operation.id, { path_id: "LOPHOCKIEMTIEN001", courseId: "lớp học kiếm tiền 101" });

    try {
      const first = await turn(conversationId, "sửa title lớp LOPHOCKIEMTIEN001 thành lớp học kiếm tiền 101");
      expect(first.body.data.status).toBe("collecting");
      const classSelection = first.body.data.referenceSelections.find((selection: any) => selection.key === "path_id");
      expect(classSelection).toMatchObject({ label: "Tên hoặc mã lớp", required: true });
      expect(classSelection.options).toHaveLength(1);

      const selected = await send("/turns", {
        conversationId,
        requestId: randomUUID(),
        referenceSelections: { path_id: [classSelection.options[0].value] },
      });

      expect(selected.body.data.status).toBe("collecting");
      expect(selected.body.data.referenceSelections || []).toEqual([]);
      expect(selected.body.data.reply).toContain("Bạn muốn sửa thông tin nào của lớp đã chọn?");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("nested relationship proposals", () => {
  it("shows the four training categories using their existing display labels", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "training.create")!;
    const result = await missingReferencePrompts(
      { user: { role: "admin" } } as any,
      operation,
      defaultWorkflow(operation),
      {},
      "tạo khóa đào tạo mới",
      new Set(),
    );

    expect(result.referenceSelections).toEqual([expect.objectContaining({
      key: "category",
      label: "Danh mục đào tạo",
      required: true,
      multiple: false,
      options: [
        { value: "Văn hóa", label: "Văn hóa & Quy chế" },
        { value: "Kỹ thuật", label: "Nghiệp vụ kỹ thuật" },
        { value: "Kinh doanh", label: "Kỹ năng bán hàng" },
        { value: "Công nghệ", label: "Công nghệ & Tooling" },
      ],
    })]);
    expect(result.textPrompts).toEqual([]);
  });

  it("shows existing course categories as selectable choices", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/courses")!;
    const values = { code: "LapTringPLC", title: "Lập trình PLC", duration: "30 ngày" };
    const suggest = vi.fn(async () => ["Lập trình", "Tự động hóa", "Tin học"]);

    const result = await missingReferencePrompts(
      { user: { role: "admin" } } as any,
      operation,
      defaultWorkflow(operation),
      values,
      "tạo khóa học mới",
      new Set(),
      suggest as any,
    );

    expect(result.prompts).toEqual([expect.stringContaining("Bạn chọn giúp mình Danh mục khóa học")]);
    expect(result.referenceSelections).toEqual([expect.objectContaining({
      key: "category",
      label: "Danh mục khóa học",
      required: true,
      multiple: false,
      options: [
        { value: "Lập trình", label: "Lập trình" },
        { value: "Tự động hóa", label: "Tự động hóa" },
        { value: "Tin học", label: "Tin học" },
      ],
    })]);
    expect(result.textPrompts).toEqual([]);
    expect(values).toEqual({ code: "LapTringPLC", title: "Lập trình PLC", duration: "30 ngày" });
  });

  it("does not offer creating a course category when no options are available", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/courses")!;
    const result = await missingReferencePrompts(
      { user: { role: "admin" } } as any,
      operation,
      defaultWorkflow(operation),
      { code: "LapTringPLC", title: "Lập trình PLC", duration: "30 ngày" },
      "tạo khóa học mới",
      new Set(),
      async () => [],
    );

    expect(result.textPrompts[0]).toContain("chưa có danh mục khóa học");
    expect(result.textPrompts[0]).not.toContain("tạo danh mục");
    expect(result.referenceSelections).toEqual([]);
  });

  it("asks for the next stock receipt input in clear, conversational language", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.receipt.create")!;
    const productChoice = [{ key: "items[1].productId", label: "Sản phẩm", required: true, multiple: false, options: [{ value: "cốc sứ tai mèo cute", label: "cốc sứ tai mèo cute" }] }];
    const skuChoice = [{ key: "items[1].variantId", label: "SKU", required: true, multiple: false, options: [{ value: "màu trắng", label: "màu trắng" }] }];

    expect(inventoryReceiptFollowUpQuestion(operation, ["items · Mục 1 · quantity", "items · Mục 1 · unitCost"], productChoice, []))
      .toBe("Bạn chọn giúp mình sản phẩm cần nhập trong danh sách bên dưới nhé.");
    expect(inventoryReceiptFollowUpQuestion(operation, ["items · Mục 1 · quantity", "items · Mục 1 · unitCost"], skuChoice, []))
      .toBe("Bạn chọn giúp mình SKU cần nhập trong danh sách bên dưới nhé.");
    expect(inventoryReceiptFollowUpQuestion(operation, ["items · Mục 1 · quantity", "items · Mục 1 · unitCost"], [], []))
      .toBe("Bạn muốn nhập số lượng bao nhiêu và giá nhập của SKU này là bao nhiêu? Ví dụ: số lượng 10, giá nhập 25.000đ.");
  });

  it("proposes selectable records for linked fields across catalog create and update workflows", async () => {
    const operations = ASSISTANT_OPERATIONS.filter(operation => ["POST", "PATCH", "PUT"].includes(operation.method));
    const operationsWithRelationships = operations.filter(operation => operation.fields.some(field => field.reference));
    expect(operationsWithRelationships.length).toBeGreaterThan(0);

    for (const operation of operationsWithRelationships) {
      const linkedFields = operation.fields.filter(field => field.reference);
      const intent = linkedFields.map(field => `${field.key} ${field.apiKey || ""} ${field.label}`).join(" ");
      const result = await missingReferencePrompts(
        {} as any,
        operation,
        { fields: operation.fields } as any,
        {},
        intent,
        new Set(),
        async (_req, _op, field) => [`${field.label} · Lựa chọn kiểm tra`],
      );

      for (const field of linkedFields) {
        expect(result.prompts.some(prompt => prompt.includes(`${field.label}: ${field.label} · Lựa chọn kiểm tra`)), `${operation.id}.${field.key}`)
          .toBe(true);
      }
    }
  });

  it("asks for the record identity before looking up a generic detail request", async () => {
    const detail = ASSISTANT_OPERATIONS.find(operation => operation.id === "student.detail")!;
    const suggest = vi.fn(async () => ["Đỗ Đức Chung"]);
    const result = await missingReferencePrompts(
      {} as any,
      detail,
      defaultWorkflow(detail),
      {},
      "Thông tin học viên",
      new Set(),
      suggest as any,
    );

    expect(result.prompts).toEqual(["Mình cần Tên, số điện thoại hoặc email học viên để tra cứu. Bạn gửi giúp mình nhé."]);
    expect(result.textPrompts).toEqual(result.prompts);
    expect(suggest).not.toHaveBeenCalled();
  });

  it("requires branchless admins to choose a branch before a commission tier when creating or editing", async () => {
    const create = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/partners/commission-levels")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.method === "PATCH" && operation.path === "/partners/commission-levels/:id")!;
    const req = { user: { role: "admin" } } as any;
    const suggest = vi.fn(async (_req: any, _op: any, field: any, _values: any) => field.key === "targetBranch"
      ? ["Chi nhánh Hà Nội — mã HN"]
      : ["Cấp 1 — doanh số tối thiểu 0 VND — hoa hồng 5%"]);

    for (const operation of [create, update]) {
      const first = await missingReferencePrompts(req, operation, { fields: operation.fields } as any, {}, "cập nhật cấp bậc hoa hồng", new Set(), suggest as any);
      expect(first.prompts).toEqual([expect.stringContaining("Chi nhánh áp dụng: Chi nhánh Hà Nội — mã HN")]);
      expect(suggest.mock.calls.at(-1)?.[2].key).toBe("targetBranch");
    }

    suggest.mockClear();
    const afterBranchChoice = await missingReferencePrompts(req, update, { fields: update.fields } as any,
      { targetBranch: "Chi nhánh Hà Nội — mã HN" }, "cập nhật cấp bậc hoa hồng", new Set(), suggest as any);
    expect(afterBranchChoice.prompts).toEqual([expect.stringContaining("Tên hoặc mã cấp bậc hoa hồng: Cấp 1")]);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0][2].key).toBe("path_id");
    expect(suggest.mock.calls[0][3]).toMatchObject({ targetBranch: "Chi nhánh Hà Nội — mã HN" });
  });

  it("offers product choices first, then scopes variant choices to the selected product", async () => {
    const operation: any = {
      id: "nested.create", method: "POST", fields: [{
        key: "items", label: "Danh sách sản phẩm", type: "json", structure: {
          type: "array", items: { type: "object", keys: {
            productId: { type: "string", required: true, reference: "product.list", referenceValueKey: "id", label: "Sản phẩm" },
            variantId: { type: "string", required: true, reference: "product.variants", referenceParentKey: "productId", referenceValueKey: "id", label: "SKU" },
            quantity: { type: "number", required: true },
          } },
        },
      }],
    };
    const workflow: any = { actionId: operation.id, fields: operation.fields };
    const suggest = vi.fn(async (_req: any, _op: any, field: any, values: any) => {
      if (field.reference === "product.list") return ["Áo sơ mi · SP-01"];
      if (field.reference === "product.variants") {
        expect(values.productId).toBe("product-internal-id");
        return ["Trắng · SKU-01"];
      }
      return [];
    });

    const product = await missingReferencePrompts({} as any, operation, workflow,
      { items: JSON.stringify([{ quantity: 2 }]) }, "Tạo phiếu", new Set(), suggest as any);
    expect(product.prompts).toEqual([expect.stringContaining("Sản phẩm: Áo sơ mi · SP-01")]);
    expect(product.prompts.join(" ")).not.toContain("SKU");

    const variant = await missingReferencePrompts({} as any, operation, workflow,
      { items: JSON.stringify([{ productId: "product-internal-id", quantity: 2 }]) }, "Tạo phiếu", new Set(), suggest as any);
    expect(variant.prompts).toEqual([expect.stringContaining("SKU: Trắng · SKU-01")]);
  });

  it("does not treat the generic phrase 'sản phẩm' as a product search term for stock receipts", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "inventory.receipt.create")!;
    const suggest = vi.fn(async (_req: any, _op: any, field: any, _values: any) =>
      field.reference === "product.list" ? ["Cốc sứ tai mèo cute"] : []);
    const workflow: any = { actionId: operation.id, fields: operation.fields };

    const generic = await missingReferencePrompts({} as any, operation, workflow,
      {}, "nhập kho cho sản phẩm", new Set(), suggest as any);
    const productCall = suggest.mock.calls.find(call => call[2].reference === "product.list");
    expect(productCall?.[3]).not.toHaveProperty("__assistantReferenceSearch_items[1].productId");
    expect(generic.referenceSelections).toContainEqual(expect.objectContaining({
      key: "items[1].productId",
      options: [{ value: "Cốc sứ tai mèo cute", label: "Cốc sứ tai mèo cute" }],
    }));

    suggest.mockClear();
    await missingReferencePrompts({} as any, operation, workflow,
      {}, "nhập kho cho sản phẩm cốc sứ tai mèo cute", new Set(), suggest as any);
    const namedProductCall = suggest.mock.calls.find(call => call[2].reference === "product.list");
    expect(namedProductCall?.[3]).toMatchObject({
      "__assistantReferenceSearch_items[1].productId": "cốc sứ tai mèo cute",
    });
  });

  it("uses a selected path record to suggest linked records inside nested create rows", async () => {
    const batchId = "507f1f77bcf86cd799439011";
    const operation: any = {
      id: "attendance.bulk.create", method: "POST", fields: [
        { key: "path_id", apiKey: "id", source: "path", label: "Lớp", type: "reference", reference: "batch.list" },
        {
          key: "records", label: "Danh sách điểm danh", type: "json", structure: {
            type: "array", items: { type: "object", keys: {
              studentId: { type: "string", required: true, reference: "batch.attendance.learners", referenceParentKey: "path_id", referenceValueKey: "id", label: "Học viên" },
              status: { type: "string", required: true, options: ["present", "absent", "excused", "late"] },
            } },
          },
        },
      ],
    };
    const suggest = vi.fn(async (_req: any, _op: any, field: any, values: any) => {
      if (field.reference === "batch.attendance.learners") {
        expect(values.path_id).toBe(batchId);
        return ["Nguyễn An · 0912345678"];
      }
      return [];
    });

    const result = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      { path_id: batchId, records: JSON.stringify([{ status: "present" }]) }, "điểm danh lớp", new Set(), suggest as any);
    expect(result.prompts).toEqual([expect.stringContaining("Học viên: Nguyễn An · 0912345678")]);
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it("suggests an optional coupon without a customer and scopes choices after a customer is selected", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.order.checkout")!;
    const suggest = vi.fn(async (_req: any, _op: any, field: any, values: any) => {
      if (field.reference === "retail.coupon.assistant-options.list") {
        return values.customerId ? ["Ưu đãi sinh nhật — SN2026"] : ["Ưu đãi toàn chi nhánh — ALL10"];
      }
      return [];
    });
    const workflow = { fields: operation.fields } as any;

    const general = await missingReferencePrompts({} as any, operation, workflow,
      { input: JSON.stringify({ items: [] }) }, "Tạo đơn bán lẻ", new Set(), suggest as any);
    expect(general.prompts).toEqual([expect.stringContaining("Ưu đãi toàn chi nhánh — ALL10")]);
    expect(general.awaitingOptional).toContain("input.couponCode");

    const customer = await missingReferencePrompts({} as any, operation, workflow,
      { input: JSON.stringify({ items: [], customerId: "customer-internal-id" }) }, "Tạo đơn bán lẻ", new Set(), suggest as any);
    expect(customer.prompts).toEqual([expect.stringContaining("Ưu đãi sinh nhật — SN2026")]);
    expect(suggest.mock.calls.at(-1)?.[3]).toMatchObject({ customerId: "customer-internal-id" });
  });

  it("asks for a coupon audience first and only asks for a customer in customer-specific mode", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.coupon.create")!;
    const workflow = defaultWorkflow(operation);
    const suggest = vi.fn(async (_req: any, _op: any, field: any) =>
      field.reference === "customer.list" ? ["Nguyễn An · KH-001"] : []);

    const audience = await missingReferencePrompts({} as any, operation, workflow, {}, "Tạo mã ưu đãi", new Set(), suggest as any);
    expect(audience.referenceSelections).toContainEqual(expect.objectContaining({
      key: "targetType",
      required: true,
      options: [
        { value: "all_customers", label: "Tất cả khách hàng" },
        { value: "specific_customer", label: "Một khách hàng cụ thể" },
      ],
    }));
    expect(audience.referenceSelections.some(group => group.key === "customerId")).toBe(false);

    const allCustomers = await missingReferencePrompts({} as any, operation, workflow,
      { targetType: "all_customers" }, "Tạo mã ưu đãi", new Set(), suggest as any);
    expect(allCustomers.referenceSelections.some(group => group.key === "customerId")).toBe(false);
    expect(suggest.mock.calls.some(([, , field]) => field.apiKey === "customerId")).toBe(false);

    const specificCustomer = await missingReferencePrompts({} as any, operation, workflow,
      { targetType: "specific_customer" }, "Tạo mã ưu đãi", new Set(), suggest as any);
    expect(specificCustomer.referenceSelections).toContainEqual(expect.objectContaining({
      key: "customerId",
      required: true,
      options: [{ value: "Nguyễn An · KH-001", label: "Nguyễn An · KH-001" }],
    }));
  });

  it("reopens static choices when an interpreted enum value is invalid", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "retail.coupon.create")!;
    const result = await missingReferencePrompts({} as any, operation, defaultWorkflow(operation),
      { targetType: "all users" }, "Tạo mã ưu đãi", new Set(), async () => []);

    expect(result.referenceSelections).toContainEqual(expect.objectContaining({
      key: "targetType",
      options: [
        { value: "all_customers", label: "Tất cả khách hàng" },
        { value: "specific_customer", label: "Một khách hàng cụ thể" },
      ],
    }));
    expect(result.optionSelectionKeys.has("targetType")).toBe(true);
  });

  it("offers nested enum choices when a provided value is outside the allowed list", async () => {
    const operation: any = {
      id: "nested.enum.create", method: "POST", path: "/nested", fields: [{
        key: "input", label: "Thông tin", type: "json", structure: {
          type: "object", keys: { status: { type: "string", required: true, options: ["active", "inactive"], label: "Trạng thái" } },
        },
      }],
    };
    const result = await missingReferencePrompts({} as any, operation, { actionId: operation.id, fields: operation.fields } as any,
      { input: JSON.stringify({ status: "enabled" }) }, "Tạo bản ghi", new Set(), async () => []);

    expect(result.referenceSelections).toContainEqual(expect.objectContaining({
      key: "input.status",
      label: "Thông tin · Trạng thái",
      options: [{ value: "active", label: "active" }, { value: "inactive", label: "inactive" }],
    }));
    expect(result.optionSelectionKeys.has("input.status")).toBe(true);
  });

  it("turns unresolved top-level and nested references into filtered choices", async () => {
    const topLevel: any = {
      id: "reference.create", method: "POST", path: "/reference", fields: [
        { key: "department", label: "Phòng ban", type: "reference", reference: "department.list", systemRequired: true },
      ],
    };
    const suggestTopLevel = vi.fn(async (_req: any, _op: any, _field: any, values: any) => {
      expect(values.__assistantReferenceSearch_department).toBe("Phong ke toan");
      return ["Phòng Kế toán · KT"];
    });
    const topResult = await missingReferencePrompts({} as any, topLevel, { actionId: topLevel.id, fields: topLevel.fields } as any,
      { department: "Phong ke toan" }, "Tạo nhân sự", new Set(), suggestTopLevel as any, new Set(["department"]));
    expect(topResult.referenceSelections).toContainEqual(expect.objectContaining({
      key: "department", options: [{ value: "Phòng Kế toán · KT", label: "Phòng Kế toán · KT" }],
    }));

    const nested: any = {
      id: "nested.reference.create", method: "POST", path: "/nested", fields: [{
        key: "items", label: "Danh sách", type: "json", structure: {
          type: "array", items: { type: "object", keys: {
            productId: { type: "string", required: true, reference: "product.list", label: "Sản phẩm" },
          } },
        },
      }],
    };
    const suggestNested = vi.fn(async (_req: any, _op: any, field: any, values: any) => {
      expect(field.key).toBe("items[1].productId");
      expect(values["__assistantReferenceSearch_items[1].productId"]).toBe("coc su tai meo");
      return ["Cốc sứ tai mèo cute"];
    });
    const nestedResult = await missingReferencePrompts({} as any, nested, { actionId: nested.id, fields: nested.fields } as any,
      { items: JSON.stringify([{ productId: "coc su tai meo" }]) }, "Nhập kho", new Set(), suggestNested as any,
      new Set(["items[1].productId"]));
    expect(nestedResult.referenceSelections).toContainEqual(expect.objectContaining({
      key: "items[1].productId", options: [{ value: "Cốc sứ tai mèo cute", label: "Cốc sứ tai mèo cute" }],
    }));
  });

  it("lets a user explicitly skip a suggested optional nested relationship", async () => {
    const operation: any = {
      id: "nested.create", method: "POST", fields: [{
        key: "input", label: "Thông tin đơn hàng", type: "json", structure: {
          type: "object", keys: { customerId: { type: "string", reference: "customer.list", label: "Khách hàng" } },
        },
      }],
    };
    const proposed = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      { input: "{}" }, "Tạo đơn", new Set(), async () => ["Nguyễn An · 0900000000"]);
    expect(proposed.awaitingOptional).toEqual(["input.customerId"]);
    expect(skippedReferenceTargets("Bỏ qua khách hàng", operation, proposed.awaitingOptional, proposed.awaitingLabels)).toEqual(["input.customerId"]);
  });

  it("offers selectable names for optional arrays of linked records on create and when asked to edit", async () => {
    const operation: any = {
      id: "project.create", method: "POST", fields: [{
        key: "workerIds", label: "Danh sách lao động", type: "json", structure: {
          type: "array", items: { type: "string", reference: "worker.list", referenceValueKey: "id", label: "Tên lao động" },
        },
      }],
    };
    const suggest = async (_req: any, _op: any, field: any) => field.reference === "worker.list" ? ["Nguyễn An · chính thức", "Lê Bình · thời vụ"] : [];
    const create = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      {}, "Tạo dự án", new Set(), suggest as any);
    expect(create.prompts).toEqual([expect.stringContaining("chọn một hoặc nhiều tên")]);
    expect(create.prompts[0]).toContain("Nguyễn An · chính thức");
    expect(create.awaitingOptional).toEqual(["workerIds"]);

    const updateOperation = { ...operation, id: "project.update", method: "PATCH" };
    const update = await missingReferencePrompts({} as any, updateOperation, { fields: operation.fields } as any,
      { workerIds: "[]" }, "Thêm lao động vào dự án", new Set(), suggest as any);
    expect(update.prompts).toHaveLength(1);
  });

  it("suggests employee departments and product categories by name on create and link changes", async () => {
    const employeeCreate = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.create")!;
    const employeeUpdate = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.update")!;
    const productCreate = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/inventory/catalog/products")!;
    const productUpdate = ASSISTANT_OPERATIONS.find(operation => operation.method === "PATCH" && operation.path === "/inventory/catalog/products/:id")!;
    const suggest = async (_req: any, _op: any, field: any) => field.reference === "department.list"
      ? ["Ph\u00F2ng K\u1EBF to\u00E1n (KT)"]
      : field.reference === "inventory.catalog.resource.list" && field.referenceContext?.path_kind === "categories"
        ? ["\u0110i\u1EC7n tho\u1EA1i (CAT-01)"]
        : [];

    const newEmployee = await missingReferencePrompts({} as any, employeeCreate, defaultWorkflow(employeeCreate),
      {}, "Tao nhan su Do Duc Chung", new Set(), suggest as any);
    expect(newEmployee.prompts.join("\n")).toContain("Ph\u00F2ng ban: Ph\u00F2ng K\u1EBF to\u00E1n (KT)");

    const newProduct = await missingReferencePrompts({} as any, productCreate, defaultWorkflow(productCreate),
      {}, "Tao san pham dien thoai", new Set(), suggest as any);
    expect(newProduct.prompts.join("\n")).toContain("T\u00EAn ho\u1EB7c m\u00E3 danh m\u1EE5c: \u0110i\u1EC7n tho\u1EA1i (CAT-01)");

    const changeEmployee = await missingReferencePrompts({} as any, employeeUpdate, defaultWorkflow(employeeUpdate),
      { path_id: "Do Duc Chung" }, "Chuyen nhan su sang phong ban khac", new Set(), suggest as any);
    expect(changeEmployee.prompts.join("\n")).toContain("Ph\u00F2ng ban: Ph\u00F2ng K\u1EBF to\u00E1n (KT)");

    const changeProduct = await missingReferencePrompts({} as any, productUpdate, defaultWorkflow(productUpdate),
      { path_id: "Laptop A" }, "Doi danh muc san pham", new Set(), suggest as any);
    expect(changeProduct.prompts.join("\n")).toContain("T\u00EAn ho\u1EB7c m\u00E3 danh m\u1EE5c: \u0110i\u1EC7n tho\u1EA1i (CAT-01)");
  });

  it("suggests an optional nested relationship when an update asks to change it", async () => {
    const operation: any = {
      id: "nested.update", method: "PATCH", fields: [{
        key: "input", label: "Thông tin sản phẩm", type: "json", structure: {
          type: "object", keys: { categoryCode: { type: "string", reference: "category.list", label: "Danh mục sản phẩm" } },
        },
      }],
    };
    const proposed = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      { input: "{}" }, "Chuyển sản phẩm sang danh mục khác", new Set(), async () => ["Điện thoại · CAT-01"]);
    expect(proposed.prompts).toEqual([expect.stringContaining("Danh mục sản phẩm: Điện thoại · CAT-01")]);

    const unavailable = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      { input: "{}" }, "Chuyển sản phẩm sang danh mục khác", new Set(), async () => []);
    expect(unavailable.prompts).toEqual([expect.stringContaining("chưa tìm thấy lựa chọn khả dụng cho Thông tin sản phẩm · Danh mục sản phẩm")]);
    expect(unavailable.awaitingOptional).toEqual([]);
  });

  it("proposes linked choices inside an unfilled object on create and when explicitly changed on update", async () => {
    const create: any = {
      id: "nested.employee.create", method: "POST", fields: [{
        key: "details", label: "Thông tin nhân sự", type: "json", structure: {
          type: "object", keys: {
            department: { type: "string", reference: "department.list", label: "Phòng ban" },
          },
        },
      }],
    };
    const update = { ...create, id: "nested.employee.update", method: "PATCH" };
    const suggest = vi.fn(async () => ["Phòng Kế toán · KT"]);

    const createPrompt = await missingReferencePrompts({} as any, create, { fields: create.fields } as any,
      {}, "Tạo hồ sơ nhân sự", new Set(), suggest as any);
    expect(createPrompt.prompts).toEqual([expect.stringContaining("Thông tin nhân sự · Phòng ban: Phòng Kế toán · KT")]);

    const unchanged = await missingReferencePrompts({} as any, update, { fields: update.fields } as any,
      {}, "Cập nhật hồ sơ nhân sự", new Set(), suggest as any);
    expect(unchanged.prompts).toEqual([]);

    const changed = await missingReferencePrompts({} as any, update, { fields: update.fields } as any,
      {}, "Chuyển nhân sự sang phòng ban khác", new Set(), suggest as any);
    expect(changed.prompts).toEqual([expect.stringContaining("Thông tin nhân sự · Phòng ban: Phòng Kế toán · KT")]);
  });

  it("does not silently omit an explicitly requested optional relationship when no choices are available", async () => {
    const operation: any = {
      id: "employee.update", method: "PATCH", fields: [
        { key: "path_id", label: "Nhân sự", type: "reference", reference: "employee.list" },
        { key: "departmentId", label: "Phòng ban", type: "reference", reference: "department.list" },
      ],
    };
    const result = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      { path_id: "Đỗ Đức Chung" }, "Chuyển Đỗ Đức Chung sang phòng ban khác", new Set(), async () => []);
    expect(result.prompts).toEqual([expect.stringContaining("chưa tìm thấy lựa chọn khả dụng cho Phòng ban")]);
    expect(result.awaitingOptional).toEqual([]);

    const create = { ...operation, id: "employee.create", method: "POST", fields: [operation.fields[1]] };
    const requestedOnCreate = await missingReferencePrompts({} as any, create, { fields: create.fields } as any,
      {}, "Tạo nhân sự Đỗ Đức Chung thuộc phòng ban Kế toán", new Set(), async () => []);
    expect(requestedOnCreate.prompts).toEqual([expect.stringContaining("chưa tìm thấy lựa chọn khả dụng cho Phòng ban")]);
  });


  it("requires a payable choice only for supplier payment vouchers", async () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "finance.voucher.create")!;
    const workflow = defaultWorkflow(operation);
    const suggest = async () => ["Công ty ABC — mã GN-01"];
    const supplierPayment = await missingReferencePrompts({} as any, operation, workflow as any,
      { category: "supplier" }, "Tạo phiếu chi nhà cung cấp", new Set(), suggest as any);
    expect(supplierPayment.prompts.join(" ")).toContain("Khoản phải trả nhà cung cấp: Công ty ABC");

    const otherPayment = await missingReferencePrompts({} as any, operation, workflow as any,
      { category: "rent" }, "Tạo phiếu chi tiền thuê", new Set(), async () => []);
    expect(otherPayment.prompts.some(prompt => prompt.includes("Khoản phải trả nhà cung cấp"))).toBe(false);
  });

  it("offers campaign and marketing-content names when creating or changing video-caption links", async () => {
    const create = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.video-caption.project.create")!;
    const update = ASSISTANT_OPERATIONS.find(operation => operation.id === "marketing.video-caption.project.update")!;
    const suggest = async (_req: any, _op: any, field: any) => [`${field.reference === "marketing.campaign.list" ? "Chiến dịch Tết" : "Bài ra mắt"} · lựa chọn`];

    const createOptions = await missingReferencePrompts({} as any, create, { fields: create.fields } as any,
      { contextLinks: "{}" }, "Tạo dự án và liên kết bài viết", new Set(), suggest as any);
    expect(createOptions.prompts).toEqual(expect.arrayContaining([
      expect.stringContaining("Nội dung marketing liên quan: Bài ra mắt · lựa chọn"),
      expect.stringContaining("Chiến dịch liên quan: Chiến dịch Tết · lựa chọn"),
    ]));

    const updateOptions = await missingReferencePrompts({} as any, update, { fields: update.fields } as any,
      { contextLinks: "{}" }, "Đổi chiến dịch liên quan", new Set(), suggest as any);
    expect(updateOptions.prompts.some(prompt => prompt.includes("Chiến dịch liên quan: Chiến dịch Tết · lựa chọn"))).toBe(true);
    expect(updateOptions.prompts.some(prompt => prompt.includes("Nội dung marketing liên quan:"))).toBe(false);
  });

  it("suggests named target records when an update has not selected the record yet", async () => {
    const operation: any = {
      id: "named.update", method: "PATCH", fields: [{
        key: "path_id", label: "Chiến dịch cần cập nhật", type: "reference", reference: "campaign.list",
        source: "path", apiKey: "id", systemRequired: true, required: true,
      }],
    };
    const proposed = await missingReferencePrompts({} as any, operation, { fields: operation.fields } as any,
      {}, "Tắt chiến dịch", new Set(), async () => ["Tết 2026 · 2026-12-01"]);
    expect(proposed.prompts).toEqual([expect.stringContaining("Chiến dịch cần cập nhật: Tết 2026 · 2026-12-01")]);
  });
});

describe("assistant workflow execution", () => {
  it("defaults a training instructor to the creator and collects lessons and quiz questions without showing JSON", async () => {
    const conversationId = randomUUID();
    answer("training.create", { title: "Lập trình PLC", category: "Văn hóa", duration: "30 ngày" });
    const first = (await turn(conversationId, "Tạo khóa đào tạo mới")).body.data;

    expect(first.status).toBe("collecting");
    expect(first.trainingContentForm).toEqual({ lessons: [], quizzes: [] });
    expect(first.reply).toContain("Bạn muốn gắn bài giảng nào?");
    expect(first.reply).toContain("Bạn muốn thêm câu hỏi trắc nghiệm nào?");
    expect(first.reply).not.toMatch(/workflow|mặc định|admin@example.test/i);
    expect(first.action.values.some((item: any) => item.label === "Giảng viên")).toBe(false);
    expect((await AssistantSessionModel.findOne({ conversationId }).lean() as any).pending.defaultedKeys).toContain("instructor");
    expect(JSON.stringify(first.action)).not.toContain("undefined");

    answer("training.create", {});
    const skipped = (await turn(conversationId, "Bỏ qua cả hai")).body.data;
    expect(skipped.status).toBe("confirmation");
    expect(skipped.action.values).toContainEqual({ label: "Danh sách bài giảng (nếu chưa có, nói bỏ qua)", value: "Chưa thêm bài giảng", defaulted: false });
    expect(skipped.action.values).toContainEqual({ label: "Câu hỏi trắc nghiệm (nếu chưa có, nói bỏ qua)", value: "Chưa thêm câu hỏi trắc nghiệm", defaulted: false });
    expect(JSON.stringify(skipped.action)).not.toContain("[]");
  });

  it("accepts lesson and quiz form data and routes it into the normal confirmation preview", async () => {
    const conversationId = randomUUID();
    answer("training.create", { title: "Lập trình PLC", category: "Văn hóa", duration: "30 ngày" });
    const first = (await turn(conversationId, "Tạo khóa đào tạo mới")).body.data;
    expect(first.trainingContentForm).toEqual({ lessons: [], quizzes: [] });

    const response = await send("/turns", {
      conversationId,
      requestId: randomUUID(),
      trainingContent: {
        lessons: [{ title: "Giới thiệu PLC", type: "video", url: "https://example.test/plc" }],
        quizzes: [{ question: "PLC dùng để làm gì?", options: ["Điều khiển tự động", "Thiết kế đồ họa"], correctOptionIndex: 0 }],
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("confirmation");
    expect(response.body.data.action.values).toContainEqual({ label: "Danh sách bài giảng (nếu chưa có, nói bỏ qua)", value: "1 bài giảng", defaulted: false });
    expect(response.body.data.action.values).toContainEqual({ label: "Câu hỏi trắc nghiệm (nếu chưa có, nói bỏ qua)", value: "1 câu trắc nghiệm", defaulted: false });
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(JSON.parse(session.pending.provided.lessons)).toEqual([{ title: "Giới thiệu PLC", type: "video", url: "https://example.test/plc" }]);
    expect(JSON.parse(session.pending.provided.quizzes)).toEqual([{ question: "PLC dùng để làm gì?", options: ["Điều khiển tự động", "Thiết kế đồ họa"], correctOptionIndex: 0 }]);
  });

  it("preserves training content and category while collecting title and duration over later turns", async () => {
    const conversationId = randomUUID();
    answer("training.create", {});
    const first = (await turn(conversationId, "Tạo khóa đào tạo")).body.data;
    expect(first.status).toBe("collecting");
    expect(first.trainingContentForm).toEqual({ lessons: [], quizzes: [] });
    expect(first.referenceSelections?.[0]).toMatchObject({ key: "category", label: "Danh mục đào tạo" });

    const content = await send("/turns", {
      conversationId,
      requestId: randomUUID(),
      trainingContent: {
        lessons: [
          { title: "Giới thiệu", type: "text", content: "Giới thiệu khóa học." },
          { title: "Thực hành", type: "video", url: "https://example.test/thuc-hanh" },
        ],
        quizzes: [
          { question: "Câu hỏi 1?", options: ["Đúng", "Sai"], correctOptionIndex: 0 },
          { question: "Câu hỏi 2?", options: ["Sai", "Đúng"], correctOptionIndex: 1 },
        ],
      },
    });
    expect(content.body.data.status).toBe("collecting");
    expect(content.body.data.reply).toContain("Tên khóa học, Thời lượng");
    expect(content.body.data.referenceSelections?.[0]).toMatchObject({ key: "category", label: "Danh mục đào tạo" });

    const category = await send("/turns", {
      conversationId,
      requestId: randomUUID(),
      referenceSelections: { category: ["Văn hóa"] },
    });
    expect(category.body.data.status).toBe("collecting");
    expect(category.body.data.reply).toContain("Tên khóa học, Thời lượng");

    const completedDraft = (await turn(conversationId, "khóa học làm hát, 30 ngày")).body.data;
    expect(completedDraft.status).toBe("confirmation");
    expect(completedDraft.action.values).toEqual(expect.arrayContaining([
      { label: "Tên khóa học", value: "làm hát", defaulted: false },
      { label: "Danh mục đào tạo", value: "Văn hóa & Quy chế", defaulted: false },
      { label: "Thời lượng", value: "30 ngày", defaulted: false },
      { label: "Danh sách bài giảng (nếu chưa có, nói bỏ qua)", value: "2 bài giảng", defaulted: false },
      { label: "Câu hỏi trắc nghiệm (nếu chưa có, nói bỏ qua)", value: "2 câu trắc nghiệm", defaulted: false },
    ]));
    expect(completedDraft.action.values.some((item: any) => item.label === "Giảng viên")).toBe(false);
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.pending.provided.title).toBe("làm hát");
  });

  it("shows exact retry target and message before queueing a failed debt reminder email", async () => {
    mocks.modules = ["retail", "chat"];
    answer("retail.debt-reminders.delivery.retry", { path_id: "Nguyễn An" });
    const conversationId = randomUUID();
    const preview = (await turn(conversationId, "Thử lại email nhắc nợ cho Nguyễn An")).body.data;

    expect(preview.status, preview.reply).toBe("confirmation");
    expect(preview.action.values).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Địa chỉ email nhận", value: "customer@example.com" }),
      expect.objectContaining({ label: "Đơn hàng", value: "SO-001" }),
      expect.objectContaining({ label: "Tiêu đề thư", value: reminderContent.subject }),
      expect.objectContaining({ label: "Nội dung thư", value: reminderContent.text }),
      expect.objectContaining({ label: "Lượt gửi đã thực hiện", value: "1" }),
      expect.objectContaining({ label: "Số lượt tối đa", value: "3" }),
    ]));
    expect(JSON.stringify(preview.action)).not.toContain(reminderDeliveryId);
    expect(reminderRetryIds).toEqual([]);

    const result = await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } });
    expect(result.body.data.status).toBe("completed");
    expect(reminderRetryIds).toEqual([reminderDeliveryId]);
  });

  it("refuses to retry a debt reminder when the recipient content changes after preview", async () => {
    mocks.modules = ["retail", "chat"];
    answer("retail.debt-reminders.delivery.retry", { path_id: "Nguyễn An" });
    const conversationId = randomUUID();
    const preview = (await turn(conversationId, "Thử lại email nhắc nợ cho Nguyễn An")).body.data;
    expect(preview.status, preview.reply).toBe("confirmation");

    reminderContent = { subject: "Tiêu đề đã thay đổi", text: "Nội dung đã thay đổi" };
    const result = await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } });
    expect(result.body.data.status).toBe("failed");
    expect(result.body.data.reply).toContain("đã thay đổi kể từ bản xem trước");
    expect(reminderRetryIds).toEqual([]);
  });

  it("seeds personal workflows, asks missing fields and creates an employee with salary zero through the real API", async () => {
    await HrDepartmentModel.create({ companyCode: "TEST", name: "Kỹ thuật", normalizedName: "ky thuat", code: "KT", isActive: true });
    await HrDepartmentModel.create({ companyCode: "TEST", name: "Ngừng hoạt động", normalizedName: "ngung hoat dong", code: "OLD", isActive: false });
    const conv = randomUUID(); answer("employee.create", { displayName: "Đỗ Đức Chung" });
    const first = await turn(conv, "Thêm nhân sự Đỗ Đức Chung");
    expect(first.body.data.status).toBe("collecting"); expect(first.body.data.reply).toContain("Ngày sinh"); expect(first.body.data.reply).toContain("Kỹ thuật"); expect(first.body.data.reply).not.toContain("Ngừng hoạt động"); expect(await UserModel.countDocuments()).toBe(0);
    answer("employee.create", { birthDate: "1994-03-12", email: "chung@example.test" });
    const second = await turn(conv, "Sinh 12/03/1994, email chung@example.test");
    expect(second.body.data.status).toBe("collecting"); expect(second.body.data.reply).toContain("Kỹ thuật"); expect(await UserModel.countDocuments()).toBe(0);
    answer("employee.create", { department: "Kỹ thuật" });
    const third = await turn(conv, "Phòng ban Kỹ thuật");
    expect(third.body.data.status, third.body.data.reply).toBe("confirmation"); expect(JSON.stringify(third.body.data.action)).toContain("Kỹ thuật"); expect(JSON.stringify(third.body.data.action)).not.toContain("507f1f77bcf86cd799439");
    const recovered = await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: third.body.data.action.id, confirmed: true } });
    expect(recovered.body.data.status).toBe("confirmation");
    expect(await UserModel.countDocuments()).toBe(0);
    const completed = await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: third.body.data.action.id, confirmed: true, password: "Test-only-password" } });
    expect(completed.body.data.status).toBe("completed");
    expect(JSON.stringify(await AssistantTurnModel.find({}).lean())).not.toContain("Test-only-password");
    expect(JSON.stringify(await AssistantSessionModel.find({}).lean())).not.toContain("Test-only-password");
    const employee = await UserModel.findOne({ email: "chung@example.test" }).lean();
    expect(employee).toMatchObject({ displayName: "Đỗ Đức Chung", department: "Kỹ thuật", monthlySalary: 0, role: "user", companyCode: "TEST", branchId: mocks.actor.branchId });
    expect(employee?.password).toBeTruthy(); expect(JSON.stringify(third.body)).not.toContain(employee!.password!);
    expect(await AssistantWorkflowModel.countDocuments({ userId: mocks.actor.id })).toBeGreaterThan(20);
  });
  it("finds and formats a detailed employee profile by name without exposing salary", async () => {
    await UserModel.create({
      displayName: "Nguyễn Văn Cường",
      email: "cuong@example.test",
      birthDate: new Date("1992-04-18T00:00:00.000Z"),
      phone: "0901234567",
      department: "Nhân sự",
      division: "HR",
      qualification: "Đại học",
      monthlySalary: 23456789,
      role: "user",
      companyCode: "TEST",
      branchId: mocks.actor.branchId,
    });

    const listedWorkflows = await send("/workflows");
    expect(listedWorkflows.body.data.some((workflow: any) => workflow.actionId === "employee.detail")).toBe(true);
    const result = await turn(randomUUID(), "thong tin chi tiết nhân sự Cường");

    expect(result.body.data.status, result.body.data.reply).toBe("completed");
    expect(result.body.data.reply).toContain("hồ sơ của Nguyễn Văn Cường");
    expect(result.body.data.reply).toContain("cuong@example.test");
    expect(result.body.data.reply).toContain("0901234567");
    expect(result.body.data.reply).toContain("Nhân sự");
    expect(result.body.data.reply).toContain("Đại học");
    expect(result.body.data.reply).not.toContain("23456789");
    expect(result.body.data.reply).not.toContain("{");
  });

  it("keeps the detail lookup open when a partial name matches multiple employees", async () => {
    await UserModel.create([
      { displayName: "Nguyễn Văn Cường", email: "nguyen.cuong@example.test", department: "Kế toán", role: "user", companyCode: "TEST", branchId: mocks.actor.branchId },
      { displayName: "Trần Văn Cường", email: "tran.cuong@example.test", department: "Kinh doanh", role: "user", companyCode: "TEST", branchId: mocks.actor.branchId },
    ]);
    const conversationId = randomUUID();
    const choices = await turn(conversationId, "Thông tin chi tiết nhân sự Cường");

    expect(choices.body.data.status).toBe("collecting");
    expect(choices.body.data.reply).toContain("Nguyễn Văn Cường");
    expect(choices.body.data.reply).toContain("Trần Văn Cường");
    expect(choices.body.data.reply).toContain("phòng ban");

    answer("employee.detail", { search: "Nguyễn Văn Cường" });
    const selected = await turn(conversationId, "Nguyễn Văn Cường");
    expect(selected.body.data.status, selected.body.data.reply).toBe("completed");
    expect(selected.body.data.reply).toContain("nguyen.cuong@example.test");
    expect(selected.body.data.reply).not.toContain("tran.cuong@example.test");
  });

  it("asks for the employee name before looking up a detail profile and accepts the follow-up", async () => {
    await UserModel.create({ displayName: "Cường", email: "cuong@example.test", role: "user", companyCode: "TEST", branchId: mocks.actor.branchId });
    const conversationId = randomUUID();
    const question = await turn(conversationId, "Thông tin chi tiết nhân sự");
    expect(question.body.data.status).toBe("collecting");
    expect(question.body.data.reply).toContain("Tên, email hoặc số điện thoại nhân sự cần xem");

    answer("employee.detail", { search: "Cường" });
    const result = await turn(conversationId, "Cường");
    expect(result.body.data.status, result.body.data.reply).toBe("completed");
    expect(result.body.data.reply).toContain("cuong@example.test");
  });
  it("lets users skip an optional relationship proposal explicitly", async () => {
    await HrDepartmentModel.create({ companyCode: "TEST", name: "Kỹ thuật", normalizedName: "ky thuat", code: "KT", isActive: true });
    const conv = randomUUID(); answer("employee.create", { displayName: "An", email: "an@example.test", birthDate: "1994-03-12" });
    const proposed = (await turn(conv, "Tạo nhân sự An")).body.data;
    expect(proposed.status).toBe("collecting"); expect(proposed.reply).toContain("Kỹ thuật");
    answer("employee.create", {});
    const skipped = (await turn(conv, "Bỏ qua phòng ban")).body.data;
    expect(skipped.status).toBe("confirmation"); expect(JSON.stringify(skipped.action)).not.toContain("Kỹ thuật");
    expect(await UserModel.countDocuments()).toBe(0);
  });
  it("does not expose a saved default for a linked workflow field", async () => {
    const listed = await send("/workflows");
    const workflow = listed.body.data.find((item: any) => item.actionId === "employee.create");
    const config = { ...workflow, fields: workflow.fields.map((field: any) => field.key === "department" ? { ...field, defaultValue: "Kỹ thuật" } : field) };
    await AssistantWorkflowModel.updateOne({ userId: mocks.actor.id, companyCode: "TEST", actionId: "employee.create" }, { $set: { config } });
    const reloaded = (await send("/workflows")).body.data.find((item: any) => item.actionId === "employee.create");
    expect(reloaded.fields.find((field: any) => field.key === "department").defaultValue).toBeUndefined();
  });
  it("proposes department choices when an employee update asks to change departments", async () => {
    await HrDepartmentModel.create({ companyCode: "TEST", name: "Kỹ thuật", normalizedName: "ky thuat", code: "KT", isActive: true });
    await UserModel.create({ displayName: "Nguyễn An", email: "an@example.test", role: "user", companyCode: "TEST", branchId: mocks.actor.branchId, department: "Kinh doanh" });
    const conv = randomUUID(); answer("employee.update", { id: "Nguyễn An" });
    const options = (await turn(conv, "Chuyển nhân sự Nguyễn An sang phòng ban khác")).body.data;
    expect(options.status).toBe("collecting"); expect(options.reply).toContain("Kỹ thuật"); expect(await UserModel.findOne({ email: "an@example.test" }).lean()).toMatchObject({ department: "Kinh doanh" });
    answer("employee.update", { department: "Kỹ thuật" });
    const preview = (await turn(conv, "Chọn phòng ban Kỹ thuật")).body.data;
    expect(preview.status).toBe("confirmation"); expect(JSON.stringify(preview.action)).toContain("Kỹ thuật");
    expect(await UserModel.findOne({ email: "an@example.test" }).lean()).toMatchObject({ department: "Kinh doanh" });
    const result = await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } });
    expect(result.body.data.status).toBe("completed");
    expect(await UserModel.findOne({ email: "an@example.test" }).lean()).toMatchObject({ department: "Kỹ thuật" });
  });
  it("uses edited salary defaults and isolates workflows by user and tenant", async () => {
    const listed = await send("/workflows"); const workflow = listed.body.data.find((w: any) => w.actionId === "employee.create");
    const update = configPayload(workflow); update.fields.find((f: any) => f.key === "monthlySalary").defaultValue = 8000000;
    expect((await send("/workflows/employee.create", update, "PATCH")).status).toBe(200);
    expect((await send("/workflows/employee.create", update, "PATCH")).status).toBe(409);
    answer("employee.create", { displayName: "Chung", email: "chung@example.test", birthDate: "1994-03-12" }); const conv = randomUUID(); const preview = (await turn(conv, "Tạo nhân sự Chung")).body.data;
    await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true, password: "Test-only-password" } });
    expect((await UserModel.findOne({ email: "chung@example.test" }).lean())?.monthlySalary).toBe(8000000);
    mocks.actor.id = "507f1f77bcf86cd799439013";
    const other = (await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create"); expect(other.fields.find((f: any) => f.key === "monthlySalary").defaultValue).toBe(0);
    mocks.actor.companyCode = "OTHER";
    expect((await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create").version).toBe(0);
  });
  it("shows annual leave balance for the signed-in user and rejects another employee ID", async () => {
    mocks.modules = ["hr"];
    mocks.permissions = new Set(["chat:read", "hr:read"]);
    const operation = ASSISTANT_OPERATIONS.find(item => item.id === "leave.balance.me")!;
    answer(operation.id, {});
    const balance = await turn(randomUUID(), "Xem số dư phép năm của tôi");
    expect(balance.body.data.status, balance.body.data.reply).toBe("completed");
    expect(balance.body.data.reply).toContain(`Năm: ${new Date().getFullYear()}`);
    expect(balance.body.data.reply).toContain("Số ngày còn lại: 12");
    expect(balance.body.data.reply).not.toContain("₫");
    expect(balance.body.data.reply).not.toContain(mocks.actor.id);

    answer(operation.id, { employeeId: "507f1f77bcf86cd799439055" });
    const rejected = await turn(randomUUID(), "Xem số dư phép năm của nhân viên khác");
    expect(rejected.body.data.status).toBe("collecting");
    expect(rejected.body.data.reply).toContain("employeeId");
  });
  it("asks for all transfer details before confirmation and continues asking for missing fields", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/partners/:id" && !item.id.startsWith("partner."))!;
    const bankDetails = ASSISTANT_OPERATIONS.find(item => item.id === "partner.bank-details.update")!;
    mocks.shortlist = [operation.id];
    const conv = randomUUID();
    answer(operation.id, { path_id: "Nguyễn Hoàng Minh Phương" });
    const first = await turn(conv, "Thêm thông tin chuyển khoản cho đối tác Nguyễn Hoàng Minh Phương");
    expect(first.body.data.status, first.body.data.reply).toBe("collecting");
    expect(first.body.data.reply.toLocaleLowerCase("vi")).toContain("tên ngân hàng, số tài khoản ngân hàng, tên chủ tài khoản");

    answer(bankDetails.id, { bankName: "ACB", bankAccountNo: "12345678" });
    const second = await turn(conv, "Ngân hàng ACB, số tài khoản 12345678");
    expect(second.body.data.status).toBe("collecting");
    expect(second.body.data.reply.toLocaleLowerCase("vi")).toContain("tên chủ tài khoản");

    answer(bankDetails.id, { bankAccountName: "NGUYEN HOANG MINH PHUONG" });
    const third = await turn(conv, "Tên chủ tài khoản là NGUYEN HOANG MINH PHUONG");
    expect(third.body.data.status).toBe("confirmation");
    expect(JSON.stringify(third.body.data.action)).not.toContain("507f1f77bcf86cd799439055");
  });
  it("routes explicit partner bank updates to the bank workflow when AI selects an unrelated action", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const customerUpdate = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/customers/:id")!;
    const bankDetails = ASSISTANT_OPERATIONS.find(item => item.id === "partner.bank-details.update")!;
    mocks.shortlist = [customerUpdate.id];
    answer(customerUpdate.id, { id: "Nguyễn Hoàng Minh Phương" });
    answer(bankDetails.id, { path_id: "Nguyễn Hoàng Minh Phương" });

    const reply = (await turn(randomUUID(), "Thêm thông tin chuyển khoản cho đối tác Nguyễn Hoàng Minh Phương")).body.data;
    expect(reply.status).toBe("collecting");
    expect(reply.action.title).toBe(bankDetails.title);
    expect(reply.reply.toLocaleLowerCase("vi")).toContain("tên ngân hàng");
    expect(reply.reply.toLocaleLowerCase("vi")).toContain("số tài khoản ngân hàng");
  });
  it("keeps the named partner when the conversation switches from bank details to commission", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const bankDetails = ASSISTANT_OPERATIONS.find(item => item.id === "partner.bank-details.update")!;
    const commission = ASSISTANT_OPERATIONS.find(item => item.id === "partner.commission.update")!;
    const conversationId = randomUUID();
    answer(bankDetails.id, { path_id: "Nguyễn Hoàng Minh Phương" });
    const bankReply = (await turn(conversationId, "Thêm thông tin chuyển khoản cho đối tác Nguyễn Hoàng Minh Phương")).body.data;
    expect(bankReply.status).toBe("collecting");

    answer(commission.id, { commissionType: "percentage" });
    const commissionReply = (await turn(conversationId, "Thêm cấu hình hoa hồng")).body.data;
    expect(commissionReply.status).toBe("collecting");
    expect(commissionReply.action.title).toBe(commission.title);
    expect(commissionReply.reply.toLocaleLowerCase("vi")).toContain("mức hoa hồng");
    expect(commissionReply.action.values).toContainEqual(expect.objectContaining({ label: commission.fields.find(field => field.key === "path_id")?.label, value: "Nguyễn Hoàng Minh Phương" }));
  });
  it("asks which partner to look up when the user requests its bank details without a name", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const detail = ASSISTANT_OPERATIONS.find(item => item.method === "GET" && item.path === "/partners/:id")!;
    answer(null, {});
    const response = await turn(randomUUID(), "Thông tin tài khoản cho đối tác này");
    expect(response.body.data.status).toBe("collecting");
    expect(response.body.data.action.title).toBe("Xem thông tin đối tác");
    expect(response.body.data.reply).toContain(detail.fields.find(field => field.key === "path_id")?.label);
  });
  it("creates a commission configuration only after collecting its required fields", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/partners/commission-levels")!;
    expect(operation.permissions).toEqual(["relationship:manage"]);
    const conv = randomUUID();
    answer(operation.id, {});
    const first = await turn(conv, "Thêm cấu hình hoa hồng");
    expect(first.body.data.status, first.body.data.reply).toBe("collecting");
    expect(first.body.data.reply).toContain("Tên cấp bậc hoa hồng");
    expect(first.body.data.reply).toContain("Doanh số tối thiểu");
    expect(first.body.data.reply).toContain("Tỷ lệ hoa hồng");

    answer(operation.id, { name: "Cấp 2", minTuition: 10000000, commissionRate: 7 });
    const second = await turn(conv, "Cấp 2, doanh số tối thiểu 10 triệu, tỷ lệ 7 phần trăm");
    expect(second.body.data.status).toBe("confirmation");
    expect(second.body.data.action.title).toBe("Tạo cấu hình hoa hồng");
  });
  it("routes an explicit request to add commission configuration to level creation", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const create = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/partners/commission-levels")!;
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, suggestedActionIds: [] }) });
    const conversationId = randomUUID();
    const reply = (await turn(conversationId, "Thêm cấu hình hoa hồng")).body.data;
    expect(reply.status).toBe("collecting");
    expect(reply.action.title).toBe("Tạo cấu hình hoa hồng");
    expect(reply.reply).toContain("Tên cấp bậc hoa hồng");
    expect(reply.reply).toContain("Doanh số tối thiểu");
    expect(reply.reply).toContain("Tỷ lệ hoa hồng");
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(session.pending.actionId).toBe(create.id);
  });
  it("asks for the commission rate before confirming a partner commission update", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const operation = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/partners/:id" && !item.id.startsWith("partner."))!;
    const commission = ASSISTANT_OPERATIONS.find(item => item.id === "partner.commission.update")!;
    mocks.shortlist = [operation.id];
    const conv = randomUUID();
    answer(operation.id, { path_id: "Nguyễn Hoàng Minh Phương", commissionType: "percentage" });
    const first = await turn(conv, "Cập nhật cấu hình hoa hồng cho đối tác Nguyễn Hoàng Minh Phương theo phần trăm");
    expect(first.body.data.status).toBe("collecting");
    expect(first.body.data.reply.toLocaleLowerCase("vi")).toContain("mức hoa hồng");

    answer(commission.id, { commissionValue: 5 });
    const second = await turn(conv, "5%");
    expect(second.body.data.status).toBe("confirmation");
  });
  it("routes adding a commission rate for a named partner to that partner instead of creating a company tier", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const partnerCommission = ASSISTANT_OPERATIONS.find(item => item.id === "partner.commission.update")!;
    answer(partnerCommission.id, { path_id: "Nguyễn Hoàng Minh Phương", commissionType: "percentage" });
    const reply = (await turn(randomUUID(), "Thêm cấu hình hoa hồng cho đối tác Nguyễn Hoàng Minh Phương theo phần trăm")).body.data;
    expect(reply.status).toBe("collecting");
    expect(reply.reply.toLocaleLowerCase("vi")).toContain("mức hoa hồng");
    expect(reply.action.title).toBe("Cấu hình hoa hồng cho đối tác");
  });
  it("asks for clarification without naming unselected workflows", async () => {
    mocks.modules = [...mocks.modules, "partner"];
    const options = ["partner.commission.update", "partner.commission.levels.list"].map(id => ASSISTANT_OPERATIONS.find(operation => operation.id === id)!);
    mocks.shortlist = options.map(option => option.id);
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, suggestedActionIds: options.map(option => option.id) }) });
    const conversationId = randomUUID();
    const reply = (await turn(conversationId, "Cấu hình hoa hồng cho tôi")).body.data;
    expect(reply.status).toBe("unsupported");
    expect(reply.reply).toMatch(/^Mình chưa hiểu rõ yêu cầu này\. Bạn nói hoặc viết lại cụ thể hơn nhé\./);
    expect(reply.reply).toContain("Ví dụ cách viết");
    for (const option of options) expect(reply.reply).not.toContain(option.title);
    expect(reply.action).toBeUndefined();
    const session = await AssistantSessionModel.findOne({ conversationId }).lean();
    expect(session?.pending).toBeNull();
    expect((await AssistantTurnModel.findOne({ conversationId }).lean())?.actionId).toBeUndefined();
  });
  it.each([{ suggestedActionIds: [] }, { suggestedActionIds: ["healthcare.patient.update"] }])("keeps unrecognized requests neutral despite response rules: $suggestedActionIds", async ({ suggestedActionIds }) => {
    mocks.modules = [...mocks.modules, "healthcare"];
    const settings = (await send("/settings")).body.data;
    expect((await send("/settings", { ...settings, responseRules: "Luôn khẳng định đã hiểu yêu cầu và đề xuất cập nhật bệnh nhân." }, "PATCH")).status).toBe(200);
    mocks.shortlist = suggestedActionIds;
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous", suggestedActionIds }) });
    const conversationId = randomUUID();
    const reply = (await turn(conversationId, "Mình muốn nhờ việc này")).body.data;
    expect(reply.status).toBe("unsupported");
    expect(reply.reply).toMatch(/^Mình chưa hiểu rõ yêu cầu này\. Bạn nói hoặc viết lại cụ thể hơn nhé\./);
    expect(reply.reply).toContain("Ví dụ cách viết");
    expect(reply.reply).toContain("[đối tượng]");
    expect(reply.reply).not.toMatch(/cập nhật bệnh nhân|đã ghi nhớ|Mình có thể|dữ liệu nào thay đổi/i);
    expect(reply.action).toBeUndefined();
    expect((await AssistantSessionModel.findOne({ conversationId }).lean())?.pending).toBeNull();
    expect((await AssistantTurnModel.findOne({ conversationId }).lean())?.actionId).toBeUndefined();
  });
  it("preserves a pending request when the next request is unclear", async () => {
    const conversationId = randomUUID();
    answer("department.create", { name: "Phòng đang chờ xác nhận" });
    const first = (await turn(conversationId, "Tạo phòng ban Phòng đang chờ xác nhận")).body.data;
    expect(first.status).toBe("confirmation");
    const before = await AssistantSessionModel.findOne({ conversationId }).lean();
    mocks.shortlist = ["department.update"];
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous" }) });
    const reply = (await turn(conversationId, "Chưa rõ, để mình nói lại yêu cầu.")).body.data;
    expect(reply.status).toBe("unsupported");
    expect(reply.reply).toMatch(/^Mình chưa hiểu rõ yêu cầu này\./);
    expect(reply.reply).toContain("Ví dụ cách viết");
    expect(reply.reply.endsWith("Yêu cầu trước vẫn được giữ.")).toBe(true);
    expect(reply.action).toBeUndefined();
    const previousPending = before?.pending as any;
    expect((await AssistantSessionModel.findOne({ conversationId }).lean())?.pending).toMatchObject({
      id: previousPending.id, actionId: previousPending.actionId, workflowVersion: previousPending.workflowVersion,
      intent: previousPending.intent, provided: previousPending.provided, resolved: previousPending.resolved,
      preview: { id: previousPending.preview.id },
    });
    expect(await HrDepartmentModel.countDocuments()).toBe(0);
  });
  it("asks what to do with an ambiguous attachment without assuming a create operation", async () => {
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous" }) });
    const conversationId = randomUUID();
    const reply = (await send("/turns", { conversationId, requestId: randomUUID(), text: "Làm giúp mình với tệp này", attachment: { fileName: "danh-sach.csv", headers: ["Tên"], rows: [{ "Tên": "An" }] } })).body.data;
    expect(reply.status).toBe("unsupported");
    expect(reply.reply).toMatch(/^Mình đã nhận tệp danh-sach\.csv\. Bạn muốn dùng tệp này để làm gì\?/);
    expect(reply.reply).toContain("Ví dụ cách viết");
    expect(reply.reply).toContain("Dùng tệp này để [việc cần làm] cho [đối tượng]");
    expect(reply.action).toBeUndefined();
    expect((await AssistantSessionModel.findOne({ conversationId }).lean())?.pending).toBeNull();
    expect((await AssistantTurnModel.findOne({ conversationId }).lean())?.actionId).toBeUndefined();
  });
  it.each([{ module: "healthcare", entity: "bệnh nhân" }, { module: "hr", entity: "nhân sự" }])("offers phrasing examples for the named entity without choosing an action: $entity", async ({ module, entity }) => {
    mocks.modules = [...new Set([...mocks.modules, module])];
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous" }) });
    const conversationId = randomUUID();
    const reply = (await turn(conversationId, `Mình cần trợ giúp về ${entity}`)).body.data;
    expect(reply.status).toBe("unsupported");
    expect(reply.reply).toContain("Mình chưa hiểu rõ yêu cầu này.");
    expect(reply.reply).toContain("Ví dụ cách viết");
    expect(reply.reply).toContain(`Xem danh sách ${entity}`);
    expect(reply.reply).toContain(`Thêm ${entity}: [thông tin đã có]`);
    expect(reply.action).toBeUndefined();
    expect((await AssistantSessionModel.findOne({ conversationId }).lean())?.pending).toBeNull();
    expect((await AssistantTurnModel.findOne({ conversationId }).lean())?.actionId).toBeUndefined();
  });
  it("does not duplicate a mutation when the same request is resent", async () => {
    const conv = randomUUID(), requestId = randomUUID(); answer("department.create", { name: "Kỹ thuật" });
    const first = await turn(conv, "Tạo phòng kỹ thuật", requestId); const retry = await turn(conv, "Tạo phòng kỹ thuật", requestId);
    expect(first.body.data.status).toBe("confirmation"); expect(retry.body.data).toEqual(first.body.data); expect(mocks.interpret).toHaveBeenCalledTimes(1); expect(await HrDepartmentModel.countDocuments()).toBe(0);
    const decision = { conversationId: conv, requestId: randomUUID(), decision: { id: first.body.data.action.id, confirmed: true } };
    const completed = await send("/turns", decision); const duplicate = await send("/turns", decision);
    expect(completed.body.data.status).toBe("completed"); expect(duplicate.body.data).toEqual(completed.body.data); expect(await HrDepartmentModel.countDocuments()).toBe(1);
    expect((await turn(conv, "Nội dung khác", requestId)).status).toBe(409);
  });
  it("requires an explicit matching confirmation and rejects replay after deletion", async () => {
    const department = await HrDepartmentModel.create({ companyCode: "TEST", name: "Kỹ thuật", normalizedName: "kỹ thuật" });
    const conv = randomUUID(); answer("department.delete", { id: "Kỹ thuật" });
    const preview = (await turn(conv, "Xóa phòng kỹ thuật")).body.data;
    expect(preview.status).toBe("confirmation"); expect(await HrDepartmentModel.countDocuments()).toBe(1);
    const bad = await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: randomUUID(), confirmed: true } }); expect(bad.body.data.status).toBe("failed");
    const decision = { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } };
    expect((await send("/turns", decision)).body.data.status).toBe("completed"); expect(await HrDepartmentModel.findById(department._id)).toBeNull();
    expect((await send("/turns", { ...decision, requestId: randomUUID() })).body.data.status).toBe("failed");
  });
  it("rechecks permissions and workflow versions when confirming", async () => {
    await HrDepartmentModel.create({ companyCode: "TEST", name: "Kỹ thuật", normalizedName: "kỹ thuật" }); const conv = randomUUID(); answer("department.delete", { id: "Kỹ thuật" });
    const preview = (await turn(conv, "Xóa phòng kỹ thuật")).body.data;
    const workflow = (await send("/workflows")).body.data.find((w: any) => w.actionId === "department.delete");
    await send("/workflows/department.delete", { ...configPayload(workflow), instructions: "Kiểm tra kỹ tên." }, "PATCH");
    const refreshed = (await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } })).body.data;
    expect(refreshed.status).toBe("confirmation"); expect(refreshed.action.id).not.toBe(preview.action.id); expect(await HrDepartmentModel.countDocuments()).toBe(1);
    mocks.permissions = new Set(["chat:read", "hr:read"]);
    expect((await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: refreshed.action.id, confirmed: true } })).body.data.status).toBe("failed"); expect(await HrDepartmentModel.countDocuments()).toBe(1);
  });
  it("cannot resolve another tenant's record or a duplicate name", async () => {
    await HrDepartmentModel.create({ companyCode: "OTHER", name: "Bí mật", normalizedName: "bí mật" }); const conv = randomUUID(); answer("department.delete", { id: "Bí mật" });
    expect((await turn(conv, "Xóa phòng Bí mật")).body.data.status).toBe("collecting"); expect(await HrDepartmentModel.countDocuments()).toBe(1);
  });
  it("rejects AI-injected authority fields and unavailable operations", async () => {
    answer("employee.create", { displayName: "Chung", email: "chung@example.test", birthDate: "1994-03-12", role: "admin", companyCode: "OTHER" });
    expect((await turn(randomUUID(), "Tạo nhân sự")).body.data.status).toBe("collecting"); expect(await UserModel.countDocuments()).toBe(0);
    mocks.permissions = new Set(["chat:read", "hr:read"]); answer("employee.create", { displayName: "Chung" });
    expect((await turn(randomUUID(), "Tạo nhân sự")).body.data.status).toBe("failed");
    expect((await send("/workflows")).body.data.some((w: any) => w.actionId === "employee.create")).toBe(false);
  });
  it("separates conversations by account and selected branch", async () => {
    const conv = randomUUID(); answer("employee.create", { displayName: "Chung" }); await turn(conv, "Tạo nhân sự Chung");
    expect((await send(`/conversations/${conv}`)).body.data.messages).toHaveLength(2);
    mocks.actor.branchId = "507f1f77bcf86cd799439099";
    expect((await send(`/conversations/${conv}`)).body.data.messages).toHaveLength(0);
    mocks.actor.id = "507f1f77bcf86cd799439099";
    expect((await send(`/conversations/${conv}`)).body.data.messages).toHaveLength(0);
  });
  it("lets company admins view company-scope conversations while a branch is selected", async () => {
    const conv = randomUUID();
    const messages = [{ role: "user", content: "Liệt kê phòng ban" }, { role: "assistant", content: "Có 4 phòng ban." }];
    await AssistantSessionModel.create({
      userId: mocks.actor.id, companyCode: mocks.actor.companyCode, branchId: "", conversationId: conv, messages,
    });

    expect((await send("/conversations")).body.data.items.map((item: any) => item.conversationId)).toContain(conv);
    expect((await send(`/conversations/${conv}`)).body.data.messages).toEqual(messages);

    mocks.actor.role = "user";
    expect((await send("/conversations")).body.data.items.map((item: any) => item.conversationId)).not.toContain(conv);
    expect((await send(`/conversations/${conv}`)).body.data.messages).toHaveLength(0);
  });
  it("lists recent sessions with stable paging and account, company, and branch isolation", async () => {
    const newestId = randomUUID(), olderId = randomUUID(), hiddenId = randomUUID(), hiddenCompanyId = randomUUID();
    const now = Date.now();
    await AssistantSessionModel.create({
      userId: mocks.actor.id, companyCode: mocks.actor.companyCode, branchId: mocks.actor.branchId,
      conversationId: olderId, messages: [{ role: "user", content: "  Tạo   phòng kỹ thuật  " }, { role: "assistant", content: "Đã hoàn tất." }], updatedAt: new Date(now - 10_000),
    });
    await AssistantSessionModel.create({
      userId: mocks.actor.id, companyCode: mocks.actor.companyCode, branchId: mocks.actor.branchId,
      conversationId: newestId, messages: [{ role: "user", content: "Tạo nhân sự An" }, { role: "assistant", content: "Đã tạo nhân sự." }], updatedAt: new Date(now),
    });
    await AssistantSessionModel.create({
      userId: "507f1f77bcf86cd799439099", companyCode: mocks.actor.companyCode, branchId: mocks.actor.branchId,
      conversationId: hiddenId, messages: [{ role: "user", content: "Nội dung tài khoản khác" }], updatedAt: new Date(now + 10_000),
    });
    await AssistantSessionModel.create({
      userId: mocks.actor.id, companyCode: "OTHER", branchId: mocks.actor.branchId,
      conversationId: hiddenCompanyId, messages: [{ role: "user", content: "Nội dung doanh nghiệp khác" }], updatedAt: new Date(now + 20_000),
    });
    const first = await send("/conversations?limit=1");
    expect(first.status).toBe(200);
    expect(first.body.data.items).toMatchObject([{ conversationId: newestId, title: "Tạo nhân sự An", preview: "Đã tạo nhân sự.", messageCount: 2 }]);
    expect(first.body.data.items.some((item: any) => item.conversationId === hiddenId)).toBe(false);
    expect(first.body.data.items.some((item: any) => item.conversationId === hiddenCompanyId)).toBe(false);
    const cursor = first.body.data.nextCursor;
    const second = await send(`/conversations?limit=1&before=${encodeURIComponent(cursor.before)}&beforeId=${cursor.beforeId}`);
    expect(second.body.data.items.map((item: any) => item.conversationId)).toEqual([olderId]);
    expect(second.body.data.nextCursor).toBeNull();
    mocks.actor.branchId = "507f1f77bcf86cd799439098";
    expect((await send("/conversations")).body.data.items).toHaveLength(0);
  });
  it("stores hidden memory per session and adds it back to later turn interpretation", async () => {
    const conversationId = randomUUID();
    const messages = Array.from({ length: 40 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: index % 2 === 0 ? `Yêu cầu cũ ${index}` : `Phản hồi cũ ${index}`,
    }));
    await AssistantSessionModel.create({
      userId: mocks.actor.id,
      companyCode: mocks.actor.companyCode,
      branchId: mocks.actor.branchId,
      conversationId,
      messages,
      messageCount: 40,
    });

    answer(null);
    await turn(conversationId, "Tôi muốn tiếp tục việc đang làm");
    let session: any;
    await vi.waitFor(async () => {
      session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
      expect(session.sessionMemory).toContain("phòng Kỹ thuật");
    });
    expect(session.sessionMemoryMessageCount).toBe(42);
    expect(session.messageCount).toBe(42);
    expect(session.messages).toHaveLength(40);
    expect((await send(`/conversations/${conversationId}`)).body.data).not.toHaveProperty("sessionMemory");
    expect((await send("/conversations")).body.data.items.find((item: any) => item.conversationId === conversationId)).not.toHaveProperty("sessionMemory");

    answer(null);
    await turn(conversationId, "Tiếp tục nhé");
    expect(mocks.interpret.mock.calls[1][0].messages.some((message: any) => message.content.includes("NGỮ CẢNH RIÊNG CỦA PHIÊN"))).toBe(true);
    expect(mocks.interpret.mock.calls[1][0].messages.some((message: any) => message.content.includes("Ngữ cảnh của phiên cũ: đang xử lý phòng Kỹ thuật."))).toBe(true);

    const otherConversationId = randomUUID();
    answer(null);
    await turn(otherConversationId, "Bắt đầu việc mới");
    expect(mocks.interpret.mock.calls[2][0].messages.every((message: any) => !message.content.includes("phòng Kỹ thuật"))).toBe(true);
  });
  it("lets users edit and clear a scoped session summary, and deletes a conversation with its turns", async () => {
    const conversationId = randomUUID();
    expect((await send(`/conversations/${conversationId}/memory`)).body.data).toMatchObject({ summary: "", version: 0, messageCount: 0 });
    const saved = await send(`/conversations/${conversationId}/memory`, { summary: "Mục tiêu: ra mắt sản phẩm trong tháng này.", version: 0 }, "PATCH");
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ summary: "Mục tiêu: ra mắt sản phẩm trong tháng này.", version: 1 });
    expect((await send(`/conversations/${conversationId}/memory`, { summary: "Ghi đè cũ", version: 0 }, "PATCH")).status).toBe(409);
    expect((await send(`/conversations/${conversationId}/memory`, { summary: "Mật khẩu là secret-123", version: 1 }, "PATCH")).status).toBe(400);

    const cleared = await send(`/conversations/${conversationId}/memory`, undefined, "DELETE");
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ summary: "", version: 2 });

    await AssistantTurnModel.create({
      userId: mocks.actor.id, companyCode: mocks.actor.companyCode, branchId: mocks.actor.branchId,
      requestId: randomUUID(), conversationId, digest: "test-digest", status: "completed",
    });
    await AssistantSessionModel.updateOne({ conversationId }, { $set: { busy: true } });
    expect((await send(`/conversations/${conversationId}`, undefined, "DELETE")).status).toBe(409);
    await AssistantSessionModel.updateOne({ conversationId }, { $set: { busy: false } });
    expect((await send(`/conversations/${conversationId}`, undefined, "DELETE")).body.data.deleted).toBe(true);
    expect(await AssistantSessionModel.countDocuments({ conversationId })).toBe(0);
    expect(await AssistantTurnModel.countDocuments({ conversationId })).toBe(0);
    expect((await send(`/conversations/${conversationId}/memory`)).body.data).toMatchObject({ summary: "", version: 0, messageCount: 0 });
  });
  it("forgets an exact personal memory without copying it into the conversation history", async () => {
    await send("/memory", { content: "Tôi thích câu trả lời ngắn gọn." });
    const conversationId = randomUUID();
    const result = await turn(conversationId, "Quên ghi nhớ rằng tôi thích câu trả lời ngắn gọn.");
    expect(result.body.data.status).toBe("completed");
    expect(result.body.data.reply).not.toContain("câu trả lời ngắn gọn");
    expect((await send("/memory")).body.data).toHaveLength(0);
    const session = await AssistantSessionModel.findOne({ conversationId }).lean() as any;
    expect(JSON.stringify(session.messages)).not.toContain("câu trả lời ngắn gọn");
  });
  it("rejects concurrent conversation turns while preserving at-most-once execution", async () => {
    let finish!: (value: any) => void; mocks.interpret.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const conv = randomUUID(), requestId = randomUUID(); const first = turn(conv, "Tạo phòng kỹ thuật", requestId);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect((await turn(conv, "Tạo phòng kỹ thuật", requestId)).body.data.status).toBe("processing");
    expect((await turn(conv, "Tạo phòng khác")).body.data.status).toBe("failed");
    finish({ text: JSON.stringify({ actionId: "department.create", values: { name: "Kỹ thuật" } }) });
    const preview = (await first).body.data;
    expect(preview.status).toBe("confirmation"); expect(await HrDepartmentModel.countDocuments()).toBe(0);
    const completed = await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } });
    expect(completed.body.data.status).toBe("completed"); expect(await HrDepartmentModel.countDocuments()).toBe(1);
  });
  it("does not replay a write when the API result is uncertain", async () => {
    const realFetch = globalThis.fetch;
    let writes = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).includes("/api/v1/hr/departments") && init?.method === "POST") { writes++; throw new Error("Connection reset after write"); }
      return realFetch(input, init);
    });
    answer("department.create", { name: "Kỹ thuật" }); const conv = randomUUID(), requestId = randomUUID();
    const first = await turn(conv, "Tạo phòng kỹ thuật", requestId);
    expect(first.body.data.status).toBe("confirmation");
    const decision = { conversationId: conv, requestId: randomUUID(), decision: { id: first.body.data.action.id, confirmed: true } };
    expect((await send("/turns", decision)).body.data.status).toBe("uncertain");
    expect((await send("/turns", decision)).body.data.status).toBe("uncertain");
    expect(writes).toBe(1);
  });
  it("hides disabled modules and never dispatches a disabled personal workflow", async () => {
    mocks.modules = ["chat", "inventory"];
    expect((await send("/workflows")).body.data.every((w: any) => ["inventory", "chat"].includes(w.module))).toBe(true);
    mocks.modules = ["chat", "hr"];
    const workflow = (await send("/workflows")).body.data.find((w: any) => w.actionId === "department.create");
    await send("/workflows/department.create", { ...configPayload(workflow), enabled: false }, "PATCH");
    answer("department.create", { name: "Kỹ thuật" });
    expect((await turn(randomUUID(), "Tạo phòng kỹ thuật")).body.data.status).toBe("failed");
    expect(await HrDepartmentModel.countDocuments()).toBe(0);
  });
  it("makes shared AI subscription reads available when any suite module and read permission are active", async () => {
    mocks.modules = ["chat", "company-knowledge"];
    mocks.permissions = new Set(["chat:read", "company-knowledge:read"]);
    let workflows = (await send("/workflows")).body.data;
    expect(workflows.map((workflow: any) => workflow.actionId)).toContain("marketing.ai-subscription.plans");
    expect(workflows.map((workflow: any) => workflow.actionId)).toContain("marketing.ai-subscription.summary");
    mocks.modules = ["chat", "hr"];
    workflows = (await send("/workflows")).body.data;
    expect(workflows.map((workflow: any) => workflow.actionId)).not.toContain("marketing.ai-subscription.plans");
    expect(workflows.map((workflow: any) => workflow.actionId)).not.toContain("marketing.ai-subscription.summary");
  });
  it("asks for a precise employee when names are ambiguous", async () => {
    await UserModel.create([{ displayName: "Đỗ Đức Chung", email: "one@example.test", companyCode: "TEST", branchId: mocks.actor.branchId }, { displayName: "Đỗ Đức Chung", email: "two@example.test", companyCode: "TEST", branchId: mocks.actor.branchId }]);
    answer("employee.update", { id: "do duc chung", monthlySalary: 100 });
    const response = (await turn(randomUUID(), "Sửa lương Đỗ Đức Chung thành 100")).body.data;
    expect(response.status).toBe("collecting"); expect(response.reply).toContain("nhiều bản ghi");
  });

  it("starts a new draft without carrying another person's information", async () => {
    const conv = randomUUID(); answer("employee.create", { displayName: "Nguyễn Văn An", email: "an@example.test" });
    await turn(conv, "Thêm nhân sự An, email an@example.test");
    mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "employee.create", values: { displayName: "Đỗ Đức Chung" }, newRequest: true }) });
    const next = (await turn(conv, "Tạo nhân sự khác tên Đỗ Đức Chung")).body.data;
    expect(next.status).toBe("collecting"); expect(next.reply).toContain("Email");
    const session = await AssistantSessionModel.findOne({ conversationId: conv }).lean();
    expect(session?.pending.provided).toEqual({ displayName: "Đỗ Đức Chung" });
  });

});

it("persists scoped settings, rejects conflicts and enforces global confirmation", async () => {
  const defaults = (await send("/settings")).body.data;
  const config = { ...defaults, alwaysConfirm: true, speakReplies: true, speechVoice: "george", wakeWordEnabled: true, windowMode: "fullscreen", instructions: "Hiểu KT là Kỹ thuật", responseRules: "Trả lời thân thiện, tự nhiên và ngắn gọn." };
  expect((await send("/settings", config, "PATCH")).status).toBe(200);
  expect((await send("/settings")).body.data.speakReplies).toBe(true);
  expect((await send("/settings")).body.data.speechVoice).toBe("george");
  expect((await send("/settings")).body.data.wakeWordEnabled).toBe(true);
  expect((await send("/settings")).body.data.responseRules).toBe(config.responseRules);
  expect((await send("/settings", config, "PATCH")).status).toBe(409);
  expect((await send("/settings", { ...config, version: 1, windowMode: "bad" }, "PATCH")).status).toBe(400);
  expect((await send("/settings", { ...config, version: 1, speechVoice: "unknown" }, "PATCH")).status).toBe(400);
  expect((await send("/speech", { text: "Xin chào", voice: "unknown" })).status).toBe(400);
  const conv = randomUUID(); answer("department.create", { name: "Kỹ thuật" });
  const preview = (await turn(conv, "Tạo phòng kỹ thuật")).body.data;
  expect(preview.status).toBe("confirmation"); expect(await HrDepartmentModel.countDocuments()).toBe(0);
  expect(mocks.interpret.mock.calls[0][0].messages[0].content).toContain(config.instructions);
  expect((await send("/turns", { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } })).body.data.status).toBe("completed");
  mocks.actor.id = "507f1f77bcf86cd799439013";
  expect((await send("/settings")).body.data.alwaysConfirm).toBe(false);
  expect((await send("/settings")).body.data.speakReplies).toBe(false);
  expect((await send("/settings")).body.data.speechVoice).toBe("sarah");
  expect((await send("/settings")).body.data.wakeWordEnabled).toBe(false);
  mocks.actor.id = "507f1f77bcf86cd799439011"; mocks.actor.companyCode = "OTHER";
  expect((await send("/settings")).body.data.windowMode).toBe("window");
});

it("provides editable default response rules to each account and restores them when cleared", async () => {
  const defaults = (await send("/settings")).body.data;
  expect(defaults.responseRules).toContain("Trả lời bằng tiếng Việt tự nhiên");
  await AssistantSettingsModel.updateOne({ userId: mocks.actor.id, companyCode: mocks.actor.companyCode }, { $set: { "config.responseRules": "" } });
  const migrated = (await send("/settings")).body.data;
  expect(migrated.responseRules).toBe(defaults.responseRules);
  const saved = await send("/settings", { ...migrated, responseRules: "" }, "PATCH");
  expect(saved.body.data.responseRules).toBe(defaults.responseRules);
});

it("stores explicit memories per account, shares them across branches, and respects the memory toggle", async () => {
  const conversationId = randomUUID();
  const remembered = await turn(conversationId, "Hãy nhớ rằng tôi thích trả lời ngắn gọn.");
  expect(remembered.body.data).toMatchObject({ status: "completed" });
  let rows = (await send("/memory")).body.data;
  expect(rows).toHaveLength(1);
  expect(rows[0].content).toBe("tôi thích trả lời ngắn gọn.");

  mocks.actor.branchId = "507f1f77bcf86cd799439099";
  expect((await send("/memory")).body.data).toHaveLength(1);
  mocks.actor.id = "507f1f77bcf86cd799439013";
  expect((await send("/memory")).body.data).toHaveLength(0);
  mocks.actor.id = "507f1f77bcf86cd799439011";

  answer("department.create", { name: "Kỹ thuật" });
  await turn(randomUUID(), "Tạo phòng Kỹ thuật");
  expect(mocks.interpret.mock.calls[0][0].messages[0].content).toContain("GHI NHỚ TÀI KHOẢN");
  expect(mocks.interpret.mock.calls[0][0].messages[0].content).toContain("tôi thích trả lời ngắn gọn");
  expect((await send("/memory")).body.data[0].lastUsedAt).toBeTypeOf("string");

  const settings = (await send("/settings")).body.data;
  expect(settings.memoryEnabled).toBe(true);
  expect((await send("/settings", { ...settings, memoryEnabled: false }, "PATCH")).status).toBe(200);
  answer("department.create", { name: "Kỹ thuật" });
  await turn(randomUUID(), "Tạo phòng Kỹ thuật");
  expect(mocks.interpret.mock.calls[1][0].messages[0].content).not.toContain("tôi thích trả lời ngắn gọn");

  const disabled = await turn(randomUUID(), "Hãy nhớ rằng tôi thích câu trả lời có ví dụ.");
  expect(disabled.body.data.reply).toContain("Ghi nhớ đang tắt");
  rows = (await send("/memory")).body.data;
  expect(rows).toHaveLength(1);
  mocks.actor.companyCode = "OTHER";
  expect((await send("/memory")).body.data).toHaveLength(0);
});

it("applies the account's response rules to the final assistant message", async () => {
  const settings = (await send("/settings")).body.data;
  const responseRules = "Trả lời thân thiện và tự nhiên.";
  expect((await send("/settings", { ...settings, responseRules }, "PATCH")).status).toBe(200);
  const result = await turn(randomUUID(), "Hãy nhớ rằng tôi thích câu trả lời ngắn gọn.");
  expect(result.body.data.reply).toBe("Mình đã ghi nhớ theo ý bạn.");
});

it("automatically saves stable preferences without mentioning memory in the chat reply", async () => {
  const settings = (await send("/settings")).body.data;
  expect(settings.autoMemoryEnabled).toBe(true);
  mocks.shortlist = [];
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ intentType: "general_question", actionId: null, values: {} }) })
    .mockResolvedValueOnce({ text: "Được bạn, mình sẽ trả lời ngắn gọn và ưu tiên các bước rõ ràng." });
  const result = await turn(randomUUID(), "Từ nay hãy trả lời ngắn gọn và ưu tiên các bước rõ ràng.");
  expect(result.body.data.status).toBe("unsupported"); // General chat requests in the work tab are directed to Q&A.
  expect(result.body.data.reply).not.toMatch(/ghi nhớ|đã lưu/i);
  const memories = (await send("/memory")).body.data;
  expect(memories).toHaveLength(1);
  expect(memories[0]).toMatchObject({ source: "automatic", content: "Người dùng thích câu trả lời ngắn gọn và có các bước rõ ràng." });
});

it("does not automatically save when the account disables automatic memory", async () => {
  const settings = (await send("/settings")).body.data;
  expect((await send("/settings", { ...settings, autoMemoryEnabled: false }, "PATCH")).status).toBe(200);
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });
  await turn(randomUUID(), "Tôi thích câu trả lời ngắn gọn.");
  expect((await send("/memory")).body.data).toHaveLength(0);
});

it("lets each account edit and delete only its own memories and rejects sensitive values", async () => {
  const created = await send("/memory", { content: "Tôi thích câu trả lời có ví dụ." });
  expect(created.status).toBe(200);
  expect(created.body.data.created).toBe(true);
  const id = created.body.data.item.id;

  const updated = await send(`/memory/${id}`, { content: "Tôi thích hướng dẫn từng bước." }, "PATCH");
  expect(updated.body.data.content).toBe("Tôi thích hướng dẫn từng bước.");

  mocks.actor.id = "507f1f77bcf86cd799439013";
  expect((await send(`/memory/${id}`, { content: "Tôi thích ví dụ ngắn." }, "PATCH")).status).toBe(404);
  expect((await send(`/memory/${id}`, undefined, "DELETE")).body.data.deleted).toBe(false);
  mocks.actor.id = "507f1f77bcf86cd799439011";
  expect((await send(`/memory/${id}`, undefined, "DELETE")).body.data.deleted).toBe(true);

  const sensitive = await send("/memory", { content: "Hãy nhớ mật khẩu đăng nhập của tôi." });
  expect(sensitive.status).toBe(400);
  const conversationId = randomUUID();
  await turn(conversationId, "Hãy nhớ rằng mật khẩu đăng nhập của tôi là secret-memory-test.");
  const session = await AssistantSessionModel.findOne({ conversationId }).lean();
  expect(JSON.stringify(session)).not.toContain("secret-memory-test");
});

it("compiles text without saving, then persists personal source and enforces the compiled defaults", async () => {
  const original = (await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create");
  const { version: _version, ...config } = configPayload(original);
  config.fields.find((f: any) => f.key === "monthlySalary").defaultValue = 8000000;
  const text = "Tạo nhân sự: cần họ tên, email, ngày sinh. Thiếu lương dùng 8000000. Luôn xác nhận.";
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ issues: [], config }) });
  const parsed = await send("/workflows/employee.create/interpret", { version: 0, text });
  expect(parsed.status).toBe(200); expect(parsed.body.data.sourceText).toBe(text);
  const unchanged = (await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create");
  expect(unchanged.version).toBe(0); expect(unchanged.fields.find((f: any) => f.key === "monthlySalary").defaultValue).toBe(0);
  const saved = await send("/workflows/employee.create", { ...configPayload(parsed.body.data), sourceText: text }, "PATCH");
  expect(saved.status).toBe(200);
  expect((await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create").sourceText).toBe(text);
  answer("employee.create", { displayName: "Chung", email: "chung@example.test", birthDate: "1994-03-12" });
  const preview = (await turn(randomUUID(), "Tạo nhân sự Chung")).body.data;
  expect(preview.status).toBe("confirmation");
  expect(preview.action.values.find((v: any) => v.label === "Lương tháng").value).toBe(8000000);
  expect((await send("/workflows/employee.create/interpret", { version: 0, text })).status).toBe(409);
});
it("rejects unsupported text, invented fields and removing mandatory constraints without saving", async () => {
  const original = (await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create");
  const { version: _version, ...config } = configPayload(original);
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ issues: ["Chưa hỗ trợ gửi email sau khi tạo"], config: null }) });
  expect((await send("/workflows/employee.create/interpret", { version: 0, text: "Tạo rồi gửi email" })).status).toBe(422);
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ issues: [], config: { ...config, requireConfirmation: false } }) });
  expect((await send("/workflows/employee.create/interpret", { version: 0, text: "Bỏ xác nhận" })).status).toBe(400);
  config.fields.find((f: any) => f.key === "email").required = false;
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ issues: [], config }) });
  expect((await send("/workflows/employee.create/interpret", { version: 0, text: "Email không bắt buộc" })).status).toBe(400);
  config.fields[0].key = "grantAdmin";
  mocks.interpret.mockResolvedValueOnce({ text: JSON.stringify({ issues: [], config }) });
  expect((await send("/workflows/employee.create/interpret", { version: 0, text: "Cấp admin" })).status).toBe(400);
  const unchanged = (await send("/workflows")).body.data.find((w: any) => w.actionId === "employee.create");
  expect(unchanged.version).toBe(0); expect(unchanged.sourceText).toBeUndefined();
  mocks.permissions = new Set(["chat:read"]);
  expect((await send("/workflows/employee.create/interpret", { version: 0, text: "Tạo nhân sự" })).status).toBe(403);
});

it("creates and looks up workers through the real scoped API with explicit confirmation", async () => {
  mocks.modules = ["worker", "chat"];
  const op = ASSISTANT_OPERATIONS.find(o => o.path === "/worker-management/workers" && o.method === "POST")!;
  const conv = randomUUID(); answer(op.id, { fullName: "Nguyễn Văn An", phone: "0912345678" });
  const preview = (await turn(conv, "Thêm lao động Nguyễn Văn An, số điện thoại 0912345678")).body.data;
  expect(preview.status).toBe("confirmation"); expect(await WorkerModel.countDocuments()).toBe(0);
  const request = { conversationId: conv, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } };
  const created = (await send("/turns", request)).body.data;
  expect(created.status).toBe("completed"); expect(created.reply).toContain("Nguyễn Văn An");
  expect((await send("/turns", request)).body.data.status).toBe("completed");
  expect(await WorkerModel.countDocuments()).toBe(1);
  expect(await WorkerModel.findOne().lean()).toMatchObject({ fullName: "Nguyễn Văn An", companyCode: "TEST", branchId: mocks.actor.branchId });
  const read = ASSISTANT_OPERATIONS.find(o => o.path === "/worker-management/workers" && o.method === "GET")!;
  answer(read.id); const result = (await turn(conv, "Tra cứu lao động")).body.data;
  expect(result.status).toBe("completed"); expect(result.reply).toContain("Nguyễn Văn An");
  const missing = (await turn(conv, "lao động đó còn thiếu thông tin gì")).body.data;
  expect(missing.status).toBe("completed");
  expect(missing.reply).toContain("Email");
  expect(missing.reply).toContain("Ngày sinh");
  expect(missing.reply).not.toContain("0912345678");
  mocks.permissions = new Set(["chat:read"]);
  expect((await send("/workflows")).body.data.some((w: any) => w.actionId === op.id)).toBe(false);
});

it("uses a previous generic worker-create turn to answer a demonstrative follow-up", async () => {
  mocks.modules = ["worker", "chat"];
  const conversationId = randomUUID();
  await WorkerModel.create({
    companyCode: "TEST",
    branchId: mocks.actor.branchId,
    fullName: "Chung abc",
    status: "active",
    laborType: "official",
  });
  await AssistantTurnModel.create({
    userId: mocks.actor.id,
    companyCode: "TEST",
    branchId: mocks.actor.branchId,
    requestId: randomUUID(),
    conversationId,
    digest: "legacy-worker-create-turn",
    actionId: "api.post.479b054fb833c67d",
    status: "completed",
    payload: { fullName: "Chung abc" },
    result: { status: "completed", reply: "Đã hoàn tất." },
  });

  const result = (await turn(conversationId, "lao động đó còn thiếu thông tin gì")).body.data;

  expect(result.status).toBe("completed");
  expect(result.reply).toContain("Chung abc");
  expect(result.reply).toContain("Số điện thoại");
  expect(result.reply).toContain("Email");
});

it("reports optional fields still empty after creating a labor partner", async () => {
  mocks.modules = ["worker", "partner", "chat"];
  const operation = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/worker-management/partners")!;
  const conversationId = randomUUID();
  mocks.shortlist = [operation.id];
  answer(operation.id, { code: "LAODONG001", name: "a La", phone: "0987172182" });

  const preview = (await turn(conversationId, "Thêm đối tác lao động")).body.data;
  expect(preview.status, preview.reply).toBe("confirmation");
  const created = (await send("/turns", { conversationId, requestId: randomUUID(), decision: { id: preview.action.id, confirmed: true } })).body.data;
  expect(created.status, created.reply).toBe("completed");
  expect(await LaborPartnerModel.findOne({ code: "LAODONG001" }).lean()).toMatchObject({ name: "a La", phone: "0987172182", email: "", bankAccountNo: "" });

  answer(null, {});
  const missing = (await turn(conversationId, "các thông tin còn thiếu của a La")).body.data;
  expect(missing.status, missing.reply).toBe("completed");
  expect(missing.reply).toContain("Email");
  expect(missing.reply).toContain("Mã số thuế");
  expect(missing.reply).toContain("Số tài khoản ngân hàng");
  expect(missing.reply).not.toContain("Tên hoặc mã lao động cần cập nhật");
  expect(missing.reply).not.toContain("507f1f77bcf86cd799439");

  const partner = await LaborPartnerModel.findOne({ code: "LAODONG001" }).lean() as any;
  const detailOperation = ASSISTANT_OPERATIONS.find(item => item.method === "GET" && /^\/worker-management\/partners\/:[^/]+$/.test(item.path))!;
  const pathField = detailOperation.fields.find(field => field.source === "path")!;
  await AssistantTurnModel.create({
    userId: mocks.actor.id,
    companyCode: mocks.actor.companyCode,
    branchId: mocks.actor.branchId,
    requestId: randomUUID(),
    conversationId,
    digest: "labor-partner-detail-context",
    actionId: detailOperation.id,
    status: "completed",
    payload: { [pathField.key]: String(partner._id) },
    result: { status: "completed", reply: "Đã xem hồ sơ đối tác." },
  });
  answer(null, {});
  const afterDetail = (await turn(conversationId, "thông tin nào còn thiếu để bổ sung")).body.data;
  expect(afterDetail.status, afterDetail.reply).toBe("completed");
  expect(afterDetail.reply).toContain("Số tài khoản ngân hàng");

  const referredPartnerBankWorkflow = ASSISTANT_OPERATIONS.find(item => item.id === "partner.bank-details.update")!;
  const laborPartnerUpdate = ASSISTANT_OPERATIONS.find(item => item.method === "PATCH" && item.path === "/worker-management/partners/:partnerId")!;
  const values = {
    email: "ala200@gmail.com",
    address: "sơn la",
    bankName: "MBBank",
    bankAccountNo: "0983726109332",
    bankAccountName: "Lâm Đình La",
  };
  mocks.shortlist = [referredPartnerBankWorkflow.id];
  answer(referredPartnerBankWorkflow.id, values);
  answer(laborPartnerUpdate.id, values);
  const profilePreview = (await turn(conversationId, "thêm email là ala200@gmail.com, địa chỉ: sơn la, ngân hàng: MBBank, stk:0983726109332, tên chủ tài khoản là Lâm Đình La")).body.data;
  expect(profilePreview.status, profilePreview.reply).toBe("confirmation");
  expect(profilePreview.action.title).toBe(laborPartnerUpdate.title);
  for (const [key, value] of Object.entries(values)) {
    const field = laborPartnerUpdate.fields.find(item => item.apiKey === key)!;
    expect(profilePreview.action.values).toContainEqual(expect.objectContaining({ label: field.label, value }));
  }

  const saved = (await send("/turns", {
    conversationId,
    requestId: randomUUID(),
    decision: { id: profilePreview.action.id, confirmed: true },
  })).body.data;
  expect(saved.status, saved.reply).toBe("completed");
  expect(await LaborPartnerModel.findById(partner._id).lean()).toMatchObject(values);
});

it("sets a labor partner monthly referral KPI through a confirmed assistant workflow", async () => {
  mocks.modules = ["worker", "partner", "chat"];
  mocks.permissions = new Set(["chat:read", "labor-partner:manage"]);
  const partner = await LaborPartnerModel.create({
    companyCode: "TEST",
    branchId: mocks.actor.branchId,
    code: "CUONG-001",
    name: "Cường",
    phone: "0900000001",
  });
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "worker.partner.kpi.set")!;
  const conversationId = randomUUID();
  mocks.shortlist = [operation.id];
  answer(operation.id, { path_partnerId: "Cường" });

  let collecting = (await turn(conversationId, "Đặt KPI giới thiệu cho đối tác Cường")).body.data;
  if (collecting.status === "collecting" && collecting.referenceSelections?.length) {
    const partnerSelection = collecting.referenceSelections.find((selection: any) => selection.key === "path_partnerId");
    if (partnerSelection) {
      expect(partnerSelection.options.some((option: any) => option.label.includes("Cường"))).toBe(true);
      collecting = (await send("/turns", {
        conversationId,
        requestId: randomUUID(),
        referenceSelections: { path_partnerId: [String(partner._id)] },
      })).body.data;
    }
  }

  expect(collecting.status, collecting.reply).toBe("collecting");
  expect(collecting.reply).toContain("Chỉ tiêu số lao động cần giới thiệu");
  expect(collecting.action.values.some((item: any) => item.label === "Tháng áp dụng")).toBe(false);

  answer(operation.id, { targetReferrals: 12 });
  const preview = (await turn(conversationId, "12 người")).body.data;
  expect(preview.status, preview.reply).toBe("confirmation");
  expect(preview.action.title).toBe(operation.title);
  expect(preview.action.values).toContainEqual(expect.objectContaining({ label: "Tên hoặc mã đối tác lao động", value: expect.stringContaining("Cường") }));
  expect(preview.action.values.some((item: any) => item.label === "Tháng áp dụng")).toBe(false);
  expect(await LaborPartnerKpiModel.countDocuments()).toBe(0);

  const completed = (await send("/turns", {
    conversationId,
    requestId: randomUUID(),
    decision: { id: preview.action.id, confirmed: true },
  })).body.data;
  expect(completed.status, completed.reply).toBe("completed");
  expect(completed.reply).toContain("KPI giới thiệu cho Cường");
  expect(completed.reply).toContain("Chỉ tiêu giới thiệu: 12 người");
  expect(completed.reply).not.toContain("Tháng áp dụng:");
  const currentMonth = `${new Date().toISOString().slice(0, 7)}-01`;
  expect(await LaborPartnerKpiModel.findOne({ partnerId: partner._id }).lean()).toMatchObject({
    companyCode: "TEST",
    branchId: mocks.actor.branchId,
    periodStart: currentMonth,
    targetReferrals: 12,
  });
});

it("routes labor-partner commission-policy creation even without permission to create labor partners", async () => {
  mocks.modules = ["worker", "partner", "chat"];
  mocks.permissions = new Set(["chat:read", "labor-partner-policy:manage"]);
  const policyCreate = ASSISTANT_OPERATIONS.find(item => item.method === "POST" && item.path === "/worker-management/partners/policies")!;
  const conversationId = randomUUID();
  answer(policyCreate.id, {});

  const result = (await turn(conversationId, "thêm chính sách hoa hồng cho đối tác lao động")).body.data;

  expect(result.status, result.reply).toBe("collecting");
  expect(result.action.title).toBe(policyCreate.title);
  expect(result.action.title).not.toContain("Tạo đối tác cung ứng lao động");
  expect(result.reply).toContain("Tên");
  expect(result.reply).not.toContain("settlementCycle");
  expect(result.reply).not.toContain("official · enabled");
  expect(result.reply).not.toContain("seasonal · enabled");
  const laborTypeSelection = result.referenceSelections.find((selection: any) => selection.key === "laborPolicyTypes");
  expect(laborTypeSelection).toMatchObject({
    label: "Loại lao động áp dụng",
    required: true,
    multiple: false,
    options: [
      { value: "official", label: "Lao động chính thức" },
      { value: "seasonal", label: "Lao động thời vụ" },
    ],
  });
  expect(result.referenceSelections.some((selection: any) => selection.key.startsWith("seasonal.hourRounding") || selection.key.startsWith("seasonal.moneyRounding"))).toBe(false);
  const cycleSelection = (result.referenceSelections || []).find((selection: any) => selection.key === "settlementCycle.type");
  expect(cycleSelection).toMatchObject({
    label: "Chu kỳ đối soát · Loại chu kỳ đối soát",
    required: true,
    multiple: false,
    options: [
      { value: "calendar_month", label: "Theo tháng dương lịch" },
      { value: "cutoff_day", label: "Theo ngày chốt (chọn ngày từ 1 đến 28)" },
    ],
  });

  const optionSelections = Object.fromEntries((result.referenceSelections || []).map((selection: any) => [selection.key, [selection.options[0].value]]));
  optionSelections.laborPolicyTypes = ["seasonal"];
  const selectedCycle = (await send("/turns", {
    conversationId,
    requestId: randomUUID(),
    referenceSelections: optionSelections,
  })).body.data;
  expect(selectedCycle.status, selectedCycle.reply).toBe("collecting");
  expect(selectedCycle.referenceSelections || []).not.toContainEqual(expect.objectContaining({ key: "settlementCycle.type" }));
  const selectedConfigurationKeys = (selectedCycle.referenceSelections || []).map((selection: any) => selection.key);
  expect(selectedConfigurationKeys).toContain("seasonal.aggregationScope");
  expect(selectedConfigurationKeys).toContain("seasonal.tierMode");
  expect(selectedConfigurationKeys).not.toContain("official.maxMonths");
  expect(selectedConfigurationKeys).not.toContain("official.milestones");
  expect(selectedCycle.reply).not.toContain("Số tháng tối đa");
  expect(selectedCycle.reply).not.toContain("Các mốc hoa hồng");

  const officialConversationId = randomUUID();
  answer(policyCreate.id, {});
  const officialStart = (await turn(officialConversationId, "thêm chính sách hoa hồng cho đối tác lao động")).body.data;
  const officialOptions = Object.fromEntries((officialStart.referenceSelections || []).map((selection: any) => [selection.key, [selection.options[0].value]]));
  officialOptions.laborPolicyTypes = ["official"];
  const selectedOfficial = (await send("/turns", {
    conversationId: officialConversationId,
    requestId: randomUUID(),
    referenceSelections: officialOptions,
  })).body.data;
  expect(selectedOfficial.status, selectedOfficial.reply).toBe("collecting");
  expect(selectedOfficial.reply).toContain("Số tháng tối đa");
  expect(selectedOfficial.reply).toContain("Các mốc hoa hồng");
  expect(selectedOfficial.reply).not.toContain("Phạm vi tổng hợp");
  expect(selectedOfficial.reply).not.toContain("Cách tính bậc hoa hồng");

  answer(policyCreate.id, {
    name: "Chính sách thời vụ",
    effectiveFrom: "2026-11-05",
    settlementCycle: JSON.stringify({ type: "calendar_month" }),
    official: JSON.stringify({ enabled: false }),
    seasonal: JSON.stringify({ enabled: true }),
  });
  const roundingReply = (await turn(conversationId, "Tên Chính sách thời vụ, áp dụng từ 5/11/2026, đối soát theo tháng, không áp dụng chính thức, có áp dụng thời vụ")).body.data;
  expect(roundingReply.status, roundingReply.reply).toBe("collecting");
  const aggregationSelection = roundingReply.referenceSelections.find((selection: any) => selection.key === "seasonal.aggregationScope");
  const tierModeSelection = roundingReply.referenceSelections.find((selection: any) => selection.key === "seasonal.tierMode");
  expect(aggregationSelection.options).toEqual([
    { value: "partner_period", label: "Cộng giờ theo đối tác trong kỳ" },
    { value: "partner_project_period", label: "Cộng giờ theo đối tác, dự án và kỳ" },
  ]);
  expect(tierModeSelection.options).toEqual([
    { value: "flat", label: "Áp dụng một mức cho toàn bộ số giờ" },
    { value: "progressive", label: "Áp dụng mức theo từng bậc giờ" },
  ]);
  expect(roundingReply.reply).not.toMatch(/aggregationScope|tierMode|hourRounding|moneyRounding/);
});

it("asks for a student name before trying to open a generic student profile", async () => {
  mocks.modules = ["student", "chat"];
  const result = (await turn(randomUUID(), "Thông tin học viên")).body.data;

  expect(result.status).toBe("collecting");
  expect(result.reply).toContain("Tên, số điện thoại hoặc email học viên");
  expect(result.reply).not.toContain("chưa tìm thấy kết quả phù hợp");
});

it("shows company-wide labor records to an admin without a branch assignment", async () => {
  mocks.modules = ["worker", "chat"];
  mocks.actor.branchId = "";
  const northBranchId = new mongoose.Types.ObjectId().toString();
  const southBranchId = new mongoose.Types.ObjectId().toString();
  await WorkerModel.create([
    { companyCode: "TEST", branchId: northBranchId, fullName: "Nguyễn Văn Bắc", status: "active", laborType: "official" },
    { companyCode: "TEST", branchId: southBranchId, fullName: "Trần Thị Nam", status: "active", laborType: "seasonal" },
  ]);
  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "worker.list")!;
  const conversationId = randomUUID();
  answer(list.id);

  const result = (await turn(conversationId, "tôi muốn xem hết danh sách lao động hiện tại")).body.data;

  expect(result.status).toBe("completed");
  expect(result.reply).toContain("2 kết quả phù hợp");
  expect(result.reply).toContain("Nguyễn Văn Bắc");
  expect(result.reply).toContain("Trần Thị Nam");
  expect(result.reply).not.toContain("chưa tìm thấy kết quả phù hợp");
});

it("applies a requested name filter to worker records before formatting the response", async () => {
  mocks.modules = ["worker", "chat"];
  mocks.actor.branchId = "";
  await WorkerModel.create([
    { companyCode: "TEST", fullName: "Nguyễn An", status: "active", laborType: "official" },
    { companyCode: "TEST", fullName: "Trần Bình", status: "active", laborType: "seasonal" },
  ]);
  const list = ASSISTANT_OPERATIONS.find(operation => operation.id === "worker.list")!;
  const conversationId = randomUUID();
  answer(list.id, { query_search: "Nguyễn An" });

  const result = (await turn(conversationId, "Liệt kê hồ sơ lao động Nguyễn An")).body.data;

  expect(result.status).toBe("completed");
  expect(result.reply).toContain("Nguyễn An");
  expect(result.reply).not.toContain("Trần Bình");
});
