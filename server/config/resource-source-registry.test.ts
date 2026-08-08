import { describe, expect, it } from "vitest";
import {
  buildSystemFolderKey,
  getResourceSourceDefinition,
  listResourceSourceDefinitions,
} from "./resource-source-registry";
import { ResourceItemModel } from "../model/resource-item.model";

describe("resource source registry", () => {
  it("maps HR contracts to stable folders and inherited permissions", () => {
    expect(getResourceSourceDefinition("hr.contract")).toMatchObject({
      moduleKey: "hr",
      moduleLabel: "Nhân sự",
      groupKey: "contracts",
      groupLabel: "Hợp đồng",
      requiredPermissions: ["hr:read"],
    });
  });

  it("builds tenant-scoped keys independently from display labels", () => {
    expect(buildSystemFolderKey(" Acme ", "entity", "hr.contract", " Employee-1 "))
      .toBe("acme:hr.contract:entity:employee-1");
  });

  it("rejects unknown upload sources", () => {
    expect(() => getResourceSourceDefinition("unknown.source"))
      .toThrow("Nguồn tải lên chưa được đăng ký: unknown.source");
  });

  it("registers every audited upload group with at least one read permission", () => {
    const sourceTypes = listResourceSourceDefinitions().map((source) => source.sourceType);

    expect(sourceTypes).toEqual(expect.arrayContaining([
      "hr.contract",
      "hr.leave",
      "hr.kanban",
      "hr.training",
      "hr.recruitment.job",
      "hr.recruitment.applicant",
      "student.profile",
      "student.custom-field",
      "student.assignment",
      "student.submission",
      "student.face",
      "attendance.student",
      "attendance.worker",
      "inventory.product",
      "import.worker",
      "import.student",
      "import.partner",
      "import.exam",
      "import.inventory-product",
      "import.inventory-stock",
      "chat.attachment",
      "workflow.attachment",
      "settings.profile",
      "public.registration",
      "company.branding",
      "hr.celebration",
      "hr.org-chart",
      "resource.direct",
    ]));
    expect(listResourceSourceDefinitions().every((source) => source.requiredPermissions.length > 0)).toBe(true);
  });

  it("exposes system source metadata and non-TTL retention fields on ResourceItem", () => {
    const paths = ResourceItemModel.schema.paths;
    expect(paths.managedType).toBeDefined();
    expect(paths.systemFolderKey).toBeDefined();
    expect(paths.sourceKey).toBeDefined();
    expect(paths.requiredPermissions).toBeDefined();
    expect(paths.storageProvider).toBeDefined();
    expect(paths.storageResourceType).toBeDefined();
    expect(paths.storageAccess).toBeDefined();
    expect((paths.deletedAt.options as { expires?: unknown }).expires).toBeUndefined();

    const indexes = ResourceItemModel.schema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      expect.arrayContaining([{ companyCode: 1, systemFolderKey: 1 }, expect.objectContaining({ unique: true })]),
      expect.arrayContaining([{ companyCode: 1, sourceKey: 1 }, expect.objectContaining({ unique: true })]),
    ]));
  });
});
