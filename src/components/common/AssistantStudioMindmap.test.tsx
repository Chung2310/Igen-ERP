// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantStudioMindmap } from "./AssistantStudioMindmap";
import { assistantService } from "../../services/assistantService";
import type { AssistantStudioCreationRecord } from "../../services/assistantStudioHistory";

vi.mock("../../services/assistantService", () => ({ assistantService: { createStudioMindmap: vi.fn() } }));

const { listCreationHistory, saveCreationHistory, getUserId } = vi.hoisted(() => ({
  listCreationHistory: vi.fn(),
  saveCreationHistory: vi.fn(),
  getUserId: vi.fn(() => "user-1"),
}));

vi.mock("../../services/assistantStudioHistory", () => ({
  listAssistantStudioCreationHistory: listCreationHistory,
  saveAssistantStudioCreationHistory: saveCreationHistory,
}));
vi.mock("../../services/assistantSpeechHistory", () => ({ getAssistantSpeechHistoryUserId: getUserId }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AssistantStudioMindmap", () => {
  it("creates and renders a generated tree", async () => {
    vi.mocked(assistantService.createStudioMindmap).mockResolvedValue({
      id: "mindmap-1", title: "Kế hoạch năm", subtitle: "Các mục tiêu chính", locale: "vi", prompt: "Kế hoạch năm", sourceFileName: "", createdAt: "2026-11-10T00:00:00.000Z",
      root: { label: "Kế hoạch", detail: "Mục tiêu năm", children: [
        { label: "Doanh thu", detail: "Tăng trưởng", children: [{ label: "Kênh bán", detail: "Phát triển trực tuyến", children: [] }] },
        { label: "Nhân sự", detail: "Phát triển đội ngũ", children: [{ label: "Đào tạo", detail: "Nâng cao kỹ năng", children: [] }] },
      ] },
    });

    render(<AssistantStudioMindmap onBack={() => undefined} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Chủ đề và nội dung tạo mindmap" }), { target: { value: "Kế hoạch năm" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo mindmap" }));

    expect(await screen.findByRole("heading", { name: "Kế hoạch năm" })).toBeTruthy();
    const mindmap = screen.getByRole("img", { name: /Kế hoạch năm/ });
    expect(mindmap).toBeTruthy();
    const nodeColors = Array.from(mindmap.querySelectorAll("rect")).map(node => node.getAttribute("class"));
    expect(nodeColors[2]).toContain("fill-emerald-700");
    expect(nodeColors[3]).toContain("fill-emerald-50");
    expect(nodeColors[4]).toContain("fill-amber-300");
    expect(nodeColors[5]).toContain("fill-amber-50");
    expect(screen.getByRole("button", { name: /Tải SVG/ })).toBeTruthy();
    expect(assistantService.createStudioMindmap).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "text", prompt: "Kế hoạch năm", locale: "vi", writeMode: "ai",
    }));
  });

  it("closes history after opening a saved mindmap", async () => {
    const savedMindmap: AssistantStudioCreationRecord = {
      id: "saved-mindmap-1",
      userId: "user-1",
      kind: "mindmap",
      title: "Kế hoạch năm",
      summary: "Các mục tiêu chính",
      prompt: "Kế hoạch năm",
      createdAt: "2026-11-10T00:00:00.000Z",
      payload: {
        id: "mindmap-1",
        title: "Kế hoạch năm",
        subtitle: "Các mục tiêu chính",
        locale: "vi",
        prompt: "Kế hoạch năm",
        sourceFileName: "",
        createdAt: "2026-11-10T00:00:00.000Z",
        root: { label: "Kế hoạch", detail: "Mục tiêu năm", children: [] },
      },
    };
    listCreationHistory.mockResolvedValue([savedMindmap]);
    render(<AssistantStudioMindmap onBack={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    await screen.findByRole("dialog", { name: "Lịch sử mindmap" });
    fireEvent.click(await screen.findByRole("button", { name: /Kế hoạch năm/ }));

    expect(await screen.findByRole("img", { name: /Kế hoạch năm/ })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Lịch sử mindmap" })).toBeNull();
  });
});
