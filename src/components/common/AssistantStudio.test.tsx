// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AssistantStudio } from "./AssistantStudio";

afterEach(cleanup);

function AssistantStudioWithFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  return <AssistantStudio favoriteToolIds={favoriteIds} onToggleToolFavorite={toolId => setFavoriteIds(current => current.includes(toolId) ? current.filter(id => id !== toolId) : [...current, toolId])} />;
}

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
    expect(studioTitle.className).toContain("text-[27px]!");
    expect(studioTitle.className).toContain("flex-wrap");
    expect(studioTitle.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Khám phá iGen AI Studio")).toBeNull();
    expect(screen.getByRole("button", { name: /YouTube/ }).querySelector('img[src="/ai-studio-youtube-summary.webp"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tạo slide/ }).querySelector('img[src="/ai-studio-slides.webp"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tạo Mindmap/ }).querySelector('img[src="/ai-studio-mindmap.webp"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Soạn nội dung/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Video$/ }));
    const videoTool = screen.getByRole("button", { name: /Tạo video/ });
    const youtubeTool = screen.getByRole("button", { name: /Tóm tắt YouTube/ });
    expect(videoTool).toHaveProperty("disabled", true);
    expect(youtubeTool).toHaveProperty("disabled", true);
    expect(within(videoTool).getAllByText("Sắp ra mắt").length).toBeGreaterThan(0);
    expect(within(youtubeTool).getAllByText("Sắp ra mắt").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Tạo hình ảnh/ })).toBeNull();

    fireEvent.click(videoTool);
    expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Ý tưởng video" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    fireEvent.click(screen.getByRole("button", { name: /Tạo slide/ }));
    expect(screen.getByRole("heading", { level: 1, name: /Tóm tắt tài liệu/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Chủ đề và nội dung" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "AI Studio" }));
    fireEvent.click(screen.getByRole("button", { name: /Tạo Mindmap/ }));
    expect(screen.getByRole("heading", { name: "Tạo mindmap" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Chủ đề và nội dung tạo mindmap" })).toBeTruthy();
  });

  it("keeps tool cards compact and marks the hover-only details", () => {
    render(<AssistantStudio />);
    const card = screen.getByRole("button", { name: /Tạo hình ảnh/ });
    const artwork = card.querySelector('img[src="/ai-studio-image-create.webp"]');
    const cardWrapper = card.closest(".assistant-studio-card");

    expect(cardWrapper?.className).toContain("assistant-studio-card");
    expect(cardWrapper?.className).toContain("group");
    expect(artwork?.parentElement?.className).toContain("size-28");
    expect(card.querySelector(".assistant-studio-card-title")).not.toBeNull();
    expect(cardWrapper?.querySelector(".assistant-studio-card-favorite")?.className).toContain("opacity-0");
  });

  it("toggles a favorite without opening the tool and shows it in the favorites filter", () => {
    render(<AssistantStudioWithFavorites />);

    const imageTool = screen.getByRole("button", { name: /Tạo hình ảnh/ });
    const imageCard = imageTool.closest<HTMLElement>(".assistant-studio-card")!;
    fireEvent.click(within(imageCard).getByRole("button", { name: "Thêm vào yêu thích" }));
    expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Yêu thích" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Bỏ yêu thích" })[0].getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Yêu thích" }));
    const favoritesSection = screen.getByRole("region", { name: "Yêu thích" });
    expect(within(favoritesSection).getByText("Tạo hình ảnh")).toBeTruthy();

    fireEvent.click(within(favoritesSection).getByRole("button", { name: "Bỏ yêu thích" }));
    expect(screen.getByText("Chưa có công cụ yêu thích.")).toBeTruthy();
  });
});
