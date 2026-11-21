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
  it("accepts a worker registration without an email address", () => {
    const result = publicRegisterStudentSchema.validate({
      teacherId: "6a4c5d666ca790ac78608698",
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
    });

    expect(result.error).toBeUndefined();
  });

  it("accepts the worker QR registration preset", () => {
    const result = publicRegisterStudentSchema.validate({
      teacherId: "6a4c5d666ca790ac78608698",
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
      entityPreset: "worker",
    });

    expect(result.error).toBeUndefined();
  });

  it("accepts the company and branch encoded in a worker QR", () => {
    const result = publicRegisterStudentSchema.validate({
      teacherId: "6a4c5d666ca790ac78608698",
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
      entityPreset: "worker",
      registrationCompanyCode: "ACME",
      registrationBranchId: "branch-1",
    });

    expect(result.error).toBeUndefined();
  });
});
