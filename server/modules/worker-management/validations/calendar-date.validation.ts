import Joi from "joi";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function calendarDateSchema(label: string) {
  return Joi.string()
    .pattern(datePattern)
    .custom((value, helpers) => isCalendarDate(value) ? value : helpers.error("date.invalid"))
    .messages({
      "string.pattern.base": `Định dạng ${label} phải là YYYY-MM-DD.`,
      "date.invalid": `${label.charAt(0).toUpperCase()}${label.slice(1)} không tồn tại trên lịch.`,
    });
}
