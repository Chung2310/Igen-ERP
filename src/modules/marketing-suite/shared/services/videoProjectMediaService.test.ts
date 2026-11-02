// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { uploadEditorMedia } from "./videoProjectMediaService";

vi.mock("./authService", () => ({ getAccessToken: () => "test-session" }));
afterEach(() => vi.unstubAllGlobals());
it("uploads Campaign video through its own signing route with the expected contract", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: { cloudName: "test-cloud", apiKey: "public", signature: "signed", timestamp: 123, folder: "company-folder", resourceType: "video" } })));
  vi.stubGlobal("fetch", fetcher);
  const forms: FormData[] = [];
  class UploadRequest {
    upload = {}; status = 200; responseText = JSON.stringify({ secure_url: "https://res.cloudinary.com/test/video.mp4" });
    onload?: () => void;
    open(method: string, url: string) { expect(method).toBe("POST"); expect(url).toBe("https://api.cloudinary.com/v1_1/test-cloud/video/upload"); }
    send(form: FormData) { forms.push(form); this.onload?.(); }
  }
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const result = await uploadEditorMedia(new File(["video"], "test.mov"));
  expect(result).toMatchObject({ url: "https://res.cloudinary.com/test/video.mp4", mediaType: "video" });
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/marketing-media/campaign-sign-upload");
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ fileName: "test.mov", mimeType: "video/quicktime", mediaType: "video", fileSize: 5 });
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer test-session" });
  expect(forms[0].get("folder")).toBe("company-folder");
  expect(forms[0].get("signature")).toBe("signed");
});
