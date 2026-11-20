import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { renderAsync } from "docx-preview";

interface DocxPreviewProps {
  /** URL proxy download (same-origin, kèm token) để tải nội dung file */
  downloadHref: string;
  fileName: string;
  /** Gọi khi không tải/render được file — cha sẽ hiển thị fallback tải xuống */
  onError: () => void;
}

/** Xem trước file Word (.docx): tải qua proxy rồi render bằng docx-preview. */
export const DocxPreview: React.FC<DocxPreviewProps> = ({ downloadHref, fileName, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("accessToken");
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(downloadHref, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        await renderAsync(buffer, containerRef.current, undefined, {
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
        });
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("[DocxPreview] Không render được file:", fileName, err);
        if (!cancelled) {
          setLoading(false);
          onError();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadHref]);

  return (
    <div className="relative h-[80vh] overflow-auto bg-slate-100">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="docx-preview-container [&_.docx-wrapper]:bg-slate-100 [&_.docx-wrapper]:p-4" />
    </div>
  );
};
