import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { leadSheetRouter } from "./lead-sheet.router";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { PageCustomerSheetSyncModel } from "../model/page-customer-sheet-sync.model";
import { googleCustomerSheetService } from "../service/google-customer-sheet.service";

const auth = vi.hoisted(() => ({ allowed: true, permission: "" }));
vi.mock("../../../../middleware/auth", () => ({
  requireAuth: ((req, _res, next) => { Object.assign(req, { user: { id: "ADMIN", companyCode: "ACME" } }); next(); }) as RequestHandler,
  requirePermission: (permission: string) => { auth.permission = permission; return ((req, res, next) => auth.allowed ? next() : res.status(403).json({ message: "Forbidden" })) as RequestHandler; },
}));
vi.mock("../../shared/model/social-integration.model", () => ({ SocialIntegrationModel: { findOne: vi.fn() } }));
vi.mock("../model/page-customer-sheet-sync.model", () => ({ PageCustomerSheetSyncModel: { countDocuments: vi.fn(), findOne: vi.fn(), updateMany: vi.fn() } }));
vi.mock("../service/google-customer-sheet.service", () => ({ googleCustomerSheetService: { prepare: vi.fn() } }));
vi.mock("../service/google-order-sheet.service", async original => ({
  ...await original<typeof import("../service/google-order-sheet.service")>(),
  googleOrderSheetService: { serviceAccountEmail: () => "sync@example.com", test: vi.fn() },
}));
let server: Server;
let url: string;
const save = vi.fn();
const integration = { _id: "1234567890abcdef12345678", leadSheetConfig: { enabled: true, spreadsheetId: "SHEET", sheetName: "Leads" }, save };
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/integrations/:integrationId/leads", leadSheetRouter);
  app.use(((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message })) as ErrorRequestHandler);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Test server missing");
  url = `http://127.0.0.1:${address.port}/integrations/${integration._id}/leads`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => {
  vi.clearAllMocks(); auth.allowed = true;
  vi.mocked(SocialIntegrationModel.findOne).mockResolvedValue({ ...integration } as never);
  vi.mocked(PageCustomerSheetSyncModel.countDocuments).mockResolvedValue(0);
  vi.mocked(PageCustomerSheetSyncModel.findOne).mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => null }) }) } as never);
});
it("requires integration-management permission before reading contact sync status", async () => {
  auth.allowed = false;
  expect((await fetch(url)).status).toBe(403);
  expect(auth.permission).toBe("social-integration:manage");
  expect(SocialIntegrationModel.findOne).not.toHaveBeenCalled();
});
it("only loads the caller's company and returns 404 for a foreign Page", async () => {
  vi.mocked(SocialIntegrationModel.findOne).mockResolvedValueOnce(null);
  expect((await fetch(url)).status).toBe(404);
  expect(SocialIntegrationModel.findOne).toHaveBeenCalledWith({ _id: integration._id, companyCode: "ACME", platform: "Facebook" });
  expect(PageCustomerSheetSyncModel.countDocuments).not.toHaveBeenCalled();
});
it("rejects a non-Google destination before touching a Sheet or configuration", async () => {
  const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true, spreadsheetUrl: "https://example.com/spreadsheets/d/SHEET", sheetName: "Leads" }) });
  expect(response.status).toBe(400); expect(save).not.toHaveBeenCalled(); expect(googleCustomerSheetService.prepare).not.toHaveBeenCalled();
});
it("keeps the existing saved setting if the new Sheet is not writable", async () => {
  vi.mocked(googleCustomerSheetService.prepare).mockRejectedValueOnce(new Error("Google Sheet permission denied"));
  const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1234567890abcdefghij/edit", sheetName: "Leads" }) });
  expect(response.status).toBe(500); expect(save).not.toHaveBeenCalled();
});
it("scopes manual retries to the caller's company and selected Page", async () => {
  vi.mocked(PageCustomerSheetSyncModel.updateMany).mockResolvedValue({ modifiedCount: 2 } as never);
  const response = await fetch(url + "/retry", { method: "POST" });
  expect(response.status).toBe(200); expect((await response.json()).data.queued).toBe(2);
  expect(PageCustomerSheetSyncModel.updateMany).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME", integrationId: integration._id }), expect.anything());
});
