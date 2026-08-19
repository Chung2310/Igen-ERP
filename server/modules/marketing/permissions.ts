export const MARKETING_READ_PERMISSION = "marketing:read";
export const MARKETING_MANAGE_PERMISSION = "marketing:manage";

/** Các loại tin nhắn tự động của module marketing. */
export const MARKETING_AUTOMATION_TYPES = ["thank_you", "birthday", "holiday", "remarketing"] as const;
export type MarketingAutomationType = (typeof MARKETING_AUTOMATION_TYPES)[number];

/** Kênh gửi. Hiện chỉ "email" đã nối thật, các kênh còn lại là khung chờ tích hợp. */
export const MARKETING_CHANNELS = ["email", "sms", "zalo", "tiktok"] as const;
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];
