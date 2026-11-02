import { beforeEach, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { getEffectivePermissions } from '../middleware/auth';
import { getEnabledModulesForCompany } from '../middleware/require-module';
import { getBusinessOverview } from '../service/business-overview.service';
import { dashboardController } from './dashboard.controller';

vi.mock('../middleware/auth', () => ({ getEffectivePermissions: vi.fn() }));
vi.mock('../middleware/require-module', () => ({ getEnabledModulesForCompany: vi.fn() }));
vi.mock('../service/business-overview.service', () => ({ getBusinessOverview: vi.fn() }));
vi.mock('../service/dashboard.service', () => ({ dashboardService: {} }));
const request = () => ({ user: { id: 'user-a', email: 'a@example.test', role: 'admin', companyCode: 'ACME', branchId: 'branch-a' }, query: { filter: 'custom', startDate: '2026-10-01', endDate: '2026-10-28', companyCode: 'OTHER', branchId: 'other-branch' } }) as unknown as AuthenticatedRequest;
const response = () => { const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res; };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEffectivePermissions).mockResolvedValue(new Set(['people:read']));
  vi.mocked(getEnabledModulesForCompany).mockResolvedValue(['student']);
});
it('uses the authenticated tenant/branch and a fixed Vietnam business-calendar range', async () => {
  const res = response();
  await dashboardController.getBusinessOverview(request(), res as unknown as Response);
  expect(getBusinessOverview).toHaveBeenCalledWith(expect.objectContaining({ companyCode: 'ACME', branchId: 'branch-a', enabledModules: ['student'], permissions: new Set(['people:read']) }), expect.objectContaining({ start: new Date('2026-09-30T17:00:00.000Z'), end: new Date('2026-10-28T16:59:59.999Z') }));
  expect(getEnabledModulesForCompany).toHaveBeenCalledWith('ACME');
});
it('rejects unauthenticated or tenantless reads before querying overview data', async () => {
  const req = request(), res = response(); req.user = undefined;
  await dashboardController.getBusinessOverview(req, res as unknown as Response);
  expect(res.status).toHaveBeenCalledWith(401);
  const tenantless = request(); tenantless.user!.companyCode = undefined;
  await dashboardController.getBusinessOverview(tenantless, res as unknown as Response);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(getBusinessOverview).not.toHaveBeenCalled();
});
it('rejects reversed custom dates before any aggregate is queried', async () => {
  const req = request(), res = response(); req.query.startDate = '2026-11-01';
  await dashboardController.getBusinessOverview(req, res as unknown as Response);
  expect(res.status).toHaveBeenCalledWith(400); expect(getBusinessOverview).not.toHaveBeenCalled();
});
it('rejects impossible calendar days rather than silently rolling into another month', async () => {
  const req = request(), res = response(); req.query.startDate = '2026-02-30'; req.query.endDate = '2026-03-05';
  await dashboardController.getBusinessOverview(req, res as unknown as Response);
  expect(res.status).toHaveBeenCalledWith(400); expect(getBusinessOverview).not.toHaveBeenCalled();
});
