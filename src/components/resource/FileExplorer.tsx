import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
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
  Plus,
  Check,
  Search,
  Users,
} from "lucide-react";
import type { ResourceItem, BreadcrumbEntry } from "../../types";
import { resourceService } from "../../services/resourceService";
import { internalChatService } from "../../services/internalChatService";
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
  searchQuery?: string;
  refreshTrigger?: number;
  onItemsCountChange?: (count: number, total: number) => void;
  onFolderChange?: (folderId: string | null) => void;
  ownerId?: string;
  roomId?: string;
  showTrash?: boolean;
  users?: any[];
  rooms?: any[];
  showSharedOnly?: boolean; // Nếu true: chỉ hiển item được chia sẻ (tab "Được chia sẻ")
  filterStartDate?: string;
  filterEndDate?: string;
  filterType?: string;
  viewMode?: "grid" | "list";
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  onOpenFile, 
  searchQuery = "", 
  refreshTrigger = 0,
  onItemsCountChange,
  onFolderChange,
  ownerId,
  roomId,
  showTrash = false,
  users = [],
  rooms = [],
  showSharedOnly = false,
  filterStartDate = "",
  filterEndDate = "",
  filterType = "",
  viewMode = "grid",
}) => {
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

  // Pagination for list view
  const LIST_PAGE_SIZE = 20;
  const [listPage, setListPage] = useState(1);

  // Drag and drop states for moving
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Local Move Modal states
  const [localMoveTarget, setLocalMoveTarget] = useState<ResourceItem | null>(null);
  const [moveSpace, setMoveSpace] = useState<string>("personal");
  const [showMoveSpaceDropdown, setShowMoveSpaceDropdown] = useState(false);
  const [moveSpaceSearch, setMoveSpaceSearch] = useState("");
  const [moveSpaceTab, setMoveSpaceTab] = useState<"Thành viên" | "Nhóm">("Thành viên");

  const [isCreatingFolderInModal, setIsCreatingFolderInModal] = useState(false);
  const [newFolderInModalName, setNewFolderInModalName] = useState("");
  const [creatingFolderInModal, setCreatingFolderInModal] = useState(false);

  const [moveModalFolder, setMoveModalFolder] = useState<string | null>(null);
  const [moveModalFolders, setMoveModalFolders] = useState<ResourceItem[]>([]);
  const [moveModalBreadcrumb, setMoveModalBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [loadingMoveModal, setLoadingMoveModal] = useState(false);

  const getSpaceDetails = (spaceId: string) => {
    if (spaceId === "personal") {
      return {
        name: `${userProfile?.displayName || "Nguyễn Tân Tiến"}`,
        isMe: true,
        type: "user",
      };
    }
    const targetUser = users.find(u => u._id === spaceId);
    if (targetUser) {
      return {
        name: targetUser.displayName || targetUser.email,
        isMe: false,
        type: "user",
      };
    }
    const targetRoom = rooms.find(r => r._id === spaceId);
    if (targetRoom) {
      return {
        name: targetRoom.name,
        isMe: false,
        type: "room",
      };
    }
    return {
      name: "Chọn không gian",
      isMe: false,
      type: "user",
    };
  };

  const getFilteredMoveSpaces = () => {
    const search = moveSpaceSearch.toLowerCase().trim();
    if (moveSpaceTab === "Thành viên") {
      const list = [
        { _id: "personal", displayName: `${userProfile?.displayName || "Nguyễn Tân Tiến"} (Tôi)`, isMe: true },
        ...users.map(u => ({ _id: u._id, displayName: u.displayName || u.email, isMe: false }))
      ];
      if (search) {
        return list.filter(u => u.displayName.toLowerCase().includes(search));
      }
      return list;
    } else {
      const list = rooms.map(r => ({ _id: r._id, name: r.name }));
      if (search) {
        return list.filter(r => r.name.toLowerCase().includes(search));
      }
      return list;
    }
  };

  const handleCreateFolderInModal = async () => {
    if (!newFolderInModalName.trim()) return;
    setCreatingFolderInModal(true);
    try {
      let targetOwner: string | undefined = undefined;
      let targetRoom: string | undefined = undefined;

      if (moveSpace === "personal") {
        targetOwner = userProfile?._id || userProfile?.id;
      } else {
        const targetUser = users.find(u => u._id === moveSpace);
        if (targetUser) {
          targetOwner = targetUser._id;
        } else {
          const targetRoomObj = rooms.find(r => r._id === moveSpace);
          if (targetRoomObj) {
            targetRoom = targetRoomObj._id;
          }
        }
      }

      await resourceService.createFolder(
        newFolderInModalName.trim(),
        moveModalFolder,
        "local",
        targetOwner,
        targetRoom
      );
      toast.success(`Đã tạo thư mục "${newFolderInModalName.trim()}"`);
      setIsCreatingFolderInModal(false);
      setNewFolderInModalName("");
      void loadMoveModalFolders(moveModalFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo thư mục thất bại.");
    } finally {
      setCreatingFolderInModal(false);
    }
  };

  const handleMoveItem = async (draggedId: string, targetFolderId: string | null) => {
    if (!draggedId) return;
    const targetParent = targetFolderId === "root" ? null : targetFolderId;
    if (draggedId === targetParent) return;

    if (draggedId.startsWith("chat-")) {
      toast.warning("Không thể di chuyển tệp tin đính kèm từ chat.");
      return;
    }

    try {
      let targetOwner: string | null = null;
      let targetRoom: string | null = null;

      if (moveSpace === "personal") {
        targetOwner = null;
        targetRoom = null;
      } else {
        const targetUser = users.find(u => u._id === moveSpace);
        if (targetUser) {
          targetOwner = targetUser._id;
          targetRoom = null;
        } else {
          const targetRoomObj = rooms.find(r => r._id === moveSpace);
          if (targetRoomObj) {
            targetRoom = targetRoomObj._id;
            targetOwner = null;
          }
        }
      }

      await resourceService.move(draggedId, targetParent, targetRoom, targetOwner);
      toast.success("Đã di chuyển tài nguyên thành công.");
      setLocalMoveTarget(null);
      load(currentFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Di chuyển tài nguyên thất bại.");
    }
  };

  const loadMoveModalFolders = useCallback(async (folderId: string | null) => {
    setLoadingMoveModal(true);
    try {
      let targetOwner: string | undefined = undefined;
      let targetRoom: string | undefined = undefined;

      if (moveSpace === "personal") {
        targetOwner = userProfile?._id || userProfile?.id;
      } else {
        const targetUser = users.find(u => u._id === moveSpace);
        if (targetUser) {
          targetOwner = targetUser._id;
        } else {
          const targetRoomObj = rooms.find(r => r._id === moveSpace);
          if (targetRoomObj) {
            targetRoom = targetRoomObj._id;
          }
        }
      }

      const [list, trail] = await Promise.all([
        resourceService.list("local", folderId, targetOwner, targetRoom),
        folderId ? resourceService.breadcrumb(folderId, targetOwner, targetRoom) : Promise.resolve([] as BreadcrumbEntry[]),
      ]);
      const folderList = list.filter(item => item.type === "folder" && item._id !== localMoveTarget?._id && item._id !== "chat-attachments");
      setMoveModalFolders(folderList);
      setMoveModalBreadcrumb(trail);
    } catch (e) {
      toast.error("Không tải được danh sách thư mục đích.");
    } finally {
      setLoadingMoveModal(false);
    }
  }, [moveSpace, userProfile, users, rooms, localMoveTarget]);

  useEffect(() => {
    if (localMoveTarget) {
      void loadMoveModalFolders(moveModalFolder);
    }
  }, [localMoveTarget, moveModalFolder, loadMoveModalFolders]);

  // Local Sharing states
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingItem, setSharingItem] = useState<ResourceItem | null>(null);
  const [sharedList, setSharedList] = useState<Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [savingShares, setSavingShares] = useState(false);

  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTab, setPickerTab] = useState<"Thành viên" | "Nhóm">("Thành viên");
  const [tempSelected, setTempSelected] = useState<Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>>([]);

  // Send to Chat states
  const [showSendToChatModal, setShowSendToChatModal] = useState(false);
  const [sendToChatItem, setSendToChatItem] = useState<ResourceItem | null>(null);
  const [sendToChatTab, setSendToChatTab] = useState<"Thành viên" | "Nhóm">("Thành viên");
  const [sendToChatSearch, setSendToChatSearch] = useState("");
  const [sendingToChatId, setSendingToChatId] = useState<string | null>(null);

  const handleSendToChat = async (targetId: string, targetType: "user" | "room") => {
    if (!sendToChatItem) return;
    setSendingToChatId(targetId);
    try {
      let roomId = "";
      if (targetType === "room") {
        roomId = targetId;
      } else {
        // Chat 1-1: Tìm phòng chat hiện có hoặc tạo mới
        const chatRooms = await internalChatService.getRooms();
        const currentUserId = userProfile?.uid || userProfile?.id;
        const existingRoom = chatRooms.find(r => 
          !r.isGroup && 
          Array.isArray(r.members) &&
          r.members.some(m => m.userId?._id === targetId || m.userId?.uid === targetId) && 
          r.members.some(m => m.userId?._id === currentUserId || m.userId?.uid === currentUserId)
        );

        if (existingRoom) {
          roomId = existingRoom._id;
        } else {
          // Tạo phòng chat 1-1 mới
          const newRoom = await internalChatService.createRoom({
            isGroup: false,
            memberIds: [targetId]
          });
          roomId = newRoom._id;
        }
      }

      // Xây dựng tệp đính kèm
      const attachment = {
        url: sendToChatItem.fileUrl || `${window.location.origin}/resources?id=${sendToChatItem._id}`,
        name: sendToChatItem.name,
        type: sendToChatItem.mimeType || "file",
        size: sendToChatItem.size || 0
      };

      await internalChatService.sendMessage(
        roomId, 
        `Đã gửi tài nguyên: ${sendToChatItem.name}`, 
        [attachment]
      );

      toast.success(`Đã gửi "${sendToChatItem.name}" qua tin nhắn thành công!`);
      setShowSendToChatModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gửi tin nhắn thất bại.");
    } finally {
      setSendingToChatId(null);
    }
  };

  const fetchShares = async (itemId: string) => {
    setLoadingShares(true);
    try {
      const list = await resourceService.getShares(itemId);
      setSharedList(list);
    } catch (e) {
      toast.error("Không lấy được thông tin chia sẻ.");
    } finally {
      setLoadingShares(false);
    }
  };

  const handleSaveShares = async () => {
    if (!sharingItem) return;
    setSavingShares(true);
    try {
      const list = await resourceService.updateShares(sharingItem._id, sharedList);
      setSharedList(list);
      toast.success("Cập nhật chia sẻ thành công!");
      setShowShareModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật chia sẻ thất bại.");
    } finally {
      setSavingShares(false);
    }
  };

  const getPickerItemDetails = (item: { targetId: string; targetType: "user" | "room"; targetName: string }) => {
    if (item.targetType === "user") {
      const u = users.find(x => x._id === item.targetId);
      return {
        name: u?.displayName || u?.email || item.targetName || "Thành viên",
        photoURL: u?.photoURL || "https://www.gravatar.com/avatar?d=mp",
        bgColor: "bg-indigo-500",
      };
    } else {
      const r = rooms.find(x => x._id === item.targetId);
      return {
        name: r?.name || item.targetName || "Nhóm",
        photoURL: "",
        bgColor: "bg-emerald-500",
      };
    }
  };

  const getFilteredPickerItems = () => {
    const search = pickerSearch.toLowerCase().trim();
    if (pickerTab === "Thành viên") {
      const list = users.map(u => ({
        targetId: u._id,
        targetType: "user" as const,
        targetName: u.displayName || u.email || "Thành viên",
      }));
      if (search) {
        return list.filter(item => item.targetName.toLowerCase().includes(search));
      }
      return list;
    } else {
      const list = rooms.map(r => ({
        targetId: r._id,
        targetType: "room" as const,
        targetName: r.name || "Nhóm",
      }));
      if (search) {
        return list.filter(item => item.targetName.toLowerCase().includes(search));
      }
      return list;
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      if (showTrash) {
        const list = await resourceService.listTrash(ownerId, roomId);
        setItems(list);
        setBreadcrumb([]);
      } else {
        const [list, trail] = await Promise.all([
          resourceService.list("local", folderId, ownerId, roomId),
          folderId ? resourceService.breadcrumb(folderId, ownerId, roomId) : Promise.resolve([] as BreadcrumbEntry[]),
        ]);
        setItems(list);
        setBreadcrumb(trail);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được tài nguyên.");
    } finally {
      setLoading(false);
    }
  }, [ownerId, roomId, showTrash]);

  useEffect(() => {
    setCurrentFolder(null);
  }, [showTrash]);

  useEffect(() => {
    load(currentFolder);
  }, [currentFolder, load, refreshTrigger]);

  useEffect(() => {
    if (onFolderChange) {
      onFolderChange(currentFolder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder]);

  // Compute filtered items
  const filteredItems = items.filter((item) => {
    // 1. Lọc theo tên file (Search Query)
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // 2. Lọc theo loại tài nguyên (Filter Type)
    if (filterType) {
      const mime = item.mimeType ? item.mimeType.toLowerCase() : "";
      const name = item.name ? item.name.toLowerCase() : "";
      
      switch (filterType) {
        case "folder":
          if (item.type !== "folder") return false;
          break;
        case "image":
          if (item.type !== "file" || !mime.startsWith("image/")) return false;
          break;
        case "audio":
          if (item.type !== "file" || !mime.startsWith("audio/")) return false;
          break;
        case "video":
          if (item.type !== "file" || !mime.startsWith("video/")) return false;
          break;
        case "pdf":
          if (item.type !== "file" || (mime !== "application/pdf" && !name.endsWith(".pdf"))) return false;
          break;
        case "document":
          // Tài liệu Word, Epub, Txt (Loại trừ PDF vì có tab PDF riêng)
          if (item.type !== "file") return false;
          const isDoc = mime.startsWith("text/") || mime.includes("document") || mime.includes("word") || mime.includes("epub") || name.match(/\.(docx|doc|txt|odt)/);
          const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
          if (!isDoc || isPdf) return false;
          break;
        case "spreadsheet":
          if (item.type !== "file") return false;
          const isSheet = mime.includes("sheet") || mime.includes("excel") || mime.includes("csv") || name.match(/\.(xlsx|xls|csv)/);
          if (!isSheet) return false;
          break;
        case "presentation":
          if (item.type !== "file") return false;
          const isPresentation = mime.includes("presentation") || mime.includes("powerpoint") || name.match(/\.(pptx|ppt)/);
          if (!isPresentation) return false;
          break;
        case "link":
          if (item.type !== "file") return false;
          const isLink = mime.includes("shortcut") || mime.includes("link") || (item.fileUrl && !item.driveFileId && !item.mimeType) || mime.includes("html") || name.match(/\.(html|htm)/);
          if (!isLink) return false;
          break;
        default:
          break;
      }
    }

    // 3. Lọc theo Từ ngày (Filter Start Date)
    if (filterStartDate) {
      const itemDate = new Date(item.createdAt);
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      if (isNaN(itemDate.getTime()) || itemDate < startDate) return false;
    }

    // 4. Lọc theo Đến ngày (Filter End Date)
    if (filterEndDate) {
      const itemDate = new Date(item.createdAt);
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      if (isNaN(itemDate.getTime()) || itemDate > endDate) return false;
    }

    return true;
  });

  useEffect(() => {
    if (onItemsCountChange) {
      onItemsCountChange(filteredItems.length, items.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.length, items.length]);

  const openFolder = (id: string) => {
    setMenuOpenId(null);
    setCurrentFolder(id);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      await resourceService.createFolder(name, currentFolder, "local", ownerId, roomId);
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
      if (showTrash) return;
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
          await resourceService.uploadFile(file, currentFolder, ownerId, roomId);
          ok += 1;
        } catch (e) {
          toast.error(`Lỗi tải "${file.name}": ${e instanceof Error ? e.message : "thất bại"}`);
        }
      }
      if (ok > 0) toast.success(`Đã tải lên ${ok}/${arr.length} tệp.`);
      setUploading(false);
      load(currentFolder);
    },
    [currentFolder, load, isInsideFixedFolder, ownerId, roomId, showTrash]
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

  const handleRestore = async (item: ResourceItem) => {
    try {
      await resourceService.restore(item._id);
      toast.success(`Đã khôi phục "${item.name}" thành công.`);
      load(currentFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Khôi phục tài nguyên thất bại.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await resourceService.remove(deleteTarget._id);
      if (deleteTarget.isDeleted) {
        toast.success(`Đã xóa vĩnh viễn "${deleteTarget.name}".`);
      } else {
        toast.success(`Đã di chuyển "${deleteTarget.name}" vào Thùng rác.`);
      }
      setDeleteTarget(null);
      load(currentFolder);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setDeleting(false);
    }
  };

  const ownItems = filteredItems.filter((i) => !i.isShared);
  const sharedItems = filteredItems.filter((i) => i.isShared);

  const folders = showSharedOnly
    ? sharedItems.filter((i) => i.type === "folder")
    : ownItems.filter((i) => i.type === "folder");
  const files = showSharedOnly
    ? sharedItems.filter((i) => i.type === "file")
    : ownItems.filter((i) => i.type === "file");
  const sharedFolders = sharedItems.filter((i) => i.type === "folder");
  const sharedFiles = sharedItems.filter((i) => i.type === "file");

  // Pagination logic for list view
  const allListItems = [...folders, ...files];
  const listTotalPages = Math.max(1, Math.ceil(allListItems.length / LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, listTotalPages);
  const pagedListItems = allListItems.slice((safeListPage - 1) * LIST_PAGE_SIZE, safeListPage * LIST_PAGE_SIZE);
  const pagedFolders = pagedListItems.filter((i) => i.type === "folder");
  const pagedFiles = pagedListItems.filter((i) => i.type === "file");

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
      {/* Breadcrumb - Only visible when inside a subfolder to match clean root layout */}
      {currentFolder !== null && (
        <div className="flex items-center gap-1 text-sm text-slate-500 pb-3 flex-wrap text-left">
          <button
            onClick={() => setCurrentFolder(null)}
            onDragOver={(e) => {
              if (draggedItemId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              void handleMoveItem(draggedId, "root");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition text-xs font-bold text-slate-700 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <span>Tài liệu</span>
          </button>
          {breadcrumb.map((b, idx) => (
            <React.Fragment key={b._id}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <button
                onClick={() => setCurrentFolder(b._id)}
                onDragOver={(e) => {
                  if (draggedItemId && draggedItemId !== b._id) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  void handleMoveItem(draggedId, b._id);
                }}
                className={`rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition truncate max-w-[160px] text-xs font-bold ${
                  idx === breadcrumb.length - 1 ? "text-slate-800" : "text-slate-500"
                }`}
              >
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Vùng chứa hai cột: Danh sách tài liệu và Bảng thông tin chi tiết */}
      <div className="flex-1 flex overflow-hidden gap-4 min-h-0 relative">


        {/* Vùng nội dung bên trái */}
        <div
          className={`relative flex-1 overflow-y-auto rounded-2xl border ${
            isDragging ? "border-blue-400 border-dashed bg-blue-50/50" : "border-slate-100 bg-slate-50/40"
          } p-4 transition-colors`}
        >
          {isDragging && !isInsideFixedFolder && !showTrash && (
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
                <p className="font-semibold text-slate-500">{showTrash ? "Thùng rác trống" : "Thư mục trống"}</p>
                <p className="text-sm">
                  {showTrash 
                    ? "Các tài liệu đã xóa sẽ tự động bị xóa vĩnh viễn sau 15 ngày."
                    : "Tạo thư mục mới hoặc kéo-thả tệp vào đây để bắt đầu."}
                </p>
              </div>
            </div>
          ) : viewMode === "list" ? (
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-2xl border border-slate-100/80 flex flex-col">
                {/* Table Header */}
                <div className="flex items-center px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 select-none text-left rounded-t-2xl">
                  <div className="flex-1 pl-2">Tên</div>
                  <div className="w-56 pl-4">Ngày tạo</div>
                  <div className="w-32 text-right">Kích thước</div>
                  <div className="w-10"></div>
                </div>

                {/* Table Body (Folders + Files) - paginated */}
                <div className="divide-y divide-slate-100">
                  {/* Render Folders */}
                  {pagedFolders.map((item) => {
                    const isFolder = item.type === "folder";
                    const iconDetails = isFolder ? { Icon: Folder, color: "text-[#5bc0be]" } : getFileIcon(item.mimeType, item.name);
                    const Icon = iconDetails.Icon;

                    return (
                      <div
                        key={item._id}
                        className="group relative flex items-center px-6 py-3.5 hover:bg-slate-50/80 transition text-left text-sm"
                      >
                        {/* Name - clickable */}
                        <div
                          className="flex-1 flex items-center gap-3 min-w-0 pr-4 cursor-pointer"
                          onDoubleClick={() => !showTrash && openFolder(item._id)}
                          onClick={() => !showTrash && openFolder(item._id)}
                        >
                          <div className="relative shrink-0">
                            {item.name.toUpperCase().includes("GOOGLE") ? (
                              <div className="relative">
                                <FolderOpen className="h-6 w-6 text-[#5bc0be]" strokeWidth={1.5} />
                                <div className="absolute inset-0 flex items-center justify-center mt-1">
                                  <GoogleDriveLogo className="h-2.5 w-2.5 bg-white rounded-full p-0.5" />
                                </div>
                              </div>
                            ) : (
                              <Icon className={`h-6 w-6 ${iconDetails.color}`} strokeWidth={1.5} />
                            )}
                          </div>
                          <span className="font-bold text-slate-700 truncate pr-2 hover:text-[#008080] transition-colors">{item.name}</span>
                        </div>
                        <div className="w-56 pl-4 text-slate-500 font-semibold">{formatDate(item.createdAt)}</div>
                        <div className="w-32 text-right text-slate-400 font-semibold">—</div>

                        {/* Options menu - separate from clickable area */}
                        <div className="w-10 flex justify-center">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === item._id ? null : item._id);
                              }}
                              className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {menuOpenId === item._id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-[999] py-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {showTrash ? (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRestore(item); setMenuOpenId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Khôi phục
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setRenameTarget(item); setRenameValue(item.name); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Đổi tên
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setLocalMoveTarget(item); setMoveModalFolder(null); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <ArrowRightLeft className="h-3.5 w-3.5" />
                                      Di chuyển
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSharingItem(item); setShowShareModal(true); void fetchShares(item._id); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <Share2 className="h-3.5 w-3.5" />
                                      Chia sẻ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSendToChatItem(item); setShowSendToChatModal(true); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      Gửi qua tin nhắn
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId(null);
                                        const token = localStorage.getItem("accessToken") || "";
                                        const downloadUrl = `/api/v1/resources/${item._id}/download-zip?token=${encodeURIComponent(token)}`;
                                        window.open(downloadUrl, "_blank");
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <Download className="h-3.5 w-3.5 text-slate-500" />
                                      Tải xuống
                                    </button>
                                  </>
                                )}
                                <div className="border-t border-slate-100 my-0.5"></div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); setMenuOpenId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 rounded-lg font-semibold text-[11px]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {showTrash ? "Xóa vĩnh viễn" : "Xóa"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Render Files */}
                  {pagedFiles.map((item) => {
                    const iconDetails = getFileIcon(item.mimeType, item.name);
                    const Icon = iconDetails.Icon;

                    return (
                      <div
                        key={item._id}
                        className="group relative flex items-center px-6 py-3.5 hover:bg-slate-50/80 transition text-left text-sm"
                      >
                        {/* Name - clickable */}
                        <div
                          className="flex-1 flex items-center gap-3 min-w-0 pr-4 cursor-pointer"
                          onClick={() => {
                            if (showTrash) return;
                            if (item.fileUrl) {
                              const isGoogleDoc = item.mimeType?.startsWith("application/vnd.google-apps") || item.fileUrl.includes("drive.google.com") || item.fileUrl.includes("docs.google.com");
                              if (isGoogleDoc && onOpenFile) {
                                onOpenFile(item);
                              } else {
                                setPreviewItem(item);
                              }
                            }
                          }}
                        >
                          <div className="relative shrink-0">
                            {item.mimeType === "application/vnd.google-apps.spreadsheet" ? (
                              <GoogleSheetsLogo className="w-6 h-6" />
                            ) : item.mimeType === "application/vnd.google-apps.document" ? (
                              <GoogleDocsLogo className="w-6 h-6" />
                            ) : item.mimeType === "application/vnd.google-apps.presentation" ? (
                              <GoogleSlidesLogo className="w-6 h-6" />
                            ) : (
                              <Icon className={`h-6 w-6 ${iconDetails.color}`} strokeWidth={1.5} />
                            )}
                          </div>
                          <span className="font-bold text-slate-700 truncate pr-2 hover:text-[#008080] transition-colors">{item.name}</span>
                        </div>
                        <div className="w-56 pl-4 text-slate-500 font-semibold">{formatDate(item.createdAt)}</div>
                        <div className="w-32 text-right text-slate-500 font-semibold">
                          {item.size ? formatBytes(item.size) : "—"}
                        </div>

                        {/* Options menu - separate from clickable area */}
                        <div className="w-10 flex justify-center">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === item._id ? null : item._id);
                              }}
                              className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {menuOpenId === item._id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-[999] py-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {showTrash ? (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRestore(item); setMenuOpenId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Khôi phục
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setRenameTarget(item); setRenameValue(item.name); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Đổi tên
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setLocalMoveTarget(item); setMoveModalFolder(null); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <ArrowRightLeft className="h-3.5 w-3.5" />
                                      Di chuyển
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSharingItem(item); setShowShareModal(true); void fetchShares(item._id); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <Share2 className="h-3.5 w-3.5" />
                                      Chia sẻ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSendToChatItem(item); setShowSendToChatModal(true); setMenuOpenId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      Gửi qua tin nhắn
                                    </button>
                                    {item.fileUrl && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenuOpenId(null);
                                          const token = localStorage.getItem("accessToken") || "";
                                          const downloadUrl = `/api/v1/media/download?url=${encodeURIComponent(item.fileUrl!)}&filename=${encodeURIComponent(item.name)}&token=${encodeURIComponent(token)}`;
                                          window.open(downloadUrl, "_blank");
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold text-[11px]"
                                      >
                                        <Download className="h-3.5 w-3.5 text-slate-500" />
                                        Tải xuống
                                      </button>
                                    )}
                                  </>
                                )}
                                <div className="border-t border-slate-100 my-0.5"></div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); setMenuOpenId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 rounded-lg font-semibold text-[11px]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {showTrash ? "Xóa vĩnh viễn" : "Xóa"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination for list view */}
              {listTotalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-2">
                  <span className="text-xs text-slate-500 font-semibold">
                    {allListItems.length} mục • Trang {safeListPage}/{listTotalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setListPage(p => Math.max(1, p - 1))}
                      disabled={safeListPage === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: listTotalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === listTotalPages || Math.abs(p - safeListPage) <= 1)
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
                            onClick={() => setListPage(p as number)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                              safeListPage === p
                                ? "bg-[#008080] text-white shadow-sm"
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
                      onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))}
                      disabled={safeListPage === listTotalPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
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
                  onOpen={() => {
                    if (!showTrash) openFolder(item._id);
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
                  showTrash={showTrash}
                  onRestore={() => {
                    handleRestore(item);
                    setMenuOpenId(null);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item._id);
                    setDraggedItemId(item._id);
                  }}
                  onDragEnd={() => {
                    setDraggedItemId(null);
                    setDragOverFolderId(null);
                  }}
                  onDragOver={(e) => {
                    if (!showTrash && draggedItemId && draggedItemId !== item._id) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverFolderId(item._id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverFolderId === item._id) {
                      setDragOverFolderId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain");
                    void handleMoveItem(draggedId, item._id);
                    setDragOverFolderId(null);
                  }}
                  isDraggedOver={dragOverFolderId === item._id}
                  onMoveClick={() => {
                    setLocalMoveTarget(item);
                    setMoveModalFolder(null);
                    setMenuOpenId(null);
                  }}
                  onShare={() => {
                    setSharingItem(item);
                    setShowShareModal(true);
                    void fetchShares(item._id);
                  }}
                  onSendToChat={() => {
                    setSendToChatItem(item);
                    setShowSendToChatModal(true);
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
                  onOpen={() => {
                    if (showTrash) return;
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
                  showTrash={showTrash}
                  onRestore={() => {
                    handleRestore(item);
                    setMenuOpenId(null);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item._id);
                    setDraggedItemId(item._id);
                  }}
                  onDragEnd={() => {
                    setDraggedItemId(null);
                  }}
                  onMoveClick={() => {
                    setLocalMoveTarget(item);
                    setMoveModalFolder(null);
                    setMenuOpenId(null);
                  }}
                  onShare={() => {
                    setSharingItem(item);
                    setShowShareModal(true);
                    void fetchShares(item._id);
                  }}
                  onSendToChat={() => {
                    setSendToChatItem(item);
                    setShowSendToChatModal(true);
                  }}
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

      {/* Modal di chuyển tài nguyên */}
      {localMoveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setLocalMoveTarget(null)}
        >
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl relative flex flex-col min-h-[480px] max-h-[90vh] animate-scaleUp" onClick={(e) => e.stopPropagation()}>
            
            {/* Header: Chọn thư mục + Dropdown chọn không gian + Nút thêm thư mục */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 relative z-50 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-slate-800">Chọn thư mục</span>
                
                <div className="relative">
                  {/* Dropdown Button */}
                  <button
                    onClick={() => setShowMoveSpaceDropdown(!showMoveSpaceDropdown)}
                    className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-sm font-bold text-slate-700 max-w-[260px]"
                  >
                    <span className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                      {getSpaceDetails(moveSpace).name.substring(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate">{getSpaceDetails(moveSpace).name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 rotate-90 shrink-0" />
                  </button>

                  {/* Dropdown Popover */}
                  {showMoveSpaceDropdown && (
                    <div className="absolute left-0 top-10 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl text-left animate-fadeIn">
                      {/* Search */}
                      <div className="relative mb-2.5">
                        <input
                          type="text"
                          placeholder="Tìm kiếm"
                          value={moveSpaceSearch}
                          onChange={(e) => setMoveSpaceSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"
                        />
                        <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>

                      {/* Tabs */}
                      <div className="flex gap-1 mb-2.5 border-b border-slate-100 pb-1.5">
                        {(["Thành viên", "Nhóm"] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setMoveSpaceTab(tab)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
                              moveSpaceTab === tab
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      {/* Items List */}
                      <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin pr-1">
                        {getFilteredMoveSpaces().map((item) => (
                          <div
                            key={item._id}
                            onClick={() => {
                              setMoveSpace(item._id);
                              setMoveModalFolder(null);
                              setShowMoveSpaceDropdown(false);
                            }}
                            className={`flex items-center gap-3 px-2.5 py-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition text-sm font-bold text-slate-700 ${
                              moveSpace === item._id ? "bg-blue-50/40 text-blue-600" : ""
                            }`}
                          >
                            <span className={`h-7 w-7 rounded-full text-[11px] flex items-center justify-center shrink-0 text-white font-bold uppercase ${
                              moveSpaceTab === "Thành viên" ? "bg-indigo-500" : "bg-emerald-500"
                            }`}>
                              {item.displayName ? item.displayName.substring(0, 2) : (item.name ? item.name.substring(0, 2) : "GP")}
                            </span>
                            <span className="truncate flex-1">{item.displayName || item.name}</span>
                            {moveSpaceTab === "Nhóm" && (
                              <svg className="h-3.5 w-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Close and Create Folder buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsCreatingFolderInModal(!isCreatingFolderInModal)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-emerald-600 hover:text-emerald-700 transition cursor-pointer"
                  title="Tạo thư mục mới"
                >
                  <FolderPlus className="h-5.5 w-5.5" />
                </button>
                <button
                  onClick={() => setLocalMoveTarget(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Breadcrumb Path in Modal */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/50 mb-3 overflow-x-auto min-h-[36px] shrink-0">
              <button
                onClick={() => setMoveModalFolder(null)}
                className={`hover:text-blue-600 font-bold cursor-pointer shrink-0 ${!moveModalFolder ? "text-blue-600 font-black" : ""}`}
              >
                Gốc
              </button>
              {moveModalBreadcrumb.map((b) => (
                <React.Fragment key={b._id}>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() => setMoveModalFolder(b._id)}
                    className={`hover:text-blue-600 font-bold cursor-pointer shrink-0 max-w-[120px] truncate ${moveModalFolder === b._id ? "text-blue-600 font-black" : ""}`}
                    title={b.name}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Inline Folder Creation Block */}
            {isCreatingFolderInModal && (
              <div className="flex gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/50 mb-3 shrink-0">
                <input
                  autoFocus
                  placeholder="Tên thư mục mới..."
                  value={newFolderInModalName}
                  onChange={(e) => setNewFolderInModalName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolderInModal()}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-white font-semibold text-slate-700"
                />
                <button
                  onClick={handleCreateFolderInModal}
                  disabled={creatingFolderInModal || !newFolderInModalName.trim()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition cursor-pointer"
                >
                  Tạo
                </button>
                <button
                  onClick={() => { setIsCreatingFolderInModal(false); setNewFolderInModalName(""); }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}

            {/* Folder Browser Area */}
            <div className="flex-1 overflow-y-auto border border-slate-200/60 rounded-2xl divide-y divide-slate-100 p-2 min-h-[220px] flex flex-col justify-start">
              {loadingMoveModal ? (
                <div className="flex flex-1 items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                </div>
              ) : moveModalFolders.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-slate-400 text-xs gap-3">
                  <FolderOpen className="h-12 w-12 text-slate-300" strokeWidth={1.1} />
                  <span className="font-semibold text-slate-400 text-sm">Không có thư mục con nào.</span>
                </div>
              ) : (
                moveModalFolders.map((f) => (
                  <div
                    key={f._id}
                    onClick={() => setMoveModalFolder(f._id)}
                    className="flex items-center gap-3.5 px-3.5 py-3 hover:bg-slate-50 rounded-xl cursor-pointer transition text-left group"
                  >
                    <Folder className="h-6 w-6 text-[#5bc0be] group-hover:scale-105 transition shrink-0" strokeWidth={2} />
                    <span className="text-sm font-bold text-slate-700 truncate flex-1">{f.name}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                  </div>
                ))
              )}
            </div>

            {/* Footer with Path + Cancel & Save buttons */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 shrink-0">
              <div className="text-sm text-slate-500 font-bold max-w-[360px] truncate">
                Di chuyển đến: <span className="text-slate-800 font-black">
                  {getSpaceDetails(moveSpace).name}
                  {moveModalBreadcrumb.map(b => ` / ${b.name}`)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLocalMoveTarget(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-extrabold text-slate-600 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleMoveItem(localMoveTarget._id, moveModalFolder)}
                  disabled={loadingMoveModal || (localMoveTarget.parentId === moveModalFolder && (
                    (roomId && moveSpace === roomId) ||
                    (ownerId && moveSpace === ownerId) ||
                    (!roomId && !ownerId && moveSpace === "personal")
                  ))}
                  className="px-6 py-2.5 rounded-xl bg-[#009b94] hover:bg-[#00827d] text-sm font-extrabold text-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Đồng ý
                </button>
              </div>
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
        title={
          deleteTarget?.isDeleted 
            ? (deleteTarget.type === "folder" ? "Xóa vĩnh viễn thư mục?" : "Xóa vĩnh viễn tệp?") 
            : (deleteTarget?.type === "folder" ? "Di chuyển thư mục vào Thùng rác?" : "Di chuyển tệp vào Thùng rác?")
        }
        description={
          deleteTarget?.isDeleted 
            ? `Mục "${deleteTarget?.name}" và tất cả nội dung con bên trong sẽ bị xóa vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác.`
            : `Mục "${deleteTarget?.name}" sẽ được di chuyển vào Thùng rác và tự động xóa vĩnh viễn sau 15 ngày.`
        }
        confirmLabel={deleteTarget?.isDeleted ? "Xóa vĩnh viễn" : "Bỏ vào Thùng rác"}
        tone="danger"
        isSubmitting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {/* Modal Chia sẻ tài nguyên */}
      {showShareModal && sharingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setShowShareModal(false)}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl relative flex flex-col max-h-[85vh] animate-scaleUp text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Chia sẻ tài nguyên</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[160px] py-2 flex flex-col justify-start">
              {loadingShares ? (
                <div className="flex flex-1 items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : sharedList.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-6 leading-relaxed">
                  Tài nguyên này chưa được chia sẻ với ai. Thêm thành viên, nhóm, lĩnh vực/dự án để chia sẻ ngay.
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang chia sẻ với:</p>
                  {sharedList.map((item) => {
                    const details = getPickerItemDetails(item);
                    return (
                      <div key={item.targetId} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {details.photoURL ? (
                            <img src={details.photoURL} alt={details.name} className="h-7 w-7 rounded-full object-cover bg-slate-200" />
                          ) : (
                            <span className={`h-7 w-7 rounded-full text-[10px] flex items-center justify-center text-white font-bold uppercase shrink-0 ${details.bgColor}`}>
                              {details.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{details.name}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{item.targetType === "user" ? "Thành viên" : "Nhóm"}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSharedList(prev => prev.filter(x => x.targetId !== item.targetId))}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add target button */}
              <button
                onClick={() => {
                  setTempSelected([...sharedList]);
                  setShowPickerModal(true);
                }}
                className="mt-2 w-full py-2.5 px-4 rounded-xl bg-[#009b94] hover:bg-[#00827d] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Thêm thành viên, nhóm, lĩnh vực/dự án
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-extrabold text-slate-600 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveShares}
                disabled={savingShares}
                className="px-6 py-2 rounded-xl bg-[#009b94] hover:bg-[#00827d] text-xs font-extrabold text-white transition disabled:opacity-50 cursor-pointer"
              >
                {savingShares ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chọn thành viên, nhóm, lĩnh vực/dự án */}
      {showPickerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setShowPickerModal(false)}
        >
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl relative flex flex-col min-h-[500px] max-h-[90vh] animate-scaleUp text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Chọn thành viên, nhóm, lĩnh vực/dự án</h3>
              <button
                onClick={() => setShowPickerModal(false)}
                className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-[300px]">
              {/* Left Column: List browser */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search box */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Tìm kiếm"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"
                  />
                  <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1.5 border-b border-slate-100 shrink-0 select-none">
                  {(["Thành viên", "Nhóm"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setPickerTab(tab)}
                      className={`px-3 py-1 rounded-full text-xs font-black transition whitespace-nowrap cursor-pointer ${
                        pickerTab === tab
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Items List browser */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-1">
                  {getFilteredPickerItems().map((item) => {
                    const details = getPickerItemDetails(item);
                    const isChecked = tempSelected.some(x => x.targetId === item.targetId);
                    return (
                      <div
                        key={item.targetId}
                        onClick={() => {
                          if (isChecked) {
                            setTempSelected(prev => prev.filter(x => x.targetId !== item.targetId));
                          } else {
                            setTempSelected(prev => [...prev, item]);
                          }
                        }}
                        className={`flex items-center gap-3.5 px-3 py-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition text-left ${
                          isChecked ? "bg-blue-50/20" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition shrink-0 ${
                          isChecked ? "bg-[#009b94] border-[#009b94] text-white" : "border-slate-300"
                        }`}>
                          {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </div>

                        {/* Avatar */}
                        {details.photoURL ? (
                          <img src={details.photoURL} alt={details.name} className="h-8 w-8 rounded-full object-cover bg-slate-200 shrink-0" />
                        ) : (
                          <span className={`h-8 w-8 rounded-full text-xs flex items-center justify-center text-white font-bold uppercase shrink-0 ${details.bgColor}`}>
                            {details.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}

                        <span className="text-sm font-bold text-slate-700 truncate flex-1">{details.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="w-[1px] bg-slate-100 shrink-0" />

              {/* Right Column: Selected list summary */}
              <div className="w-64 flex flex-col overflow-hidden">
                <div className="mb-3 shrink-0 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-800">Đã chọn {tempSelected.length}</span>
                  {tempSelected.length > 0 && (
                    <button
                      onClick={() => setTempSelected([])}
                      className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {tempSelected.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                      <span>Chưa chọn đối tượng nào</span>
                    </div>
                  ) : (
                    tempSelected.map((item) => {
                      const details = getPickerItemDetails(item);
                      return (
                        <div key={item.targetId} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200/40">
                          <span className="text-xs font-bold text-slate-700 truncate flex-1 pr-2">{details.name}</span>
                          <button
                            onClick={() => setTempSelected(prev => prev.filter(x => x.targetId !== item.targetId))}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 shrink-0">
              <button
                onClick={() => setShowPickerModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-extrabold text-slate-600 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setSharedList(tempSelected);
                  setShowPickerModal(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#009b94] hover:bg-[#00827d] text-sm font-extrabold text-white transition cursor-pointer"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gửi qua tin nhắn (Send to chat) */}
      {showSendToChatModal && sendToChatItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setShowSendToChatModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl relative flex flex-col min-h-[500px] max-h-[85vh] animate-scaleUp text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title and New Chat Group Button */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">Send to chat</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    toast.info("Tính năng tạo nhóm chat mới từ đây đang được phát triển.");
                  }}
                  className="flex items-center gap-1.5 bg-[#008080] hover:bg-[#006666] text-white rounded-full px-4 py-2 transition text-xs font-black shadow-sm cursor-pointer active:scale-95 animate-fadeIn"
                >
                  <Users className="h-4 w-4" />
                  <span>Nhóm chat mới</span>
                </button>
                <button
                  onClick={() => setShowSendToChatModal(false)}
                  className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sub Tabs: Member and Group */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <button
                onClick={() => setSendToChatTab("Thành viên")}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer ${
                  sendToChatTab === "Thành viên"
                    ? "bg-slate-100 text-[#008080] border border-[#008080]/30 font-black shadow-xs"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                Thành viên
              </button>
              <button
                onClick={() => setSendToChatTab("Nhóm")}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer ${
                  sendToChatTab === "Nhóm"
                    ? "bg-slate-100 text-[#008080] border border-[#008080]/30 font-black shadow-xs"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                Nhóm
              </button>
            </div>

            {/* Search Box */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Tìm kiếm ${sendToChatTab.toLowerCase()}...`}
                value={sendToChatSearch}
                onChange={(e) => setSendToChatSearch(e.target.value)}
                className="w-full text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 focus:outline-hidden focus:ring-2 focus:ring-[#008080]/20 text-slate-700 font-bold"
              />
            </div>

            {/* Target List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-[250px]">
              {(() => {
                const search = sendToChatSearch.toLowerCase().trim();
                const currentUserId = userProfile?.uid || userProfile?.id;

                if (sendToChatTab === "Thành viên") {
                  const filteredUsers = users.filter((u) => {
                    if (!u) return false;
                    const name = String(u.displayName || u.email || "");
                    return name.toLowerCase().includes(search);
                  });

                  if (filteredUsers.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                        <span>Không tìm thấy thành viên nào</span>
                      </div>
                    );
                  }

                  return filteredUsers.map((u) => {
                    if (!u) return null;
                    const isMe = (u.uid || u._id) === currentUserId;
                    const rawName = String(u.displayName || u.email || "TV");
                    const initials = rawName.trim().split(/\s+/).map((x) => x ? x[0] : "").join("").slice(0, 2).toUpperCase() || "TV";
                    const isSending = sendingToChatId === u._id;

                    return (
                      <div
                        key={u._id}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={rawName} className="h-9 w-9 rounded-full object-cover bg-slate-200 shrink-0" />
                          ) : (
                            <span className="h-9 w-9 rounded-full text-xs flex items-center justify-center text-white font-bold bg-purple-600 shrink-0">
                              {initials}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                              {rawName}
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-bold">Tôi</span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{u.email || ""}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSendToChat(u._id, "user")}
                          disabled={sendingToChatId !== null}
                          className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-[#008080] text-slate-600 hover:text-white text-xs font-black transition cursor-pointer active:scale-95 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isSending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span>Gửi</span>
                          )}
                        </button>
                      </div>
                    );
                  });
                } else {
                  // Tab Nhóm
                  const filteredRooms = rooms.filter((r) => {
                    if (!r) return false;
                    const name = String(r.name || "Nhóm");
                    return name.toLowerCase().includes(search);
                  });

                  if (filteredRooms.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                        <span>Không tìm thấy nhóm nào</span>
                      </div>
                    );
                  }

                  return filteredRooms.map((r) => {
                    if (!r) return null;
                    const rawName = String(r.name || "Nhóm");
                    const initials = rawName.trim().split(/\s+/).map((x) => x ? x[0] : "").join("").slice(0, 2).toUpperCase() || "N";
                    const isSending = sendingToChatId === r._id;

                    return (
                      <div
                        key={r._id}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {r.avatarURL ? (
                            <img src={r.avatarURL} alt={rawName} className="h-9 w-9 rounded-full object-cover bg-slate-200 shrink-0" />
                          ) : (
                            <span className="h-9 w-9 rounded-full text-xs flex items-center justify-center text-white font-bold bg-emerald-600 shrink-0">
                              {initials}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{rawName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{r.members?.length || 0} thành viên</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSendToChat(r._id, "room")}
                          disabled={sendingToChatId !== null}
                          className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-[#008080] text-slate-600 hover:text-white text-xs font-black transition cursor-pointer active:scale-95 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isSending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span>Gửi</span>
                          )}
                        </button>
                      </div>
                    );
                  });
                }
              })()}
            </div>
          </div>
        </div>
      )}

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
  showTrash?: boolean;
  onRestore?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDraggedOver?: boolean;
  onMoveClick?: () => void;
  onShare?: () => void;
  onSendToChat?: () => void;
}> = ({
  item,
  menuOpen,
  onToggleMenu,
  onOpen,
  onRename,
  onDelete,
  onShowInfo,
  showTrash = false,
  onRestore,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDraggedOver = false,
  onMoveClick,
  onShare,
  onSendToChat,
}) => {
  const isFolder = item.type === "folder";
  const { Icon, color } = isFolder ? { Icon: Folder, color: "text-[#5bc0be]" } : getFileIcon(item.mimeType, item.name);

  return (
    <div
      onDoubleClick={onOpen}
      draggable={!item.isFixed && !showTrash}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex flex-col items-center justify-between border rounded-3xl p-5 transition-all duration-300 ease-out select-none cursor-pointer text-center w-40 h-44 bg-white shadow-xs hover:shadow-lg hover:border-slate-200 hover:-translate-y-1 ${
        isDraggedOver
          ? "bg-slate-50 border-[#10b981] border-dashed scale-105 shadow-md"
          : "border-slate-100 hover:bg-slate-50/30"
      } ${menuOpen ? "z-50" : "z-0"}`}
    >
      {/* Badge chia sẻ */}
      {item.isShared && (
        <div className="absolute top-1.5 left-2 z-10">
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#009b94]/10 text-[#009b94] text-[9px] font-black tracking-wide">
            <Share2 className="h-2.5 w-2.5" />
            Chia sẻ
          </span>
        </div>
      )}
      {/* Three-dot menu button */}
      <div className={`absolute top-2.5 right-2.5 z-10 transition-all duration-200 ${menuOpen ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"}`}>
        <button
          onClick={onToggleMenu}
          className="w-7 h-7 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center shadow-md border border-slate-100 transition duration-150 active:scale-90 cursor-pointer"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <div
            className="absolute left-2 top-9 z-[999] w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {showTrash ? (
              <>
                {/* Khôi phục */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4 text-emerald-500" />
                  <span>Khôi phục</span>
                </button>

                {/* Xóa vĩnh viễn */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <span>Xóa vĩnh viễn</span>
                </button>
              </>
            ) : (
              <>
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
                    onMoveClick?.();
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
                    onShare?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Share2 className="h-4 w-4 text-slate-500" />
                  <span>Chia sẻ</span>
                </button>
                {/* Tải xuống */}
                {(isFolder || item.fileUrl) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMenu(e); // Close menu
                      const token = localStorage.getItem("accessToken") || "";
                      const downloadUrl = isFolder
                        ? `/api/v1/resources/${item._id}/download-zip?token=${encodeURIComponent(token)}`
                        : `/api/v1/media/download?url=${encodeURIComponent(item.fileUrl!)}&filename=${encodeURIComponent(item.name)}&token=${encodeURIComponent(token)}`;
                      window.open(downloadUrl, "_blank");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    <span>Tải xuống</span>
                  </button>
                )}

                {/* Gửi qua tin nhắn */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMenu(e); // Close menu
                    onSendToChat?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4 text-slate-500" />
                  <span>Gửi qua tin nhắn</span>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Center Icon */}
      <div className="flex-1 flex items-center justify-center mt-4 w-full" onClick={onOpen}>
        {isFolder && item.name.toUpperCase().includes("GOOGLE") ? (
          <div className="relative p-3.5 bg-[#5bc0be]/5 rounded-2xl group-hover:bg-[#5bc0be]/10 transition duration-300">
            <FolderOpen className="h-11 w-11 text-[#5bc0be]" strokeWidth={1.5} />
            <div className="absolute bottom-1 right-1 flex items-center justify-center">
              <GoogleDriveLogo className="h-4 w-4 bg-white rounded-full p-0.5 shadow-xs" />
            </div>
          </div>
        ) : item.mimeType === "application/vnd.google-apps.spreadsheet" ? (
          <GoogleSheetsLogo className="w-16 h-16" />
        ) : item.mimeType === "application/vnd.google-apps.document" ? (
          <GoogleDocsLogo className="w-16 h-16" />
        ) : item.mimeType === "application/vnd.google-apps.presentation" ? (
          <GoogleSlidesLogo className="w-16 h-16" />
        ) : !isFolder && item.mimeType?.startsWith("image/") && item.fileUrl ? (
          <div className="relative w-32 h-20 flex items-center justify-center rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-300">
            <img src={item.fileUrl} alt={item.name} className="h-full w-full object-cover" />
            <div className="absolute bottom-1 left-1 bg-[#ff7b00] text-white p-0.5 rounded-xs shadow-xs">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          </div>
        ) : (
          <div className={`p-3.5 rounded-2xl transition duration-300 ${
            isFolder 
              ? "bg-amber-50 group-hover:bg-amber-100/70" 
              : item.mimeType === "text/html" 
                ? "bg-teal-50 group-hover:bg-teal-100/70"
                : "bg-slate-50 group-hover:bg-slate-100/70"
          }`}>
            <Icon className={`w-11 h-11 ${color}`} strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-auto w-full pt-3" onClick={onOpen}>
        <p className="truncate text-xs font-bold text-slate-800 px-0.5" title={item.name}>
          {item.name}
        </p>
        <p className="truncate text-[10px] text-slate-400 font-semibold mt-1">
          {showTrash ? (
            (() => {
              if (!item.deletedAt) return "Còn 15 ngày";
              const delDate = new Date(item.deletedAt);
              const expiry = delDate.getTime() + 15 * 24 * 60 * 60 * 1000;
              const diff = expiry - Date.now();
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
              return days > 0 ? `Còn ${days} ngày` : "Sắp xóa";
            })()
          ) : (
            `${
              isFolder 
                ? "Thư mục" 
                : item.mimeType === "text/html" 
                  ? "Liên kết" 
                  : formatBytes(item.size)
            } · ${formatDate(item.createdAt)}`
          )}
        </p>
      </div>
    </div>
  );
};
