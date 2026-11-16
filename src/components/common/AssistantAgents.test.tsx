// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AssistantAgents } from "./AssistantAgents";
import { assistantAgentService } from "../../services/assistantAgentService";

vi.mock("../../services/assistantAgentService", () => ({ assistantAgentService: { chat: vi.fn(async () => ({ reply: "Quy trình gồm ba bước." })), extractFile: vi.fn() } }));

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe("AssistantAgents", () => {
  it("creates an assistant with knowledge, chats with its prompt, and restores the conversation", async () => {
    const { unmount } = render(<AssistantAgents storageScope="agent-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo Trợ lý AI" }));
    expect(screen.getByText("Trợ lý dùng chung kết nối AI của tính năng Trò chuyện. Nên viết chỉ dẫn tập trung vào một nhiệm vụ cụ thể.")).toBeTruthy();
    expect(screen.queryByText("Mô hình mặc định")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Chọn ảnh đại diện/ })).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Chọn ảnh đại diện 4" }));
    expect(screen.getByRole("button", { name: "Chọn ảnh đại diện 4" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByRole("textbox", { name: /Tên trợ lý/ }), { target: { value: "Trợ lý nội bộ" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Chỉ dẫn/ }), { target: { value: "Giải thích quy trình nội bộ." } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(screen.getByRole("heading", { name: "Nạp tri thức cho trợ lý" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nhập nội dung" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên nội dung" }), { target: { value: "Quy trình" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung" }), { target: { value: "Quy trình gồm ba bước." } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm tri thức" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo và trò chuyện" }));
    expect(screen.getByRole("heading", { name: "Trợ lý nội bộ" })).toBeTruthy();
    const chatInput = screen.getByRole("textbox", { name: /Tin nhắn gửi/ });
    fireEvent.change(chatInput, { target: { value: "Quy trình gồm mấy bước?" } });
    expect(chatInput.closest(".assistant-conversation-composer")).toBeTruthy();
    fireEvent.keyDown(chatInput, { key: "Enter", shiftKey: true });
    expect(assistantAgentService.chat).not.toHaveBeenCalled();
    fireEvent.keyDown(chatInput, { key: "Enter", shiftKey: false });
    await waitFor(() => expect(screen.getByText("Quy trình gồm ba bước.")).toBeTruthy());
    expect(assistantAgentService.chat).toHaveBeenCalledWith(expect.objectContaining({ instructions: "Giải thích quy trình nội bộ.", knowledge: [expect.objectContaining({ title: "Quy trình", content: "Quy trình gồm ba bước." })] }), [{ role: "user", content: "Quy trình gồm mấy bước?" }]);
    unmount();

    render(<AssistantAgents storageScope="agent-test" />);
    expect(screen.getByRole("heading", { name: "Trợ lý nội bộ" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trợ lý của tôi" }));
    const savedCard = screen.getByText("Trợ lý nội bộ").closest("article");
    expect(savedCard).not.toBeNull();
    fireEvent.click(within(savedCard as HTMLElement).getByRole("button", { name: "Mở trò chuyện" }));
    expect(screen.getByText("Quy trình gồm mấy bước?")).toBeTruthy();
    expect(screen.getByText("Quy trình gồm ba bước.")).toBeTruthy();
  });

  it("keeps the creator to basics and knowledge without model or form settings", () => {
    render(<AssistantAgents storageScope="agent-tabs-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo Trợ lý AI" }));
    expect(screen.getByRole("heading", { name: "Tạo trợ lý mới" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeTruthy();
    expect(screen.queryByText("Biểu mẫu")).toBeNull();
    expect(screen.queryByText("Mô hình mặc định")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /Tên trợ lý/ }), { target: { value: "Trợ lý thử nghiệm" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Chỉ dẫn/ }), { target: { value: "Trả lời câu hỏi theo tài liệu." } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(screen.getByRole("button", { name: "Tải tệp lên" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm liên kết" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nhập nội dung" })).toBeTruthy();
    expect(screen.queryByText("Biểu mẫu")).toBeNull();
  });

  it("shows saved assistants as cards with settings, chat, favorite, and delete actions", () => {
    localStorage.setItem("igen_erp_agent_drafts:agent-card-test", JSON.stringify([{
      id: "saved-agent", name: "Trợ lý CSKH", description: "Giải đáp câu hỏi khách hàng.",
      instructions: "Trả lời theo tài liệu.", avoid: "", tone: "Tự động", avatar: 0,
      openingQuestions: [], knowledge: [],
    }]));
    localStorage.setItem("igen_erp_agent_chat:agent-card-test:saved-agent", JSON.stringify([{ role: "user", content: "Xin chào" }]));
    render(<AssistantAgents storageScope="agent-card-test" />);

    const card = screen.getByText("Trợ lý CSKH").closest("article");
    expect(card).not.toBeNull();
    expect(card?.querySelector(".border-dashed")).toBeTruthy();
    expect(within(card as HTMLElement).getByRole("button", { name: "Thiết lập trợ lý" })).toBeTruthy();
    expect(within(card as HTMLElement).getByRole("button", { name: "Mở trò chuyện" })).toBeTruthy();
    const favorite = screen.getByRole("button", { name: "Yêu thích Trợ lý CSKH" });
    fireEvent.click(favorite);
    expect(screen.getByRole("button", { name: "Bỏ yêu thích Trợ lý CSKH" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByLabelText("Tùy chọn Trợ lý CSKH"));
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    expect(screen.getByText("Xóa trợ lý?")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Xóa trợ lý" }));
    expect(screen.queryByText("Trợ lý CSKH")).toBeNull();
    expect(localStorage.getItem("igen_erp_agent_chat:agent-card-test:saved-agent")).toBeNull();
  });

  it("duplicates a saved assistant from its three-dot menu without copying favorite or chat history", () => {
    localStorage.setItem("igen_erp_agent_drafts:agent-clone-test", JSON.stringify([{
      id: "saved-agent", name: "Trợ lý CSKH", description: "Giải đáp câu hỏi khách hàng.",
      instructions: "Trả lời theo tài liệu.", avoid: "Không suy đoán.", tone: "Thân thiện", avatar: 2,
      favorite: true, openingQuestions: ["Hỏi về đổi trả"],
      knowledge: [{ id: "resource-1", title: "Chính sách", kind: "text", content: "Đổi trả trong 30 ngày.", createdAt: "2026-01-01T00:00:00.000Z" }],
    }]));
    localStorage.setItem("igen_erp_agent_chat:agent-clone-test:saved-agent", JSON.stringify([{ role: "user", content: "Xin chào" }]));
    render(<AssistantAgents storageScope="agent-clone-test" />);

    fireEvent.click(screen.getByLabelText("Tùy chọn Trợ lý CSKH"));
    fireEvent.click(screen.getByRole("button", { name: "Nhân bản" }));

    expect(screen.getByRole("status").textContent).toContain("Đã nhân bản");
    expect(screen.getByText("Trợ lý CSKH (bản sao)")).toBeTruthy();
    const assistants = JSON.parse(localStorage.getItem("igen_erp_agent_drafts:agent-clone-test") || "[]");
    const copy = assistants.find((item: { name: string }) => item.name === "Trợ lý CSKH (bản sao)");
    expect(copy).toMatchObject({ instructions: "Trả lời theo tài liệu.", avoid: "Không suy đoán.", tone: "Thân thiện", avatar: 2, favorite: false, openingQuestions: ["Hỏi về đổi trả"] });
    expect(copy.id).not.toBe("saved-agent");
    expect(copy.knowledge[0].id).not.toBe("resource-1");
    expect(copy.knowledge[0].content).toBe("Đổi trả trong 30 ngày.");
    expect(localStorage.getItem("igen_erp_agent_chat:agent-clone-test:saved-agent")).not.toBeNull();
    expect(localStorage.getItem(`igen_erp_agent_chat:agent-clone-test:${copy.id}`)).toBeNull();
  });
});
