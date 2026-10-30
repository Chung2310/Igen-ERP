import {
  ProductCatalogCategoryModel,
  ProductCatalogBrandModel,
  UnitOfMeasureModel,
  ProductAttributeDefinitionModel,
} from "../../../model/product-catalog-resource.model";

export const CatalogSeedService = {
  async seedDefaults(companyCode: string, actor = "system") {
    const defaultCategories = [
      // Level 0: Ngành hàng
      { code: "CAT-DIEN-THOAI", name: "Điện thoại thông minh", defaultTrackingMode: "serial", description: "Điện thoại các hãng (quản lý theo IMEI)" },
      { code: "CAT-TABLET", name: "Máy tính bảng / iPad", defaultTrackingMode: "serial", description: "Máy tính bảng, iPad (quản lý theo IMEI)" },
      { code: "CAT-PHU-KIEN", name: "Phụ kiện sạc cáp", defaultTrackingMode: "quantity", description: "Phụ kiện điện thoại thông dụng" },
      { code: "CAT-AM-THANH", name: "Âm thanh & Tai nghe", defaultTrackingMode: "unit_barcode", description: "AirPods, tai nghe, loa Bluetooth" },
      { code: "CAT-LINH-KIEN", name: "Linh kiện sửa chữa", defaultTrackingMode: "quantity", description: "Màn hình, pin, linh kiện thay thế" },

      // Level 1: Danh mục con
      { code: "CAT-DT-IPHONE", name: "iPhone (Apple)", parentCode: "CAT-DIEN-THOAI", defaultTrackingMode: "serial" },
      { code: "CAT-DT-SAMSUNG", name: "Samsung Galaxy", parentCode: "CAT-DIEN-THOAI", defaultTrackingMode: "serial" },
      { code: "CAT-DT-XIAOMI", name: "Xiaomi / Redmi", parentCode: "CAT-DIEN-THOAI", defaultTrackingMode: "serial" },

      { code: "CAT-TB-IPAD", name: "iPad (Apple)", parentCode: "CAT-TABLET", defaultTrackingMode: "serial" },
      { code: "CAT-TB-SAMSUNG", name: "Galaxy Tab", parentCode: "CAT-TABLET", defaultTrackingMode: "serial" },

      { code: "CAT-PK-CU-SAC", name: "Củ sạc / Adapter", parentCode: "CAT-PHU-KIEN", defaultTrackingMode: "quantity" },
      { code: "CAT-PK-CAP-SAC", name: "Cáp sạc / Dây sạc", parentCode: "CAT-PHU-KIEN", defaultTrackingMode: "quantity" },
      { code: "CAT-PK-PIN-DP", name: "Pin sạc dự phòng", parentCode: "CAT-PHU-KIEN", defaultTrackingMode: "quantity" },
      { code: "CAT-PK-OP-LUNG", name: "Ốp lưng & Bao da", parentCode: "CAT-PHU-KIEN", defaultTrackingMode: "quantity" },
      { code: "CAT-PK-CUONG-LUC", name: "Kính cường lực", parentCode: "CAT-PHU-KIEN", defaultTrackingMode: "quantity" },

      { code: "CAT-AT-TAI-NGHE", name: "Tai nghe Bluetooth / AirPods", parentCode: "CAT-AM-THANH", defaultTrackingMode: "unit_barcode" },
      { code: "CAT-AT-LOA", name: "Loa Bluetooth", parentCode: "CAT-AM-THANH", defaultTrackingMode: "unit_barcode" },

      { code: "CAT-LK-MAN-HINH", name: "Màn hình thay thế", parentCode: "CAT-LINH-KIEN", defaultTrackingMode: "quantity" },
      { code: "CAT-LK-PIN", name: "Pin thay thế", parentCode: "CAT-LINH-KIEN", defaultTrackingMode: "quantity" },
    ];

    const defaultBrands = [
      { code: "BRAND-APPLE", name: "Apple", description: "Tập đoàn công nghệ Apple Inc." },
      { code: "BRAND-SAMSUNG", name: "Samsung", description: "Tập đoàn công nghệ Samsung" },
      { code: "BRAND-XIAOMI", name: "Xiaomi", description: "Tập đoàn công nghệ Xiaomi" },
      { code: "BRAND-OPPO", name: "Oppo", description: "Thương hiệu điện thoại Oppo" },
      { code: "BRAND-ANKER", name: "Anker", description: "Thương hiệu phụ kiện sạc cao cấp Anker" },
      { code: "BRAND-BASEUS", name: "Baseus", description: "Thương hiệu phụ kiện Baseus" },
      { code: "BRAND-UGREEN", name: "Ugreen", description: "Thương hiệu phụ kiện Ugreen" },
      { code: "BRAND-MARSHALL", name: "Marshall", description: "Thương hiệu âm thanh Marshall" },
      { code: "BRAND-JBL", name: "JBL", description: "Thương hiệu âm thanh JBL" },
    ];

    const defaultUnits = [
      { code: "UOM-CAI", name: "Cái", category: "count", symbol: "cái", decimalPlaces: 0 },
      { code: "UOM-CHIEC", name: "Chiếc", category: "count", symbol: "chiếc", decimalPlaces: 0 },
      { code: "UOM-BO", name: "Bộ", category: "count", symbol: "bộ", decimalPlaces: 0 },
      { code: "UOM-HOP", name: "Hộp", category: "count", symbol: "hộp", decimalPlaces: 0 },
    ];

    const defaultAttributes = [
      {
        code: "COLOR",
        name: "Màu sắc",
        type: "select",
        options: [
          "Titan Sa Mạc",
          "Titan Tự Nhiên",
          "Titan Đen",
          "Titan Trắng",
          "Đen ",
          "Trắng ",
          "Xanh Dương ",
          "Hồng ",
          "Vàng ",
          "Bạc ",
          "Xám "
        ],
      },
      {
        code: "STORAGE",
        name: "Dung lượng",
        type: "select",
        options: ["64GB", "128GB", "256GB", "512GB", "1TB"],
      },
      {
        code: "CONDITION",
        name: "Tình trạng máy",
        type: "select",
        options: [
          "Mới 100% Nguyên Seal",
          "Mới 100% Active Online",
          "Like-new 99%",
          "Cũ 98% Đẹp",
          "Cũ 95% Giá Rẻ"
        ],
      },
      {
        code: "ORIGIN",
        name: "Xuất xứ / Thị trường",
        type: "select",
        options: ["VN/A (Chính hãng VN)", "LL/A (Bản Mỹ)", "ZA/A (Bản Singapore)", "JA/A (Bản Nhật)"],
      },
    ];

    let createdCategoriesCount = 0;
    for (const cat of defaultCategories) {
      const exists = await ProductCatalogCategoryModel.exists({ companyCode, code: cat.code });
      if (!exists) {
        await ProductCatalogCategoryModel.create({
          companyCode,
          code: cat.code,
          name: cat.name,
          normalizedName: cat.name.toLowerCase(),
          parentCode: cat.parentCode,
          defaultTrackingMode: cat.defaultTrackingMode as any,
          description: cat.description,
          status: "active",
          createdBy: actor,
          updatedBy: actor,
        });
        createdCategoriesCount++;
      }
    }

    let createdBrandsCount = 0;
    for (const brand of defaultBrands) {
      const exists = await ProductCatalogBrandModel.exists({ companyCode, code: brand.code });
      if (!exists) {
        await ProductCatalogBrandModel.create({
          companyCode,
          code: brand.code,
          name: brand.name,
          normalizedName: brand.name.toLowerCase(),
          description: brand.description,
          status: "active",
          createdBy: actor,
          updatedBy: actor,
        });
        createdBrandsCount++;
      }
    }

    let createdUnitsCount = 0;
    for (const unit of defaultUnits) {
      const exists = await UnitOfMeasureModel.exists({ companyCode, code: unit.code });
      if (!exists) {
        await UnitOfMeasureModel.create({
          companyCode,
          code: unit.code,
          name: unit.name,
          category: unit.category as any,
          symbol: unit.symbol,
          decimalPlaces: unit.decimalPlaces,
          status: "active",
          createdBy: actor,
          updatedBy: actor,
        });
        createdUnitsCount++;
      }
    }

    let createdAttributesCount = 0;
    for (const attr of defaultAttributes) {
      const exists = await ProductAttributeDefinitionModel.exists({ companyCode, code: attr.code });
      if (!exists) {
        await ProductAttributeDefinitionModel.create({
          companyCode,
          code: attr.code,
          name: attr.name,
          type: attr.type as any,
          options: attr.options,
          status: "active",
          createdBy: actor,
          updatedBy: actor,
        });
        createdAttributesCount++;
      }
    }

    return {
      success: true,
      created: {
        categories: createdCategoriesCount,
        brands: createdBrandsCount,
        units: createdUnitsCount,
        attributes: createdAttributesCount,
      },
    };
  },
};
