export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance; }
export type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export const voiceSilenceMs = 1400;
const finalResultWaitMs = 1200;

type Options = {
  Recognition: SpeechRecognitionConstructor;
  onRecognitionChange: (next: SpeechRecognitionInstance | null, previous?: SpeechRecognitionInstance) => void;
  onTranscript: (text: string) => void;
  onSubmit: (text: string) => void;
  onError: (error: string) => void;
};

/** One utterance per session; the caller resumes listening after its reply completes. */
export function startTwoWayVoice(options: Options): () => void {
  let active = true;
  let current: SpeechRecognitionInstance | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let finalTimer: ReturnType<typeof setTimeout> | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  const clearSilence = () => { clearTimeout(silenceTimer); silenceTimer = undefined; };
  const clearTimers = () => {
    clearSilence(); clearTimeout(finalTimer); clearTimeout(restartTimer);
    finalTimer = undefined; restartTimer = undefined;
  };
  const release = (recognition: SpeechRecognitionInstance) => {
    clearTimers();
    recognition.onstart = null; recognition.onresult = null; recognition.onerror = null;
    recognition.onend = null; recognition.onspeechstart = null; recognition.onspeechend = null;
    if (current === recognition) current = null;
    options.onRecognitionChange(null, recognition);
  };
  const abort = (recognition: SpeechRecognitionInstance) => { try { recognition.abort(); } catch { /* Already disconnected. */ } };
  const restart = () => { if (active) restartTimer = setTimeout(begin, 400); };
  function begin() {
    if (!active || current) return;
    let recognition: SpeechRecognitionInstance;
    try { recognition = new options.Recognition(); }
    catch { active = false; options.onError("start-failed"); return; }
    let transcript = "";
    let speaking = false;
    let stopping = false;
    const ownsSession = () => active && current === recognition;
    const finish = () => {
      if (!ownsSession()) return;
      const text = transcript.trim();
      release(recognition);
      abort(recognition);
      if (text) options.onSubmit(text);
      else restart();
    };
    const requestStop = () => {
      if (!ownsSession() || stopping || !transcript.trim()) return;
      stopping = true;
      clearSilence();
      // stop() may deliver a corrected final result before end: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/stop
      finalTimer = setTimeout(finish, finalResultWaitMs);
      try { recognition.stop(); } catch { finish(); }
    };
    const schedule = () => {
      clearSilence();
      if (ownsSession() && !stopping && transcript.trim()) silenceTimer = setTimeout(requestStop, voiceSilenceMs);
    };
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    current = recognition;
    options.onRecognitionChange(recognition);
    recognition.onresult = event => {
      if (!ownsSession()) return;
      const results = Array.from(event.results);
      transcript = results.map(result => result[0].transcript.trim()).filter(Boolean).join(" ");
      options.onTranscript(transcript);
      if (!speaking || results.every(result => result.isFinal)) schedule();
      else clearSilence();
    };
    recognition.onspeechstart = () => { if (ownsSession()) { speaking = true; clearSilence(); } };
    recognition.onspeechend = () => { if (ownsSession()) { speaking = false; schedule(); } };
    recognition.onend = finish;
    recognition.onerror = event => {
      if (!ownsSession()) return;
      release(recognition);
      abort(recognition);
      if (event.error === "no-speech" || event.error === "aborted") { restart(); return; }
      active = false;
      options.onError(event.error);
    };
    try { recognition.start(); }
    catch {
      release(recognition); abort(recognition); active = false;
      options.onError("start-failed");
    }
  }
  begin();
  return () => {
    active = false; clearTimers();
    if (current) { const recognition = current; release(recognition); abort(recognition); }
  };
}
