import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink, Loader2, RefreshCw, HardDrive, Settings, Upload, FolderOpen, Trash2, AlertTriangle, File as FileIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import { resourceService } from "../../services/resourceService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { formatDate } from "./resourceHelpers";
import type { DriveApiFile } from "../../types";

export const DriveDocuments: React.FC = () => {
  const { userProfile } = useAuth();
  const companyCode = userProfile?.companyCode || "";
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "superadmin";

  const [connected, setConnected] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [files, setFiles] = useState<DriveApiFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DriveApiFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!companyCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const config = await authService.getCompanyDriveConfig(companyCode);
      setConnected(config.driveConnected);
      setDriveLink(config.driveFolderLink || "");
      if (config.driveConnected) {
        try {
          const list = await resourceService.listDriveFiles();
          setFiles(list);
          // Thư mục có thể vừa được tạo ở lần list đầu — lấy lại link mở thư mục
          if (!config.driveFolderLink) {
            const refreshed = await authService.getCompanyDriveConfig(companyCode);
            setDriveLink(refreshed.driveFolderLink || "");
          }
        } catch (e) {
          setError(getApiErrorMessage(e, "Không tải được danh sách file Google Drive."));
          setFiles([]);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được cấu hình Google Drive.");
    } finally {
      setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0) return;
      setUploading(true);
      let ok = 0;
      for (const file of arr) {
        try {
          await resourceService.uploadToDrive(file);
          ok += 1;
        } catch (e) {
          toast.error(`Lỗi tải "${file.name}": ${e instanceof Error ? e.message : "thất bại"}`);
        }
      }
      if (ok > 0) toast.success(`Đã tải lên Google Drive ${ok}/${arr.length} tệp.`);
      setUploading(false);
      load();
    },
    [load]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await resourceService.deleteDriveFile(deleteTarget.id);
      toast.success(`Đã xóa "${deleteTarget.name}" khỏi Google Drive.`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xóa được file.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // Chưa kết nối Google Drive
  if (!connected) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
        <HardDrive className="w-16 h-16 text-slate-300" />
        <div className="max-w-md">
          <p className="font-bold text-slate-600">Chưa kết nối Google Drive</p>
          <p className="text-sm text-slate-400 mt-1">
            {isAdmin
              ? "Vào Cài đặt → Tích hợp doanh nghiệp để kết nối tài khoản Google Drive của công ty."
              : "Doanh nghiệp chưa kết nối Google Drive. Vui lòng liên hệ Quản trị viên."}
          </p>
        </div>
        {isAdmin && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            <Settings className="w-4 h-4" />
            Cài đặt → Tích hợp doanh nghiệp → Google Drive của công ty
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Đang tải lên Drive..." : "Tải lên Google Drive"}
        </button>
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInput} />

        {driveLink && (
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
            Mở thư mục
          </a>
        )}
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition active:scale-95"
          title="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Vùng nội dung */}
      <div
        className={`relative min-h-0 flex-1 overflow-y-auto rounded-2xl border ${
          isDragging ? "border-blue-400 border-dashed bg-blue-50/50" : "border-slate-100 bg-slate-50/40"
        } p-4 transition-colors`}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-blue-50/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-blue-600">
              <Upload className="w-10 h-10" />
              <p className="font-bold">Thả tệp để tải lên Google Drive</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center px-6">
            <AlertTriangle className="w-14 h-14 text-amber-400" />
            <div className="max-w-lg">
              <p className="font-semibold text-slate-600">Không truy cập được thư mục Google Drive</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
            {driveLink && (
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <ExternalLink className="w-4 h-4" /> Mở trong Google Drive
              </a>
            )}
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center text-slate-400">
            <FolderOpen className="w-14 h-14 text-slate-300" />
            <div>
              <p className="font-semibold text-slate-500">Thư mục Drive chung đang trống</p>
              <p className="text-sm">Bấm "Tải lên Google Drive" hoặc kéo-thả tệp vào đây.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => {
              const openLink = file.webViewLink || driveLink;
              return (
                <div
                  key={file.id}
                  className="group relative flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs hover:border-blue-200 hover:shadow-md transition"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                    {file.iconLink ? (
                      <img src={file.iconLink} alt="" className="h-6 w-6" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <FileIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700" title={file.name}>
                      {file.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {file.modifiedTime ? `Cập nhật ${formatDate(file.modifiedTime)}` : "Google Drive"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={openLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
                      title="Mở trong Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => setDeleteTarget(file)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Xóa khỏi Drive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Xóa file khỏi Google Drive?"
        description={`Tệp "${deleteTarget?.name}" sẽ được chuyển vào thùng rác trên Google Drive. Hành động này ảnh hưởng tới thư mục chung của công ty.`}
        confirmLabel="Xóa"
        tone="danger"
        isSubmitting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
