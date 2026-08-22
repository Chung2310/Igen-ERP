import type { NextFunction, Request, Response } from "express";
import { CustomerError } from "./customer-errors";
import { searchActiveCustomers, quickCreateCustomer } from "./contracts";
import { CustomerService, type CustomerActor, type CustomerScope } from "./customer.service";
import { BillingProfileService } from "./billing-profile.service";
import { CustomerPurchaseHistoryService } from "./customer-purchase-history.service";
import { requireRetailBranch, retailScopeFromRequest, RetailScopeError, type RetailBranchScope } from "../retail/contracts";

function scopeFromRequest(req: Request): CustomerScope {
  const user = (req as any).user || {};
  const rawCompanyCode = user.role === "superadmin" ? req.query.companyCode : user.companyCode;
  const companyCode = String(rawCompanyCode || "").trim().toUpperCase();
  if (!companyCode) throw new CustomerError("CUSTOMER_COMPANY_REQUIRED", "Phạm vi công ty là bắt buộc.", 400);
  return { companyCode };
}

export function purchaseHistoryScopeFromRequest(req: Request): RetailBranchScope {
  return requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
}

export function purchaseHistoryServiceInput(req: Request) {
  const retailScope = purchaseHistoryScopeFromRequest(req);
  return { customerScope: { companyCode: retailScope.companyCode }, branchId: retailScope.branchId };
}

function actorFromRequest(req: Request): CustomerActor {
  const user = (req as any).user || {};
  return {
    id: String(user.id || user.uid || ""),
    name: String(user.displayName || user.email || "").trim(),
  };
}

function versionFromRequest(req: Request): number {
  const version = Number(req.body?.version);
  if (!Number.isInteger(version) || version < 0) {
    throw new CustomerError("CUSTOMER_VERSION_REQUIRED", "Phiên bản hồ sơ không hợp lệ.", 400);
  }
  return version;
}

const handle = (action: (req: Request, res: Response) => Promise<Response>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    return await action(req, res);
  } catch (error) {
    if (error instanceof CustomerError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    if (error instanceof RetailScopeError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

export const customerController = {
  list: handle(async (req, res) => res.json({ success: true, data: await CustomerService.list(scopeFromRequest(req), req.query as any) })),
  search: handle(async (req, res) => res.json({ success: true, data: await searchActiveCustomers(scopeFromRequest(req), String(req.query.q || ""), Number(req.query.limit) || 10) })),
  create: handle(async (req, res) => res.status(201).json({ success: true, data: await CustomerService.create(scopeFromRequest(req), req.body || {}, actorFromRequest(req)) })),
  quickCreate: handle(async (req, res) => res.status(201).json({ success: true, data: await quickCreateCustomer(scopeFromRequest(req), req.body || {}, actorFromRequest(req)) })),
  detail: handle(async (req, res) => res.json({ success: true, data: await CustomerService.detail(scopeFromRequest(req), req.params.id) })),
  purchaseHistory: handle(async (req, res) => {
    const { customerScope, branchId } = purchaseHistoryServiceInput(req);
    return res.json({ success: true, data: await CustomerPurchaseHistoryService.get(customerScope, req.params.id, branchId) });
  }),
  update: handle(async (req, res) => res.json({ success: true, data: await CustomerService.update(scopeFromRequest(req), req.params.id, req.body || {}, versionFromRequest(req)) })),
  activate: handle(async (req, res) => res.json({ success: true, data: await CustomerService.setStatus(scopeFromRequest(req), req.params.id, "active", versionFromRequest(req)) })),
  deactivate: handle(async (req, res) => res.json({ success: true, data: await CustomerService.setStatus(scopeFromRequest(req), req.params.id, "inactive", versionFromRequest(req)) })),
  billingProfiles: handle(async (req, res) => res.json({ success: true, data: await BillingProfileService.list(scopeFromRequest(req), req.params.id) })),
  createBillingProfile: handle(async (req, res) => res.status(201).json({ success: true, data: await BillingProfileService.create(scopeFromRequest(req), req.params.id, req.body || {}, actorFromRequest(req)) })),
};
