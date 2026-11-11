// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAssistantSettings } from "../../shared/assistant-workflow";
import { parseAssistantResultTable } from "./assistant-message-format";
const mocks = vi.hoisted(() => ({ settings: vi.fn(), state: vi.fn(), turn: vi.fn(), speech: vi.fn(), conversations: vi.fn(), branchId: "", companyCode: "" }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: mocks.companyCode } }) }));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => ({ activeBranchId: mocks.branchId }) }));
vi.mock("../../services/assistantService", () => ({ assistantService: { settings: mocks.settings, state: mocks.state, turn: mocks.turn, speech: mocks.speech, conversations: mocks.conversations } }));
import { ChatbotWidget } from "./ChatbotWidget";
const originalDialogMethods = ["showModal", "close"].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)] as const);
const open = async () => {
  const event = new Event("toggle"); Object.defineProperty(event, "newState", { value: "open" });
  fireEvent(document.getElementById("erp-chatbot-panel")!, event);
  await waitFor(() => expect(mocks.state).toHaveBeenCalled());
  await screen.findByLabelText("Tin nhắn cho trợ lý ảo");
};
const send = async (text: string) => {
  fireEvent.change(screen.getByLabelText("Tin nhắn cho trợ lý ảo"), { target: { value: text } });
  fireEvent.submit(screen.getByLabelText("Tin nhắn cho trợ lý ảo").closest("form")!);
};
beforeEach(() => {
  localStorage.clear(); mocks.settings.mockReset().mockResolvedValue(defaultAssistantSettings); mocks.branchId = ""; mocks.companyCode = "company-a"; mocks.state.mockReset().mockResolvedValue({ messages: [], lastReply: null, busy: false }); mocks.turn.mockReset(); mocks.speech.mockReset(); mocks.conversations.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  for (const [name, descriptor] of originalDialogMethods) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
describe("ChatbotWidget workflow conversation", () => {
  it("restores generated files on their original messages when reopening a conversation", async () => {
    mocks.state.mockResolvedValueOnce({ messages: [{ role: "assistant", content: "Tài liệu đã sẵn sàng.", files: [{ id: "file-a", documentId: "doc-a", conversationId: "conversation-a", version: 1, fileName: "Kế hoạch-v1.pdf", format: "pdf", mimeType: "application/pdf", size: 2048 }] }], lastReply: null, busy: false });
    render(<ChatbotWidget mode="standalone" storageScope="company:user-a" />);
    expect(await screen.findByRole("button", { name: "Tải xuống Kế hoạch-v1.pdf" })).toBeTruthy();
    expect(screen.getByText("Tài liệu đã sẵn sàng.").closest('[aria-hidden="true"]')).toBeNull();
  });

  it("renders a standalone assistant workspace without the floating launcher", async () => {
    render(<ChatbotWidget mode="standalone" storageScope="company:user-a" />);
    await waitFor(() => expect(mocks.state).toHaveBeenCalled());
    expect(await screen.findByRole("region", { name: "Trợ lý ảo AI" })).toBeTruthy();
    expect(screen.getByLabelText("Tin nhắn cho trợ lý ảo")).toBeTruthy();
    expect(screen.queryByLabelText("Mở trợ lý ảo AI")).toBeNull();
  });

  it("shows an avatar beside both user and assistant messages", async () => {
    mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Mình nghe bạn." });
    render(<ChatbotWidget mode="standalone" storageScope="company:user-a" />);
    await waitFor(() => expect(mocks.state).toHaveBeenCalled());
    await send("Xin chào trợ lý");
    await screen.findByText("Mình nghe bạn.");

    const log = screen.getByRole("log", { name: "Nội dung trò chuyện" });
    expect(log.querySelector(".assistant-user-avatar svg")).not.toBeNull();
    expect(log.querySelector('.assistant-message-avatar img[src="/assistant-igen-head.webp"]')).not.toBeNull();
  });

  it("shows the assistant composing before revealing its answer gradually", async () => {
    const reply = "Mình sẽ hiển thị câu trả lời theo từng ký tự khi đã soạn xong.";
    let finishTurn: (result: { status: "completed"; reply: string }) => void = () => undefined;
    mocks.turn.mockReturnValueOnce(new Promise<{ status: "completed"; reply: string }>(resolve => { finishTurn = resolve; }));
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })));
    render(<ChatbotWidget mode="standalone" storageScope="company:user-a" />);
    await waitFor(() => expect(mocks.state).toHaveBeenCalled());
    await send("Trả lời từ từ giúp mình");
    expect(await screen.findByText("Đang nghiên cứu và đối chiếu nhiều nguồn…")).toBeTruthy();

    finishTurn({ status: "completed", reply });
    const log = screen.getByRole("log", { name: "Nội dung trò chuyện" });
    const reveal = await waitFor(() => {
      const element = log.querySelector(".assistant-message-reveal");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(reveal.textContent).not.toBe(reply);
    await waitFor(() => expect(log.querySelector(".assistant-message-final")?.textContent).toBe(reply), { timeout: 8000 });
  }, 15000);

  it("keeps work and Q&A conversations separate and sends the active mode", async () => {
    mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Nước sôi ở 100°C ở áp suất khí quyển tiêu chuẩn." });
    render(<ChatbotWidget mode="standalone" storageScope="company:user-a" />);
    await waitFor(() => expect(mocks.state).toHaveBeenCalled());
    const workConversationId = mocks.state.mock.calls[0][0];
    const workspaceNavigation = screen.getByRole("complementary", { name: "Điều hướng trợ lý" });
    const modeTabs = within(workspaceNavigation).getByRole("group", { name: "Chế độ trợ lý" });
    expect(within(modeTabs).getByRole("button", { name: "Thao tác" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(modeTabs).getByRole("button", { name: "Hỏi đáp" }));
    await screen.findByPlaceholderText("Bạn muốn hỏi điều gì?");
    expect(within(modeTabs).getByRole("button", { name: "Hỏi đáp" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(mocks.state).toHaveBeenCalledTimes(2));
    const qaConversationId = mocks.state.mock.calls[1][0];
    expect(qaConversationId).not.toBe(workConversationId);
    expect(screen.queryByLabelText("Đính kèm tệp CSV hoặc Excel")).toBeNull();

    await send("Nước sôi ở nhiệt độ bao nhiêu?");
    await screen.findByText("Nước sôi ở 100°C ở áp suất khí quyển tiêu chuẩn.");
    expect(mocks.turn.mock.calls[0][0]).toMatchObject({ conversationId: qaConversationId, mode: "qa" });

    fireEvent.click(within(modeTabs).getByRole("button", { name: "Thao tác" }));
    await screen.findByPlaceholderText("Hỏi tôi bất cứ điều gì");
    await waitFor(() => expect(mocks.state).toHaveBeenCalledTimes(3));
    expect(mocks.state.mock.calls[2][0]).toBe(workConversationId);
  });

  it("previews and sends spreadsheet rows with the assistant request", async () => {
    mocks.turn.mockResolvedValueOnce({ status: "confirmation", reply: "Bạn kiểm tra danh sách nhé.", action: { id: "preview", title: "Tạo nhiều hồ sơ lao động", values: [{ label: "Danh sách lao động", value: "1 dòng từ lao-dong.csv" }] } });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    const file = new File(["Họ và tên,Số điện thoại\nChung Abc,0987654321"], "lao-dong.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(0) });
    Object.defineProperty(file, "text", { value: async () => "Họ và tên,Số điện thoại\nChung Abc,0987654321" });
    fireEvent.change(screen.getByLabelText("Chọn tệp CSV hoặc Excel"), { target: { files: [file] } });
    await screen.findByText("lao-dong.csv");
    expect(screen.getByText("Chung Abc")).toBeTruthy();
    await send("Tạo hàng loạt lao động từ tệp");
    await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce());
    expect(mocks.turn.mock.calls[0][0].attachment).toEqual({ fileName: "lao-dong.csv", headers: ["Họ và tên", "Số điện thoại"], rows: [{ "Họ và tên": "Chung Abc", "Số điện thoại": "0987654321" }] });
    expect(await screen.findByText("Bạn kiểm tra danh sách nhé.")).toBeTruthy();
    expect(screen.getByText("1 dòng · đã gửi cho trợ lý")).toBeTruthy();
    expect(JSON.stringify(localStorage)).not.toContain("0987654321");
  });

  it("sends the selected branch's POS device with assistant turns", async () => {
    mocks.branchId = "branch-b";
    localStorage.setItem("igen.pos.terminal.v1:company-a:branch-b", "terminal-b");
    mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Ca POS đã được tiếp tục." });
    render(<ChatbotWidget storageScope="company-a:user-a" />); await open();
    await send("Tiếp tục ca POS"); await screen.findByText("Ca POS đã được tiếp tục.");
    expect(mocks.turn.mock.calls[0][3]).toBe("terminal-b");
  });

  it("shows missing fields and explicit confirmation returned by the server", async () => {
    mocks.turn.mockResolvedValueOnce({ status: "collecting", reply: "Vui lòng bổ sung ngày sinh và email." }).mockResolvedValueOnce({ status: "confirmation", reply: "Kiểm tra thông tin", action: { id: "preview", title: "Tạo nhân sự", values: [{ label: "Lương tháng", value: 0, defaulted: true }] } }).mockResolvedValueOnce({ status: "completed", reply: "Đã tạo nhân sự." });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    await send("Thêm Chung"); await screen.findByText("Vui lòng bổ sung ngày sinh và email.");
    await waitFor(() => expect(document.querySelector(".assistant-message-reveal")).toBeNull(), { timeout: 4000 });
    await send("Sinh 12/03/1994, chung@example.test"); await screen.findByText("Xác nhận thực hiện", {}, { timeout: 4000 });
    expect(screen.queryByText("0 (mặc định)")).toBeNull();
    expect(screen.queryByText("Lương tháng")).toBeNull();
    fireEvent.click(screen.getByText("Xác nhận thực hiện")); await screen.findByText("Đã tạo nhân sự.");
    expect(mocks.turn.mock.calls[2][0].decision).toEqual({ id: "preview", confirmed: true });
    expect(mocks.turn.mock.calls[0][0]).not.toHaveProperty("messages");
  }, 10_000);
  it("keeps explicitly supplied zero values in the confirmation preview", async () => {
    mocks.state.mockResolvedValue({ messages: [{ role: "assistant", content: "Bạn kiểm tra và xác nhận nhé?" }], busy: false, lastReply: { status: "confirmation", reply: "Bạn kiểm tra và xác nhận nhé?", action: { id: "preview-explicit", title: "Tạo nhân sự", values: [
      { label: "Lương tháng", value: 0, defaulted: false },
      { label: "Trạng thái", value: "active", defaulted: true },
    ] } } });
    render(<ChatbotWidget mode="standalone" storageScope="company:user-a" />);
    await waitFor(() => expect(mocks.state).toHaveBeenCalled());
    const preview = await screen.findByRole("region", { name: "Bản xem trước thao tác" });
    expect(within(preview).getByText("Lương tháng")).toBeTruthy();
    expect(within(preview).getByText("0")).toBeTruthy();
    expect(within(preview).queryByText("Trạng thái")).toBeNull();
    expect(within(preview).getByRole("button", { name: "Xác nhận thực hiện" })).toBeTruthy();
  });
  it("collects training lessons and quiz questions through the inline form", async () => {
    mocks.turn.mockResolvedValueOnce({
      status: "collecting",
      reply: "Bạn có thể bổ sung bài giảng và câu hỏi tại đây.",
      action: { id: "training-create", title: "Tạo khóa đào tạo", values: [] },
      trainingContentForm: { lessons: [], quizzes: [] },
    }).mockResolvedValueOnce({
      status: "confirmation",
      reply: "Mời bạn kiểm tra lại nội dung khóa đào tạo.",
      action: { id: "training-preview", title: "Tạo khóa đào tạo", values: [] },
    });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    await send("Tạo khóa đào tạo mới");
    await screen.findByRole("heading", { name: "Bổ sung bài giảng và câu hỏi", hidden: true });

    const addLessonButton = screen.getByRole("button", { name: "Thêm bài giảng", hidden: true }) as HTMLButtonElement;
    expect(addLessonButton.disabled).toBe(false);
    fireEvent.click(addLessonButton);
    expect(screen.getByRole("heading", { name: "Bài giảng 2", hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bài giảng 2", hidden: true }));

    const addQuizButton = screen.getByRole("button", { name: "Thêm câu hỏi", hidden: true }) as HTMLButtonElement;
    expect(addQuizButton.disabled).toBe(false);
    fireEvent.click(addQuizButton);
    expect(screen.getByRole("heading", { name: "Câu hỏi 2", hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa câu hỏi 2", hidden: true }));

    fireEvent.change(screen.getByLabelText("Tên bài giảng"), { target: { value: "Giới thiệu PLC" } });
    fireEvent.change(screen.getByLabelText("Nội dung bài giảng"), { target: { value: "Các thành phần cơ bản của PLC." } });
    fireEvent.change(screen.getByLabelText("Nội dung câu hỏi"), { target: { value: "PLC dùng để làm gì?" } });
    fireEvent.change(screen.getByPlaceholderText("Phương án 1"), { target: { value: "Điều khiển tự động" } });
    fireEvent.change(screen.getByPlaceholderText("Phương án 2"), { target: { value: "Thiết kế đồ họa" } });
    fireEvent.click(screen.getByRole("radio", { name: "Đáp án đúng: phương án 1", hidden: true }));

    fireEvent.click(screen.getByRole("button", { name: "Gửi nội dung", hidden: true }));
    await screen.findByText("Mời bạn kiểm tra lại nội dung khóa đào tạo.");
    expect(mocks.turn.mock.calls[1][0].trainingContent).toEqual({
      lessons: [{ title: "Giới thiệu PLC", type: "text", url: "", content: "Các thành phần cơ bản của PLC." }],
      quizzes: [{ question: "PLC dùng để làm gì?", options: ["Điều khiển tự động", "Thiết kế đồ họa"], correctOptionIndex: 0 }],
    });
    expect(screen.getByText("Đã nhập 1 bài giảng và 1 câu hỏi trắc nghiệm.")).toBeTruthy();
  });
  it("keeps lesson and quiz controls editable while the conversation is syncing", async () => {
    mocks.state.mockResolvedValueOnce({
      messages: [
        { role: "user", content: "Tạo khóa đào tạo" },
        { role: "assistant", content: "Bạn có thể bổ sung bài giảng và câu hỏi tại đây." },
      ],
      busy: true,
      lastReply: {
        status: "collecting",
        reply: "Bạn có thể bổ sung bài giảng và câu hỏi tại đây.",
        action: { id: "training-create", title: "Tạo khóa đào tạo", values: [] },
        trainingContentForm: { lessons: [], quizzes: [] },
      },
    });
    render(<ChatbotWidget storageScope="company:user-a" />);
    const event = new Event("toggle"); Object.defineProperty(event, "newState", { value: "open" });
    fireEvent(document.getElementById("erp-chatbot-panel")!, event);
    await waitFor(() => expect(mocks.state).toHaveBeenCalled());

    const addLessonButton = await screen.findByRole("button", { name: "Thêm bài giảng", hidden: true }) as HTMLButtonElement;
    expect(addLessonButton.disabled).toBe(false);
    fireEvent.click(addLessonButton);
    expect(screen.getByRole("heading", { name: "Bài giảng 2", hidden: true })).toBeTruthy();

    const addQuizButton = screen.getByRole("button", { name: "Thêm câu hỏi", hidden: true }) as HTMLButtonElement;
    expect(addQuizButton.disabled).toBe(false);
    fireEvent.click(addQuizButton);
    expect(screen.getByRole("heading", { name: "Câu hỏi 2", hidden: true })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Đang đồng bộ phiên…", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("displays course-category options and submits the selected option", async () => {
    mocks.turn.mockResolvedValueOnce({
      status: "collecting",
      reply: "Bạn chọn danh mục khóa học nhé.",
      referenceSelections: [{
        key: "category",
        label: "Danh mục khóa học",
        required: true,
        multiple: false,
        options: [
          { value: "Lập trình PLC", label: "Lập trình PLC" },
          { value: "Tự động hóa", label: "Tự động hóa" },
        ],
      }],
    }).mockResolvedValueOnce({ status: "confirmation", reply: "Kiểm tra thông tin khóa học." });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    await send("Tạo khóa học mới");
    await screen.findByText("Chọn thông tin liên quan");
    expect(screen.getByText("Danh mục khóa học")).toBeTruthy();
    expect(screen.getByLabelText("Lập trình PLC")).toBeTruthy();
    expect(screen.getByLabelText("Tự động hóa")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Lập trình PLC"));
    fireEvent.click(screen.getByText("Dùng lựa chọn"));
    await screen.findByText("Kiểm tra thông tin khóa học.");
    expect(mocks.turn.mock.calls[1][0].referenceSelections).toEqual({ category: ["Lập trình PLC"] });
  });
  it("renders consistent numbered lookup results as an accessible table", async () => {
    const reply = [
      "Mình tìm thấy 2 kết quả phù hợp cho bạn.",
      "1. Họ và tên: Nguyễn An · Phòng ban: IT · Bộ phận: Nhân sự",
      "2. Họ và tên: Lê Bình · Phòng ban: Kế toán · Bộ phận: Tài chính",
    ].join("\n");
    expect(parseAssistantResultTable(reply)).not.toBeNull();
    mocks.turn.mockResolvedValueOnce({
      status: "completed",
      reply,
    });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    await send("Liệt kê nhân sự");

    await screen.findByText("Mình tìm thấy 2 kết quả phù hợp cho bạn.");
    expect(document.querySelector("#erp-chatbot-panel table")).toBeTruthy();
    const table = document.querySelector("#erp-chatbot-panel table");
    expect(table?.getAttribute("aria-label")).toBe("Kết quả tra cứu");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2);
    expect([...table!.querySelectorAll("thead th")].map(header => header.textContent)).toEqual(["STT", "Họ và tên", "Phòng ban", "Bộ phận"]);
    expect(screen.getByText("Mình tìm thấy 2 kết quả phù hợp cho bạn.")).toBeTruthy();
    expect(screen.getByText("Nguyễn An")).toBeTruthy();
  });
  it("reuses the same request id after a network failure instead of creating a second mutation", async () => {
    mocks.turn.mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce({ status: "completed", reply: "Đã tạo hồ sơ." });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    await send("Thêm Chung"); await screen.findByText("Mất kết nối");
    fireEvent.click(screen.getByText("Kiểm tra lại yêu cầu")); await screen.findByText("Đã tạo hồ sơ.");
    expect(mocks.turn.mock.calls[0][0]).toEqual(mocks.turn.mock.calls[1][0]);
    expect(screen.getAllByText("Thêm Chung")).toHaveLength(1);
  });
  it("isolates conversation ids by branch and aborts transport on account changes", async () => {
    mocks.turn.mockImplementation(() => new Promise(() => {}));
    const view = render(<ChatbotWidget storageScope="company:user-a" />); await open();
    const previousId = mocks.state.mock.calls[0][0]; await send("Thêm Chung");
    await waitFor(() => expect(mocks.turn).toHaveBeenCalledTimes(1));
    mocks.branchId = "branch-b"; view.rerender(<ChatbotWidget storageScope="company:user-a" />);
    expect(mocks.turn.mock.calls[0][1].aborted).toBe(true);
    mocks.state.mockClear(); await open(); expect(mocks.state.mock.calls[0][0]).not.toBe(previousId);
    expect(screen.queryByText("Thêm Chung")).toBeNull();
  });
  it("lists previous conversations and opens them in read-only mode", async () => {
    const oldConversationId = crypto.randomUUID();
    mocks.conversations.mockResolvedValueOnce({ items: [{ conversationId: oldConversationId, title: "Tạo nhân sự An", preview: "Đã tạo nhân sự.", messageCount: 4, updatedAt: "2026-10-28T08:00:00.000Z" }], nextCursor: null });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    mocks.state.mockResolvedValueOnce({
      messages: [{ role: "user", content: "Tạo nhân sự An" }, { role: "assistant", content: "Phiên cũ đã có nội dung." }],
      lastReply: { status: "confirmation", reply: "Xác nhận cũ", action: { id: "old-preview", title: "Tạo nhân sự", values: [] } },
      busy: false,
    });
    fireEvent.click(screen.getByText("Lịch sử"));
    fireEvent.click((await screen.findByText("Tạo nhân sự An")).closest("button")!);
    await screen.findByText("Phiên cũ đã có nội dung.");
    await screen.findByText("Đang xem lại phiên cũ. Phiên này ở chế độ chỉ đọc.");
    expect(mocks.state.mock.calls.at(-1)?.[0]).toBe(oldConversationId);
    expect(screen.getByText("Đang xem lại phiên cũ. Phiên này ở chế độ chỉ đọc.")).toBeTruthy();
    expect(screen.queryByText("Xác nhận thực hiện")).toBeNull();
    expect(screen.queryByLabelText("Tin nhắn cho trợ lý ảo")).toBeNull();
    expect(mocks.turn).not.toHaveBeenCalled();
  });
  it("continues an old conversation using its existing id and restores the composer", async () => {
    const oldConversationId = crypto.randomUUID();
    const oldState = {
      messages: [{ role: "user" as const, content: "Tạo nhân sự An" }, { role: "assistant" as const, content: "Phiên cũ đã có nội dung." }],
      lastReply: null,
      busy: false,
    };
    mocks.conversations.mockResolvedValueOnce({ items: [{ conversationId: oldConversationId, title: "Tạo nhân sự An", preview: "Cuộc trò chuyện trước đây.", messageCount: 4, updatedAt: "2026-10-28T08:00:00.000Z" }], nextCursor: null });
    mocks.state.mockImplementation(async (id: string) => id === oldConversationId ? oldState : { messages: [], lastReply: null, busy: false });
    mocks.turn.mockResolvedValueOnce({ status: "collecting", reply: "Mình sẽ tiếp tục trong phiên cũ." });
    render(<ChatbotWidget storageScope="company:user-a" />); await open();
    fireEvent.click(screen.getByText("Lịch sử"));
    fireEvent.click((await screen.findByText("Tạo nhân sự An")).closest("button")!);
    await screen.findByText("Phiên cũ đã có nội dung.");
    fireEvent.click(screen.getByText("Tiếp tục phiên này"));
    await screen.findByLabelText("Tin nhắn cho trợ lý ảo");
    await send("Thêm thông tin còn thiếu");
    await screen.findByText("Mình sẽ tiếp tục trong phiên cũ.");

    expect(mocks.state.mock.calls.filter(([id]) => id === oldConversationId).length).toBeGreaterThanOrEqual(2);
    expect(mocks.turn.mock.calls[0][0].conversationId).toBe(oldConversationId);
    expect(localStorage.getItem("igen_erp_chatbot_history:company:user-a:company:conversation")).toBe(oldConversationId);
  });
});

it("keeps account passwords out of browser storage and sends them only with confirmation", async () => {
  mocks.turn.mockResolvedValueOnce({ status: "confirmation", reply: "Nhập mật khẩu riêng", action: { id: "preview", title: "Tạo nhân sự", requiresPassword: true, values: [] } }).mockImplementationOnce(() => new Promise(() => {}));
  render(<ChatbotWidget storageScope="company:user-a" />); await open(); await send("Tạo nhân sự Chung");
  await screen.findByText("Nhập mật khẩu riêng");
  expect((screen.getByText("Xác nhận thực hiện") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Mật khẩu khởi tạo"), { target: { value: "Do-not-store-this-password" } });
  fireEvent.click(screen.getByText("Xác nhận thực hiện"));
  await waitFor(() => expect(mocks.turn).toHaveBeenCalledTimes(2));
  expect(mocks.turn.mock.calls[1][0].decision.password).toBe("Do-not-store-this-password");
  expect(JSON.stringify(localStorage)).not.toContain("Do-not-store-this-password");
});

it("applies saved fullscreen and Enter behavior while allowing Shift Enter", async () => {
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, windowMode: "fullscreen", enterToSend: false });
  render(<ChatbotWidget storageScope="company:user-a" />); await open();
  expect(document.getElementById("erp-chatbot-panel")?.dataset.fullscreen).toBe("true");
  const input = screen.getByLabelText("Tin nhắn cho trợ lý ảo");
  fireEvent.change(input, { target: { value: "Yêu cầu nhiều dòng" } });
  fireEvent.keyDown(input, { key: "Enter" }); expect(mocks.turn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Thu về cửa sổ lớn"));
  expect(document.getElementById("erp-chatbot-panel")?.dataset.fullscreen).toBe("false");
});

it("plays OpenRouter MP3 for replies and lets the user stop playback", async () => {
  class AudioMock {
    static instances: AudioMock[] = [];
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    constructor(public src: string) { AudioMock.instances.push(this); }
  }
  const createObjectURL = vi.fn(() => "blob:assistant-speech");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", class extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL; });
  vi.stubGlobal("Audio", AudioMock);
  mocks.speech.mockResolvedValue(new Blob(["MP3"], { type: "audio/mpeg" }));
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, speakReplies: true, speechVoice: "george" });
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Đã tạo hồ sơ." });
  render(<ChatbotWidget storageScope="company:user-a" />); await open(); await send("Tạo hồ sơ");
  await screen.findByText("Đã tạo hồ sơ.");
  await screen.findByLabelText("Dừng đọc câu trả lời");
  await waitFor(() => expect(AudioMock.instances).toHaveLength(1));
  expect(mocks.speech).toHaveBeenCalledWith("Đã tạo hồ sơ.", expect.any(AbortSignal), "george");
  expect(AudioMock.instances[0].src).toBe("blob:assistant-speech");
  expect(AudioMock.instances[0].play).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByLabelText("Dừng đọc câu trả lời"));
  expect(AudioMock.instances[0].pause).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:assistant-speech");
});

it("shows OpenRouter speech errors beside the composer", async () => {
  mocks.speech.mockRejectedValue(new Error("Tài khoản OpenRouter không đủ số dư để tạo giọng nói."));
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, speakReplies: true });
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Đã tạo hồ sơ." });
  render(<ChatbotWidget storageScope="company:user-a" />); await open(); await send("Tạo hồ sơ");
  await screen.findByText("Đã tạo hồ sơ.");
  await screen.findByText("Tài khoản OpenRouter không đủ số dư để tạo giọng nói.");
  expect(screen.queryByLabelText("Dừng đọc câu trả lời")).toBeNull();
});

it("opens on Hey Igen, submits the spoken request, and resumes waiting", async () => {
  class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn();
    abort = vi.fn();
    constructor() { FakeSpeechRecognition.instances.push(this); }
  }
  FakeSpeechRecognition.instances = [];
  vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, wakeWordEnabled: true });
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Mình đã nhận yêu cầu." });
  render(<ChatbotWidget storageScope="company:user-a" />); await open();
  await waitFor(() => expect(FakeSpeechRecognition.instances).toHaveLength(1));
  const recognition = FakeSpeechRecognition.instances[0];
  expect(screen.getByText("Đang chờ “Hey Igen”. Hãy nói từ khóa rồi nêu yêu cầu.")).toBeTruthy();
  recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Hey Igen, tạo nhân sự Chung" } }] });
  await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce(), { timeout: 4000 });
  expect(mocks.turn.mock.calls[0][0].text).toBe("tạo nhân sự Chung");
  expect(await screen.findByText("Mình đã nhận yêu cầu.")).toBeTruthy();
  await waitFor(() => expect(FakeSpeechRecognition.instances.length).toBeGreaterThan(1));
  fireEvent.click(screen.getByLabelText("Nhập yêu cầu bằng giọng nói"));
  await waitFor(() => expect(FakeSpeechRecognition.instances.length).toBeGreaterThan(2));
  expect(screen.getByLabelText("Dừng nhận giọng nói")).toBeTruthy();
});

it("recognizes Hey Igen when speech recognition splits the wake phrase into results", async () => {
  class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn();
    abort = vi.fn();
    constructor() { FakeSpeechRecognition.instances.push(this); }
  }
  vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, wakeWordEnabled: true });
  let resolveState: ((value: { messages: never[]; lastReply: null; busy: boolean }) => void) | undefined;
  mocks.state.mockImplementationOnce(() => new Promise<{ messages: never[]; lastReply: null; busy: boolean }>(resolve => { resolveState = resolve; }));
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Đã nghe rõ." });
  render(<ChatbotWidget storageScope="company:user-a" />);
  await waitFor(() => expect(FakeSpeechRecognition.instances).toHaveLength(1));
  const panel = document.getElementById("erp-chatbot-panel")!;
  const nativeMatches = panel.matches.bind(panel);
  vi.spyOn(panel, "matches").mockImplementation(selector => selector === ":popover-open" ? false : nativeMatches(selector));
  Object.defineProperty(panel, "showPopover", { configurable: true, value: () => {
    const event = new Event("toggle");
    Object.defineProperty(event, "newState", { value: "open" });
    fireEvent(panel, event);
  } });
  const recognition = FakeSpeechRecognition.instances[0];
  const result = (transcript: string) => ({ isFinal: true, 0: { transcript } });
  recognition.onresult?.({ resultIndex: 0, results: [result("Hey")] });
  recognition.onresult?.({ resultIndex: 1, results: [result("Hey"), result("Igen")] });
  recognition.onresult?.({ resultIndex: 2, results: [result("Hey"), result("Igen"), result("mở danh sách khách hàng")] });
  await waitFor(() => expect(mocks.state).toHaveBeenCalledOnce());
  await waitFor(() => expect(recognition.stop).toHaveBeenCalledOnce(), { timeout: 4000 });
  expect(mocks.turn).not.toHaveBeenCalled();
  resolveState?.({ messages: [], lastReply: null, busy: false });
  await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce(), { timeout: 4000 });
  expect(mocks.turn.mock.calls[0][0].text).toBe("mở danh sách khách hàng");
});

