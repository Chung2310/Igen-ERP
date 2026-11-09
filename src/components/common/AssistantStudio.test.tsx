// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantStudio } from "./AssistantStudio";

afterEach(cleanup);

describe("AssistantStudio", () => {
  it("filters tools and opens a frontend-only request draft", () => {
    render(<AssistantStudio />);
    expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
    expect(screen.getByText("Khám phá iGen AI Studio")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tóm tắt YouTube/ }).querySelector("span[aria-hidden]")?.getAttribute("style")).toContain("ai-studio-content-tools.webp");
    expect(screen.getByRole("button", { name: /Soạn nội dung/ }).querySelector("span[aria-hidden]")?.getAttribute("style")).toContain("ai-studio-content-tools.webp");
    fireEvent.click(screen.getByRole("button", { name: /^Video$/ }));
    expect(screen.getByRole("button", { name: /Tạo video/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tạo hình ảnh/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Tạo video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ý tưởng video" }), { target: { value: "Giới thiệu sản phẩm trong 15 giây" } });
    fireEvent.click(screen.getByRole("button", { name: /Chuẩn bị yêu cầu/ }));
    expect(screen.getByRole("status").textContent).toContain("khi dịch vụ AI được kết nối");

    fireEvent.click(screen.getByRole("button", { name: "Quay lại AI Studio" }));
    expect(screen.getByRole("heading", { name: "Video" })).toBeTruthy();
  });
});
