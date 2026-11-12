// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { moveAssistantConversationToProject, type AssistantProject } from "./assistant-project-data";

const base: AssistantProject = {
  id: "project-one", name: "Dự án một", icon: "folder", tone: "primary", favorite: false,
  instructions: "", model: "iGenAI", conversations: [], files: [], createdAt: "2026-11-12T00:00:00.000Z",
};

describe("project conversation assignment", () => {
  it("moves an existing conversation between projects without duplicating it", () => {
    const conversation = { conversationId: "conversation-one", mode: "work" as const, title: "Kế hoạch tháng", preview: "Lập kế hoạch", messageCount: 2, updatedAt: "2026-11-12T00:00:00.000Z" };
    const first = moveAssistantConversationToProject([base, { ...base, id: "project-two", name: "Dự án hai" }], conversation, "project-one");
    const second = moveAssistantConversationToProject(first, conversation, "project-two");
    const third = moveAssistantConversationToProject(second, conversation, "project-two");

    expect(second[0].conversations).toHaveLength(0);
    expect(third[1].conversations).toHaveLength(1);
    expect(third[1].conversations[0]).toMatchObject({ sourceConversationId: "conversation-one", sourceMode: "work" });
  });
});
