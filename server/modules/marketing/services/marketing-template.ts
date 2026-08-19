import type { MarketingAutomationType } from "../permissions";

export type MarketingVariables = {
  customerName: string;
  companyName: string;
  orderCode: string;
  orderTotal: string;
  holidayName: string;
  campaignName: string;
  lastPurchaseDate: string;
  inactiveDays: string;
};

export const MARKETING_VARIABLE_KEYS = [
  "customerName", "companyName", "orderCode", "orderTotal",
  "holidayName", "campaignName", "lastPurchaseDate", "inactiveDays",
] as const;

export function emptyVariables(): MarketingVariables {
  return { customerName: "", companyName: "", orderCode: "", orderTotal: "", holidayName: "", campaignName: "", lastPurchaseDate: "", inactiveDays: "" };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

/** Thay biến {{ten_bien}}; biến lạ bị từ chối để tránh gửi tin lỗi hàng loạt. */
export function renderMarketingTemplate(template: string, variables: MarketingVariables): string {
  const unknown = [...String(template).matchAll(/{{\s*([^}]+?)\s*}}/g)]
    .map((match) => match[1].trim())
    .filter((key) => !(MARKETING_VARIABLE_KEYS as readonly string[]).includes(key));
  if (unknown.length) throw new Error(`MARKETING_UNKNOWN_VARIABLE:${unknown[0]}`);
  return String(template).replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_, key: keyof MarketingVariables) => escapeHtml(variables[key] ?? ""));
}

export const DEFAULT_TEMPLATES: Record<MarketingAutomationType, { subject: string; html: string }> = {
  thank_you: {
    subject: "Cảm ơn quý khách đã mua hàng tại {{companyName}}",
    html: "<p>Chào {{customerName}},</p><p>{{companyName}} cảm ơn quý khách đã tin tưởng mua hàng. Đơn hàng <b>{{orderCode}}</b> trị giá <b>{{orderTotal}}</b> đã được xuất hoá đơn.</p><p>Rất mong được phục vụ quý khách lần sau!</p>",
  },
  birthday: {
    subject: "Chúc mừng sinh nhật {{customerName}}!",
    html: "<p>Chào {{customerName}},</p><p>{{companyName}} kính chúc quý khách một ngày sinh nhật thật vui vẻ và hạnh phúc.</p><p>Cảm ơn quý khách đã đồng hành cùng chúng tôi!</p>",
  },
  holiday: {
    subject: "{{companyName}} chúc mừng {{holidayName}}",
    html: "<p>Chào {{customerName}},</p><p>Nhân dịp {{holidayName}}, {{companyName}} kính chúc quý khách và gia đình thật nhiều sức khoẻ và may mắn.</p>",
  },
  remarketing: {
    subject: "{{companyName}} nhớ quý khách!",
    html: "<p>Chào {{customerName}},</p><p>Đã {{inactiveDays}} ngày kể từ lần mua gần nhất của quý khách ({{lastPurchaseDate}}). {{companyName}} rất mong được phục vụ quý khách trở lại.</p>",
  },
};
