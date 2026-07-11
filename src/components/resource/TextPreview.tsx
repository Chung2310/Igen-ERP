import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface TextPreviewProps {
  /** URL proxy download (same-origin, kèm token) để tải nội dung file */
  downloadHref: string;
  fileName: string;
  /** Gọi khi không tải được file — cha sẽ hiển thị fallback tải xuống */
  onError: () => void;
}

/** Giới hạn dung lượng text render để tránh treo trình duyệt */
const MAX_CHARS = 500_000;

/** Xem trước file text (txt, md, json, log...): tải qua proxy rồi render dạng chữ. */
export const TextPreview: React.FC<TextPreviewProps> = ({ downloadHref, fileName, onError }) => {
  const [content, setContent] = useState<string | null>(null);
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
        let text = await res.text();
        // File JSON: format lại cho dễ đọc
        if (/\.json$/i.test(fileName)) {
          try {
            text = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            /* JSON không hợp lệ thì giữ nguyên */
          }
        }
        if (!cancelled) setContent(text.slice(0, MAX_CHARS));
      } catch (err) {
        console.error("[TextPreview] Không đọc được file:", fileName, err);
        if (!cancelled) onError();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadHref]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (content === null) return null;

  return (
    <div className="h-[80vh] overflow-auto bg-white">
      <pre className="whitespace-pre-wrap break-words p-6 font-mono text-xs leading-relaxed text-slate-700">
        {content}
      </pre>
      {content.length >= MAX_CHARS && (
        <p className="p-3 text-center text-[11px] text-slate-400">
          Chỉ hiển thị phần đầu của file. Tải xuống để xem đầy đủ.
        </p>
      )}
    </div>
  );
};
