// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatTestTab } from "./ChatTestTab";
import { chatTestService } from "../../services/chatTestService";
import { geminiApi } from "../../../shared/api/gemini";
import type { ChatTestSession } from "../../../../../../shared/marketing-suite/chat-test";
import type { AIChatConfig } from "../../types/crm";

vi.mock("../../services/chatTestService", () => ({
  chatTestService: { list: vi.fn(), create: vi.fn(), read: vi.fn(), send: vi.fn(), image: vi.fn(), retry: vi.fn(),
    saveConfig: vi.fn(), preview: vi.fn(), createLead: vi.fn() },
}));
vi.mock("../../../shared/api/gemini", () => ({
  geminiApi: { getKnowledgeHealth: vi.fn(), fetchAIReplyLogs: vi.fn() },
}));
vi.mock("../../../knowledge/components/knowledge/KnowledgeCenterSummaryCard", () => ({ KnowledgeCenterSummaryCard: () => null }));
vi.mock("../../../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const session: ChatTestSession = {
  id: "session-1", label: "Khách nội bộ", channel: "facebook", createdAt: "2026-11-18T01:00:00Z",
  pending: false, ocrEnabled: false, directLeadWrites: true,
  fields: [{ key: "name", label: "Họ tên", question: "Tên?", type: "text" }],
};
const aiConfig: AIChatConfig = {
  enabled: true, autoClassify: true, autoCloseDeal: true, autoFeedback: true, replyDelay: 1,
  advancedInstructions: "Tư vấn tự nhiên", trainingKnowledge: "",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
  vi.mocked(chatTestService.list).mockResolvedValue([session]);
  vi.mocked(chatTestService.create).mockResolvedValue(session);
  vi.mocked(chatTestService.read).mockResolvedValue({ session, aiConfig, messages: [], leads: [] });
  vi.mocked(chatTestService.saveConfig).mockImplementation(async (_id, config) => config);
  vi.mocked(geminiApi.getKnowledgeHealth).mockResolvedValue({ documents: [] } as never);
  vi.mocked(geminiApi.fetchAIReplyLogs).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderReadyChat() {
  render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
  const textbox = await screen.findByRole("textbox", { name: "Tin nhắn của khách" });
  await waitFor(() => expect(textbox).toHaveProperty("disabled", false));
  return { textbox, area: document.getElementById("chat_conversation_area")! };
}

describe("Direct CRM chat", () => {
  it("accepts a folder image dropped anywhere in the conversation and keeps the drop indicator across child elements", async () => {
    const { area, textbox } = await renderReadyChat();
    const image = new File(["image"], "trien-khai.png", { type: "image/png" });
    const transfer = { types: ["Files"], files: [image], dropEffect: "none" };
    fireEvent.dragEnter(area, { dataTransfer: transfer });
    fireEvent.dragOver(area, { dataTransfer: transfer });
    expect(transfer.dropEffect).toBe("copy");
    fireEvent.dragEnter(textbox, { dataTransfer: transfer });
    fireEvent.dragLeave(textbox, { dataTransfer: transfer });
    expect(screen.getByText("Thả ảnh để đính kèm vào tin nhắn")).toBeTruthy();
    const drop = createEvent.drop(area, { dataTransfer: transfer, cancelable: true });
    fireEvent(area, drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(screen.queryByText("Thả ảnh để đính kèm vào tin nhắn")).toBeNull();
    expect(await screen.findByAltText("Ảnh sắp gửi")).toBeTruthy();
    expect(chatTestService.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await waitFor(() => expect(chatTestService.send).toHaveBeenCalledWith("session-1", expect.any(String), "", image));
  });

  it.each(["items", "files"])("pastes a copied web image from clipboard %s without inserting clipboard text", async source => {
    const { textbox } = await renderReadyChat();
    const image = new File(["image"], "clipboard.png", { type: "image/png" });
    const paste = createEvent.paste(textbox, { cancelable: true, clipboardData: {
      items: source === "items" ? [{ kind: "file", type: "image/png", getAsFile: () => image }] : [],
      files: [image], getData: () => "https://example.test/image.png",
    } });
    fireEvent(textbox, paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(await screen.findByAltText("Ảnh sắp gửi")).toBeTruthy();
    expect(textbox).toHaveProperty("value", "");
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await waitFor(() => expect(chatTestService.send).toHaveBeenCalledWith("session-1", expect.any(String), "", image));
  });

  it("keeps ordinary text paste native and does not intercept image pasting in the AI settings panel", async () => {
    const { textbox } = await renderReadyChat();
    const textPaste = createEvent.paste(textbox, { cancelable: true, clipboardData: { items: [], files: [], getData: () => "Xin chào" } });
    fireEvent(textbox, textPaste);
    expect(textPaste.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cấu hình chatbot" }));
    const rules = await screen.findByDisplayValue("Tư vấn tự nhiên");
    const image = new File(["image"], "clipboard.png", { type: "image/png" });
    const settingsPaste = createEvent.paste(rules, { cancelable: true, clipboardData: {
      items: [{ kind: "file", type: "image/png", getAsFile: () => image }], files: [image],
    } });
    fireEvent(rules, settingsPaste);
    expect(settingsPaste.defaultPrevented).toBe(false);
    expect(screen.queryByAltText("Ảnh sắp gửi")).toBeNull();
  });

  it.each(["multiple", "type", "size"])("rejects a %s-invalid drop without losing an existing attachment", async invalid => {
    const { area } = await renderReadyChat();
    const original = new File(["image"], "original.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Chọn ảnh gửi cho chatbot"), { target: { files: [original] } });
    await screen.findByAltText("Ảnh sắp gửi");
    const rejected = new File(["file"], invalid === "type" ? "file.pdf" : "other.png", { type: invalid === "type" ? "application/pdf" : "image/png" });
    if (invalid === "size") Object.defineProperty(rejected, "size", { value: 9 * 1024 * 1024 });
    fireEvent.drop(area, { dataTransfer: { types: ["Files"], files: invalid === "multiple" ? [original, rejected,
      new File(["three"], "three.png", { type: "image/png" }), new File(["four"], "four.png", { type: "image/png" })] : [rejected] } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", invalid === "multiple"
      ? "Mỗi lượt gửi tối đa 3 ảnh." : "Chọn ảnh JPEG, PNG, WebP hoặc GIF tối đa 8 MB.");
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await waitFor(() => expect(chatTestService.send).toHaveBeenCalledWith("session-1", expect.any(String), "", original));
  });

  it("blocks image drops while a bot turn is pending", async () => {
    vi.mocked(chatTestService.read).mockResolvedValue({ session: { ...session, pending: true }, aiConfig, messages: [], leads: [] });
    render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
    await screen.findByText("Đang chờ chatbot…");
    const area = document.getElementById("chat_conversation_area")!;
    const image = new File(["image"], "clipboard.png", { type: "image/png" });
    fireEvent.drop(area, { dataTransfer: { types: ["Files"], files: [image] } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Chờ hội thoại sẵn sàng và chatbot trả lời xong trước khi thêm ảnh.");
    expect(screen.queryByAltText("Ảnh sắp gửi")).toBeNull();
    expect(chatTestService.send).not.toHaveBeenCalled();
  });

  it("accumulates dropped and pasted images, removes one preview, and retries the same batch", async () => {
    const { area, textbox } = await renderReadyChat();
    const images = ["one", "two", "three"].map(name => new File([name], `${name}.png`, { type: "image/png" }));
    expect(screen.getByLabelText("Chọn ảnh gửi cho chatbot")).toHaveProperty("multiple", true);
    fireEvent.drop(area, { dataTransfer: { types: ["Files"], files: images.slice(0, 2) } });
    fireEvent.paste(textbox, { clipboardData: { items: [], files: [images[2]] } });
    await screen.findByAltText("Ảnh sắp gửi 3");
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ảnh 2" }));
    await waitFor(() => expect(screen.queryByAltText("Ảnh sắp gửi 3")).toBeNull());
    vi.mocked(chatTestService.send).mockRejectedValueOnce(new Error("Mất kết nối"));
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await screen.findByText("Mất kết nối");
    expect(screen.getByAltText("Ảnh sắp gửi 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await waitFor(() => expect(chatTestService.send).toHaveBeenCalledTimes(2));
    expect(vi.mocked(chatTestService.send).mock.calls[0]).toEqual(vi.mocked(chatTestService.send).mock.calls[1]);
    expect(chatTestService.send).toHaveBeenLastCalledWith("session-1", expect.any(String), "", [images[0], images[2]]);
  });

  it("restores every image in an existing multi-image message using authenticated indexed downloads", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    vi.mocked(chatTestService.image).mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    vi.mocked(chatTestService.read).mockResolvedValue({ session, aiConfig, leads: [], messages: [{
      id: "multi-image", text: "", reply: "", status: "completed", hasImage: true, imageCount: 2, createdAt: session.createdAt,
    }] });
    await renderReadyChat();
    await waitFor(() => expect(chatTestService.image).toHaveBeenCalledTimes(2));
    expect(chatTestService.image).toHaveBeenCalledWith("session-1", "multi-image", expect.any(AbortSignal), 0);
    expect(chatTestService.image).toHaveBeenCalledWith("session-1", "multi-image", expect.any(AbortSignal), 1);
    await waitFor(() => expect(document.querySelectorAll('img[src="blob:first"], img[src="blob:second"]').length).toBe(2));
  });
  it("uses the inbox conversation UI to send an inbound message without connecting a Page", async () => {
    vi.mocked(chatTestService.list).mockResolvedValue([]);
    render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Hội thoại mới" }));
    await waitFor(() => expect(chatTestService.create).toHaveBeenCalledWith({ channel: "facebook", ocrEnabled: false, documentDomain: "general" }));
    const textbox = await screen.findByRole("textbox", { name: "Tin nhắn của khách" });
    await waitFor(() => expect(textbox).toHaveProperty("disabled", false));
    fireEvent.change(textbox, { target: { value: "Tôi muốn đăng ký gói Nam" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await waitFor(() => expect(chatTestService.send).toHaveBeenCalledWith("session-1", expect.any(String), "Tôi muốn đăng ký gói Nam", undefined));
    expect(document.getElementById("omni_inbox_layout")).toBeTruthy();
    expect(document.getElementById("inbox_sidebar")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Tìm tên khách hàng" })).toBeNull();
  });

  it("only enables the telecom document flow when explicitly creating a Nhà mạng conversation", async () => {
    vi.mocked(chatTestService.create).mockResolvedValue({ ...session, documentDomain: "telecom" });
    render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Loại hội thoại mới" }));
    fireEvent.click(await screen.findByRole("option", { name: "Nhà mạng" }));
    fireEvent.click(screen.getByRole("button", { name: "Hội thoại mới" }));
    await waitFor(() => expect(chatTestService.create).toHaveBeenCalledWith({
      channel: "facebook", ocrEnabled: false, documentDomain: "telecom",
    }));
    expect(await screen.findByText("Đang thử: Nhà mạng")).toBeTruthy();
  });

  it("loads and saves rules through the same AI settings panel as the inbox", async () => {
    render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cấu hình chatbot" }));
    expect(document.getElementById("ai_assistant_config_side_panel")).toBeTruthy();
    const rules = await screen.findByDisplayValue("Tư vấn tự nhiên");
    fireEvent.change(rules, { target: { value: "Xưng em và tư vấn đầy đủ" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình chatbot" }));
    await waitFor(() => expect(chatTestService.saveConfig).toHaveBeenCalledWith("session-1",
      expect.objectContaining({ advancedInstructions: "Xưng em và tư vấn đầy đủ" })));
  });
  it("opens the existing Lead field setup directly", async () => {
    const onConfigureLead = vi.fn();
    render(<ChatTestTab accounts={[]} onConfigureLead={onConfigureLead} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thiết lập Lead" }));
    expect(onConfigureLead).toHaveBeenCalledWith("company");
    expect(screen.queryByText("Cột Mã hợp đồng")).toBeNull();
  });

  it("restores replies in the inbox and shows the linked Lead status", async () => {
    vi.mocked(chatTestService.read).mockResolvedValue({
      session, aiConfig, messages: [{
        id: "message-1", text: "Tên tôi là An", reply: "An cho em xin số liên hệ nhé.",
        hasImage: false, status: "completed", createdAt: "2026-11-18T01:00:01Z",
      }],
      leads: [{ id: "lead-1", customerName: "An", phone: "", email: "", answers: { name: "An" },
        intakeFields: session.fields, collectionStatus: "collecting" }],
    });
    render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
    expect(await screen.findByText("An cho em xin số liên hệ nhé.")).toBeTruthy();
    expect(screen.getByText("Lead · Đang thu thập")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo Lead" })).toBeNull();
  });

  it("preserves an image and the same request ID if sending fails", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
    vi.mocked(chatTestService.send).mockRejectedValueOnce(new Error("Mất kết nối"));
    render(<ChatTestTab accounts={[]} onConfigureLead={vi.fn()} />);
    const upload = await screen.findByLabelText("Chọn ảnh gửi cho chatbot");
    await waitFor(() => expect(upload).toHaveProperty("disabled", false));
    const file = new File(["image"], "hop-dong.png", { type: "image/png" });
    fireEvent.change(upload, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Mất kết nối");
    expect(screen.getByAltText("Ảnh sắp gửi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await waitFor(() => expect(chatTestService.send).toHaveBeenCalledTimes(2));
    expect(vi.mocked(chatTestService.send).mock.calls[0]).toEqual(vi.mocked(chatTestService.send).mock.calls[1]);
  });
});
