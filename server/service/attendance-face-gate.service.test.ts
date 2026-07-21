import { describe, expect, it, vi } from "vitest";
import { verifyAttendanceFace } from "./attendance-face-gate.service";

function deps(reasonCode = "verified") {
  return {
    cloudinary: { uploadPrivateImage: vi.fn().mockResolvedValue({ publicId: "attendance/1", resourceType: "image", type: "authenticated", format: "jpg", bytes: 10 }) },
    insightFace: { verifyEmployee: vi.fn().mockResolvedValue({ registered: true, faceVerified: reasonCode === "verified", live: true, reasonCode }) },
  };
}

describe("verifyAttendanceFace", () => {
  it("accepts only a fully verified registered live face", async () => {
    const dependencies = deps();
    const result = await verifyAttendanceFace({ uid: "u1", image: Buffer.from("x"), mimeType: "image/jpeg" }, dependencies as any);
    expect(result.accepted).toBe(true);
    expect(result.reasonCode).toBe("verified");
    expect(result.evidence.publicId).toBe("attendance/1");
  });

  it.each(["not_registered", "spoof_detected", "face_mismatch"])("rejects %s", async (reasonCode) => {
    const dependencies = deps(reasonCode);
    dependencies.insightFace.verifyEmployee.mockResolvedValue({
      registered: reasonCode !== "not_registered", faceVerified: false,
      live: reasonCode !== "spoof_detected", reasonCode,
    });
    const result = await verifyAttendanceFace({ uid: "u1", image: Buffer.from("x"), mimeType: "image/jpeg" }, dependencies as any);
    expect(result).toEqual(expect.objectContaining({ accepted: false, reasonCode }));
    expect(result.evidenceDeleteAfter).toBeInstanceOf(Date);
  });
});