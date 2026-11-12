import { useState } from "react";
import { Download } from "lucide-react";
import type { AssistantGeneratedFile } from "../../shared/assistant-document";
import { assistantService } from "../../services/assistantService";
import { cn } from "../../modules/student-management/lib/utils";
import { Assistant2DFileIcon } from "./Assistant2DFileIcon";

export function AssistantGeneratedFiles({ files, branchId }: { files: AssistantGeneratedFile[]; branchId?: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function download(file: AssistantGeneratedFile) {
    if (loading) return;
    setLoading(file.id);
    setError(null);
    let url: string | undefined;
    try {
      const blob = await assistantService.downloadFile(file, branchId);
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError({ id: file.id, message: cause instanceof Error ? cause.message : "Không thể tải tệp. Bạn thử lại nhé." });
    } finally {
      if (url) { const objectUrl = url; const revoke = URL.revokeObjectURL; window.setTimeout(() => revoke(objectUrl), 1000); }
      setLoading(null);
    }
  }

  return <ul aria-label="Tệp được tạo trong tin nhắn" className="mt-3 space-y-2">
    {files.map(file => <li key={file.id} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Assistant2DFileIcon fileName={file.fileName} format={file.format} className="size-12 shrink-0" />
        <div className="min-w-0 flex-1 basis-40">
          <p className="break-words text-pretty text-sm font-medium text-on-surface">{file.fileName}</p>
          <p className="mt-1 text-pretty text-xs tabular-nums text-on-surface-variant">{Math.max(1, Math.ceil(file.size / 1024)).toLocaleString("vi-VN")} KB · Phiên bản {file.version}</p>
        </div>
        <button type="button" onClick={() => void download(file)} disabled={loading !== null} aria-label={`Tải xuống ${file.fileName}`} aria-busy={loading === file.id} className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-surface disabled:cursor-wait disabled:opacity-50")}>
          <Download className="size-4" aria-hidden="true" />{loading === file.id ? "Đang tải…" : "Tải xuống"}
        </button>
      </div>
      {loading === file.id && <p role="status" className="mt-2 text-pretty text-xs text-on-surface-variant">Đang tải tệp, vui lòng chờ.</p>}
      {error?.id === file.id && <p role="alert" className="mt-2 text-pretty text-sm text-error">{error.message}</p>}
    </li>)}
  </ul>;
}
