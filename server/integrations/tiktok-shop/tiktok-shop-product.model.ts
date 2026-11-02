import { Schema, model } from "mongoose";

const TikTokOptionSchema = new Schema({
  code: { type: String, default: "", trim: true },
  value: { type: String, default: "", trim: true },
}, { _id: false });

const TikTokAttributeSchema = new Schema({
  code: { type: String, default: "", trim: true },
  name: { type: String, default: "", trim: true },
  value: { type: String, default: "", trim: true },
}, { _id: false });

const TikTokSkuSchema = new Schema({
  skuId: { type: String, default: "", trim: true },
  sellerSku: { type: String, default: "", trim: true },
  barcode: { type: String, default: "", trim: true },
  displayName: { type: String, default: "", trim: true },
  optionValues: { type: [TikTokOptionSchema], default: [] },
  imageUrls: { type: [String], default: [] },
  weightGrams: { type: Number, min: 0 },
  lengthMm: { type: Number, min: 0 },
  widthMm: { type: Number, min: 0 },
  heightMm: { type: Number, min: 0 },
  priceAmount: { type: String, default: "", trim: true },
  currency: { type: String, default: "", trim: true },
  inventoryQuantity: { type: Number, default: 0 },
  hasInventorySnapshot: { type: Boolean, default: false },
  inventory: { type: [new Schema({
    warehouseId: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0, min: 0 },
  }, { _id: false })], default: [] },
  localProductId: { type: String, default: "", trim: true },
  localVariantId: { type: String, default: "", trim: true },
}, { _id: false });

const TikTokShopProductSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  connectionId: { type: String, required: true, trim: true, index: true },
  shopCipher: { type: String, required: true, trim: true, index: true },
  shopName: { type: String, default: "", trim: true },
  tiktokProductId: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  status: { type: String, default: "", trim: true },
  imageUrl: { type: String, default: "", trim: true },
  imageUrls: { type: [String], default: [] },
  description: { type: String, default: "" },
  categoryId: { type: String, default: "", trim: true },
  categoryName: { type: String, default: "", trim: true },
  brandId: { type: String, default: "", trim: true },
  brandName: { type: String, default: "", trim: true },
  manufacturer: { type: String, default: "", trim: true },
  countryOfOrigin: { type: String, default: "", trim: true },
  productAttributes: { type: [TikTokAttributeSchema], default: [] },
  packageWeightGrams: { type: Number, min: 0 },
  packageLengthMm: { type: Number, min: 0 },
  packageWidthMm: { type: Number, min: 0 },
  packageHeightMm: { type: Number, min: 0 },
  detailsSyncStatus: { type: String, enum: ["pending", "complete", "incomplete", "failed"], default: "pending" },
  detailsSyncedAt: { type: Date, default: null },
  missingInfo: { type: [String], default: [] },
  detailsSyncError: { type: String, default: "" },
  skus: { type: [TikTokSkuSchema], default: [] },
  tiktokCreateTime: { type: Date, default: null },
  tiktokUpdateTime: { type: Date, default: null },
  lastSeenAt: { type: Date, required: true },
  lastOutboundSyncAt: { type: Date, default: null },
  lastOutboundSyncStatus: { type: String, enum: ["never", "success", "failed"], default: "never" },
  lastOutboundSyncError: { type: String, default: "" },
}, { timestamps: true });

TikTokShopProductSchema.index({ companyCode: 1, connectionId: 1, shopCipher: 1, tiktokProductId: 1 }, { unique: true });
TikTokShopProductSchema.index({ companyCode: 1, "skus.sellerSku": 1 });

export const TikTokShopProductModel = model("TikTokShopProduct", TikTokShopProductSchema);
