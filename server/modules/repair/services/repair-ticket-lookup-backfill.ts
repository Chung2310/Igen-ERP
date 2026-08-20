import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizePhone } from "../../customer-management/customer-normalization";

const normalizeCode = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text ? normalizeSerialNumber(text) : "";
};

/** Tạo đúng các trường còn thiếu để migration không ghi đè dữ liệu đã chuẩn hoá. */
export function buildRepairTicketLookupBackfill(ticket: any): Record<string, string> {
  const set: Record<string, string> = {};
  const serial = normalizeCode(ticket?.device?.serialNumber);
  const imei = normalizeCode(ticket?.device?.imei) || serial;
  const phone = normalizePhone(ticket?.customerPhone);

  if (!String(ticket?.device?.normalizedImei || "").trim() && imei) set["device.normalizedImei"] = imei;
  if (!String(ticket?.device?.normalizedSerialNumber || "").trim() && serial) set["device.normalizedSerialNumber"] = serial;
  if (!String(ticket?.normalizedCustomerPhone || "").trim() && phone) set.normalizedCustomerPhone = phone;
  return set;
}
