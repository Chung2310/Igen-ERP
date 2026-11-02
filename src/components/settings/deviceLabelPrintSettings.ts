export type LabelMediaType = "gap" | "black-mark" | "continuous" | "punched-hole";
export type LabelColumnCount = 1 | 2 | 3 | 4 | 5 | 6;

export type DeviceLabelPrintSettings = {
  widthMm: number;
  heightMm: number;
  columns: LabelColumnCount;
  mediaType: LabelMediaType;
};

export const DEVICE_LABEL_PRINT_SETTINGS_KEY = "device-label-print-settings";

export const DEFAULT_DEVICE_LABEL_PRINT_SETTINGS: DeviceLabelPrintSettings = {
  widthMm: 100,
  heightMm: 30,
  columns: 2,
  mediaType: "gap",
};

const VALID_MEDIA_TYPES: LabelMediaType[] = ["gap", "black-mark", "continuous", "punched-hole"];

export function normalizeDeviceLabelPrintSettings(
  value: Partial<DeviceLabelPrintSettings> | null | undefined,
): DeviceLabelPrintSettings {
  const widthMm = Number(value?.widthMm);
  const heightMm = Number(value?.heightMm);

  return {
    widthMm: Number.isFinite(widthMm) && widthMm >= 25.4 && widthMm <= 108
      ? Math.round(widthMm * 10) / 10
      : DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.widthMm,
    heightMm: Number.isFinite(heightMm) && heightMm >= 10 && heightMm <= 200
      ? Math.round(heightMm * 10) / 10
      : DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.heightMm,
    columns: Number.isInteger(value?.columns) && Number(value?.columns) >= 1 && Number(value?.columns) <= 6
      ? Number(value?.columns) as LabelColumnCount
      : DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.columns,
    mediaType: VALID_MEDIA_TYPES.includes(value?.mediaType as LabelMediaType)
      ? value!.mediaType as LabelMediaType
      : DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.mediaType,
  };
}

export function loadDeviceLabelPrintSettings(): DeviceLabelPrintSettings {
  try {
    const stored = window.localStorage.getItem(DEVICE_LABEL_PRINT_SETTINGS_KEY);
    if (!stored) return DEFAULT_DEVICE_LABEL_PRINT_SETTINGS;

    const parsed = JSON.parse(stored) as Partial<DeviceLabelPrintSettings>;
    const settings = normalizeDeviceLabelPrintSettings(parsed);
    // The previous default treated 50 × 30 mm as the whole two-label row.
    // The current roll has two approximately 50 × 30 mm labels side by side.
    if (settings.widthMm === 50 && settings.heightMm === 30 && settings.columns === 2 && settings.mediaType === "gap") {
      const migrated = { ...settings, widthMm: 100 };
      window.localStorage.setItem(DEVICE_LABEL_PRINT_SETTINGS_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return settings;
  } catch {
    return DEFAULT_DEVICE_LABEL_PRINT_SETTINGS;
  }
}

export function saveDeviceLabelPrintSettings(
  settings: Partial<DeviceLabelPrintSettings>,
): DeviceLabelPrintSettings {
  const normalized = normalizeDeviceLabelPrintSettings(settings);
  window.localStorage.setItem(DEVICE_LABEL_PRINT_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}
