import React, { useEffect, useState } from "react";
import { getAccessToken } from "../../services/authService";
export function ProtectedBlogMedia({ src, kind = "image", alt = "", className, onClick }: { src: string; kind?: "image" | "video" | "audio" | "document"; alt?: string; className?: string; onClick?: React.MouseEventHandler }) {
  const managed = /^\/api\/v1\/blogs\/files\/[a-f0-9]{24}\/preview$/.test(src);
  const [loaded, setLoaded] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => {
    if (!managed) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetch(src, { headers: { Authorization: "Bearer " + (getAccessToken() || "") }, signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Không thể xem tệp");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setLoaded({ src, url: objectUrl });
    }).catch(() => { if (!controller.signal.aborted) setLoaded(null); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, managed]);
  const url = managed ? (loaded?.src === src ? loaded.url : undefined) : src;
  if (!url) return <div className={className} role="status">Đang tải nội dung…</div>;
  if (kind === "document") return <iframe title={alt || "Tài liệu PDF"} src={url} sandbox="" className={className} />;
  if (kind === "video") return <video src={url} controls controlsList="nodownload" disablePictureInPicture className={className} onContextMenu={event => event.preventDefault()} />;
  if (kind === "audio") return <audio src={url} controls controlsList="nodownload" className={className} onContextMenu={event => event.preventDefault()} />;
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" onContextMenu={event => event.preventDefault()} />;
}