it("opens the assistant on Hey Igen and keeps listening when recognition ends before the request", async () => {
  class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn();
    abort = vi.fn();
    constructor() { FakeSpeechRecognition.instances.push(this); }
  }
  vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, wakeWordEnabled: true });
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Mình đã nghe yêu cầu." });
  render(<ChatbotWidget storageScope="company:user-a" />);
  await waitFor(() => expect(FakeSpeechRecognition.instances).toHaveLength(1));
  const panel = document.getElementById("erp-chatbot-panel")!;
  const nativeMatches = panel.matches.bind(panel);
  vi.spyOn(panel, "matches").mockImplementation(selector => selector === ":popover-open" ? false : nativeMatches(selector));
  Object.defineProperty(panel, "showPopover", { configurable: true, value: () => {
    const event = new Event("toggle");
    Object.defineProperty(event, "newState", { value: "open" });
    fireEvent(panel, event);
  } });

  expect(screen.getByLabelText("Mở trợ lý ảo AI").getAttribute("aria-expanded")).toBe("false");
  const wakeRecognition = FakeSpeechRecognition.instances[0];
  wakeRecognition.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "Hey Igen" } }] });
  await waitFor(() => expect(screen.getByLabelText("Thu gọn trợ lý ảo AI").getAttribute("aria-expanded")).toBe("true"));
  expect(screen.getByText("Đang nghe yêu cầu. Mình sẽ tự gửi khi bạn dừng nói.")).toBeTruthy();
  wakeRecognition.onend?.();
  await waitFor(() => expect(FakeSpeechRecognition.instances).toHaveLength(2));
  const commandRecognition = FakeSpeechRecognition.instances[1];
  expect(commandRecognition.lang).toBe("vi-VN");
  commandRecognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "mở danh sách khách hàng" } }] });
  await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce(), { timeout: 4000 });
  expect(mocks.turn.mock.calls[0][0].text).toBe("mở danh sách khách hàng");
}, 10000);

