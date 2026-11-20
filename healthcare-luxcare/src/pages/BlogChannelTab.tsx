import { BlogSafetyPanel } from "../components/blog/BlogSafetyPanel";
import { blogModerationService } from "../services/blogModerationService";
import { AttachmentVisibilityChoice } from "../components/blog/AttachmentVisibilityChoice";
import { BlogAttachmentActions } from "../components/blog/BlogAttachmentActions";
import { ProtectedBlogMedia } from "../components/blog/ProtectedBlogMedia";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send,
  Pin,
  Heart,
  Search,
  Lock,
  Sparkles,
  Megaphone,
  Filter,
  Trash2,
  Bookmark,
  Share2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Tag,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  ExternalLink,
  X,
  Eye,
  Loader2,
  Link2,
  MessageSquare,
} from "lucide-react";
import {
  listBlogPosts,
  createBlogPost,
  toggleLikeBlogPost,
  togglePinBlogPost,
  deleteBlogPost,
  getBlogChannelInfo,
  uploadBlogAttachment,
  updateBlogAttachmentVisibility,
  BlogPostItem,
  BlogChannelInfo,
  BlogAttachment,
} from "../services/blogService";
import { socketService } from "../services/socketService";
import { useAuth } from "../context/AuthContext";
import LegalKnowledgePanel from "../components/blog/LegalKnowledgePanel";
import LegalKnowledgeProgress from "../components/blog/LegalKnowledgeProgress";

