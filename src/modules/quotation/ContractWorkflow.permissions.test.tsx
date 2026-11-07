// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({ permissions: new Set<string>(), api: vi.fn() }));
vi.mock("./api", () => ({ api: state.api, hasQuotationCapability: (permission: string) => state.permissions.has(permission), formatMoney: (amount: number) => String(amount), formatDate: (date: string) => date || "", getLatestGeneratedFile: async () => ({ file: null, job: null }), downloadGeneratedFile: vi.fn() }));
vi.mock("./DocumentDialogs", () => ({ AcceptanceCreationDialog: () => null, ApprovedEstimatePickerDialog: () => null, ContractCreationDialog: () => null }));
import ContractWorkflow from "./ContractWorkflow";

const contract = { _id: "contract-id", quoteId: "quote-id", quoteNumber: "BG-QA", contractNumber: "HD-QA", status: "draft", companyName: "Bên bán", companyAddress: "Hà Nội", companyTaxId: "", companyRepresentative: "A", companyPhone: "", companyEmail: "", customerName: "Bên mua", customerAddress: "Hà Nội", customerTaxId: "", customerRepresentative: "B", customerEmail: "", customerPhone: "", scope: "Dịch vụ", projectName: "Dự án", projectAddress: "Hà Nội", deliverables: "Hồ sơ", depositAmount: 0, bankDetails: "", otherTerms: "", paymentTerms: "Sau nghiệm thu", deliveryTerms: "Trong tháng", signingPlace: "Hà Nội", signedDate: "2026-11-06", currency: "VND", subtotal: 150, taxRate: 0, taxAmount: 0, shippingFee: 0, total: 150, lines: [{ name: "Dịch vụ", sku: "DV", quantity: 1.5, unit: "giờ", unitPrice: 100, lineTotal: 150, currency: "VND" }] };
const record = { _id: "acceptance-id", contractId: contract._id, acceptanceNumber: "NT-QA", status: "draft", acceptedDate: "2026-11-06", location: "Hà Nội", result: "Đạt", startTime: "09:00", endTime: "10:00", handoverDetails: "Hồ sơ", qualityAssessment: "Đạt", settlementAmount: 100, amountPaid: 0, paymentDueDays: 7, notes: "", lines: [{ lineIndex: 0, acceptedQuantity: 1 }] };
const renderView = (view: "contracts" | "acceptances") => render(<ContractWorkflow view={view} id={view === "contracts" ? contract._id : record._id} navigate={vi.fn()} openQuote={vi.fn()} notify={vi.fn()} confirm={vi.fn().mockResolvedValue(true)} />);
describe("commercial document editing permissions", () => {
  beforeEach(() => { state.permissions = new Set(); state.api.mockImplementation(async (path: string) => path.startsWith("/api/contracts/") ? { contract } : { contract: { ...contract, status: "signed" }, record }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("lets a contract manager save without quotation management", async () => {
    state.permissions.add("quotation-contract:manage"); renderView("contracts");
    expect((await screen.findByRole("button", { name: "Lưu nội dung hợp đồng" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("lets an acceptance manager save without quotation management", async () => {
    state.permissions.add("quotation-acceptance:manage"); renderView("acceptances");
    expect((await screen.findByRole("button", { name: "Lưu biên bản" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it.each(["contracts", "acceptances"] as const)("does not offer edit controls for a read-only %s document", async view => {
    state.permissions = new Set(["quotation:read", "quotation-contract:read", "quotation-acceptance:read"]); renderView(view);
    await screen.findByRole("heading", { name: view === "contracts" ? "HD-QA" : "NT-QA" });
    expect(screen.queryByRole("button", { name: /Lưu nội dung hợp đồng|Lưu biên bản/ })).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});
