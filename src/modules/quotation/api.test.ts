import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiUploadWithProgress, ApiError, canUseErpCustomers, configureQuotationClient, hasQuotationCapability, quotationEndpoint, quotationFetch } from "./api";
const scope = (branchId = "branch-a", capabilities = ["quotation:manage"]) => ({ user: { id: "qa", name: "QA", email: "qa@example.test", role: "user" as const }, companyCode: "QA", branchId, capabilities });
describe("quotation ERP transport", () => {
  let release: () => void;
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "https://erp.example.test" } });
    vi.stubGlobal("localStorage", { getItem: () => "erp-test-token" });
    release = configureQuotationClient(scope());
  });
  afterEach(() => { release(); vi.unstubAllGlobals(); });
  it("sends ERP identity and branch only to quotation endpoints", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    await quotationFetch("/api/quotes?page=1");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/v1/quotation/quotes?page=1&companyCode=QA");
    expect(init.headers.get("Authorization")).toBe("Bearer erp-test-token");
    expect(init.headers.has("x-company-code")).toBe(false);
    expect(init.headers.get("x-branch-id")).toBe("branch-a");
    expect(() => quotationEndpoint("https://other.example.test/api/files")).toThrow(ApiError);
  });
  it("supports Vietnamese company codes and overrides caller-supplied scope", async () => {
    release = configureQuotationClient({ ...scope(), companyCode: "ĐƠN VỊ QA" });
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    await quotationFetch("/api/budget-plans?companyCode=OTHER");
    expect(new URL(fetch.mock.calls[0][0], window.location.origin).searchParams.get("companyCode")).toBe("ĐƠN VỊ QA");
    expect(fetch.mock.calls[0][1].headers.has("x-company-code")).toBe(false);
  });
  it("supports the same Unicode scope on uploads without putting it in a header", async () => {
    release = configureQuotationClient({ ...scope(), companyCode: "ĐƠN VỊ QA" });
    let uploadUrl = ""; const uploadHeaders = new Headers();
    let uploadStatus = 201, uploadBody = '{"file":{"id":"file-id"}}';
    class Upload {
      get status() { return uploadStatus; } get responseText() { return uploadBody; } upload = { addEventListener() {} };
      listeners = new Map<string, () => void>();
      open(_method: string, path: string) { uploadUrl = path; }
      setRequestHeader(key: string, value: string) { uploadHeaders.set(key, value); }
      addEventListener(event: string, callback: () => void) { this.listeners.set(event, callback); }
      send() { this.listeners.get("load")?.(); }
      abort() { this.listeners.get("abort")?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", Upload);
    expect(await apiUploadWithProgress("/api/quote-template", new Blob(["test"]), { "X-File-Name": encodeURIComponent("Báo giá.xlsx") }, vi.fn())).toEqual({ file: { id: "file-id" } });
    expect(new URL(uploadUrl, window.location.origin).searchParams.get("companyCode")).toBe("ĐƠN VỊ QA");
    expect(uploadHeaders.has("x-company-code")).toBe(false);
    expect(decodeURIComponent(uploadHeaders.get("X-File-Name")!)).toBe("Báo giá.xlsx");
    uploadStatus = 503; uploadBody = '{"ok":false,"error":{"code":"STORAGE_UNAVAILABLE","message":"Kho file tạm thời không khả dụng.","requestId":"upload-qa"}}';
    await expect(apiUploadWithProgress("/api/quote-template", new Blob(["test"]), {}, vi.fn())).rejects.toMatchObject({ status: 503, message: "Kho file tạm thời không khả dụng.", requestId: "upload-qa" });
  });
  it.each([
    ["catalog", { items: [{ _id: "id", updatedAt: "2026-11-06T00:00:00.000Z" }] }],
    ["budget-plans", { plans: [{ id: "id", updatedAt: "2026-11-06T00:00:00.000Z" }] }],
  ])("remembers revisions from the %s list", async (collection, payload) => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload)).mockResolvedValueOnce(Response.json({})); vi.stubGlobal("fetch", fetch);
    await api(`/api/${collection}`);
    await api(`/api/${collection}/id`, { method: "PATCH", body: "{}" });
    expect(fetch.mock.calls[1][1].headers.get("If-Unmodified-Since")).toBe("2026-11-06T00:00:00.000Z");
  });
  it("remembers the revision of a newly suggested budget plan under its document URL", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ id: "id", updatedAt: "2026-11-06T00:00:00.000Z" })).mockResolvedValueOnce(Response.json({})); vi.stubGlobal("fetch", fetch);
    await api("/api/budget-plans/suggest", { method: "POST", body: "{}" });
    await api("/api/budget-plans/id", { method: "PATCH", body: "{}" });
    expect(fetch.mock.calls[1][1].headers.get("If-Unmodified-Since")).toBe("2026-11-06T00:00:00.000Z");
  });
  it("discards a late response after a branch change", async () => {
    let finish: (response: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>(resolve => { finish = resolve; }));
    const pending = quotationFetch("/api/quotes");
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    release = configureQuotationClient(scope("branch-b"));
    finish!(new Response("{}")); await assertion;
  });
  it("sends the loaded revision when saving and preserves domain status errors", async () => {
    const revision = "2026-11-06T00:00:00.000Z";
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ quote: { _id: "id", updatedAt: revision } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Đã có người cập nhật." }), { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    await api("/api/quotes/id");
    await expect(api("/api/quotes/id", { method: "PATCH", body: "{}" })).rejects.toMatchObject({ status: 409, message: "Đã có người cập nhật." });
    expect(fetch.mock.calls[1][1].headers.get("If-Unmodified-Since")).toBe(revision);
  });
  it("does not infer approval, AI or price-book access from quotation management", () => {
    expect(hasQuotationCapability("quotation:read")).toBe(true);
    expect(hasQuotationCapability("quotation-approval:manage")).toBe(false);
    expect(hasQuotationCapability("quotation-ai:manage")).toBe(false);
    expect(hasQuotationCapability("quotation-price-book:manage")).toBe(false);
  });
  it("only offers ERP customers when both the source module and read permission are available", () => {
    release = configureQuotationClient({ ...scope(), capabilities: ["*"] }); expect(canUseErpCustomers()).toBe(false);
    release = configureQuotationClient({ ...scope(), modules: ["customer"] }); expect(canUseErpCustomers()).toBe(false);
    release = configureQuotationClient({ ...scope(), modules: ["customer"], capabilities: ["customer:read"] }); expect(canUseErpCustomers()).toBe(true);
  });
});
