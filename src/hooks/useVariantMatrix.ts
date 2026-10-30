import { useMemo } from 'react';

export interface Option {
  code: string;
  name: string;
  values: string[];
}

export interface GeneratedVariant {
  optionValues: { code: string; value: string }[];
  sku: string;
  price?: number; // Giá bán
  costPrice?: number; // Giá vốn
  barcode?: string;
  weightGrams?: number;
  mediaIds?: string[];
}

export function generateEAN13(seed?: string): string {
  let digits = "";
  if (seed && seed.trim()) {
    let hash = 2166136261;
    const str = seed.trim();
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const num = Math.abs(hash) % 1000000000;
    digits = num.toString().padStart(9, "0");
  } else {
    for (let i = 0; i < 9; i++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
  }

  const code = "200" + digits;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code + checksum;
}

export function cleanOptionSlug(val: string, maxLength = 10): string {
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, maxLength);
}

export function generateMatrixFromOptions(
  options: Option[],
  baseSku: string = "",
  existingMatrix: GeneratedVariant[] = []
): GeneratedVariant[] {
  if (!options || options.length === 0) return [];

  // Filter out options that have no values
  const validOptions = options.filter(opt => opt.values && opt.values.length > 0);
  if (validOptions.length === 0) return [];

  // Cartesian product algorithm
  const cartesian = (...a: any[][]) => a.reduce((acc, curr) => acc.flatMap(d => curr.map(e => [d, e].flat())));

  const optionValuesLists = validOptions.map(opt =>
    opt.values.map(val => ({ code: opt.code, value: val }))
  );

  const combinations: Array<Array<{ code: string; value: string }>> =
    optionValuesLists.length === 1
      ? optionValuesLists[0].map(v => [v])
      : cartesian(...optionValuesLists);

  const makeNormalizedKey = (optionValues: { code?: string; value?: string }[]) =>
    (optionValues || [])
      .filter((ov) => ov && ov.code && ov.value)
      .map((ov) => `${ov.code.trim().toUpperCase()}:${ov.value.trim().toLowerCase()}`)
      .sort()
      .join("|");

  // Map existing matrix items to preserve user changes (prices, images, barcodes, custom SKUs)
  const existingMap = new Map<string, GeneratedVariant>();
  for (const item of existingMatrix) {
    const key = makeNormalizedKey(item.optionValues || []);
    if (key) existingMap.set(key, item);
    if (item.sku && item.sku.trim()) {
      existingMap.set(`sku:${item.sku.trim().toLowerCase()}`, item);
    }
    if (item.barcode && item.barcode.trim()) {
      existingMap.set(`barcode:${item.barcode.trim()}`, item);
    }
  }

  return combinations.map(combination => {
    const key = makeNormalizedKey(combination);

    const skuSuffix = combination
      .map((c: any) => cleanOptionSlug(c.value))
      .join('-');

    // Tên sản phẩm có thể dài hơn giá trị thuộc tính, nên mã gốc dùng giới hạn riêng.
    const cleanBase = cleanOptionSlug(baseSku, 40);
    const generatedSku = cleanBase ? `${cleanBase}-${skuSuffix}` : `SKU-${skuSuffix}`;

    // 1. Chỉ khớp khi bộ thuộc tính chính xác
    let existing = existingMap.get(key);

    // 2. Hoặc khi mã SKU khớp chính xác
    if (!existing) {
      existing = existingMap.get(`sku:${generatedSku.trim().toLowerCase()}`);
    }

    // Nếu thực sự là biến thể cũ đã tồn tại, giữ nguyên dữ liệu gốc của nó
    if (existing) {
      const preservedBarcode =
        existing.barcode && existing.barcode.trim()
          ? existing.barcode.trim()
          : generateEAN13(existing.sku || generatedSku);

      return {
        ...existing,
        sku: existing.sku || generatedSku,
        barcode: preservedBarcode,
        price: existing.price ?? 0,
        costPrice: existing.costPrice ?? 0,
        optionValues: combination,
      };
    }

    // Biến thể MỚI: sinh mã vạch cố định theo SKU để không bị nhảy ngẫu nhiên
    return {
      optionValues: combination,
      sku: generatedSku,
      price: 0,
      costPrice: 0,
      barcode: generateEAN13(generatedSku),
      weightGrams: 0,
      mediaIds: [],
    } as GeneratedVariant;
  });
}

export function useVariantMatrix(baseSku: string, options: Option[]) {
  return useMemo(() => generateMatrixFromOptions(options, baseSku), [baseSku, options]);
}
