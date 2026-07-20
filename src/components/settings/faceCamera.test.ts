import { describe, expect, it, vi } from "vitest";
import {
  cameraErrorMessage,
  captureFaceJpeg,
  startFaceCamera,
  stopMediaStream,
} from "./faceCamera";

describe("faceCamera", () => {
  it("requests the preferred front camera", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    await expect(startFaceCamera({ getUserMedia } as never)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: "user" } },
    });
  });

  it("stops every track", () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    stopMediaStream({ getTracks: () => tracks } as never);
    tracks.forEach(track => expect(track.stop).toHaveBeenCalledOnce());
  });

  it("captures an image/jpeg blob", async () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb: BlobCallback) => cb(blob),
    };
    await expect(
      captureFaceJpeg({ videoWidth: 640, videoHeight: 480 } as never, () => canvas as never),
    ).resolves.toBe(blob);
  });

  it("rejects when the video has no dimensions", async () => {
    await expect(
      captureFaceJpeg({ videoWidth: 0, videoHeight: 0 } as never, () => ({}) as never),
    ).rejects.toThrow();
  });

  it("rejects when the canvas has no 2d context", async () => {
    const canvas = { width: 0, height: 0, getContext: () => null, toBlob: vi.fn() };
    await expect(
      captureFaceJpeg({ videoWidth: 640, videoHeight: 480 } as never, () => canvas as never),
    ).rejects.toThrow();
  });

  it("rejects when the canvas produces a null blob", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb: BlobCallback) => cb(null),
    };
    await expect(
      captureFaceJpeg({ videoWidth: 640, videoHeight: 480 } as never, () => canvas as never),
    ).rejects.toThrow();
  });

  it.each([
    ["NotAllowedError", "quyền camera"],
    ["NotFoundError", "không tìm thấy camera"],
    ["NotReadableError", "đang được ứng dụng khác sử dụng"],
  ])("maps %s to actionable Vietnamese copy", (name, copy) => {
    expect(cameraErrorMessage(Object.assign(new Error(), { name }))).toContain(copy);
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(cameraErrorMessage(new Error("boom"))).toBeTruthy();
  });
});
