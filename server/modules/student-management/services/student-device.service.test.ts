import { describe, expect, it } from "vitest";
import {
  parseStudentDeviceCredential,
  studentDeviceCookieOptions,
} from "./student-device.service";

describe("student device credential helpers", () => {
  it("accepts only versioned, three-part device credentials", () => {
    expect(parseStudentDeviceCredential("v1.device-id.secret-value")).toEqual({
      credentialId: "device-id",
      secret: "secret-value",
    });
    expect(parseStudentDeviceCredential("v1.device-id")).toBeNull();
    expect(parseStudentDeviceCredential("v2.device-id.secret-value")).toBeNull();
    expect(parseStudentDeviceCredential("v1.device-id.secret-value.extra")).toBeNull();
  });

  it("uses an HttpOnly, same-site cookie scoped to public QR APIs", () => {
    const expiresAt = new Date("2027-01-01T00:00:00.000Z");
    expect(studentDeviceCookieOptions(expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/v1/qr-attendance",
      expires: expiresAt,
    });
  });
});
