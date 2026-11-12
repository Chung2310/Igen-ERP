import { describe, expect, it } from "vitest";
import type { AssistantSlideContent } from "../../shared/assistant-slide";
import { getAssistantSlideTheme, getSlideMetrics, inferSlideLayout } from "./assistant-slide-design";

const slide = (overrides: Partial<AssistantSlideContent> = {}): AssistantSlideContent => ({
  title: "Kế hoạch",
  keyMessage: "Tập trung vào mục tiêu đã thống nhất.",
  bullets: ["Rà soát tiến độ", "Phân công người phụ trách"],
  speakerNotes: "",
  ...overrides,
});

describe("assistant slide visual structure", () => {
  it("uses only two or more explicit figures with a shared unit for charts", () => {
    expect(getSlideMetrics(slide({ bullets: ["Thu nhập 15 triệu mỗi tháng", "Khoản dư 3 triệu mỗi tháng"] }))).toHaveLength(2);
    expect(getSlideMetrics(slide({ bullets: ["Bước 1: tổng hợp", "Bước 2: lập kế hoạch"] }))).toHaveLength(0);
    expect(getSlideMetrics(slide({ bullets: ["Thu nhập 15 triệu", "Chi phí 2 tỷ"] }))).toHaveLength(0);
  });

  it("selects a local layout from the slide content and honors a saved choice", () => {
    expect(inferSlideLayout(slide({ bullets: ["Thu nhập 15 triệu", "Khoản dư 3 triệu"] }))).toBe("chart");
    expect(inferSlideLayout(slide({ title: "Lộ trình 30 ngày" }))).toBe("timeline");
    expect(inferSlideLayout(slide({ layout: "steps" }))).toBe("steps");
  });

  it("falls back to a known palette for older saved decks", () => {
    expect(getAssistantSlideTheme(undefined).id).toBe("ocean");
    expect(getAssistantSlideTheme("sunrise").primary).toBe("#EA580C");
  });

  it("gives the default slide theme a warm canvas and distinct, coordinated accents", () => {
    const theme = getAssistantSlideTheme(undefined);
    expect(theme.canvas).toBe("#FBF8F0");
    expect(theme.label).toBe("Nắng kem");
    expect(theme.accents).toHaveLength(5);
    expect(new Set(theme.accents).size).toBe(5);
    expect(theme.accents).toContain(theme.primary);
  });
});
