import { describe, expect, it } from "vitest";
import { createStudentSchema, publicRegisterStudentSchema, updateStudentSchema } from "./student.validation";

describe("student status validation", () => {
  it("accepts Chờ nhập học when creating or updating a student", () => {
    const create = createStudentSchema.validate({
      fullName: "Nguyễn Văn An",
      phone: "0900000000",
      email: "an@example.com",
      registrationDate: "2026-11-12",
      status: ["Chờ nhập học"],
    });
    const update = updateStudentSchema.validate({ status: ["Chờ nhập học"] });

    expect(create.error).toBeUndefined();
    expect(update.error).toBeUndefined();
  });
});

describe("publicRegisterStudentSchema", () => {
  it("accepts a public registration with a signed context token", () => {
    const result = publicRegisterStudentSchema.validate({
      registrationToken: "signed-context-token",
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
    });

    expect(result.error).toBeUndefined();
  });

  it("does not accept editable company, branch, or preset fields", () => {
    const result = publicRegisterStudentSchema.validate({
      registrationToken: "signed-context-token",
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
      entityPreset: "worker",
      registrationCompanyCode: "ACME",
      registrationBranchId: "branch-1",
    });

    expect(result.error).toBeDefined();
  });
});
