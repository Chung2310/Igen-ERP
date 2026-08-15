import React from 'react';
import { Camera, RefreshCw, ScanFace, X } from 'lucide-react';
import {
  cameraErrorMessage,
  captureFaceJpeg,
  startFaceCamera,
  stopMediaStream,
} from '../../../../../components/settings/faceCamera';
import { getApiErrorMessage } from '../../../../../utils/errorMessage';

interface FaceCaptureInputProps {
  onCapture: (blob: Blob | null) => void;
  disabled?: boolean;
  entityName?: string;
}

export function FaceCaptureInput({ onCapture, disabled, entityName = 'học viên' }: FaceCaptureInputProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  const [cameraOn, setCameraOn] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');

  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  const revokePreview = React.useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  React.useEffect(() => () => {
    stopCamera();
    revokePreview();
  }, [stopCamera, revokePreview]);

  const handleStartCamera = async () => {
    setError('');
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

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setError('');
    try {
      const blob = await captureFaceJpeg(videoRef.current);
      revokePreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreview(url);
      stopCamera();
      onCapture(blob);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể chụp ảnh.'));
    }
  };

  const handleRetake = async () => {
    revokePreview();
    setPreview(null);
    onCapture(null);
    await handleStartCamera();
  };

  const handleClear = () => {
    revokePreview();
    setPreview(null);
    onCapture(null);
    stopCamera();
    setError('');
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <ScanFace className="w-3.5 h-3.5" />
        Mẫu khuôn mặt xác thực điểm danh (tùy chọn)
      </label>

      <div className="relative aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl bg-slate-900">
        {preview ? (
          <img src={preview} alt="Ảnh khuôn mặt đã chụp" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        )}
        {!preview && !cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Camera className="h-7 w-7" />
            Camera chưa được bật
          </div>
        )}
        {cameraOn && !preview && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/4 w-1/2 rounded-[50%] border-2 border-dashed border-white/70" />
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-600 max-w-xs">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!cameraOn && !preview && (
          <button
            type="button"
            onClick={handleStartCamera}
            disabled={disabled}
            className="rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-cyan-700 cursor-pointer disabled:opacity-50"
          >
            Bật camera
          </button>
        )}
        {cameraOn && !preview && (
          <>
            <button
              type="button"
              onClick={handleCapture}
              disabled={disabled}
              className="rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-cyan-700 cursor-pointer disabled:opacity-50"
            >
              Chụp ảnh
            </button>
            <button
              type="button"
              onClick={stopCamera}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Hủy
            </button>
          </>
        )}
        {preview && (
          <>
            <button
              type="button"
              onClick={handleRetake}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Chụp lại
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Bỏ ảnh
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-slate-400 max-w-xs">
        Có thể bỏ qua và thiết lập sau trong hồ sơ chi tiết {entityName}.
      </p>
    </div>
  );
}
