import React, { useState, useEffect, useRef } from "react";
import {
  FolderOpen, CloudUpload, Trash2, Eye, Download, HardDrive,
  FileText, Image as ImageIcon, Video as VideoIcon, File as FileIcon,
  Loader2, RefreshCw, AlertCircle, ArrowUpRight, FolderTree,
  Share2, Shield, Lock, Globe, Search, X, ChevronDown, Check, Users, Plus,
  Link as LinkIcon, FileSpreadsheet, Presentation, FolderPlus, Upload, MoreVertical,
  Info, Pencil, ArrowRightLeft, Copy, BellOff, MessageSquare, Briefcase, ChevronRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "./Toast";
import { getAccessToken } from "../services/authService";
import { FileExplorer } from "../components/resource/FileExplorer";
import { internalChatService } from "../services/internalChatService";

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
  { value: "TÀI LIỆU KHÁC", label: "Tài liệu khác", icon: FileText },
  { value: "GOOGLE DRIVE", label: "Google Drive", icon: HardDrive },
];

const GoogleDriveLogo = ({ className = "h-6 w-6" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M121 54.5L50.5 176.5L93.5 251L164 129L121 54.5Z" fill="#0066DA" />
    <path d="M239 54.5L121 54.5L164 129L282 129L239 54.5Z" fill="#00A85D" />
    <path d="M164 129L93.5 251L211.5 251L282 129L164 129Z" fill="#FFD043" />
  </svg>
);

const EmptyStateIllustration = () => (
  <svg className="w-80 h-60 mx-auto" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Monitor Stand */}
    <path d="M80 120 L120 120 L110 100 L90 100 Z" fill="#cbd5e1" />
    <rect x="75" y="120" width="50" height="4" rx="2" fill="#94a3b8" />
    
    {/* Monitor Frame */}
    <rect x="40" y="30" width="120" height="75" rx="6" fill="#64748b" />
    <rect x="44" y="34" width="112" height="60" rx="2" fill="#ffffff" />
    <rect x="40" y="98" width="120" height="7" fill="#475569" />
    <circle cx="100" cy="101.5" r="2" fill="#cbd5e1" />

    {/* Content inside Monitor */}
    <rect x="52" y="44" width="96" height="8" rx="4" fill="#f1f5f9" />
    <circle cx="58" cy="48" r="2" fill="#94a3b8" />
    
    {/* Folder icon */}
    <rect x="72" y="60" width="22" height="16" rx="2" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth={1.5} />
    <path d="M72 64 H80 L83 67 H94" stroke="#3b82f6" strokeWidth={1.5} />
    
    {/* Magnifying Glass */}
    <circle cx="112" cy="70" r="10" stroke="#f59e0b" strokeWidth={2} />
    <line x1="119" y1="77" x2="129" y2="87" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" />

    {/* Sad doc with NO DATA */}
    <g transform="translate(130, 72)">
      <rect x="0" y="0" width="30" height="38" rx="3" fill="#ef4444" />
      <path d="M22 0 L30 8 V38 H0 V0 H22 Z" fill="#dc2626" />
      <path d="M22 0 V8 H30 L22 0 Z" fill="#fca5a5" />
      {/* Sad face lines */}
      <circle cx="10" cy="18" r="1.5" fill="#ffffff" />
      <circle cx="20" cy="18" r="1.5" fill="#ffffff" />
      <path d="M11 26 Q15 22 19 26" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" />
      {/* "NO DATA" text */}
      <rect x="4" y="30" width="22" height="5" rx="1" fill="#ffffff" />
      <text x="6" y="34" fontSize="4" fill="#ef4444" fontWeight="bold" fontFamily="sans-serif">NO DATA</text>
    </g>

    {/* Floating gear and files */}
    <circle cx="110" cy="22" r="5" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 1.5" />
    <rect x="25" y="55" width="12" height="16" rx="1" fill="#f97316" fillOpacity="0.2" stroke="#f97316" strokeWidth={1.2} />
    <circle cx="140" cy="35" r="7" fill="#f59e0b" />
    <path d="M137 35 H143 M140 32 V38" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" />
  </svg>
);

const getMemberId = (u: any) => (u && typeof u === "object" ? (u._id || u.id) : u);

