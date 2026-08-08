import { describe, expect, it } from "vitest";
import {
  parseWorkerDeviceCredential,
  workerDeviceCookieOptions,
} from "./worker-device.service";

describe("worker device credential helpers", () => {
  it("accepts only versioned, three-part device credentials", () => {
    expect(parseWorkerDeviceCredential("v1.device-id.secret-value")).toEqual({
      credentialId: "device-id",
      secret: "secret-value",
    });
    expect(parseWorkerDeviceCredential("v1.device-id")).toBeNull();
    expect(parseWorkerDeviceCredential("v2.device-id.secret-value")).toBeNull();
    expect(parseWorkerDeviceCredential("v1.device-id.secret-value.extra")).toBeNull();
  });

  it("uses an HttpOnly, same-site cookie scoped to public worker QR APIs", () => {
    const expiresAt = new Date("2027-01-01T00:00:00.000Z");
    expect(workerDeviceCookieOptions(expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/v1/worker-management/qr-attendance",
      expires: expiresAt,
    });
  });
});
