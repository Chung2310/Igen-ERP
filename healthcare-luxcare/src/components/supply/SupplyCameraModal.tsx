import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Check, RotateCcw, AlertTriangle, Video } from "lucide-react";

interface SupplyCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => Promise<void>;
  title?: string;
}

export const SupplyCameraModal: React.FC<SupplyCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = "Chụp ảnh sản phẩm vật tư",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const revokePreview = useCallback(() => {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
    }
    setCapturedBlob(null);
  }, [capturedUrl]);

  const startCamera = useCallback(
    async (mode: "environment" | "user", deviceId?: string) => {
      stopCamera();
      setErrorMessage(null);

      if (!navigator?.mediaDevices?.getUserMedia) {
        setErrorMessage("Trình duyệt không hỗ trợ kết nối camera trực tiếp.");
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setCameraActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Liệt kê các camera có sẵn
        const allDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage("Ứng dụng bị từ chối quyền truy cập máy ảnh. Vui lòng cho phép quyền Camera trên trình duyệt.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMessage("Không tìm thấy thiết bị camera / webcam nào trên máy tính.");
        } else {
          setErrorMessage(err.message || "Không thể khởi động camera.");
        }
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    if (isOpen) {
      void startCamera(facingMode, selectedDeviceId);
    } else {
      stopCamera();
      revokePreview();
    }
    return () => {
      stopCamera();
      revokePreview();
    };
  }, [isOpen]);

  const handleToggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    setSelectedDeviceId("");
    void startCamera(nextMode);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    void startCamera(facingMode, deviceId);
  };

  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        revokePreview();
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  };

  const handleRetake = () => {
    revokePreview();
    void startCamera(facingMode, selectedDeviceId);
  };

  const handleConfirm = async () => {
    if (!capturedBlob) return;
    setSubmitting(true);
    try {
      const file = new File([capturedBlob], `supply_snap_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      await onCapture(file);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể lưu ảnh đã chụp.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              <p className="text-[11px] text-slate-500">Chụp ảnh bao bì, tem nhãn hoặc mặt hàng thực tế</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Video / Preview Area */}
        <div className="p-5 space-y-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
            {capturedUrl ? (
              <img src={capturedUrl} alt="Ảnh đã chụp" className="h-full w-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            )}

            {/* Khung hướng dẫn căn chỉnh khi camera đang bật */}
            {cameraActive && !capturedUrl && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full h-full border-2 border-dashed border-white/60 rounded-xl flex items-center justify-center">
                  <span className="text-[11px] font-medium text-white/80 bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs">
                    Căn vật tư vào giữa khung hình
                  </span>
                </div>
              </div>
            )}

            {/* Thông báo chưa bật camera hoặc lỗi */}
            {!cameraActive && !capturedUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-slate-400 p-6 text-center">
                {errorMessage ? (
                  <>
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-amber-200 font-medium max-w-xs">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode, selectedDeviceId)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Thử lại
                    </button>
                  </>
                ) : (
                  <>
                    <Video className="w-8 h-8 text-slate-500 animate-pulse" />
                    <p className="text-xs text-slate-400">Đang khởi động camera...</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Công cụ chuyển đổi camera nếu có nhiều camera */}
          {cameraActive && !capturedUrl && devices.length > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">Nguồn camera:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  Đổi camera ({facingMode === "environment" ? "Sau" : "Trước"})
                </button>
                {devices.length > 2 && (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    aria-label="Chọn thiết bị camera"
                    className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 cursor-pointer"
                  >
                    {devices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Hủy bỏ
            </button>

            <div className="flex items-center gap-2">
              {capturedUrl ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    Chụp lại
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {submitting ? "Đang xử lý..." : "Sử dụng ảnh này"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={!cameraActive}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  Chụp ảnh
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
