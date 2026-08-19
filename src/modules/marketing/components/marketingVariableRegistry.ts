import type { MarketingAutomationType } from "../api/marketing.api";

export const MARKETING_VARIABLE_REGISTRY: Record<string, { label: string; sample: string; types: MarketingAutomationType[] }> = {
  customerName: { label: "Tên khách hàng", sample: "Chị Nguyễn Thu Lan", types: ["thank_you", "birthday", "holiday", "remarketing"] },
  companyName: { label: "Tên cửa hàng", sample: "Cửa hàng iGen", types: ["thank_you", "birthday", "holiday", "remarketing"] },
  orderCode: { label: "Mã đơn hàng", sample: "DH-2026-0158", types: ["thank_you"] },
  orderTotal: { label: "Tổng tiền đơn", sample: "1.250.000 ₫", types: ["thank_you"] },
  holidayName: { label: "Tên dịp lễ", sample: "Tết Nguyên Đán", types: ["holiday"] },
  campaignName: { label: "Tên chiến dịch", sample: "Ưu đãi Tết 2026", types: ["holiday"] },
  lastPurchaseDate: { label: "Ngày mua gần nhất", sample: "2026-01-15", types: ["remarketing"] },
  inactiveDays: { label: "Số ngày chưa quay lại", sample: "90", types: ["remarketing"] },
};

export function getVariablesForType(type: MarketingAutomationType) {
  return Object.entries(MARKETING_VARIABLE_REGISTRY)
    .filter(([, value]) => value.types.includes(type))
    .map(([key]) => key);
}
