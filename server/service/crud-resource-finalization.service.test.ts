import { describe, expect, it, vi } from "vitest";
import { createCrudResourceFinalizationService } from "./crud-resource-finalization.service";

describe("CrudResourceFinalizationService", () => {
  it.each([
    ["hr-leave-templates", { _id: "template-1", name: "Mẫu nghỉ phép", uploadToken: "token-template" }, "leave-template", "template-1", "file"],
    ["hr-leave-applications", { _id: "leave-1", employeeId: "employee-1", employeeName: "Nguyen A", attachments: [{ uploadToken: "token-leave" }] }, "employee", "employee-1", "attachments.0"],
    ["training-courses", { _id: "course-1", title: "Onboarding", lessons: [{ uploadToken: "token-course" }] }, "training-course", "course-1", "lessons.0"],
    ["products", { _id: "product-1", sku: "SKU-01", name: "Printer", uploadToken: "token-product" }, "product", "product-1", "image"],
  ])("finalizes managed uploads for %s", async (modelName, item, entityType, entityId, sourceField) => {
    const finalize = vi.fn(async () => []);
    const service = createCrudResourceFinalizationService({ finalize });

    await service.finalize(modelName, item, { companyCode: "ACME", actorId: "actor-1" });

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "actor-1" }),
      expect.objectContaining({ entityType, entityId, sourceRecordId: String(item._id) }),
    );
    const call = finalize.mock.calls[0] as unknown as [unknown, { uploads: unknown[] }];
    expect(call[1].uploads).toEqual([
      expect.objectContaining({ sourceField }),
    ]);
  });

  it("ignores CRUD models without managed source uploads", async () => {
    const finalize = vi.fn(async () => []);
    const service = createCrudResourceFinalizationService({ finalize });

    await service.finalize("branches", { _id: "branch-1" }, { companyCode: "ACME", actorId: "actor-1" });

    expect(finalize).not.toHaveBeenCalled();
  });

  it.each([
    ["hr-leave-templates", "hr.leave"],
    ["hr-leave-applications", "hr.leave"],
    ["training-courses", "hr.training"],
    ["products", "inventory.product"],
  ])("trashes indexed resources when a %s source is deleted", async (modelName, sourceType) => {
    const trashSourceRecordResources = vi.fn(async () => 1);
    const service = createCrudResourceFinalizationService(
      { finalize: vi.fn(async () => []) },
      { trashSourceRecordResources },
    );

    await service.trash(modelName, { _id: "record-1" }, { companyCode: "ACME", actorId: "actor-1" });

    expect(trashSourceRecordResources).toHaveBeenCalledWith("ACME", sourceType, "record-1");
  });
});
