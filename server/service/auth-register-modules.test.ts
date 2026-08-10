import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeModuleKeys, DEFAULT_MODULE_KEYS } from "../config/module-keys";

test("giữ nguyên danh sách key hợp lệ, bỏ trùng", () => {
  assert.deepEqual(sanitizeModuleKeys(["hr", "inventory", "hr"]), ["hr", "inventory"]);
});

test("loại key rác", () => {
  assert.deepEqual(sanitizeModuleKeys(["hr", "hack", 5, null]), ["hr"]);
});

test("rỗng hoặc không phải mảng → bật module mặc định nhưng không tự bật retail", () => {
  assert.deepEqual(sanitizeModuleKeys([]), [...DEFAULT_MODULE_KEYS]);
  assert.deepEqual(sanitizeModuleKeys(undefined), [...DEFAULT_MODULE_KEYS]);
  assert.deepEqual(sanitizeModuleKeys(["hack"]), [...DEFAULT_MODULE_KEYS]);
});
