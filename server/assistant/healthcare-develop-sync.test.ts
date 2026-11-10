import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return { assertOperation: vi.fn((_req, id: string) => operationById(id)), actorScope: () => ({ userId: "actor", companyCode: "TEST" }) };
});
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { collectValues } from "./policy";
import { callOperation, lookupRecords, resolveReferences, UncertainExecutionError } from "./executor";
import { decorateHealthcareResult } from "./healthcare-executor";
import { formatHealthcareResult } from "./healthcare-result";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const branch = "507f1f77bcf86cd799439012";
const patientId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb17";
const secondId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb18";
const visitId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb19";
const doctorId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb20";
const patient = { _id: patientId, revision: 1, code: "BN000001", name: "Nguyễn An", phone: "090 123 4567", address: "", dateOfBirth: "", note: "" };
const second = { ...patient, _id: secondId, code: "BN000002", name: "Trần Bình", phone: "0912345678" };
const req = { user: { id: "actor", companyCode: "TEST", role: "admin", branchId: branch }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const op = (id: string) => ASSISTANT_OPERATIONS.find(item => item.id === `healthcare.${id}`)!;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

describe("healthcare develop compatibility", () => {
  it("allows patient creation without a code while retaining required visit codes", async () => {
    const collected = collectValues(defaultWorkflow(op("patient.create")), { targetBranch: branch, name: "Nguyễn An" });
    expect(collected.missing).toEqual([]);
    expect(collected.values).not.toHaveProperty("code");
    expect(op("visit.create").fields.find(field => field.key === "code")?.systemRequired).toBe(true);
    const fetcher = vi.fn(async (_url: URL, _init: RequestInit) => response(patient, 201));
    vi.stubGlobal("fetch", fetcher);
    await callOperation(req, op("patient.create"), collected.values);
    expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ name: "Nguyễn An" });
  });

  it("uses patient selection search and accepts a normalized phone number", async () => {
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => response({ items: JSON.parse(String(init.body)).mode === "selection" ? [patient] : [], total: 1 }));
    vi.stubGlobal("fetch", fetcher);
    const candidates = await lookupRecords(req, "healthcare.patient.list", "0901234567", { targetBranch: branch });
    expect(candidates).toHaveLength(1);
    expect(fetcher.mock.calls.some(([, init]) => JSON.parse(String(init.body)).mode === "selection")).toBe(true);
    const selected = await resolveReferences(req, op("visit.create"), { targetBranch: branch, patientId: "0901234567" });
    expect(selected.errors).toEqual([]);
    expect(selected.values.patientId).toBe(patientId);
    expect(selected.labels.patientId).toContain("090 123 4567");
  });

  it("keeps public patient codes searchable when the new picker excludes code searches", async () => {
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => response({ items: JSON.parse(String(init.body)).mode ? [] : [patient], total: 1 }));
    vi.stubGlobal("fetch", fetcher);
    const selected = await resolveReferences(req, op("visit.create"), { targetBranch: branch, patientId: patient.code });
    expect(selected.errors).toEqual([]);
    expect(selected.values.patientId).toBe(patientId);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["visit", "Bác sĩ Nguyễn Minh", ""], ["appointment", "Bác sĩ Nguyễn Minh", ""],
    ["visit", "", doctorId], ["appointment", "", doctorId],
  ])("updates %s doctor information while retaining unrelated fields (external name: %s)", async (entity, doctorName, expectedDoctorId) => {
    const existing = { _id: visitId, revision: 2, code: "PK-001", patientId, doctorId, doctorName: "", roomId: "", serviceId: "", status: entity === "visit" ? "registered" : "scheduled",
      visitedOn: "2026-11-10", visitId: "", startsAt: "2026-11-10T01:00:00.000Z", endsAt: "2026-11-10T01:30:00.000Z", note: "Giữ ghi chú", paymentNote: "" };
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => init.method === "PATCH" ? response(existing) : response({ items: [existing] }));
    vi.stubGlobal("fetch", fetcher);
    await callOperation(req, op(`${entity}.update`), { targetBranch: branch, path_id: visitId, revision: 2, doctorName });
    const write = fetcher.mock.calls.find(([, init]) => init.method === "PATCH")!;
    expect(JSON.parse(String(write[1].body))).toMatchObject({ doctorId: expectedDoctorId, doctorName, note: "Giữ ghi chú", patientId, revision: 2 });
    expect(op(`${entity}.create`).fields.find(field => field.key === "doctorId")?.alternativeField).toBe("doctorName");
  });

  it("keeps care links immutable and rejects a visit belonging to another patient", async () => {
    expect(op("care.create").fields.find(field => field.key === "visitId")).toMatchObject({ reference: "healthcare.visit.list", referenceParentKey: "patientId" });
    expect(op("care.update").fields.some(field => ["patientId", "appointmentId", "visitId"].includes(field.key))).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => url.pathname.endsWith(`/patients/${patientId}`) ? response(patient)
      : response({ items: [{ _id: visitId, revision: 1, patientId: secondId, code: "PK-002" }] })));
    const result = await resolveReferences(req, op("care.create"), { targetBranch: branch, patientId, visitId });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.unresolvedReferenceKeys).toContain("visitId");
  });

  it("renders imported doctor names, patient phone numbers and approved Excel row previews", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([])));
    const clinical = await decorateHealthcareResult(req, op("visit.list"), { items: [{ _id: visitId, patientId, code: "PK-001", report: { doctor: "Bác sĩ ngoài ERP" } }], patientReferences: [patient] }, { targetBranch: branch });
    expect(clinical.items[0]).toMatchObject({ doctorName: "Bác sĩ ngoài ERP", patientPhone: patient.phone });
    const result = await decorateHealthcareResult(req, op("import.rows"), { items: [{ row: 2, status: "ready", preview: {
      ma_benh_nhan: "BN000001", ten_benh_nhan: "Nguyễn An", bac_si: "Bác sĩ ngoài ERP", internalSecret: "KHÔNG HIỆN", _id: patientId,
    } }] }, { targetBranch: branch });
    const text = formatHealthcareResult(op("import.rows"), result);
    expect(parseAssistantResultTable(text)).not.toBeNull();
    expect(text).toContain("Nguyễn An");
    expect(text).toContain("Bác sĩ ngoài ERP");
    expect(text).not.toContain("KHÔNG HIỆN"); expect(text).not.toContain(patientId);
  });

  it("retains overview totals and report fields without treating them as empty record lists", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const report = await decorateHealthcareResult(req, op("visit.report"), { fields: { ma_phieu: "PK-001", bac_si: "Bác sĩ Nguyễn Minh" } }, { targetBranch: branch });
    expect(formatHealthcareResult(op("visit.report"), report)).toContain("Bác sĩ Nguyễn Minh");
    const overview = await decorateHealthcareResult(req, op("overview"), { today: "2026-11-10", patients: 2, visitCount: 1, appointmentCount: 1, careCount: 0, patientReferences: [], todayAppointments: [], dueCare: [] }, { targetBranch: branch });
    expect(formatHealthcareResult(op("overview"), overview)).toContain("Số bệnh nhân: 2");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("patient deletion preview and confirmation", () => {
  const impact = () => [patient, second].map((row, index) => ({ ...row, visits: index + 1, appointments: 1, care: 2 }));
  function server(rows = impact()) {
    const writes: unknown[] = [];
    const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
      if (url.pathname.endsWith("/bulk-delete-preview")) return response({ items: rows });
      if (url.pathname.endsWith("/bulk-delete")) { writes.push(JSON.parse(String(init.body))); return response({ deletedCount: 2, deletedVisits: 3, deletedAppointments: 2, deletedCare: 4 }); }
      const match = [patient, second].find(row => url.pathname.endsWith(`/patients/${row._id}`));
      if (match) return response(match);
      if (url.pathname.endsWith("/patients/search")) {
        const q = JSON.parse(String(init.body)).q;
        return response({ items: [patient, second].filter(row => row.name === q), total: 1 });
      }
      throw new Error("Unexpected healthcare request");
    });
    vi.stubGlobal("fetch", fetcher);
    return { fetcher, rows, writes };
  }

  it("requires manage permission even for viewing the cascade impact", () => {
    expect(op("patient.bulk-delete-preview").permissionGroups).toContainEqual(["healthcare:manage"]);
    expect(op("patient.bulk-delete-preview").readOnly).toBe(true);
    expect(defaultWorkflow(op("patient.bulk-delete")).confirmationLocked).toBe(true);
  });

  it("resolves names privately, previews exact cascade counts, and only deletes with the saved snapshot", async () => {
    const { writes } = server();
    const resolved = await resolveReferences(req, op("patient.bulk-delete"), { targetBranch: branch, patientIds: JSON.stringify([patient.name, second.name]) });
    expect(resolved.errors).toEqual([]);
    expect(JSON.parse(String(resolved.values.patientIds))).toEqual([patientId, secondId]);
    expect(resolved.confirmationDetails.patientIds[0].value).toContain("1 lượt khám");
    expect(JSON.stringify(resolved.confirmationDetails)).not.toContain(patientId);
    expect(writes).toHaveLength(0);
    const result = await callOperation(req, op("patient.bulk-delete"), resolved.values);
    expect(result.deletedCount).toBe(2);
    expect(writes).toEqual([{ ids: [patientId, secondId] }]);
    const rendered = await decorateHealthcareResult(req, op("patient.bulk-delete"), result, resolved.values);
    expect(parseAssistantResultTable(formatHealthcareResult(op("patient.bulk-delete"), rendered))?.headers).toContain("Bệnh nhân đã xóa");
  });

  it("blocks deletion when related records change after the preview", async () => {
    const { rows, writes } = server();
    const selected = await resolveReferences(req, op("patient.bulk-delete"), { targetBranch: branch, patientIds: JSON.stringify([patientId, secondId]) });
    rows[0].visits++;
    await expect(callOperation(req, op("patient.bulk-delete"), selected.values)).rejects.toThrow("đã thay đổi");
    expect(writes).toHaveLength(0);
  });

  it("blocks missing confirmation snapshots, duplicate patients and ambiguous names", async () => {
    const { writes, fetcher } = server();
    await expect(callOperation(req, op("patient.bulk-delete"), { targetBranch: branch, patientIds: JSON.stringify([patientId]) })).rejects.toThrow("xác nhận trước khi xóa");
    const duplicate = await resolveReferences(req, op("patient.bulk-delete"), { targetBranch: branch, patientIds: JSON.stringify([patientId, patientId]) });
    expect(duplicate.errors.join(" ")).toContain("lặp lại");
    fetcher.mockImplementation(async () => response({ items: [patient, { ...second, name: patient.name }], total: 2 }));
    const ambiguous = await resolveReferences(req, op("patient.bulk-delete"), { targetBranch: branch, patientIds: JSON.stringify([patient.name]) });
    expect(ambiguous.unresolvedReferenceKeys).toContain("patientIds[1]");
    expect(writes).toHaveLength(0);
  });

  it("treats a server failure during deletion as uncertain", async () => {
    const { fetcher } = server();
    const selected = await resolveReferences(req, op("patient.bulk-delete"), { targetBranch: branch, patientIds: JSON.stringify([patientId, secondId]) });
    fetcher.mockImplementation(async (url: URL) => url.pathname.endsWith("/bulk-delete") ? response({ message: "partial failure" }, 500) : response({ items: impact() }));
    await expect(callOperation(req, op("patient.bulk-delete"), selected.values)).rejects.toBeInstanceOf(UncertainExecutionError);
  });
});
