import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailScope, RetailSettings } from "../types";

const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });

export const retailSettingsApi = {
  async get(scope: RetailScope): Promise<RetailSettings> {
    const response = await apiFetch<{ success: true; data: RetailSettings }>("/retail/settings", { params: params(scope) });
    return response.data;
  },
  async update(input: Omit<RetailSettings, "companyCode" | "branchId">, scope: RetailScope): Promise<RetailSettings> {
    const response = await apiFetch<{ success: true; data: RetailSettings }>("/retail/settings", {
      method: "PUT",
      params: params(scope),
      body: JSON.stringify(input),
    });
    return response.data;
  },
};
