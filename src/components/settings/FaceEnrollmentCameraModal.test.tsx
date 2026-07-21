// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FaceEnrollmentCameraModal from "./FaceEnrollmentCameraModal";

const employee = { uid: "u1", displayName: "Nguyễn Văn A", email: "a@igen.vn" };

function makeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

describe("FaceEnrollmentCameraModal", () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as never;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(["jpeg"], { type: "image/jpeg" }));
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts the camera via getUserMedia", async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const user = userEvent.setup();
    render(<FaceEnrollmentCameraModal employee={employee} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: { ideal: "user" } } });
    expect(await screen.findByRole("button", { name: "Chụp ảnh" })).toBeTruthy();
  });

  it("shows an actionable error when the camera is blocked", async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error(), { name: "NotAllowedError" }));
    const user = userEvent.setup();
    render(<FaceEnrollmentCameraModal employee={employee} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    expect(await screen.findByText(/quyền camera/)).toBeTruthy();
  });

  it("capturing stops the tracks and shows retake/confirm", async () => {
    const { stream, track } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const user = userEvent.setup();
    render(<FaceEnrollmentCameraModal employee={employee} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    await user.click(await screen.findByRole("button", { name: "Chụp ảnh" }));
    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Chụp lại" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeTruthy();
  });

  it("retake revokes the preview and restarts the camera", async () => {
    const first = makeStream();
    const second = makeStream();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const user = userEvent.setup();
    render(<FaceEnrollmentCameraModal employee={employee} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    await user.click(await screen.findByRole("button", { name: "Chụp ảnh" }));
    await user.click(await screen.findByRole("button", { name: "Chụp lại" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("confirm submits a jpeg blob and closes", async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FaceEnrollmentCameraModal employee={employee} onSubmit={onSubmit} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    await user.click(await screen.findByRole("button", { name: "Chụp ảnh" }));
    await user.click(await screen.findByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "image/jpeg" })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open when submit rejects", async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const onSubmit = vi.fn().mockRejectedValue(new Error("server down"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FaceEnrollmentCameraModal employee={employee} onSubmit={onSubmit} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    await user.click(await screen.findByRole("button", { name: "Chụp ảnh" }));
    await user.click(await screen.findByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeTruthy();
  });

  it("close stops tracks; unmount revokes the preview URL", async () => {
    const { stream, track } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const onClose = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <FaceEnrollmentCameraModal employee={employee} onSubmit={vi.fn()} onClose={onClose} />,
    );
    await user.click(screen.getByRole("button", { name: "Bật camera" }));
    await user.click(await screen.findByRole("button", { name: "Chụp ảnh" }));
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
});
