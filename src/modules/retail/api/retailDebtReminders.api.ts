import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailScope } from "../types";
const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });
export const retailDebtRemindersApi = {
  async listRuns(scope: RetailScope) { return (await apiFetch<any>("/retail/debt-reminders/runs", { params: params(scope) })).data; },
  async getRun(id: string, scope: RetailScope) { return (await apiFetch<any>(`/retail/debt-reminders/runs/${id}`, { params: params(scope) })).data; },
  async runNow(scope: RetailScope) { return (await apiFetch<any>("/retail/debt-reminders/run", { method: "POST", params: params(scope) })).data; },
  async retry(id: string, scope: RetailScope) { return (await apiFetch<any>(`/retail/debt-reminders/deliveries/${id}/retry`, { method: "POST", params: params(scope) })).data; },
};
