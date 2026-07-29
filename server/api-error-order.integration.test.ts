import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import { apiErrorHandler } from "./middleware/api-error-handler";
import { apiNotFound } from "./middleware/api-not-found";
import { requestContextMiddleware } from "./middleware/request-context";

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  app.use("/api/v1", requestContextMiddleware);
  app.use(express.json({ limit: "32b" }));
  app.post("/api/v1/echo", (req, res) => res.json(req.body));
  app.get("/api/v1/rejected", (_req, _res, next) => Promise.reject(new Error("database down")).catch(next));
  app.use("/api/v1", apiNotFound);
  app.use(apiErrorHandler);
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.close(); await once(server, "close"); }
}

test("body parser, route and unexpected errors use the API envelope", async () => {
  await withServer(async (base) => {
    const malformed = await fetch(`${base}/api/v1/echo`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{bad",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json() as any).error.code, "MALFORMED_JSON");

    const oversized = await fetch(`${base}/api/v1/echo`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(100) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json() as any).error.code, "PAYLOAD_TOO_LARGE");

    const missing = await fetch(`${base}/api/v1/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json() as any).error.code, "API_ROUTE_NOT_FOUND");

    const rejected = await fetch(`${base}/api/v1/rejected`);
    assert.equal(rejected.status, 500);
    assert.equal((await rejected.json() as any).error.code, "INTERNAL_ERROR");

    const staticMissing = await fetch(`${base}/missing`);
    assert.equal(staticMissing.status, 404);
    assert.match(staticMissing.headers.get("content-type") ?? "", /^text\/html/);
  });
});