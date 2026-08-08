import { describe, expect, it, vi } from "vitest";
import { createResourceFileAccessService } from "./resource-file-access.service";

describe("ResourceFileAccessService", () => {
  it("returns a short-lived signed URL for authenticated Cloudinary assets", () => {
    const signRaw = vi.fn(() => "https://signed.test/private.pdf");
    const service = createResourceFileAccessService({
      signer: { signRaw, signImage: vi.fn() },
      now: () => new Date("2026-08-08T00:00:00Z"),
    });

    const item = service.withReadableFileUrl({
      _id: "resource-1",
      fileUrl: "",
      storageProvider: "cloudinary",
      storagePublicId: "private/raw-1",
      storageResourceType: "raw",
      storageAccess: "authenticated",
    });

    expect(item.fileUrl).toBe("https://signed.test/private.pdf");
    expect(signRaw).toHaveBeenCalledWith("private/raw-1", new Date("2026-08-08T00:05:00Z"));
  });

  it("does not rewrite public file URLs", () => {
    const service = createResourceFileAccessService({
      signer: { signRaw: vi.fn(), signImage: vi.fn() },
    });
    const original = { _id: "resource-1", fileUrl: "https://public.test/file.pdf", storageAccess: "public" as const };

    expect(service.withReadableFileUrl(original)).toEqual(original);
  });
});
