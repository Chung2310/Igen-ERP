// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { authService } from "./authService";

afterEach(() => vi.unstubAllGlobals());

test("getColleagues excludes inactive users", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
    { _id: "active-tech", displayName: "Active technician", isActive: true },
    { _id: "inactive-tech", displayName: "Inactive technician", isActive: false },
  ] }), { status: 200 })));

  await expect(authService.getColleagues()).resolves.toEqual([
    expect.objectContaining({ uid: "active-tech", isActive: true }),
  ]);
});
