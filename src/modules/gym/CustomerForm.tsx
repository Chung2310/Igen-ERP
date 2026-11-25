import { useState } from "react";
import type { GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import { Field, FormDialog } from "./ui";
const empty = {
  fullName: "",
  dateOfBirth: "",
  gender: "OTHER",
  phone: "",
  email: "",
  height: "",
  initialWeight: "",
  medicalNotes: "",
  initialGoal: "",
  internalNotes: "",
  status: "ACTIVE",
};
export default function CustomerForm({
  api,
  record,
  initialValues,
  onClose,
  onSaved,
}: {
  api: GymApi;
  record?: GymRecord;
  initialValues?: Record<string, any>;
  onClose: () => void;
  onSaved: (saved?: GymRecord) => void;
}) {
  const [form, setForm] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      Object.keys(empty).map((key) => [
        key,
        record?.[key] ?? initialValues?.[key] ?? empty[key as keyof typeof empty],
      ]),
    ),
  );
  const [dirty, setDirty] = useState(false);
  const field = (
    key: string,
    label: string,
    props: Partial<React.ComponentProps<typeof Field>> = {},
  ) => (
    <Field
      label={label}
      value={form[key]}
      onChange={(value) => {
        setDirty(true);
        setForm({ ...form, [key]: value });
      }}
      {...props}
    />
  );
  return (
    <FormDialog
      title={record ? "Sửa khách hàng" : "Thêm khách hàng"}
      submitLabel={record ? "Lưu thay đổi" : "Tạo khách hàng"}
      dirty={dirty}
      onClose={onClose}
      onSubmit={async () => {
        const saved = await api.save(
          "customers",
          {
            ...form,
            height: form.height === "" ? null : Number(form.height),
            initialWeight:
              form.initialWeight === "" ? null : Number(form.initialWeight),
            dateOfBirth: form.dateOfBirth || null,
            email: form.email || null,
          },
          record,
        );
        onSaved(saved);
      }}
    >
      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold text-on-surface-variant">Thông tin cá nhân</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("fullName", "Họ tên", {
            required: true,
            placeholder: "Nhập họ tên...",
          })}
          {field("dateOfBirth", "Ngày sinh", {
            type: "date",
            max: new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Ho_Chi_Minh",
            }),
          })}
          {field("gender", "Giới tính", {
            options: [
              ["OTHER", "Khác"],
              ["MALE", "Nam"],
              ["FEMALE", "Nữ"],
            ],
          })}
        </div>
      </section>
      <section className="space-y-2.5 border-t border-outline-variant/60 pt-3">
        <h3 className="text-xs font-semibold text-on-surface-variant">Liên hệ</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("phone", "Số điện thoại", {
            required: true,
            placeholder: "VD: 0912345678",
          })}
          {field("email", "Email", {
            type: "email",
            placeholder: "VD: ten@email.com",
          })}
        </div>
      </section>
      <section className="space-y-2.5 border-t border-outline-variant/60 pt-3">
        <h3 className="text-xs font-semibold text-on-surface-variant">Chỉ số và sức khỏe</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("height", "Chiều cao (cm)", {
            type: "number",
            min: 0,
            max: 300,
            placeholder: "172",
          })}
          {field("initialWeight", "Cân nặng ban đầu (kg)", {
            type: "number",
            min: 0,
            max: 600,
            placeholder: "68",
          })}
        </div>
        {field("initialGoal", "Mục tiêu ban đầu", {
          placeholder: "VD: Giảm 5kg mỡ, tăng cơ, cải thiện sức bền...",
        })}
        {field("medicalNotes", "Lưu ý sức khỏe", {
          multiline: true,
          placeholder: "Tiền sử bệnh lý, chấn thương...",
        })}
      </section>
      <section className="space-y-2.5 border-t border-outline-variant/60 pt-3">
        <h3 className="text-xs font-semibold text-on-surface-variant">Quản lý</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            {field("internalNotes", "Ghi chú nội bộ", {
              multiline: true,
              placeholder: "Ghi chú của PT...",
            })}
          </div>
          {field("status", "Trạng thái", {
            options: [
              ["ACTIVE", "Đang hoạt động"],
              ["INACTIVE", "Ngừng hoạt động"],
              ["LEAD", "Tiềm năng"],
            ],
          })}
        </div>
      </section>
    </FormDialog>
  );
}
