import { useMemo } from 'react';

export interface Option {
  code: string;
  name: string;
  values: string[];
}

export interface GeneratedVariant {
  optionValues: { code: string; value: string }[];
  sku: string;
  price?: number;
  barcode?: string;
  weightGrams?: number;
  mediaIds?: string[];
}

export function generateEAN13(): string {
  let code = "200"; // 200-299 is for internal use
  for (let i = 0; i < 9; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code + checksum;
}

export function useVariantMatrix(baseSku: string, options: Option[]) {
  return useMemo(() => {
    if (!options || options.length === 0) return [];
    
    // Filter out options that have no values
    const validOptions = options.filter(opt => opt.values.length > 0);
    if (validOptions.length === 0) return [];

    // Cartesian product algorithm
    const cartesian = (...a: any[][]) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

    const optionValuesLists = validOptions.map(opt => 
      opt.values.map(val => ({ code: opt.code, value: val }))
    );

    const matrix = optionValuesLists.length === 1 
      ? optionValuesLists[0].map(v => [v])
      : cartesian(...optionValuesLists);

    return matrix.map(combination => {
      // Generate automatic SKU suffix based on option values
      const skuSuffix = combination
        .map((c: any) => c.value.toUpperCase().replace(/\s+/g, '-').substring(0, 5))
        .join('-');

      return {
        optionValues: combination,
        sku: baseSku ? `${baseSku}-${skuSuffix}` : `SKU-${skuSuffix}`,
        price: 0,
        barcode: generateEAN13(),
        weightGrams: 0,
        mediaIds: [],
      } as GeneratedVariant;
    });
  }, [baseSku, options]);
}
