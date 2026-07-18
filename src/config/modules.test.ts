import assert from "node:assert/strict";
import test from "node:test";
import type { TabType } from "../types";
import { filterEnabledTabs, resolveEnabledTab } from "./modules";

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
