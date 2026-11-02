import { Router } from 'express';
import { getEffectivePermissions, requirePermission, type AuthenticatedRequest } from '../../middleware/auth';
import { requireRetailBranch, retailScopeFromRequest } from '../retail/contracts';
import { getCustomerTransactionDetail, getCustomerTransactions } from './customer-transactions.service';
import type { CustomerTransactionKind } from '../../../shared/customer-transactions';

export const customerTransactionsRouter = Router();
customerTransactionsRouter.use('/:id/transactions', requirePermission('customer:read'));
async function canReadRepairs(req: AuthenticatedRequest) {
  if (['admin', 'superadmin'].includes(String(req.user?.role))) return true;
  const permissions = await getEffectivePermissions(String(req.user?.id || ''), String(req.user?.role || ''), String(req.user?.companyCode || '') || undefined);
  return ['*', 'repair:read', 'repair:manage'].some((permission) => permissions.has(permission));
}
const scope = (req: AuthenticatedRequest) => requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
customerTransactionsRouter.get('/:id/transactions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { type, from, to, page, limit } = req.query;
    res.json({ success: true, data: await getCustomerTransactions(scope(req), String(req.params.id), { type, from, to, page, limit }, await canReadRepairs(req)) });
  } catch (cause) { next(cause); }
});
customerTransactionsRouter.get('/:id/transactions/:kind/:sourceId', async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ success: true, data: await getCustomerTransactionDetail(scope(req), String(req.params.id), String(req.params.kind) as CustomerTransactionKind, String(req.params.sourceId), String(req.query.eventId || ''), await canReadRepairs(req)) }); } catch (cause) { next(cause); }
});
