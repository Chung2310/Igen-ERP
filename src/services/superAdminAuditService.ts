async function request(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (init.headers) {
    const initHeaders = init.headers as Record<string, string>;
    Object.keys(initHeaders).forEach((key) => {
      headers[key] = initHeaders[key];
    });
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Yêu cầu thất bại");
  return data;
}

export interface AuditFilters {
  actorSuperAdminId?: string;
  effectiveUserId?: string;
  companyCode?: string;
  environment?: string;
  riskClass?: string;
  result?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  correlationId?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  taskId?: string;
  workflowId?: string;
  tenantId?: string;
}

export const superAdminAuditService = {
  queryEvents: (filters: AuditFilters = {}, page = 1, limit = 20) => {
    let url = "/api/v1/super-admin/audit/events";
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", String(limit));
    
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        params.append(key, String(val));
      }
    });

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    return request(url, { method: "GET" }).then((r) => r.data);
  },
};
