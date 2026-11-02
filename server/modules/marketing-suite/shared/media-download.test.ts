import { expect, it, vi } from "vitest";
import { downloadMarketingMedia } from "./media-download";

it.each([
  "http://127.0.0.1/private", "http://169.254.169.254/latest/meta-data/", "http://[::1]/private",
  "https://res.cloudinary.com.evil.test/file", "file:///etc/passwd", "data:text/plain,secret",
  "https://user:secret@res.cloudinary.com/file", "https://res.cloudinary.com:8443/file",
])("rejects unsafe download URL before fetching: %s", async (url) => {
  const fetcher = vi.fn<typeof fetch>();
  await expect(downloadMarketingMedia(url, fetcher)).rejects.toHaveProperty("statusCode");
  expect(fetcher).not.toHaveBeenCalled();
});

it("checks redirect destinations before issuing another request", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
  await expect(downloadMarketingMedia("https://res.cloudinary.com/file", fetcher)).rejects.toHaveProperty("statusCode", 403);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
});

it("follows a relative redirect on an allowed domain", async () => {
  const result = new Response("media");
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/final" } }))
    .mockResolvedValueOnce(result);
  expect(await downloadMarketingMedia("https://res.cloudinary.com/file", fetcher)).toBe(result);
  expect(fetcher.mock.calls[1][0]).toBe("https://res.cloudinary.com/final");
});

it("caps redirect loops", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/loop" } }));
  await expect(downloadMarketingMedia("https://res.cloudinary.com/file", fetcher)).rejects.toHaveProperty("statusCode", 502);
  expect(fetcher).toHaveBeenCalledTimes(6);
});
