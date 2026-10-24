// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { downloadCampaignMedia } from "./mediaDownloadService";

vi.mock("./authService", () => ({ getAccessToken: () => "test-session" }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("downloads with an Authorization header and uses a temporary blob link", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("image"));
  vi.stubGlobal("fetch", fetcher);
  const create = vi.fn(() => "blob:campaign-file"), revoke = vi.fn();
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.href).toBe("blob:campaign-file"); expect(this.download).toBe("Ảnh 1.png");
  });
  await downloadCampaignMedia("https://res.cloudinary.com/test/image.png", "Ảnh 1.png");
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer test-session" });
  expect(String(fetcher.mock.calls[0][0])).not.toContain("test-session");
  expect(click).toHaveBeenCalledOnce();
  expect(document.querySelector("a")).toBeNull();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(revoke).toHaveBeenCalledWith("blob:campaign-file");
});
it("shows an authentication error instead of downloading an error response", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: "Yêu cầu đăng nhập" }), { status: 401 })));
  await expect(downloadCampaignMedia("https://res.cloudinary.com/file.png", "image.png")).rejects.toThrow("Yêu cầu đăng nhập");
});
