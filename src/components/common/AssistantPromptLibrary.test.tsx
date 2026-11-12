// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantPromptLibrary } from "./AssistantPromptLibrary";

afterEach(() => cleanup());

describe("AssistantPromptLibrary", () => {
  it("filters sample prompts by category and search", () => {
    render(<AssistantPromptLibrary open onClose={vi.fn()} onUsePrompt={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Marketing" }));
    expect(screen.getByRole("button", { name: "Dùng mẫu: Lập kế hoạch nội dung mạng xã hội" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Dùng mẫu: Phân tích đối thủ cạnh tranh" })).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm kiếm mẫu câu lệnh" }), { target: { value: "mạng xã hội" } });
    expect(screen.getByRole("button", { name: "Dùng mẫu: Lập kế hoạch nội dung mạng xã hội" })).not.toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm kiếm mẫu câu lệnh" }), { target: { value: "không có kết quả" } });
    expect(screen.getByText("Không tìm thấy mẫu phù hợp")).not.toBeNull();
  });

  it("lets the user favorite, inspect, and insert a prompt", () => {
    const onUsePrompt = vi.fn();
    const onClose = vi.fn();
    render(<AssistantPromptLibrary open onClose={onClose} onUsePrompt={onUsePrompt} />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm yêu thích Viết bài giới thiệu sản phẩm" }));
    fireEvent.click(screen.getByRole("button", { name: /Yêu thích/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết Viết bài giới thiệu sản phẩm" }));
    expect(screen.getAllByText("Nội dung mẫu").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Dùng câu lệnh này" }));

    expect(onUsePrompt).toHaveBeenCalledWith(expect.stringContaining("Hãy viết bài giới thiệu"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("creates a local sample and animates the drawer closed", async () => {
    const onUsePrompt = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true);
      return <AssistantPromptLibrary open={open} onClose={() => setOpen(false)} onUsePrompt={onUsePrompt} />;
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo mẫu câu lệnh" }));
    fireEvent.change(screen.getByLabelText(/Tên mẫu/), { target: { value: "Mẫu thử" } });
    fireEvent.change(screen.getByLabelText(/Nội dung câu lệnh/), { target: { value: "Tóm tắt [tài liệu] thành 5 ý." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu mẫu" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo bởi tôi" }));
    expect(screen.getByRole("button", { name: "Dùng mẫu: Mẫu thử" })).not.toBeNull();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Đóng thư viện câu lệnh mẫu" }));
    await waitFor(() => expect(dialog.classList.contains("translate-x-full")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 500 });
  });
});
