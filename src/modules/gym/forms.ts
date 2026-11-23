import type { GymEntity } from "../../../shared/gym/types";
export type FieldSpec = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  options?: [string, string][];
  placeholder?: string;
  default?: any;
};
const text = (key: string, label: string, required = false): FieldSpec => ({
  key,
  label,
  required,
});
const number = (key: string, label: string, required = false): FieldSpec => ({
  key,
  label,
  type: "number",
  required,
});
const date = (key: string, label: string): FieldSpec => ({
  key,
  label,
  type: "date",
  required: true,
});
const notes: FieldSpec = { key: "notes", label: "Ghi chú", multiline: true };
export const labels: Record<GymEntity, string> = {
  customers: "Khách hàng",
  exercises: "Bài tập",
  "workout-templates": "Giáo án",
  "workout-plans": "Giáo án khách hàng",
  "progress-reports": "Báo cáo tiến độ",
  "progress-photos": "Ảnh tiến độ",
  "package-templates": "Gói tập mẫu",
  "nutrition-plans": "Thực đơn",
  "nutrition-logs": "Nhật ký ăn uống",
  measurements: "Chỉ số InBody",
  goals: "Mục tiêu",
  roadmaps: "Lộ trình",
  sessions: "Buổi tập",
  packages: "Gói PT",
  transfers: "Điều chuyển",
  knowledge: "Tài liệu",
  "food-images": "Ảnh món ăn",
};
export const forms: Partial<Record<GymEntity, FieldSpec[]>> = {
  exercises: [
    text("name", "Tên bài tập", true),
    text("muscleGroup", "Nhóm cơ", true),
    text("equipment", "Dụng cụ"),
    {
      key: "trackingType",
      label: "Kiểu theo dõi",
      default: "STRENGTH",
      options: [
        ["STRENGTH", "Sức mạnh"],
        ["CARDIO", "Cardio"],
        ["BODYWEIGHT", "Trọng lượng cơ thể"],
        ["MOBILITY", "Linh hoạt"],
        ["INTERVAL", "Interval"],
      ],
    },
    { key: "instructions", label: "Hướng dẫn", multiline: true },
    { key: "videoUrl", label: "Video hướng dẫn", type: "url" },
  ],
  "workout-templates": [
    text("title", "Tên giáo án", true),
    text("goal", "Mục tiêu"),
    text("level", "Trình độ"),
    { ...number("durationWeeks", "Thời lượng (tuần)", true), default: 4 },
    { ...number("durationDays", "Thời lượng (ngày)", true), default: 28 },
    { key: "description", label: "Mô tả", multiline: true },
    {
      key: "status",
      label: "Trạng thái",
      default: "DRAFT",
      options: [
        ["DRAFT", "Bản nháp"],
        ["ACTIVE", "Đang sử dụng"],
        ["ARCHIVED", "Đã lưu trữ"],
      ],
    },
  ],
  "workout-plans": [
    text("title", "Tên giáo án", true),
    text("goal", "Mục tiêu"),
    { ...number("durationWeeks", "Thời lượng (tuần)", true), default: 4 },
    { key: "description", label: "Mô tả", multiline: true },
    {
      key: "status",
      label: "Trạng thái",
      default: "ACTIVE",
      options: [
        ["DRAFT", "Bản nháp"],
        ["ACTIVE", "Đang sử dụng"],
        ["ARCHIVED", "Đã lưu trữ"],
      ],
    },
  ],
  "progress-reports": [
    date("periodStart", "Từ ngày"),
    date("periodEnd", "Đến ngày"),
    { key: "summary", label: "Nội dung báo cáo", multiline: true, required: true },
  ],
  "nutrition-plans": [
    text("title", "Tên thực đơn", true),
    number("bmr", "BMR"),
    number("tdee", "TDEE"),
    number("targetCalories", "Calories mục tiêu", true),
    date("startDate", "Ngày bắt đầu"),
    date("endDate", "Ngày kết thúc"),
  ],
  "nutrition-logs": [
    date("date", "Ngày"),
    text("mealType", "Bữa ăn", true),
    { key: "foods", label: "Món ăn", multiline: true },
    number("calories", "Calories", true),
    number("protein", "Protein (g)"),
    number("carbs", "Carb (g)"),
    number("fat", "Fat (g)"),
    notes,
  ],
  measurements: [
    date("measurementDate", "Ngày đo"),
    number("weight", "Cân nặng (kg)", true),
    number("height", "Chiều cao (cm)"),
    number("bmi", "BMI"),
    number("bodyFatPercentage", "Tỷ lệ mỡ (%)"),
    number("bodyFatMass", "Khối lượng mỡ (kg)"),
    number("muscleMass", "Khối lượng cơ (kg)"),
    number("bmr", "BMR"),
    number("visceralFatLevel", "Mỡ nội tạng"),
    number("inbodyScore", "Điểm InBody"),
    number("bodyWater", "Nước cơ thể (L)"),
    number("boneMineral", "Khoáng xương (kg)"),
    number("waistHipRatio", "Tỷ lệ eo/hông"),
    { key: "consultationNotes", label: "Ghi chú tư vấn", multiline: true },
    number("waist", "Vòng eo (cm)"),
    number("hip", "Vòng hông (cm)"),
    number("chest", "Vòng ngực (cm)"),
    notes,
  ],
  goals: [
    text("title", "Tên mục tiêu", true),
    { key: "type", label: "Loại mục tiêu", default: "FAT_LOSS", options: [["WEIGHT_LOSS", "Giảm cân"], ["FAT_LOSS", "Giảm mỡ"], ["WEIGHT_GAIN", "Tăng cân"], ["MUSCLE_GAIN", "Tăng cơ"], ["RECOMPOSITION", "Tái cấu trúc cơ thể"], ["FITNESS", "Thể lực"]] },
    number("targetValue", "Giá trị mục tiêu"),
    text("targetUnit", "Đơn vị"),
    date("deadline", "Thời hạn"),
    { ...number("sessionsPerWeek", "Số buổi mỗi tuần", true), default: 3 },
    { key: "cardioNotes", label: "Ghi chú cardio", multiline: true },
    { key: "evaluationNotes", label: "Ghi chú đánh giá", multiline: true },
  ],
  roadmaps: [
    text("title", "Tên roadmap", true),
  ],
  sessions: [
    {
      key: "performedAt",
      label: "Thời gian tập",
      type: "datetime-local",
      required: true,
    },
    {
      key: "attendance",
      label: "Điểm danh",
      default: "PRESENT",
      options: [
        ["PRESENT", "Có mặt"],
        ["ABSENT", "Vắng"],
        ["LATE", "Đi muộn"],
      ],
    },
    text("absenceReason", "Lý do vắng"),
    text("feeling", "Cảm nhận"),
    notes,
  ],
  packages: [
    {
      key: "status",
      label: "Trạng thái",
      default: "ACTIVE",
      options: [
        ["ACTIVE", "Đang hoạt động"],
        ["EXPIRED", "Hết hạn"],
        ["COMPLETED", "Hoàn thành"],
        ["CANCELLED", "Đã hủy"],
      ],
    },
    text("name", "Tên gói", true),
    number("totalSessions", "Tổng số buổi", true),
    date("startDate", "Ngày bắt đầu"),
    date("endDate", "Ngày kết thúc"),
  ],
  knowledge: [
    text("title", "Tiêu đề", true),
    { key: "topic", label: "Chủ đề", default: "Chung", required: true },
    {
      key: "content",
      label: "Nội dung",
      multiline: true,
      required: true,
      placeholder: "Nhập nội dung tài liệu...",
    },
  ],
  "food-images": [
    text("name", "Tên món ăn", true),
    {
      key: "category",
      label: "Phân loại",
      default: "OTHER",
      options: [
        ["PROTEIN", "Đạm"],
        ["CARB", "Tinh bột"],
        ["FAT", "Chất béo"],
        ["VEGGIE", "Rau củ"],
        ["MEAL", "Bữa chính"],
        ["SNACK", "Bữa phụ"],
        ["DRINK", "Đồ uống"],
        ["OTHER", "Khác"],
      ],
    },
  ],
};
export function initialForm(entity: GymEntity, record?: Record<string, any>) {
  return Object.fromEntries(
    (forms[entity] || []).map((field) => [
      field.key,
      record?.[field.key] ?? field.default ?? "",
    ]),
  );
}
