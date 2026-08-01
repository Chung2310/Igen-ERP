import { useState, useEffect, useCallback } from "react";
import type { ModuleKey, FieldDefinition, DynamicFieldType } from "../custom-fields/types";
import type { EntityPreset } from "../config/entityLabels";

export interface StandardFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type: string;
  isRequired: boolean;
  isVisible: boolean;
  isArchived: boolean;
}

const DEFAULT_STANDARD_FIELDS: Record<ModuleKey, StandardFieldConfig[]> = {
  students: [
    { key: "fullName", label: "Họ và tên", placeholder: "Nhập họ và tên...", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "phone", label: "Số điện thoại", placeholder: "Nhập số điện thoại...", type: "phone", isRequired: true, isVisible: true, isArchived: false },
    { key: "email", label: "Email học viên", placeholder: "Nhập địa chỉ email...", type: "email", isRequired: false, isVisible: true, isArchived: false },
    { key: "referral", label: "Nguồn giới thiệu", type: "select", isRequired: false, isVisible: true, isArchived: false },
    { key: "birthday", label: "Ngày sinh", type: "dateTime", isRequired: false, isVisible: true, isArchived: false },
    { key: "idCard", label: "CCCD / CMND", placeholder: "Nhập số CCCD (12 số)...", type: "text", isRequired: false, isVisible: true, isArchived: false },
    { key: "batchId", label: "Xếp vào lớp (tùy chọn)", type: "select", isRequired: false, isVisible: true, isArchived: false },
    { key: "registrationDate", label: "Ngày đăng ký", type: "text", isRequired: false, isVisible: true, isArchived: false },
    { key: "enrollmentDate", label: "Ngày nhập học", type: "dateTime", isRequired: false, isVisible: true, isArchived: false },
    { key: "fee", label: "Học phí đã chốt", type: "text", isRequired: false, isVisible: true, isArchived: false },
    { key: "address", label: "Địa chỉ", placeholder: "Nhập địa chỉ...", type: "text", isRequired: false, isVisible: true, isArchived: false },
    { key: "status", label: "Trạng thái (Chọn nhiều)", type: "checkbox", isRequired: false, isVisible: true, isArchived: false },
  ],
  courses: [
    { key: "code", label: "Mã khóa học", placeholder: "Ví dụ: ENG-TOEIC", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "title", label: "Tên chương trình đào tạo", placeholder: "Ví dụ: Luyện thi TOEIC 650+ cam kết chuẩn đầu ra", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "category", label: "Phân loại", type: "select", isRequired: true, isVisible: true, isArchived: false },
    { key: "duration", label: "Thời lượng", placeholder: "Ví dụ: 3 tháng / 8 tuần", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "fee", label: "Học phí niêm yết (VND)", placeholder: "Ví dụ: 5.500.000", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "maxLearners", label: "Tối đa học viên lớp", type: "number", isRequired: false, isVisible: true, isArchived: false },
  ],
  batches: [
    { key: "code", label: "Mã lớp học", placeholder: "Ví dụ: LH-001", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "courseId", label: "Khóa học", type: "select", isRequired: true, isVisible: true, isArchived: false },
    { key: "startDate", label: "Ngày khai giảng", type: "dateTime", isRequired: true, isVisible: true, isArchived: false },
    { key: "endDate", label: "Ngày bế giảng", type: "dateTime", isRequired: true, isVisible: true, isArchived: false },
    { key: "schedule", label: "Lịch học", placeholder: "Ví dụ: T2-T4-T6 (18:00-20:00)", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "room", label: "Phòng học", type: "select", isRequired: false, isVisible: true, isArchived: false },
    { key: "teacherId", label: "Giảng viên", type: "select", isRequired: false, isVisible: true, isArchived: false },
    { key: "maxLearners", label: "Sĩ số tối đa", type: "number", isRequired: false, isVisible: true, isArchived: false },
  ],
  exams: [
    { key: "name", label: "Tên đợt thi", placeholder: "Ví dụ: Đợt thi Ô tô - Tháng 3/2026", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "rank", label: "Nhóm thi", placeholder: "Ví dụ: B2", type: "text", isRequired: false, isVisible: true, isArchived: false },
    { key: "tentativeDate", label: "Ngày thi dự kiến", type: "dateTime", isRequired: true, isVisible: true, isArchived: false },
    { key: "location", label: "Địa điểm thi", placeholder: "Ví dụ: Trung tâm sát hạch quận 1", type: "text", isRequired: true, isVisible: true, isArchived: false },
  ],
  resources: [
    { key: "name", label: "Tên gọi tài nguyên", placeholder: "Ví dụ: Phòng Lab thực hành 102", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "type", label: "Phân loại", type: "select", isRequired: true, isVisible: true, isArchived: false },
    { key: "identifier", label: "Mã nhận diện / Số phòng", placeholder: "Ví dụ: P.102, MT-01, MC-02", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "capacity", label: "Sức chứa / Khả năng đáp ứng", placeholder: "Ví dụ: 30 người / 2 người / 1 bộ", type: "text", isRequired: true, isVisible: true, isArchived: false },
  ],
  partners: [
    { key: "name", label: "Tên đối tác / CTV", placeholder: "Nhập họ và tên...", type: "text", isRequired: true, isVisible: true, isArchived: false },
    { key: "phone", label: "Số điện thoại", placeholder: "Nhập số điện thoại...", type: "phone", isRequired: true, isVisible: true, isArchived: false },
    { key: "email", label: "Địa chỉ Email", placeholder: "Nhập địa chỉ email...", type: "email", isRequired: false, isVisible: true, isArchived: false },
    { key: "commissionRate", label: "Tỷ lệ chiết khấu (%)", placeholder: "Nhập tỷ lệ chiết khấu...", type: "number", isRequired: false, isVisible: true, isArchived: false },
  ],
};

