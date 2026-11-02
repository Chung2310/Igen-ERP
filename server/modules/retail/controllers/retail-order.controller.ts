import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { hasEffectiveRetailCapability } from "../permissions";
import { RetailOrderService, serializeRetailOrder } from "../services/retail-order.service";
import { RetailProductService } from "../services/retail-product.service";
import { CashierShiftService } from "../services/cashier-shift.service";
import { listSerialUnits } from "../../inventory/serials/serial-unit.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
export const retailOrderController = {
  saleSerials: async (req: Request, res: Response) => {
    try {
      const result = await listSerialUnits(scope(req), {
        productId: String(req.query.productId || ""), variantId: String(req.query.variantId || ""),
        serial: String(req.query.serial || ""), forSale: true, status: "in_stock",
        page: Number(req.query.page), limit: Number(req.query.limit),
      });
      const items = result.items.map(({ _id, productId, variantId, sku, productName, serialNumber, normalizedSerialNumber, internalBarcode, normalizedInternalBarcode, status }) =>
        ({ _id, productId, variantId, sku, productName, serialNumber, normalizedSerialNumber, internalBarcode, normalizedInternalBarcode, status }));
      res.json({ success: true, data: { ...result, items } });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
  },
  reconcileDraftRequest: async (req: Request, res: Response) => {
    try { const actor = (req as any).user || {}; res.json({ success: true, data: await RetailOrderService.reconcileDraftRequest(scope(req), req.body || {}, actor, await hasEffectiveRetailCapability(actor, "manager")) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  revokeDraftRequest: async (req: Request, res: Response) => {
    try { const actor = (req as any).user || {}; res.json({ success: true, data: await RetailOrderService.revokeDraftRequest(scope(req), req.body || {}, actor, await hasEffectiveRetailCapability(actor, "manager")) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  reconcileCheckout: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {}, manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.reconcileCheckout(scope(req), req.body || {}, actor, manager);
      res.json({ success: true, data: result.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  revokeCheckout: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {}, manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.revokeCheckout(scope(req), req.body || {}, actor, manager);
      res.json({ success: true, data: result.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  quote: async (req: Request, res: Response) => {
    try {
      const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager");
      const quote = await RetailOrderService.quote(scope(req), req.body || {});
      const { items, ...safe } = serializeRetailOrder({ ...quote, items: quote.lines }, manager);
      res.json({ success: true, data: { ...safe, lines: items } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  products: async (req: Request, res: Response) => {
    try {
      const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager");
      const result = await RetailProductService.search(scope(req), req.query);
      res.json({ success: true, data: { ...result, items: manager ? result.items : result.items.map(({ costPrice: _costPrice, ...product }: any) => product) } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  categories: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailProductService.categories(scope(req)) });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  idempotency: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailOrderService.idempotency(scope(req), req.params.key) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  list: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const canSeeCost = await hasEffectiveRetailCapability(actor, "manager");
      const query = { ...req.query } as any;
      if (!canSeeCost) {
        query.heldOnly = true;
        query.ownerId = String(actor.id || actor.uid || "");
      }
      const data = await RetailOrderService.list(scope(req), query);
      res.json({ success: true, data: { ...data, items: data.items.map((order) => serializeRetailOrder(order, canSeeCost)) } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  detail: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      res.json({ success: true, data: serializeRetailOrder(await RetailOrderService.detail(scope(req), req.params.id, actor, manager), manager) });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  paymentStatus: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      res.json({ success: true, data: await RetailOrderService.paymentStatus(scope(req), req.params.id, actor, manager) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  create: async (req: Request, res: Response) => {
    try {
      const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager");
      res.status(201).json({ success: true, data: serializeRetailOrder(await RetailOrderService.createDraft(scope(req), req.body || {}, (req as any).user), manager) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  update: async (req: Request, res: Response) => {
    try {
      const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager");
      res.json({ success: true, data: serializeRetailOrder(await RetailOrderService.updateDraft(scope(req), req.params.id, req.body || {}, (req as any).user, manager), manager) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  confirm: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const retailScope = scope(req);
      const input = req.body || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      const attempt = await RetailOrderService.idempotency(retailScope, input.idempotencyKey);
      let shift;
      if (attempt.status === "not_found") {
        if (!input.posSessionId) {
          const error: any = new Error("Chưa có mã phiên POS. Hãy mở phiên trước khi xác nhận đơn hàng.");
          error.status = 409;
          error.code = "POS_SESSION_REQUIRED";
          throw error;
        }
        shift = await CashierShiftService.operational(
          retailScope,
          actor,
          new Date(),
          String(req.query.terminalId || input.terminalId || "default"),
          String(input.posSessionId),
        );
      }
      const result = await RetailOrderService.confirm(retailScope, req.params.id, input, actor, shift, manager);
      res.json({ success: true, data: { ...result, order: serializeRetailOrder(result.order, manager) } });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  checkout: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const retailScope = scope(req);
      const input = req.body || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      const attempt = await RetailOrderService.idempotency(retailScope, input.idempotencyKey);
      let shift;
      if (attempt.status === "not_found") {
        if (!input.posSessionId) {
          const error: any = new Error("Chưa có mã phiên POS. Hãy mở phiên trước khi thanh toán.");
          error.status = 409;
          error.code = "POS_SESSION_REQUIRED";
          throw error;
        }
        shift = await CashierShiftService.operational(
          retailScope,
          actor,
          new Date(),
          String(req.query.terminalId || input.terminalId || "default"),
          String(input.posSessionId),
        );
      }
      const result = await RetailOrderService.checkout(retailScope, input, actor, shift, manager);
      res.status(201).json({ success: true, data: { ...result, order: serializeRetailOrder(result.order, manager) } });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  revokeCollection: async (req: Request, res: Response) => {
    try { res.json({ success: true, data: await RetailOrderService.revokeCollection(scope(req), req.params.id, req.body || {}, (req as any).user, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  reconcileCollection: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.reconcileCollection(scope(req), req.params.id, req.body || {}, actor, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined);
      res.json({ success: true, data: result?.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  collect: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailOrderService.collect(scope(req), req.params.id, req.body || {}, (req as any).user, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
    }
  },
  revokeCancellation: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      res.json({ success: true, data: await RetailOrderService.revokeCancellation(scope(req), req.params.id, req.body || {}, actor, await hasEffectiveRetailCapability(actor, "manager"), req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined) });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  reconcileCancellation: async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const manager = await hasEffectiveRetailCapability(actor, "manager");
      const result = await RetailOrderService.reconcileCancellation(scope(req), req.params.id, req.body || {}, actor, manager, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined);
      res.json({ success: true, data: result?.status === "completed" ? { ...result, order: serializeRetailOrder(result.order, manager) } : result });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message, code: error.code }); }
  },
  cancel: async (req: Request, res: Response) => {
    try {
      const retailScope = scope(req);
      res.json({ success: true, data: await RetailOrderService.cancel(retailScope, req.params.id, req.body || {}, (req as any).user, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) });
    } catch (error: any) {
      res.status(error.status || 400).json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) });
    }
  },
  deleteCancelled: async (req: Request, res: Response) => {
    try { res.json({ success: true, data: await RetailOrderService.deleteCancelled(scope(req), req.params.id) }); }
    catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
  },
};
