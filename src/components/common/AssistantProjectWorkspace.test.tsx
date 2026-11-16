// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantProjectWorkspace } from "./AssistantProjectWorkspace";
import type { AssistantProject } from "./assistant-project-data";

afterEach(cleanup);

const project: AssistantProject = {
  id: "project-1", name: "Marketing", icon: "rocket", tone: "primary", favorite: false,
  instructions: "", model: "iGenAI", conversations: [], files: [], createdAt: "2026-11-12T00:00:00.000Z",
};

describe("AssistantProjectWorkspace", () => {
  it("renders the shared chat composer instead of a project-specific prompt", () => {
    const onProjectsChange = vi.fn();
    const composer = <form><label htmlFor="shared-chat-input">Tin nhắn cho trợ lý ảo</label><textarea id="shared-chat-input" /></form>;
    render(<AssistantProjectWorkspace projects={[project]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} composer={composer} />);

    expect(screen.getByRole("textbox", { name: "Tin nhắn cho trợ lý ảo" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Hỏi trong dự án" })).toBeNull();
    expect(screen.queryByText("Hội thoại sẽ mở trong giao diện Trò chuyện chung.")).toBeNull();
    expect(onProjectsChange).not.toHaveBeenCalled();
  });

  it("offers conversation actions from the ellipsis menu and removes only the project link", () => {
    const onProjectsChange = vi.fn();
    const onDeleteConversation = vi.fn();
    const withConversation: AssistantProject = { ...project, conversations: [{ id: "link-1", title: "Kế hoạch", preview: "Kế hoạch", createdAt: project.createdAt, sourceConversationId: "00000000-0000-4000-8000-000000000001", sourceMode: "qa" }] };
    render(<AssistantProjectWorkspace projects={[withConversation]} onProjectsChange={onProjectsChange} onDeleteConversation={onDeleteConversation} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Tùy chọn cuộc trò chuyện Kế hoạch"));
    expect(screen.getByText("Di chuyển sang dự án")).toBeTruthy();
    expect(screen.getByRole("button", { name: 'Xóa khỏi "Marketing"' })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sửa tên" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xóa trò chuyện" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: 'Xóa khỏi "Marketing"' }));

    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ conversations: [] })]);
    expect(onDeleteConversation).not.toHaveBeenCalled();
  });

  it("renames a project conversation from its ellipsis menu", () => {
    const onProjectsChange = vi.fn();
    const withConversation: AssistantProject = { ...project, conversations: [{ id: "link-1", title: "Kế hoạch", preview: "Kế hoạch", createdAt: project.createdAt, sourceConversationId: "conversation-1", sourceMode: "qa" }] };
    render(<AssistantProjectWorkspace projects={[withConversation]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Tùy chọn cuộc trò chuyện Kế hoạch"));
    fireEvent.click(screen.getByRole("button", { name: "Sửa tên" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên cuộc trò chuyện" }), { target: { value: "Kế hoạch mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ conversations: [expect.objectContaining({ title: "Kế hoạch mới" })] })]);
  });

  it("moves a project conversation to another project from the submenu", () => {
    const onProjectsChange = vi.fn();
    const withConversation: AssistantProject = { ...project, conversations: [{ id: "link-1", title: "Kế hoạch", preview: "Kế hoạch", createdAt: project.createdAt, sourceConversationId: "conversation-1", sourceMode: "qa" }] };
    const target: AssistantProject = { ...project, id: "project-2", name: "Research" };
    render(<AssistantProjectWorkspace projects={[withConversation, target]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Tùy chọn cuộc trò chuyện Kế hoạch"));
    fireEvent.click(screen.getByText("Di chuyển sang dự án"));
    fireEvent.click(screen.getByRole("button", { name: "Research" }));

    expect(onProjectsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: project.id, conversations: [] }),
      expect.objectContaining({ id: target.id, conversations: [expect.objectContaining({ title: "Kế hoạch", sourceConversationId: "conversation-1" })] }),
    ]);
  });

  it("requests confirmed conversation deletion from the ellipsis menu", () => {
    const onProjectsChange = vi.fn();
    const onDeleteConversation = vi.fn();
    const conversation = { id: "link-1", title: "Kế hoạch", preview: "Kế hoạch", createdAt: project.createdAt, sourceConversationId: "conversation-1", sourceMode: "qa" as const };
    const withConversation: AssistantProject = { ...project, conversations: [conversation] };
    render(<AssistantProjectWorkspace projects={[withConversation]} onProjectsChange={onProjectsChange} onDeleteConversation={onDeleteConversation} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText("Tùy chọn cuộc trò chuyện Kế hoạch"));
    fireEvent.click(screen.getByRole("button", { name: "Xóa trò chuyện" }));

    expect(onDeleteConversation).toHaveBeenCalledWith(conversation);
    expect(onProjectsChange).not.toHaveBeenCalled();
  });
  it("requires a name before creating a project", () => {
    const onProjectsChange = vi.fn();
    render(<AssistantProjectWorkspace projects={[]} onProjectsChange={onProjectsChange} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(screen.getByRole("alert").textContent).toBe("Nhập tên dự án.");
    expect(onProjectsChange).not.toHaveBeenCalled();
  });

  it("shows iGenAI instructions and a computer-only file picker", () => {
    const onProjectsChange = vi.fn();
    render(<AssistantProjectWorkspace projects={[project]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Thiết lập chỉ dẫn" }));
    expect(screen.getByText("Mô hình")).toBeTruthy();
    expect(screen.queryByText("Mô hình mặc định")).toBeNull();
    const model = screen.getByLabelText("Mô hình iGenAI");
    expect(model.querySelector("img")?.getAttribute("src")).toBe("/igenai.png");
    expect(model.querySelector("select")).toBeNull();
    fireEvent.change(screen.getByLabelText("Chỉ dẫn cho dự án"), { target: { value: "Trả lời ngắn gọn" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ instructions: "Trả lời ngắn gọn" })]);

    fireEvent.click(screen.getByRole("button", { name: "Tệp đính kèm" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm tệp" }));
    expect(screen.getByText("Chọn tệp từ máy tính")).toBeTruthy();
    expect(screen.queryByText(/Google Drive/i)).toBeNull();
  });
});
