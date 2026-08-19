// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TemplateEditor, { VARIABLES_BY_TYPE, fillSampleValues } from "./TemplateEditor";
import { MARKETING_VARIABLE_REGISTRY } from "./marketingVariableRegistry";
import { fillSampleValues as fillSharedSampleValues, toFriendlyTokens as toSharedFriendlyTokens, toRawTokens as toSharedRawTokens } from "../../../components/template-editor/templateTokenCodec";
import { toFriendlyTokens, toRawTokens } from "./marketingTemplateTokenCodec";

afterEach(cleanup);

function withDataTransfer() {
  const store = new Map<string, string>();
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) || "",
    effectAllowed: "copy",
  };
}

describe("TemplateEditor", () => {
  it("hiển thị tên tiếng Việt thay vì cú pháp biến", () => {
    render(<TemplateEditor automationType="thank_you" subject="Cảm ơn" html="<p>Xin chào</p>" disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tên khách hàng" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mã đơn hàng" })).toBeTruthy();
    expect(screen.queryByText(/{{customerName}}/)).toBeNull();
  });

  it("chỉ bày thông tin có ý nghĩa với loại tin đang soạn", () => {
    render(<TemplateEditor automationType="birthday" subject="" html="" disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tên khách hàng" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mã đơn hàng" })).toBeNull();
  });

  it("bấm nút thì chèn biến vào nội dung đang active", () => {
    const onChange = vi.fn();
    render(<TemplateEditor automationType="birthday" subject="" html="Chào " disabled={false} onChange={onChange} />);
    fireEvent.focus(screen.getByRole("textbox", { name: "Nội dung" }));
    fireEvent.click(screen.getByRole("button", { name: "Tên khách hàng" }));
    expect(onChange).toHaveBeenCalledWith({ html: "Chào {{customerName}}" });
  });

  it("bấm nút thì chèn biến vào tiêu đề khi tiêu đề đang active", () => {
    const onChange = vi.fn();
    render(<TemplateEditor automationType="birthday" subject="Chúc mừng " html="" disabled={false} onChange={onChange} />);
    fireEvent.focus(screen.getByRole("textbox", { name: "Tiêu đề" }));
    fireEvent.click(screen.getByRole("button", { name: "Tên khách hàng" }));
    expect(onChange).toHaveBeenCalledWith({ subject: "Chúc mừng {{customerName}}" });
  });

  it("kéo thả biến vào tiêu đề", () => {
    const onChange = vi.fn();
    const dataTransfer = withDataTransfer();
    render(<TemplateEditor automationType="birthday" subject="Xin chào " html="" disabled={false} onChange={onChange} />);
    const pill = screen.getByRole("button", { name: "Tên khách hàng" });
    const subject = screen.getByRole("textbox", { name: "Tiêu đề" });
    fireEvent.dragStart(pill, { dataTransfer });
    fireEvent.drop(subject, { dataTransfer });
    expect(onChange).toHaveBeenCalledWith({ subject: "Xin chào {{customerName}}" });
  });

  it("kéo thả biến vào nội dung", () => {
    const onChange = vi.fn();
    const dataTransfer = withDataTransfer();
    render(<TemplateEditor automationType="thank_you" subject="" html="Đơn " disabled={false} onChange={onChange} />);
    const pill = screen.getByRole("button", { name: "Mã đơn hàng" });
    const editor = screen.getByRole("textbox", { name: "Nội dung" });
    fireEvent.dragStart(pill, { dataTransfer });
    fireEvent.drop(editor, { dataTransfer });
    expect(onChange).toHaveBeenCalledWith({ html: "Đơn {{orderCode}}" });
  });

  it("xem trước thay biến bằng dữ liệu mẫu", () => {
    render(<TemplateEditor automationType="thank_you" subject="Cảm ơn {{customerName}}" html="<p>Đơn {{orderCode}}</p>" disabled={false} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Xem trước/ }));
    expect(screen.getByText("Cảm ơn Chị Nguyễn Thu Lan")).toBeTruthy();
    expect(screen.getByText("Đơn DH-2026-0158")).toBeTruthy();
  });

  it("hiển thị token đã lưu dưới dạng nhãn thân thiện trong editor", () => {
    render(<TemplateEditor automationType="thank_you" subject="Cảm ơn {{customerName}}" html="Đơn {{orderCode}}" disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Tiêu đề" }).textContent).toContain("[Tên khách hàng]");
    expect(screen.getByRole("textbox", { name: "Nội dung" }).textContent).toContain("[Mã đơn hàng]");
  });
});

describe("fillSampleValues", () => {
  it("giữ nguyên chuỗi không phải biến đã biết", () => {
    expect(fillSampleValues("Giảm 50% {{unknown}}")).toBe("Giảm 50% {{unknown}}");
  });

  it("mọi biến được bày ra đều có nhãn và giá trị mẫu", () => {
    for (const keys of Object.values(VARIABLES_BY_TYPE)) {
      for (const key of keys) expect(fillSampleValues(`{{${key}}}`)).not.toBe(`{{${key}}}`);
    }
  });
});

describe("marketingTemplateTokenCodec", () => {
  it("converts raw backend tokens to friendly labels", () => {
    expect(toFriendlyTokens("Cảm ơn {{customerName}} từ {{companyName}}")).toBe("Cảm ơn [Tên khách hàng] từ [Tên cửa hàng]");
  });

  it("supports extracted shared codec signatures with an injected variable list", () => {
    const variables = Object.values(MARKETING_VARIABLE_REGISTRY);
    expect(toSharedFriendlyTokens("Cảm ơn {{customerName}}", variables)).toBe("Cảm ơn [Tên khách hàng]");
    expect(toSharedRawTokens("Cảm ơn [Tên khách hàng]", variables)).toBe("Cảm ơn {{customerName}}");
    expect(fillSharedSampleValues("Xin chào {{companyName}}", variables)).toContain("Cửa hàng iGen");
    expect(toFriendlyTokens("Cảm ơn {{customerName}}")).toBe("Cảm ơn [Tên khách hàng]");
    expect(toRawTokens("Cảm ơn [Tên khách hàng]")).toBe("Cảm ơn {{customerName}}");
    expect(fillSampleValues("Xin chào {{companyName}}")).toContain("Cửa hàng iGen");
  });

  it("converts friendly labels back to raw backend tokens", () => {
    expect(toRawTokens("Cảm ơn [Tên khách hàng] từ [Tên cửa hàng]")).toBe("Cảm ơn {{customerName}} từ {{companyName}}");
  });

  it("keeps unknown friendly tokens untouched", () => {
    expect(toRawTokens("Giảm 50% [Biến lạ]")).toBe("Giảm 50% [Biến lạ]");
  });
});
