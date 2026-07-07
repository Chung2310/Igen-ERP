import React, { useState, useEffect, useRef } from "react";
import {
  FolderOpen, CloudUpload, Trash2, Eye, Download, HardDrive,
  FileText, Image as ImageIcon, Video as VideoIcon, File as FileIcon,
  Loader2, RefreshCw, AlertCircle, ArrowUpRight, FolderTree
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "./Toast";
import { getAccessToken } from "../services/authService";
import { FileExplorer } from "../components/resource/FileExplorer";

interface Resource {
  _id: string;
  name: string;
  mimeType: string;
  driveFileId: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: number;
  createdAt: string;
}

type ResourceSubTabType = "TÀI LIỆU KHÁC" | "GOOGLE DRIVE";

const SUB_TABS: Array<{ value: ResourceSubTabType; label: string; icon: React.ElementType }> = [
  { value: "TÀI LIỆU KHÁC", label: "Tài liệu khác", icon: FolderTree },
  { value: "GOOGLE DRIVE", label: "Google Drive", icon: HardDrive },
];

export default function ResourceTab() {
  const { userProfile, setActiveTab } = useAuth();
  const [subTab, setSubTab] = useState<ResourceSubTabType>("TÀI LIỆU KHÁC");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConnected = userProfile?.googleDriveIntegration?.isConnected;
  const driveEmail = userProfile?.googleDriveIntegration?.driveEmail;

  const fetchResources = async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/integrations/google-drive/resources", {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải danh sách tài nguyên.");
      setResources(data.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi tải danh sách tài nguyên.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "GOOGLE DRIVE") {
      fetchResources();
    }
  }, [isConnected, subTab]);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-8 w-8 text-emerald-500" />;
    if (mimeType.startsWith("video/")) return <VideoIcon className="h-8 w-8 text-blue-500" />;
    if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
      return <FileText className="h-8 w-8 text-orange-500" />;
    }
    return <FileIcon className="h-8 w-8 text-gray-500" />;
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        const res = await fetch("/api/v1/integrations/google-drive/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            file: base64String,
            name: file.name,
            mimeType: file.type,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Tải lên thất bại.");

        toast.success(`Đã tải lên thành công: ${file.name}`);
        void fetchResources();
      };
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Có lỗi xảy ra khi tải lên tệp tin.");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFileUpload(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteResource = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tệp "${name}"? Thao tác này sẽ xóa vĩnh viễn tệp trên Google Drive.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/integrations/google-drive/resources/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Xóa thất bại.");

      toast.success("Đã xóa tài nguyên thành công.");
      void fetchResources();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi xóa tài nguyên.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="text-left">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-blue-600" />
            Quản lý tài nguyên
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Lưu trữ, sắp xếp tài liệu nội bộ và liên kết Google Drive của doanh nghiệp.
          </p>
        </div>

        {subTab === "GOOGLE DRIVE" && isConnected && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Tài khoản liên kết</p>
              <p className="text-xs font-bold text-gray-700">{driveEmail}</p>
            </div>
            <button
              onClick={fetchResources}
              disabled={loading}
              className="inline-flex items-center justify-center p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition active:scale-95 disabled:opacity-55"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 cursor-pointer disabled:opacity-55"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tải lên...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>Tải tệp mới</span>
                </>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Sub-tab switcher */}
      <div className="flex shrink-0 gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setSubTab(tab.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Nội dung */}
      <div className="min-h-0 flex-1 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm overflow-y-auto">
        {subTab === "TÀI LIỆU KHÁC" ? (
          <FileExplorer />
        ) : !isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white/50 border border-dashed border-gray-300 rounded-3xl p-10">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-blue-600 mb-4 shadow-inner">
              <HardDrive className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800">Chưa kết nối Google Drive</h3>
            <p className="text-xs text-gray-500 max-w-sm text-center mt-2 leading-relaxed">
              Nhân viên cần liên kết với tài khoản Google cá nhân của mình để kích hoạt không gian lưu trữ tài nguyên riêng biệt.
            </p>
            <button
              onClick={() => setActiveTab("CÀI ĐẶT")}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all duration-150 cursor-pointer"
            >
              <span>Đi tới Cài đặt cá nhân để liên kết</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="group flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-blue-500 bg-white hover:bg-blue-50/10 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-500 group-hover:text-blue-600 mb-3 transition">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                ) : (
                  <CloudUpload className="h-6 w-6" />
                )}
              </div>
              <p className="text-xs font-bold text-gray-700">Kéo thả tệp tin hoặc Nhấp để duyệt tệp</p>
              <p className="text-[10px] text-gray-400 mt-1">Hỗ trợ hình ảnh, video, PDF, tài liệu Word/Excel...</p>
            </div>

            {/* Resource Grid */}
            {loading && resources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-xs text-gray-500 mt-2 font-medium">Đang quét tài nguyên từ Google Drive...</p>
              </div>
            ) : resources.length === 0 ? (
              <div className="text-center py-16 bg-white border border-gray-150 rounded-2xl p-6">
                <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-700">Thư mục trống</p>
                <p className="text-[10px] text-gray-400 mt-1">Bạn chưa tải lên tài nguyên nào trên tài khoản Google Drive này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {resources.map((resource) => (
                  <div
                    key={resource._id}
                    className="flex flex-col border border-gray-200/80 bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200"
                  >
                    {/* Preview Container */}
                    <div className="h-36 bg-gray-50 flex items-center justify-center relative border-b border-gray-100 group">
                      {resource.thumbnailLink ? (
                        <img
                          src={resource.thumbnailLink.replace("s220", "s400")}
                          alt={resource.name}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        getFileIcon(resource.mimeType)
                      )}

                      {/* Quick view button overlay */}
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center gap-2">
                        <a
                          href={resource.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-white/95 rounded-xl text-gray-700 hover:text-blue-600 shadow-sm transition active:scale-90"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        {resource.webContentLink && (
                          <a
                            href={resource.webContentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white/95 rounded-xl text-gray-700 hover:text-blue-600 shadow-sm transition active:scale-90"
                            title="Tải về"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between text-left">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate" title={resource.name}>
                          {resource.name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate font-mono uppercase">
                          {resource.mimeType.split("/")[1] || "Không xác định"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-gray-100">
                        <span className="text-[10px] font-semibold text-gray-500">
                          {formatBytes(resource.size)}
                        </span>
                        <button
                          onClick={() => handleDeleteResource(resource._id, resource.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa tài nguyên"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
