import assert from "node:assert/strict";
import test from "node:test";
import { customerRouter } from "./router";

const routeEntries = () => customerRouter.stack
  .filter((layer: any) => layer.route)
  .map((layer: any) => ({
    path: layer.route.path,
    method: Object.keys(layer.route.methods).find((method) => layer.route.methods[method]),
    handlers: layer.route.stack.length,
  }));

test("customer routes expose reads before the parameterized detail route", () => {
  const entries = routeEntries();
  assert.deepEqual(entries.map(({ method, path }) => `${method} ${path}`), [
    "get /settings", "patch /settings",
    "get /", "get /search", "post /", "post /quick", "get /:id/purchase-history", "get /:id", "patch /:id",
    "post /:id/activate", "post /:id/deactivate",
    "get /:id/billing-profiles", "post /:id/billing-profiles",
  ]);
  assert.ok(entries.every((entry) => {
    if (entry.path === "/settings" && entry.method === "patch") return entry.handlers === 3;
    return entry.handlers === 2;
  }), "every route must include appropriate middleware stack");
  assert.ok(entries.findIndex((entry) => entry.path === "/search") < entries.findIndex((entry) => entry.path === "/:id"));
  assert.ok(entries.findIndex((entry) => entry.path === "/quick") < entries.findIndex((entry) => entry.path === "/:id"));
  assert.ok(entries.findIndex((entry) => entry.path === "/:id/purchase-history") < entries.findIndex((entry) => entry.path === "/:id"));
});
