// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AssistantTools, assistantTools } from "./AssistantTools";

afterEach(cleanup);

describe("AssistantTools", () => {
  it("renders distinct custom artwork for every catalog tool", () => {
    const { container } = render(<AssistantTools />);
    const drawings = Array.from(container.querySelectorAll("article > svg"), svg =>
      Array.from(svg.querySelectorAll("path, circle"), shape => shape.getAttribute("d") || shape.getAttribute("cx")).join("|")
    );
    expect(drawings).toHaveLength(assistantTools.length);
    expect(new Set(drawings).size).toBe(assistantTools.length);
  });

  it("filters catalog items and keeps favorites separate from tool execution", async () => {
    const user = userEvent.setup();
    render(<AssistantTools />);

    await user.click(screen.getByRole("button", { name: "Marketing" }));
    expect(screen.getByText("Lên ý tưởng chiến dịch")).toBeTruthy();
    expect(screen.queryByText("Giải thích công thức Excel")).toBeNull();

    await user.click(within(screen.getByRole("navigation", { name: "Danh mục công cụ" })).getByRole("button", { name: "Tất cả" }));
    await user.type(screen.getByRole("searchbox", { name: "Tìm kiếm công cụ" }), "Excel");
    const card = screen.getByRole("article");
    await user.click(within(card).getByRole("button", { name: /Thêm vào yêu thích/ }));
    await user.click(screen.getByRole("button", { name: "Yêu thích" }));
    expect(screen.getByText("Giải thích công thức Excel")).toBeTruthy();

    await user.click(screen.getByText("Giải thích công thức Excel"));
    expect(screen.getByRole("heading", { name: "Giải thích công thức Excel" }).tagName).toBe("H3");
    expect(screen.getByRole("textbox", { name: /Công thức cần giải thích/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sử dụng công cụ" })).toBeNull();
  });
});
