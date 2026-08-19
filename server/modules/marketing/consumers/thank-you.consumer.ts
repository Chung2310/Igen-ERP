import { registerDomainConsumer } from "../../../integrations/shared/event-bus";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailInvoiceModel } from "../../retail/models/retail-invoice.model";
import { renderRetailInvoicePdf } from "../../retail/services/retail-invoice-pdf.service";
import { getResolvedRetailSettings } from "../../retail/services/retail-settings.service";
import type { MarketingAttachment } from "../services/marketing-channels";
import { companyNameOf, queueAndSend, resolveSendableChannel } from "../services/marketing-delivery.service";
import { getMarketingSettings } from "../services/marketing-settings.service";
import { emptyVariables } from "../services/marketing-template";

const money = (value: number) => `${Math.round(Number(value) || 0).toLocaleString("vi-VN")} ₫`;

/**
 * Hoá đơn PDF của đơn hàng, dựng lại đúng bản in mà quầy đang dùng.
 * Không có hoá đơn hợp lệ hoặc dựng lỗi thì trả về rỗng — tin cảm ơn vẫn gửi,
 * mất tệp đính kèm không đáng để chặn cả email.
 */
async function invoiceAttachment(companyCode: string, branchId: string, orderId: string): Promise<MarketingAttachment[]> {
  try {
    const invoice: any = await RetailInvoiceModel.findOne({ companyCode: companyCode.toUpperCase(), orderId, status: "issued" }).lean();
    if (!invoice) return [];
    const settings = await getResolvedRetailSettings({ companyCode: companyCode.toUpperCase(), branchId: String(invoice.branchId || branchId) });
    const { buffer, filename } = await renderRetailInvoicePdf(invoice, settings.invoicePaperSize);
    return [{ filename, content: buffer, contentType: "application/pdf" }];
  } catch (error) {
    console.error("[marketing.thank-you] không dựng được hoá đơn PDF", orderId, error);
    return [];
  }
}

/**
 * Gửi tin cảm ơn khi đơn bán lẻ được xác nhận (xuất hoá đơn).
 * Chạy qua outbox worker nên không làm chậm thao tác thu ngân và tự retry khi lỗi.
 */
export async function sendThankYouForOrder(event: any): Promise<void> {
  const payload = event?.payload || {};
  const companyCode = String(event?.companyCode || "");
  const customerId = String(payload.customerId || "").trim();
  if (!companyCode || !customerId) return;

  const settings = await getMarketingSettings(companyCode);
  if (!settings.thank_you.enabled) return;

  const customer: any = await CustomerModel.findOne({ _id: customerId, companyCode: companyCode.toUpperCase() }).lean();
  if (!customer || customer.status !== "active") return;

  const adapter = await resolveSendableChannel(companyCode, settings.thank_you.channels);
  if (!adapter) return;

  const attachments = settings.attachInvoicePdf && adapter.supportsAttachments
    ? await invoiceAttachment(companyCode, String(payload.branchId || event?.branchId || ""), String(payload.orderId))
    : undefined;

  const outcome = await queueAndSend({
    companyCode,
    automationType: "thank_you",
    customer,
    adapter,
    attachments,
    variables: {
      ...emptyVariables(),
      customerName: String(customer.name || payload.customerName || ""),
      companyName: await companyNameOf(companyCode),
      orderCode: String(payload.orderCode || ""),
      orderTotal: money(payload.grandTotal),
    },
    idempotencyKey: `${companyCode.toUpperCase()}:thank_you:${payload.orderId}:${adapter.channel}`,
    template: { subject: settings.thank_you.subject, html: settings.thank_you.html },
  });
  // Lỗi gửi được ném ra để outbox worker giữ lại và thử lại theo backoff.
  if (outcome.status === "failed") throw new Error(outcome.reason || "MARKETING_THANK_YOU_FAILED");
}

export function registerMarketingConsumers() {
  try {
    registerDomainConsumer("retail.order.confirmed", "marketing.thank-you", sendThankYouForOrder, { requiresModule: "marketing" });
  } catch (error) {
    // Đăng ký trùng chỉ xảy ra khi module được import lại (hot reload / test).
    if (!String((error as Error).message).includes("đã được đăng ký")) throw error;
  }
}
