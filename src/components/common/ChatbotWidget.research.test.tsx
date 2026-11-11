// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultAssistantSettings } from "../../shared/assistant-workflow";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), state: vi.fn(), turn: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "research-company" } }) }));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => ({ activeBranchId: "research-branch" }) }));
vi.mock("../../services/assistantService", () => ({ assistantService: mocks }));
import { ChatbotWidget } from "./ChatbotWidget";

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.settings.mockResolvedValue(defaultAssistantSettings);
  mocks.state.mockResolvedValue({ messages: [], lastReply: null, busy: false });
  mocks.turn.mockResolvedValue({
    status: "completed",
    reply: "Kết quả nghiên cứu có trích dẫn.",
    sources: [{ title: "Tài liệu chính thức", url: "https://example.com/research" }],
  });
  vi.stubGlobal("Audio", class { play = vi.fn().mockResolvedValue(undefined); pause = vi.fn(); });
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: true, media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("sends deep research requests and shows the cited sources", async () => {
  mocks.turn.mockResolvedValueOnce({
    status: "completed",
    reply: "See [the report](https://example.com/report.pdf).",
    sources: [
      { title: "Research page", url: "https://example.com/research" },
      { title: "Annual report", url: "https://example.com/report.pdf" },
    ],
    illustrations: [{ alt: "An illustration of the subject", url: "data:image/webp;base64,YQ==", sourceTitle: "Research page", sourceUrl: "https://example.com/research", sourceCredit: "Artist: Example · License: CC BY-SA 4.0" }],
  });
  render(<ChatbotWidget mode="standalone" storageScope="research-check" />);
  expect(screen.queryByText("Nghiên cứu sâu luôn bật")).toBeNull();
  expect(screen.queryByRole("button", { name: "Nghiên cứu sâu" })).toBeNull();
  const voiceToggle = screen.getByRole("button", { name: "Bật chế độ 2 chiều" }) as HTMLButtonElement;
  await waitFor(() => expect(voiceToggle.disabled).toBe(false));
  const textbox = screen.getByRole("textbox", { name: "Tin nhắn cho trợ lý ảo" });
  fireEvent.change(textbox, { target: { value: "Nghiên cứu chủ đề này từ nhiều nguồn." } });
  fireEvent.submit(textbox.closest("form")!);

  await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce());
  expect(mocks.turn.mock.calls[0][0]).toMatchObject({ mode: "qa", research: true, text: "Nghiên cứu chủ đề này từ nhiều nguồn." });
  const sources = await screen.findByRole("region", { name: "Nguồn tham khảo" });
  expect(sources.querySelector("a")?.getAttribute("href")).toBe("https://example.com/research");
  expect(sources.querySelector("a")?.getAttribute("target")).toBe("_blank");
  expect(sources.querySelector('a[href="https://example.com/report.pdf"]')).not.toBeNull();
  expect(sources.querySelector("img")).toBeNull();
  expect(screen.getByRole("img", { name: "An illustration of the subject" }).getAttribute("src")).toBe("data:image/webp;base64,YQ==");
  const illustration = screen.getByRole("region", { name: "Hình minh họa" });
  expect(illustration.querySelector("figcaption a")?.getAttribute("href")).toBe("https://example.com/research");
  expect(illustration.textContent).toContain("CC BY-SA 4.0");
  const savedValues = Array.from({ length: localStorage.length }, (_, index) => localStorage.getItem(localStorage.key(index) || "") || "");
  expect(savedValues.some(value => value.includes("https://example.com/research"))).toBe(true);
  expect(savedValues.some(value => value.includes("data:image/webp;base64,YQ=="))).toBe(true);
});
