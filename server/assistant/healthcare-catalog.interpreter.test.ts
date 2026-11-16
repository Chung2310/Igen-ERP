import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

import { interpretRequest } from "./interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { completeAssistantOperation } from "./completion";
import { formatHealthcareResult } from "./healthcare-result";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

afterEach(() => provider.mockReset());

describe("healthcare catalog assistant workflow", () => {
  const operation = operationById("healthcare.catalog.create")!;
  const workflow = defaultWorkflow(operation);

  it.each([
    ["Tạo danh mục bác sĩ mã BS-01 tên Nguyễn An", "doctor"],
    ["Thêm danh mục phòng khám", "room"],
    ["Tạo danh mục dịch vụ y tế", "service"],
  ])("routes explicit medical catalog creation and resolves its kind: %s", async (text, kind) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.catalog.create", intentType: "workflow", values: { kind } });
  });

  it("routes a general medical catalog request and leaves the missing kind for the assistant to ask", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest("Tạo danh mục cho module quản lý y tế", [workflow], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.catalog.create", intentType: "workflow", values: {} });
    expect(operation.confirmation).toBe(true);
    expect(workflow.fields.find(field => field.key === "kind")?.required).toBe(true);
  });

  it("keeps the created catalog result in the shared table format and runs shared completion", async () => {
    const record = { kind: "doctor", code: "BS-01", name: "Nguyễn An", active: true };
    const result = formatHealthcareResult(operation, { items: [record] });
    const table = parseAssistantResultTable(result);
    const reply = { status: "completed" as const, reply: result, link: operation.link };

    expect(table?.rows[0].values).toMatchObject({ Loại: "Bác sĩ", Mã: "BS-01", Tên: "Nguyễn An", "Đang sử dụng": "Có" });
    await expect(completeAssistantOperation(reply, {
      operation,
      workflow,
      values: { kind: "doctor", code: "BS-01", name: "Nguyễn An", active: true },
      result: record,
    }, ASSISTANT_OPERATIONS, async () => true)).resolves.toEqual(reply);
  });
});

describe("healthcare everyday language routing", () => {
  const workflowFor = (id: string) => defaultWorkflow(operationById(id)!);

  it.each([
    ["Thông tin bệnh nhân La Văn Sến", "healthcare.patient.detail", { path_id: "La Văn Sến" }],
    ["Tìm bệnh nhân theo số điện thoại 0987217127", "healthcare.patient.list", { q: "0987217127" }],
    ["Lịch hẹn hôm nay", "healthcare.appointment.list", { from: expect.any(String), to: expect.any(String) }],
    ["Xem lịch hẹn ngày 15/11/2026", "healthcare.appointment.list", { from: "2026-11-15", to: "2026-11-15" }],
    ["Kiểm tra lịch hẹn đã xác nhận hôm nay", "healthcare.appointment.list", { from: expect.any(String), to: expect.any(String), status: "confirmed" }],
    ["Tra cứu lượt khám từ 01/11/2026 đến 14/11/2026", "healthcare.visit.list", { from: "2026-11-01", to: "2026-11-14" }],
    ["Danh sách bác sĩ", "healthcare.catalog.list", { kind: "doctor" }],
    ["Liệt kê lượt khám của La Văn Sến", "healthcare.visit.list", { q: "La Văn Sến" }],
    ["Thông tin lượt khám của bệnh nhân La Văn Sến", "healthcare.visit.list", { q: "La Văn Sến" }],
    ["Việc chăm sóc hôm nay", "healthcare.care.list", { from: expect.any(String), to: expect.any(String) }],
    ["Tổng quan y tế", "healthcare.overview", {}],
    ["Tải mẫu Excel bệnh nhân", "healthcare.import.template", { path_kind: "patients" }],
    ["Xem các dòng lỗi ở đợt nhập Excel BATCH-01", "healthcare.import.rows", { path_id: "BATCH-01", status: "invalid" }],
    ["Danh sách nhân viên y tế", "healthcare.staff.list", {}],
    ["Xem dữ liệu liên quan trước khi xóa bệnh nhân La Văn Sến", "healthcare.patient.bulk-delete-preview", { patientIds: JSON.stringify(["La Văn Sến"]) }],
    ["Xem từng dòng dữ liệu đã nhập trong đợt nhập BATCH-01", "healthcare.import.rows", { path_id: "BATCH-01" }],
  ])("understands a plain Vietnamese lookup: %s", async (text, actionId, values) => {
    const workflows = [workflowFor(actionId)];

    const result = await interpretRequest(text, workflows, null, []);

    expect(result).toMatchObject({ actionId, intentType: "workflow", values });
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ["Bổ sung thông tin cho bệnh nhân La Văn Sến", "healthcare.patient.update", { path_id: "La Văn Sến" }],
    ["Bổ sung thông tin cho lượt khám La Văn Sến", "healthcare.visit.update", { path_id: "La Văn Sến" }],
    ["Bổ sung thông tin cho lịch hẹn khám La Văn Sến", "healthcare.appointment.update", { path_id: "La Văn Sến" }],
    ["Bổ sung thông tin cho công việc chăm sóc bệnh nhân La Văn Sến", "healthcare.care.update", { path_id: "La Văn Sến" }],
  ])("treats adding information as updating the existing healthcare record: %s", async (text, actionId, values) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values }) });
    const result = await interpretRequest(text, [workflowFor(actionId)], null, []);

    expect(result).toMatchObject({ actionId, intentType: "workflow", values });
  });

  it("routes appointment creation to the appointment tab even when a doctor is mentioned", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: { startsAt: "2026-11-14T09:00+07:00", endsAt: "2026-11-14T10:00+07:00" } }) });

    const result = await interpretRequest("Đặt lịch khám cho bệnh nhân La Văn Sến với bác sĩ Nguyễn An", [workflowFor("healthcare.appointment.create")], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.appointment.create", values: { startsAt: "2026-11-14T09:00+07:00", endsAt: "2026-11-14T10:00+07:00" } });
  });

  it("keeps the selected patient when AI extracts fields for an update", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: { address: "12 Đường Mới" } }) });

    const result = await interpretRequest("Cập nhật địa chỉ bệnh nhân La Văn Sến thành 12 Đường Mới", [workflowFor("healthcare.patient.update")], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.patient.update", values: { path_id: "La Văn Sến", address: "12 Đường Mới" } });
  });

  it("routes an Excel upload for visits to the visit workflow so the file can be checked", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest("Tải lên tệp Excel lượt khám", [workflowFor("healthcare.visit.create")], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.visit.create", intentType: "workflow" });
  });

  it("recognizes a patient deletion request and preserves the person's name for selection", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest("Xóa hồ sơ bệnh nhân La Văn Sến", [workflowFor("healthcare.patient.bulk-delete")], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.patient.bulk-delete", values: { patientIds: JSON.stringify(["La Văn Sến"]) } });
  });
});
