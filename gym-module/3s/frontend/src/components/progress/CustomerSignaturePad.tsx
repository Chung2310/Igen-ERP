import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleDot,
  Maximize2,
  Minimize2,
  PenLine,
  RotateCcw,
  Undo2,
  User,
} from 'lucide-react';

export interface CustomerSignaturePadHandle {
  isEmpty: () => boolean;
  toDataUrl: () => string | null;
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
}

interface NormalizedPoint {
  nx: number;
  ny: number;
}

interface Stroke {
  points: NormalizedPoint[];
  color: string;
  width: number;
}

interface Props {
  signerName: string;
  onSignerNameChange: (name: string) => void;
  onSignatureChange?: (hasSignature: boolean) => void;
  placeholderName?: string;
}

const INK_COLORS = [
  { id: 'blue', label: 'Xanh mực', hex: '#003b70', bgClass: 'bg-[#003b70]' },
  { id: 'black', label: 'Đen', hex: '#0f172a', bgClass: 'bg-[#0f172a]' },
  { id: 'red', label: 'Đỏ', hex: '#dc2626', bgClass: 'bg-[#dc2626]' },
] as const;

const STROKE_WIDTHS = [
  { id: 'thin', label: 'Mảnh', value: 2 },
  { id: 'medium', label: 'Vừa', value: 3.5 },
  { id: 'thick', label: 'Đậm', value: 5.5 },
] as const;

function drawStrokesToCanvas(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  currentStroke: Stroke | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const allStrokes = [...strokes];
  if (currentStroke) allStrokes.push(currentStroke);

  for (const stroke of allStrokes) {
    const { points, color, width: strokeW } = stroke;
    if (points.length === 0) continue;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const p0x = points[0].nx * width;
    const p0y = points[0].ny * height;

    if (points.length === 1) {
      ctx.arc(p0x, p0y, strokeW / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      continue;
    }

    ctx.moveTo(p0x, p0y);

    for (let i = 1; i < points.length - 1; i++) {
      const p1x = points[i].nx * width;
      const p1y = points[i].ny * height;
      const p2x = points[i + 1].nx * width;
      const p2y = points[i + 1].ny * height;
      const xc = (p1x + p2x) / 2;
      const yc = (p1y + p2y) / 2;
      ctx.quadraticCurveTo(p1x, p1y, xc, yc);
    }

    const last = points[points.length - 1];
    const secondLast = points[points.length - 2];
    ctx.quadraticCurveTo(
      secondLast.nx * width,
      secondLast.ny * height,
      last.nx * width,
      last.ny * height,
    );
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Attaches native Touch (with non-passive preventDefault) and Mouse events
 * directly to the canvas to guarantee drawing works on all touch devices (iOS/Android)
 */
function bindCanvasEvents(
  canvas: HTMLCanvasElement,
  onStart: (pt: NormalizedPoint) => void,
  onMove: (pt: NormalizedPoint) => void,
  onEnd: () => void,
) {
  let isInteracting = false;
  let activeTouchId: number | null = null;

  const getPt = (clientX: number, clientY: number): NormalizedPoint => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    return {
      nx: rect.width > 0 ? x / rect.width : 0,
      ny: rect.height > 0 ? y / rect.height : 0,
    };
  };

  // 1. TOUCH EVENTS (Mobile Phones & Tablets - iOS Safari, Chrome Android)
  const onTouchStart = (e: TouchEvent) => {
    if (activeTouchId !== null || e.changedTouches.length === 0) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    isInteracting = true;
    onStart(getPt(t.clientX, t.clientY));
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isInteracting || activeTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        onMove(getPt(t.clientX, t.clientY));
        break;
      }
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!isInteracting) return;
    let isCurrentTouch = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        isCurrentTouch = true;
        break;
      }
    }
    // End stroke if the active finger lifted, or all touches ended
    if (isCurrentTouch || e.touches.length === 0) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      isInteracting = false;
      activeTouchId = null;
      onEnd();
    }
  };

  // 2. MOUSE EVENTS (Computers & Laptops)
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isInteracting = true;
    onStart(getPt(e.clientX, e.clientY));
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isInteracting) return;
    e.preventDefault();
    onMove(getPt(e.clientX, e.clientY));
  };

  const onMouseUp = (e: MouseEvent) => {
    if (!isInteracting) return;
    isInteracting = false;
    onEnd();
  };

  // Native touch listeners with { passive: false } are mandatory for mobile touchscreens!
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // Native mouse listeners
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return () => {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);

    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

