import React from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { getApiErrorMessage } from "../../utils/errorMessage";
function feedback() { try { navigator.vibrate?.(80); const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 880; gain.gain.value = 0.05; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.08); } catch { /* optional */ } }
export default function InventoryBarcodeScannerDialog({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const lastScan = React.useRef({ value: "", at: 0 });
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let stream: MediaStream | null = null; let timer = 0; let stopped = false; let controls: { stop: () => void } | undefined;
    const accept = (value: string) => { const now = Date.now(); if (!value || (lastScan.current.value === value && now - lastScan.current.at <= 1200)) return; lastScan.current = { value, at: now }; feedback(); stopped = true; controls?.stop(); onScan(value); onClose(); };
    const start = async () => {
      try {
        const Detector = (window as any).BarcodeDetector;
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (!videoRef.current) return; videoRef.current.srcObject = stream; await videoRef.current.play();
          const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code"] });
          const scan = async () => { if (stopped || !videoRef.current) return; try { const value = String((await detector.detect(videoRef.current))[0]?.rawValue || "").trim(); accept(value); } catch { /* frame not ready */ } if (!stopped) timer = window.setTimeout(scan, 180); };
          void scan();
        } else {
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => { if (result) accept(result.getText().trim()); });
        }
      } catch (cause) { setError(getApiErrorMessage(cause, "Không mở được camera. Hãy cấp quyền camera hoặc dùng đầu đọc.")); }
    };
    void start();
    return () => { stopped = true; window.clearTimeout(timer); controls?.stop(); stream?.getTracks().forEach((track) => track.stop()); };
  }, [onClose, onScan]);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"><div role="dialog" aria-label="Quét mã kiểm kê" className="w-full max-w-lg rounded-3xl bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Camera className="h-5 w-5" />Quét mã kiểm kê</h2><button aria-label="Đóng camera" onClick={onClose}><X /></button></div><video ref={videoRef} className="aspect-video w-full rounded-2xl bg-black object-cover" muted playsInline />{error && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}<p className="mt-3 text-center text-sm text-slate-500">Đưa mã vào giữa khung hình.</p></div></div>;
}
