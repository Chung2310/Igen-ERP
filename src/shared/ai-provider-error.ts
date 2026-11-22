export const AI_PROVIDER_TEMPORARY_ERROR = "Dịch vụ AI hiện không xử lý được yêu cầu. Quản trị viên vui lòng kiểm tra tín dụng hoặc hạn mức API AI rồi thử lại.";

/** Only provider billing failures are hidden; customer plan limits stay explicit. */
export function isAiProviderBillingError(message: string): boolean {
  return /(?:insufficient|not enough) (?:funds|credits?|balance)|credit balance|open\s*router.{0,100}không đủ số dư|tài khoản hoặc gói AI không đủ hạn mức/i.test(message);
}
