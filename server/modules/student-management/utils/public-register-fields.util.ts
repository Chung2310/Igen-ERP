import { StandardFieldConfig } from "../models/standard-field-config.model";

/**
 * Các trường học viên tự khai được trên form đăng ký công khai.
 *
 * Popup nội bộ còn có batchId / registrationDate / fee / status, nhưng đó là dữ
 * liệu vận hành do nhân viên nhập nên không đưa ra ngoài.
 */
export const PUBLIC_REGISTER_FIELD_KEYS = [
  "fullName",
  "phone",
  "email",
  "referral",
  "birthday",
  "idCard",
  "enrollmentDate",
  "address",
] as const;

export type PublicRegisterFieldKey = (typeof PUBLIC_REGISTER_FIELD_KEYS)[number];

/**
 * Nhãn mặc định, giữ khớp với DEFAULT_STANDARD_FIELDS.students ở frontend
 * (src/modules/student-management/hooks/useStandardFields.ts). Chỉ dùng để dựng
 * thông báo lỗi phía server khi công ty chưa tùy biến nhãn.
 */
const DEFAULT_PUBLIC_REGISTER_FIELDS: Record<PublicRegisterFieldKey, { label: string; isRequired: boolean }> = {
  fullName: { label: "Họ và tên", isRequired: true },
  phone: { label: "Số điện thoại", isRequired: true },
  email: { label: "Email học viên", isRequired: true },
  referral: { label: "Nguồn giới thiệu", isRequired: false },
  birthday: { label: "Ngày sinh", isRequired: false },
  idCard: { label: "CCCD / CMND", isRequired: false },
  enrollmentDate: { label: "Ngày nhập học", isRequired: false },
  address: { label: "Địa chỉ", isRequired: false },
};

export type ResolvedPublicField = {
  key: PublicRegisterFieldKey;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isVisible: boolean;
};

/** Ghép phần công ty ghi đè lên bộ trường mặc định, đã lọc theo phạm vi công khai. */
export async function resolvePublicRegisterFields(tenantId: string): Promise<ResolvedPublicField[]> {
  const overrides = await StandardFieldConfig.find({
    tenantId,
    moduleKey: "students",
    key: { $in: [...PUBLIC_REGISTER_FIELD_KEYS] },
  }).lean();

  return PUBLIC_REGISTER_FIELD_KEYS.map((key) => {
    const base = DEFAULT_PUBLIC_REGISTER_FIELDS[key];
    const override = overrides.find((row) => row.key === key);
    const alwaysRequired = key === "fullName" || key === "phone" || key === "email";
    const isVisible = alwaysRequired ? true : (override ? override.isVisible && !override.isArchived : true);
    return {
      key,
      label: override?.label || base.label,
      placeholder: override?.placeholder,
      // Trường bị ẩn thì không thể bắt buộc, nếu không học viên sẽ không bao giờ gửi được.
      isRequired: alwaysRequired || (isVisible ? (override ? override.isRequired : base.isRequired) : false),
      isVisible,
    };
  });
}

/**
 * Tên các trường bắt buộc nhưng bị bỏ trống. Họ tên và số điện thoại luôn bắt
 * buộc dù công ty có cấu hình thế nào — thiếu chúng thì bản ghi vô dụng.
 */
export async function findMissingPublicRegisterFields(
  tenantId: string,
  data: Record<string, unknown>,
): Promise<string[]> {
  const fields = await resolvePublicRegisterFields(tenantId);
  return fields
    .filter((field) => {
      const alwaysRequired = field.key === "fullName" || field.key === "phone" || field.key === "email";
      if (!alwaysRequired && (!field.isVisible || !field.isRequired)) return false;
      const value = data[field.key];
      return typeof value !== "string" || value.trim() === "";
    })
    .map((field) => field.label);
}
