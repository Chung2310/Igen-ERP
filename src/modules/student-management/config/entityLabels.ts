export const ENTITY_PRESETS = ["student", "candidate", "customer", "worker"] as const;
export type EntityPreset = (typeof ENTITY_PRESETS)[number];

export type EntityLabelSet = {
  tabLabel: string;
  singular: string;
  titleCase: string;
  listTitle: string;
  addTitle: string;
  editTitle: string;
};

export const ENTITY_LABEL_PRESETS: Record<EntityPreset, EntityLabelSet> = {
  student: {
    tabLabel: "Học viên",
    singular: "học viên",
    titleCase: "Học viên",
    listTitle: "Danh sách học viên",
    addTitle: "Thêm học viên mới",
    editTitle: "Chỉnh sửa thông tin học viên",
  },
  candidate: {
    tabLabel: "Ứng viên",
    singular: "ứng viên",
    titleCase: "Ứng viên",
    listTitle: "Danh sách ứng viên",
    addTitle: "Thêm ứng viên mới",
    editTitle: "Chỉnh sửa thông tin ứng viên",
  },
  customer: {
    tabLabel: "Khách hàng",
    singular: "khách hàng",
    titleCase: "Khách hàng",
    listTitle: "Danh sách khách hàng",
    addTitle: "Thêm khách hàng mới",
    editTitle: "Chỉnh sửa thông tin khách hàng",
  },
  worker: {
    tabLabel: "Lao động",
    singular: "lao động",
    titleCase: "Lao động",
    listTitle: "Danh sách lao động",
    addTitle: "Thêm lao động mới",
    editTitle: "Chỉnh sửa thông tin lao động",
  },
};

export const ENTITY_PRESET_OPTIONS: { value: EntityPreset; label: string }[] = [
  { value: "student", label: "Giáo dục — Học viên" },
  { value: "customer", label: "Dịch vụ — Khách hàng" },
  { value: "worker", label: "Tuyển dụng — Lao động" },
];

export function canChangeEntityPreset(role: string | null | undefined): boolean {
  return role === "superadmin";
}

export const DEFAULT_ENTITY_PRESET: EntityPreset = "student";
