// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatbotWidget } from "./ChatbotWidget";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { displayName: "An", companyCode: "MAIN", uid: "test" } }),
}));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => null }));
vi.mock("../../services/assistantService", () => ({ assistantService: {
  settings: () => new Promise(() => undefined),
  state: () => new Promise(() => undefined),
  conversations: () => Promise.resolve({ items: [], nextCursor: null }),
  promptTemplates: () => Promise.resolve({
    templates: [
      {
        id: "igen-marketing-plan",
        title: "Lập kế hoạch nội dung mạng xã hội",
        description: "Tạo lịch nội dung theo mục tiêu, nhóm khách hàng và kênh truyền thông.",
        category: "Marketing",
        prompt: "Bạn là chuyên gia marketing. Hãy lập kế hoạch nội dung mạng xã hội trong [thời gian] cho [sản phẩm/dịch vụ], hướng đến [nhóm khách hàng]. Mục tiêu là [mục tiêu]. Trình bày thành bảng gồm ngày đăng, chủ đề, thông điệp, định dạng và lời kêu gọi hành động. Giữ giọng điệu [phong cách] và không tự thêm thông tin chưa được cung cấp.",
        owner: "igen",
      },
    ],
  }),
} }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe("ChatbotWidget welcome", () => {
  it.each(["qa", "work"] as const)("shows greeting and composer in %s mode", mode => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", mode);
    const markup = renderToStaticMarkup(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    const root = document.createElement("div");
    root.innerHTML = markup;
    const welcome = root.querySelector(".assistant-welcome");

    expect(welcome?.querySelector("h1")?.textContent).toContain(mode === "qa" ? "Chào An, tôi có thể giúp gì cho bạn?" : "Xin chào An, mình có thể giúp gì cho bạn?");
    expect(welcome?.querySelectorAll("form")).toHaveLength(1);
    expect(welcome?.querySelector("textarea")).not.toBeNull();
  });

  it("replaces the voice action with send while a message is typed in qa mode", () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "qa");
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    const input = container.querySelector<HTMLTextAreaElement>("#erp-chatbot-input")!;
    const composer = input.closest("form")!;

    expect(composer.querySelector('button[aria-label="Mở thư viện câu lệnh mẫu"]')).not.toBeNull();
    expect(composer.querySelector('button[type="submit"]')).toBeNull();

    fireEvent.change(input, { target: { value: "Hãy giúp tôi" } });
    expect(composer.querySelector('button[type="submit"]')).not.toBeNull();

    fireEvent.change(input, { target: { value: "   " } });
    expect(composer.querySelector('button[type="submit"]')).toBeNull();
  });

  it("replaces two-way voice with send while a message is typed in work mode", () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "work");
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    const input = container.querySelector<HTMLTextAreaElement>("#erp-chatbot-input")!;
    const composer = input.closest("form")!;

    expect(composer.querySelector('[aria-label="Bật chế độ 2 chiều"]')).not.toBeNull();
    expect(composer.querySelector('button[type="submit"]')).toBeNull();

    fireEvent.change(input, { target: { value: "Hãy giúp tôi" } });
    expect(composer.querySelector('[aria-label="Bật chế độ 2 chiều"]')).toBeNull();
    expect(composer.querySelector('button[type="submit"]')).not.toBeNull();

    fireEvent.change(input, { target: { value: "   " } });
    expect(composer.querySelector('[aria-label="Bật chế độ 2 chiều"]')).not.toBeNull();
    expect(composer.querySelector('button[type="submit"]')).toBeNull();
  });

  it("inserts a library prompt into the composer and shows editable placeholder chips", async () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "qa");
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);

    fireEvent.click(screen.getByRole("button", { name: "Mở thư viện câu lệnh mẫu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dùng mẫu: Lập kế hoạch nội dung mạng xã hội" }));

    const input = container.querySelector<HTMLTextAreaElement>("#erp-chatbot-input")!;
    expect(input.value).toContain("Bạn là chuyên gia marketing.");

    // Verify placeholder chips are displayed
    const placeholderRegion = container.querySelector('[aria-label="Các vị trí cần điền"]');
    expect(placeholderRegion).not.toBeNull();
    expect(placeholderRegion?.textContent).toContain("[thời gian]");
    expect(placeholderRegion?.textContent).toContain("[sản phẩm/dịch vụ]");

    // Clicking a placeholder chip selects that text in the textarea
    const timeChip = screen.getByRole("button", { name: /thời gian/i });
    fireEvent.click(timeChip);
    expect(input.selectionStart).toBe(input.value.indexOf("[thời gian]"));
    expect(input.selectionEnd).toBe(input.value.indexOf("[thời gian]") + "[thời gian]".length);
  }, 15000);

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
