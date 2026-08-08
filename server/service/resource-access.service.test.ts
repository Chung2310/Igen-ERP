import { describe, expect, it } from "vitest";
import {
  assertResourceMutable,
  assertResourceReadable,
  filterReadableResourceItems,
  type ResourceAccessContext,
  type ResourceAccessItem,
} from "./resource-access.service";

const context: ResourceAccessContext = {
  companyCode: "ACME",
  branchId: "branch-a",
  userId: "user-1",
  role: "manager",
  permissions: new Set(["resource:read", "hr:read"]),
};

function item(overrides: Partial<ResourceAccessItem> = {}): ResourceAccessItem {
  return {
    companyCode: "ACME",
    managedType: "system",
    requiredPermissions: ["hr:read"],
    branchId: "branch-a",
    ...overrides,
  };
}

describe("resource access", () => {
  it("allows a system item only with resource and source permission", () => {
    expect(() => assertResourceReadable(item(), context)).not.toThrow();
    expect(() => assertResourceReadable(item(), {
      ...context,
      permissions: new Set(["resource:read"]),
    })).toThrow(/quyền truy cập/i);
  });

  it("enforces branch scope without hiding shared module folders", () => {
    expect(() => assertResourceReadable(item({ branchId: "branch-b" }), context)).toThrow(/quyền truy cập/i);
    expect(() => assertResourceReadable(item({ branchId: undefined }), context)).not.toThrow();
  });

  it("never permits direct mutation of a system-managed item", () => {
    expect(() => assertResourceMutable(item(), { ...context, role: "admin", permissions: new Set(["*"]) }))
      .toThrow("Tài nguyên hệ thống chỉ được thay đổi tại chức năng nguồn.");
    expect(() => assertResourceMutable(item({ managedType: "user" }), context)).not.toThrow();
  });

  it("filters unauthorized system items while preserving user-managed results", () => {
    const readable = filterReadableResourceItems([
      item({ sourceKey: "allowed" }),
      item({ sourceKey: "wrong-branch", branchId: "branch-b" }),
      item({ sourceKey: "wrong-permission", requiredPermissions: ["payroll:read"] }),
      item({ sourceKey: "personal", managedType: "user", requiredPermissions: [] }),
    ], context);

    expect(readable.map((entry) => entry.sourceKey)).toEqual(["allowed", "personal"]);
  });

  it("rejects cross-company metadata before checking permissions", () => {
    expect(() => assertResourceReadable(item({ companyCode: "OTHER" }), context))
      .toThrow(/quyền truy cập/i);
  });

  it("inherits source audience membership for room-scoped resources", () => {
    expect(() => assertResourceReadable(item({ sourceAudienceIds: ["user-1", "user-2"] }), context)).not.toThrow();
    expect(() => assertResourceReadable(item({ sourceAudienceIds: ["user-2"] }), context))
      .toThrow();
  });
});
