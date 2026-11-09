// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantNotebook } from "./AssistantNotebook";

afterEach(cleanup);

describe("AssistantNotebook", () => {
  it("keeps sources and questions in a frontend draft", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "source-1" });
    render(<AssistantNotebook />);
    fireEvent.click(screen.getByRole("button", { name: /Nghiên cứu tài liệu/ }));
    expect(screen.getByRole("heading", { name: "Nguồn tài liệu" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đường dẫn" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Đường dẫn tài liệu" }), { target: { value: "https://example.com/report" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào bản nháp" }));
    expect(screen.getByText("https://example.com/report")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Câu hỏi" }), { target: { value: "Tóm tắt tài liệu" } });
    fireEvent.click(screen.getByRole("button", { name: "Chuẩn bị câu hỏi" }));
    expect(screen.getByRole("status").textContent).toContain("kết nối dịch vụ AI");

    fireEvent.click(screen.getByRole("button", { name: "Bỏ nguồn https://example.com/report" }));
    expect(screen.getByText("Chưa có nguồn nào trong bản nháp.")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
