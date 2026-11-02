import { SocialIntegrationModel } from "../../../shared/model/social-integration.model.ts";
import type { ChatOrderFlow } from "./core/types";
import { PageChatFlowModel } from "../../model/page-chat-flow.model";
import { pageIntakeFlow } from "./flows/page-intake";
import { bakeryDefaultFlow } from "./flows/bakery-default/index";

const FLOW_MODULES: ReadonlyMap<string, ChatOrderFlow> = new Map([
  [bakeryDefaultFlow.key, bakeryDefaultFlow],
]);

// Assign company codes to a flow key when adding a company-specific module.
const COMPANY_FLOW_ASSIGNMENTS: Readonly<Record<string, string>> = Object.freeze({
  // COMPANY_CODE: "company-flow-key",
});

const DEFAULT_FLOW_KEY = bakeryDefaultFlow.key;

function normalizedCompanyCode(companyCode?: string | null) {
  return String(companyCode || "").trim().toUpperCase();
}

function resolveFlow(companyCode?: string | null) {
  const companyKey = normalizedCompanyCode(companyCode);
  const configuredCompanies = String(process.env.MARKETING_BAKERY_COMPANY_CODES || "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  if (!COMPANY_FLOW_ASSIGNMENTS[companyKey] && !configuredCompanies.includes(companyKey)) return undefined;
  const selectedKey = COMPANY_FLOW_ASSIGNMENTS[companyKey] || DEFAULT_FLOW_KEY;
  return FLOW_MODULES.get(selectedKey) || bakeryDefaultFlow;
}

export const chatOrderFlowRegistry = {
  resolve: resolveFlow,

  async resolveForCompanyPage(companyCode: string, pageId: string) {
    const configured = await PageChatFlowModel.findOne({ companyCode, pageId, status: "active" }).select("flowKey").lean();
    if (configured?.flowKey === "bakery-default") return bakeryDefaultFlow;
    if (configured) return pageIntakeFlow;
    return resolveFlow(companyCode);
  },

  async resolveForPage(pageId: string) {
    const integration = await SocialIntegrationModel.findOne({ platform: "Facebook", username: pageId })
      .select("companyCode")
      .lean();
    return integration?.companyCode ? this.resolveForCompanyPage(integration.companyCode, pageId) : undefined;
  },
};
