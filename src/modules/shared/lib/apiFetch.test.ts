// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { workerApiFetch } from "../../worker-management/api/client";
import { apiFetch } from "./apiFetch";
import { refreshAccessToken } from "../../../services/sessionRefresh";

vi.mock("../../../services/sessionRefresh", () => ({ refreshAccessToken: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.removeItem("accessToken");
});

describe("shared apiFetch", () => {
  it("keeps workerApiFetch as the shared apiFetch compatibility export", () => {
    expect(workerApiFetch).toBe(apiFetch);
  });

  it("serializes query options without forwarding internal flags to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/inventory/counts", { params: { warehouseId: "warehouse-1", empty: undefined }, refreshSession: false });
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("warehouseId")).toBe("warehouse-1");
    expect(new URL(url).searchParams.has("empty")).toBe(false);
    expect(options).not.toHaveProperty("params");
    expect(options).not.toHaveProperty("refreshSession");
  });

  it("leaves session recovery to inventory reconciliation when refresh is disabled", async () => {
    localStorage.setItem("accessToken", "existing-session");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Expired" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/inventory/counts/count-1", { refreshSession: false })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(localStorage.getItem("accessToken")).toBe("existing-session");
  });

  it("retains normal ERP session refresh for other requests", async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue("refreshed-session");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/inventory/warehouses")).resolves.toEqual({ data: [] });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer refreshed-session");
  });
});
