import type { TabType } from "../types";
import { APP_ROUTES } from "../router/route-config";
import { tabToPath } from "../seo/seo-config";

export type FeatureSurface = "navigation" | "page" | "drawer" | "modal" | "overflow";

export interface FeatureInventoryItem {
  id: string;
  module: TabType;
  label: string;
  entryPoint: string;
  surface: FeatureSurface;
  accessDepth: 1 | 2 | 3;
}

export const FEATURE_INVENTORY: FeatureInventoryItem[] = APP_ROUTES.map((route) => ({
  id: `route:${route.tab}`,
  module: route.tab,
  label: route.tab,
  entryPoint: tabToPath(route.tab),
  surface: "navigation",
  accessDepth: 1,
}));

export const getFeaturesForModule = (module: TabType): FeatureInventoryItem[] =>
  FEATURE_INVENTORY.filter((feature) => feature.module === module);

export const getFeatureById = (id: string): FeatureInventoryItem | undefined =>
  FEATURE_INVENTORY.find((feature) => feature.id === id);
