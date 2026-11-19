import { describe, expect, it } from "vitest";
import { catalogIdempotencyKeyFor, type CatalogRequestAttempt } from "./catalog-idempotency";

describe("catalog idempotency keys", () => {
  it("reuses a key for the same payload and rotates it when the payload changes", () => {
    const attempt: CatalogRequestAttempt = { key: "", fingerprint: "" };
    let nextKey = 0;
    const createKey = () => `request-${++nextKey}`;

    const first = catalogIdempotencyKeyFor(attempt, { sku: "A", price: 10 }, createKey);
    const retry = catalogIdempotencyKeyFor(attempt, { sku: "A", price: 10 }, createKey);
    const edited = catalogIdempotencyKeyFor(attempt, { sku: "A", price: 20 }, createKey);

    expect(first).toBe("request-1");
    expect(retry).toBe(first);
    expect(edited).toBe("request-2");
  });
});
