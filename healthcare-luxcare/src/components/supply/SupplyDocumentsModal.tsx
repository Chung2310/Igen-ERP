import React, { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileCheck,
} from "lucide-react";
import type { SupplyItem } from "../../types/supply";

interface Props {
  isOpen: boolean;
  supply: SupplyItem | null;
  initialIndex?: number;
  onClose: () => void;
}

export const SupplyDocumentsModal: React.FC<Props> = ({
  isOpen,
  supply,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const docs = supply?.documents || [];
  const currentDoc = docs[currentIndex] || null;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, docs.length - 1)));
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, initialIndex, docs.length]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && docs.length > 1) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : docs.length - 1));
      } else if (e.key === "ArrowRight" && docs.length > 1) {
        setCurrentIndex((prev) => (prev < docs.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, docs.length, onClose]);

  if (!isOpen || !supply) return null;

  const getFileExtension = (url?: string, name?: string) => {
    const target = url || name || "";
    const clean = target.split("?")[0];
    const parts = clean.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
  };

  const ext = currentDoc ? getFileExtension(currentDoc.fileUrl, currentDoc.name) : "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
  const isPdf = ext === "pdf";

  return (
    <div
      className={`fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center overscroll-contain animate-in fade-in duration-150 ${
        isFullscreen ? "p-0" : "p-2 sm:p-4 md:p-6"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-200 text-left transition-all duration-150 ${
          isFullscreen
            ? "w-screen h-screen rounded-none border-0"
            : "w-full max-w-6xl h-[92vh] rounded-2xl animate-in zoom-in-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Previewer */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              {isImage ? (
                <ImageIcon className="w-5 h-5" />
              ) : isPdf ? (
                <FileText className="w-5 h-5 text-rose-600" />
              ) : (
                <FileCheck className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {currentDoc?.name || "Tài liệu kỹ thuật"}
                </h3>
                {docs.length > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">
                    {currentIndex + 1} / {docs.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                Vật tư: <span className="font-semibold text-slate-700">{supply.name}</span>
                {currentDoc?.fileSize ? ` • ${Math.round(currentDoc.fileSize / 1024)} KB` : ""}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {currentDoc && (
              <>
                <a
                  href={currentDoc.fileUrl}
                  download={currentDoc.name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="Tải tệp về máy"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tải về</span>
                </a>

                <a
                  href={currentDoc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}

            <div className="h-5 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              title={isFullscreen ? "Thu nhỏ (Esc)" : "Toàn màn hình"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
              title="Đóng xem trước"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Document Tabs Switcher (nếu có nhiều hơn 1 tệp) */}
        {docs.length > 1 && (
          <div className="px-5 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
              {docs.map((doc, idx) => {
                const docExt = getFileExtension(doc.fileUrl, doc.name);
                const isItemActive = idx === currentIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      isItemActive
                        ? "bg-white text-blue-700 shadow-2xs border border-blue-200 ring-1 ring-blue-500/20"
                        : "text-slate-600 hover:bg-white/60 border border-transparent"
                    }`}
                  >
                    {["jpg", "jpeg", "png", "webp"].includes(docExt) ? (
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    ) : docExt === "pdf" ? (
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span className="max-w-[140px] truncate">{doc.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick arrows */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : docs.length - 1))}
                className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-500 transition cursor-pointer"
                title="Tài liệu trước (Phím ←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev < docs.length - 1 ? prev + 1 : 0))}
                className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-500 transition cursor-pointer"
                title="Tài liệu tiếp theo (Phím →)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Document Preview Stage */}
        <div className="flex-1 min-h-0 bg-slate-900/5 relative overflow-hidden flex flex-col">
          {docs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <FileCheck className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Không có tài liệu đính kèm nào</p>
            </div>
          ) : isImage ? (
            /* Image Preview with Interactive Controls */
            <div className="flex-1 flex flex-col h-full relative">
              {/* Floating Image Toolbar */}
              <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-xl shadow-md p-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                  title="Xoay 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                  title="Đặt lại kích thước"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                <img
                  src={currentDoc?.fileUrl}
                  alt={currentDoc?.name || "Tài liệu xem trước"}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: "transform 0.2s ease-in-out",
                  }}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md bg-white select-none"
                />
              </div>
            </div>
          ) : isPdf ? (
            /* PDF Embedded Preview - Full bleed with FitH for smooth scrolling */
            <div className="w-full h-full flex-1 relative overflow-hidden bg-slate-100 overscroll-contain">
              <iframe
                src={`${currentDoc?.fileUrl}#toolbar=1&navpanes=0&view=FitH`}
                className="w-full h-full border-0 bg-white block"
                title={currentDoc?.name || "Xem trước PDF"}
              />
            </div>
          ) : (
            /* Other File Formats */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 shadow-sm">
                <FileText className="w-10 h-10" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">{currentDoc?.name}</h4>
              <p className="text-xs text-slate-500 max-w-md mb-5">
                Định dạng tệp này (<span className="font-mono font-bold uppercase">{ext}</span>) không hỗ trợ xem trực tiếp trong trình duyệt. Bạn có thể tải tệp về để mở trên máy tính hoặc mở qua liên kết bên dưới.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={currentDoc?.fileUrl}
                  download={currentDoc?.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/10 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Tải tệp về máy
                </a>
                <a
                  href={currentDoc?.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở tab mới
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

