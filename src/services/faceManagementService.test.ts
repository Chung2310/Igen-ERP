import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canManageFaces,
  deleteFaceEnrollment,
  enrollFace,
  getFaceEnrollmentStatus,
} from "./faceManagementService";

describe("faceManagementService", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{ role: "superadmin" }, true],
    [{ role: "admin" }, true],
    [{ role: "manager", permissions: ["access:manage"] }, true],
    [{ role: "user", permissions: ["*"] }, true],
    [{ role: "manager", permissions: [] }, false],
  ])("calculates face-management access", (profile, expected) => {
    expect(canManageFaces(profile as never)).toBe(expected);
  });

  it("loads typed enrollment status with bearer auth", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ registered: true }), { status: 200 }));
    await expect(getFaceEnrollmentStatus("u 1")).resolves.toEqual({ registered: true });
    expect(fetch).toHaveBeenCalledWith("/api/v1/face-management/users/u%201", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("posts a JPEG using multipart field file", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ registered: true, operation: "register" }), { status: 200 }));
    const image = new Blob(["jpeg"], { type: "image/jpeg" });
    await enrollFace("u1", image);
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("deletes an enrollment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteFaceEnrollment("u1")).resolves.toBeUndefined();
  });
});
