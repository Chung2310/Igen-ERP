export const ENTITY_PRESETS = [
  "student",
  "candidate",
  "customer",
  "worker",
] as const;
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
export const LOADING_ENTITY_LABELS: EntityLabelSet = {
  tabLabel: "Học viên/Lao động",
  singular: "học viên/lao động",
  titleCase: "Học viên/Lao động",
  listTitle: "Danh sách học viên/lao động",
  addTitle: "Thêm học viên/lao động mới",
  editTitle: "Chỉnh sửa thông tin học viên/lao động",
};
/** Tên ngành nghề của từng loại hình. Nhãn thực thể luôn lấy từ
 * ENTITY_LABEL_PRESETS để phần cài đặt và phần module không bao giờ lệch nhau. */
const ENTITY_PRESET_SECTORS: Record<EntityPreset, string> = {
  student: "Giáo dục",
  candidate: "Tuyển dụng",
  customer: "Dịch vụ",
  worker: "Tuyển dụng",
};

/** Loại hình còn được chọn khi tạo/đổi tenant. "candidate" là loại hình cũ:
 * không cấp mới nữa nhưng tenant đang dùng vẫn phải hiển thị đúng. */
const SELECTABLE_ENTITY_PRESETS: EntityPreset[] = [
  "student",
  "customer",
  "worker",
];

export type EntityPresetOption = {
  value: EntityPreset;
  /** "Giáo dục — Học viên" */
  label: string;
  /** Nhãn thực thể module đang dùng: "Học viên" */
  entityLabel: string;
  sector: string;
  /** Loại hình cũ, chỉ hiện khi tenant đang dùng. */
  legacy?: boolean;
};

function buildEntityPresetOption(value: EntityPreset): EntityPresetOption {
  const entityLabel = ENTITY_LABEL_PRESETS[value].tabLabel;
  const sector = ENTITY_PRESET_SECTORS[value];
  return {
    value,
    label: `${sector} — ${entityLabel}`,
    entityLabel,
    sector,
    legacy: SELECTABLE_ENTITY_PRESETS.includes(value) ? undefined : true,
  };
}

export const ENTITY_PRESET_OPTIONS: EntityPresetOption[] =
  SELECTABLE_ENTITY_PRESETS.map(buildEntityPresetOption);

/**
 * Danh sách loại hình để hiển thị, luôn chứa loại hình đang dùng.
 * Nhờ vậy tenant ở loại hình cũ ("candidate") vẫn thấy đúng nhãn như trong module
 * thay vì lọt ra giá trị thô.
 */
export function getEntityPresetOptions(
  current?: EntityPreset | null,
): EntityPresetOption[] {
  if (
    !current ||
    ENTITY_PRESET_OPTIONS.some((option) => option.value === current)
  ) {
    return ENTITY_PRESET_OPTIONS;
  }
  return [buildEntityPresetOption(current), ...ENTITY_PRESET_OPTIONS];
}

/** Loại hình doanh nghiệp là đặc quyền SuperAdmin — doanh nghiệp không tự sửa. */
export function canChangeEntityPreset(
  role: string | null | undefined,
): boolean {
  return role === "superadmin";
}

export const DEFAULT_ENTITY_PRESET: EntityPreset = "student";
