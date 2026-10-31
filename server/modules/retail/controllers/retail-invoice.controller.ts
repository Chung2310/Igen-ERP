import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailInvoiceService } from "../services/retail-invoice.service";
import { getResolvedRetailSettings } from "../services/retail-settings.service";
import { renderRetailInvoicePdf, renderBulkRetailInvoicesPdf } from "../services/retail-invoice-pdf.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode || (req.body as any)?.companyCode, branchId: req.query.branchId || (req.body as any)?.branchId }));

type RetailInvoiceControllerDependencies = {
  detail: typeof RetailInvoiceService.detail;
  listForBulkPdf?: typeof RetailInvoiceService.listForBulkPdf;
  registerPosPrint?: typeof RetailInvoiceService.registerPosPrint;
  registerSePayPaymentPrint?: typeof RetailInvoiceService.registerSePayPaymentPrint;
  reprint?: typeof RetailInvoiceService.reprint;
  settings: typeof getResolvedRetailSettings;
  renderPdf: typeof renderRetailInvoicePdf;
  renderBulkPdf?: typeof renderBulkRetailInvoicesPdf;
};

export function createRetailInvoiceController(dependencies: RetailInvoiceControllerDependencies) {
  return {
    pdf: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const invoiceScope = scope(req);
        const [invoice, settings] = await Promise.all([
          dependencies.reprint ? dependencies.reprint(invoiceScope, req.params.id, (req as any).user) : dependencies.detail(invoiceScope, req.params.id),
          dependencies.settings(invoiceScope),
        ]);
        const { buffer, filename } = await dependencies.renderPdf(invoice, settings.invoicePaperSize, Boolean(dependencies.reprint));
        const attachmentFilename = filename.replace(/[^A-Za-z0-9._-]/g, "-");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${attachmentFilename}"`);
        return res.send(buffer);
      } catch (error) {
        return next(error);
      }
    },
    bulkPdf: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const invoiceScope = scope(req);
        const query = {
          ...req.query,
          ...(req.body || {}),
        };
        const [invoices, settings] = await Promise.all([
          dependencies.listForBulkPdf ? dependencies.listForBulkPdf(invoiceScope, query) : [],
          dependencies.settings(invoiceScope),
        ]);
        if (!invoices || invoices.length === 0) {
          return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn nào để xuất file đối soát." });
        }
        if (!dependencies.renderBulkPdf) {
          return res.status(501).json({ success: false, message: "Chức năng xuất hóa đơn hàng loạt chưa sẵn sàng." });
        }
        const requestedPaperSize = (req.query.paperSize || (req.body as any)?.paperSize) as any;
        const paperSize = requestedPaperSize || "A4";
        const { buffer, filename } = await dependencies.renderBulkPdf(invoices, paperSize);
        const attachmentFilename = filename.replace(/[^A-Za-z0-9._-]/g, "-");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${attachmentFilename}"`);
        return res.send(buffer);
      } catch (error) {
        return next(error);
      }
    },
    posPrint: async (req: Request, res: Response) => {
      if (!dependencies.registerPosPrint) return res.status(501).json({ success: false, message: "Chưa hỗ trợ ghi nhận in tại POS." });
      try {
        const invoice = await dependencies.registerPosPrint(scope(req), req.params.id, (req as any).user);
        return res.json({ success: true, data: invoice });
      } catch (error: any) {
        return res.status(Number(error?.status) || 500).json({ success: false, message: error?.message || "Không ghi nhận được lượt in hóa đơn." });
      }
    },
    paymentPrint: async (req: Request, res: Response) => {
      if (!dependencies.registerSePayPaymentPrint) return res.status(501).json({ success: false, message: "Chưa hỗ trợ in hóa đơn sau thanh toán SePay." });
      try {
        const result = await dependencies.registerSePayPaymentPrint(
          scope(req),
          req.params.id,
          String((req.body as any)?.transactionKey || ""),
          (req as any).user,
        );
        return res.json({ success: true, data: result });
      } catch (error: any) {
        return res.status(Number(error?.status) || 500).json({ success: false, message: error?.message || "Không ghi nhận được lượt in hóa đơn." });
      }
    },
    reprint: async (req: Request, res: Response) => {
      if (!dependencies.reprint) return res.status(501).json({ success: false, message: "Chưa hỗ trợ in lại hóa đơn." });
      try {
        const invoice = await dependencies.reprint(scope(req), req.params.id, (req as any).user);
        return res.json({ success: true, data: invoice });
      } catch (error: any) {
        return res.status(Number(error?.status) || 500).json({ success: false, message: error?.message || "Không in lại được hóa đơn." });
      }
    },
  };
}

const pdfController = createRetailInvoiceController({
  detail: RetailInvoiceService.detail,
  listForBulkPdf: RetailInvoiceService.listForBulkPdf,
  registerPosPrint: RetailInvoiceService.registerPosPrint,
  registerSePayPaymentPrint: RetailInvoiceService.registerSePayPaymentPrint,
  reprint: RetailInvoiceService.reprint,
  settings: getResolvedRetailSettings,
  renderPdf: renderRetailInvoicePdf,
  renderBulkPdf: renderBulkRetailInvoicesPdf,
});
export const retailInvoiceController = {
  list: async (req: Request, res: Response) => res.json({ success: true, data: await RetailInvoiceService.list(scope(req), req.query) }),
  detail: async (req: Request, res: Response) => res.json({ success: true, data: await RetailInvoiceService.detail(scope(req), req.params.id) }),
  pdf: pdfController.pdf,
  bulkPdf: pdfController.bulkPdf,
  posPrint: pdfController.posPrint,
  paymentPrint: pdfController.paymentPrint,
  reprint: pdfController.reprint,
};
