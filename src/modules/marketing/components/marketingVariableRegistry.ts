import type { TemplateVariableConfig } from "../../../components/template-editor/templateEditorTypes";
import type { MarketingAutomationType } from "../api/marketing.api";

type MarketingVariableConfig = TemplateVariableConfig & {
  types: MarketingAutomationType[];
};

export const MARKETING_VARIABLE_REGISTRY: Record<string, MarketingVariableConfig> = {
  customerName: { key: "customerName", label: "Tên khách hàng", sample: "Chị Nguyễn Thu Lan", types: ["thank_you", "birthday", "holiday", "remarketing"] },
  companyName: { key: "companyName", label: "Tên cửa hàng", sample: "Cửa hàng iGen", types: ["thank_you", "birthday", "holiday", "remarketing"] },
  orderCode: { key: "orderCode", label: "Mã đơn hàng", sample: "DH-2026-0158", types: ["thank_you"] },
  orderTotal: { key: "orderTotal", label: "Tổng tiền đơn", sample: "1.250.000 ₫", types: ["thank_you"] },
  holidayName: { key: "holidayName", label: "Tên dịp lễ", sample: "Tết Nguyên Đán", types: ["holiday"] },
  campaignName: { key: "campaignName", label: "Tên chiến dịch", sample: "Ưu đãi Tết 2026", types: ["holiday"] },
  lastPurchaseDate: { key: "lastPurchaseDate", label: "Ngày mua gần nhất", sample: "2026-01-15", types: ["remarketing"] },
  inactiveDays: { key: "inactiveDays", label: "Số ngày chưa quay lại", sample: "90", types: ["remarketing"] },
};

export function getVariablesForType(type: MarketingAutomationType) {
  return Object.entries(MARKETING_VARIABLE_REGISTRY)
    .filter(([, value]) => value.types.includes(type))
    .map(([key]) => key);
}
