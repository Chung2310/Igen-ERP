import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailInvoiceService } from "../services/retail-invoice.service";
import { getResolvedRetailSettings } from "../services/retail-settings.service";
import { renderRetailInvoicePdf } from "../services/retail-invoice-pdf.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));

type RetailInvoiceControllerDependencies = {
  detail: typeof RetailInvoiceService.detail;
  settings: typeof getResolvedRetailSettings;
  renderPdf: typeof renderRetailInvoicePdf;
};

export function createRetailInvoiceController(dependencies: RetailInvoiceControllerDependencies) {
  return {
    pdf: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const invoiceScope = scope(req);
        const [invoice, settings] = await Promise.all([
          dependencies.detail(invoiceScope, req.params.id),
          dependencies.settings(invoiceScope),
        ]);
        const { buffer, filename } = await dependencies.renderPdf(invoice, settings.invoicePaperSize);
        const attachmentFilename = filename.replace(/[^A-Za-z0-9._-]/g, "-");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${attachmentFilename}"`);
        return res.send(buffer);
      } catch (error) {
        return next(error);
      }
    },
  };
}

const pdfController = createRetailInvoiceController({
  detail: RetailInvoiceService.detail,
  settings: getResolvedRetailSettings,
  renderPdf: renderRetailInvoicePdf,
});
export const retailInvoiceController = {
  list: async (req: Request, res: Response) => res.json({ success: true, data: await RetailInvoiceService.list(scope(req), req.query) }),
  detail: async (req: Request, res: Response) => res.json({ success: true, data: await RetailInvoiceService.detail(scope(req), req.params.id) }),
  pdf: pdfController.pdf,
};
