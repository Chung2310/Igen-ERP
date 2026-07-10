import {
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Presentation,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import type { DriveDocType } from "../../types";

/** Định dạng dung lượng file dễ đọc. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Định dạng ngày kiểu Việt Nam. */
export function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Chọn icon + màu theo mimeType / tên file. */
export function getFileIcon(mimeType?: string, name?: string): { Icon: LucideIcon; color: string } {
  const mt = (mimeType || "").toLowerCase();
  const ext = (name || "").toLowerCase().split(".").pop() || "";

  if (mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return { Icon: FileImage, color: "text-emerald-500" };
  }
  if (mt.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
    return { Icon: FileVideo, color: "text-rose-500" };
  }
  if (mt.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) {
    return { Icon: FileAudio, color: "text-purple-500" };
  }
  if (mt === "application/pdf" || ext === "pdf") {
    return { Icon: FileText, color: "text-red-500" };
  }
  if (["doc", "docx"].includes(ext)) {
    return { Icon: FileText, color: "text-blue-500" };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return { Icon: FileSpreadsheet, color: "text-green-600" };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { Icon: Presentation, color: "text-orange-500" };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return { Icon: FileArchive, color: "text-amber-500" };
  }
  if (mt === "text/html" || mt.includes("html") || ext === "html") {
    return { Icon: LinkIcon, color: "text-cyan-600" };
  }
  return { Icon: FileIcon, color: "text-slate-400" };
}

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "office" | "text" | "unsupported";

/** Xác định cách xem trước phù hợp dựa trên mimeType / phần mở rộng. */
export function getPreviewKind(mimeType?: string, name?: string): PreviewKind {
  const mt = (mimeType || "").toLowerCase();
  const ext = (name || "").toLowerCase().split(".").pop() || "";

  if (mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "image";
  if (mt.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) return "video";
  if (mt.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return "audio";
  if (mt === "application/pdf" || ext === "pdf") return "pdf";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (mt.startsWith("text/") || ["txt", "csv", "md", "json", "log"].includes(ext)) return "text";
  return "unsupported";
}

/** Chọn icon + màu cho tài liệu Google Drive. */
export function getDriveIcon(driveType?: DriveDocType): { Icon: LucideIcon; color: string } {
  switch (driveType) {
    case "document":
      return { Icon: FileText, color: "text-blue-500" };
    case "spreadsheet":
      return { Icon: FileSpreadsheet, color: "text-green-600" };
    case "presentation":
      return { Icon: Presentation, color: "text-orange-500" };
    case "pdf":
      return { Icon: FileText, color: "text-red-500" };
    default:
      return { Icon: FileIcon, color: "text-slate-400" };
  }
}
