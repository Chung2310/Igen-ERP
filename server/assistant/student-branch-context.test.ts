import { afterEach, expect, it, vi } from "vitest";
import { operationById } from "./catalog";
import { callOperation, lookupRecords, resolveReferences } from "./executor";

vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "507f1f77bcf86cd799439020", companyCode: "ACME" }),
    assertOperation: async (_req: unknown, id: string) => operationById(id),
  };
});

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["batch.capacity.report", { success: true, batches: [], total: 0, page: 1 }],
  ["student.learning-roadmap.waitlist.count", { success: true, total: 0 }],
])("uses the selected branch header for %s without adding a branch query", async (operationId, payload) => {
  const branchId = "507f1f77bcf86cd799439024";
  const operation = operationById(operationId)!;
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);

  await callOperation({
    user: { id: "company-admin", uid: "company-admin", companyCode: "ACME", role: "admin" },
    headers: { authorization: "Bearer test" },
    socket: { localAddress: "127.0.0.1", localPort: 4050 },
  } as any, operation, { targetBranch: branchId, page: 1, limit: 100 } as any);

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
  const requestUrl = new URL(String(url));
  const headers = new Headers(init.headers);
  expect(headers.get("x-branch-id")).toBe(branchId);
  expect(requestUrl.searchParams.has("branchId")).toBe(false);
});

it("uses the authenticated current branch when resolving a class name", async () => {
  const branchId = "507f1f77bcf86cd799439024";
  const batch = {
    _id: "507f1f77bcf86cd799439025",
    code: "LOP-EXCEL",
    name: "Excel căn bản - lớp buổi tối",
    courseTitle: "Excel căn bản cho người mới",
    branchId,
  };
  const fetchMock = vi.fn(async (url: string | URL) => new Response(JSON.stringify(
    new URL(String(url)).pathname.endsWith("/batches")
      ? { success: true, batches: [batch], total: 1 }
      : { success: true, branches: [{ _id: branchId, name: "ACME - HN" }] },
  ), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  const rows = await lookupRecords({
    user: { id: "company-admin", uid: "company-admin", companyCode: "ACME", role: "admin", branchId },
    headers: { authorization: "Bearer test" },
    socket: { localAddress: "127.0.0.1", localPort: 4050 },
  } as any, "batch.list", "Excel căn bản");

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: batch._id, name: batch.name });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
  expect(new URL(String(url)).pathname).toBe("/api/v1/batches");
  expect(new Headers(init.headers).get("x-branch-id")).toBe(branchId);
});

it.each(["Excel căn bản", "Excel"])("resolves the partial class name %s in the current branch", async classSearch => {
  const branchId = "507f1f77bcf86cd799439024";
  const batch = {
    _id: "507f1f77bcf86cd799439025",
    code: "LOP-EXCEL",
    name: "Excel căn bản - lớp buổi tối",
    courseTitle: "Excel căn bản cho người mới",
    branchId,
  };
  const fetchMock = vi.fn(async (url: string | URL) => new Response(JSON.stringify(
    new URL(String(url)).pathname.endsWith("/batches")
      ? { success: true, batches: [batch], total: 1 }
      : { success: true, branches: [{ _id: branchId, name: "ACME - HN" }] },
  ), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  const result = await resolveReferences({
    user: { id: "company-admin", uid: "company-admin", companyCode: "ACME", role: "admin", branchId },
    headers: { authorization: "Bearer test" },
    socket: { localAddress: "127.0.0.1", localPort: 4050 },
  } as any, operationById("student.batch.attendance.summary")!, { path_id: classSearch, date: "2026-11-27" } as any);

  expect(result.values.path_id).toBe(batch._id);
  expect(result.errors).toEqual([]);
});
