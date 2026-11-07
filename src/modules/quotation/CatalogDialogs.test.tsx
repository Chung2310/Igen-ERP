// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const client = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./api", () => ({ api: client.api, hasQuotationCapability: () => true, formatMoney: (value: number) => String(value) }));
import CatalogProductDialog from "./CatalogProductDialog";
import CatalogBulkDialog from "./CatalogBulkDialog";

const item = { _id: "6aed00000000000000000001", sku: "TEST", name: "Sản phẩm", description: "", unit: "cái", price: 101, currency: "VND", active: true, updatedAt: "2026-11-06T00:00:00.000Z" };
describe("quotation catalog dialogs", () => {
  beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);
  it("keeps the create form and request key after an interrupted save", async () => {
    client.api.mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce({ item });
    const saved = vi.fn();
    render(<CatalogProductDialog item={item} mode="create" onClose={vi.fn()} onSaved={saved} onToast={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Mất kết nối");
    expect((screen.getByLabelText("Tên sản phẩm") as HTMLInputElement).value).toBe("Sản phẩm");
    fireEvent.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(item));
    expect(client.api.mock.calls[0][0]).toBe("/api/catalog");
    expect(client.api.mock.calls[0][1].headers["Idempotency-Key"]).toBe(client.api.mock.calls[1][1].headers["Idempotency-Key"]);
  });
  it("submits the chosen new SKU and the source revision for a duplicate", async () => {
    client.api.mockResolvedValue({ item: { ...item, sku: "COPY" } });
    render(<CatalogProductDialog item={{ ...item, sku: "", active: false }} mode="duplicate" onClose={vi.fn()} onSaved={vi.fn()} onToast={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Mã hàng"), { target: { value: "COPY" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));
    await waitFor(() => expect(client.api).toHaveBeenCalled());
    const [url, request] = client.api.mock.calls[0];
    expect(url).toBe(`/api/catalog/${item._id}/duplicate`);
    expect(JSON.parse(request.body)).toMatchObject({ sku: "COPY", sourceUpdatedAt: item.updatedAt, active: false });
  });
  it("disables confirmation until preview and invalidates it when adjustment changes", async () => {
    client.api.mockResolvedValue({ previewHash: "preview", rows: [{ id: item._id, sku: item.sku, name: item.name, currency: "VND", before: { price: 101, active: true, deleted: false }, after: { price: 111, active: true, deleted: false } }] });
    render(<CatalogBulkDialog action="price" items={[item]} onClose={vi.fn()} onApplied={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Xác nhận 1 sản phẩm" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Mức điều chỉnh"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước thay đổi" }));
    await waitFor(() => expect(confirm.disabled).toBe(false));
    expect(client.api.mock.calls[0][0]).toBe("/api/catalog/bulk/preview");
    fireEvent.change(screen.getByLabelText("Mức điều chỉnh"), { target: { value: "20" } });
    expect(confirm.disabled).toBe(true); expect(client.api).toHaveBeenCalledTimes(1);
  });
  it("requires explicit confirmation before deleting and sends exact selected revisions", async () => {
    client.api.mockResolvedValueOnce({ previewHash: "delete-preview", rows: [{ id: item._id, sku: item.sku, name: item.name, currency: "VND", before: { price: 101, active: true, deleted: false }, after: { price: 101, active: true, deleted: true } }] }).mockResolvedValueOnce({ items: [{ ...item, deletedAt: "2026-11-06T01:00:00Z" }] });
    const applied = vi.fn(); render(<CatalogBulkDialog action="delete" items={[item]} onClose={vi.fn()} onApplied={applied} />);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xem trước thay đổi" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Xác nhận 1 sản phẩm" }) as HTMLButtonElement).disabled).toBe(false));
    expect(applied).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận 1 sản phẩm" }));
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(JSON.parse(client.api.mock.calls[1][1].body)).toMatchObject({ action: "delete", selection: [{ id: item._id, updatedAt: item.updatedAt }], previewHash: "delete-preview" });
  });
});
