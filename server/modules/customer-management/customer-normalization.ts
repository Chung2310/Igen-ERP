import { CustomerError } from "./customer-errors";
import type { CustomerGender, CustomerInput, CustomerSource, CustomerStatus, CustomerType } from "./interfaces/customer.interface";

const CUSTOMER_TYPES = new Set<CustomerType>(["regular", "vat"]);
const CUSTOMER_GENDERS = new Set<CustomerGender>(["male", "female", "other"]);
const CUSTOMER_STATUSES = new Set<CustomerStatus>(["active", "inactive"]);
const CUSTOMER_SOURCES = new Set<CustomerSource>(["manual", "pos", "import"]);

const optional = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

export function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeDateOfBirth(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new CustomerError("CUSTOMER_DATE_OF_BIRTH_INVALID", "Ngày sinh không hợp lệ.");
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text) {
    throw new CustomerError("CUSTOMER_DATE_OF_BIRTH_INVALID", "Ngày sinh không hợp lệ.");
  }
  return date;
}

export function normalizeCustomerInput(input: CustomerInput | Record<string, unknown>) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new CustomerError("CUSTOMER_NAME_REQUIRED", "Tên khách hàng là bắt buộc.");

  const phone = String(input.phone ?? "").trim();
  const normalizedPhone = normalizePhone(phone);
  if (!phone || !normalizedPhone) throw new CustomerError("CUSTOMER_PHONE_REQUIRED", "Số điện thoại là bắt buộc.");

  const type = String(input.type ?? "regular") as CustomerType;
  if (!CUSTOMER_TYPES.has(type)) throw new CustomerError("CUSTOMER_TYPE_INVALID", "Loại khách hàng không hợp lệ.");

  const genderText = optional(input.gender);
  const gender = genderText as CustomerGender | undefined;
  if (gender && !CUSTOMER_GENDERS.has(gender)) throw new CustomerError("CUSTOMER_GENDER_INVALID", "Giới tính không hợp lệ.");

  const status = String(input.status ?? "active") as CustomerStatus;
  if (!CUSTOMER_STATUSES.has(status)) throw new CustomerError("CUSTOMER_STATUS_INVALID", "Trạng thái khách hàng không hợp lệ.");

  const sourceText = optional(input.source);
  const source = sourceText as CustomerSource | undefined;
  if (source && !CUSTOMER_SOURCES.has(source)) throw new CustomerError("CUSTOMER_SOURCE_INVALID", "Nguồn khách hàng không hợp lệ.");

  const email = optional(input.email)?.toLowerCase();
  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth);
  const address = optional(input.address);
  const notes = optional(input.notes);

  return {
    name,
    phone,
    normalizedPhone,
    ...(email ? { email } : {}),
    ...(dateOfBirth ? { dateOfBirth } : {}),
    ...(gender ? { gender } : {}),
    ...(address ? { address } : {}),
    ...(notes ? { notes } : {}),
    type,
    status,
    ...(source ? { source } : {}),
  };
}

export function formatCustomerCode(companyCode: string, sequence: number): string {
  return `KH-${companyCode.trim().toUpperCase()}-${String(sequence).padStart(6, "0")}`;
}
