// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { playAssistantSpeech, unlockAssistantSpeechPlayback } from "./assistant-speech-playback";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("unlocks Web Audio synchronously and plays assistant speech through the unlocked context", async () => {
  const sources: Array<{ buffer: AudioBuffer | null; onended: (() => void) | null; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  let createdContext: FakeAudioContext | undefined;
  class FakeAudioContext {
    state: AudioContextState = "suspended";
    sampleRate = 44_100;
    currentTime = 0;
    destination = {} as AudioDestinationNode;
    resume = vi.fn(async () => { this.state = "running"; });
    createBuffer = vi.fn(() => ({ duration: 1 } as AudioBuffer));
    createBufferSource = vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      sources.push(source);
      return source as unknown as AudioBufferSourceNode;
    });
    decodeAudioData = vi.fn(async () => ({ duration: 1 } as AudioBuffer));
    constructor() { createdContext = this; }
  }
  Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });

  unlockAssistantSpeechPlayback();
  expect(createdContext?.resume).toHaveBeenCalledOnce();

  const playbackPromise = playAssistantSpeech(new Blob(["mp3"], { type: "audio/mpeg" }), {
    onTimeUpdate: vi.fn(),
  });
  const playback = await playbackPromise;

  expect(sources).toHaveLength(2);
  expect(sources[0].start).toHaveBeenCalledOnce();
  expect(sources[1].start).toHaveBeenCalledOnce();
  expect(createdContext?.decodeAudioData).toHaveBeenCalledOnce();
  playback.stop();
  expect(sources[1].stop).toHaveBeenCalledOnce();
});
