export const assistantChartTypes = [
  "Tự động",
  "Biểu đồ đường",
  "Biểu đồ cột",
  "Biểu đồ xếp chồng",
  "Biểu đồ thanh",
  "Biểu đồ vùng",
  "Biểu đồ tròn",
  "Biểu đồ vòng",
  "Biểu đồ phân tán",
  "Biểu đồ thác nước",
  "Biểu đồ tần suất",
  "Biểu đồ Gantt",
] as const;

export const defaultAssistantChartPrompt = "Tự phân tích toàn bộ dữ liệu trong tệp. Tự chọn trang tính, cột và phép tổng hợp phù hợp; tạo biểu đồ dễ đọc, nêu xu hướng chính dựa trên số liệu. Chỉ sử dụng dữ liệu có trong tệp, không suy đoán.";

export type AssistantChartType = (typeof assistantChartTypes)[number];
export type AssistantChartLayout = "category" | "scatter" | "waterfall" | "histogram" | "gantt";

export interface AssistantChartRow {
  label: string;
  values: number[];
  x?: number;
  y?: number;
  start?: number;
  end?: number;
  base?: number;
  increase?: number;
  decrease?: number;
}

export interface AssistantChartResult {
  id: string;
  fileName: string;
  title: string;
  summary: string;
  chartType: Exclude<AssistantChartType, "Tự động">;
  layout: AssistantChartLayout;
  xAxisLabel: string;
  yAxisLabel: string;
  unit: string;
  series: string[];
  rows: AssistantChartRow[];
  insights: string[];
  highlightLabels: string[];
  warnings: string[];
  sourceSheet: string;
  sourceRowCount: number;
  prompt: string;
  createdAt: string;
}

export interface AssistantChartHistoryItem {
  id: string;
  fileName: string;
  title: string;
  chartType: Exclude<AssistantChartType, "Tự động">;
  summary: string;
  createdAt: string;
}
