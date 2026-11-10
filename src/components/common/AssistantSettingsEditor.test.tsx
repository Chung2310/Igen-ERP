// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { defaultAssistantSettings } from "../../shared/assistant-workflow";
const mocks = vi.hoisted(() => ({ saveSettings: vi.fn(), settings: vi.fn(), speech: vi.fn() }));
vi.mock("../../services/assistantService", () => ({ assistantService: mocks }));
import { AssistantSettingsEditor } from "./AssistantSettingsEditor";
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("retains edits on conflict and applies settings only after a successful save", async () => {
  const onSave = vi.fn();
  mocks.saveSettings.mockRejectedValueOnce(new Error("Cài đặt đã thay đổi"));
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={onSave} />);
  fireEvent.click(screen.getByLabelText("Luôn xác nhận trước khi thay đổi dữ liệu"));
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Cài đặt đã thay đổi");
  expect(onSave).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Luôn xác nhận trước khi thay đổi dữ liệu") as HTMLInputElement).checked).toBe(true);
  const saved = { ...defaultAssistantSettings, alwaysConfirm: true, version: 1 };
  mocks.saveSettings.mockResolvedValueOnce(saved);
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(onSave).toHaveBeenCalledWith(saved);
});

it("saves the spoken-reply preference", async () => {
  const onSave = vi.fn();
  const saved = { ...defaultAssistantSettings, speakReplies: true, version: 1 };
  mocks.saveSettings.mockResolvedValueOnce(saved);
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={onSave} />);
  fireEvent.click(screen.getByLabelText("Đọc câu trả lời thành tiếng"));
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(mocks.saveSettings).toHaveBeenCalledWith({ ...defaultAssistantSettings, speakReplies: true });
  expect(onSave).toHaveBeenCalledWith(saved);
});

it("previews and saves a selected Vietnamese speech voice", async () => {
  class AudioMock {
    static instances: AudioMock[] = [];
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    constructor(public src: string) { AudioMock.instances.push(this); }
  }
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:voice-preview"); static revokeObjectURL = revokeObjectURL; });
  vi.stubGlobal("Audio", AudioMock);
  mocks.speech.mockResolvedValue(new Blob(["MP3"], { type: "audio/mpeg" }));
  const saved = { ...defaultAssistantSettings, speechVoice: "george" as const, version: 1 };
  mocks.saveSettings.mockResolvedValue(saved);
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={vi.fn()} />);

  fireEvent.change(screen.getByLabelText("Giọng đọc tiếng Việt"), { target: { value: "george" } });
  fireEvent.click(screen.getByRole("button", { name: "Nghe thử giọng" }));
  await waitFor(() => expect(mocks.speech).toHaveBeenCalledWith(expect.any(String), expect.any(AbortSignal), "george"));
  await waitFor(() => expect(AudioMock.instances[0]?.play).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Dừng nghe thử" }));
  expect(AudioMock.instances[0].pause).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice-preview");
  fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(mocks.saveSettings).toHaveBeenCalledWith({ ...defaultAssistantSettings, speechVoice: "george" });
});

it("saves the Hey Igen wake-word preference", async () => {
  const onSave = vi.fn();
  const saved = { ...defaultAssistantSettings, wakeWordEnabled: true, version: 1 };
  mocks.saveSettings.mockResolvedValueOnce(saved);
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={onSave} />);
  fireEvent.click(screen.getByLabelText("Nghe lệnh bằng từ khóa “Hey Igen”"));
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(mocks.saveSettings).toHaveBeenCalledWith({ ...defaultAssistantSettings, wakeWordEnabled: true });
  expect(onSave).toHaveBeenCalledWith(saved);
});

it("saves the personal memory preference", async () => {
  const onSave = vi.fn();
  const saved = { ...defaultAssistantSettings, memoryEnabled: false, version: 1 };
  mocks.saveSettings.mockResolvedValueOnce(saved);
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={onSave} />);
  fireEvent.click(screen.getByLabelText("Cho phép trợ lý dùng ghi nhớ của tôi"));
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(mocks.saveSettings).toHaveBeenCalledWith({ ...defaultAssistantSettings, memoryEnabled: false });
  expect(onSave).toHaveBeenCalledWith(saved);
});

it("saves account response rules separately from workflow interpretation guidance", async () => {
  const onSave = vi.fn();
  const responseRules = "Trả lời tự nhiên, thân thiện bằng tiếng Việt; không dùng câu mẫu cứng nhắc.";
  const saved = { ...defaultAssistantSettings, responseRules, version: 1 };
  mocks.saveSettings.mockResolvedValueOnce(saved);
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("Quy tắc trả lời"), { target: { value: responseRules } });
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(mocks.saveSettings).toHaveBeenCalledWith({ ...defaultAssistantSettings, responseRules });
  expect(onSave).toHaveBeenCalledWith(saved);
});

it("lets the account turn automatic memory off", async () => {
  const onSave = vi.fn();
  const saved = { ...defaultAssistantSettings, autoMemoryEnabled: false, version: 1 };
  mocks.saveSettings.mockResolvedValueOnce(saved);
  render(<AssistantSettingsEditor settings={defaultAssistantSettings} onSave={onSave} />);
  fireEvent.click(screen.getByLabelText("Tự động lưu thông tin hữu ích"));
  fireEvent.click(screen.getByText("Lưu cài đặt"));
  await screen.findByText("Đã lưu và áp dụng cài đặt trợ lý.");
  expect(mocks.saveSettings).toHaveBeenCalledWith({ ...defaultAssistantSettings, autoMemoryEnabled: false });
  expect(onSave).toHaveBeenCalledWith(saved);
});
