// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantMeetingNotes } from "./AssistantMeetingNotes";
import { assistantService } from "../../services/assistantService";
import { assistantAgentService } from "../../services/assistantAgentService";

vi.mock("../../services/assistantService", () => ({ assistantService: { transcribeStudioAudio: vi.fn() } }));
vi.mock("../../services/assistantAgentService", () => ({ assistantAgentService: { chat: vi.fn() } }));
const originalDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); if (originalDevices) Object.defineProperty(navigator, "mediaDevices", originalDevices); else Reflect.deleteProperty(navigator, "mediaDevices"); });

it("records from the microphone with pause, resume, notes, and cancel controls", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => window.clearTimeout(frame));
  const audioSource = { connect: vi.fn(), disconnect: vi.fn() };
  const meter = { fftSize: 512, getByteTimeDomainData: vi.fn((samples: Uint8Array) => { samples.fill(128); samples.fill(255, 0, 20); }) };
  class FakeAudioContext {
    createMediaStreamSource() { return audioSource; }
    createAnalyser() { return meter; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  class FakeRecorder {
    state: RecordingState = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(_stream: MediaStream) {}
    start() { this.state = "recording"; }
    pause() { this.state = "paused"; }
    resume() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  render(<AssistantMeetingNotes />);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ghi âm" }));
  const pause = await screen.findByRole("button", { name: "Tạm dừng ghi âm" });
  await waitFor(() => expect(audioSource.connect).toHaveBeenCalledWith(meter));
  await waitFor(() => expect([...document.querySelectorAll<HTMLElement>("[data-wave-bar]")].some(bar => bar.style.transform !== "scaleY(0.12)")).toBe(true));
  fireEvent.change(screen.getByRole("textbox", { name: "Tiêu đề ghi chú" }), { target: { value: "Họp tuần" } });
  const note = screen.getByRole("textbox", { name: "Ghi chú cuộc họp" }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "Việc cần làm" } });
  note.setSelectionRange(0, 4);
  fireEvent.click(screen.getByRole("button", { name: "Định dạng bold" }));
  expect(note.value).toContain("**Việc**");
  fireEvent.click(pause);
  expect([...document.querySelectorAll<HTMLElement>("[data-wave-bar]")].every(bar => bar.style.transform === "scaleY(0.12)")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục ghi âm" }));
  fireEvent.click(screen.getByRole("button", { name: "Hủy ghi âm" }));
  expect(screen.getByRole("button", { name: "Bắt đầu ghi âm" })).toBeTruthy();
  expect(assistantService.transcribeStudioAudio).not.toHaveBeenCalled();
});

it("uploads meeting audio, shows the transcript, and restores it from history", async () => {
  vi.mocked(assistantService.transcribeStudioAudio).mockResolvedValue({ id: "meeting-1", fileName: "hop.mp3", text: "Nội dung cuộc họp", createdAt: "2026-11-16T08:00:00.000Z" });
  vi.mocked(assistantAgentService.chat).mockResolvedValue({ reply: "Tóm tắt: Nội dung cuộc họp" });
  render(<AssistantMeetingNotes />);
  expect(screen.queryByText("Ghi âm tab trình duyệt")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tải tài liệu" }));
  const audio = new File(["audio"], "hop.mp3", { type: "audio/mpeg" });
  fireEvent.change(screen.getByLabelText("Tệp âm thanh cuộc họp"), { target: { files: [audio] } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo ghi chép" }));
  await waitFor(() => expect(screen.getByText("Nội dung cuộc họp")).toBeTruthy());
  await waitFor(() => expect(screen.getByText("Tóm tắt: Nội dung cuộc họp")).toBeTruthy());
  expect(assistantService.transcribeStudioAudio).toHaveBeenCalledWith(audio);
  fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
  expect(screen.getByRole("button", { name: /hop/ })).toBeTruthy();
});
