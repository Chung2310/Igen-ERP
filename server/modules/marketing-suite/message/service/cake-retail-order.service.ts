import { BranchModel } from "../../../../model/branch.model";
import { ProductCatalogModel } from "../../../../model/product-catalog.model";
import { ProductPriceModel } from "../../../../model/product-price.model";
import { ProductVariantModel } from "../../../../model/product-variant.model";
import { RetailOrderCounterModel } from "../../../retail/models/retail-order-counter.model";
import { RetailOrderModel } from "../../../retail/models/retail-order.model";
import { formatRetailDocumentCode } from "../../../retail/services/retail-order.service";
import { businessDateInVietnam } from "../../../retail/services/cashier-shift.service";
import { getResolvedRetailSettings } from "../../../retail/services/retail-settings.service";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { CustomerService } from "../../../customer-management/customer.service";
import { normalizePhone, phoneLookupVariants } from "../../../customer-management/customer-normalization";
import { getModuleStateForCompany, isServiceSubscriptionBlocked } from "../../../../middleware/require-module";
import { FBConversationModel } from "../model/fb-messenger.model";
import { CakeCustomerMemoryModel } from "../model/cake-customer-memory.model";
import { normalizeCakeText } from "./chat-ordering/flows/bakery-default/cake-price-catalog";
import { matchCakeBranchLocation } from "./cake-branch-location";
import { checkCakeStockAtBranch } from "./cake-stock-availability";

function error(message: string) { return Object.assign(new Error(message), { code: "PAGE_SALES_ORDER" }); }