export default function ResourceTab() {
  const { userProfile, setActiveTab, refreshProfile } = useAuth();
  const [subTab, setSubTab] = useState<ResourceSubTabType>("TÀI LIỆU KHÁC");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const isConnected = userProfile?.googleDriveIntegration?.isConnected;
  const driveEmail = userProfile?.googleDriveIntegration?.driveEmail;

  // Space management
  const [selectedSpace, setSelectedSpace] = useState<string>("personal");
  const [rooms, setRooms] = useState<any[]>([]);
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false);

  // Folder navigation history/stack
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);

  // File Preview Modal State (Embed preview)
  const [previewFile, setPreviewFile] = useState<Resource | null>(null);

  // Add Popover Dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Active menu id for three-dot menu on folder/file cards
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Dialog prompt state
  const [createFileDialog, setCreateFileDialog] = useState<{
    isOpen: boolean;
    type: "document" | "spreadsheet" | "presentation" | "folder" | "link";
    title: string;
    placeholder: string;
  } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFileLink, setNewFileLink] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Permissions & Sharing Modal States
  const [showShareModal, setShowShareModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [driveGeneralAccess, setDriveGeneralAccess] = useState<"restricted" | "company">("restricted");
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [savingPermissions, setSavingPermissions] = useState(false);

  // States for "Di chuyển đến thư mục" Modal
  const [moveTarget, setMoveTarget] = useState<Resource | null>(null);
  const [moveSpace, setMoveSpace] = useState<string>("personal");
  // moveFolderId = thư mục đang browse trong modal (cũng là đích cuối khi nhấn Đồng ý)
  const [moveFolderId, setMoveFolderId] = useState<string>("root");
  const [moveBreadcrumbs, setMoveBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [moveFolders, setMoveFolders] = useState<Resource[]>([]);
  const [loadingMoveFolders, setLoadingMoveFolders] = useState(false);
  const [showMoveSpaceDropdown, setShowMoveSpaceDropdown] = useState(false);
  const [moveSearchQuery, setMoveSearchQuery] = useState("");
  const [moveFilterTab, setMoveFilterTab] = useState<"Thành viên" | "Nhóm" | "Lĩnh vực">("Thành viên");

  // Drag-and-drop states
  const [dragSource, setDragSource] = useState<Resource | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Rename state (Google Drive)
  const [driveRenameTarget, setDriveRenameTarget] = useState<Resource | null>(null);
  const [driveRenameValue, setDriveRenameValue] = useState("");
  const [driveRenaming, setDriveRenaming] = useState(false);

  const [connectingGoogleDrive, setConnectingGoogleDrive] = useState(false);

  useEffect(() => {
    const handleGoogleDriveMessage = async (event: MessageEvent) => {
      const isAllowedOrigin =
        event.origin === window.location.origin ||
        event.origin.includes("localhost:") ||
        event.origin.includes("127.0.0.1:");
      if (!isAllowedOrigin) return;

      if (event.data?.type === "GOOGLE_DRIVE_CONNECTED") {
        toast.success(`Đã kết nối Google Drive cá nhân thành công!`);
        void refreshProfile();
        window.location.reload();
      } else if (event.data?.type === "GOOGLE_DRIVE_FAILED") {
        toast.error(event.data.error || "Kết nối Google Drive cá nhân thất bại.");
      }
    };
    window.addEventListener("message", handleGoogleDriveMessage);
    return () => window.removeEventListener("message", handleGoogleDriveMessage);
  }, [refreshProfile]);

  const handleGoogleDriveOAuth = async () => {
    setConnectingGoogleDrive(true);
    try {
      localStorage.removeItem("google_drive_oauth_result");
      const res = await fetch("/api/v1/integrations/google-drive/auth-url", {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể lấy link xác thực Google.");

      const authUrl = data.authUrl;
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const oauthWindow = window.open(
        authUrl,
        "GoogleDriveOAuthPopup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!oauthWindow) {
        throw new Error("Trình duyệt đang chặn cửa sổ popup. Vui lòng cho phép popup để kết nối.");
      }

      const checkInterval = setInterval(() => {
        if (oauthWindow.closed) {
          clearInterval(checkInterval);
          setConnectingGoogleDrive(false);
          // Polling check to automatically reload if connection succeeded
          setTimeout(async () => {
            try {
              const res = await fetch("/api/v1/auth/me", {
                headers: { Authorization: `Bearer ${getAccessToken()}` },
              });
              const data = await res.json();
              if (res.ok && data.user?.googleDriveIntegration?.isConnected) {
                toast.success(`Đã kết nối Google Drive cá nhân thành công!`);
                window.location.reload();
              }
            } catch (err) {
              console.error("Lỗi khi kiểm tra kết nối Google Drive:", err);
            }
          }, 600);
        }
      }, 800);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể kết nối Google Drive.");
      setConnectingGoogleDrive(false);
    }
  };

  const fetchMoveFolders = async (space: string, folderId: string) => {
    setLoadingMoveFolders(true);
    try {
      let url = `/api/v1/integrations/google-drive/resources?folderId=${folderId}`;
      if (space !== "personal") {
        url = `/api/v1/integrations/google-drive/resources/group/${space}?folderId=${folderId}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const list = (data.data || []).filter(
          (r: any) => r.mimeType === "application/vnd.google-apps.folder"
        );
        setMoveFolders(list);
      } else {
        setMoveFolders([]);
      }
    } catch (err) {
      console.error(err);
      setMoveFolders([]);
    } finally {
      setLoadingMoveFolders(false);
    }
  };

  // Thực hiện di chuyển tài nguyên (dùng cho cả modal và drag-drop)
  const executeMoveResource = async (resource: Resource, destFolderDriveId: string, destSpace: string) => {
    try {
      const res = await fetch("/api/v1/integrations/google-drive/resources/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          fileId: resource._id,
          newParentId: destFolderDriveId,
          spaceType: destSpace === "personal" ? "personal" : "group",
          roomId: destSpace !== "personal" ? destSpace : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Di chuyển thất bại.");
      toast.success(`Đã di chuyển "${resource.name}" thành công!`);
      void fetchResources();
    } catch (err: any) {
      toast.error(err.message || "Lỗi di chuyển tài nguyên.");
    }
  };

  const handleConfirmMove = async () => {
    if (!moveTarget) return;
    // moveFolderId hiện tại là driveFileId của thư mục đang browse (= thư mục đích)
    await executeMoveResource(moveTarget, moveFolderId, moveSpace);
    setMoveTarget(null);
  };

  // Hàm đổi tên tài nguyên Google Drive
  const handleDriveRename = async () => {
    if (!driveRenameTarget) return;
    const name = driveRenameValue.trim();
    if (!name || name === driveRenameTarget.name) {
      setDriveRenameTarget(null);
      return;
    }
    setDriveRenaming(true);
    try {
      const res = await fetch(`/api/v1/integrations/google-drive/resources/${driveRenameTarget._id}/rename`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Đổi tên thất bại.");
      toast.success(`Đã đổi tên thành "${name}"!`);
      setDriveRenameTarget(null);
      void fetchResources();
    } catch (err: any) {
      toast.error(err.message || "Lỗi đổi tên tài nguyên.");
    } finally {
      setDriveRenaming(false);
    }
  };

  // Drag-drop handlers
  const handleDragStart = (e: React.DragEvent, resource: Resource) => {
    setDragSource(resource);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", resource._id);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOverFolderId(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, folder: Resource) => {
    e.preventDefault();
    setDragOverFolderId(null);
    if (!dragSource) return;
    if (dragSource._id === folder._id) return; // can't drop into itself
    await executeMoveResource(dragSource, folder.driveFileId, selectedSpace);
    setDragSource(null);
  };

  useEffect(() => {
    if (moveTarget) {
      // Khi mở modal, browse từ thư mục gốc của space đích
      const rootId = moveSpace === "personal"
        ? (userProfile?.googleDriveIntegration?.rootFolderId || "root")
        : (rooms.find(r => r._id === moveSpace)?.driveFolderId || "root");
      void fetchMoveFolders(moveSpace, rootId);
    }
  }, [moveSpace, moveFolderId, moveTarget]);

  // Generate initials for circles
  const getInitials = (name: string) => {
    if (!name) return "";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
  };

  // Generate badge color
  const getBadgeColor = (name: string) => {
    const colors = [
      "bg-blue-500 text-white",
      "bg-emerald-500 text-white",
      "bg-indigo-500 text-white",
      "bg-amber-500 text-white",
      "bg-rose-500 text-white",
      "bg-teal-500 text-white",
      "bg-violet-500 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const fetchRooms = async () => {
    try {
      const data = await internalChatService.getRooms();
      setRooms(data.filter((r: any) => r.isGroup));
    } catch (err) {
      console.error("Lỗi lấy danh sách phòng chat:", err);
    }
  };

  const fetchResources = async () => {
    if (selectedSpace === "personal" && !isConnected) return;
    setLoading(true);
    try {
      let url = `/api/v1/integrations/google-drive/resources?folderId=${currentFolderId}`;
      if (selectedSpace !== "personal") {
        url = `/api/v1/integrations/google-drive/resources/group/${selectedSpace}?folderId=${currentFolderId}`;
      }
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải danh sách tài nguyên.");
      
      setResources(data.data || []);

      if (selectedSpace !== "personal") {
        setDriveGeneralAccess(data.driveGeneralAccess || "restricted");
        setRoomMembers(data.members || []);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi tải danh sách tài nguyên.");
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset folder position when switching space
  useEffect(() => {
    setCurrentFolderId("root");
    setBreadcrumbs([]);
  }, [selectedSpace]);

  // Refetch when folder level changes or space changes
  useEffect(() => {
    if (subTab === "GOOGLE DRIVE") {
      void fetchRooms();
      void fetchResources();
    }
  }, [isConnected, subTab, selectedSpace, currentFolderId]);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSpaceDropdown(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
      if (activeMenuId && !(event.target as HTMLElement).closest('.card-menu-container')) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenuId]);

  // Check upload permission
  const canUpload = () => {
    if (selectedSpace === "personal") {
      return !!isConnected;
    }
    const isAdmin = ["admin", "superadmin"].includes(userProfile?.role || "");
    const room = rooms.find(r => r._id === selectedSpace);
    if (!room) return false;

    const memberInfo = room.members.find(
      (m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id)
    );
    const isRoomAdmin = memberInfo?.role === "admin";
    const isCreator = String(room.creatorId) === String(userProfile?.uid || userProfile?.id);
    const isUploader = memberInfo?.canUploadDrive === true;

    return isAdmin || isRoomAdmin || isCreator || isUploader;
  };

  // Check manage permissions permission
  const canManagePermissions = () => {
    if (selectedSpace === "personal") return false;
    const isAdmin = ["admin", "superadmin"].includes(userProfile?.role || "");
    const room = rooms.find(r => r._id === selectedSpace);
    if (!room) return false;

    const memberInfo = room.members.find(
      (m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id)
    );
    const isRoomAdmin = memberInfo?.role === "admin";
    const isCreator = String(room.creatorId) === String(userProfile?.uid || userProfile?.id);

    return isAdmin || isRoomAdmin || isCreator;
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      const payload = {
        driveGeneralAccess,
        members: roomMembers.map((m: any) => ({
          userId: m.userId?._id || m.userId,
          canUploadDrive: !!m.canUploadDrive
        }))
      };

      const res = await fetch(`/api/v1/integrations/google-drive/groups/${selectedSpace}/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cập nhật phân quyền thất bại.");
      
      toast.success("Cập nhật phân quyền thành công!");
      setShowShareModal(false);
      void fetchResources();
      void fetchRooms();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi lưu cấu hình phân quyền.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleCreateFile = async () => {
    if (!createFileDialog) return;
    const name = newFileName.trim();
    if (!name) {
      toast.warning("Vui lòng nhập tên.");
      return;
    }
    if (createFileDialog.type === "link" && !newFileLink.trim()) {
      toast.warning("Vui lòng nhập đường link.");
      return;
    }

    setCreatingFile(true);
    try {
      const payload = {
        spaceType: selectedSpace === "personal" ? "personal" : "group",
        roomId: selectedSpace !== "personal" ? selectedSpace : undefined,
        type: createFileDialog.type,
        name,
        linkUrl: createFileDialog.type === "link" ? newFileLink.trim() : undefined,
        folderId: currentFolderId
      };

      const res = await fetch("/api/v1/integrations/google-drive/create-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tạo tài nguyên thất bại.");

      toast.success("Đã tạo tài nguyên mới thành công.");
      setCreateFileDialog(null);
      setNewFileName("");
      setNewFileLink("");
      void fetchResources();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Có lỗi xảy ra khi tạo tài nguyên.");
    } finally {
      setCreatingFile(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIconDetails = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return { Icon: ImageIcon, iconColor: "text-emerald-500" };
    }
    if (mimeType.startsWith("video/")) {
      return { Icon: VideoIcon, iconColor: "text-blue-500" };
    }
    if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
      return { Icon: FileText, iconColor: "text-orange-500" };
    }
    return { Icon: FileIcon, iconColor: "text-gray-400" };
  };

  const handleFileUpload = async (file: File) => {
    if (!canUpload()) {
      toast.error("Bạn không có quyền tải lên thư mục này.");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        
        let url = "/api/v1/integrations/google-drive/upload";
        if (selectedSpace !== "personal") {
          url = `/api/v1/integrations/google-drive/upload/group/${selectedSpace}`;
        }

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            file: base64String,
            name: file.name,
            mimeType: file.type,
            folderId: currentFolderId
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

  // Navigate folder helper
  const handleResourceClick = (resource: Resource) => {
    if (resource.mimeType === "application/vnd.google-apps.folder") {
      setCurrentFolderId(resource.driveFileId);
      setBreadcrumbs((prev) => [...prev, { id: resource.driveFileId, name: resource.name }]);
    } else {
      setPreviewFile(resource);
    }
  };

  // Filtered resources by search input
  const filteredResources = resources.filter((res) =>
    res.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderResourceCard = (resource: Resource, index: number) => {
    const isFolder = resource.mimeType === "application/vnd.google-apps.folder";
    const isCreatorOrAdmin = ["admin", "superadmin"].includes(userProfile?.role || "");
    const room = selectedSpace !== "personal" ? rooms.find(r => r._id === selectedSpace) : null;
    const isRoomAdmin = room && room.members.find((m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id))?.role === "admin";
    
    // Check if the current user has edit permission for this space
    const canEdit = (() => {
      if (selectedSpace === "personal") return !!isConnected;
      if (isCreatorOrAdmin) return true;
      if (!room) return false;
      const memberInfo = room.members.find(
        (m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id)
      );
      const isRoomAdmin = memberInfo?.role === "admin";
      const isCreator = String(room.creatorId) === String(userProfile?.uid || userProfile?.id);
      const isUploader = memberInfo?.canUploadDrive === true;
      return isRoomAdmin || isCreator || isUploader;
    })();

    const canDelete = selectedSpace === "personal" || isCreatorOrAdmin || isRoomAdmin || (room && room.members.find((m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id))?.canUploadDrive === true);

    const { Icon, iconColor } = isFolder 
      ? { Icon: FolderOpen, iconColor: "text-[#5bc0be]" } 
      : getFileIconDetails(resource.mimeType);

    const isMenuOpen = activeMenuId === resource._id;
    const isDraggedOver = isFolder && dragOverFolderId === resource._id;
    const isDragging = dragSource?._id === resource._id;

    return (
      <div
        key={`${resource._id}-${index}`}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, resource)}
        onDragEnd={handleDragEnd}
        onDragOver={isFolder ? (e) => handleFolderDragOver(e, resource._id) : undefined}
        onDragLeave={isFolder ? handleFolderDragLeave : undefined}
        onDrop={isFolder ? (e) => handleFolderDrop(e, resource) : undefined}
        onDoubleClick={() => handleResourceClick(resource)}
        className={`group relative flex flex-col items-center justify-between border rounded-2xl p-4 transition duration-150 select-none cursor-pointer text-center w-36 h-40 shadow-none ${
          isDragging
            ? "opacity-40 scale-95 bg-slate-100 border-slate-300"
            : isDraggedOver
              ? "bg-teal-50 border-teal-300 border-dashed scale-105 shadow-md shadow-teal-200"
              : "bg-transparent hover:bg-slate-100 border-transparent hover:border-slate-200/50 hover:shadow-xs"
        }`}
      >
        {/* Three-dot menu button */}
        {canEdit && (
          <div className={`absolute top-2 right-2 card-menu-container z-10 transition-opacity duration-150 ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(isMenuOpen ? null : resource._id);
              }}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-xs border border-slate-200/40 transition active:scale-90 cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute left-2 top-9 mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-20 text-left">
                {/* Đổi tên */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    setDriveRenameTarget(resource);
                    setDriveRenameValue(resource.name);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Pencil className="h-4 w-4 text-slate-500" />
                  <span>Đổi tên</span>
                </button>

                {/* Di chuyển đến thư mục */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    // Mở modal, browse từ thư mục gốc của space hiện tại
                    const rootId = selectedSpace === "personal"
                      ? (userProfile?.googleDriveIntegration?.rootFolderId || "root")
                      : (rooms.find(r => r._id === selectedSpace)?.driveFolderId || "root");
                    setMoveTarget(resource);
                    setMoveSpace(selectedSpace);
                    setMoveFolderId(rootId);
                    setMoveBreadcrumbs([]);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <ArrowRightLeft className="h-4 w-4 text-slate-500" />
                  <span>Di chuyển đến thư mục</span>
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                {/* Chuyển vào thùng rác */}
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(null);
                      handleDeleteResource(resource._id, resource.name);
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
        )}

        {/* Drag-over overlay for folders */}
        {isDraggedOver && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10">
            <div className="bg-teal-500/10 rounded-2xl absolute inset-0"></div>
            <span className="text-teal-600 font-bold text-[10px] relative z-10 bg-white rounded-xl px-2 py-1 shadow-sm border border-teal-300">
              Thả vào đây
            </span>
          </div>
        )}

        {/* Center Icon */}
        <div className="flex-1 flex items-center justify-center mt-3">
          {isFolder && resource.name.toUpperCase().includes("GOOGLE") ? (
            <div className="relative">
              <FolderOpen className="h-16 w-16 text-[#5bc0be]" strokeWidth={1.5} />
              <div className="absolute inset-0 flex items-center justify-center mt-2.5">
                <GoogleDriveLogo className="h-5 w-5 bg-white rounded-full p-0.5" />
              </div>
            </div>
          ) : (
            <Icon className={`h-16 w-16 ${iconColor}`} strokeWidth={1.5} />
          )}
        </div>

        {/* Card Name */}
        <div className="mt-auto w-full pt-2">
          <p className="text-[13px] font-bold text-slate-800 truncate px-0.5" title={resource.name}>
            {resource.name}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full -mx-5 -my-5 overflow-hidden bg-[#f8f9fa]">
      {/* Left Vertical Sub-tab Switcher */}
      <div className="w-20 border-r border-slate-200 bg-slate-100 flex flex-col items-center py-8 gap-6 shrink-0">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setSubTab(tab.value)}
              className={`p-3.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                active 
                  ? "bg-white text-blue-600 shadow-md border border-slate-200/50 scale-105" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              }`}
              title={tab.label}
            >
              {tab.value === "GOOGLE DRIVE" ? (
                <GoogleDriveLogo className="h-7 w-7" />
              ) : (
                <Icon className="h-7 w-7" />
              )}
            </button>
          );
        })}
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {subTab === "TÀI LIỆU KHÁC" ? (
          <div className="flex-1 overflow-y-auto p-6 text-left">
            <FileExplorer />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Row matching user screenshot */}
            <div className="h-20 px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              {/* Space Dropdown Selector on Left */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600">Tài liệu của</span>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
                    className="flex items-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 transition duration-150 text-sm font-bold text-slate-700 cursor-pointer shadow-xs"
                  >
                    {/* Badge */}
                    {selectedSpace === "personal" ? (
                      <img
                        src={userProfile?.photoURL || "https://www.gravatar.com/avatar?d=mp"}
                        alt={userProfile?.displayName}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getBadgeColor(rooms.find(r => r._id === selectedSpace)?.name || "")}`}>
                        {getInitials(rooms.find(r => r._id === selectedSpace)?.name || "")}
                      </div>
                    )}
                    
                    <span>
                      {selectedSpace === "personal" 
                        ? (userProfile?.displayName ? `${userProfile.displayName} (Tôi)` : "Cá nhân")
                        : (rooms.find(r => r._id === selectedSpace)?.name || "Nhóm chung")
                      }
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showSpaceDropdown ? "rotate-180" : ""}`} />
                  </button>

                  {showSpaceDropdown && (
                    <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn max-h-[300px] overflow-y-auto">
                      <div className="text-[10px] text-slate-400 font-semibold px-2.5 py-1 uppercase tracking-wider text-left">Không gian lưu trữ</div>
                      <button
                        onClick={() => {
                          setSelectedSpace("personal");
                          setShowSpaceDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition ${
                          selectedSpace === "personal" 
                            ? "bg-blue-50 text-blue-600" 
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <img
                          src={userProfile?.photoURL || "https://www.gravatar.com/avatar?d=mp"}
                          alt={userProfile?.displayName}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                        <span className="truncate">{userProfile?.displayName ? `${userProfile.displayName} (Tôi)` : "Cá nhân"}</span>
                      </button>
                      
                      {rooms.length > 0 && (
                        <>
                          <div className="border-t border-slate-100 my-1.5"></div>
                          <div className="text-[10px] text-slate-400 font-semibold px-2.5 py-1 uppercase tracking-wider text-left">Nhóm chung (Chat)</div>
                          {rooms.map((room) => {
                            const isSelected = selectedSpace === room._id;
                            return (
                              <button
                                key={room._id}
                                onClick={() => {
                                  setSelectedSpace(room._id);
                                  setShowSpaceDropdown(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition ${
                                  isSelected 
                                    ? "bg-blue-50 text-blue-600" 
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getBadgeColor(room.name || "")}`}>
                                  {getInitials(room.name || "")}
                                </div>
                                <span className="truncate">{room.name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions & Search on Right */}
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                {!(selectedSpace === "personal" && !isConnected) && (
                  <div className="relative w-72">
                    <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-semibold"
                    />
                  </div>
                )}

                {/* Manage Permissions Share Button */}
                {canManagePermissions() && (
                  <button
                    onClick={() => {
                      setShareSearchQuery("");
                      setShowShareModal(true);
                    }}
                    className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 border border-gray-200 transition active:scale-95 bg-white flex items-center justify-center h-10 w-10"
                    title="Quản lý phân quyền"
                  >
                    <Share2 className="h-4.5 w-4.5" />
                  </button>
                )}

                {/* Reload button */}
                <button
                  onClick={fetchResources}
                  disabled={loading}
                  className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-800 transition active:scale-95 border border-slate-200 bg-white flex items-center justify-center h-10 w-10"
                  title="Làm mới"
                >
                  <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`} />
                </button>

                {/* Popover Add Button */}
                {canUpload() && (
                  <div className="relative" ref={addMenuRef}>
                    <button
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      className="p-2.5 bg-[#008080] hover:bg-[#006666] text-white rounded-xl transition duration-150 active:scale-95 shadow-md shadow-teal-500/10 flex items-center justify-center h-10 w-10 cursor-pointer"
                      title="Thêm mới"
                    >
                      <Plus className="h-4.5 w-4.5" />
                    </button>

                    {showAddMenu && (
                      <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn text-left">
                        <button
                          onClick={() => {
                            setCreateFileDialog({
                              isOpen: true,
                              type: "document",
                              title: "Thêm Google Tài liệu mới",
                              placeholder: "Nhập tên tài liệu..."
                            });
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
                        >
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>Thêm Google Tài liệu</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setCreateFileDialog({
                              isOpen: true,
                              type: "spreadsheet",
                              title: "Thêm Google Trang tính mới",
                              placeholder: "Nhập tên trang tính..."
                            });
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                          <span>Thêm Google Trang tính</span>
                        </button>

                        <button
                          onClick={() => {
                            setCreateFileDialog({
                              isOpen: true,
                              type: "presentation",
                              title: "Thêm Google Trang trình bày mới",
                              placeholder: "Nhập tên trang trình bày..."
                            });
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
                        >
                          <Presentation className="h-4 w-4 text-amber-500" />
                          <span>Thêm Google Trang trình bày</span>
                        </button>

                        <div className="border-t border-slate-100 my-1"></div>

                        <button
                          onClick={() => {
                            setCreateFileDialog({
                              isOpen: true,
                              type: "link",
                              title: "Thêm tài nguyên từ liên kết có sẵn",
                              placeholder: "Nhập tên hiển thị..."
                            });
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
                        >
                          <LinkIcon className="h-4 w-4 text-indigo-500" />
                          <span>Thêm từ đường link có sẵn</span>
                        </button>

                        <button
                          onClick={() => {
                            setCreateFileDialog({
                              isOpen: true,
                              type: "folder",
                              title: "Thêm thư mục mới",
                              placeholder: "Nhập tên thư mục..."
                            });
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
                        >
                          <FolderPlus className="h-4 w-4 text-teal-600" />
                          <span>Thêm thư mục</span>
                        </button>

                        <div className="border-t border-slate-100 my-1"></div>

                        <button
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowAddMenu(false);
                          }}
                          disabled={uploading}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                          ) : (
                            <Upload className="h-4 w-4 text-slate-500" />
                          )}
                          <span>Tải tệp tin từ máy tính</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Breadcrumbs Navigation Row matching screenshot 3 */}
            {!(selectedSpace === "personal" && !isConnected) && (
              <div className="h-12 px-8 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 text-slate-500 flex-wrap text-left">
                  {breadcrumbs.length > 0 && (
                    <button
                      onClick={() => {
                        const newBcs = [...breadcrumbs];
                        newBcs.pop();
                        setBreadcrumbs(newBcs);
                        setCurrentFolderId(newBcs.length === 0 ? "root" : newBcs[newBcs.length - 1].id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 transition mr-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 cursor-pointer"
                    >
                      <span>← Quay lại</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setBreadcrumbs([]);
                      setCurrentFolderId("root");
                    }}
                    className={`text-sm font-bold transition hover:text-slate-800 ${
                      currentFolderId === "root" ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {selectedSpace === "personal" 
                      ? (userProfile?.displayName || "Cá nhân") 
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Nhóm chung")
                    }
                  </button>

                  {breadcrumbs.map((bc, idx) => (
                    <React.Fragment key={bc.id}>
                      <span className="text-slate-300 mx-1.5 text-sm">/</span>
                      <button
                        onClick={() => {
                          const index = breadcrumbs.findIndex(x => x.id === bc.id);
                          const newBcs = breadcrumbs.slice(0, index + 1);
                          setBreadcrumbs(newBcs);
                          setCurrentFolderId(bc.id);
                        }}
                        className={`text-sm font-bold transition hover:text-slate-800 ${
                          idx === breadcrumbs.length - 1 ? "text-slate-800" : "text-slate-400"
                        }`}
                      >
                        {bc.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Main content container */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {(selectedSpace === "personal" && !isConnected) ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white/50 border border-dashed border-gray-200 rounded-3xl p-10 max-w-xl mx-auto mt-10">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-blue-600 mb-4 shadow-inner">
                    <HardDrive className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800">Chưa kết nối Google Drive</h3>
                  <p className="text-xs text-gray-500 max-w-sm text-center mt-2 leading-relaxed">
                    Nhân viên cần liên kết với tài khoản Google cá nhân của mình để kích hoạt không gian lưu trữ tài nguyên riêng biệt.
                  </p>
                  <button
                    onClick={handleGoogleDriveOAuth}
                    disabled={connectingGoogleDrive}
                    className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all duration-150 cursor-pointer disabled:opacity-60"
                  >
                    {connectingGoogleDrive ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Đang kết nối...</span>
                      </>
                    ) : (
                      <>
                        <span>Kết nối Google Drive cá nhân ngay</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Drag & Drop Area */}
                 

                  {/* Resource Grid / Empty State */}
                  {loading && filteredResources.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                      <RefreshCw className="h-8 w-8 animate-spin text-[#008080]" />
                      <p className="text-xs text-gray-500 mt-2 font-medium">Đang tải tài nguyên...</p>
                    </div>
                  ) : filteredResources.length === 0 ? (
                    /* Empty State exactly matching user screenshot */
                    <div className="flex-1 flex flex-col items-center justify-center py-16">
                      <EmptyStateIllustration />
                      <p className="text-base font-bold text-slate-700 mt-6">Không có tài liệu nào</p>
                      
                      {canUpload() && (
                        <div className="relative">
                          <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 bg-[#008080] hover:bg-[#006666] text-white rounded-xl text-sm font-bold shadow-md shadow-teal-500/10 transition duration-150 active:scale-95 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Thêm mới</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Grid Layout - Cards matching folder screenshot style */
                    <div className="flex flex-wrap gap-4 pb-32">
                      {/* Thư mục trước */}
                      {filteredResources
                        .filter((r) => r.mimeType === "application/vnd.google-apps.folder")
                        .map((resource, idx) => renderResourceCard(resource, idx))}
                      
                      {/* Tệp sau */}
                      {filteredResources
                        .filter((r) => r.mimeType !== "application/vnd.google-apps.folder")
                        .map((resource, idx) => {
                          const foldersCount = filteredResources.filter(
                            (r) => r.mimeType === "application/vnd.google-apps.folder"
                          ).length;
                          return renderResourceCard(resource, foldersCount + idx);
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Google Drive File Inline Preview Embed Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 h-[85vh] text-left">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-150 bg-slate-50/50">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="text-sm font-bold text-gray-800 truncate max-w-lg">{previewFile.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {previewFile.webContentLink && (
                  <a
                    href={previewFile.webContentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition bg-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Tải về</span>
                  </a>
                )}
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-gray-200 rounded-xl text-gray-500 hover:text-gray-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative">
              <iframe
                src={
                  previewFile.mimeType.includes("google-apps") 
                    ? `${previewFile.webViewLink.replace("/edit", "/preview").replace("/view", "/preview")}`
                    : `https://drive.google.com/file/d/${previewFile.driveFileId}/preview`
                }
                className="w-full h-full border-0 rounded-2xl bg-white shadow-sm"
                allow="autoplay"
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Create Document/Folder Modal Dialog */}
      {createFileDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-slate-100 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                {createFileDialog.type === "document" && <FileText className="h-6 w-6" />}
                {createFileDialog.type === "spreadsheet" && <FileSpreadsheet className="h-6 w-6" />}
                {createFileDialog.type === "presentation" && <Presentation className="h-6 w-6" />}
                {createFileDialog.type === "folder" && <FolderPlus className="h-6 w-6" />}
                {createFileDialog.type === "link" && <LinkIcon className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{createFileDialog.title}</h3>
                <p className="text-[10px] text-slate-400">Tạo tài nguyên trực tiếp trên Google Drive</p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={createFileDialog.placeholder}
                className="w-full text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-semibold"
                autoFocus
              />
              {createFileDialog.type === "link" && (
                <input
                  type="text"
                  value={newFileLink}
                  onChange={(e) => setNewFileLink(e.target.value)}
                  placeholder="Dán đường dẫn link (General link hoặc Google Drive link)..."
                  className="w-full text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-semibold"
                />
              )}
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  setCreateFileDialog(null);
                  setNewFileName("");
                  setNewFileLink("");
                }}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition active:scale-95"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateFile}
                disabled={creatingFile || !newFileName.trim() || (createFileDialog.type === "link" && !newFileLink.trim())}
                className="flex-1 rounded-xl bg-[#008080] py-2.5 text-xs font-bold text-white hover:bg-[#006666] transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5"
              >
                {creatingFile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / Permission configuration Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-blue-600" />
                  Chia sẻ "{rooms.find(r => r._id === selectedSpace)?.name || "Nhóm"}"
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Quản lý quyền truy cập thư mục Google Drive của nhóm</p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-800 transition active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* General Access Configuration */}
            <div className="p-5 border-b border-gray-100 bg-slate-50/50">
              <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-gray-500" />
                Quyền truy cập chung
              </h4>
              <div className="flex items-center justify-between bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl mt-0.5">
                    {driveGeneralAccess === "company" ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-800">
                      {driveGeneralAccess === "company" ? "Mở rộng doanh nghiệp" : "Hạn chế"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                      {driveGeneralAccess === "company"
                        ? "Bất kỳ thành viên nào trong doanh nghiệp cũng có thể xem thư mục này."
                        : "Chỉ những thành viên trong phòng chat mới có quyền truy cập."}
                    </p>
                  </div>
                </div>
                <select
                  value={driveGeneralAccess}
                  onChange={(e) => setDriveGeneralAccess(e.target.value as "restricted" | "company")}
                  className="text-xs font-bold text-gray-700 bg-slate-100 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="restricted">Hạn chế</option>
                  <option value="company">Mở rộng doanh nghiệp</option>
                </select>
              </div>
            </div>

            {/* List of members */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-gray-500" />
                  Thành viên có quyền truy cập
                </h4>
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm thành viên..."
                    value={shareSearchQuery}
                    onChange={(e) => setShareSearchQuery(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-gray-200/80 rounded-xl pl-8 pr-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                {roomMembers
                  .filter((member: any) => {
                    const name = member.userId?.displayName || "";
                    return name.toLowerCase().includes(shareSearchQuery.toLowerCase());
                  })
                  .map((member: any) => {
                    const isOwner = String(rooms.find(r => r._id === selectedSpace)?.creatorId) === String(getMemberId(member.userId));
                    const isMe = String(getMemberId(member.userId)) === String(userProfile?.uid || userProfile?.id);
                    
                    return (
                      <div key={String(getMemberId(member.userId))} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={member.userId?.photoURL || "https://www.gravatar.com/avatar?d=mp"}
                            alt={member.userId?.displayName}
                            className="h-8 w-8 rounded-full object-cover bg-slate-100"
                          />
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-gray-800 truncate">
                              {member.userId?.displayName} {isMe && <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1 rounded-sm">Tôi</span>}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">{member.userId?.email}</p>
                          </div>
                        </div>

                        {isOwner ? (
                          <span className="text-[10px] font-bold text-gray-400 px-3 py-1.5 bg-slate-100 rounded-xl">Chủ sở hữu</span>
                        ) : (
                          <select
                            value={member.canUploadDrive ? "uploader" : "viewer"}
                            onChange={(e) => {
                              const updatedVal = e.target.value === "uploader";
                              setRoomMembers((prev: any[]) =>
                                prev.map((m: any) =>
                                  String(getMemberId(m.userId)) === String(getMemberId(member.userId))
                                    ? { ...m, canUploadDrive: updatedVal }
                                    : m
                                )
                              );
                            }}
                            className="text-[10px] font-bold text-gray-700 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                          >
                            <option value="viewer">Người xem</option>
                            <option value="uploader">Người chỉnh sửa</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-white text-gray-700 rounded-xl text-xs font-bold transition active:scale-95 bg-white"
              >
                Hủy
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={savingPermissions}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-55"
              >
                {savingPermissions ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Lưu cài đặt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal di chuyển tài nguyên */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-slate-800">Chọn thư mục</span>
                
                {/* Space Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoveSpaceDropdown(!showMoveSpaceDropdown)}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-xl px-3 py-1.5 transition text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <span className="h-5 w-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold">
                      {(() => {
                        const spaceName = moveSpace === "personal"
                          ? (userProfile?.displayName || "Cá nhân")
                          : (rooms.find(r => r._id === moveSpace)?.name || "Nhóm");
                        return spaceName.split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();
                      })()}
                    </span>
                    <span>
                      {moveSpace === "personal"
                        ? (userProfile?.displayName ? `${userProfile.displayName} (Tôi)` : "Cá nhân")
                        : (rooms.find(r => r._id === moveSpace)?.name || "Nhóm chung")
                      }
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-500" />
                  </button>

                  {showMoveSpaceDropdown && (
                    <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 animate-fadeIn max-h-[300px] overflow-y-auto">
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm"
                          value={moveSearchQuery}
                          onChange={(e) => setMoveSearchQuery(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium"
                        />
                      </div>

                      {/* Filter Pills */}
                      <div className="flex gap-1 mb-2 border-b border-slate-100 pb-1.5">
                        {["Thành viên", "Nhóm", "Lĩnh vực"].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setMoveFilterTab(tab as any)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                              moveFilterTab === tab 
                                ? "bg-[#008080] text-white" 
                                : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        {moveFilterTab === "Thành viên" && (
                          <button
                            onClick={() => {
                              setMoveSpace("personal");
                              setMoveFolderId(userProfile?.googleDriveIntegration?.rootFolderId || "root");
                              setMoveBreadcrumbs([]);
                              setShowMoveSpaceDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-semibold transition ${
                              moveSpace === "personal" ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold">
                              {userProfile?.displayName?.split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase() || "NT"}
                            </span>
                            <span className="truncate">{userProfile?.displayName ? `${userProfile.displayName} (Tôi)` : "Cá nhân"}</span>
                          </button>
                        )}

                        {(moveFilterTab === "Nhóm" || moveFilterTab === "Lĩnh vực") && (
                          rooms
                            .filter(r => r.name.toLowerCase().includes(moveSearchQuery.toLowerCase()))
                            .map((room) => (
                              <button
                                key={room._id}
                                onClick={() => {
                                  setMoveSpace(room._id);
                                  setMoveFolderId(room.driveFolderId || "root");
                                  setMoveBreadcrumbs([]);
                                  setShowMoveSpaceDropdown(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-semibold transition ${
                                  moveSpace === room._id ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getBadgeColor(room.name)}`}>
                                  {getInitials(room.name)}
                                </span>
                                <span className="truncate">{room.name}</span>
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Create new folder button inside destination */}
                <button
                  onClick={async () => {
                    const folderName = prompt("Nhập tên thư mục mới cần tạo:");
                    if (!folderName?.trim()) return;
                    try {
                      const res = await fetch("/api/v1/integrations/google-drive/create-file", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${getAccessToken()}`,
                        },
                        body: JSON.stringify({
                          spaceType: moveSpace === "personal" ? "personal" : "group",
                          roomId: moveSpace !== "personal" ? moveSpace : undefined,
                          type: "folder",
                          name: folderName.trim(),
                          folderId: moveFolderId
                        }),
                      });
                      if (!res.ok) throw new Error("Không thể tạo thư mục.");
                      toast.success(`Đã tạo thư mục "${folderName}"!`);
                      void fetchMoveFolders(moveSpace, moveFolderId);
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-[#008080] border border-slate-200 transition cursor-pointer"
                  title="Tạo thư mục mới tại đây"
                >
                  <FolderPlus className="h-5 w-5" />
                </button>

                <button
                  onClick={() => setMoveTarget(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Browsing list of folders */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 min-h-[300px]">
              {/* Breadcrumb path for move destination */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-4 flex-wrap bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-inner">
                <span className="font-bold text-slate-700">Đang ở:</span>
                <button
                  onClick={() => {
                    const rootId = moveSpace === "personal"
                      ? (userProfile?.googleDriveIntegration?.rootFolderId || "root")
                      : (rooms.find(r => r._id === moveSpace)?.driveFolderId || "root");
                    setMoveFolderId(rootId);
                    setMoveBreadcrumbs([]);
                  }}
                  className="hover:underline font-bold text-slate-800 cursor-pointer"
                >
                  {moveSpace === "personal" ? "Cá nhân" : (rooms.find(r => r._id === moveSpace)?.name || "Nhóm")}
                </button>
                {moveBreadcrumbs.map((bc, idx) => (
                  <React.Fragment key={bc.id}>
                    <span className="text-slate-300">/</span>
                    <button
                      onClick={() => {
                        const index = moveBreadcrumbs.findIndex(x => x.id === bc.id);
                        setMoveBreadcrumbs(moveBreadcrumbs.slice(0, index + 1));
                        setMoveFolderId(bc.id);
                      }}
                      className={`hover:underline font-semibold cursor-pointer ${
                        idx === moveBreadcrumbs.length - 1 ? "text-slate-800 font-bold" : "text-slate-500"
                      }`}
                    >
                      {bc.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {loadingMoveFolders ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
                  <p className="text-xs text-gray-500 mt-2">Đang tải danh sách thư mục...</p>
                </div>
              ) : moveFolders.filter(f => f.driveFileId !== moveTarget?.driveFileId).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <FolderOpen className="h-14 w-14 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Thư mục này không có thư mục con.</p>
                  <p className="text-[10px] mt-1">Nhấn "Đồng ý" để di chuyển vào đây.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 pb-4">
                  {moveFolders
                    .filter(f => f.driveFileId !== moveTarget?.driveFileId)
                    .map((folder) => {
                      const isSelected = moveFolderId === folder.driveFileId;
                      return (
                        <div
                          key={folder.driveFileId}
                          onClick={() => {
                            // Single click: chọn thư mục này làm đích
                            setMoveFolderId(folder.driveFileId);
                          }}
                          onDoubleClick={() => {
                            // Double click: đi vào thư mục con
                            setMoveFolderId(folder.driveFileId);
                            setMoveBreadcrumbs(prev => [...prev, { id: folder.driveFileId, name: folder.name }]);
                          }}
                          className={`group relative flex flex-col items-center justify-center border rounded-2xl p-4 transition cursor-pointer text-center w-28 h-28 shadow-xs select-none ${
                            isSelected
                              ? "bg-teal-50 border-teal-400 ring-2 ring-teal-400/40"
                              : "bg-white hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-teal-500 flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            </div>
                          )}
                          <FolderOpen className={`h-10 w-10 ${isSelected ? "text-teal-500" : "text-[#5bc0be]"}`} strokeWidth={1.5} />
                          <p className="text-[11px] font-bold text-slate-800 truncate w-full mt-2 px-1" title={folder.name}>
                            {folder.name}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Nhấn đúp để mở</p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 truncate max-w-[60%] text-left">
                Di chuyển <span className="font-bold text-slate-800">"{moveTarget?.name}"</span> đến{" "}
                <span className="font-bold text-[#008080]">
                  {moveBreadcrumbs.length === 0
                    ? (moveSpace === "personal" ? "Thư mục gốc" : (rooms.find(r => r._id === moveSpace)?.name || "Thư mục gốc"))
                    : moveBreadcrumbs[moveBreadcrumbs.length - 1].name}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setMoveTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmMove}
                  className="px-4 py-2 bg-[#008080] hover:bg-[#006666] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đổi tên Google Drive */}
      {driveRenameTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => !driveRenaming && setDriveRenameTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 shrink-0">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Đổi tên</h3>
                <p className="text-xs text-slate-400 truncate max-w-[220px]" title={driveRenameTarget.name}>
                  {driveRenameTarget.name}
                </p>
              </div>
            </div>

            {/* Input */}
            <input
              autoFocus
              value={driveRenameValue}
              onChange={(e) => setDriveRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleDriveRename();
                if (e.key === "Escape") setDriveRenameTarget(null);
              }}
              placeholder="Nhập tên mới..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800 font-medium"
            />

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDriveRenameTarget(null)}
                disabled={driveRenaming}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleDriveRename()}
                disabled={!driveRenameValue.trim() || driveRenaming}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {driveRenaming && <Loader2 className="w-4 h-4 animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
