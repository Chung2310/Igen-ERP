import { describe, expect, it } from "vitest";
import { publicRegisterStudentSchema } from "./student.validation";

describe("publicRegisterStudentSchema", () => {
  it("accepts a worker registration without an email address", () => {
    const result = publicRegisterStudentSchema.validate({
      teacherId: "6a4c5d666ca790ac78608698",
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
    });

    expect(result.error).toBeUndefined();
  });
});
