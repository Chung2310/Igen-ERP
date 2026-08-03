import { Router } from "express";
import { AuditEventModel } from "../model/audit-event.model";
import { TenantManagementService } from "../super-admin/tenant-management.service";
import { executeAdminAction } from "../super-admin/action-runtime";
import { tenantActions } from "../super-admin/action-registry";
import { clearModuleCache } from "../middleware/require-module";
import { notifyCompanyModulesChanged } from "../service/company-module-notify";

type Dependencies = { service?: TenantManagementService; execute?: typeof executeAdminAction; clearModuleCache?: (companyCode?: string) => void; emitToCompany?: (companyCode: string, eventName: string, data: any) => void | Promise<void>; };
const required = (value: unknown, label: string) => { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`); return value.trim(); };
const actionRequest = (req: any, definition: any, input: unknown) => ({ definition, input, idempotencyKey: required(req.header("idempotency-key"), "idempotency-key"), reason: req.body?.reason, password: req.body?.password, token: req.body?.token, step: req.body?.step });

export function createTenantRouter(deps: Dependencies = {}) {
  const router = Router(); const service = deps.service ?? new TenantManagementService(); const execute = deps.execute ?? executeAdminAction;
  const clearCache = deps.clearModuleCache ?? clearModuleCache; const emitCompany = deps.emitToCompany ?? (async (companyCode: string, eventName: string, data: any) => {
    const socket = await import("../socket");
    socket.emitToCompany(companyCode, eventName, data);
  });
  const mutation = (definition: any, handler: (input: any) => Promise<any>) => async (req: any, res: any) => { try { const response = await execute({ actorId: req.user.id, sessionId: req.user.sessionId }, actionRequest(req, definition, { ...req.body, companyCode: req.params.companyCode }), handler); return res.json(response); } catch (error) { return res.status(400).json({ message: (error as Error).message, correlationId: req.id }); } };
  router.get("/tenants", async (_req, res) => res.json({ tenants: await service.list() }));
  router.post("/tenants", mutation(tenantActions.create, async (input) => service.create(input)));
  router.get("/tenants/:companyCode", async (req, res) => { try { const result = await service.get(req.params.companyCode); const [summary, audit] = await Promise.all([service.getSummary(req.params.companyCode), AuditEventModel.find({ companyCode: result.code }, undefined, { sort: { occurredAt: -1 }, limit: 20 })]); return res.json({ tenant: result, summary, audit }); } catch (error) { return res.status(404).json({ message: (error as Error).message, correlationId: (req as any).id }); } });
  router.get("/tenants/:companyCode/users", async (req, res) => { try { return res.json({ users: await service.listUsers(req.params.companyCode) }); } catch (error) { return res.status(404).json({ message: (error as Error).message, correlationId: (req as any).id }); } });
  router.patch("/tenants/:companyCode", mutation(tenantActions.update, async (input) => service.update(input.companyCode, input)));
  router.patch("/tenants/:companyCode/modules", mutation(tenantActions.updateModules, async (input) => {
    const tenant = await service.updateModules(input.companyCode, { enabledModules: input.enabledModules, businessType: input.businessType });
    await notifyCompanyModulesChanged(tenant.code, tenant.enabledModules || [], { clearModuleCache: clearCache, emitToCompany: emitCompany }, "tenant modules");
    return tenant;
  }));
  router.post("/tenants/:companyCode/lifecycle", mutation(tenantActions.lifecycle, async (input) => {
    const tenant = await service.transitionLifecycle(input.companyCode, input.lifecycleStatus);
    try {
      await emitCompany(tenant.code, "company_status_updated", { companyCode: tenant.code, lifecycleStatus: tenant.lifecycleStatus });
    } catch (error) {
      console.error(`[tenant lifecycle] Realtime delivery failed for ${tenant.code}:`, error);
    }
    return tenant;
  }));
  router.post("/tenants/:companyCode/deletion", mutation(tenantActions.scheduleDeletion, async (input) => service.scheduleDeletion(input.companyCode, input.reason)));
  router.delete("/tenants/:companyCode/deletion", mutation(tenantActions.cancelDeletion, async (input) => service.cancelDeletion(input.companyCode)));
  return router;
}
