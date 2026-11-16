// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AssistantConversationSummary } from "../../services/assistantService";
import type { AssistantProject } from "./assistant-project-data";
import { AssistantConversationActionsMenu } from "./AssistantConversationActionsMenu";

afterEach(cleanup);

const conversation: AssistantConversationSummary = {
  conversationId: "conversation-1",
  mode: "qa",
  title: "Quy trình tuyển dụng",
  preview: "Nội dung trao đổi",
  messageCount: 2,
  updatedAt: "2026-11-14T10:00:00.000Z",
};

const project: AssistantProject = {
  id: "project-1",
  name: "Marketing",
  icon: "rocket",
  tone: "primary",
  favorite: false,
  instructions: "",
  model: "iGenAI",
  conversations: [],
  files: [],
  createdAt: "2026-11-12T00:00:00.000Z",
};

function openMenu(props: Partial<Parameters<typeof AssistantConversationActionsMenu>[0]> = {}) {
  const onMove = vi.fn();
  const onOpenProjects = vi.fn();
  const onToggleFavorite = vi.fn();
  const onRename = vi.fn();
  const onDelete = vi.fn();

  render(<AssistantConversationActionsMenu
    conversation={conversation}
    projects={[project]}
    onMove={onMove}
    onOpenProjects={onOpenProjects}
    onToggleFavorite={onToggleFavorite}
    onRename={onRename}
    onDelete={onDelete}
    {...props}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Tùy chọn cuộc trò chuyện Quy trình tuyển dụng" }));

  return { onMove, onOpenProjects, onToggleFavorite, onRename, onDelete };
}

it("provides the requested history actions with icons and no share action", () => {
  openMenu();

  expect(screen.getByRole("button", { name: "Yêu thích" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Sửa tên" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByText("Di chuyển sang dự án").closest("summary")?.querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Xóa" }).querySelector("svg")).not.toBeNull();
  expect(screen.queryByText("Chia sẻ")).toBeNull();
});

it("toggles favorite, renames, moves, and requests deletion", () => {
  const actions = openMenu();
  fireEvent.click(screen.getByRole("button", { name: "Yêu thích" }));
  expect(actions.onToggleFavorite).toHaveBeenCalledWith(conversation, true);

  fireEvent.click(screen.getByRole("button", { name: "Tùy chọn cuộc trò chuyện Quy trình tuyển dụng" }));
  fireEvent.click(screen.getByRole("button", { name: "Sửa tên" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Tên cuộc trò chuyện" }), { target: { value: "Tuyển dụng mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(actions.onRename).toHaveBeenCalledWith(conversation, "Tuyển dụng mới");

  fireEvent.click(screen.getByRole("button", { name: "Tùy chọn cuộc trò chuyện Quy trình tuyển dụng" }));
  fireEvent.click(screen.getByText("Di chuyển sang dự án"));
  fireEvent.click(screen.getByRole("button", { name: "Marketing" }));
  expect(actions.onMove).toHaveBeenCalledWith(conversation, "project-1");

  fireEvent.click(screen.getByRole("button", { name: "Tùy chọn cuộc trò chuyện Quy trình tuyển dụng" }));
  fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
  expect(actions.onDelete).toHaveBeenCalledWith(conversation);
});

it("opens project creation from the move submenu", () => {
  const actions = openMenu({ projects: [] });
  fireEvent.click(screen.getByText("Di chuyển sang dự án"));
  fireEvent.click(screen.getByRole("button", { name: "Dự án mới" }));

  expect(actions.onOpenProjects).toHaveBeenCalledOnce();
});

it("respects a locked projects tab", () => {
  const actions = openMenu({ projectsLocked: true, projects: [] });
  fireEvent.click(screen.getByText("Di chuyển sang dự án"));

  expect(screen.getByRole("button", { name: "Dự án mới" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Chưa có dự án nào")).toBeTruthy();
  expect(actions.onOpenProjects).not.toHaveBeenCalled();
});
