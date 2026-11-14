import { Router } from 'express';
import { getEffectivePermissions, hasAnyPermission, requirePermission, type AuthenticatedRequest } from '../../middleware/auth';
import { getModuleStateForCompany, isServiceSubscriptionBlocked, resolveModuleAccess } from '../../middleware/require-module';
import { requireRetailBranch, resolveRetailScopeFromRequest } from '../retail/contracts';
import { getCustomerTransactionDetail, getCustomerTransactions } from './customer-transactions.service';
import type { CustomerTransactionKind } from '../../../shared/customer-transactions';

export const customerTransactionsRouter = Router();
customerTransactionsRouter.use('/:id/transactions', requirePermission('customer:read'));
async function access(req: AuthenticatedRequest) {
  const actor = req.user!;
  const scope = requireRetailBranch(await resolveRetailScopeFromRequest(actor, req.query));
  const [state, permissions] = await Promise.all([
    getModuleStateForCompany(scope.companyCode),
    getEffectivePermissions(actor.id, actor.role, scope.companyCode),
  ]);
  const allowed = (module: 'repair' | 'retail') => !isServiceSubscriptionBlocked(state)
    && resolveModuleAccess({ companyCode: scope.companyCode }, module, state.modules, state.exists, state.businessType)
    && hasAnyPermission(permissions, [`${module}:read`, `${module}:manage`]);
  return { scope, repairsVisible: allowed('repair'), retailVisible: allowed('retail') };
}
customerTransactionsRouter.get('/:id/transactions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { type, from, to, page, limit } = req.query;
    const { scope, repairsVisible, retailVisible } = await access(req);
    res.json({ success: true, data: await getCustomerTransactions(scope, String(req.params.id), { type, from, to, page, limit }, repairsVisible, retailVisible) });
  } catch (cause) { next(cause); }
});
customerTransactionsRouter.get('/:id/transactions/:kind/:sourceId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { scope, repairsVisible, retailVisible } = await access(req);
    res.json({ success: true, data: await getCustomerTransactionDetail(scope, String(req.params.id), String(req.params.kind) as CustomerTransactionKind, String(req.params.sourceId), String(req.query.eventId || ''), repairsVisible, retailVisible) });
  } catch (cause) { next(cause); }
});
