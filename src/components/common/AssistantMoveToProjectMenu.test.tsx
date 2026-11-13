// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantMoveToProjectMenu } from "./AssistantMoveToProjectMenu";
import type { AssistantProject } from "./assistant-project-data";

afterEach(cleanup);

describe("AssistantMoveToProjectMenu", () => {
  it("offers existing projects and passes the selected conversation to the move action", () => {
    const conversation = { conversationId: "conv-1", mode: "qa" as const, title: "Ý tưởng chiến dịch", preview: "Nội dung", messageCount: 2, updatedAt: "2026-11-12T00:00:00.000Z" };
    const project: AssistantProject = { id: "project-1", name: "Marketing", icon: "rocket", tone: "primary", favorite: false, instructions: "", model: "iGenAI", conversations: [], files: [], createdAt: "2026-11-12T00:00:00.000Z" };
    const onMove = vi.fn();
    render(<AssistantMoveToProjectMenu conversation={conversation} projects={[project]} onMove={onMove} onOpenProjects={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn hội thoại Ý tưởng chiến dịch" }));
    fireEvent.click(screen.getByRole("button", { name: "Marketing" }));

    expect(onMove).toHaveBeenCalledWith(conversation, "project-1");
    expect(screen.queryByRole("group", { name: "Di chuyển sang dự án" })).toBeNull();
  });

  it("disables creating a project when the project tab is locked", () => {
    const conversation = { conversationId: "conv-2", mode: "qa" as const, title: "Kế hoạch", preview: "Nội dung", messageCount: 1, updatedAt: "2026-11-12T00:00:00.000Z" };
    const onOpenProjects = vi.fn();
    render(<AssistantMoveToProjectMenu conversation={conversation} projects={[]} projectsLocked onMove={() => undefined} onOpenProjects={onOpenProjects} />);

    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn hội thoại Kế hoạch" }));
    const createProject = screen.getByRole("button", { name: "Dự án mới" }) as HTMLButtonElement;
    expect(createProject.disabled).toBe(true);
    expect(createProject.title).toBe("Tab Dự án đang bị khóa");
    fireEvent.click(createProject);
    expect(onOpenProjects).not.toHaveBeenCalled();
  });
});
