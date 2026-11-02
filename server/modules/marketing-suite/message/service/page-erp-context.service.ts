import { getModuleStateForCompany, isServiceSubscriptionBlocked } from "../../../../middleware/require-module";
import { ProductCatalogModel } from "../../../../model/product-catalog.model";
import { ProductPriceModel } from "../../../../model/product-price.model";
import { InventoryBalanceModel } from "../../../../model/inventory-balance.model";
import { BranchModel } from "../../../../model/branch.model";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
const STOP_WORDS = new Set(["cho", "toi", "minh", "hoi", "gia", "bao", "nhieu", "con", "hang", "ton", "kho", "san", "pham", "loai", "mau", "nay", "do", "khong", "co", "ban", "mua", "can", "cua", "shop", "em", "anh", "chi", "duoc", "nao"]);

/** Read-only ERP evidence for a Facebook Page. Never exposes costs or records from another tenant. */
export async function getPageErpContext(companyCode: string, message: string): Promise<string> {
  const normalizedCompany = companyCode.trim().toUpperCase();
  const state = await getModuleStateForCompany(normalizedCompany);
  if (!state.exists || isServiceSubscriptionBlocked(state) || !state.modules?.includes("inventory")) return "";
  const normalized = normalize(message);
  const queryWords = message.match(/[\p{L}\p{N}]{2,}/gu)?.filter(word => !STOP_WORDS.has(normalize(word))) || [];
  const words = queryWords.map(normalize);
  const wantsProduct = /\b(gia|bao nhieu|ton kho|con hang|con.*khong|san pham|mua|ban|sku)\b/.test(normalized);
  if (!wantsProduct || !words.length) return "";
  const products = await ProductCatalogModel.find({ companyCode: normalizedCompany, status: "active",
    $or: queryWords.slice(0, 6).flatMap(word => [{ name: { $regex: word, $options: "i" } }, { productCode: { $regex: normalize(word), $options: "i" } }]),
  }).select("_id productCode name normalizedName shortDescription productType").limit(300).lean();
  const matches = products.map(product => ({ product, score: words.filter(word => normalize(product.name + " " + product.productCode).includes(word)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  if (!matches.length) return "";
  const ids = matches.map(item => String(item.product._id));
  const [balances, prices] = await Promise.all([
    InventoryBalanceModel.find({ companyCode: normalizedCompany, productId: { $in: ids } })
      .select("productId branchId quantity reservedQuantity").lean(),
    state.modules.includes("retail")
      ? ProductPriceModel.find({ companyCode: normalizedCompany, productId: { $in: ids }, status: "active" })
        .select("productId branchId sellingPrice").lean() : Promise.resolve([]),
  ]);
  const branchIds = [...new Set([...balances, ...prices].map(item => String(item.branchId)).filter(Boolean))];
  const branches = branchIds.length
    ? await BranchModel.find({ companyCode: normalizedCompany, _id: { $in: branchIds } }).select("_id code name").lean()
    : [];
  const lines = matches.map(({ product }) => {
    const id = String(product._id);
    const productBalances = balances.filter(item => item.productId === id);
    const productPrices = prices.filter(item => item.productId === id);
    const uniquePrices = [...new Set(productPrices.map(item => item.sellingPrice))].sort((a, b) => a - b);
    const byBranch = branches.map(branch => {
      const branchBalances = productBalances.filter(item => String(item.branchId) === String(branch._id));
      const branchPrices = [...new Set(productPrices.filter(item => String(item.branchId) === String(branch._id)).map(item => item.sellingPrice))].sort((a, b) => a - b);
      return { branch: branch.name, branchCode: branch.code,
        available: product.productType === "physical" && branchBalances.length
          ? branchBalances.reduce((total, item) => total + Math.max(0, item.quantity - item.reservedQuantity), 0) : undefined,
        sellingPricesVnd: branchPrices.length ? branchPrices : undefined };
    }).filter(branch => branch.available !== undefined || branch.sellingPricesVnd !== undefined);
    return JSON.stringify({ code: product.productCode, name: product.name, description: product.shortDescription || undefined,
      availableAcrossBranches: product.productType === "physical" && productBalances.length
        ? productBalances.reduce((total, item) => total + Math.max(0, item.quantity - item.reservedQuantity), 0) : undefined,
      sellingPriceVnd: uniquePrices.length === 1 ? uniquePrices[0] : undefined,
      sellingPriceRangeVnd: uniquePrices.length > 1 ? [uniquePrices[0], uniquePrices[uniquePrices.length - 1]] : undefined,
      priceStatus: state.modules.includes("retail") ? uniquePrices.length ? "available" : "unavailable" : "retail_module_disabled", byBranch });
  });
  return "Dữ liệu ERP hiện tại của doanh nghiệp (chỉ các sản phẩm đang hoạt động):\n" + lines.join("\n")
    + "\nDữ liệu byBranch là tồn khả dụng và giá theo từng chi nhánh; khi khách chưa nói chi nhánh, hỏi nơi nhận trước khi chốt. "
    + "Không khẳng định tồn ở chi nhánh khác bằng tổng toàn hệ thống. Nếu thiếu giá hoặc tồn xác nhận, không suy đoán. Không hứa giữ hàng hoặc tự tạo đơn.";
}
