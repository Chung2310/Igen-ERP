import { Router } from 'express';
import { requirePermission, type AuthenticatedRequest } from '../../middleware/auth';
import { requireRetailBranch, retailScopeFromRequest } from '../retail/contracts';
import { reverseManualOutbound } from './stock-log-reversal.service';

export const stockLogReversalRouter = Router();
stockLogReversalRouter.post('/:id/reverse', requirePermission('inventory:manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const scope = requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
    const user = req.user;
    const data = await reverseManualOutbound(scope, String(req.params.id), req.body || {}, { id: String(user?.id || ''), name: String(user?.displayName || user?.email || '') });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
