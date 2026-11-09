import { afterEach, expect, it, vi } from "vitest";
vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return { assertOperation: vi.fn((_req, id: string) => operationById(id)), actorScope: () => ({ userId: "actor", companyCode: "TEST" }) };
});
import { ASSISTANT_OPERATIONS } from "./catalog";
import { callOperation } from "./executor";

afterEach(() => vi.unstubAllGlobals());

it("sends customer notes as additions so existing profile notes are preserved", async () => {
  const customerId = "507f1f77bcf86cd7994390a1";
  const req = { user: { id: "actor", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
  const fetcher = vi.fn(async (_url: URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true, data: { _id: customerId, name: "An", phone: "0901234567", version: 5 } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const operation = ASSISTANT_OPERATIONS.find(item => item.id === "customer.update")!;
  await callOperation(req, operation, { path_id: customerId, notes: "Ngân sách: 50 triệu", version: 4 } as any);
  expect(new URL(String(fetcher.mock.calls[0][0])).pathname).toBe(`/api/v1/customers/${customerId}`);
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body).toMatchObject({ additionalNotes: "Ngân sách: 50 triệu", version: 4 });
  expect(body).not.toHaveProperty("notes");
});
