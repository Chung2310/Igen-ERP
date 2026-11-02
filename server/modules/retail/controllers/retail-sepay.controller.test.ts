import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { CompanyModel } from "../../../model/company.model";
import { retailSePayController } from "./retail-sepay.controller";

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

test("webhook rejects requests without authentication", async () => {
  const res = response();
  await retailSePayController.webhook({ headers: {}, body: {} } as Request, res as unknown as Response);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, message: "Unauthorized" });
});

test("webhook responds with a retryable error when company authentication fails to load", async () => {
  const originalFind = CompanyModel.find;
  CompanyModel.find = (() => { throw new Error("Company lookup unavailable"); }) as typeof originalFind;
  const candidate = `test-key-${process.env.SEPAY_API_KEY || process.env.WEBHOOK_SECRET || "none"}`;
  const res = response();
  try {
    await retailSePayController.webhook({
      headers: { authorization: `Apikey ${candidate}` },
      body: { accountNumber: "1234567890" },
    } as Request, res as unknown as Response);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, message: "Company lookup unavailable" });
  } finally {
    CompanyModel.find = originalFind;
  }
});
