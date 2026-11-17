import { afterEach, expect, it, vi } from "vitest";
vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id: string) => operationById(id)),
  };
});

import { operationById } from "./catalog";
import { resolveReferences } from "./executor";

const employeeId = "507f1f77bcf86cd799439022";
const branchId = "507f1f77bcf86cd799439012";
const date = "2026-11-16";
const req = {
  user: { id: "actor", companyCode: "TEST", branchId, role: "admin" },
  headers: { authorization: "Bearer scoped" },
  socket: { localPort: 4050, localAddress: "127.0.0.1" },
} as any;
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

it("resolves the employee and sends the adjustment by employee and date without requiring an existing log", async () => {
  const fetcher = vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/auth/users") return json([
      { _id: employeeId, id: employeeId, displayName: "Cường", branchId },
    ]);
    if (url.pathname === "/api/v1/auth/branches") return json({ data: [
      { _id: branchId, id: branchId, name: "Trụ sở chính", code: "TSC" },
    ] });
    throw new Error(`Unexpected API request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);

  const operation = operationById("timekeeping.record.update")!;
  const result = await resolveReferences(req, operation, {
    employeeId: "Cường — Chi nhánh Trụ sở chính",
    date,
    checkInTime: "07:59",
    checkOutTime: "18:00",
    editReason: "đi công tác",
  });

  expect(result.errors).toEqual([]);
  expect(result.values).toMatchObject({ employeeId, date, checkInTime: "07:59", checkOutTime: "18:00" });
  expect(result.values).not.toHaveProperty("path_id");
  expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).pathname === "/api/v1/crud/timekeeping-logs")).toBe(false);
});
