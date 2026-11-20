// Inspect drawing operators only. Decoding each image can hang on malformed
// image objects and is unnecessary to decide which pages require OCR.
export async function pdfImagePages(buffer: Buffer): Promise<number[]> {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false });
  try {
    const document = await task.promise;
    const pages: number[] = [];
    const imageOps = new Set([
      OPS.paintImageXObject,
      OPS.paintInlineImageXObject,
      OPS.paintImageMaskXObject,
      OPS.paintImageXObjectRepeat,
      OPS.paintImageMaskXObjectRepeat,
    ]);
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      try {
        const operators = await page.getOperatorList();
        if (operators.fnArray.some((operator) => imageOps.has(operator))) pages.push(index);
      } finally {
        page.cleanup();
      }
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