it("automatically sends an interim spoken command after silence without a final recognition result", async () => {
  class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn();
    abort = vi.fn();
    constructor() { FakeSpeechRecognition.instances.push(this); }
  }
  vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, wakeWordEnabled: true });
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Đã mở danh sách." });
  render(<ChatbotWidget storageScope="company:user-a" />); await open();
  await waitFor(() => expect(FakeSpeechRecognition.instances).toHaveLength(1));
  const recognition = FakeSpeechRecognition.instances[0];
  recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Hey Igen" } }] });
  recognition.onresult?.({ resultIndex: 1, results: [
    { isFinal: true, 0: { transcript: "Hey Igen" } },
    { isFinal: false, 0: { transcript: "mở danh sách khách hàng" } },
  ] });
  await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce(), { timeout: 4000 });
  expect(mocks.turn.mock.calls[0][0].text).toBe("mở danh sách khách hàng");
  expect(recognition.stop).toHaveBeenCalledOnce();
}, 10000);

it("recognizes a spoken request from the voice button and sends it after silence", async () => {
  class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();
    constructor() { FakeSpeechRecognition.instances.push(this); }
  }
  vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
  mocks.turn.mockResolvedValueOnce({ status: "completed", reply: "Mình đã nghe rõ." });
  render(<ChatbotWidget storageScope="company:user-a" />); await open();
  mocks.speech.mockResolvedValue(new Blob(["MP3"], { type: "audio/mpeg" }));
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:voice-button"); static revokeObjectURL = vi.fn(); });
  vi.stubGlobal("Audio", class { onended: (() => void) | null = null; onerror: (() => void) | null = null; play = vi.fn().mockResolvedValue(undefined); pause = vi.fn(); });
  fireEvent.click(screen.getByLabelText("Bật chế độ 2 chiều"));
  const recognition = FakeSpeechRecognition.instances[0];
  expect(recognition.lang).toBe("vi-VN");
  recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "xem danh sách đơn hàng" } }] });
  await waitFor(() => expect(mocks.turn).toHaveBeenCalledOnce(), { timeout: 4000 });
  expect(recognition.stop).toHaveBeenCalledOnce();
  expect(mocks.turn.mock.calls[0][0].text).toBe("xem danh sách đơn hàng");
});

it("opens assistant configuration in a modal and closes it from its header", async () => {
  render(<ChatbotWidget storageScope="company:user-a" />); await open();
  expect(screen.queryByRole("dialog", { name: "Cài đặt trợ lý" })).toBeNull();
  fireEvent.click(screen.getByText("Cài đặt", { exact: true }).closest("button")!);
  const settingsDialog = document.getElementById("assistant-settings-dialog") as HTMLDialogElement;
  await waitFor(() => expect(settingsDialog.open).toBe(true));
  expect(settingsDialog.open).toBe(true);
  expect(settingsDialog.className).toContain("h-[calc(100dvh-2rem)]");
  expect(settingsDialog.querySelector(".overflow-y-auto")).toBeTruthy();
  expect(screen.getByText("Tùy chỉnh trải nghiệm")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Đóng cài đặt trợ lý"));
  await waitFor(() => expect(settingsDialog.open).toBe(false));
});
