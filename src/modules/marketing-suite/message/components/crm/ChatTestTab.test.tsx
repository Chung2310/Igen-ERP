// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("Direct CRM chat", () => {
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
