import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { searchAssistantCommonsImage } from "./image-search";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("searches Commons without an Apify key and returns a compressed image with attribution", async () => {
  vi.stubEnv("APP_URL", "https://example.com");
  vi.stubEnv("APIFY_RESEARCH_ENABLED", "false");
  vi.stubEnv("APIFY_TOKEN", "");
  const thumbnailBytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#2388cc" } }).png().toBuffer();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [{
      title: "File:Artificial_neural_network.png",
      fullurl: "https://commons.wikimedia.org/wiki/File:Artificial_neural_network.png",
      imageinfo: [{
        mime: "image/png",
        thumburl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Artificial_neural_network.png/768px-Artificial_neural_network.png",
        extmetadata: {
          LicenseShortName: { value: "CC BY-SA 4.0" },
          Artist: { value: "<a href=\"https://commons.wikimedia.org/wiki/User:Example\">Example Artist</a>" },
        },
      }],
    }] } }), { status: 200, headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(Uint8Array.from(thumbnailBytes), { status: 200, headers: { "content-type": "image/png", "content-length": String(thumbnailBytes.length) } }));
  vi.stubGlobal("fetch", fetcher);

  const result = await searchAssistantCommonsImage("Mạng neural nhân tạo");

  expect(result?.illustration.url).toMatch(/^data:image\/webp;base64,/);
  expect(result?.illustration.sourceTitle).toBe("Artificial neural network.png");
  expect(result?.illustration.sourceCredit).toContain("Example Artist");
  expect(result?.illustration.sourceCredit).toContain("CC BY-SA 4.0");
  expect(result?.illustration.sourceUrl).toBe("https://commons.wikimedia.org/wiki/File:Artificial_neural_network.png");
  expect(result?.source).toEqual({ title: "Artificial neural network.png", url: "https://commons.wikimedia.org/wiki/File:Artificial_neural_network.png" });
  const requestUrl = new URL(fetcher.mock.calls[0][0] as URL);
  const request = fetcher.mock.calls[0][1] as RequestInit;
  expect(requestUrl.hostname).toBe("commons.wikimedia.org");
  expect(requestUrl.searchParams.get("gsrnamespace")).toBe("6");
  expect(requestUrl.searchParams.get("gsrlimit")).toBe("5");
  expect(requestUrl.searchParams.get("gsrsearch")).toBe("Mạng neural nhân tạo");
  expect(new Headers(request.headers).get("user-agent")).toContain("https://example.com");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("skips Commons files without a license and rejects image URLs outside Wikimedia", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [
    {
      title: "File:No license.png",
      fullurl: "https://commons.wikimedia.org/wiki/File:No_license.png",
      imageinfo: [{ mime: "image/png", thumburl: "https://upload.wikimedia.org/no-license.png", extmetadata: {} }],
    },
    {
      title: "File:Untrusted.png",
      fullurl: "https://commons.wikimedia.org/wiki/File:Untrusted.png",
      imageinfo: [{ mime: "image/png", thumburl: "https://example.com/image.png", extmetadata: { LicenseShortName: { value: "CC BY 4.0" } } }],
    },
  ] } }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);

  await expect(searchAssistantCommonsImage("Commons license test" )).resolves.toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});

it("returns no image when Commons has no matching file", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [] } }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);

  await expect(searchAssistantCommonsImage("No Commons result test")).resolves.toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});
