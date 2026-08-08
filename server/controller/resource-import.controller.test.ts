import { describe, expect, it, vi } from "vitest";
import { createResourceImportController } from "./resource-import.controller";

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

describe("resource import controller", () => {
  it("records a completed inventory import in the authenticated tenant", async () => {
    const recordSuccessfulImport = vi.fn(async () => ({ _id: "run-1" }));
    const controller = createResourceImportController({ recordSuccessfulImport });
    const req: any = {
      user: { id: "user-1", companyCode: "ACME", branchId: "b1", email: "a@acme.vn" },
      body: {
        sourceType: "import.inventory-product",
        uploadToken: "token-1",
        fileName: "products.xlsx",
        importedCount: 4,
        skippedCount: 1,
      },
    };
    const res = response();

    await controller.complete(req, res as any);

    expect(recordSuccessfulImport).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "user-1" }),
      expect.objectContaining({ sourceType: "import.inventory-product", importedCount: 4 }),
    );
    expect(res.statusCode).toBe(201);
  });

  it("rejects a non-import source", async () => {
    const recordSuccessfulImport = vi.fn();
    const controller = createResourceImportController({ recordSuccessfulImport });
    const res = response();

    await controller.complete({
      user: { id: "user-1", companyCode: "ACME" },
      body: { sourceType: "hr.contract", uploadToken: "token", fileName: "x.pdf", importedCount: 1 },
    } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(recordSuccessfulImport).not.toHaveBeenCalled();
  });
});
