/* eslint-disable @typescript-eslint/no-explicit-any -- TikTok product/token payloads vary by market and API version. */
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, hashOpaque } from "../../security/crypto";
import { ProductVariantModel } from "../../model/product-variant.model";
import { ProductPriceModel } from "../../model/product-price.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { BranchModel } from "../../model/branch.model";
import { ProductCatalogBrandModel, ProductCatalogCategoryModel, UnitOfMeasureModel } from "../../model/product-catalog-resource.model";
import { runInTransaction } from "../../config/database";
import { ensureDefaultWarehouse } from "../../modules/inventory/warehouse/warehouse.service";
import { TikTokShopConnectionModel } from "./tiktok-shop-connection.model";
import { TikTokShopSettingsModel } from "./tiktok-shop-settings.model";
import { TikTokShopOAuthStateModel } from "./tiktok-shop-oauth-state.model";
import { TikTokShopProductModel } from "./tiktok-shop-product.model";
import { callTikTokShopApi, exchangeTikTokShopCode, getTikTokShopConfig, refreshTikTokShopToken, uploadTikTokShopProductImage } from "./tiktok-shop.client";

const normalizeCompany = (value: unknown) => {
  const companyCode = String(value || "").trim().toUpperCase();
  if (!companyCode) throw Object.assign(new Error("Tài khoản chưa được gắn với công ty."), { statusCode: 400 });
  return companyCode;
};

const TIKTOK_REVIEW_PENDING_STATUSES = new Set(["PENDING", "PENDING_REVIEW", "PENDING_APPROVAL", "WAITING_FOR_REVIEW", "UNDER_REVIEW", "IN_REVIEW"]);

const tokenExpiry = (value: unknown, fallbackSeconds: number) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return new Date(Date.now() + fallbackSeconds * 1000);
  // TikTok deployments have returned both a duration and an absolute Unix timestamp
  // under fields ending in `_expire_in`, so accept both representations.
  return new Date(number > 100_000_000 ? number * 1000 : Date.now() + number * 1000);
};

const tokenExpiresAt = (data: any) => tokenExpiry(data.access_token_expire_time ?? data.access_token_expire_in ?? data.access_token_expires_in, 24 * 60 * 60);
const refreshExpiresAt = (data: any) => tokenExpiry(data.refresh_token_expire_time ?? data.refresh_token_expire_in ?? data.refresh_token_expires_in, 30 * 24 * 60 * 60);
const tiktokFlag = (value: unknown) => value === true || value === 1 || /^(true|1|yes)$/i.test(String(value || "").trim());
function isValidGtin(input: unknown) {
  const code = String(input || "").trim();
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const checkDigit = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function publicConnection(connection: any) {
  return {
    id: String(connection._id),
    openId: connection.openId,
    shops: connection.shops || [],
    scopes: connection.scopes || [],
    connectedAt: connection.connectedAt,
    sync: {
      at: connection.lastProductSyncAt,
      status: connection.lastProductSyncStatus,
      error: connection.lastProductSyncError || "",
      stats: connection.lastProductSyncStats || { total: 0, matched: 0, unmatched: 0 },
    },
  };
}

function normalizedShops(data: any) {
  const shops = Array.isArray(data?.shops) ? data.shops : [];
  return shops.map((shop: any) => ({
    cipher: String(shop.cipher || shop.shop_cipher || ""),
    id: String(shop.id || shop.shop_id || ""),
    code: String(shop.code || shop.shop_code || ""),
    name: String(shop.name || shop.shop_name || shop.code || shop.shop_code || "TikTok Shop"),
    region: String(shop.region || shop.region_code || ""),
    retailBranchId: "",
  })).filter((shop: any) => shop.cipher);
}

async function connectionsWithSecrets(companyCode: string) {
  return TikTokShopConnectionModel.find({ companyCode }).select("+accessTokenEncrypted +refreshTokenEncrypted");
}

async function authorizedShop(companyCode: string, connectionIdInput: unknown, shopCipherInput: unknown) {
  const connectionId = String(connectionIdInput || "").trim();
  const shopCipher = String(shopCipherInput || "").trim();
  if (!connectionId || !shopCipher) throw Object.assign(new Error("Chưa chọn tài khoản và shop TikTok."), { statusCode: 400 });
  const connection: any = await TikTokShopConnectionModel.findOne({ _id: connectionId, companyCode }).select("+accessTokenEncrypted +refreshTokenEncrypted");
  const shop = connection?.shops?.find((item: any) => String(item.cipher) === shopCipher);
  if (!connection || !shop) throw Object.assign(new Error("Shop TikTok không thuộc kết nối của công ty này."), { statusCode: 404 });
  return { connection, shop, accessToken: await validAccessToken(connection) };
}

function categoryVersionForRegion(regionInput: unknown) {
  const region = String(regionInput || "").trim().toUpperCase();
  return ["US", "GB", "UK", "EU", "DE", "FR", "IT", "ES", "IE", "NL", "BE", "PT", "AT", "FI", "GR", "EE", "LV", "LT", "LU", "MT", "CY", "SI", "SK", "HR", "PL", "CZ", "RO", "HU", "SE", "DK", "BG", "MY", "TH", "ID", "PH", "SG", "VN"].includes(region) ? "v2" : "v1";
}

function currencyForRegion(regionInput: unknown) {
  const region = String(regionInput || "").trim().toUpperCase();
  const currencies: Record<string, string> = {
    VN: "VND", TH: "THB", SG: "SGD", MY: "MYR", ID: "IDR", PH: "PHP", US: "USD", GB: "GBP", UK: "GBP",
    EU: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", IE: "EUR", NL: "EUR", BE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", SI: "EUR", SK: "EUR", HR: "EUR", BG: "EUR",
    PL: "PLN", CZ: "CZK", RO: "RON", HU: "HUF", SE: "SEK", DK: "DKK", JP: "JPY", MX: "MXN", BR: "BRL",
  };
  const currency = currencies[region];
  if (!currency) throw Object.assign(new Error(`Chưa cấu hình tiền tệ cho khu vực TikTok Shop ${region || "không xác định"}.`), { statusCode: 400 });
  return currency;
}

function normalizeTikTokAttributes(data: any) {
  const sources = [
    ...(Array.isArray(data?.attributes) ? data.attributes : []),
    ...(Array.isArray(data?.product_attributes) ? data.product_attributes : []),
    ...(Array.isArray(data?.sales_attributes) ? data.sales_attributes : []),
  ];
  const unique = new Map<string, any>();
  for (const row of sources) {
    const id = firstString(row?.id, row?.attribute_id);
    if (!id) continue;
    const values = row?.values || row?.value_list || row?.options || row?.value_info?.values || [];
    const isSales = tiktokFlag(row?.is_sales_attribute ?? row?.is_sale_attribute ?? row?.is_sale_prop)
      || /SALE|SKU/i.test(String(row?.type || row?.attribute_type || row?.property_type || ""));
    unique.set(`${isSales ? "sales" : "product"}:${id}`, {
      id,
      name: firstString(row?.name, row?.attribute_name, row?.local_name) || id,
      required: tiktokFlag(row?.is_required ?? row?.is_mandatory ?? row?.required),
      isSales,
      values: Array.isArray(values) ? values.map((value: any) => ({
        id: firstString(value?.id, value?.value_id),
        name: firstString(value?.name, value?.value_name, value?.local_name),
      })).filter((value: any) => value.id || value.name) : [],
      inputType: firstString(row?.input_type, row?.input_type_name, row?.type),
    });
  }
  return [...unique.values()];
}

function trustedProductImageUrl(input: unknown) {
  const value = String(input || "").trim();
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Ảnh sản phẩm phải là URL hợp lệ."); }
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !cloudName || url.pathname.split("/")[1] !== cloudName) {
    throw new Error("Ảnh cần được tải lên Cloudinary của hệ thống trước khi đăng TikTok.");
  }
  return url;
}

async function uploadCatalogImageToTikTok(urlValue: unknown, accessToken: string, fileName: string) {
  const url = trustedProductImageUrl(urlValue);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("Không tải được ảnh sản phẩm đã lưu.");
  const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("Ảnh TikTok phải ở định dạng JPG, PNG hoặc WEBP.");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > 10 * 1024 * 1024) throw new Error("Ảnh TikTok không được vượt quá 10 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Ảnh TikTok rỗng hoặc vượt quá 10 MB.");
  const data: any = await uploadTikTokShopProductImage({ path: "/product/202309/images/upload", accessToken, data: bytes, fileName, mimeType });
  const image = data?.image || data?.images?.[0] || data;
  const uri = firstString(image?.uri, image?.image_uri, data?.uri);
  if (!uri) throw new Error("TikTok không trả về URI ảnh sản phẩm.");
  return uri;
}

async function validAccessToken(connection: any) {
  if (new Date(connection.accessTokenExpiresAt).getTime() > Date.now() + 10 * 60 * 1000) {
    return decryptSecret(connection.accessTokenEncrypted);
  }
  const currentRefreshToken = decryptSecret(connection.refreshTokenEncrypted);
  const data: any = await refreshTikTokShopToken(currentRefreshToken);
  if (!data.access_token) throw new Error("TikTok Shop không trả về access token mới.");
  connection.accessTokenEncrypted = encryptSecret(String(data.access_token));
  connection.refreshTokenEncrypted = encryptSecret(String(data.refresh_token || currentRefreshToken));
  connection.accessTokenExpiresAt = tokenExpiresAt(data);
  connection.refreshTokenExpiresAt = refreshExpiresAt(data);
  connection.scopes = Array.isArray(data.granted_scopes) ? data.granted_scopes : connection.scopes;
  await connection.save();
  return String(data.access_token);
}

export async function validTikTokShopAccessToken(connection: any) {
  return validAccessToken(connection);
}

