import { superAdminRequest as request } from "./superAdminRequest";

export const superAdminDashboardService = {
  getSummary: (startDate?: string, endDate?: string) => {
    let url = "/api/v1/super-admin/dashboard/summary";
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    return request(url, { method: "GET" }).then((r) => r.data);
  },
};
