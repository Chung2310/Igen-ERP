import {
  loadDeviceLabelPrintSettings,
  normalizeDeviceLabelPrintSettings,
  type DeviceLabelPrintSettings,
} from "../../settings/deviceLabelPrintSettings";

export type DeviceBarcodeLabel = {
  internalBarcode: string;
  sku: string;
  productName: string;
  serialNumber?: string;
  imei1?: string;
  imei2?: string;
};

// Code 128 symbol widths based on the ZXing Code128Reader table (Apache-2.0).
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212",
  "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321",
  "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]!));
}

function code128Svg(value: string) {
  if (!value) throw new Error("Mã barcode không được để trống.");

  Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error("Mã barcode Code 128 chỉ hỗ trợ ký tự ASCII in được.");
  });

  const isDigit = (character: string | undefined) => character !== undefined && character >= "0" && character <= "9";
  const leadingDigitCount = value.match(/^\d+/)?.[0].length ?? 0;
  const startCode = leadingDigitCount >= 4 ? 105 : 104;
  let activeSet: "B" | "C" = startCode === 105 ? "C" : "B";
  const dataCodewords: number[] = [];

  for (let index = 0; index < value.length;) {
    if (activeSet === "B") {
      let digitRunLength = 0;
      while (isDigit(value[index + digitRunLength])) digitRunLength += 1;
      if (digitRunLength >= 4) {
        dataCodewords.push(99); // Switch to Code Set C for pairs of digits.
        activeSet = "C";
        continue;
      }

      dataCodewords.push(value.charCodeAt(index) - 32);
      index += 1;
      continue;
    }

    if (isDigit(value[index]) && isDigit(value[index + 1])) {
      dataCodewords.push(Number(value.slice(index, index + 2)));
      index += 2;
    } else {
      dataCodewords.push(100); // Return to Code Set B for text or a final odd digit.
      activeSet = "B";
    }
  }

  let checksum = startCode;
  dataCodewords.forEach((codeword, index) => {
    checksum += codeword * (index + 1);
  });

  const codewords = [startCode, ...dataCodewords, checksum % 103, 106];
  const quietZone = 10;
  const patterns = codewords.map((codeword) => CODE128_PATTERNS[codeword]);
  const width = quietZone * 2 + patterns.reduce(
    (total, pattern) => total + Array.from(pattern, Number).reduce((sum, moduleWidth) => sum + moduleWidth, 0),
    0,
  );
  const bars: string[] = [];
  let x = quietZone;
  let isBar = true;
  for (const pattern of patterns) {
    for (const character of pattern) {
      const moduleWidth = Number(character);
      if (isBar) bars.push(`<rect x="${x}" y="0" width="${moduleWidth}" height="1"/>`);
      x += moduleWidth;
      isBar = !isBar;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 1" preserveAspectRatio="none" role="img" aria-label="Barcode ${escapeHtml(value)}"><g fill="#000">${bars.join("")}</g></svg>`;
}

export function printDeviceBarcodeLabels(
  labels: DeviceBarcodeLabel[],
  printSettings?: Partial<DeviceLabelPrintSettings>,
) {
  const usable = labels.filter((label) => label.internalBarcode.trim());
  if (!usable.length) throw new Error("Chưa có barcode thiết bị để in.");
  const { widthMm, heightMm, columns } = printSettings
    ? normalizeDeviceLabelPrintSettings(printSettings)
    : loadDeviceLabelPrintSettings();
  const renderImeis = (label: DeviceBarcodeLabel) => [label.imei1, label.imei2]
    .map((imei) => imei?.trim())
    .filter((imei): imei is string => Boolean(imei))
    .map((imei, index, imeis) => `<div>IMEI${imeis.length > 1 ? ` ${index + 1}` : ""}: ${escapeHtml(imei)}</div>`)
    .join("");
  const renderLabel = (label: DeviceBarcodeLabel) => `
    <article class="label">
      <div class="imeis">${renderImeis(label)}</div>
      ${code128Svg(label.internalBarcode)}
      <div class="barcode-text">${escapeHtml(label.internalBarcode)}</div>
    </article>`;

  const pages: string[] = [];
  for (let index = 0; index < usable.length; index += columns) {
    const row = usable.slice(index, index + columns);
    pages.push(`<section class="label-sheet">${row.map(renderLabel).join("")}</section>`);
  }

  const printWindow = window.open("", "_blank", "width=640,height=720");
  if (!printWindow) throw new Error("Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tem mã vạch thiết bị</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100..900;1,100..900&display=swap');
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Inter, sans-serif; color: #000; }
    .label-sheet { width: ${widthMm}mm; height: ${heightMm}mm; display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .label-sheet + .label-sheet { break-before: page; page-break-before: always; }
    .label { width: auto; min-width: 0; height: ${heightMm}mm; margin: 0; padding: .8mm .5mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; }
    .imeis { flex: 0 0 auto; overflow: hidden; font: 5pt/1.1 Inter, sans-serif; white-space: nowrap; }
    svg { display: block; width: 100%; height: 14mm; margin-top: 1mm; flex: 0 0 14mm; }
    .barcode-text { overflow: hidden; white-space: nowrap; text-align: center; font: 6pt/1.1 Inter, sans-serif; letter-spacing: .1pt; }
    @media screen { body { background: #e2e8f0; padding: 12px; } .label-sheet { background: #fff; margin: 0 auto 12px; box-shadow: 0 1px 4px #64748b; } .label + .label { border-left: 1px dashed #cbd5e1; } }
    @media print { html, body { margin: 0 !important; padding: 0 !important; } }
  </style></head><body>${pages.join("")}<script>window.addEventListener('load', function () { window.focus(); setTimeout(function () { window.print(); }, 150); });</script></body></html>`);
  printWindow.document.close();
}
