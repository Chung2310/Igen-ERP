// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatbotWidget } from "./ChatbotWidget";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { displayName: "An", companyCode: "MAIN", uid: "test" } }),
}));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => null }));
vi.mock("../../services/assistantService", () => ({ assistantService: {
  settings: () => new Promise(() => undefined),
  state: () => new Promise(() => undefined),
} }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe("ChatbotWidget welcome", () => {
  it.each(["qa", "work"] as const)("shows one greeting and a pill composer in %s mode", mode => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", mode);
    const markup = renderToStaticMarkup(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    const root = document.createElement("div");
    root.innerHTML = markup;
    const welcome = root.querySelector(".assistant-welcome");

    expect(welcome?.querySelector("h1")?.textContent).toContain("Xin chào An, mình có thể giúp gì cho bạn?");
    expect(welcome?.querySelectorAll("form")).toHaveLength(1);
    expect(welcome?.querySelector("form")?.className).toContain("rounded-full");
    expect(welcome?.querySelector("textarea")?.getAttribute("rows")).toBe("1");
    expect(welcome?.querySelector(".assistant-quick-actions, .assistant-reference-suggestions")).toBeNull();
  });

  it("replaces the voice action with send while a message is typed", () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "work");
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    const input = container.querySelector<HTMLTextAreaElement>("#erp-chatbot-input")!;
    const composer = input.closest("form")!;

    expect(composer.querySelector('[aria-label="Nói yêu cầu và tự gửi"]')).not.toBeNull();
    expect(composer.querySelector('button[type="submit"]')).toBeNull();

    fireEvent.change(input, { target: { value: "Hãy giúp tôi" } });
    expect(composer.querySelector('[aria-label="Nói yêu cầu và tự gửi"]')).toBeNull();
    expect(composer.querySelector('button[type="submit"]')).not.toBeNull();

    fireEvent.change(input, { target: { value: "   " } });
    expect(composer.querySelector('[aria-label="Nói yêu cầu và tự gửi"]')).not.toBeNull();
    expect(composer.querySelector('button[type="submit"]')).toBeNull();
  });

  it("opens meeting notes history in the shared history view", () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "work");
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    const sidebar = container.querySelector(".assistant-sidebar")!;
    fireEvent.click(sidebar.querySelector<HTMLButtonElement>('button[aria-label="Ghi chép cuộc họp"]')!);
    expect(container.querySelector('section[aria-label="Ghi chép cuộc họp"] button[aria-label="Lịch sử"]')).toBeNull();
    fireEvent.click(sidebar.querySelector<HTMLButtonElement>('button[aria-label="Lịch sử trò chuyện"]')!);
    const meetingTab = Array.from(container.querySelectorAll('div[aria-label="Loại lịch sử"] button')).find(button => button.textContent === "Ghi chép");
    expect(meetingTab?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Lịch sử Ghi chép sẽ xuất hiện khi tính năng này được kết nối.");
  });
});
