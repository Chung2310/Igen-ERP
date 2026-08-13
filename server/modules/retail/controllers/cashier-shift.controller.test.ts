import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { cashierShiftController } from "./cashier-shift.controller";
import { CashierShiftService } from "../services/cashier-shift.service";

test("close forwards service errors to Express error middleware", async () => {
  const originalClose = CashierShiftService.close;
  const expectedError = Object.assign(new Error("Counted cash is invalid"), { status: 400 });
  const req = {
    body: { countedCash: -1 },
    params: { id: "shift-1" },
    query: {},
    user: { id: "user-1", companyCode: "COMPANY", branchId: "BRANCH" },
  } as unknown as Request;
  let responseBody: unknown;
  const res = {
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  const forwardedErrors: unknown[] = [];
  const next = ((error?: unknown) => {
    forwardedErrors.push(error);
  }) as NextFunction;

  CashierShiftService.close = async () => {
    throw expectedError;
  };

  try {
    await (cashierShiftController.close as unknown as (
      request: Request,
      response: Response,
      nextFunction: NextFunction,
    ) => Promise<void>)(req, res, next);

    assert.deepEqual(forwardedErrors, [expectedError]);
    assert.equal(responseBody, undefined);
  } finally {
    CashierShiftService.close = originalClose;
  }
});
