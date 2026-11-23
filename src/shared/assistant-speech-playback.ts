export interface AssistantSpeechPlayback {
  stop(): void;
}

export interface AssistantSpeechPlaybackOptions {
  signal?: AbortSignal;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

let playbackContext: AudioContext | null = null;

function getPlaybackContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  if (!playbackContext || playbackContext.state === "closed") playbackContext = new window.AudioContext();
  return playbackContext;
}

/** Call from a user action so Safari allows a later assistant reply to play. */
export function unlockAssistantSpeechPlayback(): void {
  const context = getPlaybackContext();
  if (!context) return;

  try {
    if (context.state !== "running") void context.resume().catch(() => undefined);
    const silence = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = silence;
    source.connect(context.destination);
    source.onended = () => source.disconnect();
    source.start();
  } catch {
    // Browsers without an available audio output can still try HTML audio playback.
  }
}

function abortError(): DOMException {
  return new DOMException("Phát âm thanh đã bị hủy.", "AbortError");
}

async function playWithAudioContext(
  blob: Blob,
  context: AudioContext,
  options: AssistantSpeechPlaybackOptions,
): Promise<AssistantSpeechPlayback> {
  const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer());
  if (options.signal?.aborted) throw abortError();
  if (context.state !== "running") throw new DOMException("Trình duyệt chưa sẵn sàng phát âm thanh.", "NotAllowedError");

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(context.destination);
  let stopped = false;
  let finished = false;
  const startedAt = context.currentTime;
  const currentTime = () => Math.min(audioBuffer.duration, Math.max(0, context.currentTime - startedAt));
  const updateProgress = () => options.onTimeUpdate?.(currentTime(), audioBuffer.duration);
  const interval = window.setInterval(updateProgress, 100);

  const cleanUp = () => {
    if (finished) return;
    finished = true;
    window.clearInterval(interval);
    options.signal?.removeEventListener("abort", stop);
    source.onended = null;
    source.disconnect();
  };
  const stop = () => {
    if (stopped || finished) return;
    stopped = true;
    cleanUp();
    try { source.stop(); } catch { /* The source may have ended between the state check and stop. */ }
  };
  source.onended = () => {
    if (stopped) return;
    cleanUp();
    options.onTimeUpdate?.(audioBuffer.duration, audioBuffer.duration);
    options.onEnded?.();
  };
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) {
    stop();
    throw abortError();
  }

  try {
    source.start();
    updateProgress();
  } catch (error) {
    cleanUp();
    throw error;
  }

  return { stop };
}

async function playWithHtmlAudio(
  blob: Blob,
  options: AssistantSpeechPlaybackOptions,
): Promise<AssistantSpeechPlayback> {
  if (options.signal?.aborted) throw abortError();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let stopped = false;
  let finished = false;

  const cleanUp = () => {
    if (finished) return;
    finished = true;
    audio.removeEventListener("timeupdate", updateProgress);
    audio.removeEventListener("ended", handleEnded);
    options.signal?.removeEventListener("abort", stop);
    URL.revokeObjectURL(url);
  };
  const updateProgress = () => options.onTimeUpdate?.(audio.currentTime, audio.duration);
  const handleEnded = () => {
    if (stopped) return;
    cleanUp();
    options.onEnded?.();
  };
  const stop = () => {
    if (stopped || finished) return;
    stopped = true;
    audio.pause();
    cleanUp();
  };

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("ended", handleEnded);
  options.signal?.addEventListener("abort", stop, { once: true });
  try {
    await audio.play();
  } catch (error) {
    cleanUp();
    throw error;
  }
  if (options.signal?.aborted) {
    stop();
    throw abortError();
  }
  return { stop };
}

export async function playAssistantSpeech(
  blob: Blob,
  options: AssistantSpeechPlaybackOptions = {},
): Promise<AssistantSpeechPlayback> {
  const context = getPlaybackContext();
  if (context?.state === "running") {
    try {
      return await playWithAudioContext(blob, context, options);
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      // Keep native playback as a fallback for browsers that cannot decode the returned MP3 in Web Audio.
    }
  }
  return playWithHtmlAudio(blob, options);
}
