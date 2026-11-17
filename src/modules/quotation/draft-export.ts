import { getLatestGeneratedFile, hasQuotationCapability, queueGeneratedExport } from "./api";

/** Saving the business document succeeds independently of file generation. */
export async function createSavedDraftEstimateFile(quoteId: string, onProgress: () => void): Promise<string | null> {
  if (!hasQuotationCapability("quotation-ai:manage")) return "Bạn chưa có quyền AI. Có thể tạo file sau khi được cấp quyền.";
  onProgress();
  try {
    await queueGeneratedExport(`/api/quotes/${encodeURIComponent(quoteId)}/export?draft=1&background=1`);
    return null;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    const detail = cause instanceof Error ? cause.message : "Không tạo được file dự toán.";
    const latest = await getLatestGeneratedFile(quoteId, "estimate_draft").catch(() => null);
    if (latest?.file || latest?.job?.status === "queued" || latest?.job?.status === "running") return null;
    return `${detail} Bản nháp đã được giữ lại; bạn có thể mở lại để tạo file.`;
  }
}