export async function getTikTokShopOrderBranch(companyCodeInput: unknown) {
  const companyCode = normalizeCompany(companyCodeInput);
  const settings: any = await TikTokShopSettingsModel.findOne({ companyCode }).select("orderBranchId").lean();
  let branchId = String(settings?.orderBranchId || "").trim();
  if (!branchId) {
    const legacyConnection: any = await TikTokShopConnectionModel.findOne({ companyCode, shops: { $elemMatch: { retailBranchId: { $exists: true, $nin: ["", null] } } } })
      .sort({ connectedAt: 1 }).select("shops").lean();
    branchId = String(legacyConnection?.shops?.find((shop: any) => String(shop.retailBranchId || "").trim())?.retailBranchId || "").trim();
  }
  if (!branchId || !await BranchModel.exists({ _id: branchId, companyCode, isActive: true })) return "";
  return branchId;
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

async function getListingCategories(accessToken: string, shopCipher: string, categoryVersion: string) {
  const path = "/product/202309/categories";
  try {
    return await callTikTokShopApi({
      path, accessToken,
      query: { shop_cipher: shopCipher, category_version: categoryVersion, locale: "vi-VN" },
    });
  } catch (error) {
    const apiCode = String((error as any)?.apiCode || "");
    const message = error instanceof Error ? error.message : String(error || "");
    if (apiCode !== "36009004" || !/shop_cipher.*not required/i.test(message)) throw error;
    return callTikTokShopApi({ path, accessToken, query: { category_version: categoryVersion, locale: "vi-VN" } });
  }
}

async function getListingWarehouses(accessToken: string, shopCipher: string) {
  const data: any = await callTikTokShopApi({
    path: "/logistics/202309/warehouses", accessToken,
    query: { shop_cipher: shopCipher },
  });
  const raw = Array.isArray(data?.warehouses) ? data.warehouses : Array.isArray(data?.warehouse_list) ? data.warehouse_list : [];
  return raw.map((row: any) => ({
    id: firstString(row?.id, row?.warehouse_id),
    name: firstString(row?.name, row?.warehouse_name, row?.id, row?.warehouse_id),
    type: firstString(row?.type, row?.warehouse_type),
    isEnabled: row?.is_enabled ?? row?.enabled ?? true,
  })).filter((row: any) => row.id && row.isEnabled !== false);
}

async function getListingCategoryAttributes(accessToken: string, shopCipher: string, categoryId: string, categoryVersion: string) {
  return callTikTokShopApi({
    path: `/product/202309/categories/${encodeURIComponent(categoryId)}/attributes`, accessToken,
    query: { shop_cipher: shopCipher, category_version: categoryVersion, locale: "vi-VN" },
  });
}

function quantityFromSku(sku: any) {
  if (Number.isFinite(Number(sku?.inventory?.quantity))) return Number(sku.inventory.quantity);
  if (sku?.inventory_quantity !== undefined && sku?.inventory_quantity !== null && Number.isFinite(Number(sku.inventory_quantity))) return Number(sku.inventory_quantity);
  if (Array.isArray(sku?.inventory)) return sku.inventory.reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0);
  if (Array.isArray(sku?.inventory?.warehouse_inventory)) return sku.inventory.warehouse_inventory.reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0);
  return 0;
}

function hasSkuInventorySnapshot(sku: any) {
  const inventory = sku?.inventory;
  if (Array.isArray(inventory) && inventory.length) return true;
  if (Array.isArray(inventory?.warehouse_inventory) && inventory.warehouse_inventory.length) return true;
  if (inventory && typeof inventory === "object" && !Array.isArray(inventory)
    && inventory.quantity !== undefined && inventory.quantity !== null && Number.isFinite(Number(inventory.quantity))) return true;
  return sku?.inventory_quantity !== undefined && sku?.inventory_quantity !== null && Number.isFinite(Number(sku.inventory_quantity));
}

export function missingTikTokProductInfo(input: {
  description?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrls?: string[];
  skus: Array<{ skuId?: string; priceAmount?: string; currency?: string; hasInventorySnapshot?: boolean }>;
}) {
  const missing: string[] = [];
  if (!String(input.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()) missing.push("Mô tả");
  if (!firstString(input.categoryId, input.categoryName)) missing.push("Danh mục");
  if (!input.imageUrls?.length) missing.push("Ảnh sản phẩm");
  if (!input.skus.length || input.skus.some((sku) => !firstString(sku.skuId))) missing.push("SKU");
  if (input.skus.length && input.skus.some((sku) => !firstString(sku.priceAmount) || !firstString(sku.currency))) missing.push("Giá SKU");
  if (input.skus.length && input.skus.some((sku) => !sku.hasInventorySnapshot)) missing.push("Tồn kho SKU");
  return missing;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(items.length, Math.max(1, Math.trunc(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

function inventoryFromSku(sku: any) {
  const rows = Array.isArray(sku?.inventory)
    ? sku.inventory
    : Array.isArray(sku?.inventory?.warehouse_inventory) ? sku.inventory.warehouse_inventory : [];
  return rows.map((row: any) => ({
    warehouseId: firstString(row?.warehouse_id, row?.warehouseId),
    quantity: Math.max(0, Math.trunc(Number(row?.quantity || 0))),
  })).filter((row: any) => row.warehouseId);
}

export function allocateTikTokInventory(totalInput: number, currentRows: Array<{ warehouseId: string; quantity: number }>) {
  const total = Math.max(0, Math.trunc(totalInput));
  if (!currentRows.length) throw new Error("SKU TikTok chưa có kho hàng; hãy cấu hình kho trên Seller Center rồi đồng bộ danh mục lại.");
  if (currentRows.length === 1) return [{ warehouse_id: currentRows[0].warehouseId, quantity: total }];
  const currentTotal = currentRows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity || 0)), 0);
  let assigned = 0;
  return currentRows.map((row, index) => {
    const quantity = index === currentRows.length - 1
      ? total - assigned
      : currentTotal > 0 ? Math.floor(total * Math.max(0, Number(row.quantity || 0)) / currentTotal) : (index === 0 ? total : 0);
    assigned += quantity;
    return { warehouse_id: row.warehouseId, quantity };
  });
}

async function localValues(companyCode: string, variantIds: string[], branchId?: string) {
  const [warehouses, balances, prices] = await Promise.all([
    WarehouseModel.find({ companyCode, isActive: true, kind: { $in: ["selling", "central", "other"] } }).select("_id").lean(),
    InventoryBalanceModel.find({ companyCode, variantId: { $in: variantIds } }).select("variantId warehouseId quantity reservedQuantity").lean(),
    ProductPriceModel.find({ companyCode, variantId: { $in: variantIds }, status: "active", ...(branchId ? { branchId } : {}) }).select("variantId sellingPrice").lean(),
  ]);
  const sellableWarehouseIds = new Set(warehouses.map((row: any) => String(row._id)));
  const stockByVariant = new Map<string, number>();
  for (const row of balances as any[]) {
    if (!sellableWarehouseIds.has(String(row.warehouseId))) continue;
    const variantId = String(row.variantId || "");
    stockByVariant.set(variantId, (stockByVariant.get(variantId) || 0) + Math.max(0, Number(row.quantity || 0) - Number(row.reservedQuantity || 0)));
  }
  const pricesByVariant = new Map<string, Set<number>>();
  for (const row of prices as any[]) {
    const set = pricesByVariant.get(String(row.variantId)) || new Set<number>();
    set.add(Number(row.sellingPrice));
    pricesByVariant.set(String(row.variantId), set);
  }
  return { stockByVariant, pricesByVariant };
}

function parseImage(product: any) {
  const image = product?.main_images?.[0] || product?.images?.[0];
  return firstString(image?.thumb_urls?.[0], image?.urls?.[0], image?.url);
}

async function pushOperationalData(companyCode: string, target?: { variantId?: string; sku?: string; branchId?: string }) {
  const filter: any = { companyCode, skus: { $elemMatch: { localVariantId: { $nin: ["", null] } } } };
  if (target?.variantId) filter["skus.localVariantId"] = target.variantId;
  else if (target?.sku) filter["skus.sellerSku"] = String(target.sku).trim().toUpperCase();
  const products: any[] = await TikTokShopProductModel.find(filter);
  const variantIds = [...new Set(products.flatMap((product) => product.skus.map((sku: any) => String(sku.localVariantId || "")).filter(Boolean)))];
  if (!variantIds.length) return { products: 0, skus: 0, updated: 0, skipped: 0, pendingReviewSkipped: 0, failed: 0, errors: [] as string[] };

  const { stockByVariant, pricesByVariant } = await localValues(companyCode, variantIds, target?.branchId);
  const connections = await connectionsWithSecrets(companyCode);
  const connectionById = new Map(connections.map((connection: any) => [String(connection._id), connection]));
  const tokenByConnection = new Map<string, string>();
  const result = { products: products.length, skus: 0, updated: 0, skipped: 0, pendingReviewSkipped: 0, failed: 0, errors: [] as string[] };

  for (const product of products) {
    const linkedSkus = product.skus.filter((sku: any) => sku.localVariantId && (!target?.variantId || sku.localVariantId === target.variantId) && (!target?.sku || String(sku.sellerSku).toUpperCase() === String(target.sku).toUpperCase()));
    result.skus += linkedSkus.length;
    if (TIKTOK_REVIEW_PENDING_STATUSES.has(String(product.status || "").trim().toUpperCase())) {
      result.skipped += linkedSkus.length;
      result.pendingReviewSkipped += linkedSkus.length;
      continue;
    }
    const connection: any = connectionById.get(String(product.connectionId));
    const errors: string[] = [];
    try {
      if (!connection) throw new Error("Kết nối TikTok Shop của sản phẩm không còn tồn tại.");
      let accessToken = tokenByConnection.get(String(connection._id));
      if (!accessToken) {
        accessToken = await validAccessToken(connection);
        tokenByConnection.set(String(connection._id), accessToken);
      }
      const inventorySkus: any[] = [];
      const priceSkus: any[] = [];
      for (const sku of linkedSkus) {
        const variantId = String(sku.localVariantId);
        inventorySkus.push({ id: sku.skuId, inventory: allocateTikTokInventory(stockByVariant.get(variantId) || 0, sku.inventory || []) });
        const prices = pricesByVariant.get(variantId);
        if (!prices?.size) {
          result.skipped += 1;
        } else if (prices.size > 1) {
          errors.push(`SKU ${sku.sellerSku}: giá bán giữa các chi nhánh không đồng nhất.`);
        } else {
          priceSkus.push({ id: sku.skuId, price: { amount: String([...prices][0]), currency: sku.currency || "VND" } });
        }
      }
      if (inventorySkus.length) {
        const data: any = await callTikTokShopApi({
          path: `/product/202309/products/${encodeURIComponent(product.tiktokProductId)}/inventory/update`, method: "POST", accessToken,
          query: { shop_cipher: product.shopCipher }, body: { skus: inventorySkus },
        });
        if (Array.isArray(data?.errors) && data.errors.length) throw new Error(data.errors.map((row: any) => row?.message || row?.code).join("; "));
      }
      if (priceSkus.length) {
        await callTikTokShopApi({
          path: `/product/202309/products/${encodeURIComponent(product.tiktokProductId)}/prices/update`, method: "POST", accessToken,
          query: { shop_cipher: product.shopCipher }, body: { skus: priceSkus },
        });
      }
      if (errors.length) throw new Error(errors.join(" "));
      for (const sku of linkedSkus) {
        const variantId = String(sku.localVariantId);
        sku.inventoryQuantity = stockByVariant.get(variantId) || 0;
        const price = pricesByVariant.get(variantId);
        if (price?.size === 1) sku.priceAmount = String([...price][0]);
      }
      product.lastOutboundSyncAt = new Date();
      product.lastOutboundSyncStatus = "success";
      product.lastOutboundSyncError = "";
      await product.save();
      result.updated += linkedSkus.length;
    } catch (error: any) {
      const message = `${product.title}: ${String(error?.message || "Đồng bộ thất bại")}`.slice(0, 500);
      product.lastOutboundSyncAt = new Date();
      product.lastOutboundSyncStatus = "failed";
      product.lastOutboundSyncError = message;
      await product.save();
      result.failed += linkedSkus.length;
      result.errors.push(message);
    }
  }
  return result;
}

const TIKTOK_CATEGORY_CODE = "CAT-TIKTOK-SHOP";
const DEFAULT_UNIT_CODE = "UOM-CAI";

async function ensureTikTokImportMasters(companyCode: string, actor: string, session?: any) {
  await ProductCatalogCategoryModel.findOneAndUpdate(
    { companyCode, code: TIKTOK_CATEGORY_CODE },
    { $set: { name: "Sản phẩm TikTok Shop", normalizedName: "sản phẩm tiktok shop", defaultTrackingMode: "quantity", status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: TIKTOK_CATEGORY_CODE, description: "Sản phẩm được nhập từ TikTok Shop", createdBy: actor } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) },
  );
  await UnitOfMeasureModel.findOneAndUpdate(
    { companyCode, code: DEFAULT_UNIT_CODE },
    { $set: { status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: DEFAULT_UNIT_CODE, name: "Cái", symbol: "cái", category: "count", decimalPlaces: 0, createdBy: actor } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) },
  );
}

