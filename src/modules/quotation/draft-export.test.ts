import { beforeEach, describe, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ exportFile: vi.fn(), latest: vi.fn(), api: vi.fn(), allowed: true }));
vi.mock("./api", () => ({ createGeneratedExport: client.exportFile, getLatestGeneratedFile: client.latest, api: client.api, hasQuotationCapability: () => client.allowed }));
import { createSavedDraftEstimateFile } from "./draft-export";

describe("draft persistence when file generation fails", () => {
  beforeEach(() => { vi.clearAllMocks(); client.allowed = true; client.latest.mockResolvedValue({ file: null }); });
  it.each(["Hết lượt AI", "OpenRouter timeout", "Không kết nối Cloudinary"])("keeps the saved draft after %s", async message => {
    client.exportFile.mockRejectedValueOnce(new Error(message));
    expect(await createSavedDraftEstimateFile("quote-id", vi.fn())).toContain("Bản nháp đã được giữ lại");
    expect(client.api).not.toHaveBeenCalled();
  });
  it("does not navigate into a previous company after its request was cancelled", async () => {
    client.exportFile.mockRejectedValueOnce(new DOMException("Đổi chi nhánh", "AbortError"));
    await expect(createSavedDraftEstimateFile("quote-id", vi.fn())).rejects.toMatchObject({ name: "AbortError" });
    expect(client.latest).not.toHaveBeenCalled(); expect(client.api).not.toHaveBeenCalled();
  });
  it("recognizes a file that completed after the client lost its response", async () => {
    client.exportFile.mockRejectedValueOnce(new Error("Timeout")); client.latest.mockResolvedValueOnce({ file: { id: "file-id" } });
    expect(await createSavedDraftEstimateFile("quote-id", vi.fn())).toBeNull();
  });
  it("keeps the draft available without attempting AI when the actor lacks permission", async () => {
    client.allowed = false;
    expect(await createSavedDraftEstimateFile("quote-id", vi.fn())).toContain("chưa có quyền AI");
    expect(client.exportFile).not.toHaveBeenCalled();
  });
});