const AVAILABLE_TAGS = ["Thông báo", "Tin tức", "Sự kiện", "Chính sách", "Khen thưởng", "Chia sẻ"];

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(att: { url: string; name?: string; type?: string }): boolean {
  if (att.type?.startsWith("image/")) return true;
  const ext = (att.name || att.url).split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

function isVideoAttachment(att: { url: string; name?: string; type?: string }): boolean {
  if (att.type?.startsWith("video/")) return true;
  const ext = (att.name || att.url).split(".").pop()?.toLowerCase() || "";
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

function isAudioAttachment(att: { url: string; name?: string; type?: string }): boolean {
  if (att.type?.startsWith("audio/")) return true;
  const ext = (att.name || att.url).split(".").pop()?.toLowerCase() || "";
  return ["mp3", "wav", "m4a", "aac"].includes(ext);
}

function getFileIcon(att: { name?: string; type?: string }) {
  const ext = (att.name || "").split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return <FileText className="w-5 h-5 text-rose-500" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  if (["doc", "docx"].includes(ext)) return <FileText className="w-5 h-5 text-blue-500" />;
  return <File className="w-5 h-5 text-indigo-500" />;
}

export default function BlogChannelTab() {
  const [showLegalKnowledge, setShowLegalKnowledge] = useState(false);
  const [legalPostId, setLegalPostId] = useState("");
  const { user } = useAuth();

  const [safety, setSafety] = useState<{ mode: "report" | "block" | "blocks"; post?: BlogPostItem } | null>(null);
  const blockedAuthors = useRef(new Set<string>());
  const blogRequestVersion = useRef(0);
  const [posts, setPosts] = useState<BlogPostItem[]>([]);
  const [channelInfo, setChannelInfo] = useState<BlogChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Popup tìm kiếm theo phong cách Zalo (Tin nhắn, File, Link, Media)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<"messages" | "media" | "files" | "links">("messages");
  const [popupSearchQuery, setPopupSearchQuery] = useState("");
  const [popupSelectedTag, setPopupSelectedTag] = useState<string>("all");
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  // Cuộn nhanh tới bài viết khi chọn kết quả tìm kiếm
  const jumpToPost = (postId: string) => {
    setIsSearchOpen(false);
    setHighlightedPostId(postId);
    setTimeout(() => {
      const el = document.getElementById(`blog-post-${postId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    setTimeout(() => {
      setHighlightedPostId(null);
    }, 3000);
  };

  // Form soạn tin nhắn (Dành cho tài khoản đặc quyền)
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [selectedPostTags, setSelectedPostTags] = useState<string[]>(["Thông báo"]);
  const [isPinnedPost, setIsPinnedPost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tệp đính kèm đa phương tiện
  const [attachments, setAttachments] = useState<BlogAttachment[]>([]);
  const [attachmentsPublic, setAttachmentsPublic] = useState(false);
  const [visibilityPost, setVisibilityPost] = useState<BlogPostItem | null>(null);
  const [visibilityValue, setVisibilityValue] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    setActionError(null);
    try {
      const uploadedList: BlogAttachment[] = [];
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`Tệp "${file.name}" vượt quá dung lượng cho phép (tối đa 20MB)`);
        }
        const uploaded = await uploadBlogAttachment(file);
        uploadedList.push(uploaded);
      }
      setAttachments((prev) => [...prev, ...uploadedList]);
    } catch (err: any) {
      console.error("[BlogChannelTab] Upload attachment error:", err);
      setActionError(err.message || "Lỗi khi tải tệp lên");
    } finally {
      setUploadingFiles(false);
      if (e.target) e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Cuộn xuống cuối — dùng scrollTop trực tiếp trên container để tránh
  // scrollIntoView cuộn cả trang thay vì chỉ cuộn bên trong div
  const scrollToBottom = (smooth = true) => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Tải dữ liệu ban đầu
  const loadData = async (isManualRefresh = false) => {
    const version = ++blogRequestVersion.current;
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [info, result, blocks] = await Promise.all([
        getBlogChannelInfo().catch(() => null),
        listBlogPosts({
          limit: 100,
        }),
        blogModerationService.blocks(),
      ]);

      if (version !== blogRequestVersion.current) return;
      blockedAuthors.current = new Set(blocks.map(block => block.authorId));
      if (info) setChannelInfo(info);
      setPosts((result.posts || []).filter(post => !blockedAuthors.current.has(String(post.authorId))));
    } catch (err: any) {
      if (version !== blogRequestVersion.current) return;
      console.error("[BlogChannelTab] Error loading posts:", err);
      setActionError(err.message || "Không thể tải danh sách bài viết blog");
    } finally {
      if (version === blogRequestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };


  useEffect(() => {
    loadData();
  }, []);

  // Cuộn xuống cuối ngay sau khi posts được render lần đầu tiên
  const isFirstPostsLoad = useRef(true);
  useEffect(() => {
    if (posts.length > 0 && isFirstPostsLoad.current) {
      isFirstPostsLoad.current = false;
      // requestAnimationFrame đảm bảo DOM đã render xong trước khi scroll
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [posts]);


  const filteredMessages = useMemo(() => {
    const q = popupSearchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (popupSelectedTag === "pinned") {
        if (!p.isPinned) return false;
      } else if (popupSelectedTag !== "all" && !p.tags?.includes(popupSelectedTag)) {
        return false;
      }
      if (!q) return true;
      return (
        p.content?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.authorName?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [posts, popupSearchQuery, popupSelectedTag]);

  // Trích xuất toàn bộ ảnh và video trong kênh
  const allMediaItems = useMemo(() => {
    const list: { post: BlogPostItem; attachment: BlogAttachment }[] = [];
    posts.forEach((p) => {
      p.attachments?.forEach((att) => {
        if (isImageAttachment(att) || isVideoAttachment(att)) {
          list.push({ post: p, attachment: att });
        }
      });
    });
    const q = popupSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.attachment.name?.toLowerCase().includes(q) ||
        item.post.content?.toLowerCase().includes(q) ||
        item.post.authorName?.toLowerCase().includes(q),
    );
  }, [posts, popupSearchQuery]);

  // Trích xuất toàn bộ tài liệu / file đính kèm
  const allDocumentItems = useMemo(() => {
    const list: { post: BlogPostItem; attachment: BlogAttachment }[] = [];
    posts.forEach((p) => {
      p.attachments?.forEach((att) => {
        if (!isImageAttachment(att) && !isVideoAttachment(att)) {
          list.push({ post: p, attachment: att });
        }
      });
    });
    const q = popupSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.attachment.name?.toLowerCase().includes(q) ||
        item.post.content?.toLowerCase().includes(q) ||
        item.post.authorName?.toLowerCase().includes(q),
    );
  }, [posts, popupSearchQuery]);

  // Trích xuất toàn bộ đường link (URL) có trong bài viết
  const allLinkItems = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const list: { url: string; domain: string; post: BlogPostItem; snippet: string }[] = [];
    posts.forEach((p) => {
      if (!p.content) return;
      const matches = p.content.match(urlRegex);
      if (matches) {
        matches.forEach((url) => {
          let domain = url;
          try {
            domain = new URL(url).hostname;
          } catch {
            // ignore
          }
          list.push({
            url,
            domain,
            post: p,
            snippet: p.content.slice(0, 120),
          });
        });
      }
    });
    const q = popupSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.url.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q) ||
        item.post.content.toLowerCase().includes(q) ||
        item.post.authorName.toLowerCase().includes(q),
    );
  }, [posts, popupSearchQuery]);

  // Đăng ký Realtime Socket.IO
  useEffect(() => {
    const unsubCreated = socketService.on("blog_post_created", (newPost: BlogPostItem) => {
      setPosts((prev) => {
        if (blockedAuthors.current.has(String(newPost.authorId)) || prev.some((p) => p.id === newPost.id)) return prev;
        return [...prev, newPost];
      });
      setTimeout(() => scrollToBottom(true), 100);
    });

    const unsubLiked = socketService.on(
      "blog_post_liked",
      (data: { postId: string; likesCount: number; userId: string; isLiked: boolean }) => {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === data.postId) {
              const isCurrentUser = data.userId === user?.uid;
              return {
                ...p,
                likesCount: data.likesCount,
                isLiked: isCurrentUser ? data.isLiked : p.isLiked,
              };
            }
            return p;
          }),
        );
      },
    );

    const unsubPinned = socketService.on(
      "blog_post_pinned",
      (data: { postId: string; isPinned: boolean }) => {
        setPosts((prev) =>
          prev.map((p) => (p.id === data.postId ? { ...p, isPinned: data.isPinned } : p)),
        );
      },
    );

    const unsubUpdated = socketService.on("blog_post_updated", (data: { postId: string; attachmentsPublic: boolean }) => {
      setPosts(prev => prev.map(post => post.id === data.postId ? { ...post, attachmentsPublic: data.attachmentsPublic } : post));
    });
    const unsubDeleted = socketService.on("blog_post_deleted", (data: { postId: string }) => {
      setPosts((prev) => prev.filter((p) => p.id !== data.postId));
    });

    return () => {
      unsubCreated();
      unsubLiked();
      unsubPinned();
      unsubDeleted();
      unsubUpdated();
    };
  }, [user]);

  const saveVisibility = async () => {
    if (!visibilityPost || visibilityBusy) return;
    setVisibilityBusy(true); setVisibilityError("");
    try {
      await updateBlogAttachmentVisibility(visibilityPost.id, visibilityValue);
      setPosts(prev => prev.map(post => post.id === visibilityPost.id ? { ...post, attachmentsPublic: visibilityValue } : post));
      setVisibilityPost(null);
    } catch (error: any) { setVisibilityError(error.message || "Không thể lưu quyền tệp."); }
    finally { setVisibilityBusy(false); }
  };

  // Gửi bài đăng mới
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!content.trim() && attachments.length === 0) || submitting || uploadingFiles) return;

    if (!channelInfo?.canPost) {
      setActionError("Bạn không có quyền gửi tin nhắn trong kênh blog chung này.");
      return;
    }

    try {
      setSubmitting(true);
      setActionError(null);

      const created = await createBlogPost({
        title: title.trim() || undefined,
        content: content.trim(),
        tags: selectedPostTags,
        isPinned: isPinnedPost,
        attachments: attachments.length > 0 ? attachments : undefined,
        attachmentsPublic,
      });

      // Thêm bài đăng vào giao diện ngay lập tức
      setPosts((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [...prev, created];
      });

      // Reset form
      setContent("");
      setTitle("");
      setShowTitleInput(false);
      setIsPinnedPost(false);
      setSelectedPostTags(["Thông báo"]);
      setAttachments([]);
      setAttachmentsPublic(false);
      setTimeout(() => scrollToBottom(true), 150);
    } catch (err: any) {
      console.error("[BlogChannelTab] Error creating post:", err);
      setActionError(err.message || "Lỗi khi gửi bài viết");
    } finally {
      setSubmitting(false);
    }
  };

  // Thích bài viết
  const handleToggleLike = async (postId: string) => {
    try {
      // Cập nhật optimistic
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const nextLiked = !p.isLiked;
            return {
              ...p,
              isLiked: nextLiked,
              likesCount: nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
            };
          }
          return p;
        }),
      );
      await toggleLikeBlogPost(postId);
    } catch (err) {
      console.error("[BlogChannelTab] Like error:", err);
      loadData();
    }
  };

  // Ghim bài viết
  const handleTogglePin = async (postId: string) => {
    try {
      const res = await togglePinBlogPost(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isPinned: res.isPinned } : p)),
      );
    } catch (err: any) {
      alert(err.message || "Lỗi khi ghim bài");
    }
  };

  // Xóa bài viết
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này khỏi Kênh Blog?")) return;
    try {
      await deleteBlogPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      alert(err.message || "Lỗi khi xóa bài");
    }
  };

  // Phím tắt Enter để gửi
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Danh sách các bài viết được ghim (sắp xếp bài mới nhất lên đầu)
  const pinnedPosts = useMemo(() => {
    return [...posts].filter((p) => p.isPinned).reverse();
  }, [posts]);

  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

  // Đảm bảo index hợp lệ khi danh sách ghim thay đổi
  const activePinnedIndex = Math.min(
    currentPinnedIndex,
    Math.max(0, pinnedPosts.length - 1),
  );
  const activePinnedPost = pinnedPosts[activePinnedIndex];

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 max-w-7xl w-full mx-auto bg-slate-50 dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-none sm:shadow-sm border-0 sm:border border-slate-200 dark:border-slate-800 overflow-hidden">
      {safety && <BlogSafetyPanel key={`${safety.mode}:${safety.post?.id || "list"}`} {...safety} onClose={() => setSafety(null)}
        onBlocked={authorId => { blogRequestVersion.current++; blockedAuthors.current.add(authorId); setPosts(items => items.filter(post => String(post.authorId) !== authorId)); setPreviewImage(null); setLoading(false); setRefreshing(false); }}
        onUnblocked={authorId => { blockedAuthors.current.delete(authorId); void loadData(true); }} />}
      {showLegalKnowledge && <LegalKnowledgePanel posts={posts} initialPostId={legalPostId} onClose={() => { setShowLegalKnowledge(false); void loadData(true); }} />}
      {/* ==================== HEADER KÊNH CHAT BLOG (TỐI GIẢN PHONG CÁCH CHAT) ==================== */}
      <div className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2.5 sm:px-6 sm:py-3.5">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
            </div>

            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
              Kênh Bảng Tin & Blog Doanh Nghiệp
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button onClick={() => setSafety({ mode: "blocks" })} className="rounded-xl px-2 py-2 text-xs text-slate-500">Người đã chặn</button>
            <button onClick={() => { setLegalPostId(""); setShowLegalKnowledge(true); }} className="rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 sm:text-sm">Pháp lý</button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 transition-colors text-xs sm:text-sm font-medium cursor-pointer"
              title="Tìm kiếm tin nhắn, file, link..."
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
              <span className="hidden sm:inline">Tìm kiếm</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Làm mới bảng tin"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ==================== BANNER THÔNG BÁO GHIM (PINNED ANNOUNCEMENT) ==================== */}
      {activePinnedPost && (
        <div
          onClick={() => jumpToPost(activePinnedPost.id)}
          className="group shrink-0 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border-b border-amber-200/90 dark:border-amber-800/60 px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 gap-2 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-all shadow-2xs"
          title="Bấm để di chuyển đến bài viết được ghim"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden min-w-0 flex-1">
            <span className="shrink-0 p-1 bg-amber-500 text-white rounded-md shadow-2xs group-hover:scale-105 transition-transform">
              <Pin className="w-3 h-3 sm:w-3.5 sm:h-3.5 rotate-45" />
            </span>

            {/* Điều hướng khi có nhiều bài ghim */}
            {pinnedPosts.length > 1 && (
              <div
                className="flex items-center gap-0.5 shrink-0 bg-amber-200/60 dark:bg-amber-900/60 rounded-lg p-0.5 border border-amber-300/60 dark:border-amber-700/60 mr-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPinnedIndex(
                      (prev) => (prev - 1 + pinnedPosts.length) % pinnedPosts.length,
                    )
                  }
                  className="p-0.5 hover:bg-amber-300/60 dark:hover:bg-amber-800/80 rounded text-amber-900 dark:text-amber-100 transition cursor-pointer"
                  title="Bài ghim trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 px-1 select-none whitespace-nowrap">
                  {activePinnedIndex + 1}/{pinnedPosts.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPinnedIndex((prev) => (prev + 1) % pinnedPosts.length)
                  }
                  className="p-0.5 hover:bg-amber-300/60 dark:hover:bg-amber-800/80 rounded text-amber-900 dark:text-amber-100 transition cursor-pointer"
                  title="Bài ghim tiếp theo"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <span className="font-bold whitespace-nowrap text-amber-900 dark:text-amber-300 hidden xs:inline">
              Tin ghim:
            </span>

            <span className="truncate font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {activePinnedPost.title || activePinnedPost.content.slice(0, 90)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] sm:text-[11px] text-amber-700/80 dark:text-amber-400 whitespace-nowrap hidden sm:inline">
              {activePinnedPost.authorName}
            </span>

            <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-indigo-600 dark:text-indigo-400 bg-white/80 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 rounded-lg px-2 py-0.5 transition shadow-2xs group-hover:border-indigo-400">
              <span>Xem bài viết</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      )}

      {/* ==================== VÙNG TIN NHẮN / DÒNG THỜI GIAN CHAT ==================== */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 sm:space-y-4 bg-gradient-to-b from-slate-50/50 to-slate-100/50 dark:from-slate-900/60 dark:to-slate-900"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
            <p className="text-sm">Đang tải bảng tin blog...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-400">
            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-500 mb-3">
              <Megaphone className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              Chưa có bài viết nào trên Kênh Blog
            </h3>
            <p className="text-xs sm:text-sm max-w-sm mt-1 text-slate-500">
              {channelInfo?.canPost
                ? "Bạn có Role đặc biệt (Ban biên tập). Hãy gửi bài viết hoặc thông báo đầu tiên ở thanh chat bên dưới!"
                : "Kênh hiện tại chưa có thông báo mới từ Ban biên tập."}
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              id={`blog-post-${post.id}`}
              className={`flex gap-2 sm:gap-3 w-full max-w-3xl transition-all duration-300 ${
                highlightedPostId === post.id
                  ? "ring-4 ring-indigo-500/80 bg-indigo-50/50 dark:bg-indigo-950/40 p-1.5 sm:p-2 rounded-2xl shadow-lg"
                  : post.isPinned
                    ? "ring-2 ring-amber-400/50 dark:ring-amber-500/30 rounded-2xl"
                    : ""
              }`}
            >
              {/* Avatar tác giả */}
              <div className="shrink-0">
                {post.authorAvatar ? (
                  <img
                    src={post.authorAvatar}
                    alt={post.authorName}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-indigo-500/20 shadow-xs"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-xs">
                    {post.authorName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Bong bóng tin nhắn / Khung bài viết */}
              <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm p-3 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-slate-700 transition-all hover:shadow-md">
                {/* Tác giả & Vai trò */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5 sm:mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-xs sm:text-sm md:text-base text-slate-800 dark:text-slate-100 truncate">
                      {post.authorName}
                    </span>

                    {/* Huy hiệu Role đặc biệt của tác giả */}
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] sm:text-[11px] font-semibold bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" />
                      {post.authorRole || "Ban Biên Tập"}
                    </span>

                    {post.isPinned && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded-md border border-amber-200 dark:border-amber-800 shrink-0">
                        <Pin className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Đã ghim
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {new Date(post.createdAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    •{" "}
                    {new Date(post.createdAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>

                {/* Tiêu đề bài viết (nếu có) */}
                {post.title && (
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    {post.title}
                  </h4>
                )}

                {channelInfo?.canPost && <button className="mb-2 text-xs text-indigo-600 underline" onClick={() => { setLegalPostId(post.id); setShowLegalKnowledge(true); }}>Thêm file pháp lý vào kho tri thức</button>}
                {/* Nội dung bài viết */}
                {post.content ? (
                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                    {post.content}
                  </div>
                ) : null}

                {String(post.authorId) !== String(user?.uid) && <div className="mb-2 flex justify-end gap-3 text-xs text-slate-500">
                  <button type="button" className="min-h-9 hover:text-red-600" onClick={() => setSafety({ mode: "report", post })}>Báo cáo</button>
                  <button type="button" className="min-h-9 hover:text-red-600" onClick={() => setSafety({ mode: "block", post })}>Chặn tác giả</button>
                </div>}
                {/* Tệp đính kèm đa phương tiện */}
                {post.legalDocuments?.map(document => <button key={document.id}
                  onClick={() => { setLegalPostId(post.id); setShowLegalKnowledge(true); }}
                  className="my-2 block max-w-full rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-left text-xs text-indigo-800">
                  <FileText className="mr-1 inline h-4 w-4" />{document.number} — {document.title}
                  {document.status === "draft" ? " · Chờ duyệt" : document.status === "withdrawn" ? " · Đã thu hồi" : " · Xem hiệu lực và file gốc"}
                </button>)}
                {post.attachments && post.attachments.length > 0 && (() => {
                  const images = post.attachments.filter(isImageAttachment);
                  const videos = post.attachments.filter(isVideoAttachment);
                  const audios = post.attachments.filter(isAudioAttachment);
                  const files = post.attachments.filter(
                    (a) => !isImageAttachment(a) && !isVideoAttachment(a) && !isAudioAttachment(a),
                  );

                  return (
                    <div className="mt-2.5 space-y-2">
                      {/* Thư viện hình ảnh */}
                      {images.length > 0 && (
                        <div
                          className={`grid gap-1.5 sm:gap-2 ${
                            images.length === 1
                              ? "grid-cols-1 max-w-full sm:max-w-md"
                              : images.length === 2
                                ? "grid-cols-2 max-w-full sm:max-w-lg"
                                : "grid-cols-2 sm:grid-cols-3 max-w-full sm:max-w-xl"
                          }`}
                        >
                          {images.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(img.url)}
                              className="group relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-pointer border border-slate-200 dark:border-slate-700 aspect-video sm:aspect-square flex items-center justify-center"
                            >
                              <ProtectedBlogMedia
                                src={img.url}
                                alt={img.name || "Hình ảnh"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-5 h-5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {images.map((img, idx) => <BlogAttachmentActions key={"image-actions-" + idx} post={post} attachment={img} />)}
                      {/* Video */}
                      {videos.map((vid, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-full sm:max-w-lg"
                        >
                          <ProtectedBlogMedia kind="video" src={vid.url} className="w-full max-h-72 bg-black" /><BlogAttachmentActions post={post} attachment={vid} />
                        </div>
                      ))}

                      {/* Audio */}
                      {audios.map((aud, idx) => (
                        <div key={idx} className="max-w-full sm:max-w-md">
                          <ProtectedBlogMedia kind="audio" src={aud.url} className="w-full" /><BlogAttachmentActions post={post} attachment={aud} />
                        </div>
                      ))}

                      {/* Tài liệu & Tệp khác */}
                      {files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/60 max-w-full sm:max-w-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 shrink-0">
                              {getFileIcon(file)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 truncate"
                                title={file.name}
                              >
                                {file.name || "Tệp đính kèm"}
                              </p>
                              {file.size ? (
                                <p className="text-[10px] sm:text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
                              ) : null}
                            </div>
                          </div>
                          <BlogAttachmentActions post={post} attachment={file} />
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {!!post.attachments?.length && <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-500">{post.attachmentsPublic === undefined || post.attachmentsPublic === true ? "Tệp công khai" : "Tệp không công khai"}</span>
                  {channelInfo?.canPost && (["superadmin", "blog_editor"].includes(channelInfo.userRole) || String(post.authorId) === String(user?.uid)) && <button type="button" onClick={() => { setVisibilityPost(post); setVisibilityValue(post.attachmentsPublic === undefined || post.attachmentsPublic === true); setVisibilityError(""); }} className="rounded-lg border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600">Đổi quyền tệp</button>}
                </div>}
                {/* Thẻ tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-md"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tương tác & Nút chức năng */}
                <div className="flex items-center justify-between mt-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                        post.isLiked
                          ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold"
                          : "hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title={post.isLiked ? "Bỏ thích" : "Thích bài viết"}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          post.isLiked ? "fill-rose-500 text-rose-500" : ""
                        }`}
                      />
                      <span>{post.likesCount > 0 ? post.likesCount : "Thích"}</span>
                    </button>
                  </div>

                  {/* Nút hành động dành riêng cho tài khoản có quyền đăng */}
                  {channelInfo?.canPost && (["superadmin", "blog_editor"].includes(channelInfo.userRole) || String(post.authorId) === String(user?.uid)) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePin(post.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          post.isPinned
                            ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                        }`}
                        title={post.isPinned ? "Bỏ ghim" : "Ghim bài viết"}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Xóa bài viết"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ==================== KHU VỰC NHẬP LIỆU (PHÂN QUYỀN ĐỘC QUYỀN) ==================== */}
      <div className="shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-2.5 sm:p-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-4">
        {actionError && (
          <div className="mb-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-xs font-semibold hover:underline"
            >
              Đóng
            </button>
          </div>
        )}

        {channelInfo?.canPost ? (
          /* ================= GIAO DIỆN SOẠN BÀI CHO TÀI KHOẢN ĐẶC QUYỀN ================= */
          <form onSubmit={handleSendMessage} className="space-y-2">
            {/* Tùy chọn mở rộng: Thêm tiêu đề & ghim bài */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-xs">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 max-w-full">
                <button
                  type="button"
                  onClick={() => setShowTitleInput(!showTitleInput)}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    showTitleInput
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  title={showTitleInput ? "Ẩn tiêu đề" : "Thêm tiêu đề bài viết"}
                >
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">{showTitleInput ? "Ẩn tiêu đề" : "Thêm tiêu đề"}</span>
                  <span className="sm:hidden">Tiêu đề</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFiles}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Đính kèm tệp tài liệu (PDF, Word, Excel, ZIP,...)"
                >
                  <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Đính kèm tệp</span>
                  <span className="sm:hidden">Tệp</span>
                </button>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingFiles}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Tải ảnh lên"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Hình ảnh</span>
                  <span className="sm:hidden">Ảnh</span>
                </button>

                <label className="flex items-center gap-1 cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg transition-colors shrink-0">
                  <input
                    type="checkbox"
                    checked={isPinnedPost}
                    onChange={(e) => setIsPinnedPost(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <Pin className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Ghim bài</span>
                </label>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Chọn tag chủ đề */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-full text-[11px]">
                <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0 hidden sm:inline">Chủ đề:</span>
                {AVAILABLE_TAGS.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selectedPostTags.includes(tag)) {
                        if (selectedPostTags.length > 1) {
                          setSelectedPostTags(selectedPostTags.filter((t) => t !== tag));
                        }
                      } else {
                        setSelectedPostTags([...selectedPostTags, tag]);
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors shrink-0 cursor-pointer ${
                      selectedPostTags.includes(tag)
                        ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Ô nhập tiêu đề nếu bật */}
            {showTitleInput && (
              <input
                type="text"
                placeholder="Nhập tiêu đề bài viết (tùy chọn)..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium"
              />
            )}

            {/* Danh sách tệp đính kèm đang chờ gửi */}
            {(attachments.length > 0 || uploadingFiles) && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 sm:gap-2 pl-2 pr-1.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-xs text-xs"
                  >
                    <div className="shrink-0">{getFileIcon(att)}</div>
                    <div className="min-w-0 max-w-[130px] sm:max-w-[200px]">
                      <p className="truncate font-medium text-slate-700 dark:text-slate-200" title={att.name}>
                        {att.name}
                      </p>
                      {att.size ? (
                        <p className="text-[10px] text-slate-400">{formatFileSize(att.size)}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                      title="Xóa tệp"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {uploadingFiles && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium border border-indigo-200/50">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tải lên tệp...</span>
                  </div>
                )}
              </div>
            )}

            <AttachmentVisibilityChoice value={attachmentsPublic} onChange={setAttachmentsPublic} disabled={submitting || uploadingFiles} />
            {/* Ô nhập nội dung tin nhắn văn bản & Nút gửi */}
            <div className="flex items-end gap-1.5 sm:gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Soạn bài viết hoặc tin nhắn thông báo... (Nhấn Enter để gửi)"
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={(!content.trim() && attachments.length === 0) || submitting || uploadingFiles}
                className="flex items-center justify-center gap-1 px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Gửi</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ================= GIAO DIỆN CHẾ ĐỘ XEM (CHO CÁC ADMIN KHÁC & NHÂN VIÊN) ================= */
          <div className="bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs sm:text-sm shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Chế độ chỉ xem (Read-only Channel)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chỉ tài khoản Ban biên tập / Tác giả đặc biệt mới có quyền gửi bài viết & tin nhắn
                  trong kênh này.
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              🔒 Quyền gửi bị khóa
            </span>
          </div>
        )}
      </div>

      {channelInfo?.canPost && <LegalKnowledgeProgress />}

      {visibilityPost && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div role="dialog" aria-modal="true" aria-label="Đổi quyền tệp" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Đổi quyền tệp trong bài viết</h2>
          <AttachmentVisibilityChoice value={visibilityValue} onChange={setVisibilityValue} disabled={visibilityBusy} />
          {visibilityError && <p role="alert" className="text-sm text-red-600">{visibilityError}</p>}
          <div className="flex justify-end gap-3"><button type="button" disabled={visibilityBusy} onClick={() => setVisibilityPost(null)}>Hủy</button>
            <button type="button" disabled={visibilityBusy} onClick={() => void saveVisibility()} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">{visibilityBusy ? "Đang lưu…" : "Lưu"}</button></div>
        </div>
      </div>}
      {/* Modal phóng to xem ảnh */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              title="Đóng xem ảnh"
            >
              <X className="w-5 h-5" />
            </button>
            <ProtectedBlogMedia
              src={previewImage}
              alt="Xem hình ảnh phóng to"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* ==================== POPUP TÌM KIẾM TIN NHẮN, FILE, LINK (PHONG CÁCH ZALO) ==================== */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col h-[85dvh] sm:h-[640px] max-h-[90dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thanh tìm kiếm đầu popup */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={popupSearchQuery}
                    onChange={(e) => setPopupSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm tin nhắn, file, link, ảnh..."
                    className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-indigo-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  />
                  {popupSearchQuery && (
                    <button
                      onClick={() => setPopupSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="Đóng tìm kiếm (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thanh điều hướng Tab phong cách Zalo */}
              <div className="flex items-center gap-1 mt-2.5 sm:mt-3 overflow-x-auto text-xs sm:text-sm font-medium pb-1 scrollbar-none">
                <button
                  onClick={() => setSearchTab("messages")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    searchTab === "messages"
                      ? "bg-indigo-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Tin nhắn</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      searchTab === "messages"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {filteredMessages.length}
                  </span>
                </button>

                <button
                  onClick={() => setSearchTab("media")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    searchTab === "media"
                      ? "bg-indigo-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Ảnh / Video</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      searchTab === "media"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {allMediaItems.length}
                  </span>
                </button>

                <button
                  onClick={() => setSearchTab("files")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    searchTab === "files"
                      ? "bg-indigo-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>File tài liệu</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      searchTab === "files"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {allDocumentItems.length}
                  </span>
                </button>

                <button
                  onClick={() => setSearchTab("links")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    searchTab === "links"
                      ? "bg-indigo-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Liên kết (Link)</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      searchTab === "links"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {allLinkItems.length}
                  </span>
                </button>
              </div>

              {/* Thẻ tag lọc nhanh nếu đang ở tab Tin nhắn */}
              {searchTab === "messages" && (
                <div className="flex items-center gap-1 mt-2.5 overflow-x-auto text-[11px]">
                  <button
                    onClick={() => setPopupSelectedTag("all")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      popupSelectedTag === "all"
                        ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                        : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    Tất cả thẻ
                  </button>
                  {pinnedPosts.length > 0 && (
                    <button
                      onClick={() => setPopupSelectedTag("pinned")}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        popupSelectedTag === "pinned"
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 font-bold"
                          : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 border border-amber-200/60"
                      }`}
                    >
                      <Pin className="w-2.5 h-2.5 rotate-45" />
                      <span>Đã ghim ({pinnedPosts.length})</span>
                    </button>
                  )}
                  {AVAILABLE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setPopupSelectedTag(tag)}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        popupSelectedTag === tag
                          ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                          : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nội dung kết quả tìm kiếm theo từng Tab */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* TAB 1: TIN NHẮN */}
              {searchTab === "messages" &&
                (filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-400">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Không tìm thấy tin nhắn nào</p>
                    <p className="text-xs text-slate-400 mt-1">Hãy thử tìm kiếm với từ khóa hoặc thẻ khác</p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => jumpToPost(msg.id)}
                      className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 hover:bg-indigo-50/70 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition-all hover:border-indigo-300 dark:hover:border-indigo-600 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                            {msg.authorName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium shrink-0">
                            {msg.authorRole}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {new Date(msg.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {msg.title && (
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-1">
                          {msg.title}
                        </p>
                      )}

                      {msg.content && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {msg.content}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {msg.tags?.map((t) => (
                            <span key={t} className="text-indigo-600 dark:text-indigo-400 font-medium">
                              #{t}
                            </span>
                          ))}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-slate-500 bg-slate-200/80 dark:bg-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                              <Paperclip className="w-3 h-3" /> {msg.attachments.length} tệp
                            </span>
                          )}
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">
                          Xem tin nhắn &rarr;
                        </span>
                      </div>
                    </div>
                  ))
                ))}

              {/* TAB 2: ẢNH & VIDEO */}
              {searchTab === "media" &&
                (allMediaItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-400">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Chưa có ảnh hoặc video nào</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {allMediaItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 aspect-square"
                      >
                        {isImageAttachment(item.attachment) ? (
                          <ProtectedBlogMedia
                            src={item.attachment.url}
                            alt={item.attachment.name || "Hình ảnh"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                            onClick={() => setPreviewImage(item.attachment.url)}
                          />
                        ) : (
                          <ProtectedBlogMedia kind="video" src={item.attachment.url}
                            className="w-full h-full object-cover bg-black"
                            />
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-white pointer-events-none">
                          <div className="flex justify-end pointer-events-auto">
                            <button
                              onClick={() => jumpToPost(item.post.id)}
                              className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Đến bài viết chứa ảnh này"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <p className="text-xs font-medium truncate">
                              {item.attachment.name || "Tệp media"}
                            </p>
                            <p className="text-[10px] text-slate-300">
                              {item.post.authorName} • {new Date(item.post.createdAt).toLocaleDateString("vi-VN")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

              {/* TAB 3: FILE TÀI LIỆU */}
              {searchTab === "files" &&
                (allDocumentItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-400">
                    <FileText className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Chưa có tệp tài liệu nào</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allDocumentItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                            {getFileIcon(item.attachment)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"
                              title={item.attachment.name}
                            >
                              {item.attachment.name || "Tệp tài liệu"}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.attachment.size ? formatFileSize(item.attachment.size) : ""} • Đăng bởi{" "}
                              {item.post.authorName} •{" "}
                              {new Date(item.post.createdAt).toLocaleDateString("vi-VN")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => jumpToPost(item.post.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Đến bài viết chứa file"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <BlogAttachmentActions post={item.post} attachment={item.attachment} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

              {/* TAB 4: LIÊN KẾT (LINK) */}
              {searchTab === "links" &&
                (allLinkItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-400">
                    <Link2 className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Chưa có liên kết web nào trong các bài viết</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allLinkItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate block">
                              {item.domain}
                            </span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline break-all block line-clamp-1"
                            >
                              {item.url}
                            </a>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                              Trích đoạn: "{item.snippet}"
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {item.post.authorName} •{" "}
                              {new Date(item.post.createdAt).toLocaleDateString("vi-VN")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => jumpToPost(item.post.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Đến bài viết chứa link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>

            {/* Footer popup */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400">
              <span>Bấm vào bài viết để cuộn nhanh đến vị trí trò chuyện</span>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
