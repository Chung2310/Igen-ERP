import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  FolderPlus,
  Folder,
  Home,
  Loader2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  FolderOpen,
  Info,
  ArrowRightLeft,
  Copy,
  BellOff,
  MessageSquare,
  Briefcase,
  Share2,
  X,
} from "lucide-react";
import type { ResourceItem, BreadcrumbEntry } from "../../types";
import { resourceService } from "../../services/resourceService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { FilePreviewModal } from "./FilePreviewModal";
import { formatBytes, formatDate, getFileIcon } from "./resourceHelpers";
import { useAuth } from "../../context/AuthContext";

const GoogleDriveLogo: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M121 54.5L50.5 176.5L93.5 251L164 129L121 54.5Z" fill="#0066DA" />
    <path d="M239 54.5L121 54.5L164 129L282 129L239 54.5Z" fill="#00A85D" />
    <path d="M164 129L93.5 251L211.5 251L282 129L164 129Z" fill="#FFD043" />
  </svg>
);

const GoogleDocsLogo: React.FC<{ className?: string }> = ({ className = "h-16 w-16" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M75 30H210L285 105V330H75V30Z" fill="#4285F4" />
    <path d="M210 30L285 105H210V30Z" fill="#A1C2FA" />
    <rect x="110" y="145" width="140" height="20" rx="4" fill="white" />
    <rect x="110" y="185" width="140" height="20" rx="4" fill="white" />
    <rect x="110" y="225" width="140" height="20" rx="4" fill="white" />
    <rect x="110" y="265" width="90" height="20" rx="4" fill="white" />
  </svg>
);

const GoogleSheetsLogo: React.FC<{ className?: string }> = ({ className = "h-16 w-16" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M75 30H210L285 105V330H75V30Z" fill="#0F9D58" />
    <path d="M210 30L285 105H210V30Z" fill="#57DB9A" />
    <rect x="105" y="135" width="150" height="135" rx="6" fill="white" />
    <rect x="120" y="150" width="55" height="30" fill="#0F9D58" />
    <rect x="185" y="150" width="55" height="30" fill="#0F9D58" />
    <rect x="120" y="190" width="55" height="30" fill="#0F9D58" />
    <rect x="185" y="190" width="55" height="30" fill="#0F9D58" />
    <rect x="120" y="230" width="55" height="30" fill="#0F9D58" />
    <rect x="185" y="230" width="55" height="30" fill="#0F9D58" />
  </svg>
);

const GoogleSlidesLogo: React.FC<{ className?: string }> = ({ className = "h-16 w-16" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M75 30H210L285 105V330H75V30Z" fill="#F4B400" />
    <path d="M210 30L285 105H210V30Z" fill="#FAD980" />
    <rect x="110" y="150" width="140" height="95" rx="6" fill="white" />
    <rect x="120" y="160" width="120" height="75" rx="4" fill="#F4B400" />
  </svg>
);

interface FileExplorerProps {
  onOpenFile?: (item: ResourceItem) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onOpenFile }) => {
  const { userProfile } = useAuth();
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const isInsideFixedFolder = breadcrumb.some((b) => b.isFixed);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [infoItem, setInfoItem] = useState<ResourceItem | null>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [renameTarget, setRenameTarget] = useState<ResourceItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ResourceItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const [list, trail] = await Promise.all([
        resourceService.list("local", folderId),
        folderId ? resourceService.breadcrumb(folderId) : Promise.resolve([] as BreadcrumbEntry[]),
      ]);
      setItems(list);
      setBreadcrumb(trail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được tài nguyên.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(currentFolder);
  }, [currentFolder, load]);

  const openFolder = (id: string) => {
    setMenuOpenId(null);
    setCurrentFolder(id);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      await resourceService.createFolder(name, currentFolder, "local");
      toast.success(`Đã tạo thư mục "${name}".`);
      setNewFolderName("");
      setShowNewFolder(false);
      load(currentFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được thư mục.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (isInsideFixedFolder) {
        toast.warning("Thư mục này chỉ dành cho tài liệu từ Google Drive, không thể tải lên trực tiếp.");
        return;
      }
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setUploading(true);
      let ok = 0;
      for (const file of arr) {
        try {
          await resourceService.uploadFile(file, currentFolder);
          ok += 1;
        } catch (e) {
          toast.error(`Lỗi tải "${file.name}": ${e instanceof Error ? e.message : "thất bại"}`);
        }
      }
      if (ok > 0) toast.success(`Đã tải lên ${ok}/${arr.length} tệp.`);
      setUploading(false);
      load(currentFolder);
    },
    [currentFolder, load, isInsideFixedFolder]
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

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      await resourceService.rename(renameTarget._id, name);
      toast.success("Đã đổi tên.");
      setRenameTarget(null);
      load(currentFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đổi tên được.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await resourceService.remove(deleteTarget._id);
      toast.success(`Đã xóa "${deleteTarget.name}".`);
      setDeleteTarget(null);
      load(currentFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xóa được.");
    } finally {
      setDeleting(false);
    }
  };

  const folders = items.filter((i) => i.type === "folder");
  const files = items.filter((i) => i.type === "file");

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging && !isInsideFixedFolder) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
      onClick={() => setMenuOpenId(null)}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-4">
        {!isInsideFixedFolder && (
          <>
            <button
              onClick={() => setShowNewFolder(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition active:scale-95"
            >
              <FolderPlus className="w-4 h-4 text-amber-500" />
              Tạo thư mục
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Đang tải lên..." : "Tải lên"}
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInput} />
          </>
        )}

        <button
          onClick={() => load(currentFolder)}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition active:scale-95"
          title="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-slate-500 pb-3 flex-wrap">
        <button
          onClick={() => setCurrentFolder(null)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 transition ${
            currentFolder === null ? "font-bold text-slate-800" : ""
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          Tài liệu
        </button>
        {breadcrumb.map((b, idx) => (
          <React.Fragment key={b._id}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <button
              onClick={() => setCurrentFolder(b._id)}
              className={`rounded-lg px-2 py-1 hover:bg-slate-100 transition truncate max-w-[160px] ${
                idx === breadcrumb.length - 1 ? "font-bold text-slate-800" : ""
              }`}
            >
              {b.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Vùng chứa hai cột: Danh sách tài liệu và Bảng thông tin chi tiết */}
      <div className="flex-1 flex overflow-hidden gap-4 min-h-0">
        {/* Vùng nội dung bên trái */}
        <div
          className={`relative flex-1 overflow-y-auto rounded-2xl border ${
            isDragging ? "border-blue-400 border-dashed bg-blue-50/50" : "border-slate-100 bg-slate-50/40"
          } p-4 transition-colors`}
        >
          {isDragging && !isInsideFixedFolder && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-blue-50/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-blue-600">
                <Upload className="w-10 h-10" />
                <p className="font-bold">Thả tệp vào đây để tải lên</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center text-slate-400">
              <FolderOpen className="w-14 h-14 text-slate-300" />
              <div>
                <p className="font-semibold text-slate-500">Thư mục trống</p>
                <p className="text-sm">Tạo thư mục mới hoặc kéo-thả tệp vào đây để bắt đầu.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 pb-64">
              {/* Thư mục */}
              {folders.map((item) => (
                <ResourceCard
                  key={item._id}
                  item={item}
                  menuOpen={menuOpenId === item._id}
                  onToggleMenu={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === item._id ? null : item._id);
                  }}
                  onOpen={() => openFolder(item._id)}
                  onRename={() => {
                    setRenameTarget(item);
                    setRenameValue(item.name);
                    setMenuOpenId(null);
                  }}
                  onDelete={() => {
                    setDeleteTarget(item);
                    setMenuOpenId(null);
                  }}
                  onShowInfo={() => setInfoItem(item)}
                />
              ))}
              {/* Tệp */}
              {files.map((item) => (
                <ResourceCard
                  key={item._id}
                  item={item}
                  menuOpen={menuOpenId === item._id}
                  onToggleMenu={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === item._id ? null : item._id);
                  }}
                  onOpen={() => {
                    if (item.fileUrl) {
                      const isGoogleDoc = item.mimeType?.startsWith("application/vnd.google-apps") || item.fileUrl.includes("drive.google.com") || item.fileUrl.includes("docs.google.com");
                      if (isGoogleDoc && onOpenFile) {
                        onOpenFile(item);
                      } else {
                        setPreviewItem(item);
                      }
                    }
                  }}
                  onRename={() => {
                    setRenameTarget(item);
                    setRenameValue(item.name);
                    setMenuOpenId(null);
                  }}
                  onDelete={() => {
                    setDeleteTarget(item);
                    setMenuOpenId(null);
                  }}
                  onShowInfo={() => setInfoItem(item)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bảng thông tin chi tiết bên phải */}
        {infoItem && (
          <div className="w-80 border border-slate-200 bg-white rounded-2xl flex flex-col shrink-0 relative overflow-hidden shadow-xs animate-fadeIn text-left">
            {/* Header với nút X đóng */}
            <div className="flex items-center justify-end p-4 pb-2">
              <button
                onClick={() => setInfoItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Icon lớn và Tên */}
            <div className="flex flex-col items-center px-6 pb-6 text-center border-b border-slate-100">
              <div className="h-28 w-28 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                {(() => {
                  const isFolder = infoItem.type === "folder";
                  const { Icon, color } = isFolder 
                    ? { Icon: FolderOpen, color: "text-[#5bc0be]" } 
                    : getFileIcon(infoItem.mimeType, infoItem.name);
                  return <Icon className={`h-16 w-16 ${color}`} strokeWidth={1.5} />;
                })()}
              </div>
              <h4 className="text-sm font-bold text-slate-800 break-all px-2" title={infoItem.name}>
                {infoItem.name}
              </h4>
            </div>

            {/* Danh sách thông tin chi tiết */}
            <div className="flex-1 p-6 flex flex-col gap-5 text-left text-xs">
              {/* Vị trí */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-400 font-semibold">Trong</span>
                <span className="text-slate-700 font-bold flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-[#5bc0be]/10 text-[#5bc0be] flex items-center justify-center text-[9px] font-black shrink-0">
                    {(() => {
                      const userInitials = userProfile?.displayName
                        ? userProfile.displayName.split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase()
                        : "NT";
                      return userInitials;
                    })()}
                  </span>
                  Kho lưu trữ của {userProfile?.displayName || "Nguyễn Tân Tiến"}
                </span>
              </div>

              {/* Ngày tạo */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-400 font-semibold">Ngày tạo</span>
                <span className="text-slate-700 font-bold">
                  {(() => {
                    const d = new Date(infoItem.createdAt);
                    if (isNaN(d.getTime())) return formatDate(infoItem.createdAt) || "—";
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const day = pad(d.getDate());
                    const month = pad(d.getMonth() + 1);
                    const year = d.getFullYear();
                    const hours = pad(d.getHours());
                    const minutes = pad(d.getMinutes());
                    return `${day} Th${month} ${year}, ${hours}:${minutes}`;
                  })()}
                </span>
              </div>

              {/* Người tạo */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-400 font-semibold">Người tạo</span>
                <span className="text-slate-700 font-bold flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                    {(() => {
                      const userInitials = userProfile?.displayName
                        ? userProfile.displayName.split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase()
                        : "NT";
                      return userInitials;
                    })()}
                  </span>
                  {userProfile?.displayName || "Nguyễn Tân Tiến"} <span className="text-slate-400 font-medium text-[10px]">(Tôi)</span>
                </span>
              </div>
            </div>

            {/* Nút màu vàng nằm dọc ở mép phải bảng thông tin */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
              <div 
                style={{ writingMode: "vertical-rl" }} 
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] py-4 px-1.5 rounded-l-xl shadow-sm cursor-pointer select-none transition flex items-center gap-1 uppercase tracking-wider"
              >
                <span>+ Công việc</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal tạo thư mục */}
      {showNewFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setShowNewFolder(false)}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                <FolderPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Tạo thư mục mới</h3>
                <p className="text-xs text-slate-500">Trong thư mục hiện tại</p>
              </div>
            </div>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder="Tên thư mục..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowNewFolder(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {creatingFolder && <Loader2 className="w-4 h-4 animate-spin" />}
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal đổi tên */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setRenameTarget(null)}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <Pencil className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Đổi tên</h3>
            </div>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleRename}
                disabled={!renameValue.trim()}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Xác nhận xóa */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === "folder" ? "Xóa thư mục?" : "Xóa tệp?"}
        description={
          deleteTarget?.type === "folder"
            ? `Toàn bộ nội dung bên trong "${deleteTarget?.name}" sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.`
            : `Tệp "${deleteTarget?.name}" sẽ bị xóa vĩnh viễn.`
        }
        confirmLabel="Xóa"
        tone="danger"
        isSubmitting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {/* Cửa sổ xem trước tài liệu */}
      <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
};

/** Thẻ hiển thị một mục (thư mục hoặc tệp) trong lưới. */
const ResourceCard: React.FC<{
  item: ResourceItem;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShowInfo: () => void;
}> = ({ item, menuOpen, onToggleMenu, onOpen, onRename, onDelete, onShowInfo }) => {
  const isFolder = item.type === "folder";
  const { Icon, color } = isFolder ? { Icon: Folder, color: "text-[#5bc0be]" } : getFileIcon(item.mimeType, item.name);

  return (
    <div
      onDoubleClick={onOpen}
      className="group relative flex flex-col items-center justify-between bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-200/50 rounded-2xl p-4 transition duration-150 select-none cursor-pointer text-center w-36 h-40 shadow-none hover:shadow-xs"
    >
      {/* Three-dot menu button */}
      <div className={`absolute top-2 right-2 z-10 transition-opacity duration-150 ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          onClick={onToggleMenu}
          className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-xs border border-slate-200/40 transition active:scale-90 cursor-pointer"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute left-2 top-9 z-20 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Xem thông tin */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                onShowInfo();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Info className="h-4 w-4 text-slate-500" />
              <span>Xem thông tin</span>
            </button>

            {/* Đổi tên */}
            {!item.isFixed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Pencil className="h-4 w-4 text-slate-500" />
                <span>Đổi tên</span>
              </button>
            )}

            {/* Di chuyển đến thư mục */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                toast.info("Tính năng di chuyển đang được phát triển.");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowRightLeft className="h-4 w-4 text-slate-500" />
              <span>Di chuyển đến thư mục</span>
            </button>

            {/* Sao chép đường dẫn */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                if (!isFolder && item.fileUrl) {
                  const url = `${window.location.origin}/api/v1/media/download?url=${encodeURIComponent(item.fileUrl)}&filename=${encodeURIComponent(item.name)}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Đã sao chép đường dẫn tải tệp.");
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Đã sao chép đường dẫn thư mục.");
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Sao chép đường dẫn</span>
            </button>

            {/* Chia sẻ */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                toast.info("Tính năng chia sẻ tệp cục bộ đang được đồng bộ.");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Share2 className="h-4 w-4 text-slate-500" />
              <span>Chia sẻ</span>
            </button>

            {/* Tắt thông báo */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                toast.success(`Đã tắt thông báo cho ${isFolder ? "thư mục" : "tệp tin"} này.`);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <BellOff className="h-4 w-4 text-slate-500" />
              <span>Tắt thông báo</span>
            </button>

            {/* Gửi qua tin nhắn */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                toast.info("Tính năng gửi qua chat nội bộ đang được tích hợp.");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <span>Gửi qua tin nhắn</span>
            </button>

            {/* Gửi đến công việc */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(e); // Close menu
                toast.info("Tính năng liên kết với công việc/dự án đang được tích hợp.");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-slate-500" />
                <span>Gửi đến công việc</span>
              </div>
              <ChevronRight className="h-3 w-3 text-slate-400" />
            </button>

            <div className="border-t border-slate-100 my-1"></div>

            {/* Chuyển vào thùng rác */}
            {!item.isFixed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span>Chuyển vào thùng rác</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Icon */}
      <div className="flex-1 flex items-center justify-center mt-3" onClick={onOpen}>
        {isFolder && (item.isFixed || item.name.toUpperCase().includes("GOOGLE")) ? (
          <div className="relative">
            <FolderOpen className="h-16 w-16 text-[#5bc0be]" strokeWidth={1.5} />
            <div className="absolute inset-0 flex items-center justify-center mt-2.5">
              <GoogleDriveLogo className="h-5 w-5 bg-white rounded-full p-0.5" />
            </div>
          </div>
        ) : item.mimeType === "application/vnd.google-apps.spreadsheet" ? (
          <GoogleSheetsLogo className="w-16 h-16" />
        ) : item.mimeType === "application/vnd.google-apps.document" ? (
          <GoogleDocsLogo className="w-16 h-16" />
        ) : item.mimeType === "application/vnd.google-apps.presentation" ? (
          <GoogleSlidesLogo className="w-16 h-16" />
        ) : (
          <Icon className={`w-16 h-16 ${color}`} strokeWidth={1.5} />
        )}
      </div>

      {/* Info */}
      <div className="mt-auto w-full pt-2" onClick={onOpen}>
        <p className="truncate text-[13px] font-bold text-slate-800 px-0.5" title={item.name}>
          {item.name}
        </p>
        <p className="truncate text-[10px] text-slate-400 mt-0.5">
          {isFolder ? "Thư mục" : formatBytes(item.size)} · {formatDate(item.createdAt)}
        </p>
      </div>
    </div>
  );
};
