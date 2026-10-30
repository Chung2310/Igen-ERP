// @vitest-environment jsdom
import { BitArray, Code128Reader } from "@zxing/library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { printDeviceBarcodeLabels } from "./printDeviceBarcodeLabels";
import { saveDeviceLabelPrintSettings } from "../../settings/deviceLabelPrintSettings";

describe("printDeviceBarcodeLabels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("prints a standards-readable Code 128 barcode with only the IMEIs and barcode value", () => {
    const mockDocument = { open: vi.fn(), write: vi.fn<(html: string) => void>(), close: vi.fn() };
    const mockPrintWindow = { document: mockDocument, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(mockPrintWindow as unknown as Window);

    printDeviceBarcodeLabels([{
      internalBarcode: "DVU000000000043",
      sku: "SKU-1",
      productName: "Device model",
      serialNumber: "SN-001",
      imei1: "IMEI-001",
      imei2: "IMEI-002",
    }]);

    const html = mockDocument.write.mock.calls[0][0] as string;
    const svg = html.match(/<svg[\s\S]*?<\/svg>/)?.[0];
    expect(svg).toBeTruthy();
    expect(html).toContain("IMEI 1: IMEI-001");
    expect(html).toContain("IMEI 2: IMEI-002");
    expect(html).toContain('<div class="barcode-text">DVU000000000043</div>');
    expect(html).not.toContain("SN-001");
    expect(html).not.toContain("Device model");
    expect(html).not.toContain("SKU-1");

    const width = Number(svg?.match(/viewBox="0 0 (\d+) 1"/)?.[1]);
    const row = new BitArray(width);
    for (const match of svg!.matchAll(/<rect x="(\d+)" y="0" width="(\d+)" height="1"\/>/g)) {
      const start = Number(match[1]);
      const end = start + Number(match[2]);
      for (let x = start; x < end; x += 1) row.set(x);
    }

    expect(new Code128Reader().decodeRow(0, row).getText()).toBe("DVU000000000043");
  });

  it("rejects barcode values outside printable ASCII instead of printing an unreadable label", () => {
    expect(() => printDeviceBarcodeLabels([{
      internalBarcode: "MÃ-001",
      sku: "SKU-1",
      productName: "Device model",
    }])).toThrow(/ASCII/);
  });

  it("uses the saved label size for both the page and printed label", () => {
    saveDeviceLabelPrintSettings({ widthMm: 40, heightMm: 25, mediaType: "gap" });
    const mockDocument = { open: vi.fn(), write: vi.fn<(html: string) => void>(), close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue({ document: mockDocument } as unknown as Window);

    printDeviceBarcodeLabels([{ internalBarcode: "DVU000000000043", sku: "SKU-1", productName: "Device" }]);

    const html = mockDocument.write.mock.calls[0][0] as string;
    expect(html).toContain("@page { size: 40mm 25mm; margin: 0; }");
    expect(html).toContain(".label-sheet { width: 40mm; height: 25mm; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(html).toContain(".label-sheet + .label-sheet { break-before: page; page-break-before: always; }");
    expect(html).not.toContain("page-break-after: always");
  });

  it("places two barcodes side by side on one 50 by 30 mm label row", () => {
    const mockDocument = { open: vi.fn(), write: vi.fn<(html: string) => void>(), close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue({ document: mockDocument } as unknown as Window);

    printDeviceBarcodeLabels([
      { internalBarcode: "TEST-LEFT-001", sku: "SKU-L", productName: "Left device" },
      { internalBarcode: "TEST-RIGHT-002", sku: "SKU-R", productName: "Right device" },
    ]);

    const html = mockDocument.write.mock.calls[0][0] as string;
    expect(html.match(/<section class="label-sheet">/g)).toHaveLength(1);
    expect(html.match(/<article class="label">/g)).toHaveLength(2);
    expect(html).toContain("repeat(2, minmax(0, 1fr))");
    expect(html.indexOf("TEST-LEFT-001")).toBeLessThan(html.indexOf("TEST-RIGHT-002"));
  });

  it("supports printing three labels across a custom row", () => {
    const mockDocument = { open: vi.fn(), write: vi.fn<(html: string) => void>(), close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue({ document: mockDocument } as unknown as Window);

    printDeviceBarcodeLabels([
      { internalBarcode: "LABEL-001", sku: "SKU-1", productName: "Device 1" },
      { internalBarcode: "LABEL-002", sku: "SKU-2", productName: "Device 2" },
      { internalBarcode: "LABEL-003", sku: "SKU-3", productName: "Device 3" },
    ], { widthMm: 90, heightMm: 30, columns: 3 });

    const html = mockDocument.write.mock.calls[0][0] as string;
    expect(html).toContain("repeat(3, minmax(0, 1fr))");
    expect(html.match(/<section class="label-sheet">/g)).toHaveLength(1);
    expect(html.match(/<article class="label">/g)).toHaveLength(3);
  });

  it("can print a test label using the current settings draft before it is saved", () => {
    saveDeviceLabelPrintSettings({ widthMm: 50, heightMm: 30, mediaType: "gap" });
    const mockDocument = { open: vi.fn(), write: vi.fn<(html: string) => void>(), close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue({ document: mockDocument } as unknown as Window);

    printDeviceBarcodeLabels([{
      internalBarcode: "TEST-50X30-001",
      sku: "TEST-PRINT",
      productName: "TEM TEST 50x30",
      serialNumber: "SN-TEST-0001",
      imei1: "IMEI-TEST-0001",
    }], { widthMm: 40, heightMm: 25, mediaType: "gap" });

    const html = mockDocument.write.mock.calls[0][0] as string;
    expect(html).toContain("@page { size: 40mm 25mm; margin: 0; }");
    expect(html).toContain("TEST-50X30-001");
    expect(html).toContain("IMEI: IMEI-TEST-0001");
    expect(html).not.toContain("SN-TEST-0001");
    expect(html).not.toContain("TEM TEST 50x30");
  });
});
