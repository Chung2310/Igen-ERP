import { getWorkerAccessToken, workerApiFetch } from "../../api/client";
import type { WorkerScope } from "../../types";
import type { CommissionPolicy, LaborPartner, LaborPartnerKpiRow, LaborPartnerOverview, LaborPartnerPayout, LaborPartnerReportSummary, LaborPartnerSettlement, SettlementDetail, SettlementFilters, WorkerReferral } from "../types";

const base = "/worker-management/partners";
const scopeParams = (scope: WorkerScope) => ({ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) });

export const laborPartnersApi = {
  async list(scope: WorkerScope) { return (await workerApiFetch<{ success: true; data: { items: LaborPartner[] } }>(base, { params: scopeParams(scope) })).data.items; },
  async create(scope: WorkerScope, input: Partial<LaborPartner>) { return (await workerApiFetch<{ success: true; data: LaborPartner }>(base, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async update(scope: WorkerScope, id: string, input: Partial<LaborPartner>) { return (await workerApiFetch<{ success: true; data: LaborPartner }>(`${base}/${id}`, { method: "PATCH", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async remove(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: LaborPartner }>(`${base}/${id}`, { method: "DELETE", params: scopeParams(scope) })).data; },
  async overview(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: LaborPartnerOverview }>(`${base}/${id}/overview`, { params: scopeParams(scope) })).data; },
  async listPolicies(scope: WorkerScope) { return (await workerApiFetch<{ success: true; data: CommissionPolicy[] }>(`${base}/policies`, { params: scopeParams(scope) })).data; },
  async listKpi(scope: WorkerScope, periodAnchor: string) { return (await workerApiFetch<{ success: true; data: { periodStart: string; periodEnd: string; items: LaborPartnerKpiRow[] } }>(`${base}/kpi`, { params: { ...scopeParams(scope), periodAnchor } })).data; },
  async saveKpi(scope: WorkerScope, partnerId: string, input: { periodAnchor: string; targetReferrals: number; note?: string }) { return (await workerApiFetch<{ success: true; data: unknown }>(`${base}/kpi/${partnerId}`, { method: "PUT", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async createPolicy(scope: WorkerScope, input: Omit<CommissionPolicy, "_id" | "version" | "status">) { return (await workerApiFetch<{ success: true; data: CommissionPolicy }>(`${base}/policies`, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async updatePolicy(scope: WorkerScope, id: string, input: Omit<CommissionPolicy, "_id" | "version" | "status">) { return (await workerApiFetch<{ success: true; data: CommissionPolicy }>(`${base}/policies/${id}`, { method: "PATCH", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async activatePolicy(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: CommissionPolicy }>(`${base}/policies/${id}/activate`, { method: "POST", params: scopeParams(scope) })).data; },
  async retirePolicy(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: CommissionPolicy }>(`${base}/policies/${id}/retire`, { method: "POST", params: scopeParams(scope) })).data; },
  async removePolicy(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: CommissionPolicy }>(`${base}/policies/${id}`, { method: "DELETE", params: scopeParams(scope) })).data; },
  async clonePolicy(scope: WorkerScope, id: string, input: { effectiveFrom: string; name?: string }) { return (await workerApiFetch<{ success: true; data: CommissionPolicy }>(`${base}/policies/${id}/clone`, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async listReferrals(scope: WorkerScope, partnerId: string) { return (await workerApiFetch<{ success: true; data: WorkerReferral[] }>(`${base}/${partnerId}/referrals`, { params: scopeParams(scope) })).data; },
  async createReferral(scope: WorkerScope, partnerId: string, input: Omit<WorkerReferral, "_id" | "partnerId" | "status">) { return (await workerApiFetch<{ success: true; data: WorkerReferral }>(`${base}/${partnerId}/referrals`, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async confirmReferral(scope: WorkerScope, partnerId: string, referralId: string) { return (await workerApiFetch<{ success: true; data: WorkerReferral }>(`${base}/${partnerId}/referrals/${referralId}/confirm`, { method: "POST", params: scopeParams(scope) })).data; },
  async endReferral(scope: WorkerScope, partnerId: string, referralId: string, effectiveTo: string) { return (await workerApiFetch<{ success: true; data: WorkerReferral }>(`${base}/${partnerId}/referrals/${referralId}/end`, { method: "POST", params: scopeParams(scope), body: JSON.stringify({ effectiveTo }) })).data; },
  async calculateSettlement(scope: WorkerScope, input: { partnerId: string; periodAnchor: string; manualEntries?: Array<{ referralId: string; officialMonths?: number; seasonalHours?: number }> }) { return (await workerApiFetch<{ success: true; data: unknown }>(`${base}/settlements/calculate`, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async listSettlements(scope: WorkerScope, filters: SettlementFilters = {}) { return (await workerApiFetch<{ success: true; data: LaborPartnerSettlement[] }>(`${base}/settlements`, { params: { ...scopeParams(scope), ...filters } })).data; },
  async settlementDetail(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: SettlementDetail }>(`${base}/settlements/${id}`, { params: scopeParams(scope) })).data; },
  async recalculateSettlement(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: unknown }>(`${base}/settlements/${id}/recalculate`, { method: "POST", params: scopeParams(scope) })).data; },
  async voidSettlement(scope: WorkerScope, id: string, expectedVersion: number, reason?: string) { return (await workerApiFetch<{ success: true; data: LaborPartnerSettlement }>(`${base}/settlements/${id}/void`, { method: "POST", params: scopeParams(scope), body: JSON.stringify({ expectedVersion, reason }) })).data; },
  async createAdjustment(scope: WorkerScope, id: string, input: { amount: number; reason: string; periodAnchor: string; idempotencyKey: string }) { return (await workerApiFetch<{ success: true; data: unknown }>(`${base}/settlements/${id}/adjustments`, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async approveSettlement(scope: WorkerScope, id: string, expectedVersion: number) { return (await workerApiFetch<{ success: true; data: LaborPartnerSettlement }>(`${base}/settlements/${id}/approve`, { method: "POST", params: scopeParams(scope), body: JSON.stringify({ expectedVersion }) })).data; },
  async createPayout(scope: WorkerScope, id: string, input: { amount: number; method: "cash" | "bank_transfer"; reference?: string; note?: string; idempotencyKey: string }) { return (await workerApiFetch<{ success: true; data: { payout: LaborPartnerPayout; settlement: LaborPartnerSettlement } }>(`${base}/settlements/${id}/payouts`, { method: "POST", params: scopeParams(scope), body: JSON.stringify(input) })).data; },
  async reversePayout(scope: WorkerScope, id: string) { return (await workerApiFetch<{ success: true; data: unknown }>(`${base}/payouts/${id}/reverse`, { method: "POST", params: scopeParams(scope) })).data; },
  async dashboard(scope: WorkerScope, filters: SettlementFilters = {}) { return (await workerApiFetch<{ success: true; data: LaborPartnerReportSummary }>(`${base}/dashboard`, { params: { ...scopeParams(scope), partnerId: filters.partnerId, status: filters.status, scheme: filters.scheme, periodFrom: filters.periodStart, periodTo: filters.periodEnd } })).data; },
  async downloadCommissionReport(scope: WorkerScope, filters: SettlementFilters = {}) {
    const url = new URL(`/api/v1${base}/reports/commission/export`, window.location.origin);
    Object.entries({ ...scopeParams(scope), partnerId: filters.partnerId, status: filters.status, scheme: filters.scheme, periodFrom: filters.periodStart, periodTo: filters.periodEnd }).forEach(([key, value]) => { if (value) url.searchParams.set(key, String(value)); });
    const token = getWorkerAccessToken(); const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error("Không thể xuất báo cáo hoa hồng.");
    const objectUrl = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a");
    anchor.href = objectUrl; anchor.download = "bao-cao-hoa-hong-doi-tac-lao-dong.xlsx"; anchor.click(); URL.revokeObjectURL(objectUrl);
  },
};
