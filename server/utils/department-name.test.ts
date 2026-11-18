import { describe, expect, it } from "vitest";
import { matchesDepartmentName, normalizeDepartmentName } from "./department-name";

describe("department name matching", () => {
  it("matches a short query after removing a Vietnamese department prefix", () => {
    expect(matchesDepartmentName("IT Support", "phòng IT")).toBe(true);
  });

  it("ignores accents and extra spaces", () => {
    expect(matchesDepartmentName("Phòng Tài chính", "tai   chinh")).toBe(true);
  });

  it("does not treat an empty query as a match", () => {
    expect(matchesDepartmentName("IT", " ")).toBe(false);
  });

  it("normalizes both department prefix forms", () => {
    expect(normalizeDepartmentName("Phòng ban Công nghệ thông tin")).toBe("cong nghe thong tin");
  });
});
