const vietnamDateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Legacy catalog fields can declare calendar semantics through their API key. */
export function isAssistantTemporalField(field: { type?: string; key: string; apiKey?: string; pattern?: string }): boolean {
  if (field.type === 'date' || field.type === 'datetime') return true;
  const key = field.apiKey || field.key.replace(/^(?:body|query|path)_/, '');
  return /^(?:date|datetime|registrationDate|birthDate|birthday)$/.test(key)
    || /(?:Date|At)$/.test(key);
}

/** Display ERP calendar values in Vietnamese; never use the server/browser's local timezone. */
export function formatAssistantTemporalValue(value: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) return undefined;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== match[1]) return undefined;
  const day = match[1].split("-").reverse().join("/");
  if (match[2] === undefined) return day;
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59) return undefined;
  // Zone-less date-times describe the local calendar time, rather than a UTC instant.
  if (!match[6]) return `${match[2]}:${match[3]}, ${day}`;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.valueOf())) return undefined;
  const parts = Object.fromEntries(vietnamDateTime.formatToParts(timestamp).map(part => [part.type, part.value]));
  return `${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}`;
}
