import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { interpretRequest } from "./interpreter";

afterEach(() => provider.mockReset());

const workerWorkflows = () => ASSISTANT_OPERATIONS.filter(item => item.module === "worker").map(defaultWorkflow);

describe("worker-management assistant requests", () => {
  it.each([
    ["Danh sách hồ sơ lao động", "worker.list", {}],
    ["Tìm lao động Trần Minh", "worker.list", { query_search: "Trần Minh" }],
    ["Xem hồ sơ lao động của La Văn Sến", "worker.list", { query_search: "La Văn Sến" }],
    ["Tìm lao động theo số điện thoại 0900000000", "worker.list", { query_search: "0900000000" }],
    ["Danh sách dự án lao động", "worker.project.list", {}],
    ["Danh sách hợp đồng lao động", "worker.labor.contract.list", {}],
    ["Danh sách thông báo lao động", "worker.notification.list", {}],
    ["Xem hợp đồng lao động của Lê Kiểm Thử", "worker.labor.contract.list", { query_workerId: "Lê Kiểm Thử" }],
    ["Xem hợp đồng mã HD-001", "worker.labor.contract.list", { query_search: "HD-001" }],
    ["Xem hợp đồng LD-001", "worker.labor.contract.list", { query_search: "LD-001" }],
  ])("routes a plain Vietnamese request without technical field names: %s", async (prompt, actionId, values) => {
    provider.mockRejectedValueOnce(new Error("A model call should not be needed for this clear request."));

    const result = await interpretRequest(prompt, workerWorkflows(), null, []);

    expect(result.actionId).toBe(actionId);
    expect(result.values).toEqual(values);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ["Tạo hồ sơ người lao động Lê Kiểm Thử", "worker.create", "worker.bulk.create"],
    ["Sửa hồ sơ người lao động Lê Kiểm Thử", "worker.update", "worker.create"],
    ["Xóa hồ sơ lao động của Lê Kiểm Thử", "worker.delete", "worker.bulk.delete"],
    ["Xóa nhiều hồ sơ lao động", "worker.bulk.delete", "worker.delete"],
  ])("keeps profile actions separate from bulk and unrelated actions: %s", async (prompt, expectedId, modelId) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: modelId, values: { path_id: "Lê Kiểm Thử" } }) });

    const result = await interpretRequest(prompt, workerWorkflows(), null, []);

    expect(result.actionId).toBe(expectedId);
    if (expectedId === "worker.delete") expect(result.values).toEqual({ path_id: "Lê Kiểm Thử" });
    expect(provider).toHaveBeenCalledOnce();
  });

  it("keeps worker references selectable by name and keeps system identifiers private", () => {
    const workerDelete = operationById("worker.delete")!;
    const workerDeleteTarget = workerDelete.fields.find(field => field.key === "path_id");
    expect(workerDeleteTarget?.reference).toBe("worker.list");
    expect(workerDeleteTarget?.label).toBe("Người lao động cần xóa");

    const projectCreate = operationById("worker.project.create")!;
    expect(projectCreate.fields.some(field => field.apiKey === "workerIds" && field.structure?.items?.reference === "worker.list")).toBe(true);
    const contractCreate = operationById("worker.labor.contract.create")!;
    expect(contractCreate.fields.find(field => field.apiKey === "workerId")?.reference).toBe("worker.list");
    const contractDelete = operationById("worker.labor.contract.delete")!;
    expect(contractDelete.fields.find(field => field.key === "path_id")).toMatchObject({
      label: "Hợp đồng cần xóa", reference: "worker.labor.contract.list", referenceValueKey: "id",
    });
    expect(operationById("worker.labor.contract.list")?.fields.find(field => field.apiKey === "workerId")?.reference).toBe("worker.list");
    expect(operationById("worker.project.update")?.fields.find(field => field.key === "path_id")?.reference).toBe("worker.project.list");

    const attendance = operationById("worker.attendance.mark")!;
    expect(attendance.fields.find(field => field.apiKey === "projectId")?.reference).toBe("worker.project.list");
    expect(attendance.fields.find(field => field.apiKey === "workerId")?.reference).toBe("worker.list");
    const attendanceUpdate = operationById("worker.attendance.update")!;
    expect(attendanceUpdate.fields.find(field => field.key === "path_id")?.reference).toBe("worker.attendance.list");

    expect(JSON.stringify(workerDelete)).not.toContain("api.delete.");
    expect(operationById("worker.project.delete")?.title).toBe("Xóa dự án lao động");
    expect(operationById("worker.labor.contract.update")?.fields.find(field => field.apiKey === "clientName")?.label)
      .toBe("Khách hàng hoặc đơn vị sử dụng lao động");
    expect(operationById("worker.labor.contract.list")?.fields.find(field => field.apiKey === "alert")?.label)
      .toBe("Cảnh báo hạn hợp đồng");

    for (const operation of ASSISTANT_OPERATIONS.filter(item => item.module === "worker")) {
      for (const field of operation.fields) {
        if (field.reference) expect(operationById(field.reference), `${operation.id}.${field.key}`).toBeDefined();
      }
    }
  });

  it("requires confirmation for every worker-module write operation", () => {
    for (const operation of ASSISTANT_OPERATIONS.filter(item => item.module === "worker" && item.method !== "GET")) {
      expect(operation.confirmation, operation.id).toBe(true);
    }
  });
});
