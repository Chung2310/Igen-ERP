import React, { useState, useEffect } from "react";
import { toast } from "../../../../../pages/Toast";
import { useAuth } from "../../../../../context/AuthContext";
import { useAdminCenters } from "../../../hooks/useAdminCenters";
import { apiFetch } from "../../../lib/api";
import {
  ErpModal,
  ErpField,
  ErpInput,
  ErpSelect,
  ErpSubmitButton,
} from "../../../components/Erp/ErpUI";
import { formatVND } from "../../../lib/utils";
import { Loader2 } from "lucide-react";
import { Partner } from "../../../types";
import { CustomFieldsSection } from "../../../custom-fields/CustomFieldsSection";
import type { CustomFieldValues } from "../../../custom-fields/types";
import {
  useStandardFields,
  getAdaptedFieldDefinition,
  type StandardFieldConfig,
} from "../../../hooks/useStandardFields";
import { CustomFieldEditorModal } from "../../../custom-fields/CustomFieldEditorModal";
import { canManageCustomFields } from "../../../custom-fields/permissions";
import type {
  CreateFieldInput,
  FieldDefinition,
} from "../../../custom-fields/types";
import { useEntityLabel } from "../../../hooks/useEntityLabel";
import { useBranch } from "../../../../../context/BranchContext";
import { buildPartnerBranchHeaders } from "../partnerBranchScope";

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partner?: Partner;
}

