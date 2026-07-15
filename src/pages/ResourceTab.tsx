import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  FolderOpen, Folder, CloudUpload, Trash2, Eye, Download, HardDrive, ArrowLeft,
  FileText, Image as ImageIcon, Video as VideoIcon, File as FileIcon,
  Loader2, RefreshCw, AlertCircle, ArrowUpRight, FolderTree,
  Share2, Shield, Lock, Globe, Search, X, ChevronDown, Check, Users, Plus,
  Link as LinkIcon, FileSpreadsheet, Presentation, FolderPlus, Upload, MoreVertical,
  Info, Pencil, ArrowRightLeft, Copy, BellOff, MessageSquare, Briefcase, ChevronRight, ChevronLeft,
  ExternalLink, Link, SlidersHorizontal, Calendar, List, LayoutGrid, Mic, Undo2, Redo2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "./Toast";
import { getAccessToken, authService } from "../services/authService";
import { FileExplorer } from "../components/resource/FileExplorer";
import UploadProgressPanel, { type UploadQueueItem } from "../components/resource/UploadProgressPanel";
import { internalChatService } from "../services/internalChatService";
import { resourceService } from "../services/resourceService";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { RESOURCE_SUB_TAB_ROUTES } from "../router/subTabRoutes";

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
  uploadedBy?: string;
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

