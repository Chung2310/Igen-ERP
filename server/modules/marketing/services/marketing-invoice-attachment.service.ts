import { RetailInvoiceModel } from "../../retail/models/retail-invoice.model";
import { renderRetailInvoicePdf } from "../../retail/services/retail-invoice-pdf.service";
import { getResolvedRetailSettings } from "../../retail/services/retail-settings.service";
import type { MarketingAttachment } from "./marketing-channels";

export const MARKETING_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type MarketingAttachmentRef = {
  kind: "retail-invoice";
  orderId: string;
  branchId: string;
};

async function retailInvoiceAttachment(companyCode: string, { orderId, branchId }: MarketingAttachmentRef): Promise<MarketingAttachment[]> {
  try {
    const normalizedCompanyCode = companyCode.toUpperCase();
    const invoice: any = await RetailInvoiceModel.findOne({ companyCode: normalizedCompanyCode, orderId, status: "issued" }).lean();
    if (!invoice) {
      console.error("[marketing.invoice-attachment] no issued invoice for order", normalizedCompanyCode, orderId);
      return [];
    }
    const settings = await getResolvedRetailSettings({ companyCode: normalizedCompanyCode, branchId: String(invoice.branchId || branchId) });
    const { buffer, filename } = await renderRetailInvoicePdf(invoice, settings.invoicePaperSize);
    if (buffer.length > MARKETING_ATTACHMENT_MAX_BYTES) {
      console.error("[marketing.invoice-attachment] PDF exceeds size limit", orderId, buffer.length);
      return [];
    }
    return [{ filename, content: buffer, contentType: "application/pdf" }];
  } catch (error) {
    console.error("[marketing.invoice-attachment] could not render invoice PDF", orderId, error);
    return [];
  }
}

const ATTACHMENT_RESOLVERS: Record<MarketingAttachmentRef["kind"], (companyCode: string, ref: MarketingAttachmentRef) => Promise<MarketingAttachment[]>> = {
  "retail-invoice": retailInvoiceAttachment,
};

/**
 * Suy lại tham chiếu đính kèm cho các bản ghi delivery tạo trước khi trường
 * `attachmentRef` tồn tại — chúng luôn có `attachmentRef: null` nên gửi lại sẽ
 * không bao giờ kèm được hóa đơn. Khoá idempotency của tin cảm ơn có dạng
 * `{COMPANY}:thank_you:{orderId}:{channel}` nên `orderId` lấy lại được từ đó.
 *
 * `branchId` để trống là đủ: hóa đơn tra theo `orderId`, và chi nhánh dùng để
 * đọc cài đặt khổ giấy được lấy từ chính hóa đơn tìm được.
 */
export function attachmentRefForDelivery(delivery: { automationType?: string; attachmentRef?: unknown; idempotencyKey?: string }): MarketingAttachmentRef | null {
  if (delivery?.attachmentRef) return delivery.attachmentRef as MarketingAttachmentRef;
  if (delivery?.automationType !== "thank_you") return null;
  const match = /:thank_you:([^:]+):[^:]+$/.exec(String(delivery.idempotencyKey || ""));
  const orderId = match?.[1]?.trim();
  if (!orderId) return null;
  return { kind: "retail-invoice", orderId, branchId: "" };
}

export async function resolveMarketingAttachments(companyCode: string, ref: MarketingAttachmentRef): Promise<MarketingAttachment[]> {
  const resolver = ATTACHMENT_RESOLVERS[ref?.kind as MarketingAttachmentRef["kind"]];
  if (!resolver) {
    console.error("[marketing.invoice-attachment] unknown attachment reference", ref);
    return [];
  }
  return resolver(companyCode, ref);
}