const CustomerSignaturePad = forwardRef<CustomerSignaturePadHandle, Props>(function CustomerSignaturePad(
  { signerName, onSignerNameChange, onSignatureChange, placeholderName = 'Họ và tên khách hàng' },
  ref,
) {
  // Inline canvas refs
  const inlineContainerRef = useRef<HTMLDivElement>(null);
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fullscreen canvas refs
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  // Shared strokes data (normalized coordinates 0..1)
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // State
  const [strokeCount, setStrokeCount] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>(INK_COLORS[0].hex);
  const [selectedWidth, setSelectedWidth] = useState<number>(STROKE_WIDTHS[1].value);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep refs in sync for event listeners
  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;

  const selectedWidthRef = useRef(selectedWidth);
  selectedWidthRef.current = selectedWidth;

  // Redraw both canvases if present
  const redraw = useCallback(() => {
    if (inlineCanvasRef.current) {
      drawStrokesToCanvas(inlineCanvasRef.current, strokesRef.current, currentStrokeRef.current);
    }
    if (fullscreenCanvasRef.current) {
      drawStrokesToCanvas(fullscreenCanvasRef.current, strokesRef.current, currentStrokeRef.current);
    }
  }, []);

  // Stroke event handlers
  const handleStrokeStart = useCallback(
    (pt: NormalizedPoint) => {
      currentStrokeRef.current = {
        points: [pt],
        color: selectedColorRef.current,
        width: selectedWidthRef.current,
      };
      redraw();
    },
    [redraw],
  );

  const handleStrokeMove = useCallback(
    (pt: NormalizedPoint) => {
      if (!currentStrokeRef.current) return;
      currentStrokeRef.current.points.push(pt);
      redraw();
    },
    [redraw],
  );

  const notifyChange = useCallback(() => {
    const count = strokesRef.current.length;
    setStrokeCount(count);
    onSignatureChange?.(count > 0);
  }, [onSignatureChange]);

  const handleStrokeEnd = useCallback(() => {
    if (!currentStrokeRef.current) return;
    strokesRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
    notifyChange();
    redraw();
  }, [notifyChange, redraw]);

  // Attach native touch & mouse events to inline canvas
  useEffect(() => {
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    return bindCanvasEvents(canvas, handleStrokeStart, handleStrokeMove, handleStrokeEnd);
  }, [handleStrokeStart, handleStrokeMove, handleStrokeEnd]);

  // Attach native touch & mouse events to fullscreen canvas when active
  useEffect(() => {
    if (!isFullscreen) return;
    const canvas = fullscreenCanvasRef.current;
    if (!canvas) return;
    return bindCanvasEvents(canvas, handleStrokeStart, handleStrokeMove, handleStrokeEnd);
  }, [isFullscreen, handleStrokeStart, handleStrokeMove, handleStrokeEnd]);

  // Resize inline canvas
  const resizeInlineCanvas = useCallback(() => {
    const canvas = inlineCanvasRef.current;
    const container = inlineContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 260);
    const height = 180;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (inlineCanvasRef.current) {
      drawStrokesToCanvas(inlineCanvasRef.current, strokesRef.current, currentStrokeRef.current);
    }
  }, []);

  // Resize fullscreen canvas to 100% full screen
  const resizeFullscreenCanvas = useCallback(() => {
    const canvas = fullscreenCanvasRef.current;
    const container = fullscreenContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const height = Math.max(rect.height, 200);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (fullscreenCanvasRef.current) {
      drawStrokesToCanvas(fullscreenCanvasRef.current, strokesRef.current, currentStrokeRef.current);
    }
  }, []);

  useEffect(() => {
    resizeInlineCanvas();
    const handleResize = () => {
      resizeInlineCanvas();
      if (isFullscreen) resizeFullscreenCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeInlineCanvas, resizeFullscreenCanvas, isFullscreen]);

  // Fullscreen open & close handlers with native browser fullscreen API support
  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) {
        void el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        void el.webkitRequestFullscreen();
      }
    } catch {}
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void>;
      };
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        void doc.webkitExitFullscreen();
      }
    } catch {}
  }, []);

  // Lock body scroll and handle ESC key during fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const resizeFs = () => {
      resizeFullscreenCanvas();
    };

    resizeFs();
    const rafId = requestAnimationFrame(resizeFs);
    const timer1 = setTimeout(resizeFs, 40);
    const timer2 = setTimeout(resizeFs, 150);

    let ro: ResizeObserver | null = null;
    if (fullscreenContainerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resizeFs());
      ro.observe(fullscreenContainerRef.current);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      ro?.disconnect();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
      setTimeout(() => resizeInlineCanvas(), 60);
    };
  }, [isFullscreen, resizeFullscreenCanvas, resizeInlineCanvas, closeFullscreen]);

  const clear = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    notifyChange();
    redraw();
  }, [notifyChange, redraw]);

  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    notifyChange();
    redraw();
  }, [notifyChange, redraw]);

  const isEmpty = useCallback(() => strokesRef.current.length === 0, []);

  const toDataUrl = useCallback((): string | null => {
    if (isEmpty()) return null;
    const exportCanvas = document.createElement('canvas');
    const width = 600;
    const height = 260;
    exportCanvas.width = width * 2;
    exportCanvas.height = height * 2;
    const ctx = exportCanvas.getContext('2d');
    if (ctx) {
      drawStrokesToCanvas(exportCanvas, strokesRef.current, null);
      return exportCanvas.toDataURL('image/png');
    }
    const canvas = inlineCanvasRef.current || fullscreenCanvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : null;
  }, [isEmpty]);

  const toBlob = useCallback(async (): Promise<Blob | null> => {
    if (isEmpty()) return null;
    const exportCanvas = document.createElement('canvas');
    const width = 600;
    const height = 260;
    exportCanvas.width = width * 2;
    exportCanvas.height = height * 2;
    drawStrokesToCanvas(exportCanvas, strokesRef.current, null);

    return new Promise<Blob | null>((resolve) => {
      exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }, [isEmpty]);

  useImperativeHandle(
    ref,
    () => ({
      isEmpty,
      toDataUrl,
      toBlob,
      clear,
    }),
    [isEmpty, toDataUrl, toBlob, clear],
  );

  const hasSigned = strokeCount > 0;

  // Reusable Paint Tools Palette
  const renderPaintTools = () => (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Colors */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
        {INK_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => setSelectedColor(c.hex)}
            className={`relative flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition-transform ${c.bgClass} ${
              selectedColor === c.hex
                ? 'scale-110 ring-2 ring-sky-500 ring-offset-1'
                : 'opacity-85 hover:opacity-100'
            }`}
          >
            {selectedColor === c.hex && <Check size={12} className="text-white drop-shadow-xs" />}
          </button>
        ))}
      </div>

      {/* Stroke Widths */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w.id}
            type="button"
            title={`Nét ${w.label}`}
            onClick={() => setSelectedWidth(w.value)}
            className={`px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg transition ${
              selectedWidth === w.value
                ? 'bg-[#003b70] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Undo */}
      <button
        type="button"
        disabled={!hasSigned}
        onClick={undo}
        className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        title="Hoàn tác nét vẽ"
      >
        <Undo2 size={13} />
        <span className="hidden xs:inline sm:inline">Hoàn tác</span>
      </button>

      {/* Clear */}
      <button
        type="button"
        disabled={!hasSigned}
        onClick={clear}
        className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/60 px-2.5 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        title="Xóa trắng bảng vẽ"
      >
        <RotateCcw size={13} />
        <span>Ký lại</span>
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition duration-200 hover:border-slate-300">
      {/* Header & Tools bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-[#003b70]">
            <PenLine size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Bảng vẽ chữ ký khách hàng
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  hasSigned
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {hasSigned ? (
                  <>
                    <CheckCircle2 size={11} /> Đã có chữ ký
                  </>
                ) : (
                  <>
                    <CircleDot size={11} /> Chờ khách ký
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Khách hàng dùng ngón tay, bút cảm ứng hoặc chuột để ký tên trực tiếp
            </p>
          </div>
        </div>

        {/* Inline Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {renderPaintTools()}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openFullscreen();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-2.5 text-xs font-bold text-[#003b70] shadow-2xs transition hover:bg-sky-100 active:scale-95 cursor-pointer"
            title="Mở toàn màn hình để ký rộng hơn trên điện thoại"
          >
            <Maximize2 size={13} />
            <span>Phóng to</span>
          </button>
        </div>
      </div>

      {/* Inline Canvas Drawing Area */}
      <div
        ref={inlineContainerRef}
        className="relative mt-3 w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white shadow-inner"
        style={{
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        <canvas
          ref={inlineCanvasRef}
          className="block w-full cursor-crosshair select-none"
          style={{
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        />

        {/* Quick Fullscreen Button Overlay on Canvas */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openFullscreen();
          }}
          className="absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-xs font-bold text-[#003b70] shadow-xs backdrop-blur-xs transition hover:bg-sky-50 active:scale-95 cursor-pointer"
          title="Phóng to toàn màn hình để ký dễ hơn trên điện thoại"
        >
          <Maximize2 size={13} className="text-sky-600" />
          <span>Ký toàn màn hình</span>
        </button>

        {/* Decorative baseline guide */}
        <div className="pointer-events-none absolute bottom-5 left-8 right-8 flex items-center gap-2 opacity-35">
          <span className="text-xs font-bold text-slate-400">✕</span>
          <div className="h-[1px] flex-1 border-b border-dashed border-slate-400" />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            Dòng ký tên
          </span>
        </div>

        {/* Watermark placeholder if no strokes */}
        {!hasSigned && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-slate-300 select-none">
            <PenLine size={32} className="opacity-40 mb-1 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400">
              Chạm ngón tay hoặc rê chuột vào đây để ký tên
            </span>
          </div>
        )}
      </div>

      {/* Signer Name Input */}
      <div className="mt-3 flex items-center gap-2">
        <label
          htmlFor="signer-name-input"
          className="flex shrink-0 items-center gap-1 text-xs font-bold text-slate-600"
        >
          <User size={13} />
          <span>Họ tên người ký:</span>
        </label>
        <input
          id="signer-name-input"
          type="text"
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder={placeholderName}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
      </div>

      {/* TRUE 100% EDGE-TO-EDGE FULLSCREEN SIGNATURE APP (No margins, no popup borders) */}
      {isFullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100001] w-full h-full h-[100dvh] flex flex-col bg-white overflow-hidden select-none m-0 p-0 rounded-none border-none animate-in fade-in duration-100"
            role="dialog"
            aria-modal="true"
            aria-label="Ký tên toàn màn hình"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-2.5 border-b border-slate-200 bg-slate-50/95 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 shadow-2xs"
                  title="Quay lại form ghi nhận"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-[#003b70] truncate m-0">
                      Ký tên xác nhận buổi tập
                    </h4>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        hasSigned
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {hasSigned ? 'Đã có chữ ký' : 'Chờ khách ký'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#003b70] px-4 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-[#002f5a] active:scale-95 cursor-pointer"
                >
                  <Check size={16} />
                  <span>Xong & Áp dụng</span>
                </button>
              </div>
            </div>

            {/* Edge-to-Edge Fullscreen Canvas */}
            <div
              ref={fullscreenContainerRef}
              className="relative flex-1 w-full h-full min-h-0 bg-white overflow-hidden cursor-crosshair select-none"
              style={{
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              <canvas
                ref={fullscreenCanvasRef}
                className="block w-full h-full cursor-crosshair select-none"
                style={{
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                }}
              />

              {/* Baseline Guide */}
              <div className="pointer-events-none absolute bottom-10 left-6 right-6 sm:left-12 sm:right-12 flex items-center gap-2 opacity-35">
                <span className="text-sm font-bold text-slate-400">✕</span>
                <div className="h-[1px] flex-1 border-b-2 border-dashed border-slate-300" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Dòng ký tên
                </span>
              </div>

              {/* Watermark Placeholder */}
              {!hasSigned && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-slate-300 select-none">
                  <PenLine size={52} className="opacity-30 mb-2 animate-pulse" />
                  <span className="text-sm sm:text-base font-semibold text-slate-400">
                    Chạm ngón tay hoặc bút cảm ứng vào đây để ký tên
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    (Có thể xoay ngang màn hình điện thoại để ký rộng hơn)
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-t border-slate-200 bg-slate-50/95 shrink-0">
              {/* Signer Name Input */}
              <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-sm">
                <label
                  htmlFor="fs-signer-input"
                  className="flex shrink-0 items-center gap-1 text-xs font-bold text-slate-700"
                >
                  <User size={13} />
                  <span>Người ký:</span>
                </label>
                <input
                  id="fs-signer-input"
                  type="text"
                  value={signerName}
                  onChange={(e) => onSignerNameChange(e.target.value)}
                  placeholder={placeholderName}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>

              {/* Tools */}
              <div className="flex items-center gap-2">
                {renderPaintTools()}
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 cursor-pointer"
                  title="Thu nhỏ lại"
                >
                  <Minimize2 size={13} />
                  <span className="hidden sm:inline">Thu nhỏ</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

export default CustomerSignaturePad;
