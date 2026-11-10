import { describe, expect, it } from "vitest";
import { normalizeStudioAudio } from "./studio-transcription";

function silentWav() {
  const samples = 16_000;
  const audio = Buffer.alloc(44 + samples * 2);
  audio.write("RIFF", 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16_000, 24); audio.writeUInt32LE(32_000, 28);
  audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write("data", 36);
  audio.writeUInt32LE(samples * 2, 40);
  return audio;
}

describe("studio audio normalization", () => {
  it("transcodes uploaded WAV data into a compact MP3 for OpenRouter", async () => {
    const mp3 = await normalizeStudioAudio(silentWav());
    expect(mp3.length).toBeGreaterThan(100);
    expect(mp3.length).toBeLessThan(silentWav().length);
    expect(mp3.subarray(0, 3).toString()).toBe("ID3");
  });

  it("rejects a file without audio data", async () => {
    await expect(normalizeStudioAudio(Buffer.from("not audio"))).rejects.toThrow("Tệp không chứa âm thanh hợp lệ");
  });
});
