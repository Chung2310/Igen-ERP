import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startTwoWayVoice, voiceSilenceMs, type SpeechRecognitionEvent } from "./assistant-two-way-voice";

class Recognition {
  static instances: Recognition[] = [];
  static failStart = false;
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  start = vi.fn(() => { if (Recognition.failStart) throw new Error("cannot start"); this.onstart?.(); });
  stop = vi.fn();
  abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
}
let cleanup: (() => void) | undefined;
const setup = () => {
  const callbacks = { onRecognitionChange: vi.fn(), onTranscript: vi.fn(), onSubmit: vi.fn(), onError: vi.fn() };
  cleanup = startTwoWayVoice({ Recognition, ...callbacks });
  return { ...callbacks, recognition: Recognition.instances[0] };
};
const result = (transcript: string, isFinal = false) => ({ isFinal, 0: { transcript } });
const hear = (recognition: Recognition, transcript: string, isFinal = false) => recognition.onresult?.({ resultIndex: 0, results: [result(transcript, isFinal)] });
beforeEach(() => { vi.useFakeTimers(); Recognition.instances = []; Recognition.failStart = false; });
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); });

it("starts Vietnamese continuous recognition immediately", () => {
  const { recognition, onRecognitionChange } = setup();
  expect(recognition.lang).toBe("vi-VN");
  expect(recognition.continuous).toBe(true);
  expect(recognition.interimResults).toBe(true);
  expect(recognition.start).toHaveBeenCalledOnce();
  expect(onRecognitionChange).toHaveBeenCalledWith(recognition);
});

it("waits for silence on interim results, then accepts a corrected final result exactly once", () => {
  const { recognition, onSubmit } = setup();
  const lateEnd = recognition.onend!;
  hear(recognition, "xem khách");
  vi.advanceTimersByTime(voiceSilenceMs - 1);
  expect(recognition.stop).not.toHaveBeenCalled();
  hear(recognition, "xem khách hàng");
  vi.advanceTimersByTime(voiceSilenceMs);
  expect(recognition.stop).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
  hear(recognition, "xem danh sách khách hàng", true);
  recognition.onend?.();
  lateEnd();
  vi.advanceTimersByTime(5000);
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("xem danh sách khách hàng");
  expect(Recognition.instances).toHaveLength(1);
});

it("submits interim text if the browser never emits end after stop", () => {
  const { recognition, onSubmit } = setup();
  hear(recognition, "xem báo cáo tháng này");
  vi.advanceTimersByTime(voiceSilenceMs + 1200);
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("xem báo cáo tháng này");
  expect(recognition.abort).toHaveBeenCalledOnce();
});

it("keeps listening through an active utterance until speechend", () => {
  const { recognition, onSubmit } = setup();
  recognition.onspeechstart?.();
  hear(recognition, "lập kế hoạch");
  vi.advanceTimersByTime(10000);
  expect(recognition.stop).not.toHaveBeenCalled();
  hear(recognition, "lập kế hoạch cho tháng tới");
  recognition.onspeechend?.();
  vi.advanceTimersByTime(voiceSilenceMs);
  recognition.onend?.();
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lập kế hoạch cho tháng tới");
});

it("replaces interim segments without duplicating final segments", () => {
  const { recognition, onSubmit } = setup();
  recognition.onresult?.({ resultIndex: 0, results: [result("tạo báo cáo", true), result("tuần")] });
  recognition.onresult?.({ resultIndex: 1, results: [result("tạo báo cáo", true), result("tuần này", true)] });
  vi.advanceTimersByTime(voiceSilenceMs);
  recognition.onend?.();
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("tạo báo cáo tuần này");
});

it("does not send a retracted interim result", () => {
  const { recognition, onSubmit } = setup();
  hear(recognition, "nội dung tạm");
  recognition.onresult?.({ resultIndex: 0, results: [] });
  vi.advanceTimersByTime(5000);
  expect(recognition.stop).not.toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("restarts after an empty recognition session without sending a message", () => {
  const { recognition, onSubmit } = setup();
  recognition.onend?.();
  vi.advanceTimersByTime(400);
  expect(Recognition.instances).toHaveLength(2);
  expect(onSubmit).not.toHaveBeenCalled();
});

it("recovers from no-speech without reporting an error", () => {
  const { recognition, onSubmit, onError } = setup();
  recognition.onerror?.({ error: "no-speech" });
  vi.advanceTimersByTime(400);
  expect(Recognition.instances).toHaveLength(2);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

it("stops after a permission error without retrying", () => {
  const { recognition, onSubmit, onError } = setup();
  hear(recognition, "không gửi khi bị lỗi");
  recognition.onerror?.({ error: "not-allowed" });
  vi.advanceTimersByTime(10000);
  expect(onError).toHaveBeenCalledExactlyOnceWith("not-allowed");
  expect(onSubmit).not.toHaveBeenCalled();
  expect(Recognition.instances).toHaveLength(1);
});

it("cancels silence timers and ignores late results when switched off", () => {
  const { recognition, onSubmit } = setup();
  const lateResult = recognition.onresult!;
  const lateEnd = recognition.onend!;
  hear(recognition, "yêu cầu chưa gửi");
  cleanup?.();
  lateResult({ resultIndex: 0, results: [result("không được gửi", true)] });
  lateEnd();
  vi.advanceTimersByTime(10000);
  expect(recognition.abort).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(Recognition.instances).toHaveLength(1);
});

it("releases recognition when start fails", () => {
  Recognition.failStart = true;
  const { recognition, onError, onRecognitionChange } = setup();
  expect(onError).toHaveBeenCalledExactlyOnceWith("start-failed");
  expect(onRecognitionChange).toHaveBeenLastCalledWith(null, recognition);
  expect(recognition.abort).toHaveBeenCalledOnce();
});
