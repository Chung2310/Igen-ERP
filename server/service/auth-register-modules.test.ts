import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeModuleKeys, MODULE_KEYS } from "../config/module-keys";

test("giữ nguyên danh sách key hợp lệ, bỏ trùng", () => {
  assert.deepEqual(sanitizeModuleKeys(["hr", "inventory", "hr"]), ["hr", "inventory"]);
});

test("loại key rác", () => {
  assert.deepEqual(sanitizeModuleKeys(["hr", "hack", 5, null]), ["hr"]);
});

test("rỗng hoặc không phải mảng → bật tất cả", () => {
  assert.deepEqual(sanitizeModuleKeys([]), [...MODULE_KEYS]);
  assert.deepEqual(sanitizeModuleKeys(undefined), [...MODULE_KEYS]);
  assert.deepEqual(sanitizeModuleKeys(["hack"]), [...MODULE_KEYS]);
});
