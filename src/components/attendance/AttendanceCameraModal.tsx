import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import {
  cameraErrorMessage,
  captureFaceJpeg,
  startFaceCamera,
  stopMediaStream,
} from "../../lib/faceCamera";

interface AttendanceCameraModalProps {
  action: "in" | "out";
  onCapture: (image: Blob) => Promise<void>;
  onClose: () => void;
}

export default function AttendanceCameraModal({
  action,
  onCapture,
  onClose,
}: AttendanceCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [capture, setCapture] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopCamera();
    revokePreview();
  }, [stopCamera, revokePreview]);

  const handleStartCamera = async () => {
    setError("");
    try {
      const stream = await startFaceCamera(navigator.mediaDevices);
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setError(cameraErrorMessage(err));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial camera start intentionally sets state from an external API on mount
    handleStartCamera();
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setError("");
    try {
      const blob = await captureFaceJpeg(videoRef.current);
      revokePreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setCapture({ blob, url });
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chụp ảnh.");
    }
  };

  const handleRetake = async () => {
    revokePreview();
    setCapture(null);
    setError("");
    await handleStartCamera();
  };

  const handleConfirm = async () => {
    if (!capture || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await onCapture(capture.blob);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không thể Check-${action}. Vui lòng thử lại.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const actionLabel = action === "in" ? "Check-in" : "Check-out";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Camera className="h-4 w-4 text-indigo-650" />
              Chụp ảnh {actionLabel}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Xác thực khuôn mặt để hoàn tất chấm công.
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-900">
            {capture ? (
              <img src={capture.url} alt="Ảnh chấm công đã chụp" className="h-full w-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            )}
            {!capture && !cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs">
                <Camera className="h-8 w-8" />
                Đang khởi động camera...
              </div>
            )}
            {cameraOn && !capture && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/4 w-1/2 rounded-[50%] border-2 border-dashed border-white/70" />
              </div>
            )}
          </div>

          {cameraOn && !capture && (
            <p className="text-center text-xs text-gray-500">
              Đưa khuôn mặt vào giữa khung hình, nhìn thẳng vào camera.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {!cameraOn && !capture && (
              <button
                onClick={handleStartCamera}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
              >
                Bật camera
              </button>
            )}
            {cameraOn && !capture && (
              <button
                onClick={handleCapture}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
              >
                Chụp ảnh
              </button>
            )}
            {capture && (
              <>
                <button
                  onClick={handleRetake}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Chụp lại
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Đang gửi..." : "Xác nhận"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
