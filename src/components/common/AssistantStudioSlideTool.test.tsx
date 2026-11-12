// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudioSlideTool } from "./AssistantStudioSlideTool";

const { createDeck, listDecks, getDeck, updateDeck } = vi.hoisted(() => ({
  createDeck: vi.fn(),
  listDecks: vi.fn(),
  getDeck: vi.fn(),
  updateDeck: vi.fn(),
}));

vi.mock("../../services/assistantService", () => ({
  assistantService: {
    createStudioSlideDeck: createDeck,
    studioSlideDecks: listDecks,
    studioSlideDeck: getDeck,
    updateStudioSlideDeck: updateDeck,
  },
}));

vi.mock("./assistant-studio-pptx", () => ({ downloadAssistantSlideDeck: vi.fn() }));

const deck = {
  id: "slide-deck-1",
  title: "Kế hoạch quý 4",
  subtitle: "Ưu tiên tăng trưởng bền vững",
  prompt: "Lập kế hoạch quý 4",
  sourceFileName: "",
  style: "rewrite" as const,
  analysis: {
    audience: "Quản lý và nhân viên",
    objective: "Giúp đội ngũ thống nhất ưu tiên quý 4.",
    storyline: "Thực trạng → ưu tiên → hành động.",
  },
  themeId: "ocean" as const,
  slides: [{
    title: "Mở đầu",
    keyMessage: "Tập trung vào khách hàng hiện hữu.",
    bullets: ["Phân khúc khách hàng", "Ưu tiên nguồn lực"],
    speakerNotes: "Nêu bối cảnh quý trước.",
  }],
  createdAt: "2026-11-10T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  createDeck.mockReset();
  listDecks.mockReset();
  getDeck.mockReset();
  updateDeck.mockReset();
});

describe("AssistantStudioSlideTool", () => {
  it("creates structured slide content once and saves manual edits without another AI generation", async () => {
    createDeck.mockResolvedValue(deck);
    updateDeck.mockImplementation(async (_id, update) => ({ ...deck, ...update }));
    render(<AssistantStudioSlideTool onBack={() => {}} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Chủ đề và nội dung" }), { target: { value: "Lập kế hoạch quý 4" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo nội dung slide/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Kế hoạch quý 4" })).toBeTruthy();
    expect(createDeck).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Trang 2: Mở đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sửa nội dung" }));
    const title = screen.getByRole("textbox", { name: "Tiêu đề slide" });
    fireEvent.click(title);
    Object.defineProperty(title, "innerText", { configurable: true, value: "Mục tiêu quý 4" });
    fireEvent.blur(title);
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateDeck).toHaveBeenCalledWith("slide-deck-1", expect.objectContaining({
      slides: [expect.objectContaining({ title: "Mục tiêu quý 4" })],
    })));
    expect(createDeck).toHaveBeenCalledTimes(1);
  });

  it("loads a saved deck from persistent history", async () => {
    listDecks.mockResolvedValue([{ id: deck.id, title: deck.title, subtitle: deck.subtitle, sourceFileName: "", slideCount: 2, createdAt: deck.createdAt }]);
    getDeck.mockResolvedValue(deck);
    render(<AssistantStudioSlideTool onBack={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    fireEvent.click(await screen.findByRole("button", { name: /Kế hoạch quý 4/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Kế hoạch quý 4" })).toBeTruthy();
    expect(getDeck).toHaveBeenCalledWith(deck.id);
  });

  it("opens a deck selected from the unified AI Studio history", async () => {
    getDeck.mockResolvedValue(deck);
    render(<AssistantStudioSlideTool initialDeckId={deck.id} onBack={() => {}} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Kế hoạch quý 4" })).toBeTruthy();
    expect(getDeck).toHaveBeenCalledWith(deck.id);
  });

  it("saves theme and slide layout changes locally without another AI call", async () => {
    createDeck.mockResolvedValue(deck);
    updateDeck.mockImplementation(async (_id, update) => ({ ...deck, ...update }));
    render(<AssistantStudioSlideTool onBack={() => {}} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Chủ đề và nội dung" }), { target: { value: "Lập kế hoạch quý 4" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo nội dung slide/ }));
    await screen.findByRole("heading", { level: 1, name: "Kế hoạch quý 4" });

    fireEvent.click(screen.getByRole("button", { name: "Chọn bảng màu Sắc màu" }));
    await waitFor(() => expect(updateDeck).toHaveBeenCalledWith("slide-deck-1", expect.objectContaining({ themeId: "berry" })));

    fireEvent.click(screen.getByRole("button", { name: "Trang 2: Mở đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Các bước" }));
    await waitFor(() => expect(updateDeck).toHaveBeenLastCalledWith("slide-deck-1", expect.objectContaining({
      slides: [expect.objectContaining({ layout: "steps" })],
    })));
    expect(createDeck).toHaveBeenCalledTimes(1);
  });

  it("edits slide text and formatting on the canvas without another AI call", async () => {
    createDeck.mockResolvedValue(deck);
    updateDeck.mockImplementation(async (_id, update) => ({ ...deck, ...update }));
    render(<AssistantStudioSlideTool onBack={() => {}} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Chủ đề và nội dung" }), { target: { value: "Lập kế hoạch quý 4" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo nội dung slide/ }));
    await screen.findByRole("heading", { level: 1, name: "Kế hoạch quý 4" });
    fireEvent.click(screen.getByRole("button", { name: "Trang 2: Mở đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sửa nội dung" }));

    const title = screen.getByRole("textbox", { name: "Tiêu đề slide" });
    fireEvent.click(title);
    Object.defineProperty(title, "innerText", { configurable: true, value: "Mục tiêu quý 4" });
    fireEvent.blur(title);
    fireEvent.click(screen.getByRole("button", { name: "In đậm" }));
    expect(screen.getByRole("button", { name: "In đậm" }).getAttribute("aria-pressed")).toBe("true");
    expect((title as HTMLElement).style.fontWeight).toBe("700");
    const image = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Chọn ảnh để thêm vào slide"), { target: { files: [image] } });
    await screen.findByRole("button", { name: "Chọn ảnh logo.png" });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateDeck).toHaveBeenCalledWith("slide-deck-1", expect.objectContaining({
      slides: [expect.objectContaining({
        title: "Mục tiêu quý 4",
        textStyles: expect.objectContaining({ title: expect.objectContaining({ bold: true }) }),
        objects: expect.arrayContaining([expect.objectContaining({ type: "image", alt: "logo.png", src: expect.stringMatching(/^data:image\/png;base64,/) })]),
      })],
    })));
    expect(createDeck).toHaveBeenCalledTimes(1);
  });

  it("accepts a document as the only source for structured content", async () => {
    const sourceDeck = { ...deck, sourceFileName: "de-cuong.txt" };
    const file = new File(["Mục tiêu: tăng độ hài lòng khách hàng."], "de-cuong.txt", { type: "text/plain" });
    createDeck.mockResolvedValue(sourceDeck);
    render(<AssistantStudioSlideTool onBack={() => {}} />);

    fireEvent.change(screen.getByLabelText("Chọn tài liệu làm nguồn"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo nội dung slide/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Kế hoạch quý 4" })).toBeTruthy();
    expect(createDeck).toHaveBeenCalledWith({ prompt: "", pageCount: 10, style: "rewrite", file });
  });
});
