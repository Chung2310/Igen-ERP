import React, { useEffect, useState } from "react";
import { internalChatService, LinkPreview } from "../../services/internalChatService";

// Cache theo URL để không gọi lại API mỗi lần re-render / cuộn
const previewCache = new Map<string, LinkPreview | null>();

export const LinkPreviewCard: React.FC<{ url: string; onDark?: boolean }> = ({ url, onDark }) => {
  const [data, setData] = useState<LinkPreview | null>(() => previewCache.get(url) ?? null);
  const [loaded, setLoaded] = useState(previewCache.has(url));

  useEffect(() => {
    if (previewCache.has(url)) {
      setData(previewCache.get(url) || null);
      setLoaded(true);
      return;
    }
    let active = true;
    internalChatService
      .getLinkPreview(url)
      .then((d) => {
        previewCache.set(url, d);
        if (active) {
          setData(d);
          setLoaded(true);
        }
      })
      .catch(() => {
        previewCache.set(url, null);
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  // Không hiển thị nếu chưa tải xong hoặc không có metadata hữu ích
  if (!loaded || !data || (!data.title && !data.description && !data.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 flex max-w-sm overflow-hidden rounded-xl border transition hover:opacity-95 ${
        onDark ? "border-white/20 bg-white/10" : "border-slate-200 bg-white"
      }`}
    >
      {data.image && (
        <div className="w-20 shrink-0 overflow-hidden bg-slate-100">
          <img
            src={data.image}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        </div>
      )}
      <div className="min-w-0 flex-1 p-2.5">
        {data.siteName && (
          <p className={`truncate text-[10px] uppercase tracking-wide ${onDark ? "text-white/70" : "text-slate-400"}`}>
            {data.siteName}
          </p>
        )}
        {data.title && (
          <p className={`truncate text-xs font-bold ${onDark ? "text-white" : "text-slate-800"}`}>{data.title}</p>
        )}
        {data.description && (
          <p className={`line-clamp-2 text-[11px] ${onDark ? "text-white/80" : "text-slate-500"}`}>
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
};
