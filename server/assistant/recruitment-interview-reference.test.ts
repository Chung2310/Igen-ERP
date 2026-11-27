import { afterEach, expect, it, vi } from "vitest";

vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: async (_req: unknown, id: string) => operationById(id),
  };
});

import { operationById } from "./catalog";
import { resolveReferences } from "./executor";

afterEach(() => vi.unstubAllGlobals());

it("exposes optional date filters on the applicant history assistant operation", () => {
  const history = operationById("recruitment.applicant.history")!;
  expect(history.fields).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: "query_from", apiKey: "from", source: "query", type: "date", required: false }),
    expect.objectContaining({ key: "query_to", apiKey: "to", source: "query", type: "date", required: false }),
  ]));
});

const applicantId = "507f1f77bcf86cd799439032";
const firstInterviewId = "507f1f77bcf86cd799439042";
const secondInterviewId = "507f1f77bcf86cd799439043";
const branchId = "507f1f77bcf86cd799439012";
const req = {
  user: { id: "actor", companyCode: "TEST", branchId, role: "admin" },
  headers: { authorization: "Bearer scoped" },
  socket: { localPort: 4050, localAddress: "127.0.0.1" },
} as any;
const schedules = [
  { _id: firstInterviewId, applicantId, jobId: "507f1f77bcf86cd799439052", applicantName: "Vân An", scheduledStart: "2026-11-25T02:00:00.000Z", scheduledEnd: "2026-11-25T03:00:00.000Z", status: "scheduled", version: 1, branchId },
  { _id: secondInterviewId, applicantId, jobId: "507f1f77bcf86cd799439052", applicantName: "Vân An", scheduledStart: "2026-11-26T02:00:00.000Z", scheduledEnd: "2026-11-26T03:00:00.000Z", status: "scheduled", version: 3, branchId },
];
const dateLabel = (date: string) => new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date(date));

it("asks for a schedule when an applicant has multiple interviews and resolves a selected date without dispatching a write", async () => {
  const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = String(init?.method || "GET").toUpperCase();
    if (url.pathname === "/api/v1/recruitment/applicants") {
      return new Response(JSON.stringify({ status: "success", data: [{ _id: applicantId, fullName: "Vân An", branchId }] }), { status: 200 });
    }
    if (url.pathname === "/api/v1/recruitment/interviews" && method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: schedules }), { status: 200 });
    }
    if (url.pathname === `/api/v1/recruitment/interviews/${secondInterviewId}` && method === "GET") {
      return new Response(JSON.stringify({ status: "success", data: schedules[1] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "error", message: `Unexpected request ${method} ${url.pathname}` }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const operation = operationById("recruitment.interview.delete")!;

  const ambiguous = await resolveReferences(req, operation, { path_id: "Vân An" } as any);
  expect(ambiguous.errors.join(" ")).toContain("có nhiều bản ghi trùng tên");
  expect(ambiguous.errors.join(" ")).toContain(`Vân An — ${dateLabel(schedules[0].scheduledStart)}`);
  expect(ambiguous.errors.join(" ")).toContain(`Vân An — ${dateLabel(schedules[1].scheduledStart)}`);
  expect(ambiguous.values.path_id).toBe("Vân An");

  const selected = await resolveReferences(req, operation, {
    path_id: `Vân An — ${dateLabel(schedules[1].scheduledStart)}`,
  } as any);
  expect(selected.errors).toEqual([]);
  expect(selected.values).toMatchObject({ path_id: secondInterviewId, version: 3 });
  expect(fetcher.mock.calls.every(([, init]) => String(init?.method || "GET").toUpperCase() === "GET")).toBe(true);
});
