// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { defaultAssistantChartPrompt } from "../../shared/assistant-chart";
import { AssistantStudioChart } from "./AssistantStudioChart";

const { createStudioChart, editStudioChart, studioCharts, studioChart } = vi.hoisted(() => ({
  createStudioChart: vi.fn(),
  editStudioChart: vi.fn(),
  studioCharts: vi.fn().mockResolvedValue([]),
  studioChart: vi.fn(),
}));

vi.mock("../../services/assistantService", () => ({
  assistantService: {
    createStudioChart,
    editStudioChart,
    studioCharts,
    studioChart,
  },
}));

const chart = {
  id: "chart-1",
  fileName: "doanh-thu.xlsx",
  title: "Doanh thu theo tháng",
  summary: "Tổng doanh thu được nhóm theo tháng.",
  chartType: "Biểu đồ cột" as const,
  layout: "category" as const,
  xAxisLabel: "Tháng",
  yAxisLabel: "Doanh thu",
  unit: "VND",
  series: ["Doanh thu"],
  rows: [{ label: "Tháng 1", values: [12000000] }],
  insights: ["Tháng 1 có doanh thu 12.000.000 VND."],
  highlightLabels: [],
  warnings: [],
  sourceSheet: "Doanh thu",
  sourceRowCount: 1,
  prompt: defaultAssistantChartPrompt,
  createdAt: "2026-11-10T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  createStudioChart.mockReset();
  editStudioChart.mockReset();
  studioCharts.mockReset().mockResolvedValue([]);
  studioChart.mockReset();
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function show() { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  }
});

describe("AssistantStudioChart", () => {
  it("creates a real chart when the prompt is blank by sending the preset analysis prompt", async () => {
    createStudioChart.mockResolvedValue(chart);
    render(<AssistantStudioChart onBack={() => {}} />);

    const file = new File(["Tháng,Doanh thu\nTháng 1,12000000"], "doanh-thu.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText("Chọn tệp dữ liệu"), { target: { files: [file] } });
    expect(screen.getByText("doanh-thu.xlsx")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Yêu cầu tạo biểu đồ (không bắt buộc)" })).toHaveProperty("value", "");

    fireEvent.click(screen.getByRole("button", { name: /^Tạo biểu đồ/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Doanh thu theo tháng" })).toBeTruthy();
    expect(createStudioChart).toHaveBeenCalledWith(file, defaultAssistantChartPrompt, "Tự động");
    expect(screen.getByRole("table")).toBeTruthy();

    const editButton = screen.getByRole("button", { name: /AI$/ });
    const downloadTrigger = screen.getByLabelText("Tải dữ liệu biểu đồ xuống");
    expect(editButton.parentElement?.contains(downloadTrigger)).toBe(true);
    fireEvent.click(downloadTrigger);
    expect(screen.getByRole("button", { name: "Tải dữ liệu CSV" })).toBeTruthy();
  });

  it("lets the user refine a generated chart from the existing edit dialog", async () => {
    createStudioChart.mockResolvedValue(chart);
    editStudioChart.mockResolvedValue({ ...chart, title: "Doanh thu tháng 1", prompt: `${chart.prompt}\n\nChỉnh sửa: Đổi tiêu đề` });
    render(<AssistantStudioChart onBack={() => {}} />);

    const file = new File(["data"], "doanh-thu.xlsx");
    fireEvent.change(screen.getByLabelText("Chọn tệp dữ liệu"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^Tạo biểu đồ/ }));
    await screen.findByRole("heading", { level: 1, name: "Doanh thu theo tháng" });

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa bằng AI" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Tiêu đề biểu đồ" }), { target: { value: "Doanh thu tháng 1" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Yêu cầu chỉnh sửa" }), { target: { value: "Đổi tiêu đề" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Áp dụng chỉnh sửa" }));

    await waitFor(() => expect(editStudioChart).toHaveBeenCalledWith("chart-1", expect.objectContaining({ request: "Đổi tiêu đề", title: "Doanh thu tháng 1" })));
    expect(await screen.findByRole("heading", { level: 1, name: "Doanh thu tháng 1" })).toBeTruthy();
  });

  it("closes history after opening a saved chart", async () => {
    studioCharts.mockResolvedValue([chart]);
    studioChart.mockResolvedValue(chart);
    render(<AssistantStudioChart onBack={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    const history = await screen.findByRole("dialog", { name: "Lịch sử biểu đồ" });
    const savedChart = await within(history).findByRole("button", { name: /Doanh thu theo tháng/ });
    await waitFor(() => expect(savedChart).not.toHaveProperty("disabled", true));
    fireEvent.click(savedChart);

    expect(await screen.findByRole("heading", { level: 1, name: "Doanh thu theo tháng" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Lịch sử biểu đồ" })).toBeNull();
  });
});
