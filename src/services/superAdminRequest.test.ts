import { beforeEach, expect, test, vi } from "vitest";
import { getSuperAdminDeviceId, superAdminRequest } from "./superAdminRequest";

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

test("reuses a canonical device id and replaces malformed storage", () => {
  const valid = "550e8400-e29b-41d4-a716-446655440000";
  localStorage.setItem("igen_super_admin_device_id_v1", valid);
  expect(getSuperAdminDeviceId()).toBe(valid);
  localStorage.setItem("igen_super_admin_device_id_v1", "broken");
  expect(getSuperAdminDeviceId(localStorage, () => "6ba7b810-9dad-41d1-80b4-00c04fd430c8")).toBe("6ba7b810-9dad-41d1-80b4-00c04fd430c8");
});

test("attaches the device id and bearer token to requests", async () => {
  localStorage.setItem("igen_super_admin_device_id_v1", "550e8400-e29b-41d4-a716-446655440000");
  localStorage.setItem("accessToken", "root-token");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  await superAdminRequest("/api/v1/super-admin/environment");
  const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const headers = new Headers(requestInit.headers);
  expect(headers.get("x-device-id")).toBe("550e8400-e29b-41d4-a716-446655440000");
  expect(headers.get("authorization")).toBe("Bearer root-token");
});
