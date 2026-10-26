import React from "react";
import { Camera, X } from "lucide-react";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
export default function BarcodeScannerDialog({ onScan, onClose, title = "Quét mã sản phẩm" }: { onScan: (value: string) => void; onClose: () => void; title?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null); const [error, setError] = React.useState("");
  React.useEffect(() => { let stream: MediaStream | null = null; let timer = 0; let stopped = false; const start = async () => { const Detector = (window as any).BarcodeDetector; if (!Detector) { setError("Trình duyệt chưa hỗ trợ quét mã bằng camera. Vui lòng nhập hoặc dùng máy quét."); return; } try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); if (!videoRef.current) return; videoRef.current.srcObject = stream; await videoRef.current.play(); const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] }); const scan = async () => { if (stopped || !videoRef.current) return; try { const codes = await detector.detect(videoRef.current); const value = String(codes[0]?.rawValue || "").trim(); if (value) { stopped = true; onScan(value); onClose(); return; } } catch { /* camera frame not ready */ } timer = window.setTimeout(scan, 180); }; void scan(); } catch (cause) { setError(getApiErrorMessage(cause, "Không mở được camera.")); } }; void start(); return () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); }; }, [onClose, onScan]);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
    <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2.5 font-bold text-slate-900"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><Camera className="h-4 w-4" /></span>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng quét mã" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5"><video ref={videoRef} className="aspect-video w-full rounded-2xl bg-black object-cover" muted playsInline />{error && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}<p className="mt-3 text-center text-sm text-slate-500">Đưa mã vào giữa khung hình.</p></div>
    </div>
  </div>;
}
