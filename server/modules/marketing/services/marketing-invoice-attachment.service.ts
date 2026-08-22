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
    if (!invoice) return [];
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

export async function resolveMarketingAttachments(companyCode: string, ref: MarketingAttachmentRef): Promise<MarketingAttachment[]> {
  const resolver = ATTACHMENT_RESOLVERS[ref?.kind as MarketingAttachmentRef["kind"]];
  if (!resolver) {
    console.error("[marketing.invoice-attachment] unknown attachment reference", ref);
    return [];
  }
  return resolver(companyCode, ref);
}
