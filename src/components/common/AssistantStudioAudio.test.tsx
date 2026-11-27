// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudio } from "./AssistantStudio";
import { assistantService } from "../../services/assistantService";
import { toast } from "../../pages/Toast";

afterEach(cleanup);

it("shows three separate audio tools inside AI Studio", () => {
  render(<AssistantStudio />);
  const audio = screen.getByRole("region", { name: "Âm thanh" });
  expect(audio.querySelectorAll("button.assistant-studio-card")).toHaveLength(3);
  expect(Array.from(audio.querySelectorAll("button.assistant-studio-card img"), image => image.getAttribute("src"))).toEqual([
    "/ai-studio-voice-clone.webp",
    "/ai-studio-text-to-speech.webp",
    "/ai-studio-speech-to-text.webp",
  ]);
  fireEvent.click(screen.getByRole("button", { name: /Chuyển giọng nói thành văn bản/ }));
  expect(screen.getByRole("heading", { name: "Chuyển giọng nói thành văn bản", level: 2 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Chuyển giọng nói thành văn bản", level: 2 }).parentElement?.className).toContain("text-center");
  expect(screen.getByRole("button", { name: "Tải lên từ máy tính" })).toBeTruthy();
  const transcribeButton = screen.getByRole("button", { name: "Chuyển thành văn bản" }) as HTMLButtonElement;
  expect(transcribeButton.parentElement?.className).toContain("sticky bottom-0");
  expect(transcribeButton.className).toContain("bg-primary");
  expect(transcribeButton.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "AI Studio" }));
  const cloneTool = screen.getByRole("button", { name: /Tạo giọng cá nhân/ });
  expect((cloneTool as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(cloneTool);
  expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
});

it("submits an audio file and shows the returned transcript", async () => {
  const submit = vi.spyOn(assistantService, "transcribeStudioAudio").mockResolvedValue({ id: "one", fileName: "mau.mp3", text: "Xin chào iGen", createdAt: new Date().toISOString() });
  const toastSuccess = vi.spyOn(toast, "success");
  try {
    render(<AssistantStudio />);
    fireEvent.click(screen.getByRole("button", { name: /Chuyển giọng nói thành văn bản/ }));
    const file = new File(["audio"], "mau.mp3", { type: "audio/mpeg" });
    fireEvent.change(screen.getByLabelText("Chọn tệp âm thanh"), { target: { files: [file] } });
    expect((screen.getByRole("button", { name: "Chuyển thành văn bản" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Chuyển thành văn bản" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(file));
    expect(await screen.findByText("Xin chào iGen")).toBeTruthy();
    expect(screen.getByText("Chuyển giọng nói thành văn bản thành công!")).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith("Chuyển giọng nói thành văn bản thành công!");
  } finally {
    submit.mockRestore();
    toastSuccess.mockRestore();
  }
});

it("shows success feedback and scrollable result area after generating speech", async () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => "blob:igen-test-audio");
  URL.revokeObjectURL = vi.fn();
  const speech = vi.spyOn(assistantService, "speech").mockResolvedValue(new Blob(["mp3"], { type: "audio/mpeg" }));
  const toastSuccess = vi.spyOn(toast, "success");

  try {
    render(<AssistantStudio />);
    fireEvent.click(screen.getByRole("button", { name: /Chuyển văn bản thành giọng nói/ }));
    const main = screen.getByRole("main");
    expect(main.className).toContain("overflow-y-auto");

    fireEvent.change(screen.getByLabelText("Văn bản cần chuyển thành giọng nói"), { target: { value: "Xin chào iGen ERP" } });
    fireEvent.click(screen.getByRole("button", { name: "Chuyển đổi" }));

    await waitFor(() => expect(speech).toHaveBeenCalled());
    expect(await screen.findByText(/Chuyển đổi thành công/)).toBeTruthy();
    expect(screen.getByLabelText("Audio vừa tạo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tải audio xuống" })).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith("Chuyển đổi giọng nói thành công!");
  } finally {
    speech.mockRestore();
    toastSuccess.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