export function AddPartnerModal({
  isOpen,
  onClose,
  onSuccess,
  partner,
}: AddPartnerModalProps) {
  const entityLabel = useEntityLabel();
  const { userProfile: user } = useAuth();
  const { activeBranchId } = useBranch();
  const {
    fields: stdFields,
    activeFields: activeStdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField,
  } = useStandardFields("partners");

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] =
    useState<FieldDefinition | null>(null);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "partners"));
    setStdEditorOpen(true);
  };

  const handleStdFieldSubmit = (input: CreateFieldInput) => {
    if (editingStdField) {
      updateStdField(editingStdField.key, {
        label: input.label,
        placeholder: input.placeholder,
        isRequired: input.isRequired,
        isVisible: input.isVisible,
      });
    }
  };

  const archiveStd = (field: StandardFieldConfig) => {
    if (window.confirm(`Lưu trữ trường “${field.label}”?`)) {
      archiveStdField(field.key);
    }
  };

  const deleteStd = (field: StandardFieldConfig) => {
    if (window.confirm(`Xóa vĩnh viễn trường “${field.label}”?`)) {
      deleteStdField(field.key);
    }
  };

  const [isEditingFields, setIsEditingFields] = useState(false);

  const renderFieldActions = (fieldKey: string) => {
    if (!manageable || !isEditingFields) return null;
    const fieldConfig = stdFields.find((f) => f.key === fieldKey);
    if (!fieldConfig) return null;
    return (
      <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 opacity-60 hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="hover:text-cyan-600 transition-colors"
          onClick={() => openEditStdField(fieldConfig)}
        >
          Sửa
        </button>
        <span>|</span>
        <button
          type="button"
          className="hover:text-cyan-600 transition-colors"
          onClick={() => archiveStd(fieldConfig)}
        >
          Lưu trữ
        </button>
        <span>|</span>
        <button
          type="button"
          className="text-rose-500 hover:text-rose-600 transition-colors"
          onClick={() => deleteStd(fieldConfig)}
        >
          Xóa
        </button>
      </div>
    );
  };

  const isFieldVisible = (fieldKey: string) => {
    const fieldConfig = stdFields.find((f) => f.key === fieldKey);
    return fieldConfig
      ? fieldConfig.isVisible && !fieldConfig.isArchived
      : true;
  };
  const getFieldLabel = (fieldKey: string, defaultLabel: string) => {
    const fieldConfig = stdFields.find((f) => f.key === fieldKey);
    return fieldConfig ? fieldConfig.label : defaultLabel;
  };
  const getFieldPlaceholder = (
    fieldKey: string,
    defaultPlaceholder: string,
  ) => {
    const fieldConfig = stdFields.find((f) => f.key === fieldKey);
    return fieldConfig
      ? fieldConfig.placeholder || defaultPlaceholder
      : defaultPlaceholder;
  };
  const isFieldRequired = (fieldKey: string, defaultRequired = false) => {
    const fieldConfig = stdFields.find((f) => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isRequired : defaultRequired;
  };
  const { centers } = useAdminCenters();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    commissionType: "fixed" as "fixed" | "percentage",
    commissionValue: "",
    bankName: "",
    bankAccountNo: "",
    bankAccountName: "",
    isActive: true,
    notes: "",
    centerId: "",
    customFields: {} as CustomFieldValues,
  });

  useEffect(() => {
    setTimeout(() => {
      if (partner) {
        setFormData({
          name: partner.name || "",
          phone: partner.phone || "",
          email: partner.email || "",
          commissionType: partner.commissionType || "fixed",
          commissionValue:
            partner.commissionType === "fixed"
              ? formatVND(String(partner.commissionValue))
              : String(partner.commissionValue),
          bankName: partner.bankName || "",
          bankAccountNo: partner.bankAccountNo || "",
          bankAccountName: partner.bankAccountName || "",
          isActive: partner.isActive !== false,
          notes: partner.notes || "",
          centerId: partner.ownerId || "",
          customFields: partner.customFields || {},
        });
      } else {
        setFormData({
          name: "",
          phone: "",
          email: "",
          commissionType: "fixed",
          commissionValue: "",
          bankName: "",
          bankAccountNo: "",
          bankAccountName: "",
          isActive: true,
          notes: "",
          centerId: "",
          customFields: {},
        });
      }
    }, 0);
  }, [partner, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === "name" && !formData.name.trim())
          missingFields.push(f.label);
        if (f.key === "phone" && !formData.phone.trim())
          missingFields.push(f.label);
        if (f.key === "email" && !formData.email.trim())
          missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      toast.error(
        `Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(", ")}`,
      );
      return;
    }

    if (user?.role === "superadmin" && !partner && !formData.centerId) {
      toast.error("Vui lòng chọn trung tâm quản lý cho đối tác này.");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = partner ? `/partners/${partner._id}` : "/partners";
      const method = partner ? "PATCH" : "POST";

      const payload = {
        ...(partner ? { expectedVersion: partner.__v } : {}),
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        bankName: formData.bankName,
        bankAccountNo: formData.bankAccountNo,
        bankAccountName: formData.bankAccountName,
        isActive: formData.isActive,
        notes: formData.notes,
        customFields: formData.customFields,
        ...(user?.role === "superadmin" && !partner
          ? { centerId: formData.centerId }
          : {}),
      };

      const res = await apiFetch(url, {
        method,
        headers: buildPartnerBranchHeaders(activeBranchId),
        body: JSON.stringify(payload),
      });

      if (res.success) {
        toast.success(
          partner
            ? "Đã cập nhật thông tin đối tác thành công!"
            : "Đã thêm đối tác mới thành công!",
        );
        onSuccess();
        onClose();
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi lưu thông tin đối tác.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <ErpModal
        title={partner ? "Cập nhật đối tác" : "Thêm đối tác mới"}
        onClose={onClose}
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 text-left grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"
        >
          {user?.role === "superadmin" && !partner && (
            <div className="md:col-span-2">
              <ErpField label="Trung tâm quản lý *">
                <ErpSelect
                  name="centerId"
                  value={formData.centerId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Chọn trung tâm quản lý --</option>
                  {centers.map((center) => (
                    <option key={center.uid} value={center.uid}>
                      {center.displayName} ({center.email})
                    </option>
                  ))}
                </ErpSelect>
              </ErpField>
            </div>
          )}

          {isFieldVisible("name") && (
            <div className="relative group/std">
              {renderFieldActions("name")}
              <ErpField
                label={getFieldLabel("name", "Tên đối tác / Cộng tác viên")}
              >
                <ErpInput
                  name="name"
                  required={isFieldRequired("name", true)}
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={getFieldPlaceholder(
                    "name",
                    "Nhập tên đối tác...",
                  )}
                />
              </ErpField>
            </div>
          )}

          {isFieldVisible("phone") && (
            <div className="relative group/std">
              {renderFieldActions("phone")}
              <ErpField label={getFieldLabel("phone", "Số điện thoại")}>
                <ErpInput
                  name="phone"
                  required={isFieldRequired("phone", true)}
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder={getFieldPlaceholder(
                    "phone",
                    "Nhập số điện thoại...",
                  )}
                />
              </ErpField>
            </div>
          )}

          {isFieldVisible("email") && (
            <div className="relative group/std">
              {renderFieldActions("email")}
              <ErpField label={getFieldLabel("email", "Email")}>
                <ErpInput
                  name="email"
                  type="email"
                  required={isFieldRequired("email", false)}
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={getFieldPlaceholder(
                    "email",
                    "Nhập địa chỉ email...",
                  )}
                />
              </ErpField>
            </div>
          )}

          <ErpField label="Trạng thái hoạt động">
            <ErpSelect
              name="isActive"
              value={formData.isActive ? "true" : "false"}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  isActive: e.target.value === "true",
                }))
              }
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Ngưng hoạt động</option>
            </ErpSelect>
          </ErpField>

          <div className="md:col-span-2 border-t border-slate-100 my-2 pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Quy tắc tính hoa hồng
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Hệ thống sẽ tự động xếp cấp bậc (Level) hoa hồng cho đối tác dựa
              trên tổng{" "}
              {entityLabel.preset === "worker"
                ? "giá trị tuyển dụng"
                : entityLabel.preset === "customer"
                  ? "giá trị dịch vụ"
                  : "doanh số học phí"}{" "}
              tích lũy mà họ giới thiệu được. Tỷ lệ hoa hồng (%) sẽ thay đổi
              tương ứng theo từng mốc cấu hình chung.
            </p>
          </div>

          <div className="md:col-span-2 border-t border-slate-100 my-2 pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Tài khoản ngân hàng chi trả
            </h4>
          </div>

          <ErpField label="Ngân hàng (VietQR)">
            <ErpSelect
              name="bankName"
              value={formData.bankName}
              onChange={handleInputChange}
            >
              <option value="">-- Chọn ngân hàng --</option>
              <option value="mbbank">MBBank (MB)</option>
              <option value="vietcombank">Vietcombank (VCB)</option>
              <option value="techcombank">Techcombank (TCB)</option>
              <option value="vietinbank">Vietinbank (CTG)</option>
              <option value="bidv">BIDV</option>
              <option value="agribank">Agribank (VBA)</option>
              <option value="acb">ACB</option>
              <option value="sacombank">Sacombank (STB)</option>
              <option value="tpbank">TPBank (TPB)</option>
              <option value="vpbank">VPBank (VPB)</option>
            </ErpSelect>
          </ErpField>

          <ErpField label="Số tài khoản">
            <ErpInput
              name="bankAccountNo"
              value={formData.bankAccountNo}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bankAccountNo: e.target.value.replace(/\D/g, ""),
                }))
              }
              placeholder="Nhập số tài khoản..."
            />
          </ErpField>

          <ErpField label="Tên chủ tài khoản">
            <ErpInput
              name="bankAccountName"
              value={formData.bankAccountName}
              onChange={handleInputChange}
              placeholder="Nhập tên chủ tài khoản (viết hoa không dấu)..."
            />
          </ErpField>

          <ErpField label="Ghi chú">
            <ErpInput
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Ghi chú thêm về đối tác này..."
            />
          </ErpField>

          <div className="md:col-span-2">
            <CustomFieldsSection
              moduleKey="partners"
              values={formData.customFields}
              onChange={(customFields) =>
                setFormData((previous) => ({ ...previous, customFields }))
              }
              mode={partner ? "edit" : "create"}
              disabled={isSubmitting}
              tenantId={formData.centerId || partner?.ownerId}
              isEditingFields={isEditingFields}
              onToggleEditingFields={setIsEditingFields}
            />
          </div>

          {manageable && archivedStdFields.length ? (
            <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-4 text-left">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Trường mặc định đã lưu trữ
              </h4>
              <ul className="mt-2 divide-y divide-slate-100">
                {archivedStdFields.map((field) => (
                  <li
                    key={field.key}
                    className="flex items-center justify-between py-2 text-xs text-slate-600"
                  >
                    <span>{field.label}</span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className="font-bold text-cyan-600 hover:text-cyan-700 disabled:opacity-50 transition-colors cursor-pointer"
                      aria-label={`Khôi phục ${field.label}`}
                      onClick={() => restoreStdField(field.key)}
                    >
                      Khôi phục
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="md:col-span-2 mt-4">
            <ErpSubmitButton disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </span>
              ) : partner ? (
                "Cập nhật đối tác"
              ) : (
                "Khai báo đối tác"
              )}
            </ErpSubmitButton>
          </div>
        </form>
      </ErpModal>

      <CustomFieldEditorModal
        open={stdEditorOpen}
        moduleKey="partners"
        initialField={editingStdField}
        onClose={() => setStdEditorOpen(false)}
        onSubmit={handleStdFieldSubmit}
        isStandard={true}
      />
    </>
  );
}
