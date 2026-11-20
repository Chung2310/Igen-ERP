import { apiFetch } from "../../../shared/lib/apiFetch";
import type { LeadDestinationChannel, LeadDestinationSettings, LeadModuleDestination } from "../../../../../shared/marketing-suite/lead-module-destination";

const settingsPath = "/social-integrations/lead-destinations";

export const leadModuleDestinationService = {
  async readSettings(signal?: AbortSignal) {
    const { data } = await apiFetch<{ data: LeadDestinationSettings }>(settingsPath, { signal, cache: "no-store" });
    return data;
  },

  async save(input: Pick<LeadDestinationChannel, "platform" | "accountId" | "targetModule">) {
    const { data } = await apiFetch<{ data: Pick<LeadDestinationChannel, "targetModule"> }>(settingsPath, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    return data;
  },

  async resolveForLead(leadId: string, signal?: AbortSignal) {
    const { data } = await apiFetch<{ data: LeadModuleDestination }>(
      `/omni-inbox/leads/${encodeURIComponent(leadId)}/module-destination`,
      { signal, cache: "no-store" },
    );
    return data;
  },
};
