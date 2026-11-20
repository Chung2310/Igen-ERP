import React, { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { getBlogAttachmentAccess, type BlogAttachment, type BlogPostItem } from "../../services/blogService";
export function BlogAttachmentActions({ post, attachment }: { post: BlogPostItem; attachment: BlogAttachment }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(false);
  if (post.attachmentsPublic !== undefined && post.attachmentsPublic !== true) return <span className="text-xs text-slate-500">Không công khai</span>;
  const run = async (share: boolean) => {
    if (busy) return;
    setBusy(true); setError(""); setCopied(false);
    try {
      const id = attachment._id || attachment.id;
      if (!id) throw new Error("Vui lòng tải lại bài viết để cập nhật tệp.");
      const url = new URL(await getBlogAttachmentAccess(post.id, id), window.location.origin).href;
      if (share) {
        if (navigator.share) await navigator.share({ title: attachment.name, url });
        else { await navigator.clipboard.writeText(url); setCopied(true); }
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Tệp không còn công khai hoặc không thể tải về.");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob), anchor = document.createElement("a");
        anchor.href = objectUrl; anchor.download = attachment.name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      }
    } catch (error: any) { if (error.name !== "AbortError") setError(error.message || "Không thể truy cập tệp."); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <button type="button" disabled={busy} onClick={() => void run(false)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-indigo-600 disabled:opacity-50"><Download size={14} />Tải về</button>
    <button type="button" disabled={busy} onClick={() => void run(true)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-indigo-600 disabled:opacity-50"><Share2 size={14} />Chia sẻ</button>
    {copied && <span role="status">Đã sao chép liên kết</span>}{error && <span role="alert" className="text-red-600">{error}</span>}
  </div>;
}