const GoogleDocsLogo = ({ className = "h-16 w-16" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M75 30H210L285 105V330H75V30Z" fill="#4285F4" />
    <path d="M210 30L285 105H210V30Z" fill="#A1C2FA" />
    <rect x="110" y="145" width="140" height="20" rx="4" fill="white" />
    <rect x="110" y="185" width="140" height="20" rx="4" fill="white" />
    <rect x="110" y="225" width="140" height="20" rx="4" fill="white" />
    <rect x="110" y="265" width="90" height="20" rx="4" fill="white" />
  </svg>
);

const GoogleSheetsLogo = ({ className = "h-16 w-16" }) => (
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

const GoogleSlidesLogo = ({ className = "h-16 w-16" }) => (
  <svg className={className} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M75 30H210L285 105V330H75V30Z" fill="#F4B400" />
    <path d="M210 30L285 105H210V30Z" fill="#FAD980" />
    <rect x="110" y="150" width="140" height="95" rx="6" fill="white" />
    <rect x="120" y="160" width="120" height="75" rx="4" fill="#F4B400" />
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

interface OpenedTab {
  id: string;
  title: string;
  type: "explorer" | "google-doc";
  mimeType?: string;
  url?: string;
}

export default function ResourceTab() {
  const { userProfile, setActiveTab, refreshProfile } = useAuth();
  const [subTab, setSubTab] = useSubTabRouter<ResourceSubTabType>(RESOURCE_SUB_TAB_ROUTES, "TÀI LIỆU KHÁC");
  const [openedTabs, setOpenedTabs] = useState<OpenedTab[]>([
    { id: "explorer", title: "Thẻ mới", type: "explorer" }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("explorer");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Tăng để remount FileExplorer (về thư mục gốc + tải lại) khi bấm lại icon tab con đang mở
  const [explorerKey, setExplorerKey] = useState(0);
  const [localFolderId, setLocalFolderId] = useState<string | null>(null);
  const [localItemsCount, setLocalItemsCount] = useState({ count: 0, total: 0 });
  const [viewingTrash, setViewingTrash] = useState(false);

  const handleItemsCountChange = useCallback((count: number, total: number) => {
    setLocalItemsCount({ count, total });
  }, []);

  const isConnected = userProfile?.googleDriveIntegration?.isConnected;
  const driveEmail = userProfile?.googleDriveIntegration?.driveEmail;

  // Space management
  const [selectedSpace, setSelectedSpace] = useState<string>("personal");
  const [rooms, setRooms] = useState<any[]>([]);
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false);

  // User/Owner scoping for Admins
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [allStaff, setAllStaff] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile) {
      setSelectedOwnerId(userProfile.uid || userProfile.id);
    }
  }, [userProfile]);

  // Listen to ?id= query param to switch space & subTab
  useEffect(() => {
    if (!userProfile) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;

    let isSubscribed = true;

    const handleUrlNavigation = async () => {
      try {
        const item = await resourceService.getDetail(idParam);
        if (!isSubscribed || !item) return;

        if (item.roomId) {
          setSelectedSpace(item.roomId);
        } else {
          setSelectedSpace("personal");
          if (item.creatorUid) {
            setSelectedOwnerId(item.creatorUid);
          }
        }
        setSubTab("TÀI LIỆU KHÁC");
      } catch (err) {
        console.error("Failed to auto-navigate space from URL:", err);
      }
    };

    void handleUrlNavigation();

    return () => {
      isSubscribed = false;
    };
  }, [window.location.search, userProfile]);

  // Dùng uid ổn định làm dep để tránh infinite loop khi object userProfile thay đổi reference
  const userUid = userProfile?.uid || userProfile?.id;
  const userRole = userProfile?.role;
  const userCompanyCode = userProfile?.companyCode;

  useEffect(() => {
    if (!userUid) return;
    const fetchStaff = async () => {
      try {
        let data: any[] = [];
        if (userRole === "superadmin") {
          data = await authService.getAllUsers();
        } else {
          // Dùng endpoint /users/colleagues không cần quyền user:read
          data = await authService.getColleagues();
        }
        setAllStaff(data);
      } catch (err) {
        console.error("Lỗi lấy danh sách nhân sự:", err);
      }
    };
    void fetchStaff();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid, userRole, userCompanyCode]);

  // Pill tab: Kho lưu trữ | Được chia sẻ
  const [currentPill, setCurrentPill] = useState<"KHO_LUU_TRU" | "DUOC_CHIA_SE">("KHO_LUU_TRU");

  // Advanced Filtering States
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Pagination for Drive list view
  const DRIVE_LIST_PAGE_SIZE = 20;
  const [driveListPage, setDriveListPage] = useState(1);

  // Folder navigation history/stack
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);

  // File Preview Modal State (Embed preview)
  const [previewFile, setPreviewFile] = useState<Resource | null>(null);

  // Add Popover Dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Link Modal States
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  // Note Modal States
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteTool, setNoteTool] = useState<"draw" | "text" | "arrow" | "rect" | "line" | "image">("draw");
  const [noteColor, setNoteColor] = useState<string>("#ef4444");

  // Image editing states on canvas
  const [editingImage, setEditingImage] = useState<{
    img: HTMLImageElement;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const isDraggingImageRef = useRef(false);
  const isResizingImageRef = useRef(false);
  const imageOffsetRef = useRef({ x: 0, y: 0 });
  const [noteTextInput, setNoteTextInput] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    value: string;
  }>({ isOpen: false, x: 0, y: 0, value: "" });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const noteImageInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Audio Recording States
  const [showAddAudioModal, setShowAddAudioModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [savingAudio, setSavingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Active menu id for three-dot menu on folder/file cards
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  // Position for fixed-positioned Drive list menu (to escape overflow:hidden containers)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Close Drive list menu on any scroll
  useEffect(() => {
    const handleScroll = () => { setActiveMenuId(null); setMenuPosition(null); };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

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

  const handleCopyToLocal = async (resource: Resource) => {
    if (resource.mimeType === "application/vnd.google-apps.folder") {
      toast.warning("Hệ thống chỉ hỗ trợ sao chép tệp tin/tài liệu (không sao chép thư mục).");
      return;
    }

    try {
      const res = await fetch("/api/v1/resources/file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: resource.name,
          fileUrl: resource.webViewLink,
          parentId: "google-documents",
          mimeType: resource.mimeType,
          size: resource.size || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Sao chép thất bại.");
      }

      toast.success(`Đã sao chép "${resource.name}" vào thư mục "_GOOGLE DOCUMENTS" thành công!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Có lỗi xảy ra khi sao chép tài nguyên.");
    }
  };

  const handleOpenFile = (item: { _id: string; name: string; fileUrl?: string; mimeType?: string }) => {
    const existingTab = openedTabs.find(t => t.id === item._id);
    if (existingTab) {
      setActiveTabId(item._id);
    } else {
      const newTab: OpenedTab = {
        id: item._id,
        title: item.name,
        type: "google-doc",
        mimeType: item.mimeType,
        url: item.fileUrl,
      };
      setOpenedTabs([...openedTabs, newTab]);
      setActiveTabId(item._id);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabIndex = openedTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = openedTabs.filter(t => t.id !== tabId);
    setOpenedTabs(newTabs);

    if (activeTabId === tabId) {
      const nextActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[nextActiveIndex].id);
      } else {
        setOpenedTabs([{ id: "explorer", title: "Thẻ mới", type: "explorer" }]);
        setActiveTabId("explorer");
      }
    }
  };

  const handleAddExplorerTab = () => {
    const newId = `explorer-${Date.now()}`;
    const newTab: OpenedTab = {
      id: newId,
      title: "Thẻ mới",
      type: "explorer"
    };
    setOpenedTabs([...openedTabs, newTab]);
    setActiveTabId(newId);
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
    const targetUser = allStaff.find(u => (u.uid || u.id) === selectedOwnerId);
    const targetIsConnected = selectedOwnerId === (userProfile?.uid || userProfile?.id)
      ? isConnected
      : targetUser?.googleDriveIntegration?.isConnected;

    if (selectedSpace === "personal" && !targetIsConnected) {
      setResources([]);
      return;
    }
    setLoading(true);
    try {
      let url = `/api/v1/integrations/google-drive/resources?folderId=${currentFolderId}`;
      if (selectedSpace === "personal" && selectedOwnerId) {
        url += `&ownerId=${selectedOwnerId}`;
      } else if (selectedSpace !== "personal") {
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

  // Reset folder position when switching space or owner
  useEffect(() => {
    setCurrentFolderId("root");
    setBreadcrumbs([]);
    setViewingTrash(false);
  }, [selectedSpace, selectedOwnerId, subTab]);

  // Reset selectedOwnerId to current user if switching to GOOGLE DRIVE and viewing another employee's space
  useEffect(() => {
    if (subTab === "GOOGLE DRIVE") {
      const myId = userProfile?.uid || userProfile?.id || "";
      if (selectedSpace === "personal" && selectedOwnerId !== myId) {
        setSelectedOwnerId(myId);
      }
    }
  }, [subTab, selectedSpace, selectedOwnerId, userProfile]);



  // Fetch chat groups on userProfile load
  useEffect(() => {
    if (userProfile) {
      void fetchRooms();
    }
  }, [userProfile]);

  // Refetch when folder level changes or space changes
  useEffect(() => {
    if (subTab === "GOOGLE DRIVE") {
      void fetchResources();
    }
  }, [isConnected, subTab, selectedSpace, selectedOwnerId, currentFolderId, allStaff]);

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

    setCreatingFile(true);
    try {
      if (subTab === "TÀI LIỆU KHÁC") {
        if (createFileDialog.type === "folder") {
          const ownerIdParam = selectedSpace === "personal" ? selectedOwnerId : undefined;
          const roomIdParam = selectedSpace !== "personal" ? selectedSpace : undefined;
          await resourceService.createFolder(name, localFolderId, "local", ownerIdParam, roomIdParam);
          toast.success(`Đã tạo thư mục "${name}" thành công!`);
          setRefreshTrigger(prev => prev + 1);
        }
      } else {
        if (createFileDialog.type === "link" && !newFileLink.trim()) {
          toast.warning("Vui lòng nhập đường link.");
          setCreatingFile(false);
          return;
        }
        const payload = {
          spaceType: selectedSpace === "personal" ? "personal" : "group",
          roomId: selectedSpace !== "personal" ? selectedSpace : undefined,
          ownerId: selectedSpace === "personal" ? selectedOwnerId : undefined,
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
        void fetchResources();
      }
      setCreateFileDialog(null);
      setNewFileName("");
      setNewFileLink("");
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

  const formatDate = (iso?: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getFileIconDetails = (mimeType?: string) => {
    const mt = mimeType || "";
    if (mt.startsWith("image/")) {
      return { Icon: ImageIcon, iconColor: "text-emerald-500" };
    }
    if (mt.startsWith("video/")) {
      return { Icon: VideoIcon, iconColor: "text-blue-500" };
    }
    if (mt.includes("pdf") || mt.includes("document") || mt.includes("text")) {
      return { Icon: FileText, iconColor: "text-orange-500" };
    }
    return { Icon: FileIcon, iconColor: "text-gray-400" };
  };

  /** Upload 1 tệp lên Google Drive; ném lỗi nếu thất bại. */
  const uploadDriveFile = async (file: File) => {
    const base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Không đọc được tệp."));
      reader.readAsDataURL(file);
    });

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
  };

  /** Upload 1 tệp vào kho tài liệu nội bộ; ném lỗi nếu thất bại. */
  const uploadLocalFile = async (file: File) => {
    const ownerIdParam = selectedSpace === "personal" ? selectedOwnerId : undefined;
    const roomIdParam = selectedSpace !== "personal" ? selectedSpace : undefined;
    await resourceService.uploadFile(file, localFolderId, ownerIdParam, roomIdParam);
  };

  /** Upload nhiều tệp tuần tự, cập nhật tiến trình từng tệp. */
  const uploadManyFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const isLocal = subTab === "TÀI LIỆU KHÁC";
    if (!isLocal && !canUpload()) {
      toast.error("Bạn không có quyền tải lên thư mục này.");
      return;
    }
    setUploading(true);
    setUploadQueue(files.map((f) => ({ name: f.name, status: "pending" as const })));
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it)));
      try {
        if (isLocal) await uploadLocalFile(files[i]);
        else await uploadDriveFile(files[i]);
        ok += 1;
        setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "done" } : it)));
      } catch (err: any) {
        console.error(err);
        setUploadQueue((q) =>
          q.map((it, idx) => (idx === i ? { ...it, status: "error", error: err?.message || "Tải lên thất bại." } : it))
        );
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast.success(`Đã tải lên ${ok}/${files.length} tệp.`);
      if (isLocal) setRefreshTrigger(prev => prev + 1);
      else void fetchResources();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void uploadManyFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadManyFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Advanced feature handlers (Link, Note, Audio)
  const handleSaveLink = async () => {
    const name = linkName.trim();
    let url = linkUrl.trim();
    if (!name || !url) {
      toast.error("Vui lòng nhập đầy đủ tên và đường dẫn liên kết.");
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      url = "http://" + url;
    }

    setSavingLink(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      const token = getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/resources/file", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          fileUrl: url,
          parentId: localFolderId === "root" ? null : localFolderId,
          mimeType: "text/html",
          size: 0,
          ownerId: selectedSpace === "personal" ? selectedOwnerId : undefined,
          roomId: selectedSpace !== "personal" ? selectedSpace : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Không thêm được liên kết.");
      }

      toast.success("Đã thêm liên kết thành công!");
      setShowAddLinkModal(false);
      setLinkName("");
      setLinkUrl("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error("Lỗi thêm liên kết:", err);
      toast.error(err.message || "Không thêm được liên kết.");
    } finally {
      setSavingLink(false);
    }
  };

  const handleSaveNote = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const title = noteTitle.trim() || "Ghi chú không tên";
    setSavingNote(true);

    try {
      // 1. Chuyển canvas thành PNG base64
      const dataUrl = canvas.toDataURL("image/png");

      // 2. Convert base64 dataUrl sang File object
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], {type: mimeString});
      const noteFile = new File([blob], `${title}.png`, { type: "image/png" });

      // 3. Upload file lên qua resourceService.uploadFile
      await resourceService.uploadFile(
        noteFile, 
        localFolderId === "root" ? null : localFolderId, 
        selectedSpace === "personal" ? selectedOwnerId : undefined, 
        selectedSpace !== "personal" ? selectedSpace : undefined
      );

      toast.success("Đã lưu ghi chú thành ảnh thành công!");
      setShowAddNoteModal(false);
      setNoteTitle("");
      setNoteContent("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error("Lỗi lưu ghi chú:", err);
      toast.error(err.message || "Lỗi lưu ghi chú.");
    } finally {
      setSavingNote(false);
    }
  };

  // --- Canvas Note Drawing Helper Functions ---
  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Lưu lại trạng thái ImageData hiện tại vào undoStack
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(imgData);
    
    // Clear redoStack
    redoStackRef.current = [];
  };

  const handleNoteUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) {
      toast.info("Không có gì để hoàn tác.");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pop state hiện tại chuyển sang redoStack
    const currentState = undoStackRef.current.pop();
    if (currentState) {
      redoStackRef.current.push(currentState);
    }

    // Vẽ state trước đó
    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
    }
  };

  const handleNoteRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) {
      toast.info("Không có gì để làm lại.");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nextState = redoStackRef.current.pop();
    if (nextState) {
      undoStackRef.current.push(nextState);
      ctx.putImageData(nextState, 0, 0);
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    const angle = Math.atan2(toy - fromy, tox - fromx);
    const headlen = 15;
    
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const confirmApplyImage = () => {
    if (!editingImage) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Vẽ ảnh vĩnh viễn không có viền edit
        const lastState = undoStackRef.current[undoStackRef.current.length - 1];
        if (lastState) {
          ctx.putImageData(lastState, 0, 0);
        }
        ctx.drawImage(editingImage.img, editingImage.x, editingImage.y, editingImage.w, editingImage.h);
        saveCanvasState();
        setEditingImage(null);
        setNoteTool("draw");
        toast.success("Đã chèn ảnh vĩnh viễn vào ghi chú.");
      }
    }
  };

  const handleNoteImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          // Chiều rộng mặc định 240px, tự tính chiều cao tỷ lệ
          const defaultWidth = 240;
          const ratio = img.height / img.width;
          const defaultHeight = defaultWidth * ratio;

          setEditingImage({
            img,
            x: 50,
            y: 50,
            w: defaultWidth,
            h: defaultHeight
          });
          setNoteTool("image");
          toast.info("Đã tải ảnh lên. Dùng chuột kéo để di chuyển, kéo nút tròn góc để chỉnh kích cỡ ảnh.");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Re-draw canvas whenever editingImage object changes
  useEffect(() => {
    if (editingImage) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const lastState = undoStackRef.current[undoStackRef.current.length - 1];
          if (lastState) {
            ctx.putImageData(lastState, 0, 0);
          }
          // Vẽ ảnh đang edit
          ctx.drawImage(editingImage.img, editingImage.x, editingImage.y, editingImage.w, editingImage.h);
          
          // Vẽ khung nét đứt màu teal
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = "#008bad";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(editingImage.x, editingImage.y, editingImage.w, editingImage.h);
          ctx.setLineDash([]);
          
          // Vẽ nút tròn resize ở góc dưới bên phải
          ctx.fillStyle = "#008bad";
          ctx.beginPath();
          ctx.arc(editingImage.x + editingImage.w, editingImage.y + editingImage.h, 7, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }, [editingImage]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (noteTool === "image" && editingImage) {
      // 1. Kiểm tra trúng nút resize góc dưới phải
      const distToCorner = Math.sqrt(
        Math.pow(x - (editingImage.x + editingImage.w), 2) +
        Math.pow(y - (editingImage.y + editingImage.h), 2)
      );
      if (distToCorner < 16) {
        isResizingImageRef.current = true;
        return;
      }

      // 2. Kiểm tra click vào trong lòng ảnh
      if (x >= editingImage.x && x <= editingImage.x + editingImage.w &&
          y >= editingImage.y && y <= editingImage.y + editingImage.h) {
        isDraggingImageRef.current = true;
        imageOffsetRef.current = {
          x: x - editingImage.x,
          y: y - editingImage.y
        };
        return;
      }
    }

    isDrawingRef.current = true;
    startPosRef.current = { x, y };

    if (noteTool === "draw") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = noteColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (noteTool === "image" && editingImage) {
      if (isResizingImageRef.current) {
        const newW = Math.max(30, x - editingImage.x);
        const ratio = editingImage.img.height / editingImage.img.width;
        const newH = newW * ratio;
        setEditingImage(prev => prev ? { ...prev, w: newW, h: newH } : null);
      } else if (isDraggingImageRef.current) {
        const newX = x - imageOffsetRef.current.x;
        const newY = y - imageOffsetRef.current.y;
        setEditingImage(prev => prev ? { ...prev, x: newX, y: newY } : null);
      }
      return;
    }

    if (!isDrawingRef.current) return;

    if (noteTool === "draw") {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (noteTool === "arrow" || noteTool === "rect" || noteTool === "line") {
      const lastState = undoStackRef.current[undoStackRef.current.length - 1];
      if (lastState) {
        ctx.putImageData(lastState, 0, 0);
      }

      if (noteTool === "arrow") {
        drawArrow(ctx, startPosRef.current.x, startPosRef.current.y, x, y, noteColor);
      } else if (noteTool === "line") {
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startPosRef.current.x, startPosRef.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (noteTool === "rect") {
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(
          startPosRef.current.x,
          startPosRef.current.y,
          x - startPosRef.current.x,
          y - startPosRef.current.y
        );
      }
    }
  };

  const handleCanvasMouseUp = () => {
    isResizingImageRef.current = false;
    isDraggingImageRef.current = false;

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveCanvasState();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (noteTool !== "text") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNoteTextInput({
      isOpen: true,
      x,
      y,
      value: ""
    });

    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  const handleSaveTextInput = () => {
    if (!noteTextInput.isOpen) return;
    const value = noteTextInput.value.trim();
    
    if (value) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = noteColor;
          ctx.font = "bold 16px Arial, Helvetica, sans-serif";
          ctx.textBaseline = "middle";
          ctx.fillText(value, noteTextInput.x, noteTextInput.y);
          saveCanvasState();
        }
      }
    }

    setNoteTextInput({
      isOpen: false,
      x: 0,
      y: 0,
      value: ""
    });
  };

  // Khởi tạo Canvas trắng ban đầu khi mở modal
  useEffect(() => {
    if (showAddNoteModal) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = canvas.parentElement?.clientWidth || 800;
            canvas.height = canvas.parentElement?.clientHeight || 500;
            
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            undoStackRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
            redoStackRef.current = [];
            setNoteTool("draw");
            setNoteColor("#ef4444");
          }
        }
      }, 300);
    }
  }, [showAddNoteModal]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach(track => track.stop());
        
        setSavingAudio(true);
        try {
          const fileName = `Ghi âm_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}_${new Date().toLocaleTimeString("vi-VN").replace(/:/g, "-")}.wav`;
          const audioFile = new File([audioBlob], fileName, { type: "audio/wav" });

          await resourceService.uploadFile(
            audioFile,
            localFolderId === "root" ? null : localFolderId,
            selectedSpace === "personal" ? selectedOwnerId : undefined,
            selectedSpace !== "personal" ? selectedSpace : undefined
          );

          toast.success("Đã tải tệp ghi âm lên thành công!");
          setShowAddAudioModal(false);
          setRecordingSeconds(0);
          setRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
          console.error("Lỗi lưu file ghi âm:", err);
          toast.error(err.message || "Lỗi tải ghi âm lên.");
        } finally {
          setSavingAudio(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 180) {
            clearInterval(timerRef.current);
            mediaRecorder.stop();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Lỗi truy cập Microphone:", err);
      toast.error("Không thể kết nối Microphone. Vui lòng cho phép quyền truy cập mic.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setRecordingSeconds(0);
    setShowAddAudioModal(false);
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
      handleOpenFile({
        _id: resource._id,
        name: resource.name,
        fileUrl: resource.webViewLink,
        mimeType: resource.mimeType,
      });
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

    const isMyFile = resource.uploadedBy && String(resource.uploadedBy) === String(userProfile?.uid || userProfile?.id);
    const isRoomCreator = room && String(room.creatorId) === String(userProfile?.uid || userProfile?.id);
    const canDelete = selectedSpace === "personal" || isCreatorOrAdmin || isRoomAdmin || isRoomCreator || isMyFile;

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
              <div className="absolute left-2 top-9 mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-20 text-left">
                {/* Mở trong trình duyệt - chỉ cho file, không phải folder */}
                {!isFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(null);
                      window.open(resource.webViewLink, "_blank", "noopener,noreferrer");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4 text-slate-500" />
                    <span>Mở trong trình duyệt</span>
                  </button>
                )}

                {/* Sao chép đường liên kết - chỉ cho file */}
                {!isFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(null);
                      navigator.clipboard.writeText(resource.webViewLink);
                      toast.success("Đã sao chép đường liên kết Google Drive.");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Link className="h-4 w-4 text-slate-500" />
                    <span>Sao chép đường liên kết</span>
                  </button>
                )}

                {/* Tải xuống */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    const token = localStorage.getItem("accessToken") || "";
                    if (isFolder) {
                      const zipUrl = `/api/v1/resources/${resource.driveFileId}/download-zip?space=${selectedSpace}&token=${encodeURIComponent(token)}`;
                      window.open(zipUrl, "_blank");
                    } else if (resource.webContentLink) {
                      window.open(resource.webContentLink, "_blank");
                    } else {
                      // Google Workspace files export
                      let exportUrl = resource.webViewLink;
                      if (resource.mimeType === "application/vnd.google-apps.document") {
                        exportUrl = `https://docs.google.com/document/d/${resource.driveFileId}/export?format=docx`;
                      } else if (resource.mimeType === "application/vnd.google-apps.spreadsheet") {
                        exportUrl = `https://docs.google.com/spreadsheets/d/${resource.driveFileId}/export?format=xlsx`;
                      } else if (resource.mimeType === "application/vnd.google-apps.presentation") {
                        exportUrl = `https://docs.google.com/presentation/d/${resource.driveFileId}/export?format=pptx`;
                      }
                      window.open(exportUrl, "_blank");
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>Tải xuống</span>
                </button>

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
        ) : resource.mimeType === "application/vnd.google-apps.spreadsheet" ? (
          <GoogleSheetsLogo className="h-16 w-16" />
        ) : resource.mimeType === "application/vnd.google-apps.document" ? (
          <GoogleDocsLogo className="h-16 w-16" />
        ) : resource.mimeType === "application/vnd.google-apps.presentation" ? (
          <GoogleSlidesLogo className="h-16 w-16" />
        ) : !isFolder && resource.mimeType?.startsWith("image/") && (resource.thumbnailLink || resource.webViewLink) ? (
          <div className="relative w-28 h-20 flex items-center justify-center rounded-lg overflow-hidden bg-slate-50 border border-slate-200/60 shadow-inner">
            <img src={resource.thumbnailLink || resource.webViewLink} alt={resource.name} className="h-full w-full object-cover" />
            <div className="absolute bottom-1 left-1 bg-[#ff7b00] text-white p-0.5 rounded-sm shadow-xs">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
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
    <div
      className="flex h-full -mx-5 -my-5 overflow-hidden bg-[#f8f9fa]"
      onMouseDown={(e) => {
        // Close fixed dropdown when clicking outside it
        if (menuPosition && activeMenuId) {
          setActiveMenuId(null);
          setMenuPosition(null);
        }
      }}
    >
      {/* Left Vertical Sub-tab Switcher */}
      <div className="w-20 border-r border-slate-200 bg-[#f4f5f6] flex flex-col items-center py-8 gap-6 shrink-0 select-none">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                // Xóa bộ lọc, quay về thư mục gốc và tải lại kho lưu trữ của tab đích
                setCurrentPill("KHO_LUU_TRU");
                setViewingTrash(false);
                setSearchQuery("");
                setShowFilters(false);
                setFilterStartDate("");
                setFilterEndDate("");
                setFilterType("");
                if (tab.value === "TÀI LIỆU KHÁC") {
                  setLocalFolderId(null);
                  setExplorerKey((k) => k + 1);
                } else if (active && currentFolderId === "root") {
                  void fetchResources();
                } else {
                  setCurrentFolderId("root");
                  setBreadcrumbs([]);
                }
                if (!active) setSubTab(tab.value);
              }}
              className={`p-3 rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer flex items-center justify-center ${
                active 
                  ? "bg-white shadow-sm border border-slate-200/65 scale-105" 
                  : "hover:bg-slate-200/40"
              }`}
              title={tab.label}
            >
              {tab.value === "GOOGLE DRIVE" ? (
                <GoogleDriveLogo className={`h-7 w-7 ${active ? "" : "opacity-60 hover:opacity-100"}`} />
              ) : (
                <Icon className={`h-7 w-7 ${active ? "text-[#10b981]" : "text-slate-400 hover:text-slate-600"}`} strokeWidth={1.5} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa] overflow-hidden">
        {/* Browser Tabs Bar - only render if > 1 tabs or current tab is a google-doc */}
        {(openedTabs.length > 1 || (openedTabs.length === 1 && openedTabs[0].type !== "explorer")) && (
          <div className="h-12 bg-slate-100/90 border-b border-slate-200 flex items-end px-4 gap-1 shrink-0 select-none">
            {openedTabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              const isExplorer = tab.type === "explorer";
              
              // Get Tab Icon
              let TabIcon = FileIcon;
              let iconColor = "text-slate-400";
              if (isExplorer) {
                TabIcon = FolderOpen;
                iconColor = "text-blue-500";
              } else if (tab.mimeType?.includes("spreadsheet") || tab.title.endsWith(".xlsx")) {
                TabIcon = FileSpreadsheet;
                iconColor = "text-green-600";
              } else if (tab.mimeType?.includes("presentation")) {
                TabIcon = Presentation;
                iconColor = "text-orange-500";
              } else {
                TabIcon = FileText;
                iconColor = "text-blue-500";
              }

              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group h-9 flex items-center gap-2 px-4 rounded-t-xl text-xs font-bold transition duration-150 cursor-pointer border-x border-t max-w-[180px] ${
                    isActive
                      ? "bg-white text-slate-800 border-slate-200 shadow-xs z-10"
                      : "text-slate-500 bg-slate-200/40 border-transparent hover:bg-slate-200/80 hover:text-slate-700"
                  }`}
                >
                  {!isExplorer && tab.mimeType?.includes("google-apps") ? (
                    <GoogleDriveLogo className="h-4 w-4 shrink-0" />
                  ) : (
                    <TabIcon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                  )}
                  
                  <span className="truncate max-w-[110px]">{tab.title}</span>
                  
                  {/* Close Button */}
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-0.5 rounded-full hover:bg-slate-200 group-hover:opacity-100 opacity-60 text-slate-400 hover:text-slate-600 transition ml-auto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={handleAddExplorerTab}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition ml-2 mb-1.5"
              title="Thẻ mới"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* Unified Top Header Bar */}
        {(() => {
          const activeTab = openedTabs.find(t => t.id === activeTabId);
          if (activeTab?.type === "google-doc") return null;

          return (
            <div className="min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b border-slate-200 bg-white flex flex-wrap sm:grid sm:grid-cols-3 items-center gap-2 shrink-0 select-none text-left">
              {/* Left: Title & Space Selector Dropdown */}
              <div className="flex items-center gap-2 justify-start">
                <span className="text-base font-extrabold text-slate-800 tracking-tight">Tài nguyên với</span>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
                    className="flex items-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 transition duration-150 text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
                  >
                    {selectedSpace === "personal" ? (
                      <div className="h-5 w-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                        {getInitials(
                          selectedOwnerId === (userProfile?.uid || userProfile?.id)
                            ? (userProfile?.displayName || "Cá nhân")
                            : (allStaff.find(u => (u.uid || u.id) === selectedOwnerId)?.displayName || "NV")
                        )}
                      </div>
                    ) : (
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${getBadgeColor(rooms.find(r => r._id === selectedSpace)?.name || "")}`}>
                        {getInitials(rooms.find(r => r._id === selectedSpace)?.name || "")}
                      </div>
                    )}
                    
                    <span className="uppercase">
                      {selectedSpace === "personal" 
                        ? (selectedOwnerId === (userProfile?.uid || userProfile?.id)
                            ? (userProfile?.displayName || "Cá nhân")
                            : (allStaff.find(u => (u.uid || u.id) === selectedOwnerId)?.displayName || "Nhân viên")
                          )
                        : (rooms.find(r => r._id === selectedSpace)?.name || "Nhóm chung")
                      }
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showSpaceDropdown ? "rotate-180" : ""}`} />
                  </button>

                  {showSpaceDropdown && (
                    <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn max-h-[300px] overflow-y-auto">
                      <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider text-left">Không gian lưu trữ</div>
                      <button
                        onClick={() => {
                          setSelectedSpace("personal");
                          setSelectedOwnerId(userProfile?.uid || userProfile?.id || "");
                          setShowSpaceDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition ${
                          selectedSpace === "personal" && selectedOwnerId === (userProfile?.uid || userProfile?.id)
                            ? "bg-blue-50 text-blue-600" 
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {getInitials(userProfile?.displayName || "LAT")}
                        </div>
                        <span className="truncate">{userProfile?.displayName ? `${userProfile.displayName} (Tôi)` : "Cá nhân"}</span>
                      </button>

                      {/* Admin/Superadmin: List all employees */}
                      {allStaff.length > 0 && subTab !== "GOOGLE DRIVE" && (
                        <>
                          <div className="border-t border-slate-100 my-1"></div>
                          <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider text-left">Không gian nhân sự</div>
                          <div className="max-h-48 overflow-y-auto">
                            {allStaff
                              .filter(u => (u.uid || u.id) !== (userProfile?.uid || userProfile?.id))
                              .map((u) => {
                                const isSelected = selectedSpace === "personal" && selectedOwnerId === (u.uid || u.id);
                                return (
                                  <button
                                    key={u.uid || u.id}
                                    onClick={() => {
                                      setSelectedSpace("personal");
                                      setSelectedOwnerId(u.uid || u.id);
                                      setShowSpaceDropdown(false);
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition ${
                                      isSelected 
                                        ? "bg-blue-50 text-blue-600" 
                                        : "hover:bg-slate-50 text-slate-700"
                                    }`}
                                  >
                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getBadgeColor(u.displayName || "")}`}>
                                      {getInitials(u.displayName || "")}
                                    </div>
                                    <span className="truncate">{u.displayName}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </>
                      )}
                      
                      {rooms.length > 0 && (
                        <>
                          <div className="border-t border-slate-100 my-1"></div>
                          <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider text-left">Nhóm chung (Chat)</div>
                          {rooms.map((room) => {
                            const isSelected = selectedSpace === room._id;
                            return (
                              <button
                                key={room._id}
                                onClick={() => {
                                  setSelectedSpace(room._id);
                                  setShowSpaceDropdown(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition ${
                                  isSelected 
                                    ? "bg-blue-50 text-blue-600" 
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getBadgeColor(room.name || "")}`}>
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

              {/* Center: Pill tabs - Kho lưu trữ & Được chia sẻ */}
              <div className="flex items-center justify-center">
                {subTab === "TÀI LIỆU KHÁC" && (
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    <button
                      onClick={() => { setCurrentPill("KHO_LUU_TRU"); setViewingTrash(false); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-150 cursor-pointer ${
                        currentPill === "KHO_LUU_TRU"
                          ? "bg-cyan-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
                      }`}
                    >
                      Kho lưu trữ
                    </button>
                    <button
                      onClick={() => { setCurrentPill("DUOC_CHIA_SE"); setViewingTrash(false); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-150 cursor-pointer ${
                        currentPill === "DUOC_CHIA_SE"
                          ? "bg-cyan-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
                      }`}
                    >
                      Được chia sẻ
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Thùng rác / Quay lại */}
              <div className="flex items-center justify-end">
                {subTab === "TÀI LIỆU KHÁC" && currentPill === "KHO_LUU_TRU" ? (
                  <button
                    onClick={() => setViewingTrash(!viewingTrash)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold transition bg-white shadow-xs cursor-pointer"
                  >
                    {viewingTrash ? (
                      <>
                        <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
                        <span>Quay lại</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Thùng rác</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="h-8 w-24"></div> // Khung giữ chỗ để không bị nhảy layout
                )}
              </div>
            </div>
          );
        })()}

        {/* Tab Contents wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
          {(() => {
            const activeTab = openedTabs.find(t => t.id === activeTabId);
            if (activeTab?.type === "google-doc") {
              return (
                <div className="flex-1 bg-white flex flex-col overflow-hidden">
                  <iframe
                    src={activeTab.url}
                    title={activeTab.title}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media; clipboard-write; clipboard-read"
                  ></iframe>
                </div>
              );
            }

            
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Unified Toolbar Row matching image 1 */}
                <div className="min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white select-none">
                  {/* Left side search & count */}
                  <div className="flex flex-col items-start gap-1">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tên file..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-bold"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 pl-1 text-left">
                      {subTab === "TÀI LIỆU KHÁC" 
                        ? `${localItemsCount.count}/${localItemsCount.total} tệp`
                        : `${filteredResources.length}/${resources.length} tệp`
                      }
                    </span>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-2 overflow-x-auto max-w-full">
                    {/* Filters icon button */}
                    {subTab === "TÀI LIỆU KHÁC" && (
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-xl transition active:scale-95 border flex items-center justify-center h-9 w-9 cursor-pointer ${
                          showFilters 
                            ? "bg-cyan-50 hover:bg-cyan-100/50 text-cyan-600 border-cyan-600" 
                            : "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200"
                        }`}
                        title="Bộ lọc"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    )}

                    {/* List/grid toggle */}
                    <button
                      onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-800 transition active:scale-95 border border-slate-200 bg-white flex items-center justify-center h-9 w-9 cursor-pointer"
                      title={viewMode === "grid" ? "Xem dạng danh sách" : "Xem dạng lưới"}
                    >
                      {viewMode === "grid" ? (
                        <List className="h-4.5 w-4.5" />
                      ) : (
                        <LayoutGrid className="h-4.5 w-4.5" />
                      )}
                    </button>

                    {/* Popover Add Button */}
                    {!viewingTrash && localFolderId !== "chat-attachments" && (
                      <div className="relative" ref={addMenuRef}>
                        <button
                          onClick={() => setShowAddMenu(!showAddMenu)}
                          className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition duration-150 active:scale-95 shadow-md shadow-teal-500/10 flex items-center justify-center h-9 w-9 cursor-pointer"
                          title="Thêm mới"
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        {showAddMenu && (
                          <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn text-left">
                            {subTab === "TÀI LIỆU KHÁC" ? (
                              <>
                                {/* Tải tệp lên */}
                                <button
                                  onClick={() => {
                                    fileInputRef.current?.click();
                                    setShowAddMenu(false);
                                  }}
                                  disabled={uploading}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  {uploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                                  ) : (
                                    <Upload className="h-4.5 w-4.5 text-teal-600" />
                                  )}
                                  <span>Tải tệp lên</span>
                                </button>

                                {/* Thêm thư mục */}
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
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  <Folder className="h-4.5 w-4.5 text-[#7bc8c4]" />
                                  <span>Thêm thư mục</span>
                                </button>

                                {/* Thêm liên kết */}
                                <button
                                  onClick={() => {
                                    setShowAddLinkModal(true);
                                    setShowAddMenu(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  <Link className="h-4.5 w-4.5 text-slate-400" />
                                  <span>Thêm liên kết</span>
                                </button>

                                {/* Thêm ghi chú */}
                                <button
                                  onClick={() => {
                                    setShowAddNoteModal(true);
                                    setShowAddMenu(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  <FileText className="h-4.5 w-4.5 text-orange-500" />
                                  <span>Thêm ghi chú</span>
                                </button>

                                {/* Thêm ghi âm */}
                                <button
                                  onClick={() => {
                                    setShowAddAudioModal(true);
                                    setShowAddMenu(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  <Mic className="h-4.5 w-4.5 text-blue-500" />
                                  <span>Thêm ghi âm</span>
                                </button>
                              </>
                            ) : (
                              <>
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
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
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
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
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
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  <Presentation className="h-4 w-4 text-amber-500" />
                                  <span>Thêm Google Trang trình bày</span>
                                </button>

                                <div className="border-t border-slate-100 my-1"></div>

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
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
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
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  {uploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                  ) : (
                                    <Upload className="h-4 w-4 text-slate-500" />
                                  )}
                                  <span>Tải tệp tin từ máy tính</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={onFileChange}
                      className="hidden"
                    />

                    {/* Tiến trình tải lên nhiều tệp */}
                    <UploadProgressPanel queue={uploadQueue} onClose={() => setUploadQueue([])} />

                    {/* Reload/sync button */}
                    <button
                      onClick={subTab === "TÀI LIỆU KHÁC" ? () => setRefreshTrigger(prev => prev + 1) : fetchResources}
                      disabled={loading}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-800 transition active:scale-95 border border-slate-200 bg-white flex items-center justify-center h-9 w-9 cursor-pointer"
                      title="Làm mới"
                    >
                      <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Advanced Filters Panel matching mockup */}
                {showFilters && subTab === "TÀI LIỆU KHÁC" && (
                  <div className="px-6 py-2.5 border-b border-slate-100 bg-[#fbfcfc] flex flex-wrap items-center gap-3 animate-fadeIn shrink-0 select-none text-left">
                    {/* CSS override to hide default browser date picker indicators but make them clickable */}
                    <style>{`
                      .style-date-input::-webkit-calendar-picker-indicator {
                        opacity: 0;
                        width: 100%;
                        height: 100%;
                        position: absolute;
                        left: 0;
                        top: 0;
                        cursor: pointer;
                        z-index: 10;
                      }
                      .style-date-input {
                        position: relative;
                        z-index: 5;
                      }
                    `}</style>

                    {/* Từ ngày */}
                    <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs hover:border-slate-300 transition duration-150">
                      <input
                        type={filterStartDate ? "date" : "text"}
                        onFocus={(e) => (e.target.type = "date")}
                        onBlur={(e) => {
                          if (!e.target.value) e.target.type = "text";
                        }}
                        placeholder="Từ ngày"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="text-xs font-bold text-slate-700 bg-transparent focus:outline-hidden pr-6 w-28 cursor-pointer style-date-input"
                      />
                      <Calendar className="absolute right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Đến ngày */}
                    <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs hover:border-slate-300 transition duration-150">
                      <input
                        type={filterEndDate ? "date" : "text"}
                        onFocus={(e) => (e.target.type = "date")}
                        onBlur={(e) => {
                          if (!e.target.value) e.target.type = "text";
                        }}
                        placeholder="Đến ngày"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="text-xs font-bold text-slate-700 bg-transparent focus:outline-hidden pr-6 w-28 cursor-pointer style-date-input"
                      />
                      <Calendar className="absolute right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Divider vertical */}
                    <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

                    {/* Filter Type Pills */}
                    {[
                      { value: "folder", label: "Thư mục" },
                      { value: "image", label: "Hình ảnh" },
                      { value: "audio", label: "Âm thanh" },
                      { value: "video", label: "Video" },
                      { value: "pdf", label: "PDF" },
                      { value: "document", label: "Tài liệu" },
                      { value: "spreadsheet", label: "Bảng tính" },
                      { value: "presentation", label: "Bản trình bày" },
                      { value: "link", label: "Liên kết" }
                    ].map((type) => {
                      const isActive = filterType === type.value;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setFilterType(isActive ? "" : type.value)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition duration-150 cursor-pointer border ${
                            isActive
                              ? "bg-slate-800 border-slate-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}

                    {/* Clear Filter button if any is active */}
                    {(filterStartDate || filterEndDate || filterType) && (
                      <button
                        onClick={() => {
                          setFilterStartDate("");
                          setFilterEndDate("");
                          setFilterType("");
                        }}
                        className="text-[10px] font-black text-red-500 hover:text-red-700 transition uppercase tracking-wider ml-auto cursor-pointer"
                      >
                        Xóa lọc
                      </button>
                    )}
                  </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative text-left">
                  {subTab === "TÀI LIỆU KHÁC" ? (
                    <div className="w-full h-full overflow-y-auto p-6">
                      <FileExplorer
                        key={explorerKey}
                        onOpenFile={handleOpenFile}
                        searchQuery={searchQuery}
                        refreshTrigger={refreshTrigger}
                        onFolderChange={setLocalFolderId}
                        onItemsCountChange={handleItemsCountChange}
                        ownerId={selectedSpace === "personal" ? selectedOwnerId : undefined}
                        roomId={selectedSpace !== "personal" ? selectedSpace : undefined}
                        showTrash={viewingTrash}
                        users={allStaff}
                        rooms={rooms}
                        showSharedOnly={currentPill === "DUOC_CHIA_SE"}
                        filterStartDate={filterStartDate}
                        filterEndDate={filterEndDate}
                        filterType={filterType}
                        viewMode={viewMode}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col overflow-hidden relative">


                      {/* Google Drive Breadcrumbs Navigation Row */}
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

                          {/* Share button moved to sub-breadcrumbs bar since it is specific to Drive shared spaces */}
                          {canManagePermissions() && (
                            <button
                              onClick={() => {
                                setShareSearchQuery("");
                                setShowShareModal(true);
                              }}
                              className="px-3 py-1.5 hover:bg-slate-50 rounded-xl text-slate-600 hover:text-slate-900 border border-gray-200 transition active:scale-95 bg-white flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
                              title="Quản lý phân quyền"
                            >
                              <Share2 className="h-4 w-4" />
                              <span>Phân quyền</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto p-6 bg-white">
                        {(selectedSpace === "personal" && !isConnected) ? (
                          <div className="flex flex-col items-center justify-center py-16 bg-white/50 border border-dashed border-gray-200 rounded-3xl p-10 max-w-xl mx-auto mt-10 text-center">
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
                            {loading && filteredResources.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                                <RefreshCw className="h-8 w-8 animate-spin text-cyan-600" />
                                <p className="text-xs text-gray-500 mt-2 font-medium">Đang tải tài nguyên...</p>
                              </div>
                            ) : filteredResources.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                                <EmptyStateIllustration />
                                <p className="text-base font-bold text-slate-700 mt-6">Không có tài liệu nào</p>
                                {canUpload() && (
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowAddMenu(!showAddMenu)}
                                      className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-500/10 transition duration-150 active:scale-95 cursor-pointer"
                                    >
                                      <Plus className="h-4 w-4" />
                                      <span>Thêm mới</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : viewMode === "list" ? (
                              <div className="flex flex-col gap-3">
                              <div className="flex flex-col bg-white rounded-3xl border border-slate-100 shadow-xs text-left w-full">
                                {/* Table Header */}
                                <div className="flex items-center px-6 py-3.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider rounded-t-3xl">
                                  <div className="flex-1">Tên tài liệu</div>
                                  <div className="w-56">Ngày tạo</div>
                                  <div className="w-32">Kích thước</div>
                                  <div className="w-12 text-center"></div>
                                </div>

                                {/* Table Body */}
                                <div className="divide-y divide-slate-100">
                                  {(() => {
                                    const driveListTotalPagesInner = Math.max(1, Math.ceil(filteredResources.length / DRIVE_LIST_PAGE_SIZE));
                                    const safeDrivePageInner = Math.min(driveListPage, driveListTotalPagesInner);
                                    const pagedResources = filteredResources.slice((safeDrivePageInner - 1) * DRIVE_LIST_PAGE_SIZE, safeDrivePageInner * DRIVE_LIST_PAGE_SIZE);
                                    return pagedResources;
                                  })().map((resource) => {
                                    const isFolder = resource.mimeType === "application/vnd.google-apps.folder";
                                    const { Icon, iconColor } = isFolder 
                                      ? { Icon: FolderOpen, iconColor: "text-[#5bc0be]" } 
                                      : getFileIconDetails(resource.mimeType);

                                    const isCreatorOrAdmin = ["admin", "superadmin"].includes(userProfile?.role || "");
                                    const room = selectedSpace !== "personal" ? rooms.find(r => r._id === selectedSpace) : null;
                                    
                                    const canEdit = (() => {
                                      if (selectedSpace === "personal") return !!isConnected;
                                      if (isCreatorOrAdmin) return true;
                                      if (!room) return false;
                                      const memberInfo = room.members.find(
                                        (m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id)
                                      );
                                      const isRoomAdminLocal = memberInfo?.role === "admin";
                                      const isCreator = String(room.creatorId) === String(userProfile?.uid || userProfile?.id);
                                      const isUploader = memberInfo?.canUploadDrive === true;
                                      return isRoomAdminLocal || isCreator || isUploader;
                                    })();

                                    const isMyFile = resource.uploadedBy && String(resource.uploadedBy) === String(userProfile?.uid || userProfile?.id);
                                    const isRoomCreator = room && String(room.creatorId) === String(userProfile?.uid || userProfile?.id);
                                    const memberInfo = room?.members.find(
                                      (m: any) => String(getMemberId(m.userId)) === String(userProfile?.uid || userProfile?.id)
                                    );
                                    const isRoomAdminCheck = memberInfo?.role === "admin";
                                    const canDelete = selectedSpace === "personal" || isCreatorOrAdmin || isRoomAdminCheck || isRoomCreator || isMyFile;

                                    const isMenuOpen = activeMenuId === resource._id;

                                    return (
                                      <div 
                                        key={resource._id}
                                        className="group relative flex items-center px-6 py-3.5 hover:bg-slate-50/50 transition select-none cursor-pointer"
                                        onClick={() => handleResourceClick(resource)}
                                      >
                                        {/* Name */}
                                        <div className="flex-1 flex items-center gap-3 min-w-0 pr-4">
                                          <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-white transition duration-200">
                                            <Icon className={`h-6 w-6 ${iconColor}`} />
                                          </div>
                                          <span className="truncate text-sm font-bold text-slate-800" title={resource.name}>
                                            {resource.name}
                                          </span>
                                        </div>

                                        {/* Date */}
                                        <div className="w-56 text-xs text-slate-400 font-semibold">
                                          {formatDate(resource.createdAt)}
                                        </div>

                                        {/* Size */}
                                        <div className="w-32 text-xs text-slate-500 font-semibold">
                                          {isFolder 
                                            ? "Thư mục" 
                                            : resource.mimeType === "text/html" 
                                              ? "Liên kết" 
                                              : formatBytes(resource.size)
                                          }
                                        </div>

                                        {/* More Actions */}
                                        <div
                                          className="w-12 flex justify-center"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {canEdit && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isMenuOpen) {
                                                  setActiveMenuId(null);
                                                  setMenuPosition(null);
                                                } else {
                                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                  setMenuPosition({
                                                    top: rect.bottom + 4,
                                                    right: window.innerWidth - rect.right,
                                                  });
                                                  setActiveMenuId(resource._id);
                                                }
                                              }}
                                              className="w-7 h-7 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Pagination for Drive list view */}
                              {(() => {
                                const driveListTotalPages = Math.max(1, Math.ceil(filteredResources.length / DRIVE_LIST_PAGE_SIZE));
                                const safeDrivePage = Math.min(driveListPage, driveListTotalPages);
                                if (driveListTotalPages <= 1) return null;
                                return (
                                  <div className="flex items-center justify-between px-2 py-2">
                                    <span className="text-xs text-slate-500 font-semibold">
                                      {filteredResources.length} mục • Trang {safeDrivePage}/{driveListTotalPages}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setDriveListPage(p => Math.max(1, p - 1))}
                                        disabled={safeDrivePage === 1}
                                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                      >
                                        <ChevronLeft className="h-4 w-4" />
                                      </button>
                                      {Array.from({ length: driveListTotalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === driveListTotalPages || Math.abs(p - safeDrivePage) <= 1)
                                        .reduce<(number | "...")[]>((acc, p, i, arr) => {
                                          if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                                          acc.push(p);
                                          return acc;
                                        }, [])
                                        .map((p, i) =>
                                          p === "..." ? (
                                            <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs">...</span>
                                          ) : (
                                            <button
                                              key={p}
                                              type="button"
                                              onClick={() => setDriveListPage(p as number)}
                                              className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                                                safeDrivePage === p
                                                  ? "bg-cyan-600 text-white shadow-sm"
                                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                              }`}
                                            >
                                              {p}
                                            </button>
                                          )
                                        )
                                      }
                                      <button
                                        type="button"
                                        onClick={() => setDriveListPage(p => Math.min(driveListTotalPages, p + 1))}
                                        disabled={safeDrivePage === driveListTotalPages}
                                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                      >
                                        <ChevronRight className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            ) : (
                              <div className="flex flex-wrap gap-4 pb-32">
                                {/* Folders first */}
                                {filteredResources
                                  .filter((r) => r.mimeType === "application/vnd.google-apps.folder")
                                  .map((resource, idx) => renderResourceCard(resource, idx))}
                                
                                {/* Files after */}
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
              </div>
            );
          })()}
        </div>
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
                className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5"
              >
                {creatingFile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal Dialog */}
      {showAddLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-left relative animate-fadeIn">
            {/* Close button X */}
            <button
              onClick={() => {
                setShowAddLinkModal(false);
                setLinkName("");
                setLinkUrl("");
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pb-4">
              <h3 className="text-base font-bold text-slate-800 mb-6">Thêm liên kết</h3>
              
              <div className="space-y-4">
                {/* Trong */}
                <div className="flex items-center gap-4">
                  <span className="w-16 text-xs font-bold text-slate-400">Trong</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedSpace === "personal" 
                      ? "Kho lưu trữ của tôi" 
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Thư mục hiện tại")
                    }
                  </span>
                </div>

                {/* Tên */}
                <div className="flex items-center gap-4">
                  <span className="w-16 text-xs font-bold text-slate-400">Tên</span>
                  <input
                    type="text"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="Nhập tên hiển thị..."
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 font-semibold text-slate-700"
                  />
                </div>

                {/* URL */}
                <div className="flex items-center gap-4">
                  <span className="w-16 text-xs font-bold text-slate-400">URL</span>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 font-semibold text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowAddLinkModal(false);
                  setLinkName("");
                  setLinkUrl("");
                }}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveLink}
                disabled={savingLink || !linkName.trim() || !linkUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingLink && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal Dialog */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-left relative animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Thêm ghi chú</h3>
                <span className="text-xs text-slate-400">
                  Trong{" "}
                  <strong className="text-slate-600">
                    {selectedSpace === "personal" 
                      ? "Kho lưu trữ của tôi" 
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Thư mục hiện tại")
                    }
                  </strong>
                </span>
              </div>
              <button
                onClick={() => {
                  setShowAddNoteModal(false);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Interactive Toolbars matching mockup */}
            <div className="bg-slate-50/70 border-b border-slate-100 px-6 py-2 flex flex-wrap items-center gap-3 select-none">
              
              {/* Text formatting styles (A A A A) with inline colors */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {[
                  { color: "#000000", label: "A" },
                  { color: "#ef4444", label: "A" },
                  { color: "#22c55e", label: "A" },
                  { color: "#3b82f6", label: "A" }
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => {
                      setNoteTool("text");
                      setNoteColor(item.color);
                    }}
                    style={{ color: item.color }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-sm font-extrabold transition active:scale-95 cursor-pointer ${
                      noteTool === "text" && noteColor === item.color
                        ? "bg-slate-100 ring-2 ring-slate-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Arrow symbols colors with inline colors */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {[
                  { color: "#ef4444", label: "↗" },
                  { color: "#22c55e", label: "↗" },
                  { color: "#3b82f6", label: "↗" }
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => {
                      setNoteTool("arrow");
                      setNoteColor(item.color);
                    }}
                    style={{ color: item.color }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-sm font-extrabold transition active:scale-95 cursor-pointer ${
                      noteTool === "arrow" && noteColor === item.color
                        ? "bg-slate-100 ring-2 ring-slate-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Shape boxes color options with inline colors */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {[
                  { color: "#ef4444" },
                  { color: "#22c55e" },
                  { color: "#3b82f6" }
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => {
                      setNoteTool("rect");
                      setNoteColor(item.color);
                    }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${
                      noteTool === "rect" && noteColor === item.color
                        ? "bg-slate-100 ring-2 ring-slate-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div 
                      style={{ borderColor: item.color }}
                      className="h-4 w-4 rounded-xs border-2" 
                    />
                  </button>
                ))}
              </div>

              {/* Pen Free Draw Tool with Dropdown */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                <button
                  onClick={() => {
                    setNoteTool("draw");
                  }}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${
                    noteTool === "draw" ? "bg-slate-100 ring-2 ring-slate-300" : "hover:bg-slate-50"
                  }`}
                  title="Cái bút vẽ tự do"
                >
                  <Pencil className="h-4 w-4 text-slate-700" />
                </button>

                <select
                  value={noteColor}
                  onChange={(e) => {
                    setNoteColor(e.target.value);
                    setNoteTool("draw");
                  }}
                  className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg py-0.5 px-1 font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="#000000">Đen</option>
                  <option value="#ef4444">Đỏ</option>
                  <option value="#22c55e">Xanh lá</option>
                  <option value="#3b82f6">Xanh dương</option>
                  <option value="#f59e0b">Vàng</option>
                  <option value="#8b5cf6">Tím</option>
                </select>
              </div>

              {/* Đường nét thẳng */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                <button
                  onClick={() => {
                    setNoteTool("line");
                  }}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${
                    noteTool === "line" ? "bg-slate-100 ring-2 ring-slate-300" : "hover:bg-slate-50"
                  }`}
                  title="Vẽ đường nét thẳng"
                >
                  <span className="text-base font-extrabold italic select-none" style={{ color: noteColor }}>╱</span>
                </button>
              </div>

              {/* Tải ảnh lên */}
              <button
                onClick={() => noteImageInputRef.current?.click()}
                className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 text-xs font-bold text-slate-600 transition active:scale-95 shadow-2xs cursor-pointer"
                title="Tải ảnh lên"
              >
                <ImageIcon className="h-4 w-4 text-emerald-500" />
                <span>Tải ảnh lên</span>
              </button>
              <input
                type="file"
                ref={noteImageInputRef}
                accept="image/*"
                onChange={handleNoteImageUpload}
                className="hidden"
              />

              {/* Đồng ý chèn ảnh */}
              {editingImage && (
                <button
                  onClick={confirmApplyImage}
                  className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl flex items-center gap-1 text-xs font-bold text-white transition active:scale-95 shadow-md cursor-pointer animate-pulse"
                >
                  <span>✓ Xác nhận chèn ảnh</span>
                </button>
              )}

              {/* Undo / Redo - To hơn */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs ml-auto">
                <button 
                  onClick={handleNoteUndo}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-700 active:scale-95 transition cursor-pointer"
                  title="Hoàn tác (Undo)"
                >
                  <Undo2 className="h-5.5 w-5.5 stroke-[2.5]" />
                </button>
                <button 
                  onClick={handleNoteRedo}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-700 active:scale-95 transition cursor-pointer"
                  title="Làm lại (Redo)"
                >
                  <Redo2 className="h-5.5 w-5.5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Note Editor Area (Title + Canvas) */}
            <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden relative">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Tiêu đề ghi chú..."
                className="w-full text-lg font-bold text-slate-800 outline-hidden border-b border-slate-100 pb-2 placeholder-slate-300"
              />
              
              {/* Canvas Wrapper */}
              <div className="flex-1 border border-slate-200/80 rounded-2xl overflow-hidden relative bg-white shadow-inner flex">
                <canvas 
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onClick={handleCanvasClick}
                  style={{
                    cursor: noteTool === "draw" 
                      ? "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' style='font-size:24px'><text y='24'>✏️</text></svg>\") 0 24, auto"
                      : "crosshair"
                  }}
                  className="flex-1 h-full"
                />

                {/* Absolute Text Input overlay for 'text' tool */}
                {noteTextInput.isOpen && (
                  <input
                    ref={textInputRef}
                    type="text"
                    value={noteTextInput.value}
                    onChange={(e) => setNoteTextInput(prev => ({ ...prev, value: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTextInput();
                      if (e.key === "Escape") {
                        setNoteTextInput({ isOpen: false, x: 0, y: 0, value: "" });
                      }
                    }}
                    onBlur={handleSaveTextInput}
                    style={{
                      position: "absolute",
                      left: noteTextInput.x,
                      top: noteTextInput.y - 12,
                      color: noteColor,
                      font: "bold 16px Arial, Helvetica, sans-serif",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: 0,
                      margin: 0,
                      zIndex: 30,
                    }}
                    placeholder="..."
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowAddNoteModal(false);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Audio Modal Dialog */}
      {showAddAudioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-left relative animate-fadeIn">
            {/* Close button X */}
            <button
              onClick={cancelRecording}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 flex flex-col items-center">
              <div className="w-full flex items-center gap-2 mb-6">
                <h3 className="text-base font-bold text-slate-800">Thêm ghi âm</h3>
                <span className="text-[10px] text-slate-400">
                  Trong{" "}
                  <strong className="text-slate-600">
                    {selectedSpace === "personal" 
                      ? "Kho lưu trữ của tôi" 
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Thư mục hiện tại")
                    }
                  </strong>
                </span>
              </div>

              {/* Big mic indicator */}
              <div className="relative flex items-center justify-center my-6 select-none">
                {/* Wave circle effect when recording */}
                {isRecording && (
                  <div className="absolute h-24 w-24 rounded-full bg-red-100 border-2 border-red-200 animate-ping opacity-75"></div>
                )}
                
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={savingAudio}
                  className={`h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer z-10 ${
                    isRecording 
                      ? "bg-red-500 hover:bg-red-600 text-white" 
                      : "bg-cyan-50 hover:bg-cyan-100 text-cyan-600"
                  }`}
                >
                  <Mic className={`h-8 w-8 ${isRecording ? "animate-pulse" : ""}`} />
                </button>
              </div>

              {/* Timer displaying 00:00:00 */}
              <div className="text-lg font-bold text-orange-500 mb-2">
                {new Date(recordingSeconds * 1000).toISOString().substr(11, 8)}
              </div>

              <div className="text-xs text-slate-400 text-center font-medium mb-2">
                {isRecording ? "Đang ghi âm..." : "Nhấn nút để bắt đầu ghi âm"}
              </div>

              <div className="text-[10px] text-slate-400 text-center font-semibold bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                Thời gian ghi âm tối đa: 180s
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50/50 border-t border-slate-100 w-full">
              <button
                onClick={cancelRecording}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={stopRecording}
                disabled={!isRecording || savingAudio}
                className="px-5 py-2.5 rounded-xl bg-[#7bc8c4] hover:bg-[#5bb8b4] text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingAudio && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Hoàn tất
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
                                ? "bg-cyan-600 text-white" 
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
                  className="p-2 hover:bg-slate-100 rounded-xl text-cyan-600 border border-slate-200 transition cursor-pointer"
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
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
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
                <span className="font-bold text-cyan-600">
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
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

      {/* Drive List View Dropdown Portal - rendered into document.body to escape overflow/event bubbling */}
      {activeMenuId && menuPosition && (() => {
        const resource = filteredResources.find(r => r._id === activeMenuId);
        if (!resource) return null;
        const isFolder = resource.mimeType === "application/vnd.google-apps.folder";
        const isCreatorOrAdmin = ["admin", "superadmin"].includes(userProfile?.role || "");
        const room = selectedSpace !== "personal" ? rooms.find(r => r._id === selectedSpace) : null;
        const canEdit = (() => {
          if (selectedSpace === "personal") return !!isConnected;
          if (isCreatorOrAdmin) return true;
          const memberInfo = room?.members?.find((m: any) => getMemberId(m.userId) === userProfile?._id || getMemberId(m.userId) === getMemberId(userProfile));
          return memberInfo?.role === "admin" || room?.createdBy === userProfile?._id;
        })();
        const canDelete = canEdit;
        if (!canEdit) return null;
        const rootId = selectedSpace === "personal"
          ? (userProfile?.googleDriveIntegration?.rootFolderId || "root")
          : (rooms.find(r => r._id === selectedSpace)?.driveFolderId || "root");
        return ReactDOM.createPortal(
          <div
            style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right, zIndex: 99999 }}
            className="w-52 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl text-left overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mở trong trình duyệt */}
            {!isFolder && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(null); setMenuPosition(null);
                  window.open(resource.webViewLink, "_blank", "noopener,noreferrer");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <ExternalLink className="h-4 w-4 text-slate-500" />
                <span>Mở trong trình duyệt</span>
              </button>
            )}
            {/* Sao chép đường liên kết */}
            {!isFolder && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(null); setMenuPosition(null);
                  navigator.clipboard.writeText(resource.webViewLink);
                  toast.success("Đã sao chép đường liên kết Google Drive.");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Link className="h-4 w-4 text-slate-500" />
                <span>Sao chép đường liên kết</span>
              </button>
            )}
            {/* Tải xuống */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(null); setMenuPosition(null);
                const token = localStorage.getItem("accessToken") || "";
                if (isFolder) {
                  const zipUrl = `/api/v1/resources/${resource.driveFileId}/download-zip?space=${selectedSpace}&token=${encodeURIComponent(token)}`;
                  window.open(zipUrl, "_blank");
                } else if (resource.webContentLink) {
                  window.open(resource.webContentLink, "_blank");
                } else {
                  // Google Workspace files export
                  let exportUrl = resource.webViewLink;
                  if (resource.mimeType === "application/vnd.google-apps.document") {
                    exportUrl = `https://docs.google.com/document/d/${resource.driveFileId}/export?format=docx`;
                  } else if (resource.mimeType === "application/vnd.google-apps.spreadsheet") {
                    exportUrl = `https://docs.google.com/spreadsheets/d/${resource.driveFileId}/export?format=xlsx`;
                  } else if (resource.mimeType === "application/vnd.google-apps.presentation") {
                    exportUrl = `https://docs.google.com/presentation/d/${resource.driveFileId}/export?format=pptx`;
                  }
                  window.open(exportUrl, "_blank");
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Tải xuống</span>
            </button>
            {/* Đổi tên */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(null); setMenuPosition(null);
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
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(null); setMenuPosition(null);
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
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(null); setMenuPosition(null);
                  handleDeleteResource(resource._id, resource.name);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span>Chuyển vào thùng rác</span>
              </button>
            )}
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