/**
 * Nhãn mặc định theo loại hình. Loại hình "worker" quản lý dự án tuyển dụng
 * chứ không phải lớp học, nên nhãn gốc của module batches phải đổi theo —
 * nếu không, popup thêm dự án vẫn hiện chữ của ngành giáo dục.
 * Nhãn người dùng đã tự sửa (lưu trong localStorage) luôn được giữ nguyên.
 */
const PRESET_STANDARD_FIELD_OVERRIDES: Partial<
  Record<EntityPreset, Partial<Record<ModuleKey, Record<string, Partial<StandardFieldConfig>>>>>
> = {
  worker: {
    batches: {
      code: { label: "Mã dự án", placeholder: "Ví dụ: DA-001" },
      courseId: { label: "Danh mục tuyển dụng" },
      startDate: { label: "Ngày bắt đầu" },
      endDate: { label: "Ngày kết thúc" },
      schedule: { label: "Lịch hoạt động", placeholder: "Ví dụ: T2-T4-T6 (08:00-17:00)" },
      room: { label: "Địa điểm làm việc" },
      teacherId: { label: "Người phụ trách" },
      maxLearners: { label: "Chỉ tiêu tối đa" },
    },
  },
};

function getDefaultStandardFields(moduleKey: ModuleKey, preset?: EntityPreset): StandardFieldConfig[] {
  const base = DEFAULT_STANDARD_FIELDS[moduleKey] || [];
  const overrides = preset ? PRESET_STANDARD_FIELD_OVERRIDES[preset]?.[moduleKey] : undefined;
  if (!overrides) return base;
  return base.map((field) => (overrides[field.key] ? { ...field, ...overrides[field.key] } : field));
}

export function getAdaptedFieldDefinition(config: StandardFieldConfig, moduleKey: ModuleKey): FieldDefinition {
  return {
    id: config.key,
    tenantId: "",
    moduleKey,
    key: config.key,
    label: config.label,
    type: config.type as DynamicFieldType,
    placeholder: config.placeholder,
    isRequired: config.isRequired,
    isVisible: config.isVisible,
    isArchived: config.isArchived,
    order: 0,
    createdBy: "",
    updatedBy: "",
  };
}

