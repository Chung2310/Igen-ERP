// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productCatalogService, subscribeResourceChanges } from "./productCatalogService";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  localStorage.setItem("accessToken", "token");
  productCatalogService.invalidateResourceCache();
});

describe("productCatalogService resource caching and invalidation", () => {
  it("uploads catalog images to permanent storage instead of expiring pending uploads", async () => {
    const url = "https://res.cloudinary.com/test/image/upload/product.png";
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ status: "success", url }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await productCatalogService.uploadMedia(new File(["image"], "product.png", { type: "image/png" }))).toBe(url);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.folder).toBe("igen_erp/inventory/products");
    expect(body.sourceType).toBeUndefined();
    expect(body.file).toMatch(/^data:image\/png;base64,/);
  });
  it("caches listResources responses and avoids duplicate network requests", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: [{ _id: "b1", code: "APPLE", name: "Apple", status: "active" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    // Lần gọi 1: Chưa có cache -> Phải gọi network fetch
    const firstCall = await productCatalogService.listResources("brands");
    expect(firstCall).toHaveLength(1);
    expect(firstCall[0].name).toBe("Apple");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Lần gọi 2: Đã có cache -> Lấy ngay từ RAM, KHÔNG gọi thêm network request nào
    const secondCall = await productCatalogService.listResources("brands");
    expect(secondCall).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Vẫn chỉ là 1 lần duy nhất!
  });

  it("invalidates cache and notifies listeners upon deleteResource", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ success: true, data: { deletedId: "b1" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    let eventReceived: any = null;
    const unsubscribe = subscribeResourceChanges((event) => {
      eventReceived = event;
    });

    // Điền cache trước
    await productCatalogService.listResources("brands");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Xóa một resource
    await productCatalogService.deleteResource("brands", "b1");
    expect(eventReceived).toEqual({
      kind: "brands",
      action: "delete",
      item: { deletedId: "b1" },
    });

    // Lần gọi tiếp theo sau khi xóa -> Cache đã bị invalidate, phải fetch mới để cập nhật
    await productCatalogService.listResources("brands");
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 (list ban đầu) + 1 (delete) + 1 (list mới)

    unsubscribe();
  });

  it("bypasses cache when forceRefresh is true", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await productCatalogService.listResources("categories");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Gọi lại với forceRefresh: true
    await productCatalogService.listResources("categories", { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
