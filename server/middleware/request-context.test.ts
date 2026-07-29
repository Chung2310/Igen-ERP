import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { getRequestContext, requestContextMiddleware } from "./request-context";

function run(header?: string) {
  const req = { get: (name: string) => name.toLowerCase() === "x-request-id" ? header : undefined } as Request;
  const headers: Record<string, string> = {};
  const res = { setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; } } as unknown as Response;
  let called = false;
  requestContextMiddleware(req, res, (() => { called = true; }) as NextFunction);
  return { context: getRequestContext(req), headers, called };
}

test("keeps a valid caller request id and returns it in the response header", () => {
  const result = run("client_Req-123.abc");
  assert.equal(result.context.requestId, "client_Req-123.abc");
  assert.equal(result.headers["x-request-id"], "client_Req-123.abc");
  assert.equal(result.called, true);
});

test("replaces unsafe, oversized and control-character request ids", () => {
  for (const value of ["a".repeat(129), "bad id", "bad\nvalue"]) {
    const { context } = run(value);
    assert.match(context.requestId, /^[0-9a-f-]{36}$/i);
    assert.notEqual(context.requestId, value);
  }
});