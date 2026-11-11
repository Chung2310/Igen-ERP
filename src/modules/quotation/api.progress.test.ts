// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, configureQuotationClient, createGeneratedExport, resetAiProgressTracking } from "./api";
import { aiProgress } from "./ai-progress";

const scope = (branchId = "branch-a") => ({ companyCode: "ĐƠN VỊ QA", branchId, capabilities: ["*"], user: { id: "actor", name: "QA", email: "qa@example.test", role: "user" as const } });
let release: () => void;
beforeEach(() => { vi.useFakeTimers(); release = configureQuotationClient(scope()); });
afterEach(() => { release(); resetAiProgressTracking(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("ERP quotation AI progress", () => {
  it("presents a network error in Vietnamese and keeps progress below 100%", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/api/budget-plans/suggest", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 0 });
    expect(aiProgress.getSnapshot()[0]).toMatchObject({ status: "failed" });
    expect(aiProgress.getSnapshot()[0].detail).not.toContain("Failed to fetch");
    expect(aiProgress.getSnapshot()[0].progress).toBeLessThan(100);
  });
  it("waits for a saved export before reporting 100% and keeps ERP scope on every poll", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ jobId: "job" }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ job: { status: "running" } }))
      .mockResolvedValueOnce(Response.json({ job: { status: "completed", fileId: "file", filename: "hop-dong.docx" } }));
    vi.stubGlobal("fetch", fetch);
    const pending = createGeneratedExport("/api/contracts/contract/file?background=1");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(aiProgress.getSnapshot()).toMatchObject([{ status: "running", progress: 30 }]);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toMatchObject({ id: "file", filename: "hop-dong.docx" });
    expect(aiProgress.getSnapshot()).toMatchObject([{ status: "completed", progress: 100 }]);
    for (const [url, options] of fetch.mock.calls) {
      expect(new URL(url, location.origin).searchParams.get("companyCode")).toBe("ĐƠN VỊ QA");
      expect(options.headers.get("x-branch-id")).toBe("branch-a");
    }
  });

  it("keeps customer quote progress open after creation until its background file is ready", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ quote: { _id: "quote" } }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ job: { status: "running" }, file: null }))
      .mockResolvedValueOnce(Response.json({ job: { status: "completed" }, file: { id: "saved-file" } })));
    await api("/api/customer-quotes", { method: "POST", body: "{}" });
    await vi.advanceTimersByTimeAsync(0);
    expect(aiProgress.getSnapshot()).toMatchObject([{ status: "running" }]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(aiProgress.getSnapshot()).toMatchObject([{ status: "completed", progress: 100 }]);
  });

  it("shows a failure below 100% when a completed job has no saved file", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ jobId: "job" }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ job: { status: "completed" } })));
    const pending = createGeneratedExport("/api/quotes/quote/export?draft=1");
    const assertion = expect(pending).rejects.toThrow("File chưa sẵn sàng");
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    expect(aiProgress.getSnapshot()[0].status).toBe("failed");
    expect(aiProgress.getSnapshot()[0].progress).toBeLessThan(100);
  });

  it("cancels old progress and ignores late results after switching branches", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const pending = api("/api/budget-plans/suggest", { method: "POST", body: "{}" });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    release = configureQuotationClient(scope("branch-b"));
    expect(aiProgress.getSnapshot()).toEqual([]);
    finish(Response.json({ id: "old-plan" }));
    await assertion;
    expect(aiProgress.getSnapshot()).toEqual([]);
  });
});
