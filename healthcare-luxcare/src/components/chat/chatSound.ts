// Âm báo tin nhắn mới cho module Trò chuyện (Web Audio API, không cần file asset)

export const CHAT_SOUND_MUTED_KEY = "igen_chat_sound_muted";

let sharedAudioCtx: AudioContext | null = null;

export function playChatNotificationSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    const ctx = sharedAudioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.14, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };
    // "Ting-ting" hai nốt nhẹ nhàng
    tone(880, 0, 0.15);
    tone(1174.66, 0.11, 0.22);
  } catch {
    /* bỏ qua nếu trình duyệt chặn */
  }
}
