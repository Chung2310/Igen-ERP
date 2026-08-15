import assert from "node:assert/strict";
import test from "node:test";
import type { TabType } from "../types";
import { filterEnabledTabs, MODULE_READ_PERMISSIONS, resolveEnabledTab } from "./modules";

const tabs: TabType[] = [
  "TỔNG QUAN",
  "NHÂN SỰ",
  "KHO & SẢN PHẨM",
  "TRÒ CHUYỆN",
  "CÀI ĐẶT",
];

test("filterEnabledTabs keeps permanent tabs and enabled tenant modules", () => {
  assert.deepEqual(filterEnabledTabs(tabs, ["hr", "chat"]), [
    "TỔNG QUAN",
    "NHÂN SỰ",
    "TRÒ CHUYỆN",
    "CÀI ĐẶT",
  ]);
});

test("resolveEnabledTab redirects a disabled module to overview", () => {
  assert.equal(resolveEnabledTab("KHO & SẢN PHẨM", ["hr"]), "TỔNG QUAN");
  assert.equal(resolveEnabledTab("NHÂN SỰ", ["hr"]), "NHÂN SỰ");
});

test("hides student for labor tenants and shows worker", () => {
  assert.deepEqual(
    filterEnabledTabs(["QUẢN LÝ HỌC VIÊN", "QUẢN LÝ LAO ĐỘNG", "NHÂN SỰ"] as any, ["student", "worker", "hr"], "labor" as any),
    ["QUẢN LÝ HỌC VIÊN", "QUẢN LÝ LAO ĐỘNG", "NHÂN SỰ"],
  );
});

test("redirects incompatible business tabs to overview", () => {
  assert.equal(resolveEnabledTab("QUẢN LÝ HỌC VIÊN" as any, ["worker"], "labor" as any), "TỔNG QUAN");
});

test("toggles partner independently from customer", () => {
  assert.deepEqual(
    filterEnabledTabs(["QUẢN LÝ KHÁCH HÀNG", "ĐỐI TÁC"] as any, ["customer"]),
    ["QUẢN LÝ KHÁCH HÀNG"],
  );
  assert.equal(resolveEnabledTab("ĐỐI TÁC" as any, ["customer"]), "TỔNG QUAN");
});

test("maps read and manage access without duplicate module permissions", () => {
  assert.deepEqual(MODULE_READ_PERMISSIONS["NHÂN SỰ"], ["hr:read", "access:read", "work:read", "timekeeping:read"]);
  assert.deepEqual(MODULE_READ_PERMISSIONS["BÁN LẺ"], ["retail:read", "retail:manage"]);
  assert.deepEqual(MODULE_READ_PERMISSIONS["TÀI CHÍNH"], ["finance-wallet:read", "finance-wallet:manage", "finance-receivable:read", "finance-receivable:manage"]);
});
