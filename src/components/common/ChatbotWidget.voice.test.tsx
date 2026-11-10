// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultAssistantSettings } from "../../shared/assistant-workflow";
import type { SpeechRecognitionEvent } from "./assistant-two-way-voice";
const mocks = vi.hoisted(() => ({ settings: vi.fn(), state: vi.fn(), turn: vi.fn(), speech: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "voice-company" } }) }));
vi.mock("../../context/BranchContext", () => ({ useBranchOptional: () => ({ activeBranchId: "voice-branch" }) }));
vi.mock("../../services/assistantService", () => ({ assistantService: mocks }));
import { ChatbotWidget } from "./ChatbotWidget";

class Recognition {
  static instances: Recognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
}
class ReplyAudio {
  static instances: ReplyAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor(public src: string) { ReplyAudio.instances.push(this); }
}
const open = async () => {
  const view = render(<ChatbotWidget mode="standalone" storageScope="voice-check" />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Bật chế độ 2 chiều" }) as HTMLButtonElement).disabled).toBe(false));
  return view;
};
const enable = () => fireEvent.click(screen.getByRole("button", { name: "Bật chế độ 2 chiều" }));
const hear = (text: string, recognition = Recognition.instances.at(-1)!) => act(() => {
  recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: text } }] });
});
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); Recognition.instances = []; ReplyAudio.instances = [];
  mocks.settings.mockResolvedValue(defaultAssistantSettings);
  mocks.state.mockResolvedValue({ messages: [], lastReply: null, busy: false });
  mocks.turn.mockResolvedValue({ status: "completed", reply: "Mình đã nhận yêu cầu." });
  mocks.speech.mockResolvedValue(new Blob(["MP3"], { type: "audio/mpeg" }));
  vi.stubGlobal("SpeechRecognition", Recognition);
  vi.stubGlobal("Audio", ReplyAudio);
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:voice-reply"); static revokeObjectURL = vi.fn(); });
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: true, media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("sends after silence, reads the reply, and resumes for a second request without another click", async () => {
  await open(); vi.useFakeTimers(); enable();
  expect(Recognition.instances).toHaveLength(1);
  expect(Recognition.instances[0].lang).toBe("vi-VN");
  hear("xem danh sách khách hàng");
  const stop = screen.getByRole("button", { name: "Tắt chế độ 2 chiều" }) as HTMLButtonElement;
  expect(stop.disabled).toBe(false);
  await advance(1400);
  expect(mocks.turn).toHaveBeenCalledOnce();
  expect(mocks.turn.mock.calls[0][0].text).toBe("xem danh sách khách hàng");
  expect(mocks.speech).toHaveBeenCalledWith("Mình đã nhận yêu cầu.", expect.any(AbortSignal), defaultAssistantSettings.speechVoice);
  expect(ReplyAudio.instances[0].play).toHaveBeenCalledOnce();
  expect(Recognition.instances).toHaveLength(1);
  await advance(1000);
  expect(Recognition.instances).toHaveLength(1);
  act(() => ReplyAudio.instances[0].onended?.());
  await advance(250);
  expect(Recognition.instances).toHaveLength(2);
  hear("lọc khách hàng mới");
  await advance(1400);
  expect(mocks.turn).toHaveBeenCalledTimes(2);
  expect(mocks.turn.mock.calls[1][0].text).toBe("lọc khách hàng mới");
});

it("stops listening without sending the unfinished request", async () => {
  await open(); vi.useFakeTimers(); enable();
  hear("nội dung chưa gửi");
  const oldEnd = Recognition.instances[0].onend!;
  fireEvent.click(screen.getByRole("button", { name: "Tắt chế độ 2 chiều" }));
  act(() => oldEnd());
  await advance(5000);
  expect(mocks.turn).not.toHaveBeenCalled();
  expect(Recognition.instances).toHaveLength(1);
  expect(Recognition.instances[0].abort).toHaveBeenCalled();
  expect((screen.getByLabelText("Tin nhắn cho trợ lý ảo") as HTMLTextAreaElement).value).toBe("nội dung chưa gửi");
  expect(document.activeElement).toBe(screen.getByLabelText("Tin nhắn cho trợ lý ảo"));
});

it("allows switching off during a pending request without reading or listening again", async () => {
  let finish: (value: { status: string; reply: string }) => void = () => undefined;
  mocks.turn.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await open(); vi.useFakeTimers(); enable(); hear("xem báo cáo");
  await advance(1400);
  const stop = screen.getByRole("button", { name: "Tắt chế độ 2 chiều" }) as HTMLButtonElement;
  expect(stop.disabled).toBe(false);
  fireEvent.click(stop);
  await act(async () => finish({ status: "completed", reply: "Đây là báo cáo." }));
  await advance(1000);
  expect(mocks.speech).not.toHaveBeenCalled();
  expect(Recognition.instances).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Bật chế độ 2 chiều" }).getAttribute("aria-pressed")).toBe("false");
});

it("cancels reply playback when switched off", async () => {
  await open(); vi.useFakeTimers(); enable(); hear("đọc kết quả");
  await advance(1400);
  fireEvent.click(screen.getByRole("button", { name: "Tắt chế độ 2 chiều" }));
  expect(ReplyAudio.instances[0].pause).toHaveBeenCalledOnce();
  await advance(5000);
  expect(Recognition.instances).toHaveLength(1);
});

it("takes over from Hey Igen and does not loop on permission denial", async () => {
  mocks.settings.mockResolvedValue({ ...defaultAssistantSettings, wakeWordEnabled: true });
  await open();
  await waitFor(() => expect(Recognition.instances).toHaveLength(1));
  vi.useFakeTimers(); enable();
  expect(Recognition.instances[0].abort).toHaveBeenCalled();
  expect(Recognition.instances).toHaveLength(2);
  act(() => Recognition.instances[1].onerror?.({ error: "not-allowed" }));
  await advance(5000);
  expect(Recognition.instances).toHaveLength(2);
  expect(screen.getByRole("alert").textContent).toContain("Micro chưa được cấp quyền");
  enable();
  expect(Recognition.instances).toHaveLength(3);
});

it("can switch from two-way listening to editable dictation", async () => {
  await open(); vi.useFakeTimers(); enable();
  fireEvent.click(screen.getByRole("button", { name: "Nhập yêu cầu bằng giọng nói" }));
  expect(Recognition.instances).toHaveLength(2);
  const manual = Recognition.instances[1];
  expect(manual.abort).not.toHaveBeenCalled();
  hear("nội dung cần kiểm tra", manual);
  await advance(5000);
  expect(mocks.turn).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Dừng nhận giọng nói" })).toBeTruthy();
});

it("cleans up recognition and its pending send when the assistant is unmounted", async () => {
  const view = await open(); vi.useFakeTimers(); enable(); hear("đừng gửi sau khi đóng");
  view.unmount();
  await advance(5000);
  expect(mocks.turn).not.toHaveBeenCalled();
  expect(Recognition.instances[0].abort).toHaveBeenCalled();
});

it("shows a usable error when recognition is unsupported", async () => {
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", undefined);
  await open(); enable();
  expect(screen.getByRole("alert").textContent).toContain("chưa hỗ trợ nhận giọng nói");
  expect(screen.getByRole("button", { name: "Bật chế độ 2 chiều" }).getAttribute("aria-pressed")).toBe("false");
});
