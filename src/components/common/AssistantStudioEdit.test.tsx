// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudioEdit } from "./AssistantStudioEdit";
import { requestStudioImageEdit } from "./assistantStudioImageApi";

vi.mock("./assistantStudioImageApi", async importOriginal => ({
  ...(await importOriginal<typeof import("./assistantStudioImageApi")>()),
  requestStudioImageEdit: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AssistantStudioEdit preset prompts", () => {
  it.each([
    ["Xóa vùng ảnh", "Đối tượng/vùng cần xóa:"],
    ["Xóa nền", "kênh alpha trong suốt thật"],
    ["Đổi nền", "Nền mới:"],
    ["Nâng cao chất lượng", "giảm nhiễu"],
  ])("fills an editable prompt when %s is selected", async (label, expectedText) => {
    render(<AssistantStudioEdit onBack={() => {}} />);
    const button = screen.getByRole("button", { name: new RegExp(label) });
    fireEvent.click(button);

    const textarea = screen.getByLabelText("Yêu cầu chỉnh sửa") as HTMLTextAreaElement;
    expect(textarea.value).toContain(expectedText);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(textarea.selectionStart).toBe(textarea.value.length));
    expect(screen.queryByRole("button", { name: /Theo mô tả/ })).toBeNull();
    expect(requestStudioImageEdit).not.toHaveBeenCalled();
  });

  it("keeps user edits when the selected preset is clicked again", () => {
    render(<AssistantStudioEdit onBack={() => {}} />);
    const erase = screen.getByRole("button", { name: /Xóa vùng ảnh/ });
    fireEvent.click(erase);
    const textarea = screen.getByLabelText("Yêu cầu chỉnh sửa") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: `${textarea.value}cốc đỏ trên bàn` } });
    const editedPrompt = textarea.value;

    fireEvent.click(erase);

    expect(textarea.value).toBe(editedPrompt);
  });

  it("sends the selected remove-background mode and edited preset prompt with the uploaded image", async () => {
    vi.mocked(requestStudioImageEdit).mockResolvedValue({
      image: { url: "data:image/png;base64,YQ==" },
      model: "iGenAI",
      regionApplied: false,
    });
    render(<AssistantStudioEdit onBack={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chọn ảnh cần chỉnh sửa"), {
      target: { files: [new File(["image"], "source.png", { type: "image/png" })] },
    });
    await screen.findByText("source.png");

    fireEvent.click(screen.getByRole("button", { name: /Xóa nền/ }));
    const textarea = screen.getByLabelText("Yêu cầu chỉnh sửa") as HTMLTextAreaElement;
    const editedPrompt = `${textarea.value} Giữ nguyên cả những khe nhỏ giữa các nhánh.`;
    fireEvent.change(textarea, { target: { value: editedPrompt } });
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập chỉnh sửa hình ảnh" }));

    await waitFor(() => expect(requestStudioImageEdit).toHaveBeenCalledWith(expect.objectContaining({
      sourceImage: expect.stringMatching(/^data:image\/png;base64,/),
      prompt: editedPrompt,
      mode: "remove-background",
    })));
  });
});
