export type FinanceReminderSettings = { timeZone: string; reminderIntervalDays: number; maxAttempts: number };
export const DEFAULT_FINANCE_REMINDER_SETTINGS: FinanceReminderSettings = { timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3, maxAttempts: 5 };
