const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: VIETNAM_TIME_ZONE,
});

const longDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: VIETNAM_TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  timeZone: VIETNAM_TIME_ZONE,
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
});

export const formatChatTime = (date: Date) => timeFormatter.format(date);
export const formatChatLongDate = (date: Date) => longDateFormatter.format(date);
export const formatChatShortDate = (date: Date) => shortDateFormatter.format(date);
export const isSameChatDay = (first: Date, second: Date) => dayKeyFormatter.format(first) === dayKeyFormatter.format(second);
