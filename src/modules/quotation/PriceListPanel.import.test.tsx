// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ api: vi.fn(), upload: vi.fn(), catalog: vi.fn(), canManage: true }));
vi.mock("./api", async importOriginal => ({
  ...await importOriginal<typeof import("./api")>(), api: client.api, apiUploadWithProgress: client.upload,
  hasQuotationCapability: () => client.canManage,
}));
vi.mock("./catalog-api", () => ({ loadCatalogProducts: client.catalog }));
import PriceListPanel from "./PriceListPanel";

const preview = { preview: { sheets: [{
  sheet: "Sản phẩm", headerRow: 1,
  headerRows: [{ row: 1, cells: ["Tên hàng", "Giá", "Đơn vị"], roles: ["name", "price", "unit"] }],
  rows: [{ sheet: "Sản phẩm", row: 2, cells: ["Máy lọc nước", "250000", "cái"] }],
}] } };
const product = { _id: "product", sku: "ML", name: "Máy lọc nước", unit: "cái", price: 250000, currency: "VND", active: true, description: "" };
const imported = (name = "bang-gia.xlsx") => ({ file: { _id: name, originalFilename: name, bytes: 10, updatedAt: "2026-11-11T00:00:00.000Z" }, imported: { inserted: 1, updated: 0, skippedRows: 0 } });
const file = (name = "bang-gia.xlsx") => new File(["workbook"], name);
const openImport = async () => {
  const trigger = screen.getByRole("button", { name: "Nhập Excel/CSV" }) as HTMLButtonElement;
  await waitFor(() => expect(trigger.disabled).toBe(false));
  trigger.focus(); fireEvent.click(trigger);
  return screen.getByRole("dialog", { name: "Nhập bảng giá từ Excel/CSV" });
};
const selectFiles = (files: File[]) => fireEvent.change(screen.getByLabelText("Chọn file bảng giá Excel hoặc CSV"), { target: { files } });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; this.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.open = false; };
});
beforeEach(() => {
  client.canManage = true;
  client.api.mockReset().mockResolvedValue({ files: [] });
  client.catalog.mockReset().mockResolvedValue({ items: [] });
  client.upload.mockReset().mockImplementation(async (url: string) => url.endsWith("/preview") ? preview : imported());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("price book Excel import popup", () => {
  it("opens the popup before the file picker and restores focus when cancelled", async () => {
    render(<PriceListPanel onToast={vi.fn()} />);
    const picker = vi.spyOn(HTMLInputElement.prototype, "click");
    const dialog = await openImport();
    expect(picker).not.toHaveBeenCalled();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Xác nhận và nhập" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Chọn file Excel/CSV" }));
    expect(picker).toHaveBeenCalledOnce();
    fireEvent.keyDown(document.activeElement!, { key: "/" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Nhập Excel/CSV" }));
    expect(client.upload).not.toHaveBeenCalled();
  });

  it("reviews columns inside the popup and imports only after confirmation", async () => {
    const toast = vi.fn();
    client.catalog.mockResolvedValueOnce({ items: [] }).mockResolvedValue({ items: [product] });
    render(<PriceListPanel onToast={toast} />);
    const dialog = await openImport(); selectFiles([file()]);
    await within(dialog).findByRole("heading", { name: "Kiểm tra cột trước khi nhập" });
    expect(within(dialog).getByText("bang-gia.xlsx")).toBeTruthy();
    expect(client.upload).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận và nhập" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [url, sentFile, headers] = client.upload.mock.calls[1];
    expect(url).toBe("/api/price-list"); expect(sentFile.name).toBe("bang-gia.xlsx");
    expect(JSON.parse(decodeURIComponent(headers["X-Catalog-Import-Mapping"]))).toEqual([{ sheet: "Sản phẩm", headerRow: 1, roles: ["name", "price", "unit"] }]);
    expect(screen.getByText("Máy lọc nước")).toBeTruthy();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("1 mới"), "success");
  });

  it("keeps only failed files in the popup so retry does not import successful files twice", async () => {
    let failSecond = true;
    client.upload.mockImplementation(async (url: string, selected: File) => {
      if (url.endsWith("/preview")) return preview;
      if (selected.name === "hai.xlsx" && failSecond) throw new Error("Không nhập được file thứ hai.");
      return imported(selected.name);
    });
    render(<PriceListPanel onToast={vi.fn()} />);
    const dialog = await openImport(); selectFiles([file("mot.xlsx"), file("hai.xlsx")]);
    await within(dialog).findByText("2 file");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận và nhập" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Không nhập được file thứ hai");
    expect(within(dialog).queryByRole("heading", { name: "mot.xlsx" })).toBeNull();
    expect(within(dialog).getByRole("heading", { name: "hai.xlsx" })).toBeTruthy();
    failSecond = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận và nhập" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.upload.mock.calls.filter(([url]) => url === "/api/price-list").map(([, selected]) => selected.name)).toEqual(["mot.xlsx", "hai.xlsx", "hai.xlsx"]);
  });

  it("keeps the popup open and controls disabled while reading a workbook", async () => {
    let finish!: (value: typeof preview) => void;
    client.upload.mockImplementation((_url, _file, _headers, progress) => { progress(50); return new Promise(resolve => { finish = resolve; }); });
    render(<PriceListPanel onToast={vi.fn()} />);
    const dialog = await openImport(); selectFiles([file()]);
    expect(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect((within(dialog).getByRole("button", { name: "Đóng cửa sổ nhập bảng giá" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.getByRole("dialog")).toBe(dialog);
    await act(async () => { finish(preview); });
    expect((within(dialog).getByRole("button", { name: "Xác nhận và nhập" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows oversized-file errors inside the popup without uploading", async () => {
    render(<PriceListPanel onToast={vi.fn()} />);
    const dialog = await openImport();
    const oversized = file(); Object.defineProperty(oversized, "size", { value: 5 * 1024 * 1024 + 1 });
    selectFiles([oversized]);
    expect((await within(dialog).findByRole("alert")).textContent).toContain("5 MB");
    expect(client.upload).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await openImport();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("requires price book management permission to open import", async () => {
    client.canManage = false;
    render(<PriceListPanel onToast={vi.fn()} />);
    await waitFor(() => expect(client.catalog).toHaveBeenCalled());
    expect((screen.getByRole("button", { name: "Nhập Excel/CSV" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
