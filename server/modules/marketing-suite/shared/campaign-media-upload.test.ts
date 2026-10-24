import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import { signCampaignMediaUpload } from "./campaign-media-upload";

const input = { fileName: "video.mp4", mimeType: "video/mp4", fileSize: 1234, mediaType: "video" };
beforeEach(() => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
  vi.stubEnv("CLOUDINARY_API_KEY", "test-public-key");
  vi.stubEnv("CLOUDINARY_API_SECRET", "test-private-key");
});
afterEach(() => vi.unstubAllEnvs());

it("returns the upload contract expected by Campaign without accepting client signing parameters", () => {
  const result = signCampaignMediaUpload({ ...input, folder: "other-company", timestamp: 1, transformation: "unsafe" }, "ERP", "author");
  expect(result).toMatchObject({ cloudName: "test-cloud", apiKey: "test-public-key", resourceType: "video", folder: "igen_erp/campaign-media/RVJQ/author" });
  expect(result.timestamp).toBeGreaterThan(1);
  expect(result.signature).toBe(cloudinary.utils.api_sign_request({ timestamp: result.timestamp, folder: result.folder }, "test-private-key"));
  expect(result).not.toHaveProperty("apiSecret");
});
it("separates company upload folders", () => {
  expect(signCampaignMediaUpload(input, "ERP-A", "user").folder).not.toBe(signCampaignMediaUpload(input, "ERP-B", "user").folder);
});
it.each([
  { mediaType: "unknown" }, { fileSize: 0 }, { fileSize: Number.NaN }, { fileSize: 201 * 1024 * 1024 },
  { mimeType: "image/png" }, { fileName: "" }, { mediaType: "image", mimeType: "image/png", fileSize: 21 * 1024 * 1024 },
])("rejects invalid upload metadata: %j", (change) => {
  expect(() => signCampaignMediaUpload({ ...input, ...change }, "ERP", "user")).toThrow();
});
it("fails explicitly when the media provider is not configured", () => {
  vi.stubEnv("CLOUDINARY_API_SECRET", "");
  expect(() => signCampaignMediaUpload(input, "ERP", "user")).toThrow("Chưa cấu hình");
});
