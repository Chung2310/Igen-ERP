import { afterEach, describe, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./api", () => ({ api: client.api }));
import { loadCatalogProducts } from "./catalog-api";
describe("quotation catalog paging", () => {
  afterEach(() => vi.resetAllMocks());
  it("loads every page for product selection and excludes inactive products on the server", async () => {
    client.api.mockResolvedValueOnce({ items: [{ _id: "first" }], nextPage: 2 }).mockResolvedValueOnce({ items: [{ _id: "last" }], nextPage: null });
    expect((await loadCatalogProducts()).items.map(item => item._id)).toEqual(["first", "last"]);
    expect(client.api.mock.calls.map(call => call[0])).toEqual(["/api/catalog?page=1&pageSize=1000&status=active", "/api/catalog?page=2&pageSize=1000&status=active"]);
  });
  it("retains deleted products when refreshing price-book management", async () => {
    client.api.mockResolvedValue({ items: [{ _id: "deleted", deletedAt: "2026-11-06" }], nextPage: null });
    expect((await loadCatalogProducts(true)).items).toHaveLength(1);
    expect(client.api.mock.calls[0][0]).toContain("includeDeleted=all");
  });
});
