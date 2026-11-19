import type { TelecomCustomerInfo } from "../../../../../shared/marketing-suite/telecom-invoice";
import { invoiceFieldName } from "./telecom-invoice-profile";

export const customerColumns = {
  contract: ["so hd", "ma hd", "so hop dong", "ma hop dong", "contract number", "contract code", "contract"],
  account: ["ma khach hang acc", "ma khach hang account", "ma khach hang", "ma thue bao", "so thue bao", "thue bao", "account", "subscriber code", "telecom subscriber code"],
  provider: ["nha mang", "provider", "contract provider"],
  customerName: ["ten khach hang", "ho va ten", "ho ten", "customer name", "name"],
  address: ["dia chi", "dia chi lap dat", "dia chi khach hang", "address"],
  services: ["dich vu", "services", "service"],
  activatedAt: ["online", "moc hoa mang kich hoat", "moc hoa mang", "ngay hoa mang", "ngay kich hoat", "activated at"],
  periods: ["thoi gian", "ky doi soat", "ky cuoc", "billing period"],
  activationMonth: ["thang hm", "thang hoa mang"],
  activationYear: ["nam hm", "nam hoa mang"],
} as const;
export type CustomerColumn = keyof typeof customerColumns;
export function customerColumn(value: string): CustomerColumn | undefined {
  const label = invoiceFieldName(value);
  return (Object.keys(customerColumns) as CustomerColumn[]).find(key => (customerColumns[key] as readonly string[]).includes(label));
}
export function customerText(value: string) { return invoiceFieldName(value); }
export function serviceName(value: string) {
  const text = customerText(value);
  if (/\b(?:internet|fiber|ftth|gpon)\b/.test(text)) return "internet";
  if (/\b(?:mytv|truyen hinh)\b/.test(text)) return "truyen hinh";
  return text;
}
export function serviceValues(value: string) { return [...new Set(value.split(/[;,\n]+/).map(part => part.trim()).filter(Boolean))]; }
export function customerDate(value: string): string | undefined {
  let match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) {
    const full = value.trim().match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    const month = value.trim().match(/^(\d{1,2})[/.](\d{4})$/);
    if (full) match = [full[0], full[3], full[2].padStart(2, "0"), full[1].padStart(2, "0")];
    else if (month) match = [month[0], month[2], month[1].padStart(2, "0")];
  }
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return;
  if (match[3]) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.getUTCDate() !== Number(match[3]) || date.getUTCMonth() !== Number(match[2]) - 1) return;
  }
  return `${match[1]}-${match[2]}${match[3] ? `-${match[3]}` : ""}`;
}
export function sameCustomerDate(left: string, right: string) {
  const a = customerDate(left), b = customerDate(right);
  return a && b ? a.slice(0, Math.min(a.length, b.length)) === b.slice(0, Math.min(a.length, b.length)) : customerText(left) === customerText(right);
}
export function infoValue(info: TelecomCustomerInfo, key: keyof TelecomCustomerInfo) {
  const value = info[key]; return Array.isArray(value) ? value.join("; ") : value || "";
}

export function periodKeys(values: string[]) {
  return [...new Set(values.flatMap(value => {
    const plain = customerText(value);
    const quarter = plain.match(/^(?:quy|q)\s*([1-4])\s+(\d{4})$/);
    if (quarter) return [0, 1, 2].map(offset => `${quarter[2]}-${String((Number(quarter[1]) - 1) * 3 + offset + 1).padStart(2, "0")}`);
    const dates = [...value.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)];
    if (dates.length) {
      const start = Number(dates[0][3]) * 12 + Number(dates[0][2]) - 1;
      const last = dates.at(-1)!;
      const end = Number(last[3]) * 12 + Number(last[2]) - 1;
      if (end >= start && end - start <= 36) return Array.from({ length: end - start + 1 }, (_, offset) => {
        const index = start + offset;
        return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
      });
    }
    const month = customerDate(value);
    return [month ? month.slice(0, 7) : plain];
  }))].sort();
}
