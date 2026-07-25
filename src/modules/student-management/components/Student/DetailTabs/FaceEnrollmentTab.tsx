/* eslint-disable react-hooks/set-state-in-effect */
import React from 'react';
import { Camera, CheckCircle2, RefreshCw, ScanFace, Trash2, X } from 'lucide-react';
import { Student } from '../../../types';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';
import {
  cameraErrorMessage,
  captureFaceJpeg,
  startFaceCamera,
  stopMediaStream,
} from '../../../../../components/settings/faceCamera';

interface FaceEnrollmentTabProps {
  student: Student;
  onUpdated?: () => void;
}

interface FaceStatus {
  registered: boolean;
  registeredAt: string | null;
}

export function FaceEnrollmentTab({ student, onUpdated }: FaceEnrollmentTabProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  const [status, setStatus] = React.useState<FaceStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [cameraOn, setCameraOn] = React.useState(false);
  const [capture, setCapture] = React.useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await apiFetch(`/students/${student.id}/face`);
      setStatus({ registered: !!res.registered, registeredAt: res.registeredAt ?? null });
    } catch (err) {
      console.error('Lỗi tải trạng thái khuôn mặt:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, [student.id]);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
      setCapture({ blob, url });
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể chụp ảnh.');
    }
  };

  const handleRetake = async () => {
    revokePreview();
    setCapture(null);
    await handleStartCamera();
  };

  const handleCancelCapture = () => {
    revokePreview();
    setCapture(null);
    stopCamera();
    setError('');
  };

  const handleConfirm = async () => {
    if (!capture || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('file', new File([capture.blob], 'face.jpg', { type: capture.blob.type || 'image/jpeg' }));
      await apiFetch(`/students/${student.id}/face`, { method: 'POST', body });
      toast.success('Đã lưu mẫu khuôn mặt cho học viên!');
      revokePreview();
      setCapture(null);
      await fetchStatus();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu khuôn mặt. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (removing) return;
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa mẫu khuôn mặt của ${student.fullName}?`);
    if (!confirmDelete) return;
    setRemoving(true);
    setError('');
    try {
      await apiFetch(`/students/${student.id}/face`, { method: 'DELETE' });
      toast.success('Đã xóa mẫu khuôn mặt.');
      await fetchStatus();
      onUpdated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể xóa mẫu khuôn mặt.';
      setError(message);
      toast.error(message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm shadow-slate-200/50 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Mẫu khuôn mặt điểm danh</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dùng để xác thực khuôn mặt khi học viên điểm danh qua QR hoặc mã online.
            </p>
          </div>
        </div>

        {!loadingStatus && status?.registered && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã đăng ký
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-6">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-900">
          {capture ? (
            <img src={capture.url} alt="Ảnh khuôn mặt đã chụp" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}
          {!capture && !cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Camera className="h-8 w-8" />
              Camera chưa được bật
            </div>
          )}
          {cameraOn && !capture && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-3/4 w-1/2 rounded-[50%] border-2 border-dashed border-white/70" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div className="space-y-2 text-xs text-slate-500">
            <p>1. Bật camera và đưa khuôn mặt học viên vào giữa khung hình, ánh sáng đủ rõ.</p>
            <p>2. Nhìn thẳng vào camera rồi bấm chụp ảnh.</p>
            <p>3. Kiểm tra lại ảnh, sau đó xác nhận để lưu mẫu khuôn mặt.</p>
            {status?.registeredAt && (
              <p className="text-slate-400">
                Đăng ký lần cuối: {new Date(status.registeredAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!cameraOn && !capture && (
              <button
                type="button"
                onClick={handleStartCamera}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
              >
                Bật camera
              </button>
            )}
            {cameraOn && !capture && (
              <>
                <button
                  type="button"
                  onClick={handleCapture}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Chụp ảnh
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Hủy
                </button>
              </>
            )}
            {capture && (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Chụp lại
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Xác nhận lưu mẫu'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCapture}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Hủy
                </button>
              </>
            )}
            {status?.registered && !cameraOn && !capture && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {removing ? 'Đang xóa...' : 'Xóa mẫu khuôn mặt'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
