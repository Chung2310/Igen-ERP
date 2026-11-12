// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudio } from "./AssistantStudio";
import { assistantService } from "../../services/assistantService";

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
  expect(screen.getByRole("heading", { name: /Biến giọng nói thành văn bản dễ dùng/, level: 2 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: /Biến giọng nói thành văn bản dễ dùng/ }).parentElement?.className).toContain("text-center");
  expect(screen.getByRole("button", { name: "Tải lên từ máy tính" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Chuyển thành văn bản" }).parentElement?.className).toContain("justify-center");
  fireEvent.click(screen.getByRole("button", { name: "AI Studio" }));
  const cloneTool = screen.getByRole("button", { name: /Tạo giọng cá nhân/ });
  expect((cloneTool as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(cloneTool);
  expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
});

it("submits an audio file and shows the returned transcript", async () => {
  const submit = vi.spyOn(assistantService, "transcribeStudioAudio").mockResolvedValue({ id: "one", fileName: "mau.mp3", text: "Xin chào iGen", createdAt: new Date().toISOString() });
  render(<AssistantStudio />);
  fireEvent.click(screen.getByRole("button", { name: /Chuyển giọng nói thành văn bản/ }));
  const file = new File(["audio"], "mau.mp3", { type: "audio/mpeg" });
  fireEvent.change(screen.getByLabelText("Chọn tệp âm thanh"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Chuyển thành văn bản" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(file));
  expect(await screen.findByText("Xin chào iGen")).toBeTruthy();
  submit.mockRestore();
});
