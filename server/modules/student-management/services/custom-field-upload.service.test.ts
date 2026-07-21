import assert from "node:assert/strict";
import test from "node:test";
import { CustomFieldUploadService, detectUploadedMime } from "./custom-field-upload.service";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const definition = {
  _id: "field-1", tenantId: "tenant-a", moduleKey: "students", key: "photo", label: "Photo", type: "image",
  validation: { maxSizeMb: 1, allowedMimeTypes: ["image/png"] }, isVisible: true, isArchived: false,
};

function file(buffer = png, mimetype = "image/png") {
  return { buffer, mimetype, originalname: "photo.png", size: buffer.length } as Express.Multer.File;
}

test("detects uploaded MIME from bytes rather than trusting multipart metadata", () => {
  assert.equal(detectUploadedMime(png), "image/png");
  assert.equal(detectUploadedMime(Buffer.from("%PDF-1.7")), "application/pdf");
});

test("authenticated custom-field upload lookup stays tenant/module/field scoped and returns server metadata", async () => {
  const filters: unknown[] = [];
  const service = new CustomFieldUploadService({
    async findOne(filter) { filters.push(filter); return definition as any; },
  }, async () => ({ secure_url: "https://cdn.example/photo.png", public_id: "tenant-a/students/photo/asset" }));
  const result = await service.upload("tenant-a", "students", "field-1", file());
  assert.deepEqual(filters, [{ _id: "field-1", tenantId: "tenant-a", moduleKey: "students", isArchived: false, isVisible: true, type: { $in: ["file", "image", "multiImage"] } }]);
  assert.deepEqual(result, {
    url: "https://cdn.example/photo.png", fileName: "photo.png", mimeType: "image/png", size: png.length,
    reference: "tenant-a/students/photo/asset",
  });
});

test("rejects a declared MIME mismatch and enforces definition size from actual bytes", async () => {
  const mismatch = new CustomFieldUploadService({ async findOne() { return definition as any; } }, async () => { throw new Error("must not upload"); });
  await assert.rejects(() => mismatch.upload("tenant-a", "students", "field-1", file(png, "application/pdf")), /không khớp/i);

  const tinyLimit = { ...definition, validation: { ...definition.validation, maxSizeMb: 0.000001 } };
  const oversized = new CustomFieldUploadService({ async findOne() { return tinyLimit as any; } }, async () => { throw new Error("must not upload"); });
  await assert.rejects(() => oversized.upload("tenant-a", "students", "field-1", file()), /dung lượng/i);
});
