import assert from "node:assert/strict";
import { test } from "vitest";
import { APP_ROUTES } from "../router/route-config";
import {
  FEATURE_INVENTORY,
  getFeatureById,
  getFeaturesForModule,
} from "./feature-inventory";

test("includes an inventory entry for every application route", () => {
  for (const route of APP_ROUTES) {
    assert.ok(
      FEATURE_INVENTORY.some((feature) => feature.module === route.tab),
      `Missing inventory entry for ${route.tab}`
    );
  }
});

test("assigns a unique id to every feature", () => {
  const ids = FEATURE_INVENTORY.map((feature) => feature.id);

  assert.equal(new Set(ids).size, ids.length);
});

test("keeps access depth within the supported navigation levels", () => {
  for (const feature of FEATURE_INVENTORY) {
    assert.ok(feature.accessDepth >= 1 && feature.accessDepth <= 3);
  }
});

test("returns only features belonging to the requested module", () => {
  const module = APP_ROUTES[0].tab;
  const features = getFeaturesForModule(module);

  assert.ok(features.length > 0);
  assert.ok(features.every((feature) => feature.module === module));
});

test("finds a feature by id and returns undefined for an unknown id", () => {
  const feature = FEATURE_INVENTORY[0];

  assert.equal(getFeatureById(feature.id), feature);
  assert.equal(getFeatureById("unknown-feature"), undefined);
});
