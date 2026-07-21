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

test("accepts docx and doc matching rules", async () => {
  const docxField = {
    ...definition,
    type: "file",
    validation: { maxSizeMb: 10, allowedMimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] }
  };
  const docxService = new CustomFieldUploadService(
    { async findOne() { return docxField as any; } },
    async () => ({ secure_url: "https://cdn.example/doc.docx", public_id: "tenant-a/students/doc/asset" })
  );
  // docx magic bytes is ZIP: [0x50, 0x4b, 0x03, 0x04]
  const docxFile = {
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]),
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    originalname: "test.docx",
    size: 7
  } as Express.Multer.File;
  const docxResult = await docxService.upload("tenant-a", "students", "field-1", docxFile);
  assert.equal(docxResult.mimeType, "application/zip"); // actual mime type detected from buffer

  const docField = {
    ...definition,
    type: "file",
    validation: { maxSizeMb: 10, allowedMimeTypes: ["application/msword"] }
  };
  const docService = new CustomFieldUploadService(
    { async findOne() { return docField as any; } },
    async () => ({ secure_url: "https://cdn.example/doc.doc", public_id: "tenant-a/students/doc/asset" })
  );
  // doc magic bytes is OLE: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  const docFile = {
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    mimetype: "application/msword",
    originalname: "test.doc",
    size: 8
  } as Express.Multer.File;
  const docResult = await docService.upload("tenant-a", "students", "field-1", docFile);
  assert.equal(docResult.mimeType, "application/x-ole-storage"); // actual mime type detected from buffer
});
