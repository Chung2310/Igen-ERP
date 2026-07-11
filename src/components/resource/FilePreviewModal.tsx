import React, { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2, X, FileQuestion, Share2 } from "lucide-react";
import type { ResourceItem } from "../../types";
import { toast } from "../../pages/Toast";
import { getFileIcon, getPreviewKind, formatBytes } from "./resourceHelpers";

interface FilePreviewModalProps {
  item: ResourceItem | null;
  onClose: () => void;
  hideDownload?: boolean;
  hideShare?: boolean;
}

/** Cửa sổ xem trước tài liệu: ảnh, video, audio, PDF, tài liệu Office, văn bản. */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  item,
  onClose,
  hideDownload = false,
  hideShare = false,
}) => {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item || !item.fileUrl) return null;

  const url = item.fileUrl;
  const kind = getPreviewKind(item.mimeType, item.name);
  const downloadHref = `/api/v1/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(item.name)}`;
  const officeViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  const { Icon, color } = getFileIcon(item.mimeType, item.name);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (downloading) return;
    try {
      setDownloading(true);
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(downloadHref, { headers });
      if (!res.ok) {
        throw new Error(`Không thể tải xuống tệp. Mã phản hồi: ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("[Download Error]:", err);
      toast.error(err.message || "Tải xuống thất bại.");
    } finally {
      setDownloading(false);
    }
  };

  // Helper to convert standard Google view/edit links to embeddable /preview links
  const getEmbeddableGoogleUrl = (rawUrl: string): string => {
    try {
      if (rawUrl.includes("drive.google.com/file/d/")) {
        return rawUrl.replace(/\/view(\?.*)?$/, "/preview");
      }
      if (rawUrl.includes("docs.google.com/document/d/")) {
        return rawUrl.replace(/\/edit(\?.*)?$/, "/preview");
      }
      if (rawUrl.includes("docs.google.com/spreadsheets/d/")) {
        return rawUrl.replace(/\/edit(\?.*)?$/, "/preview");
      }
      if (rawUrl.includes("docs.google.com/presentation/d/")) {
        return rawUrl.replace(/\/edit(\?.*)?$/, "/preview");
      }
    } catch (e) {
      console.error("Error formatting Google embed URL", e);
    }
    return rawUrl;
  };

  const isGoogleDoc = item.mimeType?.startsWith("application/vnd.google-apps") || url.includes("drive.google.com") || url.includes("docs.google.com");
  const embedUrl = isGoogleDoc ? getEmbeddableGoogleUrl(url) : url;

  const handleShare = async () => {
    try {
      const itemId = item._id || (item as any).id;
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${itemId}`;

      if (navigator.share) {
        await navigator.share({ title: item.name, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Đã sao chép liên kết tài liệu vào clipboard.");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast.error("Không sao chép được liên kết. Vui lòng thử lại.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Icon className={`w-6 h-6 shrink-0 ${color}`} strokeWidth={1.6} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800" title={item.name}>
              {item.name}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {(item.mimeType || "Tệp").replace(/^application\//, "")} · {formatBytes(item.size)}
            </p>
          </div>
          {!hideShare && (
            <button
              onClick={handleShare}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
              title="Chia sẻ (sao chép liên kết)"
            >
              <Share2 className="w-4.5 h-4.5" />
            </button>
          )}
          {!hideDownload && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition disabled:opacity-50"
              title="Tải xuống"
            >
              {downloading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Download className="w-4.5 h-4.5" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung preview */}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {isGoogleDoc ? (
            <iframe
              src={embedUrl}
              title={item.name}
              className="h-[80vh] w-full border-0 bg-white"
              allow="autoplay; encrypted-media; clipboard-write; clipboard-read"
            />
          ) : kind === "image" && (
            <div className="flex min-h-[50vh] items-center justify-center p-4">
              <img src={url} alt={item.name} className="max-h-[78vh] max-w-full rounded-xl object-contain shadow-sm" />
            </div>
          )}

          {kind === "video" && (
            <div className="flex min-h-[50vh] items-center justify-center bg-black p-2">
              <video src={url} controls autoPlay className="max-h-[80vh] max-w-full rounded-lg">
                Trình duyệt không hỗ trợ phát video này.
              </video>
            </div>
          )}

          {kind === "audio" && (
            <div className="flex min-h-[30vh] flex-col items-center justify-center gap-6 p-8">
              <div className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-sm ${color}`}>
                <Icon className="w-12 h-12" strokeWidth={1.4} />
              </div>
              <audio src={url} controls autoPlay className="w-full max-w-md">
                Trình duyệt không hỗ trợ phát audio này.
              </audio>
            </div>
          )}

          {(kind === "pdf" || kind === "text") && (
            <iframe src={url} title={item.name} className="h-[80vh] w-full border-0 bg-white" />
          )}

          {kind === "link" && (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-8 text-center max-w-xl mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-600 shadow-sm border border-cyan-100/50">
                <Icon className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-lg">Không thể hiển thị liên kết trực tiếp</p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Vì lý do bảo mật, hầu hết các trang web bên ngoài đều chặn việc nhúng trang của họ vào khung phụ (iframe) của trang khác (chính sách bảo mật chống Clickjacking).
                </p>
                <div className="p-3 bg-slate-100 rounded-2xl break-all text-xs font-mono text-slate-600 select-all border border-slate-200/50">
                  {url}
                </div>
              </div>
              <div className="flex gap-3">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 hover:shadow-lg transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở trong tab mới
                </a>
                {!hideShare && (
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    Sao chép liên kết
                  </button>
                )}
              </div>
            </div>
          )}

          {kind === "office" && (
            url.includes("drive.google.com") || url.includes("docs.google.com") ? (
              <div className="relative h-[80vh] w-full">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <iframe
                  src={officeViewer}
                  title={item.name}
                  className="relative h-full w-full border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-8 text-center max-w-xl mx-auto">
                <div className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-md border border-slate-100 ${color}`}>
                  <Icon className="w-10 h-10" strokeWidth={1.4} />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-slate-800 text-base">{item.name}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Tệp Office không thể xem trực tiếp trên trình duyệt.<br />
                    Bạn có thể tải xuống hoặc mở tệp trong tab mới để xem nội dung.
                  </p>
                  <p className="text-xs text-slate-400">{(item.mimeType || "Tệp").replace(/^application\//, "")} · {formatBytes(item.size)}</p>
                </div>
                <div className="flex gap-3">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Mở tab mới
                  </a>
                  {!hideDownload && (
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {downloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Tải xuống
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {kind === "unsupported" && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
              <FileQuestion className="w-16 h-16 text-slate-300" />
              <div>
                <p className="font-semibold text-slate-600">Không thể xem trước loại tệp này</p>
                <p className="text-sm text-slate-400">Bạn có thể mở trong tab mới hoặc tải xuống để xem.</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở tab mới
                </a>
                {!hideDownload && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Tải xuống
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
