// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantQuickPromptSuggestions, ChatbotWidget } from "./ChatbotWidget";
import { assistantService } from "../../services/assistantService";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { displayName: "An", companyCode: "MAIN", uid: "test" } }),
}));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => null }));
vi.mock("../../services/assistantService", () => ({ assistantService: {
  projects: () => Promise.resolve([]),
  saveProjects: (projects: unknown[]) => Promise.resolve(projects),
  settings: () => new Promise(() => undefined),
  state: vi.fn(() => new Promise(() => undefined)),
  turn: vi.fn(),
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
vi.mock("./assistant-table-file", () => ({
  readAssistantTableFile: vi.fn(async (file: File) => ({
    fileName: file.name,
    headers: ["Học viên"],
    rows: [{ "Học viên": "Minh" }],
  })),
}));
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

afterEach(() => {
  cleanup(); localStorage.clear();
  if (originalCreateObjectURL) Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
  vi.clearAllMocks();
  vi.mocked(assistantService.state).mockImplementation(() => new Promise(() => undefined));
  vi.mocked(assistantService.turn).mockReset();
});

describe("ChatbotWidget welcome", () => {
  it("keeps the Trợ lý AI tab locked in desktop and mobile navigation", () => {
    const { container } = render(<ChatbotWidget storageScope="agents-navigation-test" mode="standalone" />);
    const sidebar = container.querySelector(".assistant-sidebar")!;
    const agentButton = sidebar.querySelector<HTMLButtonElement>('button[aria-label="Trợ lý AI"]')!;
    const historyButton = sidebar.querySelector<HTMLButtonElement>('button[aria-label="Lịch sử trò chuyện"]')!;
    expect(agentButton.compareDocumentPosition(historyButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(agentButton.disabled).toBe(true);
    fireEvent.click(agentButton);
    const mobileAgent = Array.from(container.querySelectorAll<HTMLButtonElement>(".assistant-mobile-mode-nav button")).find(button => button.textContent?.includes("Trợ lý AI"))!;
    expect(mobileAgent.disabled).toBe(true);
    fireEvent.click(mobileAgent);
    expect(screen.queryByRole("button", { name: "Tạo Trợ lý AI" })).toBeNull();
  });

  it("keeps the Dự án tab locked in desktop and mobile navigation", () => {
    const { container } = render(<ChatbotWidget storageScope="projects-navigation-test" mode="standalone" />);
    const desktopProjects = container.querySelector<HTMLButtonElement>('.assistant-sidebar button[aria-label="Dự án"]')!;
    const mobileProjects = Array.from(container.querySelectorAll<HTMLButtonElement>('.assistant-mobile-mode-nav button')).find(button => button.textContent?.includes("Dự án"))!;

    expect(desktopProjects.disabled).toBe(true);
    fireEvent.click(desktopProjects);
    expect(screen.queryByRole("heading", { name: "Dự án" })).toBeNull();
    expect(desktopProjects.querySelector("svg")).not.toBeNull();
    expect(container.querySelector('.assistant-sidebar button[aria-label="Mở danh sách dự án"]')).toBeNull();
    expect(mobileProjects.disabled).toBe(true);
    fireEvent.click(mobileProjects);
    expect(screen.queryByRole("heading", { name: "Dự án" })).toBeNull();
  });

  it("mounts AI Studio on demand and preserves it when switching views", () => {
    localStorage.setItem("igen_erp_chatbot_mode:studio-switch-test:company", "qa");
    const { container } = render(<ChatbotWidget storageScope="studio-switch-test" mode="standalone" />);

    expect(container.querySelector('section[aria-label="AI Studio"]')).toBeNull();
    const studioButton = container.querySelector<HTMLButtonElement>('nav[aria-label="Chế độ trợ lý"] button[aria-label="AI Studio"]')!;
    const toolsButton = container.querySelector<HTMLButtonElement>('nav[aria-label="Chế độ trợ lý"] button[aria-label="Công cụ trợ lý"]')!;
    fireEvent.click(studioButton);
    const studio = container.querySelector('section[aria-label="AI Studio"]');
    expect(studio).not.toBeNull();

    fireEvent.click(toolsButton);
    expect(container.querySelector('section[aria-label="AI Studio"]')).toBe(studio);
    fireEvent.click(studioButton);
    expect(container.querySelector('section[aria-label="AI Studio"]')).toBe(studio);
  });

  it("keeps the prompt library out of the compact popup composer", async () => {
    localStorage.setItem("igen_erp_chatbot_mode:popup-test:company", "qa");
    const originalShowPopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "showPopover");
    Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: vi.fn() });
    try {
      const { container } = render(<ChatbotWidget storageScope="popup-test" mode="popup" headerPanel openRequest={1} />);

      await waitFor(() => expect(container.querySelector("form")).not.toBeNull());
      expect(container.querySelector('button[aria-label="Mở thư viện câu lệnh mẫu"]')).toBeNull();
    } finally {
      if (originalShowPopover) Object.defineProperty(HTMLElement.prototype, "showPopover", originalShowPopover);
      else delete (HTMLElement.prototype as HTMLElement & { showPopover?: () => void }).showPopover;
    }
  });

  it("keeps suggested prompts left-aligned and wrapped in narrow chat layouts", () => {
    const onSelect = vi.fn();
    render(<div style={{ width: "22rem" }}><AssistantQuickPromptSuggestions mode="qa" disabled={false} onSelect={onSelect} /></div>);
    const group = screen.getByRole("group", { name: "Gợi ý câu hỏi" });

    expect(group.classList.contains("w-full")).toBe(true);
    expect(group.classList.contains("min-w-0")).toBe(true);
    expect(group.classList.contains("justify-start")).toBe(true);
    for (const suggestion of Array.from(group.querySelectorAll("button"))) {
      expect(suggestion.classList.contains("min-w-0")).toBe(true);
      expect(suggestion.classList.contains("max-w-full")).toBe(true);
      expect(suggestion.classList.contains("whitespace-normal")).toBe(true);
      expect(suggestion.classList.contains("break-words")).toBe(true);
      expect(suggestion.classList.contains("text-left")).toBe(true);
      fireEvent.click(suggestion);
    }
    expect(onSelect).toHaveBeenCalledTimes(group.querySelectorAll("button").length);
  });

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

  it("sends an attached table with a question in chat mode and clears the upload preview", async () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "qa");
    vi.mocked(assistantService.state).mockResolvedValue({ messages: [], lastReply: null, busy: false, mode: "qa" });
    let finishTurn!: (result: Awaited<ReturnType<typeof assistantService.turn>>) => void;
    vi.mocked(assistantService.turn).mockReturnValue(new Promise(resolve => { finishTurn = resolve; }));
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Đính kèm tệp" }) as HTMLButtonElement).disabled).toBe(false));

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [new File(["Học viên\nMinh"], "danh_sach.csv", { type: "text/csv" })] } });
    await screen.findByText("1 dòng · sẵn sàng gửi");
    const input = container.querySelector<HTMLTextAreaElement>("#erp-chatbot-input")!;
    fireEvent.change(input, { target: { value: "Tóm tắt tệp này" } });
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    await waitFor(() => expect(assistantService.turn).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("1 dòng · sẵn sàng gửi")).toBeNull());
    finishTurn({ status: "completed", reply: "done" });
    expect(vi.mocked(assistantService.turn).mock.calls[0]?.[0]).toMatchObject({
      mode: "qa",
      text: "Tóm tắt tệp này",
      attachment: { fileName: "danh_sach.csv", rows: [{ "Học viên": "Minh" }] },
    });
    await waitFor(() => expect(screen.queryByText("1 dòng · sẵn sàng gửi")).toBeNull());
  });

  it("sends a PDF file with its question and clears the composer preview", async () => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "qa");
    vi.mocked(assistantService.state).mockResolvedValue({ messages: [], lastReply: null, busy: false, mode: "qa" });
    vi.mocked(assistantService.turn).mockResolvedValue({ status: "completed", reply: "Đã đọc tài liệu." });
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Đính kèm tệp" }) as HTMLButtonElement).disabled).toBe(false));

    const file = new File(["%PDF-1.7"], "huong-dan.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [file] } });
    expect(await screen.findByText("Tệp sẽ được đọc khi gửi")).toBeTruthy();
    fireEvent.change(container.querySelector<HTMLTextAreaElement>("#erp-chatbot-input")!, { target: { value: "Tóm tắt tài liệu này" } });
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    await waitFor(() => expect(assistantService.turn).toHaveBeenCalled());
    expect(vi.mocked(assistantService.turn).mock.calls.at(-1)?.[0]).toMatchObject({
      mode: "qa",
      text: "Tóm tắt tài liệu này",
      file,
    });
    await waitFor(() => expect(screen.queryByText("Tệp sẽ được đọc khi gửi")).toBeNull());
  });

  it.each([
    { fileName: "logo.png", mimeType: "image/png", selector: "img", label: "Xem trước ảnh logo.png" },
    { fileName: "gioi-thieu.mp4", mimeType: "video/mp4", selector: "video", label: "Xem trước video gioi-thieu.mp4" },
  ])("shows a direct preview for $selector attachments", async ({ fileName, mimeType, selector, label }) => {
    localStorage.setItem("igen_erp_chatbot_mode:welcome-test:company", "qa");
    vi.mocked(assistantService.state).mockResolvedValue({ messages: [], lastReply: null, busy: false, mode: "qa" });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:chat-preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const { container } = render(<ChatbotWidget storageScope="welcome-test" mode="standalone" />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Đính kèm tệp" }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File(["media"], fileName, { type: mimeType })] },
    });

    const preview = selector === "img"
      ? await screen.findByAltText(label)
      : await screen.findByLabelText(label);
    expect(preview.tagName.toLocaleLowerCase()).toBe(selector);
    expect(preview.getAttribute("src")).toBe("blob:chat-preview");
    if (selector === "video") expect(preview.hasAttribute("controls")).toBe(true);
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
