import { Router } from 'express';
import { requirePermission, type AuthenticatedRequest } from '../../middleware/auth';
import { requireRetailBranch, retailScopeFromRequest } from '../retail/contracts';
import { postRepairRefund, reconcileRepairRefund, repairRefundSummary, repairRefundVouchers, revokeRepairRefund } from './services/repair-refund.service';

export const repairRefundRouter = Router();
const read = requirePermission(['repair:read', 'repair:manage']);
const manage = [requirePermission('repair:manage'), requirePermission('finance-wallet:manage')];
const scope = (req: AuthenticatedRequest) => requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
const actor = (req: AuthenticatedRequest) => ({ id: String(req.user?.id || ''), name: String(req.user?.displayName || req.user?.email || req.user?.id || '') });
repairRefundRouter.get('/tickets/:id/refunds', read, async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ success: true, data: await repairRefundSummary(scope(req), String(req.params.id)) }); } catch (cause) { next(cause); }
});
repairRefundRouter.get('/tickets/:id/refunds/vouchers', ...manage, async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ success: true, data: await repairRefundVouchers(scope(req), String(req.params.id)) }); } catch (cause) { next(cause); }
});
for (const [suffix, action] of [['', postRepairRefund], ['/reconcile', reconcileRepairRefund], ['/revoke', revokeRepairRefund]] as const) {
  repairRefundRouter.post(`/tickets/:id/refunds${suffix}`, ...manage, async (req: AuthenticatedRequest, res, next) => {
    try { res.json({ success: true, data: await action(scope(req), String(req.params.id), req.body, actor(req)) }); } catch (cause) { next(cause); }
  });
}
