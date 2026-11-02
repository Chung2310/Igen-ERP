import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eraser, Loader2, Minus, Plus, X, ZoomIn } from "lucide-react";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 300;

type ContractSignaturePadProps = {
  value?: string;
  onSave: (file: File) => Promise<boolean>;
  saving?: boolean;
};

export function ContractSignaturePad({ value, onSave, saving = false }: ContractSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [portalHost] = useState(() => document.createElement("div"));

  // Move the same canvas so changing view never clears its bitmap.
  useLayoutEffect(() => {
    const parent = expanded ? document.body : anchorRef.current;
    parent?.appendChild(portalHost);
    return () => { portalHost.remove(); };
  }, [expanded, portalHost]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy && !saving) setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded, busy, saving]);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 4;
    context.strokeStyle = "#0f172a";
    drawingRef.current = false;
    setHasInk(false);
  };

  useEffect(() => {
    if (!expanded) return;
    resetCanvas();
    setError("");
    setLoading(false);
    if (!value) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    setLoading(true);
    image.onload = () => {
      if (cancelled) return;
      canvasRef.current?.getContext("2d")?.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      setHasInk(true);
      setLoading(false);
    };
    image.onerror = () => {
      if (cancelled) return;
      setLoading(false);
      setError("Không tải được chữ ký cũ. Bạn có thể ký lại hoặc đóng để giữ chữ ký hiện tại.");
    };
    image.src = value;
    return () => { cancelled = true; };
  }, [expanded, value]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context || saving || busy || loading || !expanded) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    drawingRef.current = true;
    setHasInk(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || saving || busy || loading || !expanded) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.getContext("2d")?.closePath();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk || saving || busy || loading) return;
    setBusy(true);
    setError("");
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Empty signature");
      const saved = await onSave(new File([blob], `chu-ky-${Date.now()}.png`, { type: "image/png" }));
      if (saved) setExpanded(false);
      else setError("Chưa lưu được chữ ký. Vui lòng thử lại.");
    } catch {
      setError("Chưa lưu được chữ ký. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={anchorRef}>
    {createPortal(<div
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? "Ký toàn màn hình" : undefined}
      className={expanded
        ? "fixed inset-0 z-50 flex flex-col overflow-auto bg-surface p-4 sm:p-6"
        : "rounded-xl border border-outline-variant bg-surface/70 p-3"}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Chữ ký điện tử
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
            {expanded ? "Ký bằng chuột hoặc ngón tay trong vùng trắng." : "Bấm vào ô bên dưới để ký."}
          </p>
        </div>
        {expanded && <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Đóng màn hình ký"
          title="Đóng"
          disabled={saving || busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-surface-container-lowest px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 hover:bg-cyan-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetCanvas}
          disabled={saving || busy || loading}
          aria-label="Xóa chữ ký"
          title="Xóa chữ ký"
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-[11px] font-bold text-on-surface-variant transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
        </div>}
      </div>
      {expanded && error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {expanded && loading && <p role="status">Đang tải chữ ký...</p>}
      {!expanded && <button type="button" aria-label="Mở ô chữ ký" disabled={saving}
        onClick={() => setExpanded(true)}
        className="block aspect-[3/1] w-full overflow-hidden rounded-lg border border-slate-300 bg-surface-container-lowest">
        {value && <img src={value} alt="Chữ ký điện tử" className="h-full w-full object-contain" />}
      </button>}
      <div className={expanded ? "flex min-h-0 flex-1 items-center justify-center" : "hidden"}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Vùng ký điện tử"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
        className="block aspect-[3/1] w-full touch-none cursor-crosshair rounded-lg border border-slate-300 bg-surface-container-lowest shadow-inner"
        style={expanded ? { maxWidth: "min(100%, calc((100dvh - 180px) * 3))" } : undefined}
      />
      </div>
      {expanded && <button
        type="button"
        onClick={saveSignature}
        disabled={!hasInk || saving || busy || loading}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving || busy ? "Đang lưu chữ ký..." : "Lưu chữ ký"}
      </button>}
    </div>, portalHost)}
    </div>
  );
}

type SignatureZoomModalProps = {
  url: string | null;
  onClose: () => void;
};

export function SignatureZoomModal({ url, onClose }: SignatureZoomModalProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!url) return;
    setZoom(1);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem toàn màn hình chữ ký điện tử"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-on-primary">
        <div className="flex items-center gap-2">
          <ZoomIn className="h-4 w-4" />
          <span className="text-sm font-bold">Chữ ký điện tử</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Thu nhỏ chữ ký"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
            className="rounded-lg bg-surface-container-lowest/10 p-2 hover:bg-surface-container-lowest/20"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-w-14 rounded-lg bg-surface-container-lowest/10 px-2 py-2 text-xs font-bold hover:bg-surface-container-lowest/20"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Phóng to chữ ký"
            onClick={() => setZoom((value) => Math.min(4, value + 0.25))}
            className="rounded-lg bg-surface-container-lowest/10 p-2 hover:bg-surface-container-lowest/20"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Đóng xem chữ ký"
            onClick={onClose}
            className="ml-2 rounded-lg bg-surface-container-lowest/10 p-2 hover:bg-surface-container-lowest/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        <img
          src={url}
          alt="Chữ ký điện tử"
          className="max-h-[75vh] max-w-[85vw] rounded-xl bg-surface-container-lowest object-contain p-4 shadow-2xl transition-transform"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}
