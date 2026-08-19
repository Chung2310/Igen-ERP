import type { TemplateVariableConfig } from "../template-editor/templateEditorTypes";

export const HR_BIRTHDAY_TEMPLATE_VARIABLES: TemplateVariableConfig[] = [
  { key: "employeeName", label: "Tên nhân sự", sample: "Nguyễn Minh Anh" },
  { key: "companyName", label: "Tên công ty", sample: "Công ty iGen" },
];

export const HR_HOLIDAY_TEMPLATE_VARIABLES: TemplateVariableConfig[] = [
  ...HR_BIRTHDAY_TEMPLATE_VARIABLES,
  { key: "holidayName", label: "Tên ngày lễ", sample: "Tết Trung Thu" },
];
