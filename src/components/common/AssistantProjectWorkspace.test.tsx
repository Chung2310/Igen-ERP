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
  it("renders the conversation composer supplied by the chat surface", () => {
    const onProjectsChange = vi.fn();
    render(<AssistantProjectWorkspace projects={[project]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} composer={<div>Project conversation composer</div>} />);

    expect(screen.getByText("Project conversation composer")).toBeTruthy();
    expect(onProjectsChange).not.toHaveBeenCalled();
  });

  it("opens a linked conversation using the parent callback", () => {
    const onProjectsChange = vi.fn();
    const onOpenConversation = vi.fn();
    const withConversation: AssistantProject = { ...project, conversations: [{ id: "link-1", title: "K\u1ebf ho\u1ea1ch tu\u1ea7n n\u00e0y", preview: "K\u1ebf ho\u1ea1ch tu\u1ea7n n\u00e0y", createdAt: project.createdAt, sourceConversationId: "00000000-0000-4000-8000-000000000001", sourceMode: "qa" }] };
    render(<AssistantProjectWorkspace projects={[withConversation]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} onOpenConversation={onOpenConversation} />);

    fireEvent.click(screen.getByRole("button", { name: /K\u1ebf ho\u1ea1ch tu\u1ea7n n\u00e0y/i }));

    expect(onOpenConversation).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    expect(onProjectsChange).not.toHaveBeenCalled();
  });

  it("removes a conversation from the project without deleting the chat", () => {
    const onProjectsChange = vi.fn();
    const withConversation: AssistantProject = { ...project, conversations: [{ id: "link-1", title: "K\u1ebf ho\u1ea1ch", preview: "K\u1ebf ho\u1ea1ch", createdAt: project.createdAt, sourceConversationId: "00000000-0000-4000-8000-000000000001", sourceMode: "qa" }] };
    render(<AssistantProjectWorkspace projects={[withConversation]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText("T\u00f9y ch\u1ecdn cu\u1ed9c tr\u00f2 chuy\u1ec7n K\u1ebf ho\u1ea1ch"));
    fireEvent.click(screen.getByRole("button", { name: 'X\u00f3a kh\u1ecfi "Marketing"' }));

    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ conversations: [] })]);
  });

  it("requires a name before creating a project", () => {
    const onProjectsChange = vi.fn();
    render(<AssistantProjectWorkspace projects={[]} onProjectsChange={onProjectsChange} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "T\u1ea1o d\u1ef1 \u00e1n" }));
    fireEvent.click(screen.getByRole("button", { name: "L\u01b0u" }));

    expect(screen.getByRole("alert").textContent).toBe("Nh\u1eadp t\u00ean d\u1ef1 \u00e1n.");
    expect(onProjectsChange).not.toHaveBeenCalled();
  });

  it("shows iGenAI instructions and a computer-only file picker", () => {
    const onProjectsChange = vi.fn();
    render(<AssistantProjectWorkspace projects={[project]} onProjectsChange={onProjectsChange} selectedId={project.id} onSelect={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Thi\u1ebft l\u1eadp ch\u1ec9 d\u1eabn" }));
    expect(screen.getByLabelText("M\u00f4 h\u00ecnh iGenAI").textContent).toContain("iGenAI");
    fireEvent.change(screen.getByLabelText("Ch\u1ec9 d\u1eabn cho d\u1ef1 \u00e1n"), { target: { value: "Tr\u1ea3 l\u1eddi ng\u1eafn g\u1ecdn" } });
    fireEvent.click(screen.getByRole("button", { name: "L\u01b0u" }));
    expect(onProjectsChange).toHaveBeenCalledWith([expect.objectContaining({ instructions: "Tr\u1ea3 l\u1eddi ng\u1eafn g\u1ecdn" })]);

    fireEvent.click(screen.getByRole("button", { name: "T\u1ec7p \u0111\u00ednh k\u00e8m" }));
    fireEvent.click(screen.getByRole("button", { name: "Th\u00eam t\u1ec7p \u0111\u1ea7u ti\u00ean" }));
    expect(screen.getByText("Ch\u1ecdn t\u1ec7p t\u1eeb m\u00e1y t\u00ednh")).toBeTruthy();
    expect(screen.queryByText(/Google Drive/i)).toBeNull();
  });
});