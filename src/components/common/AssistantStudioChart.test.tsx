// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AssistantStudioChart } from "./AssistantStudioChart";

afterEach(cleanup);

describe("AssistantStudioChart", () => {
  it("requires a document and prompt, then shows an honest demo result that can be edited", () => {
    render(<AssistantStudioChart onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Tạo biểu đồ$/ }));
    expect(screen.getByRole("alert").textContent).toContain("Đính kèm tệp");

    const file = new File(["demo"], "khach-du-lich.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText("Chọn tệp dữ liệu"), { target: { files: [file] } });
    expect(screen.getByText("khach-du-lich.xlsx")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Tạo biểu đồ$/ }));
    expect(screen.getByRole("alert").textContent).toContain("Nhập yêu cầu");

    const createPrompt = screen.getByRole("textbox", { name: "Yêu cầu tạo biểu đồ" }) as HTMLTextAreaElement;
    fireEvent.change(createPrompt, { target: { value: "Vẽ cơ cấu khách theo mục đích chuyến đi" } });
    fireEvent.click(screen.getByRole("button", { name: "Chuẩn hóa prompt tạo biểu đồ" }));
    expect(createPrompt.value).toContain("Nguồn dữ liệu: tệp đính kèm");
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục prompt gốc" }));
    expect(createPrompt.value).toBe("Vẽ cơ cấu khách theo mục đích chuyến đi");
    fireEvent.click(screen.getByRole("button", { name: "Biểu đồ cột" }));
    fireEvent.click(screen.getByRole("button", { name: /^Tạo biểu đồ$/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Cơ cấu dữ liệu theo mục đã chọn" })).toBeTruthy();
    expect(screen.getByText(/chưa được trích xuất từ khach-du-lich.xlsx/)).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Chỉnh sửa bằng AI" })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Tiêu đề biểu đồ" }), { target: { value: "Cơ cấu khách du lịch" } });
    const editPrompt = within(dialog).getByRole("textbox", { name: "Yêu cầu chỉnh sửa" }) as HTMLTextAreaElement;
    fireEvent.change(editPrompt, { target: { value: "Làm nổi bật nhóm lớn nhất" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Chuẩn hóa prompt chỉnh sửa biểu đồ" }));
    expect(editPrompt.value).toContain("Chỉ thay đổi những phần được yêu cầu");
    fireEvent.click(within(dialog).getByRole("button", { name: "Khôi phục yêu cầu gốc" }));
    expect(editPrompt.value).toBe("Làm nổi bật nhóm lớn nhất");
    fireEvent.click(within(dialog).getByRole("button", { name: "Áp dụng chỉnh sửa" }));
    expect(screen.getAllByRole("heading", { name: "Cơ cấu khách du lịch" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toContain("Làm nổi bật nhóm lớn nhất");
  });
});
