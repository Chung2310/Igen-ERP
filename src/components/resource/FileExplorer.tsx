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
} from "lucide-react";
import type { ResourceItem, BreadcrumbEntry } from "../../types";
import { resourceService } from "../../services/resourceService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { FilePreviewModal } from "./FilePreviewModal";
import { formatBytes, formatDate, getFileIcon } from "./resourceHelpers";

export const FileExplorer: React.FC = () => {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    [currentFolder, load]
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
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
      onClick={() => setMenuOpenId(null)}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-4">
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

      {/* Vùng nội dung */}
      <div
        className={`relative flex-1 overflow-y-auto rounded-2xl border ${
          isDragging ? "border-blue-400 border-dashed bg-blue-50/50" : "border-slate-100 bg-slate-50/40"
        } p-4 transition-colors`}
      >
        {isDragging && (
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                onOpen={() => item.fileUrl && setPreviewItem(item)}
                onRename={() => {
                  setRenameTarget(item);
                  setRenameValue(item.name);
                  setMenuOpenId(null);
                }}
                onDelete={() => {
                  setDeleteTarget(item);
                  setMenuOpenId(null);
                }}
              />
            ))}
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
}> = ({ item, menuOpen, onToggleMenu, onOpen, onRename, onDelete }) => {
  const isFolder = item.type === "folder";
  const { Icon, color } = isFolder ? { Icon: Folder, color: "text-amber-400" } : getFileIcon(item.mimeType, item.name);

  return (
    <div
      onDoubleClick={onOpen}
      className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-xs hover:border-blue-200 hover:shadow-md transition cursor-pointer"
    >
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={onToggleMenu}
          className="rounded-lg p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!isFolder && item.fileUrl && (
              <a
                href={`/api/v1/media/download?url=${encodeURIComponent(item.fileUrl)}&filename=${encodeURIComponent(item.name)}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Download className="w-4 h-4" />
                Tải xuống
              </a>
            )}
            <button onClick={onRename} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <Pencil className="w-4 h-4" />
              Đổi tên
            </button>
            <button onClick={onDelete} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
              Xóa
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-4" onClick={isFolder ? onOpen : onOpen}>
        <Icon className={`w-12 h-12 ${color}`} strokeWidth={1.5} />
      </div>
      <div className="mt-1 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-700" title={item.name}>
          {item.name}
        </p>
        <p className="truncate text-[11px] text-slate-400">
          {isFolder ? "Thư mục" : formatBytes(item.size)} · {formatDate(item.createdAt)}
        </p>
      </div>
    </div>
  );
};
