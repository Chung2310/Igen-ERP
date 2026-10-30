import type {
  ProductCatalogStatus,
  ProductCatalogType,
  ProductResource,
  ProductTrackingMode,
  ProductVariant,
  CatalogProductDetail,
  VariantInput,
} from "../../../services/productCatalogService";
import { generateEAN13 } from "../../../hooks/useVariantMatrix";

export const DEFAULT_UNIT_CODE = "UOM-CAI";

export type Resources = {
  categories: ProductResource[];
  brands: ProductResource[];
  attributes: ProductResource[];
};

export type VariantModalMode = "single" | "edit" | "bulk-create" | "bulk-edit";
export type VariantTarget = { product: CatalogProductDetail; mode: VariantModalMode; ids?: string[]; variant?: ProductVariant };

export type ProductForm = {
  productCode: string;
  name: string;
  productType: ProductCatalogType;
  categoryCode: string;
  brandCode: string;
  baseUnitCode: string;
  shortDescription: string;
  description: string;
  manufacturer: string;
  countryOfOrigin: string;
  taxCategory: string;
  warrantyMonths: number;
  status: ProductCatalogStatus;
  mediaIds: string[];
};

export const emptyProductForm = (): ProductForm => ({
  productCode: "",
  name: "",
  productType: "physical",
  categoryCode: "",
  brandCode: "",
  baseUnitCode: DEFAULT_UNIT_CODE,
  shortDescription: "",
  description: "",
  manufacturer: "",
  countryOfOrigin: "",
  taxCategory: "",
  warrantyMonths: 0,
  status: "draft",
  mediaIds: [],
});

export const emptyVariant = (unitCode = DEFAULT_UNIT_CODE, productType: ProductCatalogType = "physical"): VariantInput => ({
  sku: "",
  barcode: generateEAN13(),
  displayName: "",
  unitCode,
  trackingMode: "none",
  status: "active",
  mediaIds: [],
  sellingPrice: 0,
  costPrice: 0,
  supplierWarrantyMonths: 0,
});

export const DEFAULT_PHONE_ATTRIBUTE_PRESETS: Record<string, { code: string; name: string; options: string[] }> = {
  COLOR: {
    code: "COLOR",
    name: "Màu sắc",
    options: [
      "Titan Sa Mạc",
      "Titan Tự Nhiên",
      "Titan Đen",
      "Titan Trắng",
      "Đen",
      "Trắng",
      "Xanh Dương",
      "Hồng ",
      "Vàng",
      "Bạc",
    ],
  },
  STORAGE: {
    code: "STORAGE",
    name: "Dung lượng",
    options: ["64GB", "128GB", "256GB", "512GB", "1TB"],
  },
  CONDITION: {
    code: "CONDITION",
    name: "Tình trạng",
    options: ["Mới 100% Nguyên Seal", "Mới 100% Active Online", "Like-new 99%", "Cũ 98% Đẹp"],
  },
  ORIGIN: {
    code: "ORIGIN",
    name: "Thị trường / Xuất xứ",
    options: ["VN/A (Chính hãng VN)", "LL/A (Bản Mỹ)", "ZA/A (Bản Singapore)", "JA/A (Bản Nhật)"],
  },
  RAM: {
    code: "RAM",
    name: "RAM",
    options: ["4GB", "6GB", "8GB", "12GB", "16GB", "24GB"],
  },
  WATTAGE: {
    code: "WATTAGE",
    name: "Công suất sạc",
    options: ["20W", "30W", "35W", "45W", "65W", "100W"],
  },
};

export const typeLabels: Record<ProductCatalogType, string> = {
  physical: "Hàng hóa",
  service: "Dịch vụ",
  bundle: "Gói sản phẩm",
};

export const statusLabels: Record<ProductCatalogStatus, string> = {
  draft: "Nháp",
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
  archived: "Lưu trữ",
};

export const unitCategoryLabels: Record<string, string> = {
  count: "Đếm",
  weight: "Khối lượng",
  volume: "Thể tích",
  length: "Chiều dài",
  time: "Thời gian",
  other: "Khác",
};

export const trackingLabels: Record<ProductTrackingMode, string> = {
  quantity: "Số lượng",
  unit_barcode: "Theo mã vạch từng đơn vị",
  lot: "Theo lô",
  serial: "Theo số sê-ri / IMEI",
  none: "Không theo dõi",
};

export function inputClassName(extra = "") {
  return `w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 ${extra}`;
}

export function getCategoryDisplayName(categoryCode: string, categories: ProductResource[]): string {
  const path: string[] = [];
  let current = categories.find((c) => c.code === categoryCode);
  const visited = new Set<string>();
  while (current && !visited.has(current.code)) {
    visited.add(current.code);
    path.unshift(current.name);
    if (!current.parentCode) break;
    current = categories.find((c) => c.code === current!.parentCode);
  }
  return path.length > 0 ? path.join(" > ") : categoryCode;
}

export interface CategoryNode3 {
  category: ProductResource;
  level: 1 | 2 | 3;
  children: CategoryNode3[];
}

export function buildCategoryTree3(categories: ProductResource[]): {
  tree: CategoryNode3[];
  levelMap: Map<string, 1 | 2 | 3>;
} {
  const levelMap = new Map<string, 1 | 2 | 3>();

  // Cấp 1: Thư mục gốc (không có parentCode)
  const level1List = categories.filter((c) => !c.parentCode);
  for (const c of level1List) {
    levelMap.set(c.code, 1);
  }

  // Cấp 2: Thuộc Cấp 1
  const level2List = categories.filter((c) => c.parentCode && levelMap.get(c.parentCode) === 1);
  for (const c of level2List) {
    levelMap.set(c.code, 2);
  }

  // Cấp 3: Thuộc Cấp 2 (Tối đa)
  const level3List = categories.filter((c) => c.parentCode && levelMap.get(c.parentCode) === 2);
  for (const c of level3List) {
    levelMap.set(c.code, 3);
  }

  // Dựng cây phân cấp
  const tree: CategoryNode3[] = level1List.map((root) => {
    const l2Children = categories
      .filter((c) => c.parentCode === root.code)
      .map((l2) => {
        const l3Children = categories
          .filter((c) => c.parentCode === l2.code)
          .map((l3) => ({
            category: l3,
            level: 3 as const,
            children: [],
          }));
        return {
          category: l2,
          level: 2 as const,
          children: l3Children,
        };
      });

    return {
      category: root,
      level: 1 as const,
      children: l2Children,
    };
  });

  return { tree, levelMap };
}
