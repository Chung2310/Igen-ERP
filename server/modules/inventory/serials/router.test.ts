import assert from "node:assert/strict";
import test from "node:test";
import { serialUnitRouter } from "./router";

test("serial router exposes list, lifecycle and two-step transfer endpoints", () => {
  const layers = (serialUnitRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
  assert.deepEqual(layers.map((item: any) => item.path), ["/", "/:id/history", "/:id", "/", "/:id/transition", "/:id/transfer", "/:id/transfer/request", "/:id/transfer/accept", "/:id/transfer/cancel"]);
  assert.deepEqual(layers.map((item: any) => item.methods[0]), ["get", "get", "get", "post", "post", "post", "post", "post", "post"]);
});