export function useStandardFields(moduleKey: ModuleKey, preset?: EntityPreset) {
  const localStorageKey = `standardFieldsConfig:${moduleKey}`;
  const [fields, setFields] = useState<StandardFieldConfig[]>([]);

  const loadFromStorage = useCallback(() => {
    const defaults = getDefaultStandardFields(moduleKey, preset);
    const stored = localStorage.getItem(localStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StandardFieldConfig[];
        // Merge stored fields with defaults to handle schema changes gracefully
        const baseDefaults = DEFAULT_STANDARD_FIELDS[moduleKey] || [];
        const merged = defaults.map(def => {
          const matched = parsed.find(p => p.key === def.key);
          if (!matched) return def;
          // saveConfig ghi lại toàn bộ field kèm nhãn, kể cả khi người dùng chỉ
          // ẩn/hiện một field khác. Nhãn trùng mặc định gốc nghĩa là chưa ai đổi
          // tên thật sự — ưu tiên nhãn mặc định theo loại hình để không kẹt chữ cũ.
          const base = baseDefaults.find(b => b.key === def.key);
          const keptLabel = base && matched.label === base.label ? def.label : matched.label;
          const keptPlaceholder = base && matched.placeholder === base.placeholder ? def.placeholder : matched.placeholder;
          return { ...def, ...matched, label: keptLabel, placeholder: keptPlaceholder };
        });
        return merged;
      } catch (e) {
        console.error("Failed to parse standard fields config", e);
      }
    }
    return defaults;
  }, [moduleKey, localStorageKey, preset]);

  useEffect(() => {
    setFields(loadFromStorage());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === localStorageKey) {
        setFields(loadFromStorage());
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [loadFromStorage, localStorageKey]);

  const saveConfig = (newFields: StandardFieldConfig[]) => {
    localStorage.setItem(localStorageKey, JSON.stringify(newFields));
    setFields(newFields);
    // Dispatch local event for other components in same tab
    window.dispatchEvent(new Event(`standard-fields-changed:${moduleKey}`));
  };

  useEffect(() => {
    const handleLocalChange = () => {
      setFields(loadFromStorage());
    };
    window.addEventListener(`standard-fields-changed:${moduleKey}`, handleLocalChange);
    return () => window.removeEventListener(`standard-fields-changed:${moduleKey}`, handleLocalChange);
  }, [moduleKey, loadFromStorage]);

  const updateField = (key: string, input: Partial<StandardFieldConfig>) => {
    const updated = fields.map(f => {
      if (f.key === key) {
        const isVisible = input.isVisible !== undefined ? input.isVisible : f.isVisible;
        const isRequired = isVisible ? (input.isRequired !== undefined ? input.isRequired : f.isRequired) : false;
        return {
          ...f,
          ...input,
          isVisible,
          isRequired,
        };
      }
      return f;
    });
    saveConfig(updated);
  };

  const archiveField = (key: string) => {
    const updated = fields.map(f => {
      if (f.key === key) {
        return { ...f, isArchived: true, isVisible: false, isRequired: false };
      }
      return f;
    });
    saveConfig(updated);
  };

  const restoreField = (key: string) => {
    const updated = fields.map(f => {
      if (f.key === key) {
        return { ...f, isArchived: false, isVisible: true };
      }
      return f;
    });
    saveConfig(updated);
  };

  const deleteField = (key: string) => {
    // Treat permanent delete as permanently archived/hidden
    const updated = fields.map(f => {
      if (f.key === key) {
        return { ...f, isArchived: false, isVisible: false, isRequired: false };
      }
      return f;
    });
    saveConfig(updated);
  };

  const activeFields = fields.filter(f => f.isVisible && !f.isArchived);
  const archivedFields = fields.filter(f => f.isArchived);

  // Expose as an object with getters & actions
  return {
    fields,
    activeFields,
    archivedFields,
    updateField,
    archiveField,
    restoreField,
    deleteField,
  };
}
