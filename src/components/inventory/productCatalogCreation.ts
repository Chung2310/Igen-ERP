import type { ProductCatalogStatus } from "../../services/productCatalogService";

export function shouldCreateInitialPrice(status: ProductCatalogStatus): boolean {
  return status === "active";
}
