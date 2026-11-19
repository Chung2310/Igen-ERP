import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { leadContractRouter } from "./lead-contract.router";
import { previewLeadReconciliation, reconcileLeadContracts } from "../service/lead-contract-reconciliation";

const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock("../../../../middleware/auth", () => ({
  requirePermission: () => ((req, res, next) => {
    Object.assign(req, { user: { companyCode: "CURRENT_COMPANY" } });
    if (!auth.allowed) return res.status(403).json({ message: "Forbidden" });
    next();
  }) as RequestHandler,
}));
vi.mock("../service/lead-contract-reconciliation", async original => ({
  ...await original<typeof import("../service/lead-contract-reconciliation")>(),
  previewLeadReconciliation: vi.fn(), reconcileLeadContracts: vi.fn(),
}));
let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(leadContractRouter);
  app.use(((error, _req, res, _next) => { void _next; res.status(error.statusCode || 500).json({ message: error.message }); }) as ErrorRequestHandler);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server");
  url = `http://127.0.0.1:${address.port}/lead-contracts`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => { vi.clearAllMocks(); auth.allowed = true; });
function upload(from?: string, to?: string) {
  const body = new FormData();
  body.append("file", new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "bang-ke.xlsx");
  body.append("provider", "FPT"); body.append("year", "2026"); body.append("quarter", "1");
  if (from !== undefined) body.append("from", from);
  if (to !== undefined) body.append("to", to);
  return body;
}
it("accepts the file plus all five filters and uses only the caller's company", async () => {
  vi.mocked(reconcileLeadContracts).mockResolvedValue({ rows: [], excelCount: 0, duplicates: 0, invalidRows: [] });
  const response = await fetch(`${url}/reconcile`, { method: "POST", body: upload("2026-01-01", "2026-03-31") });
  expect(response.status).toBe(200);
  expect(reconcileLeadContracts).toHaveBeenCalledWith("CURRENT_COMPANY", "FPT", 2026, 1, expect.any(Buffer), { from: "2026-01-01", to: "2026-03-31" });
});
it("rejects absent or invalid dates instead of silently reconciling all company Leads", async () => {
  for (const pair of [[undefined, undefined], ["2026-03-01", "2026-02-01"], ["2026-02-30", "2026-03-31"]]) {
    const response = await fetch(`${url}/reconcile`, { method: "POST", body: upload(...pair as [string | undefined, string | undefined]) });
    expect(response.status).toBe(400);
  }
  expect(reconcileLeadContracts).not.toHaveBeenCalled();
});
it("previews the date scope without taking a company from the query string", async () => {
  vi.mocked(previewLeadReconciliation).mockResolvedValue({ from: "2026-01-01", to: "2026-03-31", dateField: "createdAt", leadCount: 3, missingDateCount: 0, invalidCodeCount: 0 });
  const response = await fetch(`${url}/scope?provider=VNPT&from=2026-01-01&to=2026-03-31&companyCode=OTHER`);
  expect(response.status).toBe(200);
  expect(previewLeadReconciliation).toHaveBeenCalledWith("CURRENT_COMPANY", "VNPT", { from: "2026-01-01", to: "2026-03-31" });
});
it("requires management permission for both previews and file comparisons", async () => {
  auth.allowed = false;
  expect((await fetch(`${url}/scope?provider=FPT&from=2026-01-01&to=2026-03-31`)).status).toBe(403);
  expect((await fetch(`${url}/reconcile`, { method: "POST", body: upload("2026-01-01", "2026-03-31") })).status).toBe(403);
  expect(previewLeadReconciliation).not.toHaveBeenCalled();
  expect(reconcileLeadContracts).not.toHaveBeenCalled();
});
