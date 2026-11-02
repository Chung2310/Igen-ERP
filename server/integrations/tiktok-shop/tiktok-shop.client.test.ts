import { describe, expect, it } from "vitest";
import { signTikTokShopRequest } from "./tiktok-shop.client";

describe("TikTok Shop request signing", () => {
  it("is deterministic regardless of query parameter insertion order", () => {
    const first = signTikTokShopRequest("/product/202309/products/search", { timestamp: "123", shop_cipher: "abc", app_key: "key" }, '{"status":"ALL"}', "secret");
    const second = signTikTokShopRequest("/product/202309/products/search", { app_key: "key", shop_cipher: "abc", timestamp: "123" }, '{"status":"ALL"}', "secret");
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("excludes sign and legacy access_token parameters", () => {
    const base = signTikTokShopRequest("/authorization/202309/shops", { app_key: "key", timestamp: "123" }, "", "secret");
    const withExcludedValues = signTikTokShopRequest("/authorization/202309/shops", { app_key: "key", timestamp: "123", sign: "old", access_token: "legacy" }, "", "secret");
    expect(withExcludedValues).toBe(base);
  });

  it("includes the JSON body in the signature", () => {
    const empty = signTikTokShopRequest("/product/202309/products/search", { app_key: "key", timestamp: "123" }, "", "secret");
    const withBody = signTikTokShopRequest("/product/202309/products/search", { app_key: "key", timestamp: "123" }, '{"status":"ALL"}', "secret");
    expect(withBody).not.toBe(empty);
  });
});
