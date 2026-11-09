import { existsSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMediaBinary } from "./media-binary.service";

vi.mock("fs", () => ({ existsSync: vi.fn() }));

describe("optional media binaries", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.stubEnv("FFMPEG_PATH", "");
    vi.stubEnv("FFPROBE_PATH", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads without a bundled FFmpeg and leaves availability to the caller", () => {
    expect(resolveMediaBinary("ffmpeg")).toBe("ffmpeg");
    expect(resolveMediaBinary("ffprobe")).toBe("ffprobe");
  });

  it("prefers an explicitly configured existing executable", () => {
    vi.stubEnv("FFMPEG_PATH", "/environment/ffmpeg");
    vi.mocked(existsSync).mockReturnValue(true);
    expect(resolveMediaBinary("ffmpeg", "/custom/ffmpeg")).toBe("/custom/ffmpeg");
  });

  it("falls back to PATH when a configured file is absent", () => {
    vi.stubEnv("FFMPEG_PATH", "/missing/ffmpeg");
    vi.mocked(existsSync).mockReturnValue(false);
    expect(resolveMediaBinary("ffmpeg")).toBe("ffmpeg");
  });

  it("keeps FFmpeg and ffprobe command overrides independent", () => {
    vi.stubEnv("FFMPEG_PATH", "custom-ffmpeg");
    vi.stubEnv("FFPROBE_PATH", "custom-ffprobe");
    expect(resolveMediaBinary("ffmpeg")).toBe("custom-ffmpeg");
    expect(resolveMediaBinary("ffprobe")).toBe("custom-ffprobe");
  });
});
