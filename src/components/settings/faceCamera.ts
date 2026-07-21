export function startFaceCamera(mediaDevices: MediaDevices): Promise<MediaStream> {
  return mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "user" } },
  });
}

export function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

export function captureFaceJpeg(
  video: HTMLVideoElement,
  createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) {
    return Promise.reject(new Error("Camera chưa sẵn sàng, vui lòng thử lại."));
  }
  const canvas = createCanvas();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("Trình duyệt không hỗ trợ chụp ảnh từ camera."));
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("Không thể tạo ảnh từ camera."))),
      "image/jpeg",
      0.92,
    );
  });
}

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Bạn chưa cấp quyền camera cho trình duyệt. Vui lòng cho phép truy cập camera rồi thử lại.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Hệ thống không tìm thấy camera trên thiết bị này.";
    case "NotReadableError":
    case "AbortError":
      return "Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.";
    default:
      return "Không thể khởi động camera. Vui lòng thử lại.";
  }
}
