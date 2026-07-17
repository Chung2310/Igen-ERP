import { superAdminRequest as request } from "./superAdminRequest";

export interface AuditFilters {
  actorSuperAdminId?: string;
  effectiveUserId?: string;
  companyCode?: string;
  environment?: string;
  riskClass?: string;
  result?: string;
  actionType?: string;
  correlationId?: string;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  taskId?: string;
  workflowId?: string;
  startDate?: string;
  endDate?: string;
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
