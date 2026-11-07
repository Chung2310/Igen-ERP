import { api } from "./api";
import type { CatalogItem } from "./types";

export async function loadCatalogProducts(includeDeleted = false) {
  const items: CatalogItem[] = [];
  let page: number | null = 1;
  while (page) {
    const result: { items: CatalogItem[]; nextPage: number | null } = await api(`/api/catalog?page=${page}&pageSize=1000${includeDeleted ? "&includeDeleted=all" : "&status=active"}`);
    items.push(...result.items);
    page = result.nextPage;
  }
  return { items };
}

export function catalogSelectionVersion(items: CatalogItem[], id: string) {
  const item = items.find(product => product._id === id);
  return item?.updatedAt || item?.createdAt;
}
