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
  it("starts a real conversation from the project prompt", () => {
    const onProjectsChange = vi.fn();
    const onStartConversation = vi.fn();
    render(<AssistantProjectWorkspace projects={[project]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} onStartConversation={onStartConversation} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Hỏi trong dự án" }), { target: { value: "Kế hoạch tuần này?" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm cuộc hội thoại vào dự án" }));

    expect(onStartConversation).toHaveBeenCalledWith(project.id, "Kế hoạch tuần này?");
    expect(onProjectsChange).not.toHaveBeenCalled();
  });

  it("removes a conversation from the project without deleting the chat", () => {
    const onProjectsChange = vi.fn();
    const withConversation: AssistantProject = { ...project, conversations: [{ id: "link-1", title: "Kế hoạch", preview: "Kế hoạch", createdAt: project.createdAt, sourceConversationId: "00000000-0000-4000-8000-000000000001", sourceMode: "qa" }] };
    render(<AssistantProjectWorkspace projects={[withConversation]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ Kế hoạch khỏi dự án" }));

    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ conversations: [] })]);
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
    expect(screen.getByLabelText("Mô hình mặc định")).toHaveProperty("value", "iGenAI");
    fireEvent.change(screen.getByLabelText("Chỉ dẫn cho dự án"), { target: { value: "Trả lời ngắn gọn" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ instructions: "Trả lời ngắn gọn" })]);

    fireEvent.click(screen.getByRole("button", { name: "Thêm tệp vào dự án" }));
    expect(screen.getByText("Chọn tệp từ máy tính")).toBeTruthy();
    expect(screen.queryByText(/Google Drive/i)).toBeNull();
  });
});
