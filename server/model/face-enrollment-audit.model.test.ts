import { describe, expect, it } from "vitest";

import { FaceEnrollmentAuditModel } from "./face-enrollment-audit.model";

describe("FaceEnrollmentAuditModel", () => {
  it("requires immutable actor, target, tenant, action and outcome fields", () => {
    for (const path of ["actorId", "targetUserId", "companyCode", "action", "outcome", "attemptedAt"]) {
      const schemaPath = FaceEnrollmentAuditModel.schema.path(path);
      expect(schemaPath.options.required).toBe(true);
      expect(schemaPath.options.immutable).toBe(true);
    }
  });

  it("stores evidence identifiers without raw image or embedding fields", () => {
    expect(FaceEnrollmentAuditModel.schema.path("evidence.publicId")).toBeDefined();
    expect(FaceEnrollmentAuditModel.schema.path("evidence.resourceType")).toBeDefined();
    expect(FaceEnrollmentAuditModel.schema.path("evidence.type")).toBeDefined();
    expect(FaceEnrollmentAuditModel.schema.path("rawImage")).toBeUndefined();
    expect(FaceEnrollmentAuditModel.schema.path("embedding")).toBeUndefined();
  });

  it("validates the supported enrollment actions and outcomes", () => {
    expect(FaceEnrollmentAuditModel.schema.path("action").options.enum).toEqual([
      "register", "replace", "delete",
    ]);
    expect(FaceEnrollmentAuditModel.schema.path("outcome").options.enum).toEqual([
      "success", "rejected", "error",
    ]);
  });
});