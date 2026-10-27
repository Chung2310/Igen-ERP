import { Router } from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import { requirePermission, type AuthenticatedRequest } from '../../../middleware/auth';
import { requireRetailBranch, retailScopeFromRequest } from '../../retail/contracts';
import { WarehouseModel } from '../../../model/warehouse.model';
import { AuditInputError, reconcileInventory, type Finding } from './reconciliation.service';

export const inventoryReconciliationRouter = Router();
const read = requirePermission('inventory:read');
const bodySchema = Joi.object({ warehouseId: Joi.string().hex().length(24).allow(''), baseline: Joi.object().unknown(true), ledgerComplete: Joi.boolean().default(false) });
const scopeOf = (req: AuthenticatedRequest) => requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));

inventoryReconciliationRouter.get('/warehouses', read, async (req, res, next) => {
  try {
    const scope = scopeOf(req);
    const warehouses = await WarehouseModel.find({ ...scope, $or: [{ kind: { $ne: 'transit' } }, { isActive: true }] }).select('name code kind isActive branchId').sort({ kind: 1, name: 1 }).limit(2000).lean();
    res.json({ success: true, data: warehouses });
  } catch (error) { next(error); }
});

inventoryReconciliationRouter.post('/runs', read, async (req, res, next) => {
  const { value, error } = bodySchema.validate(req.body, { abortEarly: false });
  if (error) { res.status(400).json({ success: false, message: 'Chọn kho và dữ liệu tồn đầu kỳ hợp lệ.' }); return; }
  let scope: ReturnType<typeof scopeOf>;
  try { scope = scopeOf(req); } catch (problem) { next(problem); return; }
  let session: mongoose.mongo.ClientSession | undefined;
  const cancellation = new AbortController();
  const abort = () => cancellation.abort();
  req.once('aborted', abort);
  try {
    session = mongoose.connection.getClient().startSession({ snapshot: true });
    const findings: Finding[] = [];
    const summary = await reconcileInventory(mongoose.connection.db!, session, { ...scope, warehouseId: value.warehouseId || undefined }, async (finding) => { if (findings.length < 500) findings.push(finding); }, {
      baseline: value.baseline,
      ledgerComplete: value.ledgerComplete,
      maxDocuments: 5000,
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(30_000)]),
    });
    res.json({ success: true, data: { summary, findings, truncated: summary.findings > findings.length, checkedAt: new Date().toISOString() } });
  } catch (problem) {
    if (problem instanceof AuditInputError) res.status(400).json({ success: false, message: problem.message });
    else if (problem instanceof Error && ['AbortError', 'TimeoutError'].includes(problem.name)) res.status(503).json({ success: false, message: 'Đối soát chưa hoàn tất trong thời gian cho phép. Hãy chọn từng kho để chạy lại.' });
    else next(Object.assign(new Error('Không thể hoàn tất đối soát snapshot. Kiểm tra MongoDB hỗ trợ snapshot read và thử phạm vi nhỏ hơn.'), { statusCode: 503 }));
  } finally {
    req.off('aborted', abort);
    await session?.endSession();
  }
});