async function ensureRetailItem(companyCode: string, branchId: string, item: any) {
  const sku = String(item.productCode || "").trim().toUpperCase();
  const name = String(item.productName || "").trim();
  const summary = String(item.variantSummary || "").trim();
  const unit = /\bset\b/i.test(summary) ? "SET" : "CAKE";
  if (!sku || !name) throw error("Thiếu mã hoặc tên bánh để liên kết với module Bán hàng.");

  let variant = await ProductVariantModel.findOne({ companyCode, sku }).lean();
  let product = variant ? await ProductCatalogModel.findOne({ companyCode, _id: variant.productId }).lean() : null;
  if (variant && (!product || product.status !== "active" || variant.status !== "active")) {
    throw error(`Mã ${sku} đang liên kết với sản phẩm không hoạt động trong Bán hàng.`);
  }

  if (!variant) {
    const productValues = {
      companyCode, productCode: sku, name,
      normalizedName: normalizeCakeText(`${name} ${summary}`), productType: "service" as const,
      categoryCode: "PAGE-CAKE", baseUnitCode: unit,
      shortDescription: summary.slice(0, 500), description: "Sản phẩm tạo từ bảng giá Page đã được doanh nghiệp duyệt.",
      searchKeywords: [name, summary].filter(Boolean), status: "active" as const,
      createdBy: "page-chatbot", updatedBy: "page-chatbot",
    };
    try {
      product = await ProductCatalogModel.findOneAndUpdate({ companyCode, productCode: sku }, { $setOnInsert: productValues },
        { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    } catch (problem) {
      if ((problem as { code?: number }).code !== 11000) throw problem;
      product = await ProductCatalogModel.findOne({ companyCode, productCode: sku }).lean();
    }
    if (!product || product.status !== "active") throw error(`Không thể liên kết ${sku} với danh mục Bán hàng.`);
    try {
      variant = await ProductVariantModel.findOneAndUpdate({ companyCode, sku }, { $setOnInsert: {
        companyCode, productId: String(product._id), sku, displayName: summary || name, unitCode: unit,
        trackingMode: "none", status: "active", createdBy: "page-chatbot", updatedBy: "page-chatbot",
      } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    } catch (problem) {
      if ((problem as { code?: number }).code !== 11000) throw problem;
      variant = await ProductVariantModel.findOne({ companyCode, sku }).lean();
    }
    if (!variant || String(variant.productId) !== String(product._id) || variant.status !== "active") {
      throw error(`Mã ${sku} vừa được liên kết với một sản phẩm khác; cần kiểm tra trước khi lưu đơn.`);
    }
  }

  const desiredPrice = Number(item.unitPrice);
  if (!Number.isSafeInteger(desiredPrice) || desiredPrice < 0) throw error(`Giá của ${sku} không hợp lệ.`);
  let price = await ProductPriceModel.findOne({ companyCode, branchId, variantId: String(variant._id) }).lean();
  if (!price) {
    try {
      price = await ProductPriceModel.findOneAndUpdate({ companyCode, branchId, variantId: String(variant._id) }, { $setOnInsert: {
        companyCode, branchId, productId: String(product?._id || variant.productId), variantId: String(variant._id), sku,
        sellingPrice: desiredPrice, costPrice: 0, status: "active", createdBy: "page-chatbot", updatedBy: "page-chatbot",
      } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    } catch (problem) {
      if ((problem as { code?: number }).code !== 11000) throw problem;
      price = await ProductPriceModel.findOne({ companyCode, branchId, variantId: String(variant._id) }).lean();
    }
  }
  if (!price || price.status !== "active" || Number(price.sellingPrice) !== desiredPrice) {
    throw error(`Giá trên Page (${desiredPrice.toLocaleString("vi-VN")}đ) chưa khớp giá Bán hàng của ${sku}.`);
  }
  const quantity = Number(item.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw error(`Số lượng của ${sku} không hợp lệ.`);
  return { product, variant, price, quantity, desiredPrice, summary, name };
}

/** Stores a confirmed Page cake order as an unpaid draft in Retail. It never consumes stock or records a payment. */
export async function saveCakeOrderToRetail(order: any): Promise<string> {
  const companyCode = String(order.companyCode || "").trim().toUpperCase();
  const moduleState = await getModuleStateForCompany(companyCode);
  if (!moduleState.exists || isServiceSubscriptionBlocked(moduleState) || !moduleState.modules?.includes("retail")) {
    throw error("Module Bán hàng chưa được bật cho doanh nghiệp.");
  }
  if (!moduleState.modules.includes("customer")) throw error("Cần bật module Khách hàng để lưu thông tin người mua từ Page.");
  const existing = await RetailOrderModel.findOne({ companyCode, salesChannel: "facebook-page", externalShopId: order.pageId, externalOrderId: order.orderId }).select("_id").lean();
  if (existing) return String(existing._id);

  const branches = await BranchModel.find({ companyCode, isActive: true }).select("_id code name address").lean();
  const rawLocation = String(order.fulfillmentLocation || "");
  const branch = matchCakeBranchLocation(branches, rawLocation) || (branches.length === 1 ? branches[0] : undefined);
  if (!branch) throw error("Chưa xác định được chi nhánh nhận bánh. Cần chọn đúng chi nhánh trước khi lưu đơn vào Bán hàng.");

  const scope = { companyCode, branchId: String(branch._id) };
  const linkedItems = await Promise.all((order.items || []).map(async (item: any) => {
    const linked = await ensureRetailItem(companyCode, scope.branchId, item);
    const stockCheck = await checkCakeStockAtBranch({ companyCode, branchId: scope.branchId, sku: linked.variant.sku, quantity: linked.quantity });
    if (stockCheck.status === "insufficient") throw error(`Tồn kho hiện còn ${stockCheck.availableQuantity || 0} chiếc ${linked.name}, không đủ số lượng đặt.`);
    return { stockCheck, retailItem: { productId: String(linked.product._id), variantId: String(linked.variant._id), sku: linked.variant.sku,
      productName: linked.product.name, unit: linked.variant.unitCode, category: linked.product.categoryCode,
      trackingMode: linked.variant.trackingMode, quantity: linked.quantity, unitPrice: linked.desiredPrice, unitCost: 0,
      discountAmount: 0, lineTotal: linked.desiredPrice * linked.quantity, note: linked.summary } };
  }));
  const retailItems = linkedItems.map(item => item.retailItem);
  const stockCheckNote = linkedItems.some(item => item.stockCheck.status === "untracked")
    ? "Tồn kho thành phẩm chưa được theo dõi trong ERP; tiệm cần xác nhận khả năng làm trước khi chốt."
    : linkedItems.some(item => item.stockCheck.status === "unknown")
      ? "Chưa xác minh được tồn kho tại chi nhánh; tiệm cần xác nhận trước khi chốt."
      : "Tồn kho đã đối chiếu theo dữ liệu ERP tại thời điểm tạo đơn; số lượng chưa được giữ.";
  const settings = await getResolvedRetailSettings(scope);
  const businessDate = businessDateInVietnam(new Date());
  const scopeKey = businessDate.replace("-", "").slice(0, 6);
  const counter = await RetailOrderCounterModel.findOneAndUpdate({ ...scope, scope: scopeKey }, { $inc: { seq: 1 } }, { returnDocument: "after", upsert: true });
  const total = retailItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const conversation = await FBConversationModel.findOne({ _id: order.conversationId, pageId: order.pageId }).select("recipientId").lean();
  const buyer = conversation?.recipientId ? await CakeCustomerMemoryModel.findOne({ companyCode, pageId: order.pageId,
    recipientId: conversation.recipientId }).select("buyerName buyerPhone").lean() : null;
  const customerName = String(buyer?.buyerName || order.customerName || "").trim();
  const phone = normalizePhone(buyer?.buyerPhone || order.customerPhone);
  if (!/^0\d{9}$/.test(phone)) throw error("Cần số điện thoại hợp lệ để lưu hồ sơ khách hàng.");
  let customerId: string | undefined;
  const knownOrder = conversation?.recipientId && await RetailOrderModel.findOne({
    companyCode, salesChannel: "facebook-page", externalShopId: order.pageId,
    externalBuyerId: conversation.recipientId, isSimulation: { $ne: true }, customerId: { $type: "string" },
  }).sort({ createdAt: -1 }).select("customerId").lean();
  if (knownOrder && knownOrder.customerId && await CustomerModel.exists({ companyCode, _id: knownOrder.customerId })) {
    customerId = knownOrder.customerId;
  } else if (!await CustomerModel.exists({ companyCode, normalizedPhone: { $in: phoneLookupVariants(phone) } })) {
    try {
      const created = await CustomerService.create({ companyCode }, { name: customerName || `Khách Page ${phone.slice(-4)}`,
        phone, source: "page", notes: `Facebook Page ${order.pageId}; hội thoại ${order.conversationId}${order.isSimulation ? "; dữ liệu chạy thử" : ""}` },
      { id: "page-chatbot", name: "Chatbot Page" });
      customerId = String(created._id);
    } catch (problem) {
      if ((problem as { code?: string }).code !== "CUSTOMER_PHONE_EXISTS") throw problem;
    }
  }

  const depositNote = order.depositRequired
    ? `Chờ thu cọc ${Number(order.depositAmount || 0).toLocaleString("vi-VN")}đ (${Number(order.depositPercent || 30)}%). SePay chưa được dùng.`
    : "Đơn không yêu cầu cọc; chưa ghi nhận thanh toán.";
  const orderCode = formatRetailDocumentCode(settings.orderPrefix, branch.code, scopeKey, Number(counter?.seq || 1));
  const orderDetails = [
    `Người nhận: ${order.customerName || customerName}${order.customerPhone ? ` · ĐT: ${order.customerPhone}` : ""}`,
    order.fulfillmentLocation ? `${order.fulfillmentMethod === "delivery" ? "Giao đến" : "Nhận tại"}: ${order.fulfillmentLocation}` : "",
    order.requestedFulfillmentTime ? `Thời gian nhận: ${order.requestedFulfillmentTime}` : "",
  ].filter(Boolean).join(". ");
  try {
    const saved = await RetailOrderModel.create({ ...scope, orderCode, items: retailItems, subtotal: total, orderDiscount: 0, taxRate: 0, taxAmount: 0,
      shippingFee: Number(order.shippingFee || 0), grandTotal: total + Number(order.shippingFee || 0), totalCost: 0,
      payments: [], refunds: [], paidAmount: 0, refundedAmount: 0, dueAmount: total + Number(order.shippingFee || 0),
      paymentStatus: "unpaid", status: "draft", businessDate, salespersonId: "page-chatbot", salespersonName: "Chatbot Page",
      createdBy: "page-chatbot", createdByName: "Chatbot Page", stockApplied: false, version: 0,
      customerName: customerName || order.customerName, customerPhone: phone,
      ...(customerId ? { customerId, customerSnapshot: { customerId, name: customerName || order.customerName, phone } } : {}),
      isSimulation: order.isSimulation === true,
      note: `${order.isSimulation ? "Đơn thử chat Page, chưa gửi khách/thu tiền. " : ""}${stockCheckNote} Đơn từ Facebook Page ${order.pageId} / ${order.orderId}. ${orderDetails} ${depositNote} ${order.customerNote || ""}`.slice(0, 2000),
      salesChannel: "facebook-page", externalShopId: order.pageId, externalOrderId: order.orderId,
      ...(conversation?.recipientId ? { externalBuyerId: conversation.recipientId } : {}) });
    return String(saved._id);
  } catch (problem) {
    if ((problem as { code?: number }).code !== 11000) throw problem;
    const duplicate = await RetailOrderModel.findOne({ companyCode, salesChannel: "facebook-page", externalShopId: order.pageId, externalOrderId: order.orderId }).select("_id").lean();
    if (duplicate) return String(duplicate._id);
    throw problem;
  }
}
