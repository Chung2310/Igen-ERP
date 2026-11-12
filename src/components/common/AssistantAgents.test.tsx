// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AssistantAgents } from "./AssistantAgents";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("AssistantAgents", () => {
  it("creates and restores a local iGenAI draft without a backend call", () => {
    const { unmount } = render(<AssistantAgents storageScope="agent-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo Trợ lý AI" }));
    expect(screen.getAllByText("iGenAI")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Chọn ảnh đại diện/ })).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Chọn ảnh đại diện 4" }));
    expect(screen.getByRole("button", { name: "Chọn ảnh đại diện 4" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByRole("textbox", { name: /Tên trợ lý/ }), { target: { value: "Trợ lý nội bộ" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Chỉ dẫn/ }), { target: { value: "Giải thích quy trình nội bộ." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
    expect(screen.getByRole("status").textContent).toContain("Đã lưu bản nháp");
    unmount();

    render(<AssistantAgents storageScope="agent-test" />);
    expect(screen.getByRole("heading", { name: "Trợ lý nội bộ" })).toBeTruthy();
    expect(screen.getByText("Bản nháp trên thiết bị · iGenAI")).toBeTruthy();
  });

  it("shows separate knowledge and template editors with empty states", () => {
    render(<AssistantAgents storageScope="agent-tabs-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo Trợ lý AI" }));
    const tabs = screen.getByRole("navigation", { name: "Thiết lập Trợ lý AI" });
    fireEvent.click(within(tabs).getByRole("button", { name: "Tri thức" }));
    expect(screen.getByText("Chưa có tri thức nào.")).toBeTruthy();
    fireEvent.click(within(tabs).getByRole("button", { name: "Biểu mẫu" }));
    expect(screen.getByText("Chưa có biểu mẫu nào.")).toBeTruthy();
  });
});