function importedSkuCode(sku: any) {
  return (firstString(sku.sellerSku, sku.seller_sku) || `TT-${firstString(sku.skuId, sku.id, sku.sku_id)}`).trim().toUpperCase().slice(0, 100);
}

function variantDisplayName(sku: any, fallback: string) {
  const attributes = Array.isArray(sku?.sales_attributes) ? sku.sales_attributes : [];
  const values = attributes.map((row: any) => firstString(row.value_name, row.name)).filter(Boolean);
  return (values.join(" / ") || fallback).slice(0, 200);
}

function imageUrls(images: any) {
  if (!Array.isArray(images)) return [];
  return [...new Set(images.map((image: any) => [
    ...(Array.isArray(image?.urls) ? image.urls : []),
    image?.url,
    ...(Array.isArray(image?.thumb_urls) ? image.thumb_urls : []),
  ].map((value: unknown) => String(value || "").trim()).find((value: string) => /^https?:\/\//i.test(value)) || "").filter(Boolean))];
}

function skuOptionValues(sku: any) {
  const attributes = Array.isArray(sku?.sales_attributes) ? sku.sales_attributes : [];
  return attributes.map((row: any, index: number) => ({
    code: (`TT-${firstString(row.id, row.name) || `OPTION-${index + 1}`}`).replace(/[^A-Z0-9_-]/gi, "-").toUpperCase().slice(0, 100),
    value: firstString(row.value_name, row.name, row.value_id),
  })).filter((row: any) => row.value);
}

function skuImageUrls(sku: any) {
  const attributes = Array.isArray(sku?.sales_attributes) ? sku.sales_attributes : [];
  return imageUrls(attributes.flatMap((row: any) => [row.sku_img, row.image, ...(Array.isArray(row.supplementary_sku_images) ? row.supplementary_sku_images : [])]).filter(Boolean));
}

function tikTokProductAttributes(detail: any) {
  const attributes = Array.isArray(detail?.product_attributes) ? detail.product_attributes : [];
  return attributes.map((attribute: any, index: number) => {
    const values = Array.isArray(attribute?.values) ? attribute.values.map((value: any) => firstString(value?.name, value?.value_name, value?.value)).filter(Boolean) : [];
    const name = firstString(attribute?.name, attribute?.local_name, attribute?.attribute_name);
    const value = firstString(attribute?.value_name, attribute?.value) || values.join(", ");
    const codePart = firstString(attribute?.id, attribute?.attribute_id, name) || `OPTION-${index + 1}`;
    const code = (`TT-ATTR-${codePart}`).replace(/[^A-Z0-9_-]/gi, "-").toUpperCase().slice(0, 100);
    return { code, name, value };
  }).filter((attribute: any) => attribute.value);
}

function productAttributeValue(attributes: Array<{ name: string; value: string }>, labels: string[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
  const row = attributes.find((attribute) => {
    const name = normalize(attribute.name);
    return labels.some((label) => name.includes(normalize(label)));
  });
  return row?.value || "";
}

function tikTokCategory(detail: any) {
  const category = detail?.category || {};
  const id = firstString(category.id, detail?.category_id);
  return {
    code: id ? `TT-CAT-${id}`.toUpperCase().slice(0, 100) : TIKTOK_CATEGORY_CODE,
    name: (firstString(category.local_name, category.name, detail?.category_name, detail?.local_name) || (id ? `TikTok Shop category ${id}` : "Sản phẩm TikTok Shop")).slice(0, 300),
  };
}

function tikTokBrand(detail: any) {
  const brand = detail?.brand || {};
  const id = firstString(brand.id, detail?.brand_id);
  const name = firstString(brand.name, brand.brand_name);
  return id && name ? { code: `TT-BRAND-${id}`.toUpperCase().slice(0, 100), name: name.slice(0, 300) } : null;
}

function dimensionInMillimeters(value: unknown, unit: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  const normalizedUnit = String(unit || "").toUpperCase();
  if (normalizedUnit === "CM") return number * 10;
  if (normalizedUnit === "M") return number * 1000;
  if (normalizedUnit === "INCH" || normalizedUnit === "IN") return number * 25.4;
  return number;
}

function weightInGrams(value: unknown, unit: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  const normalizedUnit = String(unit || "").toUpperCase();
  if (normalizedUnit === "KG") return number * 1000;
  if (normalizedUnit === "LB") return number * 453.59237;
  if (normalizedUnit === "OZ") return number * 28.349523125;
  return number;
}

export const TikTokShopService = {
  async status(companyCodeInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const connections = await TikTokShopConnectionModel.find({ companyCode }).sort({ connectedAt: 1 }).lean();
    return {
      connected: connections.length > 0,
      connections: connections.map(publicConnection),
      shops: connections.flatMap((connection: any) => connection.shops || []),
    };
  },

  async activeBranches(companyCodeInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    return BranchModel.find({ companyCode, isActive: true }).select("_id code name").sort({ code: 1 }).lean();
  },

  async orderBranch(companyCodeInput: unknown) {
    return { branchId: await getTikTokShopOrderBranch(companyCodeInput) };
  },

  async setDefaultOrderBranch(companyCodeInput: unknown, branchIdInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const branchId = String(branchIdInput || "").trim();
    if (!branchId) throw Object.assign(new Error("Chọn chi nhánh nhận đơn TikTok Shop."), { statusCode: 400 });
    const branchExists = await BranchModel.exists({ _id: branchId, companyCode, isActive: true });
    if (!branchExists) throw Object.assign(new Error("Chi nhánh nhận đơn không tồn tại hoặc đã ngừng hoạt động."), { statusCode: 400 });
    const settings: any = await TikTokShopSettingsModel.findOneAndUpdate(
      { companyCode },
      { $set: { orderBranchId: branchId }, $setOnInsert: { companyCode } },
      { returnDocument: "after", upsert: true, runValidators: true },
    ).lean();
    return { branchId: String(settings.orderBranchId || "") };
  },

  async listPublishableProducts(companyCodeInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const products: any[] = await ProductCatalogModel.find({ companyCode, status: "active", productType: "physical" }).sort({ updatedAt: -1 }).limit(200).lean();
    if (!products.length) return { items: [] };
    const productIds = products.map((product) => String(product._id));
    const [variants, channelProducts] = await Promise.all([
      ProductVariantModel.find({ companyCode, productId: { $in: productIds }, status: "active", trackingMode: { $in: ["quantity", "serial", "unit_barcode", "lot"] } }).sort({ sku: 1 }).lean(),
      TikTokShopProductModel.find({ companyCode }).select("skus.localVariantId").lean(),
    ]);
    const linkedVariantIds = new Set(channelProducts.flatMap((product: any) => (product.skus || []).map((sku: any) => String(sku.localVariantId || "")).filter(Boolean)));
    const variantsByCandidateProduct = new Map<string, any[]>();
    for (const variant of variants as any[]) {
      const rows = variantsByCandidateProduct.get(String(variant.productId)) || [];
      rows.push(variant);
      variantsByCandidateProduct.set(String(variant.productId), rows);
    }
    const publishableProducts = products.filter((product) => {
      const productVariants = variantsByCandidateProduct.get(String(product._id)) || [];
      return productVariants.length > 0 && productVariants.every((variant) => !linkedVariantIds.has(String(variant._id)));
    });
    const publishableProductIds = new Set(publishableProducts.map((product) => String(product._id)));
    const publishableVariants = (variants as any[]).filter((variant) => publishableProductIds.has(String(variant.productId)));
    const variantIds = publishableVariants.map((variant: any) => String(variant._id));
    if (!variantIds.length) return { items: [] };
    const [values, prices] = await Promise.all([
      localValues(companyCode, variantIds),
      ProductPriceModel.find({ companyCode, variantId: { $in: variantIds }, status: "active" }).select("variantId sellingPrice").lean(),
    ]);
    const pricesByVariant = new Map<string, Set<number>>();
    for (const row of prices as any[]) {
      const set = pricesByVariant.get(String(row.variantId)) || new Set<number>();
      set.add(Number(row.sellingPrice));
      pricesByVariant.set(String(row.variantId), set);
    }
    const variantsByProduct = new Map<string, any[]>();
    for (const variant of publishableVariants as any[]) {
      const rows = variantsByProduct.get(String(variant.productId)) || [];
      const priceSet = pricesByVariant.get(String(variant._id));
      rows.push({
        _id: String(variant._id), sku: variant.sku, barcode: variant.barcode || "", displayName: variant.displayName || "",
        optionValues: variant.optionValues || [], weightGrams: Number(variant.weightGrams || 0),
        lengthMm: Number(variant.lengthMm || 0), widthMm: Number(variant.widthMm || 0), heightMm: Number(variant.heightMm || 0),
        imageUrls: variant.mediaIds || [], stock: values.stockByVariant.get(String(variant._id)) || 0,
        sellingPrice: priceSet?.size === 1 ? [...priceSet][0] : 0,
        priceConflict: Boolean(priceSet && priceSet.size > 1),
      });
      variantsByProduct.set(String(variant.productId), rows);
    }
    return {
      items: products.filter((product) => variantsByProduct.has(String(product._id))).map((product) => ({
        _id: String(product._id), productCode: product.productCode, name: product.name, description: product.description || product.shortDescription || "",
        mediaIds: [...new Set([...(product.mediaIds || []), ...((variantsByCandidateProduct.get(String(product._id)) || []).flatMap((variant: any) => variant.mediaIds || []))])], manufacturer: product.manufacturer || "", countryOfOrigin: product.countryOfOrigin || "",
        attributes: product.attributes || [], brandCode: product.brandCode || "", variants: variantsByProduct.get(String(product._id)) || [],
      })),
    };
  },

  async listingCategories(companyCodeInput: unknown, connectionId: unknown, shopCipher: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const { connection, shop, accessToken } = await authorizedShop(companyCode, connectionId, shopCipher);
    const categoryVersion = categoryVersionForRegion(shop.region);
    const data: any = await getListingCategories(accessToken, shop.cipher, categoryVersion);
    const rawCategories = Array.isArray(data?.categories) ? data.categories : [];
    const categories = rawCategories.flatMap((category: any) => {
      const isLeaf = Boolean(category?.is_leaf ?? category?.isLeaf);
      const permissions = Array.isArray(category?.permission_statuses) ? category.permission_statuses.map((value: unknown) => String(value).toUpperCase()) : [];
      if (!isLeaf || (permissions.length && !permissions.includes("AVAILABLE"))) return [];
      return [{ id: firstString(category?.id, category?.category_id), name: firstString(category?.local_name, category?.name, category?.category_name), parentId: firstString(category?.parent_id), permissionStatuses: permissions }];
    }).filter((category: any) => category.id && category.name);
    return { categories, categoryVersion, currency: currencyForRegion(shop.region), shop: { cipher: shop.cipher, name: shop.name, region: shop.region }, connectionId: String(connection._id) };
  },

  async listingWarehouses(companyCodeInput: unknown, connectionId: unknown, shopCipher: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const { accessToken, shop } = await authorizedShop(companyCode, connectionId, shopCipher);
    return { warehouses: await getListingWarehouses(accessToken, shop.cipher) };
  },

  async listingAttributes(companyCodeInput: unknown, connectionId: unknown, shopCipher: unknown, categoryIdInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const categoryId = String(categoryIdInput || "").trim();
    if (!categoryId) throw Object.assign(new Error("Cần chọn danh mục TikTok."), { statusCode: 400 });
    const { accessToken, shop } = await authorizedShop(companyCode, connectionId, shopCipher);
    const data: any = await getListingCategoryAttributes(accessToken, shop.cipher, categoryId, categoryVersionForRegion(shop.region));
    return { attributes: normalizeTikTokAttributes(data).filter((attribute) => !attribute.isSales) };
  },

  async publishCatalogProduct(companyCodeInput: unknown, input: any) {
    const companyCode = normalizeCompany(companyCodeInput);
    const { connection, shop, accessToken } = await authorizedShop(companyCode, input?.connectionId, input?.shopCipher);
    const productId = String(input?.productId || "").trim();
    const categoryId = String(input?.categoryId || "").trim();
    const warehouseId = String(input?.warehouseId || "").trim();
    if (!productId || !categoryId || !warehouseId) throw Object.assign(new Error("Sản phẩm, danh mục và kho TikTok là bắt buộc."), { statusCode: 400 });

    await this.syncProducts(companyCode).catch(() => undefined);
    const product: any = await ProductCatalogModel.findOne({ _id: productId, companyCode, status: "active", productType: "physical" }).lean();
    if (!product) throw Object.assign(new Error("Không tìm thấy sản phẩm đang kinh doanh trong kho nội bộ."), { statusCode: 404 });
    const variants: any[] = await ProductVariantModel.find({ companyCode, productId, status: "active", trackingMode: { $in: ["quantity", "serial", "unit_barcode", "lot"] } }).sort({ sku: 1 }).lean();
    const region = String(shop.region || "").toUpperCase();
    const maxSkus = ["BR", "EU", "JP", "MX", "UK", "GB", "US", "DE", "FR", "IT", "ES", "IE", "NL", "BE", "PT", "AT", "FI", "GR", "EE", "LV", "LT", "LU", "MT", "CY", "SI", "SK", "HR"].includes(region) ? 300 : 100;
    if (!variants.length || variants.length > maxSkus) throw Object.assign(new Error(`Sản phẩm cần có từ 1 đến ${maxSkus} SKU đang hoạt động để đăng TikTok.`), { statusCode: 400 });
    const productImages = [...new Set([...(product.mediaIds || []), ...variants.flatMap((variant) => variant.mediaIds || [])].map((value: unknown) => String(value || "").trim()).filter(Boolean))].slice(0, 9);
    const existingTikTokProduct: any = await TikTokShopProductModel.findOne({
      companyCode, connectionId: String(connection._id), shopCipher: shop.cipher,
      $or: [
        { "skus.localVariantId": { $in: variants.map((variant) => String(variant._id)) } },
        { "skus.sellerSku": { $in: variants.map((variant) => String(variant.sku || "").trim().toUpperCase()) } },
      ],
    }).select("tiktokProductId title").lean();
    if (existingTikTokProduct) throw Object.assign(new Error(`SKU của sản phẩm này đã có trên TikTok Shop (${existingTikTokProduct.title || existingTikTokProduct.tiktokProductId}). Hãy đồng bộ TikTok để liên kết, tránh tạo trùng.`), { statusCode: 409 });
    if (!productImages.length) throw Object.assign(new Error("Thêm ít nhất một ảnh sản phẩm trước khi đăng TikTok."), { statusCode: 400 });
    const title = String(input?.title ?? product.name ?? "").trim();
    const titleMinLength = ["DE", "ES", "FR", "IE", "IT", "JP", "UK", "GB", "US", "MX"].includes(region) ? 1 : 25;
    const titleMaxLength = region === "MX" ? 300 : 255;
    if (title.length < titleMinLength || title.length > titleMaxLength) throw Object.assign(new Error(`Tên sản phẩm TikTok cần từ ${titleMinLength} đến ${titleMaxLength} ký tự.`), { statusCode: 400 });
    const description = String(input?.description ?? product.description ?? product.shortDescription ?? "").trim().slice(0, 10_000);
    if (!description) throw Object.assign(new Error("Sản phẩm cần có mô tả trước khi đăng TikTok."), { statusCode: 400 });
    const categoryVersion = categoryVersionForRegion(shop.region);
    const categoryListData = await getListingCategories(accessToken, shop.cipher, categoryVersion);
    const remoteCategories = Array.isArray((categoryListData as any)?.categories) ? (categoryListData as any).categories : [];
    const eligibleCategory = remoteCategories.find((category: any) => {
      const permissions = Array.isArray(category?.permission_statuses) ? category.permission_statuses.map((value: unknown) => String(value).toUpperCase()) : [];
      return firstString(category?.id, category?.category_id) === categoryId && Boolean(category?.is_leaf ?? category?.isLeaf) && (!permissions.length || permissions.includes("AVAILABLE"));
    });
    if (!eligibleCategory) throw Object.assign(new Error("Danh mục TikTok không còn khả dụng hoặc không phải danh mục lá."), { statusCode: 400 });
    const remoteWarehouses = await getListingWarehouses(accessToken, shop.cipher);
    if (!remoteWarehouses.some((warehouse: any) => warehouse.id === warehouseId)) {
      throw Object.assign(new Error("Kho TikTok đã chọn không còn khả dụng."), { statusCode: 400 });
    }
    const categoryData = await getListingCategoryAttributes(accessToken, shop.cipher, categoryId, categoryVersion);
    const categoryAttributes = normalizeTikTokAttributes(categoryData);
    const requiredAttributes = categoryAttributes.filter((attribute) => !attribute.isSales && attribute.required);
    const selectedAttributes = Array.isArray(input?.productAttributes) ? input.productAttributes : [];
    const categoryAttributesById = new Map<string, (typeof categoryAttributes)[number]>();
    for (const attribute of categoryAttributes) if (!attribute.isSales) categoryAttributesById.set(attribute.id, attribute);
    const missingAttributes = requiredAttributes.filter((attribute) => {
      const selected = selectedAttributes.find((row: any) => String(row?.id || "") === attribute.id);
      const valueId = String(selected?.valueId || "").trim();
      const valueName = String(selected?.valueName || "").trim();
      const allowedValueIds = attribute.values.map((value) => value.id).filter(Boolean);
      return !selected || (!valueId && !valueName) || valueName.length > 50 || (allowedValueIds.length > 0 && (!valueId || !allowedValueIds.includes(valueId)));
    });
    if (missingAttributes.length) throw Object.assign(new Error(`TikTok yêu cầu các thuộc tính: ${missingAttributes.map((attribute) => attribute.name).join(", ")}.`), { statusCode: 400 });
    if (selectedAttributes.some((attribute: any) => !categoryAttributesById.has(String(attribute?.id || "")))) throw Object.assign(new Error("Thuộc tính sản phẩm không khớp danh mục TikTok đã chọn."), { statusCode: 400 });

    const variantIds = variants.map((variant) => String(variant._id));
    const [values, prices] = await Promise.all([
      localValues(companyCode, variantIds),
      ProductPriceModel.find({ companyCode, variantId: { $in: variantIds }, status: "active" }).select("variantId sellingPrice").lean(),
    ]);
    const pricesByVariant = new Map<string, Set<number>>();
    for (const row of prices as any[]) {
      const set = pricesByVariant.get(String(row.variantId)) || new Set<number>();
      set.add(Number(row.sellingPrice));
      pricesByVariant.set(String(row.variantId), set);
    }
    const requestedPrices = new Map<string, number>();
    for (const row of Array.isArray(input?.prices) ? input.prices : []) requestedPrices.set(String(row.variantId), Number(row.amount));
    const currency = currencyForRegion(shop.region);
    const skuRows: any[] = [];
    for (const variant of variants) {
      const sku = String(variant.sku || "").trim().toUpperCase();
      const priceSet = pricesByVariant.get(String(variant._id));
      const price = requestedPrices.get(String(variant._id)) ?? (priceSet?.size === 1 ? [...priceSet][0] : 0);
      if (!sku || !Number.isFinite(price) || price <= 0) throw Object.assign(new Error(`Cần nhập giá bán hợp lệ cho SKU ${sku || variant._id}.`), { statusCode: 400 });
      const options = Array.isArray(variant.optionValues) ? variant.optionValues.filter((row: any) => row?.code && row?.value) : [];
      if (options.length > 3 || new Set(options.map((option: any) => String(option.code).trim().toUpperCase())).size !== options.length) {
        throw Object.assign(new Error(`SKU ${sku} có thuộc tính phân loại không hợp lệ. TikTok hỗ trợ tối đa 3 thuộc tính duy nhất.`), { statusCode: 400 });
      }
      skuRows.push({ variant, sku, price, options, quantity: Math.max(0, Math.trunc(values.stockByVariant.get(String(variant._id)) || 0)) });
    }
    const salesCodes = [...new Set(skuRows.flatMap((row) => row.options.map((option: any) => String(option.code).trim().toUpperCase())))];
    if (skuRows.length > 1 && !salesCodes.length) {
      for (const row of skuRows) row.options = [{ code: "VARIANT", value: row.variant.displayName || row.sku }];
      salesCodes.push("VARIANT");
    }
    if (salesCodes.length > 3) throw Object.assign(new Error("TikTok hỗ trợ tối đa 3 thuộc tính phân loại cho mỗi sản phẩm."), { statusCode: 400 });
    if (skuRows.length > 1 && skuRows.some((row) => salesCodes.some((code) => !row.options.some((option: any) => String(option.code).trim().toUpperCase() === code && String(option.value).trim())))) {
      throw Object.assign(new Error("Các SKU cần có cùng nhóm thuộc tính phân loại và mỗi thuộc tính phải có giá trị."), { statusCode: 400 });
    }
    const salesNames = new Map<string, string>();
    for (const row of Array.isArray(input?.salesAttributes) ? input.salesAttributes : []) salesNames.set(String(row.code || "").trim().toUpperCase(), String(row.name || "").trim());
    if (salesCodes.some((code) => {
      const name = salesNames.get(code) || code;
      return name.length > 50 || skuRows.some((row) => row.options.some((option: any) => String(option.code).trim().toUpperCase() === code && String(option.value).trim().length > 50));
    })) throw Object.assign(new Error("Tên thuộc tính và giá trị phân loại không được vượt quá 50 ký tự."), { statusCode: 400 });
    if (skuRows.length > 1) {
      const salesSignatures = skuRows.map((row) => salesCodes.map((code) => row.options.find((option: any) => String(option.code).trim().toUpperCase() === code)?.value).join("\u001f"));
      if (new Set(salesSignatures).size !== salesSignatures.length) throw Object.assign(new Error("Mỗi SKU cần có một tổ hợp thuộc tính phân loại riêng."), { statusCode: 400 });
    }
    const salesByCode = new Map<string, string>();
    for (const code of salesCodes) salesByCode.set(code, salesNames.get(code) || code.slice(0, 20));
    const imageUris: string[] = [];
    for (let index = 0; index < productImages.length; index += 1) {
      imageUris.push(await uploadCatalogImageToTikTok(productImages[index], accessToken, `${String(product.productCode || "product")}-${index + 1}.jpg`));
    }
    const packageWeightGrams = Number(input?.packageWeightGrams || Math.max(...variants.map((variant) => Number(variant.weightGrams || 0))));
    if (!Number.isFinite(packageWeightGrams) || packageWeightGrams <= 0) throw Object.assign(new Error("Nhập trọng lượng gói hàng lớn hơn 0 gram."), { statusCode: 400 });
    const dimensions = input?.packageDimensions || {};
    const packageDimensions = { length: Number(dimensions.lengthCm || 0), width: Number(dimensions.widthCm || 0), height: Number(dimensions.heightCm || 0) };
    const hasPackageDimensions = Object.values(packageDimensions).some((value) => value > 0);
    if (hasPackageDimensions && Object.values(packageDimensions).some((value) => !Number.isFinite(value) || value <= 0)) throw Object.assign(new Error("Nếu nhập kích thước gói hàng, hãy điền đủ dài, rộng và cao lớn hơn 0."), { statusCode: 400 });
    const salesAttributesForSku = (row: any) => row.options.map((option: any) => ({ name: salesByCode.get(String(option.code).trim().toUpperCase()), value_name: String(option.value).trim() }));
    const requestBody: any = {
      title,
      description,
      category_id: categoryId,
      main_images: imageUris.map((uri) => ({ uri })),
      package_weight: { value: String(packageWeightGrams / 1000), unit: "KILOGRAM" },
      category_version: categoryVersionForRegion(shop.region),
      product_attributes: selectedAttributes.map((attribute: any) => ({ id: String(attribute.id), values: [{ ...(attribute.valueId ? { id: String(attribute.valueId) } : {}), ...(attribute.valueName ? { name: String(attribute.valueName) } : {}) }] })),
      skus: skuRows.map((row) => ({
        seller_sku: row.sku,
        external_sku_id: String(row.variant._id),
        price: { amount: String(row.price), currency },
        inventory: [{ warehouse_id: warehouseId, quantity: row.quantity }],
        ...(row.options.length ? { sales_attributes: salesAttributesForSku(row) } : {}),
        ...(isValidGtin(row.variant.barcode) ? { identifier_code: { code: String(row.variant.barcode), type: "GTIN" } } : {}),
      })),
    };
    if (hasPackageDimensions) requestBody.package_dimensions = { ...Object.fromEntries(Object.entries(packageDimensions).map(([key, value]) => [key, String(value)])), unit: "CENTIMETER" };
    if (String(input?.brandId || "").trim()) requestBody.brand_id = String(input.brandId).trim();
    const createData: any = await callTikTokShopApi({ path: "/product/202309/products", method: "POST", accessToken, query: { shop_cipher: shop.cipher }, body: requestBody });
    const remoteProductId = firstString(createData?.product_id, createData?.productId, createData?.id, createData?.product?.id);
    if (!remoteProductId) {
      await this.syncProducts(companyCode).catch(() => undefined);
      const synced: any = await TikTokShopProductModel.findOne({ companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, "skus.sellerSku": { $in: skuRows.map((row) => row.sku) } }).lean();
      const syncedBySeller = new Map<string, any>();
      for (const sku of synced?.skus || []) syncedBySeller.set(String(sku.sellerSku || "").toUpperCase(), sku);
      const linked = skuRows.every((row) => {
        const sku = syncedBySeller.get(row.sku);
        return Boolean(sku?.skuId && String(sku.localVariantId) === String(row.variant._id));
      });
      return {
        created: true,
        linked,
        productId: synced?.tiktokProductId || "",
        status: firstString(synced?.status, createData?.status, createData?.product_status, createData?.product?.status, createData?.product?.product_status, "PENDING"),
        skus: skuRows.length,
        message: linked ? "Đã đăng sản phẩm và liên kết SKU." : "TikTok đã nhận sản phẩm. Hãy đồng bộ danh sách TikTok để hoàn tất liên kết SKU.",
      };
    }
    const returnedSkus = Array.isArray(createData?.skus) ? createData.skus : Array.isArray(createData?.product?.skus) ? createData.product.skus : [];
    const returnedSkuBySeller = new Map<string, string>();
    for (const row of returnedSkus) returnedSkuBySeller.set(firstString(row?.seller_sku, row?.sellerSku), firstString(row?.id, row?.sku_id, row?.skuId));
    const returnedAllSkuIds = skuRows.every((row) => Boolean(returnedSkuBySeller.get(row.sku)));
    await TikTokShopProductModel.findOneAndUpdate(
      { companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: remoteProductId },
      { $set: {
        companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, shopName: shop.name, tiktokProductId: remoteProductId,
        title: requestBody.title, status: firstString(createData?.status, createData?.product_status, createData?.product?.status, createData?.product?.product_status, "PENDING"),
        imageUrl: productImages[0], imageUrls: productImages, description, categoryId, categoryName: String(input?.categoryName || ""),
        brandId: String(input?.brandId || ""), manufacturer: product.manufacturer || "", countryOfOrigin: product.countryOfOrigin || "",
        productAttributes: selectedAttributes.map((attribute: any) => ({ code: String(attribute.id), name: String(attribute.name || attribute.id), value: String(attribute.valueName || "") })),
        packageWeightGrams,
        ...(hasPackageDimensions ? { packageLengthMm: packageDimensions.length * 10, packageWidthMm: packageDimensions.width * 10, packageHeightMm: packageDimensions.height * 10 } : {}),
        skus: skuRows.map((row) => ({
          skuId: returnedSkuBySeller.get(row.sku) || "", sellerSku: row.sku, barcode: row.variant.barcode || "", displayName: row.variant.displayName || row.sku,
          optionValues: row.variant.optionValues || [], priceAmount: String(row.price), currency, inventoryQuantity: row.quantity, hasInventorySnapshot: true,
          inventory: [{ warehouseId, quantity: row.quantity }], localProductId: String(product._id), localVariantId: String(row.variant._id),
        })),
        detailsSyncStatus: "complete", detailsSyncedAt: new Date(), missingInfo: [], detailsSyncError: "", lastSeenAt: new Date(),
        lastOutboundSyncAt: returnedAllSkuIds ? new Date() : null, lastOutboundSyncStatus: returnedAllSkuIds ? "success" : "never", lastOutboundSyncError: "",
      } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    let linked = returnedAllSkuIds;
    if (!linked) {
      await this.syncProducts(companyCode).catch(() => undefined);
      const synced: any = await TikTokShopProductModel.findOne({ companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: remoteProductId }).lean();
      const syncedBySeller = new Map<string, any>();
      for (const sku of synced?.skus || []) syncedBySeller.set(String(sku.sellerSku || "").toUpperCase(), sku);
      linked = skuRows.every((row) => {
        const sku: any = syncedBySeller.get(row.sku);
        return Boolean(sku?.skuId && String(sku.localVariantId) === String(row.variant._id));
      });
    }
    return { created: true, linked, productId: remoteProductId, status: firstString(createData?.status, createData?.product_status, createData?.product?.status, createData?.product?.product_status, "PENDING"), skus: skuRows.length };
  },

  async createAuthorizationUrl(companyCodeInput: unknown, userId: string) {
    const companyCode = normalizeCompany(companyCodeInput);
    const rawState = randomBytes(32).toString("base64url");
    await TikTokShopOAuthStateModel.create({ stateHash: hashOpaque(rawState), companyCode, userId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    const config = getTikTokShopConfig();
    const url = new URL(config.authorizationUrl);
    url.searchParams.set("service_id", config.serviceId);
    url.searchParams.set("state", rawState);
    return url.toString();
  },

  async completeAuthorization(state: string, authCode: string) {
    const stateDoc = await TikTokShopOAuthStateModel.findOneAndUpdate(
      { stateHash: hashOpaque(state), expiresAt: { $gt: new Date() }, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!stateDoc) throw Object.assign(new Error("Yêu cầu kết nối TikTok Shop không hợp lệ hoặc đã hết hạn."), { statusCode: 400 });
    const data: any = await exchangeTikTokShopCode(authCode);
    if (!data.access_token || !data.refresh_token) throw new Error("TikTok Shop không trả về đầy đủ access token và refresh token.");
    const openId = String(data.open_id || "").trim();
    if (!openId) throw new Error("TikTok Shop không trả về định danh seller (open_id).");
    const shopsData = await callTikTokShopApi({ path: "/authorization/202309/shops", accessToken: String(data.access_token) });
    const shops = normalizedShops(shopsData);
    if (!shops.length) throw new Error("Tài khoản TikTok Shop chưa cấp quyền cho shop nào.");
    const previous = await TikTokShopConnectionModel.findOne({ companyCode: stateDoc.companyCode, openId }).select("shops").lean();
    const savedBranchByCipher = new Map<string, string>((previous?.shops || []).map((shop: any): [string, string] => [String(shop.cipher), String(shop.retailBranchId || "")]));
    for (const shop of shops) shop.retailBranchId = savedBranchByCipher.get(shop.cipher) || "";
    const connection = await TikTokShopConnectionModel.findOneAndUpdate(
      { companyCode: stateDoc.companyCode, openId },
      { $set: {
        openId,
        accessTokenEncrypted: encryptSecret(String(data.access_token)),
        refreshTokenEncrypted: encryptSecret(String(data.refresh_token)),
        accessTokenExpiresAt: tokenExpiresAt(data),
        refreshTokenExpiresAt: refreshExpiresAt(data),
        scopes: Array.isArray(data.granted_scopes) ? data.granted_scopes.map(String) : [],
        shops,
        connectedBy: stateDoc.userId,
        connectedAt: new Date(),
      } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    return publicConnection(connection?.toObject());
  },

  async disconnect(companyCodeInput: unknown, connectionId: string) {
    const companyCode = normalizeCompany(companyCodeInput);
    const connection = await TikTokShopConnectionModel.findOne({ _id: connectionId, companyCode }).lean();
    if (!connection) throw Object.assign(new Error("Không tìm thấy kết nối seller TikTok Shop."), { statusCode: 404 });
    const shopCiphers = (connection.shops || []).map((shop: any) => shop.cipher).filter(Boolean);
    await Promise.all([
      TikTokShopConnectionModel.deleteOne({ _id: connectionId, companyCode }),
      TikTokShopProductModel.deleteMany({ companyCode, connectionId, ...(shopCiphers.length ? { shopCipher: { $in: shopCiphers } } : {}) }),
    ]);
  },

  async listProducts(companyCodeInput: unknown, query: Record<string, unknown>) {
    const companyCode = normalizeCompany(companyCodeInput);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    const filter: any = { companyCode };
    if (String(query.q || "").trim()) {
      const q = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ title: new RegExp(q, "i") }, { "skus.sellerSku": new RegExp(q, "i") }];
    }
    const [items, total] = await Promise.all([
      TikTokShopProductModel.find(filter).sort({ tiktokUpdateTime: -1, updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      TikTokShopProductModel.countDocuments(filter),
    ]);
    return { items, total, page, pageSize };
  },

  async importProductsToInventory(companyCodeInput: unknown, branchIdInput: unknown, actorInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const branchId = String(branchIdInput || "").trim();
    const actor = String(actorInput || "").trim();
    if (!branchId) throw Object.assign(new Error("Cần chọn chi nhánh nhận sản phẩm và tồn kho từ TikTok Shop."), { statusCode: 400 });
    if (!actor) throw Object.assign(new Error("Không xác định được người thực hiện nhập dữ liệu."), { statusCode: 401 });

    await this.syncProducts(companyCode);
    const products: any[] = await TikTokShopProductModel.find({ companyCode }).sort({ createdAt: 1 });
    const connections = await connectionsWithSecrets(companyCode);
    const connectionById = new Map(connections.map((connection: any) => [String(connection._id), connection]));
    const tokenByConnection = new Map<string, string>();
    const stats = { products: products.length, createdProducts: 0, createdVariants: 0, linkedExisting: 0, importedPrices: 0, importedStock: 0, failed: 0, errors: [] as string[] };

    for (const channelProduct of products) {
      try {
        const connection: any = connectionById.get(String(channelProduct.connectionId));
        if (!connection) throw new Error("Kết nối seller không còn tồn tại.");
        let accessToken = tokenByConnection.get(String(connection._id));
        if (!accessToken) {
          accessToken = await validAccessToken(connection);
          tokenByConnection.set(String(connection._id), accessToken);
        }
        const detailData: any = await callTikTokShopApi({
          path: `/product/202309/products/${encodeURIComponent(channelProduct.tiktokProductId)}`,
          accessToken,
          query: { shop_cipher: channelProduct.shopCipher },
        });
        const detail = detailData?.product || detailData || {};
        const detailSkus = Array.isArray(detail.skus) ? detail.skus : [];
        const detailById = new Map(detailSkus.map((sku: any) => [firstString(sku.id, sku.sku_id), sku]));
        const sourceSkus = channelProduct.skus.map((cachedSku: any) => {
          const fullSku: any = detailById.get(String(cachedSku.skuId)) || {};
          const price = fullSku.price || {};
          const inventory = inventoryFromSku(fullSku).length ? inventoryFromSku(fullSku) : (cachedSku.inventory || []);
          return {
            ...fullSku,
            skuId: cachedSku.skuId,
            sellerSku: firstString(fullSku.seller_sku, cachedSku.sellerSku),
            code: importedSkuCode({ ...fullSku, ...cachedSku }),
            priceAmount: firstString(price.amount, price.tax_exclusive_price, price.sale_price, cachedSku.priceAmount),
            currency: firstString(price.currency, cachedSku.currency) || "VND",
            inventory,
            inventoryQuantity: inventory.length ? inventory.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0) : Number(cachedSku.inventoryQuantity || 0),
          };
        }).filter((sku: any) => sku.skuId && sku.code);
        if (!sourceSkus.length) throw new Error("Sản phẩm không có SKU hợp lệ để nhập.");

        const imported = { createdProducts: 0, createdVariants: 0, linkedExisting: 0, importedPrices: 0, importedStock: 0 };
        await runInTransaction(async (session) => {
          Object.assign(imported, { createdProducts: 0, createdVariants: 0, linkedExisting: 0, importedPrices: 0, importedStock: 0 });
          await ensureTikTokImportMasters(companyCode, actor, session);
          const warehouse: any = await ensureDefaultWarehouse(companyCode, branchId, session);
          if (!warehouse) throw new Error("Không thể xác định kho mặc định của chi nhánh.");

          const existingVariants: any[] = await ProductVariantModel.find({ companyCode, sku: { $in: sourceSkus.map((sku: any) => sku.code) } }).session(session || null).lean();
          const productIds = [...new Set(existingVariants.map((variant: any) => String(variant.productId)))];
          if (productIds.length > 1) throw new Error("Các SKU TikTok đang thuộc nhiều sản phẩm nội bộ khác nhau; cần xử lý liên kết thủ công.");

          const productCode = `TT-${channelProduct.tiktokProductId}`.toUpperCase().slice(0, 100);
          const category = tikTokCategory(detail);
          const brand = tikTokBrand(detail);
          await ProductCatalogCategoryModel.findOneAndUpdate(
            { companyCode, code: category.code },
            { $set: { name: category.name, normalizedName: category.name.toLocaleLowerCase("vi-VN"), defaultTrackingMode: "quantity", status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: category.code, description: "Danh mục được đồng bộ từ TikTok Shop", createdBy: actor } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session },
          );
          if (brand) {
            await ProductCatalogBrandModel.findOneAndUpdate(
              { companyCode, code: brand.code },
              { $set: { name: brand.name, normalizedName: brand.name.toLocaleLowerCase("vi-VN"), status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: brand.code, description: "Thương hiệu được đồng bộ từ TikTok Shop", createdBy: actor } },
              { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session },
            );
          }
          let localProduct: any = productIds.length
            ? await ProductCatalogModel.findOne({ _id: productIds[0], companyCode }).session(session || null)
            : await ProductCatalogModel.findOne({ companyCode, productCode }).session(session || null);
          const description = firstString(detail.description).slice(0, 20_000);
          const title = (firstString(detail.title, channelProduct.title) || `TikTok product ${channelProduct.tiktokProductId}`).slice(0, 300);
          const mainMediaUrls = [...new Set([
            ...imageUrls([...(Array.isArray(detail.main_images) ? detail.main_images : []), ...(Array.isArray(detail.images) ? detail.images : [])]),
            ...(Array.isArray(channelProduct.imageUrls) ? channelProduct.imageUrls : []),
            channelProduct.imageUrl,
          ].filter((url: string) => /^https?:\/\//i.test(url)))];
          const productAttributes = tikTokProductAttributes(detail);
          const manufacturer = firstString(detail?.manufacturer?.name, detail?.manufacturer_name, productAttributeValue(productAttributes, ["manufacturer", "nhà sản xuất"]));
          const countryOfOrigin = firstString(detail?.country_of_origin, productAttributeValue(productAttributes, ["country of origin", "country of manufacture", "xuất xứ", "nước sản xuất"]));
          if (!localProduct) {
            const [created] = await ProductCatalogModel.create([{
              companyCode, productCode, name: title, normalizedName: title.toLocaleLowerCase("vi-VN"), productType: "physical",
              categoryCode: category.code, brandCode: brand?.code, baseUnitCode: DEFAULT_UNIT_CODE,
              shortDescription: description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
              description, manufacturer: manufacturer || undefined, countryOfOrigin: countryOfOrigin || undefined,
              attributes: productAttributes.map(({ code, value }) => ({ code, value })),
              searchKeywords: ["TikTok Shop", String(channelProduct.tiktokProductId), firstString(detail.category_id)].filter(Boolean),
              status: "active", mediaIds: mainMediaUrls, documentIds: [], createdBy: actor, updatedBy: actor,
            }], { session });
            localProduct = created;
            imported.createdProducts += 1;
          } else if (localProduct.productCode === productCode) {
            localProduct.name = title;
            localProduct.normalizedName = title.toLocaleLowerCase("vi-VN");
            localProduct.categoryCode = category.code;
            localProduct.brandCode = brand?.code;
            localProduct.shortDescription = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
            localProduct.description = description;
            if (manufacturer) localProduct.manufacturer = manufacturer;
            if (countryOfOrigin) localProduct.countryOfOrigin = countryOfOrigin;
            if (productAttributes.length) localProduct.attributes = productAttributes.map(({ code, value }) => ({ code, value }));
            if (mainMediaUrls.length) localProduct.mediaIds = mainMediaUrls;
            localProduct.updatedBy = actor;
            await localProduct.save({ session });
          }

          const variantBySku = new Map(existingVariants.map((variant: any) => [String(variant.sku).toUpperCase(), variant]));
          const packageDimensions = detail.package_dimensions || {};
          const packageWeight = detail.package_weight || {};
          for (const sourceSku of sourceSkus) {
            const skuDimensions = sourceSku.sku_dimensions || sourceSku.package_dimensions || packageDimensions;
            const skuWeight = sourceSku.sku_weight || sourceSku.package_weight || packageWeight;
            let variant: any = variantBySku.get(sourceSku.code);
            const isNew = !variant;
            if (!variant) {
              const optionValues = skuOptionValues(sourceSku);
              const variantMediaUrls = skuImageUrls(sourceSku);
              const [createdVariant] = await ProductVariantModel.create([{
                companyCode, productId: String(localProduct._id), sku: sourceSku.code,
                displayName: variantDisplayName(sourceSku, sourceSku.code), unitCode: DEFAULT_UNIT_CODE, trackingMode: "quantity",
                weightGrams: weightInGrams(skuWeight.value, skuWeight.unit),
                lengthMm: dimensionInMillimeters(skuDimensions.length, skuDimensions.unit),
                widthMm: dimensionInMillimeters(skuDimensions.width, skuDimensions.unit),
                heightMm: dimensionInMillimeters(skuDimensions.height, skuDimensions.unit),
                optionValues, attributes: [], mediaIds: variantMediaUrls, status: "active", createdBy: actor, updatedBy: actor,
              }], { session });
              variant = createdVariant;
              variantBySku.set(sourceSku.code, variant);
              imported.createdVariants += 1;
            } else {
              imported.linkedExisting += 1;
              if (localProduct.productCode === productCode) {
                const optionValues = skuOptionValues(sourceSku);
                const variantMediaUrls = skuImageUrls(sourceSku);
                variant.displayName = variantDisplayName(sourceSku, sourceSku.code);
                if (optionValues.length) variant.optionValues = optionValues;
                if (variantMediaUrls.length) variant.mediaIds = variantMediaUrls;
                variant.weightGrams = weightInGrams(skuWeight.value, skuWeight.unit);
                variant.lengthMm = dimensionInMillimeters(skuDimensions.length, skuDimensions.unit);
                variant.widthMm = dimensionInMillimeters(skuDimensions.width, skuDimensions.unit);
                variant.heightMm = dimensionInMillimeters(skuDimensions.height, skuDimensions.unit);
                variant.updatedBy = actor;
                await ProductVariantModel.updateOne({ _id: variant._id, companyCode }, { $set: {
                  displayName: variant.displayName, optionValues: variant.optionValues, mediaIds: variant.mediaIds,
                  weightGrams: variant.weightGrams, lengthMm: variant.lengthMm, widthMm: variant.widthMm, heightMm: variant.heightMm, updatedBy: actor,
                } }, { session, runValidators: true });
              }
            }

            if (isNew) {
              const price = Number(sourceSku.priceAmount);
              if (sourceSku.currency === "VND" && Number.isFinite(price) && price >= 0) {
                await ProductPriceModel.findOneAndUpdate(
                  { companyCode, branchId, variantId: String(variant._id) },
                  { $set: { productId: String(localProduct._id), sku: sourceSku.code, sellingPrice: Math.round(price), costPrice: 0, status: "active", updatedBy: actor }, $setOnInsert: { companyCode, branchId, variantId: String(variant._id), createdBy: actor } },
                  { upsert: true, returnDocument: "after", runValidators: true, session },
                );
                imported.importedPrices += 1;
              }
              await InventoryBalanceModel.findOneAndUpdate(
                { companyCode, warehouseId: String(warehouse._id), productId: String(localProduct._id), variantId: String(variant._id) },
                { $setOnInsert: { companyCode, branchId, warehouseId: String(warehouse._id), productId: String(localProduct._id), variantId: String(variant._id), sku: sourceSku.code, quantity: Math.max(0, Math.trunc(sourceSku.inventoryQuantity)), reservedQuantity: 0, minStock: 0, averageCost: 0, version: 0 } },
                { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session },
              );
              imported.importedStock += Math.max(0, Math.trunc(sourceSku.inventoryQuantity));
            }

            const cachedSku = channelProduct.skus.find((row: any) => String(row.skuId) === String(sourceSku.skuId));
            if (cachedSku) {
              cachedSku.localProductId = String(localProduct._id);
              cachedSku.localVariantId = String(variant._id);
            }
          }
          await channelProduct.save({ session });
        });
        stats.createdProducts += imported.createdProducts;
        stats.createdVariants += imported.createdVariants;
        stats.linkedExisting += imported.linkedExisting;
        stats.importedPrices += imported.importedPrices;
        stats.importedStock += imported.importedStock;
      } catch (error: any) {
        stats.failed += 1;
        stats.errors.push(`${channelProduct.title}: ${String(error?.message || "Nhập dữ liệu thất bại")}`.slice(0, 500));
      }
    }
    return stats;
  },

  async syncInventoryAndPrices(companyCodeInput: unknown, target?: { variantId?: string; sku?: string; branchId?: string }, throwOnFailure = false) {
    const companyCode = normalizeCompany(companyCodeInput);
    const missingWarehouseSnapshot = await TikTokShopProductModel.exists({
      companyCode,
      skus: { $elemMatch: { localVariantId: { $nin: ["", null] }, "inventory.0": { $exists: false } } },
    });
    // Records imported before outbound sync was introduced do not contain TikTok
    // warehouse IDs. Refresh once so automatic updates work without migration.
    if (missingWarehouseSnapshot) await this.syncProducts(companyCode);
    const result = await pushOperationalData(companyCode, target);
    if (throwOnFailure && result.failed) throw new Error(result.errors.join("; ") || "Không thể đồng bộ giá và tồn kho lên TikTok Shop.");
    return result;
  },

  async syncProducts(companyCodeInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const connections = await connectionsWithSecrets(companyCode);
    if (!connections.length) throw Object.assign(new Error("Doanh nghiệp chưa kết nối TikTok Shop."), { statusCode: 409 });
    const aggregate = { total: 0, matched: 0, unmatched: 0, connections: connections.length, detailsSynced: 0, complete: 0, incomplete: 0, detailFailed: 0 };
    for (const connection of connections) {
      try {
      const accessToken = await validAccessToken(connection);
      const seenAt = new Date();
      let total = 0;
      let matched = 0;
      for (const shop of connection.shops as any[]) {
        let pageToken = "";
        let fullyTraversed = false;
        for (let page = 0; page < 50; page += 1) {
          const data: any = await callTikTokShopApi({
            path: "/product/202309/products/search",
            method: "POST",
            accessToken,
            query: { shop_cipher: shop.cipher, page_size: 100, page_token: pageToken || undefined },
            body: { status: "ALL", locale: "vi-VN", include_live_quick_products: false },
          });
          const products = Array.isArray(data?.products) ? data.products : [];
          const pageProducts = products.map((summary: any) => ({ summary, productId: firstString(summary.id, summary.product_id) })).filter((row: any) => row.productId);
          const productIds = pageProducts.map((row: any) => row.productId);
          const cachedProducts: any[] = productIds.length ? await TikTokShopProductModel.find({
            companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: { $in: productIds },
          }).lean() : [];
          const cachedByProductId = new Map(cachedProducts.map((cached: any) => [String(cached.tiktokProductId), cached]));
          const detailedProducts = await mapWithConcurrency(pageProducts, 3, async (row: any) => {
            const cached = cachedByProductId.get(row.productId);
            try {
              const detailData: any = await callTikTokShopApi({
                path: `/product/202309/products/${encodeURIComponent(row.productId)}`,
                accessToken,
                query: { shop_cipher: shop.cipher },
              });
              return { ...row, cached, detail: detailData?.product || detailData || {}, detailError: "" };
            } catch (error: any) {
              return { ...row, cached, detail: null, detailError: String(error?.message || "Không tải được chi tiết sản phẩm TikTok.").slice(0, 500) };
            }
          });

          const skuCodes = detailedProducts.flatMap((row: any) => {
            const summarySkus = Array.isArray(row.summary.skus) ? row.summary.skus : [];
            const detailSkus = Array.isArray(row.detail?.skus) ? row.detail.skus : [];
            const skuIds = [...new Set([...summarySkus, ...detailSkus].map((sku: any) => firstString(sku.id, sku.sku_id)).filter(Boolean))];
            const summaryById = new Map(summarySkus.map((sku: any) => [firstString(sku.id, sku.sku_id), sku]));
            const detailById = new Map(detailSkus.map((sku: any) => [firstString(sku.id, sku.sku_id), sku]));
            const cachedById = new Map((row.cached?.skus || []).map((sku: any) => [String(sku.skuId), sku]));
            return skuIds.map((skuId) => {
              const summarySku: any = summaryById.get(skuId) || {};
              const detailSku: any = detailById.get(skuId) || {};
              const cachedSku: any = cachedById.get(skuId) || {};
              return importedSkuCode({
                sellerSku: firstString(detailSku.seller_sku, detailSku.sellerSku, summarySku.seller_sku, summarySku.sellerSku, cachedSku.sellerSku),
                skuId,
              }).toUpperCase();
            });
          });
          const localVariants = skuCodes.length ? await ProductVariantModel.find({ companyCode, sku: { $in: [...new Set(skuCodes)] } }).select("_id productId sku").lean() : [];
          const variantBySku = new Map(localVariants.map((variant: any) => [String(variant.sku).toUpperCase(), variant]));

          for (const row of detailedProducts) {
            const { summary: product, productId, cached, detail, detailError } = row;
            const summarySkus = Array.isArray(product.skus) ? product.skus : [];
            const detailSkus = Array.isArray(detail?.skus) ? detail.skus : [];
            const summaryById = new Map(summarySkus.map((sku: any) => [firstString(sku.id, sku.sku_id), sku]));
            const detailById = new Map(detailSkus.map((sku: any) => [firstString(sku.id, sku.sku_id), sku]));
            const cachedById = new Map((cached?.skus || []).map((sku: any) => [String(sku.skuId), sku]));
            const skuIds = [...new Set([...summarySkus, ...detailSkus].map((sku: any) => firstString(sku.id, sku.sku_id)).filter(Boolean))];
            let productMatched = false;
            const skus = skuIds.map((skuId) => {
              const summarySku: any = summaryById.get(skuId) || {};
              const detailSku: any = detailById.get(skuId) || {};
              const cachedSku: any = cachedById.get(skuId) || {};
              const sellerSku = firstString(detailSku.seller_sku, detailSku.sellerSku, summarySku.seller_sku, summarySku.sellerSku, cachedSku.sellerSku);
              const code = importedSkuCode({ sellerSku, skuId }).toUpperCase();
              const local: any = variantBySku.get(code);
              if (local) productMatched = true;
              const price = detailSku.price || detailSku.sales_price || summarySku.price || summarySku.sales_price || {};
              const detailInventory = inventoryFromSku(detailSku);
              const summaryInventory = inventoryFromSku(summarySku);
              const inventory = detailInventory.length ? detailInventory : summaryInventory.length ? summaryInventory : (cachedSku.inventory || []);
              const inventorySource = hasSkuInventorySnapshot(detailSku) ? detailSku
                : hasSkuInventorySnapshot(summarySku) ? summarySku : null;
              const optionValues = skuOptionValues(detailSku);
              const skuMedia = skuImageUrls(detailSku);
              const packageDimensions = detail?.package_dimensions || {};
              const skuDimensions = detailSku.sku_dimensions || detailSku.package_dimensions || packageDimensions;
              const skuWeight = detailSku.sku_weight || detailSku.package_weight || detail?.package_weight || {};
              return {
                skuId,
                sellerSku,
                barcode: firstString(detailSku.identifier_code, detailSku.barcode, detailSku.barcode_value, cachedSku.barcode),
                displayName: optionValues.length ? variantDisplayName(detailSku, code) : firstString(cachedSku.displayName, code),
                optionValues: optionValues.length ? optionValues : (cachedSku.optionValues || []),
                imageUrls: skuMedia.length ? skuMedia : (cachedSku.imageUrls || []),
                weightGrams: weightInGrams(skuWeight.value, skuWeight.unit) ?? cachedSku.weightGrams,
                lengthMm: dimensionInMillimeters(skuDimensions.length, skuDimensions.unit) ?? cachedSku.lengthMm,
                widthMm: dimensionInMillimeters(skuDimensions.width, skuDimensions.unit) ?? cachedSku.widthMm,
                heightMm: dimensionInMillimeters(skuDimensions.height, skuDimensions.unit) ?? cachedSku.heightMm,
                priceAmount: firstString(price.amount, price.tax_exclusive_price, price.sale_price, detailSku.price_amount, summarySku.price_amount, cachedSku.priceAmount),
                currency: firstString(price.currency, detailSku.currency, summarySku.currency, cachedSku.currency),
                inventoryQuantity: inventorySource ? quantityFromSku(inventorySource) : Number(cachedSku.inventoryQuantity || 0),
                hasInventorySnapshot: Boolean(inventorySource) || Boolean(cachedSku.hasInventorySnapshot) || Boolean(cachedSku.inventory?.length),
                inventory,
                localProductId: local ? String(local.productId) : "",
                localVariantId: local ? String(local._id) : "",
              };
            });
            if (productMatched) matched += 1;

            const detailImages = imageUrls([...(Array.isArray(detail?.main_images) ? detail.main_images : []), ...(Array.isArray(detail?.images) ? detail.images : [])]);
            const summaryImages = imageUrls([...(Array.isArray(product.main_images) ? product.main_images : []), ...(Array.isArray(product.images) ? product.images : [])]);
            const productImageUrls = detailImages.length ? detailImages : summaryImages.length ? summaryImages : (cached?.imageUrls || []);
            const description = firstString(detail?.description, cached?.description);
            const categoryId = firstString(detail?.category?.id, detail?.category_id, cached?.categoryId);
            const categoryName = firstString(detail?.category?.local_name, detail?.category?.name, detail?.category_name, detail?.local_name, cached?.categoryName);
            const brandId = firstString(detail?.brand?.id, detail?.brand_id, cached?.brandId);
            const brandName = firstString(detail?.brand?.name, detail?.brand?.brand_name, cached?.brandName);
            const productAttributes = tikTokProductAttributes(detail).length ? tikTokProductAttributes(detail) : (cached?.productAttributes || []);
            const manufacturer = firstString(detail?.manufacturer?.name, detail?.manufacturer_name, productAttributeValue(productAttributes, ["manufacturer", "nhà sản xuất"]), cached?.manufacturer);
            const countryOfOrigin = firstString(detail?.country_of_origin, productAttributeValue(productAttributes, ["country of origin", "country of manufacture", "xuất xứ", "nước sản xuất"]), cached?.countryOfOrigin);
            const packageDimensions = detail?.package_dimensions || {};
            const packageWeight = detail?.package_weight || {};
            const missingInfo = missingTikTokProductInfo({ description, categoryId, categoryName, imageUrls: productImageUrls, skus });
            const detailsSyncStatus = detailError ? "failed" : missingInfo.length ? "incomplete" : "complete";
            if (detailError) aggregate.detailFailed += 1;
            else aggregate.detailsSynced += 1;
            if (!detailError && missingInfo.length) aggregate.incomplete += 1;
            if (!detailError && !missingInfo.length) aggregate.complete += 1;

            await TikTokShopProductModel.updateOne(
              { companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: productId },
              { $set: {
                shopName: shop.name,
                title: firstString(detail?.title, product.title, product.product_name, cached?.title) || `TikTok product ${productId}`,
                status: firstString(product.status, detail?.status, cached?.status),
                imageUrl: firstString(parseImage(detail), parseImage(product), cached?.imageUrl, productImageUrls[0]),
                imageUrls: productImageUrls,
                description,
                categoryId,
                categoryName,
                brandId,
                brandName,
                manufacturer,
                countryOfOrigin,
                productAttributes,
                packageWeightGrams: weightInGrams(packageWeight.value, packageWeight.unit) ?? cached?.packageWeightGrams,
                packageLengthMm: dimensionInMillimeters(packageDimensions.length, packageDimensions.unit) ?? cached?.packageLengthMm,
                packageWidthMm: dimensionInMillimeters(packageDimensions.width, packageDimensions.unit) ?? cached?.packageWidthMm,
                packageHeightMm: dimensionInMillimeters(packageDimensions.height, packageDimensions.unit) ?? cached?.packageHeightMm,
                detailsSyncStatus,
                detailsSyncedAt: detailError ? (cached?.detailsSyncedAt || null) : seenAt,
                missingInfo,
                detailsSyncError: detailError,
                skus,
                tiktokCreateTime: product.create_time ? new Date(Number(product.create_time) * 1000) : (cached?.tiktokCreateTime || null),
                tiktokUpdateTime: product.update_time ? new Date(Number(product.update_time) * 1000) : (cached?.tiktokUpdateTime || null),
                lastSeenAt: seenAt,
              }, $setOnInsert: { companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: productId } },
              { upsert: true, runValidators: true },
            );
            total += 1;
          }
          pageToken = String(data?.next_page_token || "");
          if (!pageToken || products.length === 0) { fullyTraversed = true; break; }
        }
        if (fullyTraversed) await TikTokShopProductModel.deleteMany({ companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, lastSeenAt: { $lt: seenAt } });
      }
      const stats = { total, matched, unmatched: Math.max(0, total - matched) };
      connection.lastProductSyncAt = seenAt;
      connection.lastProductSyncStatus = "success";
      connection.lastProductSyncError = "";
      connection.lastProductSyncStats = stats;
      await connection.save();
      aggregate.total += stats.total;
      aggregate.matched += stats.matched;
      aggregate.unmatched += stats.unmatched;
    } catch (error: any) {
      connection.lastProductSyncAt = new Date();
      connection.lastProductSyncStatus = "failed";
      connection.lastProductSyncError = String(error?.message || "Đồng bộ thất bại").slice(0, 500);
      await connection.save();
      throw error;
    }
    }
    return aggregate;
  },
};
