import { getAccessToken } from "./authService";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/payroll${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...(init?.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || "Payroll request failed"), { code: body.code, details: body.details });
  return body.data ?? body;
}

export const payrollService = {
  getFormulas: () => request("/formulas"),
  createFormula: (payload: unknown) => request("/formulas", { method: "POST", body: JSON.stringify(payload) }),
  updateFormula: (id: string, payload: unknown) => request(`/formulas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  cloneFormula: (id: string, code: string) => request(`/formulas/${id}/clone`, { method: "POST", body: JSON.stringify({ code }) }),
  activateFormula: (id: string) => request(`/formulas/${id}/activate`, { method: "POST" }),
  retireFormula: (id: string) => request(`/formulas/${id}/retire`, { method: "POST" }),
  getPeriodInputs: (periodKey: string) => request(`/periods/${periodKey}/inputs`),
  savePeriodInput: (periodKey: string, employeeId: string, payload: unknown) => request(`/periods/${periodKey}/inputs/${employeeId}`, { method: "PUT", body: JSON.stringify(payload) }),
  bulkSavePeriodInputs: (periodKey: string, rows: unknown[]) => request(`/periods/${periodKey}/inputs`, { method: "PUT", body: JSON.stringify({ rows }) }),
  getLineOverrides: (periodKey: string) => request(`/periods/${periodKey}/line-overrides`),
  bulkSaveLineOverrides: (periodKey: string, rows: unknown[]) => request(`/periods/${periodKey}/line-overrides`, { method: "PUT", body: JSON.stringify({ rows }) }),
  getPeriodInputVariables: () => request("/period-input-variables"),
  createPeriodInputVariable: (payload: unknown) => request("/period-input-variables", { method: "POST", body: JSON.stringify(payload) }),
  activatePeriodInputVariable: (id: string) => request(`/period-input-variables/${id}/activate`, { method: "POST" }),
  retirePeriodInputVariable: (id: string) => request(`/period-input-variables/${id}/retire`, { method: "POST" }),
  getPolicies: () => request("/policies"),
  createPolicy: (payload: unknown) => request("/policies", { method: "POST", body: JSON.stringify(payload) }),
  updatePolicy: (id: string, payload: unknown) => request(`/policies/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  clonePolicy: (id: string, payload: { code: string; name?: string; definition?: unknown }) => request(`/policies/${id}/clone`, { method: "POST", body: JSON.stringify(payload) }),
  activatePolicy: (id: string, payload: { replaceOverlaps?: boolean } = {}) => request(`/policies/${id}/activate`, { method: "POST", body: JSON.stringify(payload) }),
  retirePolicy: (id: string) => request(`/policies/${id}/retire`, { method: "POST" }),
  deletePolicy: (id: string) => request(`/policies/${id}`, { method: "DELETE" }),
  getRun: (periodKey: string) => request(`/periods/${periodKey}/run`),
  getLineDetail: (runId: string, employeeId: string) => request(`/runs/${runId}/lines/${employeeId}`),
  getResults: (periodKey: string) => request(`/periods/${periodKey}/results`),
  snapshot: (periodKey: string) => request(`/periods/${periodKey}/snapshot`, { method: "POST" }),
  lock: (periodKey: string) => request(`/periods/${periodKey}/lock`, { method: "POST" }),
  createRun: (periodKey: string) => request(`/periods/${periodKey}/run`, { method: "POST" }),
  processPeriod: (periodKey: string) => request(`/periods/${periodKey}/process`, { method: "POST" }),
  calculateRun: (runId: string, expectedVersion: number) => request(`/runs/${runId}/calculate`, { method: "POST", body: JSON.stringify({ expectedVersion }) }),
  review: (periodKey: string) => request(`/periods/${periodKey}/approve`, { method: "POST" }),
  reviewRun: (runId: string) => request(`/runs/${runId}/review`, { method: "POST" }),
  close: (periodKey: string) => request(`/periods/${periodKey}/close`, { method: "POST" }),
  closeRun: (runId: string) => request(`/runs/${runId}/close`, { method: "POST" }),
  reopen: (runId: string, payload: { expectedVersion: number; reason: string }) => request(`/runs/${runId}/reopen`, { method: "POST", body: JSON.stringify(payload) }),
  markPaid: (runId: string, payload: { expectedVersion: number }) => request(`/runs/${runId}/mark-paid`, { method: "POST", body: JSON.stringify(payload) }),
  reset: (periodKey: string) => request(`/periods/${periodKey}`, { method: "DELETE" }),
  getAdjustments: (periodKey: string) => request(`/periods/${periodKey}/adjustments`),
  createAdjustment: (periodKey: string, payload: any) => request(`/periods/${periodKey}/adjustments`, { method: "POST", body: JSON.stringify(payload) }),
  approveAdjustment: (periodKey: string, adjustmentId: string) => request(`/periods/${periodKey}/adjustments/${adjustmentId}/approve`, { method: "POST" }),
  rejectAdjustment: (periodKey: string, adjustmentId: string) => request(`/periods/${periodKey}/adjustments/${adjustmentId}/reject`, { method: "POST" }),
  getPayments: (runId: string) => request(`/runs/${runId}/payments`),
  createPayment: (runId: string, payload: unknown) => request(`/runs/${runId}/payments`, { method: "POST", body: JSON.stringify(payload) }),
  confirmPayment: (paymentId: string) => request(`/payments/${paymentId}/confirm`, { method: "POST" }),
  cancelPayment: (paymentId: string) => request(`/payments/${paymentId}/cancel`, { method: "POST" }),
  reversePayment: (paymentId: string) => request(`/payments/${paymentId}/reverse`, { method: "POST" }), publishPayslips: (runId: string, employeeIds?: string[]) => request(`/runs/${runId}/payslips/publish`, { method: "POST", body: JSON.stringify({ employeeIds }) }),
  getEmployeePayslips: () => request("/employee/me/payslips"),
  printPayslip: async (runId: string, employeeId: string) => {
    const response = await fetch(`/api/v1/payroll/runs/${runId}/payslips/${employeeId}/print`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Unable to print payslip");
    }
    return response.blob();
  },
  exportWorkbook: async (runId: string, type: "detailed" | "insurance" | "pit" | "bank_transfer") => {
    const response = await fetch(`/api/v1/payroll/runs/${runId}/exports`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify({ type }) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Payroll export failed"); }
    return response.blob();
  },
};
