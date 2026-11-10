import { describe, expect, it } from "vitest";
import { toAttendanceRosterProfile } from "./attendance-roster";

describe("attendance roster profile", () => {
  it("returns only employee identity fields for attendance views", () => {
    expect(toAttendanceRosterProfile({
      _id: "employee-1",
      displayName: "Nguyễn An",
      email: "an@example.com",
      photoURL: "/avatar.png",
      role: "user",
      branchId: "branch-1",
      monthlySalary: 25000000,
      phone: "0900000000",
      permissions: ["access:manage"],
      password: "secret",
    })).toEqual({
      _id: "employee-1",
      uid: "employee-1",
      displayName: "Nguyễn An",
      email: "an@example.com",
      photoURL: "/avatar.png",
      role: "user",
      branchId: "branch-1",
    });
  });

  it("supports Mongoose documents and profiles without optional fields", () => {
    expect(toAttendanceRosterProfile({
      toObject: () => ({ _id: "employee-2" }),
    })).toEqual({
      _id: "employee-2",
      uid: "employee-2",
      displayName: "",
      email: "",
      photoURL: "",
      role: "user",
      branchId: undefined,
    });
  });
});
