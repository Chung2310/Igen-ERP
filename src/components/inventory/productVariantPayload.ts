import type { GeneratedVariant } from "../../hooks/useVariantMatrix";
import type { ProductCatalogType, VariantInput } from "../../services/productCatalogService";

type MatrixVariantInput = {
  row: GeneratedVariant;
  shared: Pick<VariantInput, "unitCode" | "trackingMode" | "warrantyMonths" | "supplierWarrantyMonths">;
  productCode: string;
  baseUnitCode: string;
  productType: ProductCatalogType;
  fallbackSku: string;
};

export function buildMatrixVariantInput({ row, shared, productCode, baseUnitCode, productType, fallbackSku }: MatrixVariantInput): VariantInput {
  const skuSuffix = row.optionValues
    .map((option) => option.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
    .join("-");
  const sku = row.sku?.trim() || (productCode ? `${productCode}-${skuSuffix}` : fallbackSku);

  return {
    sku,
    barcode: row.barcode || undefined,
    displayName: row.optionValues.map((option) => option.value).join(" - "),
    optionValues: row.optionValues,
    unitCode: shared.unitCode || baseUnitCode,
    trackingMode: productType === "service" ? "none" : shared.trackingMode,
    weightGrams: row.weightGrams,
    warrantyMonths: shared.warrantyMonths,
    supplierWarrantyMonths: shared.supplierWarrantyMonths,
    mediaIds: row.mediaIds,
    status: "active",
  } as VariantInput;
}
