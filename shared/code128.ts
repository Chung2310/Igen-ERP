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
];

export interface BarcodeBar { x: number; width: number }
export interface EncodedBarcode { width: number; bars: BarcodeBar[] }

/** Encodes printable ASCII as Code 128 and switches to the compact numeric set for long digit runs. */
export function encodeCode128(value: string): EncodedBarcode {
  const text = String(value || "").trim();
  if (!text) throw new Error("Barcode value is required.");

  const symbols = [104]; // Start Code B
  const digitRuns = /\d{4,}/g;
  let cursor = 0;
  let inCodeC = false;
  let match: RegExpExecArray | null;

  while ((match = digitRuns.exec(text))) {
    const run = match[0];
    const oddDigit = run.length % 2 ? run[0] : "";
    const pairs = oddDigit ? run.slice(1) : run;
    const plainText = text.slice(cursor, match.index) + oddDigit;
    if (plainText) {
      if (inCodeC) {
        symbols.push(100); // Switch back to Code B
        inCodeC = false;
      }
      if ([...plainText].some((char) => char.charCodeAt(0) > 126 || char.charCodeAt(0) < 32)) {
        throw new Error("Code 128 barcode supports printable ASCII characters only.");
      }
      symbols.push(...[...plainText].map((char) => char.charCodeAt(0) - 32));
    }
    symbols.push(99); // Switch to Code C
    inCodeC = true;
    for (let index = 0; index < pairs.length; index += 2) symbols.push(Number(pairs.slice(index, index + 2)));
    cursor = match.index + run.length;
  }

  const tail = text.slice(cursor);
  if (tail && inCodeC) symbols.push(100); // Switch back to Code B
  if ([...tail].some((char) => char.charCodeAt(0) > 126 || char.charCodeAt(0) < 32)) {
    throw new Error("Code 128 barcode supports printable ASCII characters only.");
  }
  symbols.push(...[...tail].map((char) => char.charCodeAt(0) - 32));

  const checksum = symbols.reduce((sum, symbol, index) => sum + (index ? symbol * index : 0), 104) % 103;
  const encodedSymbols = [...symbols, checksum, 106];
  const bars: BarcodeBar[] = [];
  let x = 10; // Code 128 quiet zone
  let drawBar = true;

  for (const symbol of encodedSymbols) {
    const pattern = CODE128_PATTERNS[symbol];
    for (const module of pattern) {
      const width = Number(module);
      if (drawBar) bars.push({ x, width });
      x += width;
      drawBar = !drawBar;
    }
  }

  return { width: x + 10, bars };
}
