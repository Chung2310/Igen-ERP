import { apiFetch } from '../shared/lib/apiFetch';
import { withRequestTimeout } from '../../utils/requestTimeout';
import type { RepairRefundInput, RepairRefundResult, RepairRefundSummary, RepairRefundVoucher } from '../../../shared/repair-refund';

type Scope = { companyCode: string; branchId: string };
const options = (scope: Scope) => ({ params: scope, headers: { 'x-branch-id': scope.branchId } });
export const repairRefundApi = {
  async summary(scope: Scope, id: string, signal?: AbortSignal) {
    return withRequestTimeout(async (requestSignal) => (await apiFetch<{ data: RepairRefundSummary }>(`/repair/tickets/${id}/refunds`, { ...options(scope), signal: requestSignal })).data, 20000, 'Tải khoản hoàn quá lâu. Hãy thử lại.', signal);
  },
  async vouchers(scope: Scope, id: string, signal?: AbortSignal) {
    return withRequestTimeout(async (requestSignal) => (await apiFetch<{ data: RepairRefundVoucher[] }>(`/repair/tickets/${id}/refunds/vouchers`, { ...options(scope), signal: requestSignal })).data, 20000, 'Tải phiếu chi quá lâu. Hãy thử lại.', signal);
  },
  async submit(scope: Scope, id: string, action: 'post' | 'reconcile' | 'revoke', input: RepairRefundInput) {
    return withRequestTimeout(async (signal) => (await apiFetch<{ data: RepairRefundResult }>(`/repair/tickets/${id}/refunds${action === 'post' ? '' : `/${action}`}`, { ...options(scope), signal, method: 'POST', body: JSON.stringify(input) })).data, 30000, 'Chưa rõ kết quả hoàn tiền. Hãy đối chiếu hoặc thử lại nguyên yêu cầu đã lưu.');
  },
};
