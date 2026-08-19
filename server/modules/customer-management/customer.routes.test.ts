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
    "get /", "get /search", "post /", "post /quick", "get /:id", "patch /:id",
    "post /:id/activate", "post /:id/deactivate",
  ]);
  assert.ok(entries.every((entry) => entry.handlers === 2), "every route must include one permission guard and one controller");
  assert.ok(entries.findIndex((entry) => entry.path === "/search") < entries.findIndex((entry) => entry.path === "/:id"));
  assert.ok(entries.findIndex((entry) => entry.path === "/quick") < entries.findIndex((entry) => entry.path === "/:id"));
});
