import { Router } from 'express';
import { requirePermission, type AuthenticatedRequest } from '../../middleware/auth';
import { requireRetailBranch, retailScopeFromRequest } from '../retail/contracts';
import { CustomerService } from './customer.service';
import { RepairTicketModel } from '../repair/repair-ticket.model';

export const customerRepairsRouter = Router();
export async function getCustomerRepairHistory(scope: { companyCode: string; branchId: string }, customerId: string, page = 1) {
  const customer = await CustomerService.detail({ companyCode: scope.companyCode }, customerId);
  const filter = { ...scope, customerId: { $in: [String(customer._id), customer.customerCode] } };
  const limit = 20;
  const [items, total] = await Promise.all([
    RepairTicketModel.find(filter).select('ticketCode ticketType subjectType device.name status receivedAt promisedAt totalAmount paidAmount dueAmount').sort({ receivedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    RepairTicketModel.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}
customerRepairsRouter.get('/:id/repairs', requirePermission('customer:read'), requirePermission(['repair:read', 'repair:manage']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const scope = requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
    const page = Math.max(1, Math.min(100000, Math.floor(Number(req.query.page) || 1)));
    res.json({ success: true, data: await getCustomerRepairHistory(scope, String(req.params.id), page) });
  } catch (cause) { next(cause); }
});
