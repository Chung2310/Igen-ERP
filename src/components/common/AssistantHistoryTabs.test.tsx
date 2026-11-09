// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantHistoryTabs } from "./AssistantHistoryTabs";
import { filterAssistantHistory } from "./assistant-history";

afterEach(cleanup);

describe("AssistantHistoryTabs", () => {
  it("shows the selected category and switches by button", () => {
    const onChange = vi.fn();
    render(<AssistantHistoryTabs value="studio" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "AI Studio" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "AI Studio" }).className).toContain("is-active");
    fireEvent.click(screen.getByRole("button", { name: "Thao tác" }));
    expect(onChange).toHaveBeenCalledWith("work");
  });

  it("keeps conversation and action history separate", () => {
    const items = [
      { conversationId: "qa", mode: "qa" as const, title: "Hỏi đáp", preview: "", messageCount: 2, updatedAt: "2026-11-09" },
      { conversationId: "work", mode: "work" as const, title: "Thao tác", preview: "", messageCount: 2, updatedAt: "2026-11-09" },
    ];
    expect(filterAssistantHistory(items, "qa").map(item => item.conversationId)).toEqual(["qa"]);
    expect(filterAssistantHistory(items, "work").map(item => item.conversationId)).toEqual(["work"]);
    expect(filterAssistantHistory(items, "studio")).toEqual([]);
  });

  it("shows meeting history only in the standalone workspace", () => {
    const onChange = vi.fn();
    const { rerender } = render(<AssistantHistoryTabs value="qa" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Ghi chép" })).toBeNull();
    rerender(<AssistantHistoryTabs value="meeting" onChange={onChange} showMeeting />);
    const meeting = screen.getByRole("button", { name: "Ghi chép" });
    expect(meeting.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(meeting);
    expect(onChange).toHaveBeenCalledWith("meeting");
  });
});
