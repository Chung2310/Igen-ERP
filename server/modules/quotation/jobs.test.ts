import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { clearEstimateDraftExportMarker } from "./jobs";

const sourceId = "507f1f77bcf86cd799439011";

afterEach(() => vi.restoreAllMocks());

describe("clearEstimateDraftExportMarker", () => {
  it("clears the pending marker for the source estimate", async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    const collection = vi.fn().mockReturnValue({ updateOne });
    const db = { collection } as unknown as Db;

    await expect(clearEstimateDraftExportMarker(db, sourceId)).resolves.toBe(true);

    expect(collection).toHaveBeenCalledWith("quotes");
    expect(updateOne).toHaveBeenCalledWith(
      { _id: expect.objectContaining({ _bsontype: "ObjectId" }) },
      { $unset: { fileCreationPending: "" } },
    );
  });

  it("does not turn a completed export into a failed job when marker cleanup fails", async () => {
    const updateOne = vi.fn().mockRejectedValue(new Error("quote marker store unavailable"));
    const db = { collection: vi.fn().mockReturnValue({ updateOne }) } as unknown as Db;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(clearEstimateDraftExportMarker(db, sourceId)).resolves.toBe(false);

    expect(error).toHaveBeenCalledWith(
      "[quotation-worker] Export completed but draft marker cleanup failed:",
      "quote marker store unavailable",
    );
  });
});
