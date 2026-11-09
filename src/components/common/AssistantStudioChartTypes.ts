export const chartTypes = [
  "Tự động", "Biểu đồ đường", "Biểu đồ cột", "Biểu đồ xếp chồng", "Biểu đồ thanh", "Biểu đồ vùng",
  "Biểu đồ tròn", "Biểu đồ vòng", "Biểu đồ phân tán", "Biểu đồ thác nước", "Biểu đồ tần suất", "Biểu đồ Gantt",
] as const;

export type ChartType = (typeof chartTypes)[number];
