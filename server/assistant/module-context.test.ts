import { describe, expect, it } from "vitest";
import { MODULE_KEYS } from "../../src/config/modules";
import { assistantModuleContext, assistantModuleContextCatalog, inferPartnerModule, isKnownModuleContextClause, mentionsCompatibleModule } from "./module-context";

describe("assistant module context metadata", () => {
  it("provides a label for every module and deduplicates the routing catalog", () => {
    const catalog = assistantModuleContextCatalog([...MODULE_KEYS, "inventory", "hr"]);
    expect(catalog).toHaveLength(MODULE_KEYS.length);
    expect(catalog.every(module => module.key && module.label)).toBe(true);
    expect(catalog.find(module => module.key === "inventory")?.aliases).toContain("Kho hàng");
    expect(catalog.find(module => module.key === "student-partner")?.label).toBe("Đối tác tuyển sinh");
  });

  it("resolves specific module names without treating the generic partner label as a module", () => {
    expect(mentionsCompatibleModule("Trong đối tác giới thiệu học viên", "student-partner")).toBe(true);
    expect(mentionsCompatibleModule("Tìm đối tác giới thiệu nhiều lao động nhất", "student-partner")).toBe(false);
    expect(mentionsCompatibleModule("Trong đối tác giới thiệu", "student-partner")).toBe(false);
    expect(isKnownModuleContextClause("Trong đối tác")).toBe(false);
    expect(mentionsCompatibleModule("Trong kho hàng", "inventory")).toBe(true);
    expect(mentionsCompatibleModule("Tôi muốn thêm dự án cho nhân sự", "hr")).toBe(true);
    expect(mentionsCompatibleModule("Tôi muốn thêm dự án cho nhân sự", "worker")).toBe(false);
    expect(mentionsCompatibleModule("Trong quản lí lao động", "labor-partner")).toBe(true);
    expect(mentionsCompatibleModule("Dự án lao động", "worker")).toBe(true);
    expect(mentionsCompatibleModule("Thêm dự án lao động", "worker")).toBe(true);
    expect(mentionsCompatibleModule("Dự án lao động", "labor-partner")).toBe(false);
    expect(mentionsCompatibleModule("Trong quản lý học viên", "labor-partner")).toBe(false);
    expect(assistantModuleContext("labor-partner").relatedLabels).toContain("Quản lý lao động");
  });

  it("routes partner requests only when the referred population identifies the partner module", () => {
    expect(inferPartnerModule("Tìm đối tác giới thiệu nhiều lao động nhất")).toBe("labor-partner");
    expect(inferPartnerModule("Xem đối tác giới thiệu học viên")).toBe("student-partner");
    expect(inferPartnerModule("Xem đối tác giới thiệu")).toBeUndefined();
    expect(inferPartnerModule("So sánh học viên và lao động của đối tác")).toBeUndefined();
  });
});
