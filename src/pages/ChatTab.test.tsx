// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatTab from "./ChatTab";
import { ChatUnreadProvider, useChatUnread } from "../context/ChatUnreadContext";
import { internalChatService } from "../services/internalChatService";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, Set<(data: any) => void>>(),
  user: { uid: "me" },
  profile: { uid: "me", companyCode: "ACME", enabledModules: ["chat"] },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, userProfile: mocks.profile }) }));
vi.mock("../services/authService", () => ({ authService: { getColleagues: vi.fn(async () => []) } }));
vi.mock("../services/internalChatService", () => ({ internalChatService: {
  getRooms: vi.fn(), getMessages: vi.fn(async () => []), markAsRead: vi.fn(async () => {}),
} }));
vi.mock("../services/socketService", () => ({ socketService: {
  isConnected: () => true, emit: vi.fn(),
  on: (event: string, callback: (data: any) => void) => {
    const callbacks = mocks.listeners.get(event) || new Set();
    callbacks.add(callback);
    mocks.listeners.set(event, callbacks);
    return () => callbacks.delete(callback);
  },
} }));
vi.mock("../components/chat/chatSound", () => ({ CHAT_SOUND_MUTED_KEY: "muted", playChatNotificationSound: vi.fn() }));
vi.mock("./Toast", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));
const group = { _id: "team", name: "Nhóm nội bộ", isGroup: true, members: [], updatedAt: "2026-01-01", unreadCount: 2 };
const ai = { ...group, _id: "ai", name: "Trợ lý AI", isGroup: false, isChatbot: true, unreadCount: 10 };
const emit = (event: string, data: any) => { for (const callback of [...(mocks.listeners.get(event) || [])]) callback(data); };
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); mocks.listeners.clear(); });

describe("internal chat without AI", () => {
  it("replaces a saved AI room with an internal room and ignores AI socket events", async () => {
    vi.mocked(internalChatService.getRooms).mockResolvedValue([ai, group] as any);
    localStorage.setItem("lastActiveChatRoomId", "ai");
    render(<ChatTab />);
    await waitFor(() => expect(internalChatService.getMessages).toHaveBeenCalledWith("team", 30));
    expect(screen.queryByText("Trợ lý AI")).toBeNull();
    expect(screen.getByText("Trò chuyện nội bộ")).toBeTruthy();
    expect(localStorage.getItem("lastActiveChatRoomId")).toBe("team");
    act(() => {
      emit("internal_room_updated", ai);
      emit("internal_new_message", { roomId: "ai", roomUpdate: ai, message: { senderId: "bot" } });
    });
    expect(screen.queryByText("Trợ lý AI")).toBeNull();
  });

  it("does not open an AI room when no internal rooms exist", async () => {
    vi.mocked(internalChatService.getRooms).mockResolvedValue([ai] as any);
    render(<ChatTab />);
    await waitFor(() => expect(internalChatService.getRooms).toHaveBeenCalled());
    expect(internalChatService.getMessages).not.toHaveBeenCalled();
    expect(screen.queryByText("Trợ lý AI")).toBeNull();
  });

  it("excludes AI unread messages while counting internal chat events", async () => {
    vi.mocked(internalChatService.getRooms).mockResolvedValue([ai, group] as any);
    function Unread() { return <output aria-label="unread">{useChatUnread().totalUnread}</output>; }
    render(<ChatUnreadProvider><Unread /></ChatUnreadProvider>);
    await waitFor(() => expect(screen.getByLabelText("unread").textContent).toBe("2"));
    act(() => emit("internal_new_message", { roomId: "ai", roomUpdate: ai, message: { senderId: "bot" } }));
    expect(screen.getByLabelText("unread").textContent).toBe("2");
    act(() => emit("internal_new_message", { roomId: "team", roomUpdate: group, message: { senderId: "colleague" } }));
    expect(screen.getByLabelText("unread").textContent).toBe("3");
  });
});
