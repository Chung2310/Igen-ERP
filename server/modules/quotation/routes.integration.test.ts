import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type ErrorRequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ObjectId } from "mongodb";
import quotationRouter from "./router";
import { CompanyModel } from "../../model/company.model";
import { BranchModel } from "../../model/branch.model";
import { UserModel } from "../../model/user.model";
import { RolePermissionModel } from "../../model/role-permission.model";
import { quotationScopeId } from "./context";
import { quotationCollectionName } from "./db";
import * as estimateEngine from "./quote-estimate-adjustment";
import * as quotationJobs from "./jobs";
import { aiSubscriptionService } from "../../service/ai-usage.service";
import type { Quote } from "./types";

describe("quotation routes use ERP scope and capability checks", () => {
  let mongo: MongoMemoryReplSet, server: Server, base: string;
  const companyCode = "QUOTE_HTTP", branch = new ObjectId().toHexString(), otherBranch = new ObjectId().toHexString();
  const manager = new ObjectId().toHexString(), viewer = new ObjectId().toHexString();
  const editor = new ObjectId().toHexString(), unicodeActor = new ObjectId().toHexString(), unicodeBranch = new ObjectId().toHexString(), unicodeCode = "ĐƠN VỊ KIỂM THỬ";
  const quoteId = new ObjectId(), contractFileId = new ObjectId();
  const actors = { manager: { id: manager, role: "admin", companyCode, branchId: branch }, viewer: { id: viewer, role: "quote_viewer", companyCode, branchId: branch }, editor: { id: editor, role: "quote_editor", companyCode, branchId: branch }, unicode: { id: unicodeActor, role: "admin", companyCode: unicodeCode, branchId: unicodeBranch } };
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, dbName: "quotation_http" } });
    await mongoose.connect(mongo.getUri());
    await CompanyModel.collection.insertOne({ code: companyCode, name: "QA", ownerEmail: "qa@example.test", lifecycleStatus: "active", enabledModules: ["quotation"] });
    await BranchModel.collection.insertMany([{ _id: new mongoose.Types.ObjectId(branch), companyCode, code: "MAIN", name: "A", isActive: true }, { _id: new mongoose.Types.ObjectId(otherBranch), companyCode, code: "SECOND", name: "B", isActive: true }]);
    await UserModel.collection.insertMany([{ _id: new mongoose.Types.ObjectId(manager), email: "quotation.manager@example.test", role: "admin", companyCode, branchId: branch }, { _id: new mongoose.Types.ObjectId(viewer), email: "quotation.viewer@example.test", role: "quote_viewer", companyCode, branchId: branch }]);
    await RolePermissionModel.collection.insertOne({ companyCode, role: "quote_viewer", level: 10, permissions: ["quotation:read"] });
    await RolePermissionModel.collection.insertOne({ companyCode, role: "quote_editor", level: 10, permissions: ["quotation:read", "quotation:manage"] });
    await CompanyModel.collection.insertOne({ code: unicodeCode, name: "QA Unicode", ownerEmail: "unicode@example.test", lifecycleStatus: "active", enabledModules: ["quotation"] });
    await BranchModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(unicodeBranch), companyCode: unicodeCode, code: "MAIN", name: "QA", isActive: true });
    await UserModel.collection.insertMany([{ _id: new mongoose.Types.ObjectId(editor), email: "editor@example.test", role: "quote_editor", companyCode, branchId: branch }, { _id: new mongoose.Types.ObjectId(unicodeActor), email: "unicode@example.test", role: "admin", companyCode: unicodeCode, branchId: unicodeBranch }]);
    const now = new Date(1000), scope = { companyCode, branchId: branch, companyId: quotationScopeId(companyCode, branch) };
    await mongoose.connection.db!.collection(quotationCollectionName("quotes")).insertOne({ ...scope, _id: quoteId, kind: "estimate", quoteNumber: "BG-HTTP", customerName: "Khách QA", customerEmail: "", lines: [{ catalogItemId: new ObjectId().toHexString(), name: "Dịch vụ", sku: "DV", quantity: 1.5, unit: "giờ", unitPrice: 100, lineTotal: 150, currency: "VND", attributes: {} }], informationNeeded: [], additionalInformation: {}, informationConfirmed: true, taxRate: 0, taxAmount: 0, taxRateConfirmed: true, shippingFee: 0, shippingFeeConfirmed: true, subtotal: 150, total: 150, currency: "VND", status: "draft", createdBy: manager, createdAt: now, updatedAt: now });
    await mongoose.connection.db!.collection(quotationCollectionName("companyFiles")).insertOne({ ...scope, _id: contractFileId, kind: "contract", originalFilename: "hop-dong.docx", createdAt: now });
    const app = express(); app.use(express.json());
    // Fixture identity stands in for ERP requireAuth; the module runs its real scope and permission middleware.
    app.use((req, _res, next) => { Object.assign(req, { user: actors[String(req.headers["x-test-actor"]) as keyof typeof actors] }); next(); });
    app.use("/api/v1/quotation", quotationRouter);
    const errors: ErrorRequestHandler = (error: Error & { statusCode?: number }, _req, res, next) => { if (res.headersSent) { next(error); return; } res.status(error.statusCode || 500).json({ error: error.message }); };
    app.use(errors);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/quotation`;
  }, 120_000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); await mongo?.stop(); });
  afterEach(() => vi.restoreAllMocks());
  const request = (path: string, actor = "manager", init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json", "x-test-actor": actor, ...init.headers } });
  const scope = () => ({ companyCode, branchId: branch, companyId: quotationScopeId(companyCode, branch) });
  const collection = (name: string) => mongoose.connection.db!.collection(quotationCollectionName(name));
  const seedEstimate = async () => {
    const original = await collection("quotes").findOne({ _id: quoteId });
    const estimate = { ...original, _id: new ObjectId(), quoteNumber: `REGEN-${new ObjectId()}`, status: "needs_info", taxRate: 0.1, taxRateConfirmed: true, shippingFee: 50, shippingFeeConfirmed: true, informationNeeded: ["Câu hỏi bổ sung: Cần bao nhiêu giờ?"], additionalInformation: {}, templateFillPlan: { edits: [] }, xlsxTemplateFillPlan: { cells: [] }, updatedAt: new Date(1000) };
    await collection("quotes").insertOne(estimate); return estimate as unknown as Quote & { _id: ObjectId };
  };
  const regenerate = (quote: Quote & { _id: ObjectId }, actor = "manager", answers = { "Câu hỏi bổ sung: Cần bao nhiêu giờ?": "4 giờ" }) => request(`/quotes/${quote._id}/recalculate`, actor, { method: "POST", headers: { "If-Unmodified-Since": quote.updatedAt.toISOString() }, body: JSON.stringify({ additionalInformation: answers }) });
  it("regenerates an estimate from answers, preserving snapshot prices, tax and shipping", async () => {
    const estimate = await seedEstimate(), source = new ObjectId();
    await collection("quoteRequests").insertOne({ ...scope(), _id: source, requestText: "Dịch vụ QA", suggestedProducts: [{ name: "Hạng mục cũ", quantity: 1, unit: "cái" }] });
    await collection("quotes").updateOne({ _id: estimate._id }, { $set: { requestId: String(source) } });
    vi.spyOn(aiSubscriptionService, "available").mockResolvedValue(undefined as never);
    const ai = vi.spyOn(estimateEngine, "adjustEstimateWithRequirements").mockImplementation(async (quote, prompt) => {
      expect(prompt).toContain("4 giờ"); expect(quote.informationNeeded).toEqual([]);
      return estimateEngine.applyAdjustment(quote, estimateEngine.validateAdjustment({ changes: [{ index: 0, quantity: 4 }], additions: [], questions: [] }, quote.lines.length));
    });
    const response = await regenerate(estimate); expect(response.status).toBe(200);
    const saved = (await response.json()).quote;
    expect(saved).toMatchObject({ status: "draft", subtotal: 400, taxAmount: 40, total: 490, shippingFee: 50, additionalInformation: { "Câu hỏi bổ sung: Cần bao nhiêu giờ?": "4 giờ" }, informationNeeded: [] });
    expect(saved.lines[0]).toMatchObject({ unitPrice: 100, quantity: 4 });
    expect(saved.templateFillPlan).toBeUndefined(); expect(saved.xlsxTemplateFillPlan).toBeUndefined();
    expect(saved.updatedAt).not.toBe(estimate.updatedAt.toISOString());
    expect((await (await request(`/quotes/${estimate._id}`)).json()).quote.informationNeeded).toEqual([]);
    expect((await regenerate(estimate)).status).toBe(409); expect(ai).toHaveBeenCalledOnce();
  });
  it("validates AI permission, answers, revision and document state before calling AI", async () => {
    const estimate = await seedEstimate(); const ai = vi.spyOn(estimateEngine, "adjustEstimateWithRequirements");
    expect((await regenerate(estimate, "editor")).status).toBe(403);
    expect((await request(`/quotes/${estimate._id}/recalculate`, "manager", { method: "POST", body: JSON.stringify({ additionalInformation: {} }) })).status).toBe(428);
    expect((await regenerate(estimate, "manager", {} as never)).status).toBe(422);
    expect((await regenerate(estimate, "manager", { forged: "4" } as never)).status).toBe(400);
    await collection("quotes").updateOne({ _id: estimate._id }, { $set: { status: "approved" } });
    expect((await regenerate(estimate)).status).toBe(409); expect(ai).not.toHaveBeenCalled();
  });
  it("keeps the saved estimate intact when AI fails", async () => {
    const estimate = await seedEstimate(); const before = await collection("quotes").findOne({ _id: estimate._id });
    vi.spyOn(aiSubscriptionService, "available").mockResolvedValue(undefined as never);
    vi.spyOn(estimateEngine, "adjustEstimateWithRequirements").mockRejectedValue(new Error("Provider unavailable"));
    expect((await regenerate(estimate)).status).toBe(422);
    expect(await collection("quotes").findOne({ _id: estimate._id })).toEqual(before);
  });
  it("rejects a late AI result if another tab edits or approves the estimate", async () => {
    const estimate = await seedEstimate();
    vi.spyOn(aiSubscriptionService, "available").mockResolvedValue(undefined as never);
    vi.spyOn(estimateEngine, "adjustEstimateWithRequirements").mockImplementation(async quote => {
      await collection("quotes").updateOne({ _id: estimate._id }, { $set: { status: "approved", total: 999, updatedAt: new Date(2000) } });
      return { ...quote, total: 1 };
    });
    expect((await regenerate(estimate)).status).toBe(409);
    expect(await collection("quotes").findOne({ _id: estimate._id })).toMatchObject({ status: "approved", total: 999, additionalInformation: {} });
  });
  const seedProducts = async () => {
    const template = { ...scope(), _id: new ObjectId(), category: "quote", name: "QA", originalFilename: "qa.xlsx", extension: "xlsx" };
    await collection("quoteTemplates").insertOne(template);
    const product = { ...scope(), _id: new ObjectId(), sku: `USD-${new ObjectId()}`, name: "Dịch vụ USD", unit: "giờ", price: 10, currency: "USD", attributes: { "Quy cách": "QA" }, active: true, createdAt: new Date(1000), updatedAt: new Date(1000) };
    await collection("catalogItems").insertOne(product); return { template, product };
  };
  it("captures product currency and attributes and rejects stale or mixed-currency selection", async () => {
    const { template, product } = await seedProducts();
    const queue = vi.spyOn(quotationJobs, "queueQuotationExport").mockResolvedValue({ jobId: String(new ObjectId()), status: "queued" } as never);
    const item = { catalogItemId: String(product._id), quantity: 1, unit: "giờ", catalogUpdatedAt: product.updatedAt.toISOString() };
    const create = (items = [item]) => request("/customer-quotes", "manager", { method: "POST", body: JSON.stringify({ customerName: "QA", templateId: String(template._id), idempotencyKey: String(new ObjectId()), items }) });
    const created = await create(); expect(created.status).toBe(201); const saved = (await created.json()).quote;
    expect(saved.currency).toBe("USD"); expect(saved.lines[0]).toMatchObject({ unitPrice: 10, currency: "USD", catalogAttributes: { "Quy cách": "QA" } });
    await collection("catalogItems").updateOne({ _id: product._id }, { $set: { price: 20, updatedAt: new Date(2000) } });
    expect((await create()).status).toBe(409);
    const vnd = { ...product, _id: new ObjectId(), sku: `VND-${new ObjectId()}`, currency: "VND" }; await collection("catalogItems").insertOne(vnd);
    expect((await create([{ ...item, catalogUpdatedAt: new Date(2000).toISOString() }, { ...item, catalogItemId: String(vnd._id) }])).status).toBe(422);
    expect((await collection("quotes").findOne({ _id: new ObjectId(saved._id) }))?.lines[0].unitPrice).toBe(10);
    const estimateTemplateId = new ObjectId(); await collection("quoteTemplates").insertOne({ ...template, _id: estimateTemplateId, category: "estimate" });
    const converted = await request("/quotes/from-customer", "manager", { method: "POST", body: JSON.stringify({ sourceQuoteId: saved._id, templateId: String(estimateTemplateId), idempotencyKey: String(new ObjectId()) }) });
    expect(converted.status).toBe(201); const estimate = (await converted.json()).quote;
    expect(estimate).toMatchObject({ currency: "USD", subtotal: 10, total: 10 }); expect(estimate.lines[0].unitPrice).toBe(10);
    expect(queue).toHaveBeenCalledOnce();
  });
  it("uses only current active catalog products when creating estimates and keeps saved prices", async () => {
    const { template, product } = await seedProducts(), source = new ObjectId();
    await collection("quoteRequests").insertOne({ ...scope(), _id: source, analyzedAt: new Date(), template: { id: String(template._id), originalFilename: "qa.xlsx" }, requestText: "QA", customerName: "QA", customerEmail: "", items: [{ catalogItemId: String(product._id), attributes: {} }], missingFields: [], suggestedProducts: [] });
    const create = (items: unknown[]) => request("/quotes", "manager", { method: "POST", body: JSON.stringify({ requestId: String(source), customerName: "QA", idempotencyKey: String(new ObjectId()), items }) });
    const item = { catalogItemId: String(product._id), quantity: 2, unit: "giờ", catalogUpdatedAt: product.updatedAt.toISOString() };
    expect((await create([item, item])).status).toBe(400);
    const response = await create([item]); expect(response.status).toBe(201); const saved = (await response.json()).quote;
    expect(saved).toMatchObject({ currency: "USD", subtotal: 20 });
    await collection("catalogItems").updateOne({ _id: product._id }, { $set: { price: 100, updatedAt: new Date(2000) } });
    expect((await create([item])).status).toBe(409);
    await collection("catalogItems").updateOne({ _id: product._id }, { $set: { deletedAt: new Date() } });
    expect((await create([{ ...item, catalogUpdatedAt: new Date(2000).toISOString() }])).status).toBe(409);
    expect((await (await request(`/quotes/${saved._id}`)).json()).quote.lines[0].unitPrice).toBe(10);
  });
  it("requires an ERP session", async () => { expect((await request("/quotes", "unknown")).status).toBe(401); });
  it("accepts a Unicode company code in the query while rejecting cross-company access", async () => {
    expect((await request(`/budget-plans?companyCode=${encodeURIComponent(unicodeCode)}`, "unicode")).status).toBe(200);
    expect((await request(`/budget-plans?companyCode=${encodeURIComponent(unicodeCode)}`, "manager")).status).toBe(403);
  });
  const seedBudget = async (missingProducts: string[] = []) => {
    const id = new ObjectId();
    await mongoose.connection.db!.collection(quotationCollectionName("budgetPlans")).insertOne({ _id: id, companyCode, branchId: branch, companyId: quotationScopeId(companyCode, branch), input: { description: "QA", budget: 1000 }, result: { scope: "QA", budget: 1000, currency: "VND", lines: [{ catalogItemId: "budget-product", sku: "QA", name: "QA", unit: "cái", unitPrice: 100, quantity: 1, lineTotal: 100, currency: "VND", reason: "QA" }], questions: [], assumptions: [], missingProducts }, createdAt: new Date(1000) });
    return id;
  };
  it("upgrades a legacy budget revision on save and rejects the other tab's stale edit", async () => {
    const id = await seedBudget();
    const listing = await (await request("/budget-plans", "editor")).json();
    const revision = listing.plans.find((plan: { id: string }) => plan.id === String(id)).updatedAt;
    expect(revision).toBe(new Date(1000).toISOString());
    const patch = (quantity: number) => request(`/budget-plans/${id}`, "editor", { method: "PATCH", headers: { "If-Unmodified-Since": revision }, body: JSON.stringify({ action: "quantity", catalogItemId: "budget-product", quantity }) });
    const saved = await patch(2); expect(saved.status).toBe(200); expect((await saved.json()).updatedAt).not.toBe(revision);
    expect((await patch(3)).status).toBe(409);
    expect((await mongoose.connection.db!.collection(quotationCollectionName("budgetPlans")).findOne({ _id: id }))?.result.lines[0].quantity).toBe(2);
  });
  it("does not allow a quote editor to create price-book products through a budget", async () => {
    const id = await seedBudget(["Mục thiếu"]);
    const response = await request(`/budget-plans/${id}`, "editor", { method: "PATCH", body: JSON.stringify({ action: "missing", name: "Mục thiếu", quantity: 1, newProduct: { sku: "NO-PERMISSION", name: "Mục thiếu", unit: "cái", price: 100 } }) });
    expect(response.status).toBe(403);
    expect(await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).countDocuments({ sku: "NO-PERMISSION" })).toBe(0);
  });
  it("rejects missing AI permission before persisting a customer quote", async () => {
    const response = await request("/customer-quotes", "editor", { method: "POST", body: JSON.stringify({ customerName: "QA", templateId: String(new ObjectId()), idempotencyKey: "unauthorized-create", items: [] }) });
    expect(response.status).toBe(403);
    expect(await mongoose.connection.db!.collection(quotationCollectionName("quotes")).countDocuments({ idempotencyKey: "unauthorized-create" })).toBe(0);
  });
  it("works with only quotation enabled and lists its own price book", async () => {
    expect((await request("/catalog")).status).toBe(200);
    expect((await request("/erp/products")).status).toBe(404);
    expect((await request(`/quotes/${quoteId}`)).status).toBe(200);
  });
  it("does not find documents in another branch", async () => {
    expect((await request(`/quotes/${quoteId}`, "manager", { headers: { "x-branch-id": otherBranch } })).status).toBe(404);
    expect((await request(`/quotes/${quoteId}`, "viewer", { headers: { "x-branch-id": otherBranch } })).status).toBe(403);
  });
  it("separates read access from approval and commercial files", async () => {
    expect((await request(`/quotes/${quoteId}/approve`, "viewer", { method: "POST", body: "{}" })).status).toBe(403);
    expect((await request(`/files/${contractFileId}/download`, "viewer")).status).toBe(403);
    const listing = await request("/files", "viewer"); expect((await listing.json()).files).toEqual([]);
  });
  it("rejects stale approval and keeps an approved quote for reference", async () => {
    expect((await request(`/quotes/${quoteId}/approve`, "manager", { method: "POST", body: "{}", headers: { "If-Unmodified-Since": new Date(0).toISOString() } })).status).toBe(409);
    const approved = await request(`/quotes/${quoteId}/approve`, "manager", { method: "POST", body: "{}", headers: { "If-Unmodified-Since": new Date(1000).toISOString() } });
    expect(approved.status).toBe(200); expect((await approved.json()).quote.status).toBe("approved");
    expect((await request(`/quotes/${quoteId}`, "manager", { method: "DELETE" })).status).toBe(409);
  });
  it("returns success after saving an edited price-book row with the loaded revision", async () => {
    const id = new ObjectId(), revision = new Date(1000);
    const item = { companyCode, branchId: branch, companyId: quotationScopeId(companyCode, branch), sku: "EDIT-HTTP", name: "Hàng kiểm thử", description: "", unit: "cái", price: 100, currency: "VND", active: true, attributes: {}, createdAt: revision, updatedAt: revision };
    await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).insertOne({ _id: id, ...item });
    const updated = await request(`/catalog/${id}`, "manager", { method: "PATCH", headers: { "If-Unmodified-Since": revision.toISOString() }, body: JSON.stringify({ ...item, price: 120 }) });
    expect(updated.status).toBe(200);
    expect((await updated.json()).item.price).toBe(120);
    const stale = await request(`/catalog/${id}`, "manager", { method: "PATCH", headers: { "If-Unmodified-Since": revision.toISOString() }, body: JSON.stringify({ ...item, price: 150 }) });
    expect(stale.status).toBe(409);
    expect((await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: id }))?.price).toBe(120);
  });
  it("replays single-product delete and restore requests without changing the product twice", async () => {
    const creation = await request("/catalog", "manager", { method: "POST", headers: { "Idempotency-Key": "http-create-replay" }, body: JSON.stringify({ sku: "HTTP-REPLAY", name: "QA", unit: "cái", price: 100, currency: "VND" }) });
    expect(creation.status).toBe(201); const item = (await creation.json()).item;
    const remove = () => request(`/catalog/${item._id}`, "manager", { method: "DELETE", headers: { "If-Unmodified-Since": item.updatedAt, "Idempotency-Key": "http-delete-replay" } });
    const first = await remove(); expect(first.status).toBe(200); const deleted = (await first.json()).items[0];
    expect((await remove()).status).toBe(200);
    const restore = () => request(`/catalog/${item._id}/restore`, "manager", { method: "POST", headers: { "If-Unmodified-Since": deleted.updatedAt, "Idempotency-Key": "http-restore-replay" }, body: "{}" });
    expect((await restore()).status).toBe(200); expect((await restore()).status).toBe(200);
    expect((await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: new ObjectId(item._id) }))?.active).toBe(false);
  });
  it("completes the approved estimate, contract and partial acceptance lifecycle with immutable final documents", async () => {
    const quote = await mongoose.connection.db!.collection(quotationCollectionName("quotes")).findOne({ _id: quoteId });
    const id = new ObjectId();
    await mongoose.connection.db!.collection(quotationCollectionName("quotes")).insertOne({ ...quote, _id: id, quoteNumber: "BG-WORKFLOW", status: "draft" });
    const values = { quoteId: String(id), customerName: "Bên mua", customerAddress: "Hà Nội", customerRepresentative: "B", companyName: "Bên bán", companyAddress: "Hà Nội", companyRepresentative: "A", scope: "Dịch vụ", projectName: "Dự án", projectAddress: "Hà Nội", deliverables: "Hồ sơ", paymentTerms: "Sau nghiệm thu", deliveryTerms: "Trong tháng", signingPlace: "Hà Nội", signedDate: "2026-11-06", depositAmount: 0, bankDetails: "", otherTerms: "", customerEmail: "", customerPhone: "", customerTaxId: "", companyTaxId: "", companyPhone: "", companyEmail: "" };
    const post = (path: string, body: unknown, revision?: string, method = "POST") => request(path, "manager", { method, body: JSON.stringify(body), ...(revision ? { headers: { "If-Unmodified-Since": revision } } : {}) });
    expect((await post("/contracts", values)).status).toBe(409);
    expect((await post(`/quotes/${id}/approve`, {})).status).toBe(200);
    expect((await post("/contracts", { ...values, depositAmount: 151 })).status).toBe(400);
    const createdResponse = await post("/contracts", values); expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).contract;
    const duplicate = await post("/contracts", values); expect(duplicate.status).toBe(200); expect((await duplicate.json()).contract._id).toBe(created._id);
    const acceptanceValues = { contractId: created._id, acceptedDate: "2026-11-06", location: "Hà Nội", result: "Đạt", notes: "", startTime: "09:00", endTime: "10:00", handoverDetails: "Hồ sơ", qualityAssessment: "Đạt", settlementAmount: 100, amountPaid: 0, paymentDueDays: 7, lines: [{ lineIndex: 0, acceptedQuantity: 1 }] };
    expect((await post("/acceptance-records", acceptanceValues)).status).toBe(409);
    const changedResponse = await post(`/contracts/${created._id}`, { ...values, scope: "Phạm vi đã sửa" }, created.updatedAt, "PATCH"); expect(changedResponse.status).toBe(200);
    const changed = (await changedResponse.json()).contract;
    expect((await post(`/contracts/${created._id}/sign`, { signedDate: "2026-11-06" }, created.updatedAt)).status).toBe(409);
    expect((await post(`/contracts/${created._id}/sign`, { signedDate: "2026-11-06" }, changed.updatedAt)).status).toBe(200);
    expect((await post(`/contracts/${created._id}`, values, undefined, "PATCH")).status).toBe(409);
    expect((await post("/acceptance-records", { ...acceptanceValues, lines: [{ lineIndex: 0, acceptedQuantity: 2 }] })).status).toBe(400);
    expect((await post("/acceptance-records", { ...acceptanceValues, acceptedDate: "2026-11-05" })).status).toBe(400);
    expect((await post("/acceptance-records", { ...acceptanceValues, amountPaid: 101 })).status).toBe(400);
    const acceptedResponse = await post("/acceptance-records", acceptanceValues); expect(acceptedResponse.status).toBe(201);
    const accepted = (await acceptedResponse.json()).record;
    const editedResponse = await post(`/acceptance-records/${accepted._id}`, { ...acceptanceValues, amountPaid: 30 }, accepted.updatedAt, "PATCH"); expect(editedResponse.status).toBe(200);
    const edited = (await editedResponse.json()).record;
    expect((await post(`/acceptance-records/${accepted._id}/complete`, {}, accepted.updatedAt)).status).toBe(409);
    expect((await post(`/acceptance-records/${accepted._id}/complete`, {}, edited.updatedAt)).status).toBe(200);
    expect((await post(`/acceptance-records/${accepted._id}`, acceptanceValues, undefined, "PATCH")).status).toBe(409);
    expect((await post(`/acceptance-records/${accepted._id}/complete`, {})).status).toBe(409);
  });
});
