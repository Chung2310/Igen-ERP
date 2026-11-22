// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AssistantStudio } from "./AssistantStudio";

afterEach(cleanup);

describe("AssistantStudio", () => {
  it("opens the infographic workspace from the image tools", () => {
    render(<AssistantStudio />);
    fireEvent.click(screen.getByRole("button", { name: /Tạo infographic/ }));
    expect(screen.getByRole("form", { name: "Thiết lập tạo infographic" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Minh họa infographic với quy trình/ })).toBeTruthy();
  });

  it("filters tools and keeps every upcoming tool locked", () => {
    render(<AssistantStudio />);
    const studioTitle = screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" });
    expect(studioTitle.parentElement?.className).toContain("text-left");
    expect(studioTitle.className).toContain("text-4xl!");
    expect(studioTitle.className).toContain("flex-wrap");
    expect(studioTitle.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Khám phá iGen AI Studio")).toBeNull();
    expect(screen.getByRole("button", { name: /YouTube/ }).querySelector('img[src="/ai-studio-youtube-summary.webp"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tạo slide/ }).querySelector('img[src="/ai-studio-slides.webp"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tạo Mindmap/ }).querySelector('img[src="/ai-studio-mindmap.webp"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Soạn nội dung/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Video$/ }));
    const videoTool = screen.getByRole("button", { name: /Phác thảo cảnh quay từ một ý tưởng/ });
    const youtubeTool = screen.getByRole("button", { name: /Lấy những ý chính từ một video/ });
    const gatedVideoTools = [
      screen.getByRole("button", { name: /Tạo video từ nội dung/ }),
      screen.getByRole("button", { name: /Tạo video người dẫn AI/ }),
      screen.getByRole("button", { name: /Tạo chuyển động từ hình ảnh/ }),
      screen.getByRole("button", { name: /Cắt video dài thành video ngắn/ }),
    ];
    for (const tool of gatedVideoTools) {
      expect(tool).toHaveProperty("disabled", true);
      expect(within(tool).getByText("Cần quyền Marketing")).toBeTruthy();
    }
    expect(videoTool).toHaveProperty("disabled", true);
    expect(youtubeTool).toHaveProperty("disabled", true);
    expect(within(videoTool).getAllByText("Sắp ra mắt").length).toBeGreaterThan(0);
    expect(within(youtubeTool).getAllByText("Sắp ra mắt").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Tạo hình ảnh/ })).toBeNull();

    fireEvent.click(videoTool);
    expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Ý tưởng video" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Âm thanh" }));
    const voiceGenerationTool = screen.getByRole("button", { name: /Tạo giọng đọc/ });
    expect(voiceGenerationTool).toHaveProperty("disabled", true);
    expect(within(voiceGenerationTool).getByText("Cần quyền Marketing")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    fireEvent.click(screen.getByRole("button", { name: /Tạo slide/ }));
    expect(screen.getByRole("heading", { level: 1, name: /Tóm tắt tài liệu/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Chủ đề và nội dung" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "AI Studio" }));
    fireEvent.click(screen.getByRole("button", { name: /Tạo Mindmap/ }));
    expect(screen.getByRole("heading", { name: "Tạo mindmap" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Chủ đề và nội dung tạo mindmap" })).toBeTruthy();
  });

  it("enables the migrated video and voice tools with Marketing access", () => {
    render(<AssistantStudio canUseMarketingTools />);
    fireEvent.click(screen.getByRole("button", { name: "Video" }));
    for (const name of [
      /Tạo video từ nội dung/,
      /Tạo video người dẫn AI/,
      /Tạo chuyển động từ hình ảnh/,
      /Cắt video dài thành video ngắn/,
    ]) {
      expect(screen.getByRole("button", { name })).toHaveProperty("disabled", false);
    }
    fireEvent.click(screen.getByRole("button", { name: "Âm thanh" }));
    expect(screen.getByRole("button", { name: /Tạo giọng đọc/ })).toHaveProperty("disabled", false);
  });
});
