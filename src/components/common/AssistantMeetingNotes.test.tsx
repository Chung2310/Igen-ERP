// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistantMeetingNotes } from "./AssistantMeetingNotes";

afterEach(cleanup);

describe("AssistantMeetingNotes", () => {
  it("shows recording sources and makes the service boundary clear", () => {
    render(<AssistantMeetingNotes />);
    const direct = screen.getByRole("button", { name: "Ghi âm trực tiếp" });
    expect(direct.getAttribute("aria-pressed")).toBe("true");
    expect(direct.className).toContain("assistant-meeting-source");
    expect(direct.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
    fireEvent.click(screen.getByRole("button", { name: "Ghi âm tab trình duyệt" }));
    expect(screen.getByRole("button", { name: "Ghi âm tab trình duyệt" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Lịch sử" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ghi âm" }));
    expect(screen.getByRole("status").textContent).toContain("dịch vụ được kết nối");
  });

  it("switches to a local upload draft without duplicating history", () => {
    render(<AssistantMeetingNotes />);
    fireEvent.click(screen.getByRole("button", { name: "Tải tài liệu" }));
    const create = screen.getByRole("button", { name: "Tạo ghi chép" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Tệp cuộc họp"), { target: { files: [new File(["notes"], "hop.txt", { type: "text/plain" })] } });
    expect(create.disabled).toBe(false);
    expect(screen.getByText("hop.txt")).toBeTruthy();
    fireEvent.click(create);
    expect(screen.getByRole("status").textContent).toContain("Tệp đã được chọn trên giao diện");
    expect(screen.queryByRole("button", { name: "Lịch sử" })).toBeNull();
  });

  it("keeps the existing popup layout", () => {
    render(<AssistantMeetingNotes standalone={false} />);
    expect(screen.getByRole("button", { name: "Ghi âm trực tiếp" }).className).not.toContain("assistant-meeting-source");
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    expect(screen.getByRole("heading", { name: "Lịch sử ghi chép" })).toBeTruthy();
  });
});
