import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Check, 
  X, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  ThumbsUp, 
  Zap, 
  FileEdit,
  Eye,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Facebook,
  ExternalLink,
  CheckCircle2,
  Instagram,
  Linkedin,
  Video,
  Image as ImageIcon
} from "lucide-react";
import { MarketingSubTabType, MarketingConcept, ContentApprovalCard, PublishEvent } from "../types";
import { marketingService, extractDraftContent } from "../services/marketingService";
import { geminiApi } from "../api/gemini";
import { toast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { ContentStudioWorkspace } from "../components/content-studio/ContentStudioWorkspace";
import { socialIntegrationService, SocialIntegration } from "../services/socialIntegrationService";


const formatCardDate = (dateStr: any): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch (e) {
    return String(dateStr);
  }
};

export default function MarketingTab() {
  const { userProfile } = useAuth();
  const isUserRole = userProfile?.role === "user" || userProfile?.role === "manager";
  const [subTab, setSubTab] = useState<MarketingSubTabType>("LÊN Ý TƯỞNG AI");

  // AI Media Generation States
  const [publishingTikTokId, setPublishingTikTokId] = useState<string | null>(null);
  const [contentStudioParams, setContentStudioParams] = useState<{
    tab: 'image' | 'video' | 'voice';
    prompt: string;
    cardId: string;
  } | null>(null);

  // Lightbox Preview States
  const [activeLightboxCard, setActiveLightboxCard] = useState<ContentApprovalCard | null>(null);
  const [activeLightboxType, setActiveLightboxType] = useState<'image' | 'video' | null>(null);
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
  const [showDeleteMediaConfirm, setShowDeleteMediaConfirm] = useState(false);

  // 1. AI Campaign Ideation States
  const [campaignInput, setCampaignInput] = useState("");
  const [analyzedTopic, setAnalyzedTopic] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [developingIdx, setDevelopingIdx] = useState<number | null>(null);

  const [selectedChannels, setSelectedChannels] = useState<string[]>(["Facebook"]);
  const [mediaType, setMediaType] = useState<string>("image"); // "none" | "image" | "video"
  const [isAutoMedia, setIsAutoMedia] = useState(true);
  
  // Image Options
  const [imageModel, setImageModel] = useState("imagen-4.0-generate-001");
  const [imageResolution, setImageResolution] = useState("1K");
  const [imageAspectRatio, setImageAspectRatio] = useState("1:1");

  // Video Options
  const [videoModel, setVideoModel] = useState("veo-3.1-generate-preview");
  const [videoQuality, setVideoQuality] = useState("720p");
  const [videoDuration, setVideoDuration] = useState("4");
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9");

  const [schedulingCard, setSchedulingCard] = useState<ContentApprovalCard | null>(null);
  const [scheduleDate, setScheduleDate] = useState("2026-10-15");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [isScheduling, setIsScheduling] = useState(false);
  const [availableIntegrations, setAvailableIntegrations] = useState<SocialIntegration[]>([]);
  const [scheduleIntegrationId, setScheduleIntegrationId] = useState("");
  const [loadingIntegrationsForSchedule, setLoadingIntegrationsForSchedule] = useState(false);


  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const [concepts, setConcepts] = useState<MarketingConcept[]>([
    {
      title: "Chiến dịch: Chạm Đột Phá - Sành điệu công nghệ X1",
      matchPercent: 92,
      summary: "Tạo các video ngắn trên TikTok hướng đến lối sống tích cực, nhấn mạnh khả năng kết nối không dây siêu mượt và tính năng đo nhịp tim tự động của thiết bị X1.",
      channels: ["TikTok", "Instagram"],
      suggestedContent: "🎬 Kịch bản Reels: Một ngày bận rộn bắt đầu... Chạm nhẹ thiết bị đeo X1 để bật nhạc chạy bộ buổi sáng kết thúc ngày hiệu năng đỉnh cao.",
      hashtags: ["#iGenX1", "#SmartWearable", "#NangTamCuocSong"]
    },
    {
      title: "Giải pháp chuyển đổi số - Tri ân doanh nghiệp",
      matchPercent: 88,
      summary: "Chiến dịch bài viết uy tín sâu trên LinkedIn & Facebook tri ân các đối tác đã số hóa quản lý Kho hàng nhờ iGen ERP.",
      channels: ["LinkedIn", "Facebook"],
      suggestedContent: "✍️ Câu chuyện: Gặp gỡ thương hiệu thời trang G-Trend, từ bế tắc thất thoát tồn kho đến quản lý an nhàn tự động 100% nhờ iGen-Forecast.",
      hashtags: ["#iGenERP", "#ChuyenDoiSo", "#DigitalTransformation"]
    }
  ]);

  // Load 3 suggestions from AI on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const suggestions = await marketingService.fetchSuggestions();
        setQuickSuggestions(suggestions);
      } catch (err) {
        console.error("Lỗi tải gợi ý chiến dịch:", err);
        toast.error("Không thể tải gợi ý chiến dịch marketing từ AI.");
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadSuggestions();
  }, []);

  const [selectedPillars, setSelectedPillars] = useState<string[]>([
    "Pillar A: Educate & Guides",
    "Pillar B: Storytelling & Social Proof",
    "Pillar C: Offers & Promotions"
  ]);

  const [loadingPillars, setLoadingPillars] = useState(false);
  const [pillars, setPillars] = useState([
    {
      id: "Pillar A: Educate & Guides",
      title: "Pillar A: Educate & Guides",
      ratio: "35% tỉ trọng",
      description: "Chia sẻ kiến thức bổ ích liên quan đến tư thế ngồi gõ bàn phím, hoặc cách tối ưu hóa vận hành hệ thống.",
      colorClass: "border-red-200 bg-red-50/50 text-red-700",
      selectedColorClass: "border-red-500 bg-red-50 text-red-850 ring-2 ring-red-500/20 shadow-xs",
      bulletColor: "bg-red-500",
    },
    {
      id: "Pillar B: Storytelling & Social Proof",
      title: "Pillar B: Storytelling & Social Proof",
      ratio: "40% tỉ trọng",
      description: "Phỏng vấn thực tế khách hàng cũ trung thành đang nâng hiệu suất cùng iGen ERP.",
      colorClass: "border-blue-200 bg-blue-50/50 text-blue-700",
      selectedColorClass: "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20 shadow-xs",
      bulletColor: "bg-blue-500",
    },
    {
      id: "Pillar C: Offers & Promotions",
      title: "Pillar C: Offers & Promotions",
      ratio: "25% tỉ trọng",
      description: "Tạo sự thúc giục bằng cách công bố giờ vàng flash sale khẩn cấp.",
      colorClass: "border-indigo-200 bg-indigo-50/50 text-indigo-700",
      selectedColorClass: "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs",
      bulletColor: "bg-indigo-500",
    },
  ]);

  const handleAnalyzePillars = async (rawTopic?: string) => {
    const topic = (typeof rawTopic === "string" ? rawTopic : campaignInput).trim();
    if (!topic) {
      if (!rawTopic) {
        toast.warning("Vui lòng nhập hoặc chọn một chủ đề/mục tiêu chiến dịch trước!");
      }
      return;
    }

    setLoadingPillars(true);
    try {
      const data = await geminiApi.analyzeMarketingPillars(topic);
      if (data.pillars && Array.isArray(data.pillars) && data.pillars.length > 0) {
        const styles = [
          {
            colorClass: "border-red-200 bg-red-50/50 text-red-700",
            selectedColorClass: "border-red-500 bg-red-50 text-red-850 ring-2 ring-red-500/20 shadow-xs",
            bulletColor: "bg-red-500"
          },
          {
            colorClass: "border-blue-200 bg-blue-50/50 text-blue-700",
            selectedColorClass: "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20 shadow-xs",
            bulletColor: "bg-blue-500"
          },
          {
            colorClass: "border-indigo-200 bg-indigo-50/50 text-indigo-700",
            selectedColorClass: "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs",
            bulletColor: "bg-indigo-500"
          }
        ];

        const mappedPillars = data.pillars.map((p: any, idx: number) => ({
          id: p.id,
          title: p.title,
          ratio: p.ratio || "33% tỉ trọng",
          description: p.description,
          ...styles[idx % styles.length]
        }));

        setPillars(mappedPillars);
        setSelectedPillars(mappedPillars.map((p: any) => p.id));
        setAnalyzedTopic(topic);
      }
    } catch (err) {
      console.error("Lỗi phân tích Content Pillars:", err);
    } finally {
      setLoadingPillars(false);
    }
  };

  const togglePillar = (id: string) => {
    if (selectedPillars.includes(id)) {
      if (selectedPillars.length === 1) {
        toast.warning("Cần chọn ít nhất 1 trụ cột nội dung để trợ lý AI định hướng.");
        return;
      }
      setSelectedPillars(selectedPillars.filter(p => p !== id));
    } else {
      setSelectedPillars([...selectedPillars, id]);
    }
  };

  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = campaignInput.trim();
    if (!topic) return;

    setLoadingAI(true);
    try {
      const actualMediaType = isAutoMedia ? mediaType : "none";
      const data = await geminiApi.generateMarketingIdeas(topic, selectedPillars, selectedChannels, actualMediaType);
      if (data.concepts) {
        setConcepts(data.concepts);
      }
    } catch (err) {
      console.error(err);
      toast.error("Kết nối tới AI Marketing Tool thất bại. Hệ thống sẽ tự phục hồi.");
    } finally {
      setLoadingAI(false);
    }
  };

  // 2. Content Approval and Pipeline States
  const [approvalCards, setApprovalCards] = useState<ContentApprovalCard[]>([]);
  const autoPublishingRef = React.useRef<Set<string>>(new Set());

  // Real-time Firestore Live Synchronization - filter theo role
  useEffect(() => {
    const unsubscribe = marketingService.subscribeToContents(
      (cards) => {
        setApprovalCards(cards);
      },
      (error) => {
        console.error("Lỗi đồng bộ dữ liệu marketing:", error);
      },
      userProfile?.uid,
      userProfile?.role
    );

    return () => unsubscribe();
  }, [userProfile?.uid, userProfile?.role]);



  // Load integrations dynamically when a card is selected for scheduling
  useEffect(() => {
    if (!schedulingCard) {
      setAvailableIntegrations([]);
      setScheduleIntegrationId("");
      return;
    }

    const loadIntegrationsForSchedule = async () => {
      setLoadingIntegrationsForSchedule(true);
      try {
        const platformMap: Record<string, string> = {
          "Facebook": "Facebook",
          "TikTok": "TikTok",
          "Zalo": "Zalo"
        };
        const platform = platformMap[schedulingCard.channel];
        if (platform) {
          const list = await socialIntegrationService.getIntegrations(platform);
          const connectedList = list.filter(item => item.isConnected);
          setAvailableIntegrations(connectedList);
          if (connectedList.length > 0) {
            setScheduleIntegrationId(connectedList[0]._id || "");
          } else {
            setScheduleIntegrationId("");
          }
        } else {
          setAvailableIntegrations([]);
          setScheduleIntegrationId("");
        }
      } catch (err) {
        console.error("Lỗi khi tải tài khoản liên kết để lên lịch:", err);
        toast.error("Không thể tải danh sách tài khoản liên kết.");
        setAvailableIntegrations([]);
        setScheduleIntegrationId("");
      } finally {
        setLoadingIntegrationsForSchedule(false);
      }
    };

    loadIntegrationsForSchedule();
  }, [schedulingCard]);

  const updateCardStatus = async (id: string, newStatus: "draft" | "pending" | "approved" | "scheduled" | "published") => {
    await marketingService.updateCardStatus(id, newStatus);
    setApprovalCards(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const handleConfirmSchedule = async () => {
    if (!schedulingCard) return;

    if (availableIntegrations.length === 0) {
      toast.error("Không thể lên lịch: Chưa có tài khoản liên kết nào cho kênh này. Vui lòng kết nối tài khoản ở mục Cài đặt -> MXH Doanh nghiệp.");
      return;
    }

    setIsScheduling(true);
    try {
      await marketingService.scheduleCard(
        schedulingCard.id,
        scheduleDate,
        scheduleTime,
        scheduleIntegrationId || undefined
      );
      toast.success(`Đã lên lịch đăng bài "${schedulingCard.title}" thành công!`);
      setApprovalCards(prev => prev.map(c => c.id === schedulingCard.id ? { 
        ...c, 
        status: "scheduled", 
        scheduledDate: scheduleDate, 
        scheduledTime: scheduleTime,
        integrationId: scheduleIntegrationId 
      } : c));
      setSchedulingCard(null);
    } catch (e) {
      console.error("Lỗi khi lên lịch bài đăng:", e);
      toast.error("Lỗi khi lên lịch bài đăng.");
    } finally {
      setIsScheduling(false);
    }
  };

  const deleteCard = async (id: string) => {
    await marketingService.deleteCard(id);
    setApprovalCards(prev => prev.filter(c => c.id !== id));
  };

  const [promptMore, setPromptMore] = useState("");
  const handleAIGenerateMore = async () => {
    if (!promptMore.trim()) return;
    const card = newProductiveDraft(promptMore);
    const savedCard = await marketingService.saveCard(card);
    setApprovalCards(prev => [...prev, savedCard]);
    setPromptMore("");
  };

  const newProductiveDraft = (topic: string): ContentApprovalCard => {
    return {
      id: "mod_" + Date.now(),
      title: `Campaign: ${topic.slice(0, 30)}...`,
      channel: "Facebook",
      contentType: "Bài viết AI Copywriter soạn thảo",
      status: "draft",
      bodyText: `✨ Chào đón sự bứt phá của dự án mới! Về chủ đề đề nghị "${topic}", hãy khởi sắc chiến dịch truyền thông hấp dẫn, tri ân sâu sắc để tiếp xúc với hàng triệu khách hàng mục tiêu tiếp cận iGen giải pháp chuyển đổi số toàn diện. Đăng ký ngay hôm nay để nhận tư vấn!`,
      generatedAt: new Date().toISOString(),
      authorUid: userProfile?.uid ?? ''
    };
  };

  const handleDevelopConcept = async (concept: MarketingConcept, idx: number) => {
    console.log("[handleDevelopConcept] Starting development for concept:", concept.title);
    setDevelopingIdx(idx);
    try {
      console.log("[handleDevelopConcept] Calling marketingService.developIdea...");
      const result = await marketingService.developIdea({
        title: concept.title,
        summary: concept.summary,
        suggestedContent: concept.suggestedContent,
        channels: concept.channels,
        mediaType: isAutoMedia ? mediaType : "none",
        imageModel,
        imageResolution,
        imageAspectRatio,
        videoModel,
        videoQuality,
        videoDuration: parseInt(videoDuration),
        videoAspectRatio
      });
      console.log("[handleDevelopConcept] Received result from API:", result);

      if (result && result.posts) {
        const newCards: ContentApprovalCard[] = result.posts.map((post: any, index: number) => {
          return {
            id: `mod_dev_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            title: concept.title,
            channel: post.channel as any,
            contentType: post.contentType,
            status: "pending",
            outline: post.outline || "",
            bodyText: post.bodyText || "",
            imageUrl: post.imageUrl || null,
            videoUrl: post.videoUrl || null,
            mediaPrompt: post.mediaPrompt || "",
            generatedAt: new Date().toISOString(),
            authorUid: userProfile?.uid ?? ''
          };
        });

        console.log("[handleDevelopConcept] Saving new cards to MongoDB:", newCards);
        const savedCards = await marketingService.saveCards(newCards);
        console.log("[handleDevelopConcept] Cards saved successfully. Updating local state and switching subTab...");
        setApprovalCards(prev => [...prev, ...savedCards]);
        setSubTab("DUYỆT NỘI DUNG");
      } else {
        console.warn("[handleDevelopConcept] Result has no posts:", result);
      }
    } catch (e) {
      console.error("Lỗi phát triển ý tưởng đa kênh:", e);
      toast.error("Lỗi kết nối Trợ lý AI khi lập dàn ý chi tiết.");
    } finally {
      console.log("[handleDevelopConcept] Resetting developing index.");
      setDevelopingIdx(null);
    }
  };

  // AI Media generation and management handlers
  const handleInitAIGeneration = (card: ContentApprovalCard, type?: 'image' | 'video') => {
    const selectedType = type ?? (card.channel === 'TikTok' ? 'video' : 'image');
    
    // For video generation, use the storyboard outline first, fallback to body text.
    // For image generation, extract the draft content from the body text.
    let cleanText = card.mediaPrompt || "";
    if (!cleanText) {
      if (selectedType === 'video') {
        cleanText = card.outline || card.bodyText || "";
      } else {
        cleanText = extractDraftContent(card.bodyText);
      }
    }

    setContentStudioParams({
      tab: selectedType,
      prompt: cleanText,
      cardId: card.id
    });
    setSubTab("XƯỞNG NỘI DUNG");
  };

  const handleMediaSaved = (cardId: string, mediaUrl: string, type: 'image' | 'video') => {
    setApprovalCards(prev => prev.map(c => c.id === cardId ? {
      ...c,
      imageUrl: type === 'image' ? mediaUrl : c.imageUrl,
      videoUrl: type === 'video' ? mediaUrl : c.videoUrl
    } : c));
  };

  const handleOpenLightbox = (card: ContentApprovalCard, type: 'image' | 'video', url: string) => {
    setActiveLightboxCard(card);
    setActiveLightboxType(type);
    setActiveLightboxUrl(url);
  };

  const handleDeleteMedia = () => {
    if (!activeLightboxCard || !activeLightboxType) return;
    setShowDeleteMediaConfirm(true);
  };

  const handleConfirmDeleteMedia = async () => {
    if (!activeLightboxCard || !activeLightboxType) return;
    setShowDeleteMediaConfirm(false);
    try {
      await marketingService.updateCardMedia(null, activeLightboxType, [activeLightboxCard.id]);
      
      setApprovalCards(prev => prev.map(c => c.id === activeLightboxCard.id ? {
        ...c,
        imageUrl: activeLightboxType === 'image' ? null : c.imageUrl,
        videoUrl: activeLightboxType === 'video' ? null : c.videoUrl
      } : c));

      toast.success("Đã xóa phương tiện thành công!");
      setActiveLightboxCard(null);
      setActiveLightboxType(null);
      setActiveLightboxUrl(null);
    } catch (e: any) {
      console.error("Lỗi xóa phương tiện:", e);
      toast.error("Không thể xóa phương tiện lúc này.");
    }
  };

  const handlePublishToTikTok = async (card: ContentApprovalCard) => {
    const tiktok = userProfile?.tiktokIntegration;
    if (!tiktok?.isConnected) {
      toast.error("Chưa kết nối TikTok. Vui lòng vào Cài đặt → Liên kết MXH để kết nối.");
      return;
    }
    if (!card.videoUrl) {
      toast.error("Bài đăng TikTok cần có video. Hãy tạo video AI trước.");
      return;
    }
    setPublishingTikTokId(card.id);
    try {
      const caption = extractDraftContent(card.bodyText).slice(0, 2200); // TikTok caption max 2200 chars
      const postId = await marketingService.publishToTikTok(
        card.id,
        caption,
        card.videoUrl,
        tiktok.isMock ?? true,
        tiktok.privacyLevel ?? 'SELF_ONLY'
      );
      toast.success(`Đã đăng video lên TikTok thành công! ${tiktok.isMock ? '(Demo)' : ''} ID: ${postId.slice(-8)}`);
    } catch (e: any) {
      console.error("Lỗi đăng TikTok:", e);
      toast.error(parseFirebaseError(e, "Không thể đăng bài lên TikTok. Vui lòng thử lại."));
    } finally {
      setPublishingTikTokId(null);
    }
  };

  // 3. Publishing Calendar grid
  const monthNamesVi = [
    "THÁNG 1", "THÁNG 2", "THÁNG 3", "THÁNG 4", "THÁNG 5", "THÁNG 6",
    "THÁNG 7", "THÁNG 8", "THÁNG 9", "THÁNG 10", "THÁNG 11", "THÁNG 12"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  };

  const startOffset = (() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    return firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  })();

  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const joinedEvents: PublishEvent[] = (approvalCards || [])
    .filter((c) => c.status === "scheduled")
    .map((c, index) => {
      let assignedDay = ((index * 5 + 11) % 28) + 1;
      if (c.scheduledDate) {
        const dateObj = new Date(c.scheduledDate);
        if (!isNaN(dateObj.getTime())) {
          if (dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth) {
            assignedDay = dateObj.getDate();
          } else {
            return null;
          }
        }
      }
      return {
        id: c.id,
        date: assignedDay,
        title: `[Lịch đăng] ${c.title}${c.scheduledTime ? ` - ${c.scheduledTime}` : ""}`,
        type: c.contentType,
        channel: c.channel,
        status: "Approved" as const,
      };
    })
    .filter((e): e is PublishEvent => e !== null);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="marketing_tab_wrapper">
      
      {/* Sub Tabs control header switcher */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="marketing_sub_tabs_switch">
        <div className="flex gap-2">
          {["LÊN Ý TƯỞNG AI", "DUYỆT NỘI DUNG", "LỊCH ĐĂNG CONTENT", "XƯỞNG NỘI DUNG"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as MarketingSubTabType)}
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide ${
                subTab === tab 
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs" 
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-purple-50 rounded-full border border-purple-200 text-purple-800 font-mono text-[10px]">
          <Zap className="h-3.5 w-3.5 text-purple-600 animate-bounce" />
          <span>Tích hợp AI Copywriter (Gemini Pro)</span>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto" id="marketing_tab_content">
        
        {/* SUB TAB 1: LÊN Ý TƯỞNG AI */}
        {subTab === "LÊN Ý TƯỞNG AI" && (
          <div className="space-y-6" id="ai_marketing_ideas_tab">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="ideation_grid">
              
              {/* Creator Form */}
              <div className="lg:col-span-2 bg-slate-50 border border-gray-200 p-6 rounded-2xl flex flex-col justify-between" id="ideation_campaign_form">
                <div>
                  <h4 className="font-bold text-gray-850 text-sm tracking-wide font-sans flex items-center gap-1.5 uppercase">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
                    Khởi tạo ý tưởng chiến dịch marketing
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 lines-clamp-2">Nhập mục tiêu chiến dịch của bạn. Gemini AI sẽ phân tích và trả về các ý tưởng bản nháp content hoàn chỉnh.</p>

                  <form onSubmit={handleGenerateIdeas} className="mt-5 space-y-4">
                    <textarea 
                      placeholder="Mô tả mục tiêu của bạn (Ex: Khởi động giới thiệu dòng Bàn phím cơ Workspace V2 phân khúc lập trình viên, chiết khấu 10%)..." 
                      className="w-full text-left h-28 p-4 border border-gray-200 bg-white rounded-xl text-xs font-sans focus:ring-2 focus:ring-blue-500"
                      value={campaignInput}
                      onChange={(e) => setCampaignInput(e.target.value)}
                    />
                    {campaignInput.trim() && campaignInput.trim() !== analyzedTopic.trim() && (
                      <p className="text-[10px] text-amber-600 font-bold font-mono tracking-wide animate-pulse mt-1 select-none text-left">
                        ⚠️ Bạn đã thay đổi nội dung mục tiêu. Vui lòng bấm "Phân tích Mục tiêu & Đề xuất Trụ cột AI" ở cột bên phải trước để cập nhật định hướng trước khi phát sinh ý tưởng!
                      </p>
                    )}
                    
                    {/* Quick suggestions chips bubble list */}
                    <div className="space-y-1.5 font-sans">
                      <span className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider block">Gợi ý chủ đề nhanh:</span>
                      <div className="flex flex-wrap gap-2">
                        {loadingSuggestions ? (
                          <>
                            <div className="px-2.5 py-1 text-[10px] rounded-md border border-gray-100 bg-slate-50 text-gray-400 flex items-center gap-1.5 animate-pulse select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                              <span>Gợi ý 1 đang tải...</span>
                            </div>
                            <div className="px-2.5 py-1 text-[10px] rounded-md border border-gray-100 bg-slate-50 text-gray-400 flex items-center gap-1.5 animate-pulse select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                              <span>Gợi ý 2 đang tải...</span>
                            </div>
                            <div className="px-2.5 py-1 text-[10px] rounded-md border border-gray-100 bg-slate-50 text-gray-400 flex items-center gap-1.5 animate-pulse select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                              <span>Gợi ý 3 đang tải...</span>
                            </div>
                          </>
                        ) : (
                          quickSuggestions.map((s, idx) => {
                            const isMatch = campaignInput === s;
                            return (
                              <button 
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setCampaignInput(s);
                                  handleAnalyzePillars(s);
                                }}
                                className={`px-2.5 py-1 text-[10px] rounded-md font-medium transition-all cursor-pointer select-none border ${
                                  isMatch
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-xs transform scale-102 font-semibold"
                                    : "bg-white hover:bg-slate-100 text-gray-650 text-gray-600 border-gray-200"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Platform Selector */}
                    <div className="space-y-2 text-left mt-4">
                      <span className="text-xs font-bold text-gray-750 block uppercase tracking-wider font-mono">
                        📢 Chọn nền tảng truyền thông:
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {[
                          { id: "Facebook", icon: <Facebook className="h-3.5 w-3.5" /> },
                          { id: "TikTok", icon: <span className="font-bold text-[10px] font-mono leading-none">TT</span> },
                          { id: "LinkedIn", icon: <Linkedin className="h-3.5 w-3.5" /> },
                          { id: "Instagram", icon: <Instagram className="h-3.5 w-3.5" /> }
                        ].map((chan) => {
                          const isSelected = selectedChannels.includes(chan.id);
                          return (
                            <button
                              key={chan.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (selectedChannels.length === 1) {
                                    toast.warning("Bạn phải chọn ít nhất một nền tảng!");
                                    return;
                                  }
                                  setSelectedChannels(selectedChannels.filter(c => c !== chan.id));
                                } else {
                                  setSelectedChannels([...selectedChannels, chan.id]);
                                }
                              }}
                              className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer select-none ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/10"
                                  : "border-slate-200 bg-white text-gray-500 hover:bg-slate-100"
                              }`}
                            >
                              {chan.icon}
                              <span>{chan.id}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Auto Media Generation toggle */}
                    <div className="flex items-center gap-3 mt-5 select-none">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAutoMedia}
                          onChange={(e) => {
                            setIsAutoMedia(e.target.checked);
                            if (e.target.checked && mediaType === "none") {
                              setMediaType("image");
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650 peer-checked:bg-indigo-600"></div>
                        <span className="ml-2.5 text-xs font-bold text-gray-750 uppercase tracking-wider font-mono">
                          ✨ Tự động tạo phương tiện AI (Auto Media)
                        </span>
                      </label>
                    </div>

                    {/* Media Type Selection */}
                    {isAutoMedia && (
                      <div className="space-y-2 text-left mt-4 animate-fadeIn">
                        <span className="text-xs font-bold text-gray-750 block uppercase tracking-wider font-mono">
                          🖼️ Chọn loại phương tiện (Media):
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { value: "image", label: "Hình ảnh AI", icon: <ImageIcon className="h-3.5 w-3.5" /> },
                            { value: "video", label: "Video AI", icon: <Video className="h-3.5 w-3.5" /> }
                          ].map((opt) => {
                            const isSelected = mediaType === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMediaType(opt.value)}
                                className={`py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/10"
                                    : "border-slate-200 bg-white text-gray-500 hover:bg-slate-100"
                                }`}
                              >
                                {opt.icon}
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Image Settings */}
                    {isAutoMedia && mediaType === "image" && (
                      <div className="p-4 border border-slate-200 bg-white rounded-2xl space-y-4 text-left mt-4 shadow-2xs">
                        <span className="text-xs font-extrabold text-slate-800 block border-b pb-2 uppercase tracking-wide font-mono flex items-center gap-1.5">
                          <ImageIcon className="h-4 w-4 text-indigo-500" />
                          Cấu hình hình ảnh AI
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 font-mono">Mô hình AI</span>
                            <select
                              value={imageModel}
                              onChange={(e) => setImageModel(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                            >
                              <optgroup label="Google Gemini">
                                <option value="imagen-4.0-generate-001">Google Imagen 4.0 Pro</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash Image Model</option>
                              </optgroup>
                              <optgroup label="PiAPI (Midjourney / Flux)">
                                <option value="piapi-midjourney">PiAPI - Midjourney</option>
                                <option value="piapi-flux">PiAPI - Flux (Text-to-Image)</option>
                              </optgroup>
                            </select>
                          </div>
                          
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 font-mono">Độ phân giải</span>
                            <div className="grid grid-cols-2 gap-2">
                              {["1K", "2K"].map((res) => (
                                <button
                                  key={res}
                                  type="button"
                                  onClick={() => setImageResolution(res)}
                                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    imageResolution === res
                                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                      : "border-slate-200 bg-white text-gray-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {res === "1K" ? "1K Standard" : "2K Ultra HD"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-gray-500 font-mono block">Tỉ lệ khung hình</span>
                          <div className="grid grid-cols-5 gap-2">
                            {["1:1", "4:3", "16:9", "9:16", "3:4"].map((ratio) => (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => setImageAspectRatio(ratio)}
                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                  imageAspectRatio === ratio
                                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                    : "border-slate-200 bg-white text-gray-500 hover:bg-slate-50"
                                }`}
                              >
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Settings */}
                    {isAutoMedia && mediaType === "video" && (
                      <div className="p-4 border border-slate-200 bg-white rounded-2xl space-y-4 text-left mt-4 shadow-2xs">
                        <span className="text-xs font-extrabold text-slate-800 block border-b pb-2 uppercase tracking-wide font-mono flex items-center gap-1.5">
                          <Video className="h-4 w-4 text-indigo-500" />
                          Cấu hình video AI
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 font-mono">Mô hình AI Video</span>
                            <select
                              value={videoModel}
                              onChange={(e) => setVideoModel(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                            >
                              <optgroup label="Google Gemini / Veo">
                                <option value="veo-3.1-generate-preview">iGen Veo 3.1 Fast</option>
                                <option value="veo-3.1-fast-generate-preview">iGen Veo 3.1 Fast (Preview)</option>
                              </optgroup>
                              <optgroup label="PiAPI (Kling / Luma)">
                                <option value="piapi-kling">PiAPI - Kling AI Video</option>
                                <option value="piapi-luma">PiAPI - Luma AI Video</option>
                              </optgroup>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 font-mono">Chất lượng video</span>
                            <select
                              value={videoQuality}
                              onChange={(e) => {
                                if (e.target.value === "1080p" && parseInt(videoDuration) <= 4) {
                                  toast.warning("1080p không hỗ trợ cho video 4 giây. Vui lòng chọn 6 hoặc 8 giây trước.");
                                  return;
                                }
                                setVideoQuality(e.target.value);
                              }}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                            >
                              <option value="720p">720p (HD)</option>
                              <option value="1080p">1080p (Full HD)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 font-mono block">Thời lượng video</span>
                            <div className="grid grid-cols-3 gap-2">
                              {["4", "6", "8"].map((dur) => (
                                <button
                                  key={dur}
                                  type="button"
                                  onClick={() => {
                                    setVideoDuration(dur);
                                    if (parseInt(dur) <= 4 && videoQuality === "1080p") {
                                      setVideoQuality("720p");
                                      toast.warning("1080p yêu cầu tối thiểu 6 giây. Đã tự động chuyển sang 720p.");
                                    }
                                  }}
                                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    videoDuration === dur
                                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                      : "border-slate-200 bg-white text-gray-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {dur}s
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 font-mono block">Tỉ lệ khung hình</span>
                            <div className="grid grid-cols-2 gap-2">
                              {["16:9", "9:16"].map((ratio) => (
                                <button
                                  key={ratio}
                                  type="button"
                                  onClick={() => setVideoAspectRatio(ratio)}
                                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    videoAspectRatio === ratio
                                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                      : "border-slate-200 bg-white text-gray-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {ratio === "16:9" ? "Ngang 16:9" : "Dọc 9:16"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </form>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
                  <button 
                    onClick={handleGenerateIdeas}
                    disabled={loadingAI || !campaignInput.trim() || campaignInput.trim() !== analyzedTopic.trim()}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans flex items-center gap-2 select-none shadow-sm transition-all ${
                      loadingAI || !campaignInput.trim() || campaignInput.trim() !== analyzedTopic.trim()
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                    }`}
                  >
                    {loadingAI ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {loadingAI ? "AI Đang sáng tạo..." : "Phát sinh Ý tưởng từ AI"}
                  </button>
                </div>
              </div>

              {/* Content Pillars guidelines panel */}
              <div className="bg-white border p-6 rounded-2xl flex flex-col justify-between" id="content_pillars_advisory">
                <div>
                  <h4 className="font-bold text-gray-850 text-sm tracking-wide font-sans uppercase">
                    📚 Content Pillars Đề xuất
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Phân tích mục tiêu để đề xuất ra các trụ cột nội dung cốt lõi của chiến dịch, đảm bảo phân bổ đa dạng:</p>

                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => handleAnalyzePillars()}
                      disabled={loadingPillars || !campaignInput.trim()}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                        loadingPillars || !campaignInput.trim()
                          ? "bg-gray-50 text-gray-400 border-gray-250 cursor-not-allowed"
                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-150 cursor-pointer active:scale-98"
                      }`}
                    >
                      <Sparkles className={`h-4 w-4 text-indigo-500 ${loadingPillars ? "animate-spin" : ""}`} />
                      {loadingPillars ? "Đang phân tích khung nội dung..." : "Phân tích Mục tiêu & Đề xuất Trụ cột AI"}
                    </button>
                  </div>

                  <div className="space-y-3 text-xs text-left relative">
                    {loadingPillars && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 z-10 rounded-xl">
                        <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mb-2" />
                        <span className="text-[11px] text-indigo-800 font-bold font-mono">AI ĐANG PHÂN TÍCH KHUNG NỘI DUNG...</span>
                        <p className="text-[10px] text-gray-400 mt-1">Đảm bảo khung tranh phân phối đa dạng, tránh chỉ đăng tải bán hàng.</p>
                      </div>
                    )}

                    {pillars.map((pillar) => {
                      const isSelected = selectedPillars.includes(pillar.id);
                      return (
                        <div 
                          key={pillar.id}
                          onClick={() => togglePillar(pillar.id)}
                          className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                            isSelected 
                              ? pillar.selectedColorClass 
                              : `${pillar.colorClass} opacity-50 hover:opacity-85`
                          }`}
                        >
                          <div className="flex justify-between items-center font-bold">
                            <span className="flex items-center gap-1.5 text-xs text-slate-800">
                              <span className={`w-2.5 h-2.5 rounded-full ${pillar.bulletColor}`} />
                              {pillar.title}
                            </span>
                            <span className="text-[10px] opacity-80 font-mono font-semibold text-slate-500">{pillar.ratio}</span>
                          </div>
                          <p className="text-[10px] mt-2 leading-relaxed text-slate-500 font-sans pointer-events-none">
                            {pillar.description}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-[9px] font-mono uppercase font-bold tracking-wider">
                            <span className={isSelected ? "text-indigo-600 font-semibold" : "text-gray-400"}>
                              {isSelected ? "● Đang tuyển chọn" : "○ Tạm tắt"}
                            </span>
                            <span className="text-slate-400">Click để đổi</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400 font-mono">
                  Phân tích bởi iGen Marketing Advisor
                </div>
              </div>

            </div>

            {/* Campaign concepts generator list */}
            <div className="space-y-4" id="campaign_draft_concepts_section">
              <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider block">Bản nháp ý tưởng sáng tạo ({concepts.length})</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="concepts_container">
                {concepts.map((concept, idx) => (
                  <div key={idx} className="p-5 bg-white border border-gray-250/70 hover:border-indigo-300 rounded-2xl transition-all shadow-xs text-left flex flex-col justify-between" id={`concept_card_${idx}`}>
                    <div>
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-tight leading-snug line-clamp-2">{concept.title}</span>
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold font-mono text-[10px]">
                          Phù hợp: {concept.matchPercent}%
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{concept.summary}</p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {concept.channels.map((chan, cidx) => (
                          <span key={cidx} className="px-2 py-0.5 bg-slate-50 border border-gray-150 rounded-sm text-[9px] font-mono text-slate-500 uppercase tracking-wide">
                            {chan}
                          </span>
                        ))}
                      </div>

                      {concept.hashtags && concept.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {concept.hashtags.map((tag, tidx) => (
                            <span key={tidx} className="text-[10px] font-mono text-indigo-500 font-semibold">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4 bg-gray-50 p-4 rounded-xl border border-dashed">
                      <div className="flex items-center gap-1.5 text-indigo-650 text-indigo-600 font-bold mb-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-mono uppercase">Mẫu Content sinh ra từ AI:</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-3 italic leading-relaxed font-sans">{concept.suggestedContent}</p>
                      
                      <div className="mt-3.5 flex justify-end gap-2 text-xs">
                        <button 
                          onClick={() => handleDevelopConcept(concept, idx)}
                          disabled={developingIdx !== null}
                          className={`px-3 py-1.5 text-white rounded-lg font-bold select-none text-[10px] transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 ${
                            developingIdx === idx ? "bg-purple-600 hover:bg-purple-700" : "bg-indigo-600 hover:bg-indigo-700"
                          }`}
                        >
                          {developingIdx === idx ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Đang viết chi tiết...</span>
                            </>
                          ) : (
                            <>
                              <span>Phát triển tiếp 🚀</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 2: DUYỆT NỘI DUNG */}
        {subTab === "DUYỆT NỘI DUNG" && (
          <div className="space-y-6" id="moderation_pipeline_tab">
            
            {isUserRole && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold select-none text-left">
                <span>🔒 Bạn đang sử dụng tài khoản quyền **USER**. Bạn có quyền tạo bài viết mới, gửi duyệt nháp, lên lịch đăng tải và xóa bài viết của mình, nhưng không có quyền phê duyệt bài viết đang chờ duyệt.</span>
              </div>
            )}

            {/* Quick Prompt generator row */}
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex gap-3 items-end" id="prompt_more_bar">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 font-mono uppercase mb-1.5">Prompt AI viết thêm bài đăng chủ đề mới:</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Viết 1 bài đăng thông báo Khai trương kho mới quận Bình Thạnh..." 
                  className="w-full text-left px-3.5 py-2 border border-gray-200 bg-white rounded-lg text-xs"
                  value={promptMore}
                  onChange={(e) => setPromptMore(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAIGenerateMore}
                disabled={!promptMore.trim()}
                className={`px-4 py-2 text-white text-xs font-bold rounded-lg flex items-center gap-1 shrink-0 transition-all ${
                  !promptMore.trim()
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 cursor-pointer active:scale-95"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                AI viết bài đăng mới
              </button>
            </div>

            {/* Content pipeline grid columns: 5 distinct stages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4" id="moderation_columns">
              
              {/* STATUS 1: DRAFT (BẢN NHÁP) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                  <span className="text-[11px] font-bold text-slate-700 tracking-wider flex items-center gap-1">
                    📝 NHÁP ({approvalCards.filter(c => c.status === "draft").length})
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {approvalCards.filter(c => c.status === "draft").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Hết bài viết nháp</div>
                  ) : (
                    approvalCards.filter(c => c.status === "draft").map(card => (
                      <ModerationPipCard 
                        key={card.id} 
                        card={card} 
                        onNextStatus={() => updateCardStatus(card.id, "pending")}
                        onPrevStatus={null}
                        onDelete={() => deleteCard(card.id)} 
                        onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                        onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* STATUS 2: PENDING (CHỜ DUYỆT) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                  <span className="text-[11px] font-bold text-amber-800 tracking-wider flex items-center gap-1">
                    ⏳ CHỜ DUYỆT ({approvalCards.filter(c => c.status === "pending").length})
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {approvalCards.filter(c => c.status === "pending").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Hết bài duyệt chờ!</div>
                  ) : (
                    approvalCards.filter(c => c.status === "pending").map(card => (
                      <ModerationPipCard 
                        key={card.id} 
                        card={card} 
                        onNextStatus={isUserRole ? null : () => updateCardStatus(card.id, "approved")}
                        onPrevStatus={() => updateCardStatus(card.id, "draft")}
                        onDelete={() => deleteCard(card.id)} 
                        onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                        onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* STATUS 3: APPROVED (ĐÃ DUYỆT) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                  <span className="text-[11px] font-bold text-blue-800 tracking-wider flex items-center gap-1">
                    ✓ ĐÃ DUYỆT ({approvalCards.filter(c => c.status === "approved").length})
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {approvalCards.filter(c => c.status === "approved").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Chưa có bài đã duyệt</div>
                  ) : (
                    approvalCards.filter(c => c.status === "approved").map(card => (
                      <ModerationPipCard 
                        key={card.id} 
                        card={card} 
                        onNextStatus={() => {
                          if (card.channel !== "Facebook" && card.channel !== "TikTok") {
                            toast.error(`Kênh "${card.channel}" chưa hỗ trợ tự động lên lịch.`);
                            return;
                          }
                          setSchedulingCard(card);
                          setScheduleDate(new Date().toISOString().split('T')[0]);
                          setScheduleTime("09:00");
                        }}
                        onPrevStatus={isUserRole ? null : () => updateCardStatus(card.id, "pending")}
                        onDelete={() => deleteCard(card.id)} 
                        onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                        onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* STATUS 4: SCHEDULED (ĐÃ LÊN LỊCH) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                  <span className="text-[11px] font-bold text-emerald-800 tracking-wider flex items-center gap-1">
                    📅 ĐÃ LÊN LỊCH ({approvalCards.filter(c => c.status === "scheduled" || c.status === "failed").length})
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {approvalCards.filter(c => c.status === "scheduled" || c.status === "failed").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Kéo duyệt để lên lịch!</div>
                  ) : (
                    approvalCards.filter(c => c.status === "scheduled" || c.status === "failed").map(card => (
                      <ScheduledCard 
                        key={card.id} 
                        card={card} 
                        isUserRole={isUserRole}
                        onPrevStatus={() => updateCardStatus(card.id, "approved")}
                        onDelete={() => deleteCard(card.id)}
                        fbIntegration={userProfile?.facebookIntegration}
                        tiktokIntegration={userProfile?.tiktokIntegration}
                        onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                        onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                        onPublishToTikTok={() => handlePublishToTikTok(card)}
                        isPublishingTikTok={publishingTikTokId === card.id}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* STATUS 5: PUBLISHED (ĐÃ ĐĂNG TẢI) */}
              <div className="bg-green-50/70 border border-green-200 rounded-2xl p-3 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-green-200">
                  <span className="text-[11px] font-bold text-green-800 tracking-wider flex items-center gap-1">
                    ✅ ĐÃ ĐĂNG TẢI ({approvalCards.filter(c => c.status === "published").length})
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {approvalCards.filter(c => c.status === "published").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Chưa có bài nào được đăng tải!</div>
                  ) : (
                    approvalCards.filter(c => c.status === "published").map(card => (
                      <PublishedCard 
                        key={card.id} 
                        card={card} 
                        onDelete={() => deleteCard(card.id)} 
                        isUserRole={isUserRole} 
                        onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUB TAB 3: LỊCH ĐĂNG CONTENT */}
        {subTab === "LỊCH ĐĂNG CONTENT" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="publishing_calendar_block">
            {/* Left 2 Cols: Monthly grid view */}
            <div className="xl:col-span-2 bg-slate-50 border border-gray-200 p-6 rounded-2xl text-xs flex flex-col justify-between" id="calendar_grid_container">
              <div>
                <div className="flex justify-between items-center mb-5">
                  <h4 className="font-bold text-slate-800 text-sm font-sans tracking-tight flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-blue-500" />
                    Lịch Xuất Bản Content • {monthNamesVi[currentMonth]}, {currentYear}
                  </h4>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-md border text-[11px] font-mono select-none">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-sm cursor-pointer">‹</button>
                    <span className="font-bold px-2">{monthNamesVi[currentMonth]}, {currentYear}</span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-sm cursor-pointer">›</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 bg-gray-200 p-1 rounded-xl text-center font-bold tracking-wider text-slate-600 text-[10px] uppercase mb-1">
                  <div>T2</div>
                  <div>T3</div>
                  <div>T4</div>
                  <div>T5</div>
                  <div>T6</div>
                  <div>T7</div>
                  <div>CN</div>
                </div>

                {/* Grid squares rendering dynamic items */}
                <div className="grid grid-cols-7 gap-1 font-mono text-[11px]" id="calendar_days_grid">
                  {/* Mock padded previous month days */}
                  {Array.from({ length: startOffset }).map((_, idx) => {
                    const dayVal = prevMonthLastDate - startOffset + idx + 1;
                    return (
                      <div key={`prev-${idx}`} className="h-16 p-2 bg-gray-150 text-gray-300 rounded-lg select-none text-left opacity-40">
                        {dayVal}
                      </div>
                    );
                  })}

                  {Array.from({ length: daysInMonth }).map((_, dIdx) => {
                    const dayNum = dIdx + 1;
                    const matchEvents = joinedEvents.filter(e => e.date === dayNum);
                    const isSelected = selectedDay === dayNum;
                    return (
                      <div 
                        key={dayNum}
                        onClick={() => setSelectedDay(dayNum)}
                        className={`h-16 p-2 text-left rounded-lg border transition-all cursor-pointer relative ${
                          isSelected 
                            ? "bg-blue-50 border-blue-400 text-blue-800" 
                            : "bg-white border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <span className="font-bold font-semibold select-none text-[10px]">{dayNum}</span>
                        {matchEvents.length > 0 && (
                          <div className="absolute bottom-1 left-2.5 right-2.5 flex flex-col gap-0.5">
                            {matchEvents.map(e => (
                              <div key={e.id} className={`px-1 rounded-sm text-[8px] font-sans truncate font-bold uppercase tracking-wider ${
                                e.status === "Published" 
                                  ? "bg-green-500 text-white" 
                                  : e.status === "Approved" 
                                    ? "bg-blue-500 text-white" 
                                    : "bg-amber-400 text-white"
                              }`}>
                                {e.channel}: {e.status}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-150 rounded-b-xl select-none text-center text-[10px] text-gray-400 font-mono mt-4">
                Click chọn các ngày có gắn sự kiện để truy lục lịch truyền thông tương ứng của iGen ERP
              </div>
            </div>

            {/* Right Card: Day content schedule timeline detail */}
            <div className="bg-white border p-6 rounded-2xl flex flex-col justify-between" id="calendar_events_details_col">
              {selectedDay ? (
                <div>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-850 text-sm font-sans tracking-tight uppercase">
                      📅 Lịch đăng ngày {selectedDay}/{currentMonth + 1}/{currentYear}
                    </h4>
                    <button 
                      onClick={() => setSelectedDay(null)}
                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-mono text-[9px] font-bold border border-indigo-150 transition-colors cursor-pointer"
                    >
                      Xem tất cả ✕
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Danh sách chuỗi nội dung truyền thông cần vận hành trong ngày.</p>

                  <div className="h-64 overflow-y-auto mt-6 space-y-4 text-xs text-slate-655 text-left">
                    {joinedEvents.filter(e => e.date === selectedDay).length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 text-gray-400 italic rounded-xl">
                        Không có lịch đăng tải nào được lập cho ngày này! Bạn có thể chuyển bản nháp sang Chờ đăng tải.
                      </div>
                    ) : (
                      joinedEvents.filter(e => e.date === selectedDay).map(event => (
                        <div key={event.id} className="p-4 bg-slate-50 border border-gray-150 rounded-xl relative flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="px-2 py-0.5 bg-slate-200 rounded-sm font-bold font-mono text-[9px] uppercase">
                              Kênh: {event.channel}
                            </span>
                            <span className={`px-2 py-0.5 rounded-sm font-bold font-mono text-[9px] uppercase text-white ${
                              event.status === "Published" 
                                ? "bg-green-500" 
                                : event.status === "Approved" 
                                  ? "bg-blue-600" 
                                  : "bg-amber-500"
                            }`}>
                              {event.status}
                            </span>
                          </div>
                          <h5 className="font-bold font-sans text-xs text-slate-800 leading-normal">{event.title}</h5>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Định dạng: {event.type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-850 text-sm font-sans tracking-tight uppercase">
                      📅 Lịch đăng tháng {currentMonth + 1}/{currentYear}
                    </h4>
                    <span className="px-2 py-0.5 bg-slate-100 rounded font-mono text-[9px] font-bold border border-gray-205">
                      {joinedEvents.length} bài viết
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Tất cả bài đăng dự kiến trong tháng này.</p>

                  <div className="h-64 overflow-y-auto mt-6 space-y-4 text-xs text-slate-655 text-left">
                    {joinedEvents.length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 text-gray-400 italic rounded-xl">
                        Không có lịch đăng tải nào được lập trong tháng này!
                      </div>
                    ) : (
                      [...joinedEvents]
                        .sort((a, b) => a.date - b.date)
                        .map(event => (
                          <div key={event.id} className="p-4 bg-slate-50 border border-gray-150 rounded-xl relative flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <span className="px-2 py-0.5 bg-slate-200 rounded-sm font-bold font-mono text-[9px] uppercase">
                                Ngày {event.date} • {event.channel}
                              </span>
                              <span className={`px-2 py-0.5 rounded-sm font-bold font-mono text-[9px] uppercase text-white ${
                                event.status === "Published" 
                                  ? "bg-green-500" 
                                  : event.status === "Approved" 
                                    ? "bg-blue-600" 
                                    : "bg-amber-500"
                              }`}>
                                {event.status}
                              </span>
                            </div>
                            <h5 className="font-bold font-sans text-xs text-slate-800 leading-normal">{event.title}</h5>
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Định dạng: {event.type}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-150 flex flex-col gap-2">
                <button 
                  onClick={() => {
                    if (isUserRole) {
                      toast.error("Tài khoản quyền USER không có quyền kích hoạt Autopost!");
                      return;
                    }
                    toast.success("Kích hoạt kết nối Autopost tự động qua Meta & Tiktok APIs của iGen ERP thành công!");
                  }}
                  disabled={isUserRole}
                  className={`w-full text-center py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                    isUserRole
                      ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed select-none"
                      : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95"
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <span>{isUserRole ? "🔒 Quyền Autopost bị hạn chế" : "Kích hoạt Autopost đồng bộ"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 4: XƯỞNG NỘI DUNG */}
        {subTab === "XƯỞNG NỘI DUNG" && (
          <ContentStudioWorkspace 
            initialParams={contentStudioParams}
            onClearParams={() => setContentStudioParams(null)}
            onMediaSaved={handleMediaSaved}
          />
        )}

      </div>

      {/* Glassmorphic Lightbox Preview modal */}
      {activeLightboxCard && activeLightboxUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden text-left flex flex-col md:flex-row max-h-[85vh]">
            
            {/* Left side: Media preview */}
            <div className="flex-1 bg-black/40 flex items-center justify-center p-4 relative min-h-[300px]">
              {activeLightboxType === "image" ? (
                <img 
                  src={activeLightboxUrl} 
                  alt="AI Preview" 
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg animate-scaleIn"
                />
              ) : (
                <video 
                  src={activeLightboxUrl} 
                  controls 
                  autoPlay 
                  className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
                />
              )}
            </div>

            {/* Right side: Prompt details & actions */}
            <div className="w-full md:w-80 bg-slate-900/90 text-white p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full font-bold text-[10px] tracking-wide uppercase">
                    Preview Phương Tiện
                  </span>
                  <button 
                    onClick={() => {
                      setActiveLightboxCard(null);
                      setActiveLightboxType(null);
                      setActiveLightboxUrl(null);
                      setShowDeleteMediaConfirm(false);
                    }}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-sm tracking-tight text-slate-100">{activeLightboxCard.title}</h4>
                  <p className="text-[10px] text-slate-400 font-mono">Kênh đăng: {activeLightboxCard.channel}</p>
                </div>

              </div>

              <div className="pt-4 border-t border-white/15">
                <button 
                  onClick={handleDeleteMedia}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 border border-red-900/50 hover:border-red-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa phương tiện</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {showDeleteMediaConfirm && activeLightboxCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200/50 shadow-2xl w-full max-w-sm overflow-hidden font-sans animate-scaleIn">
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4 border border-red-100">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h4 className="font-bold text-gray-800 text-base mb-2">Xóa phương tiện?</h4>
              <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
                Bạn có chắc chắn muốn xóa {activeLightboxType === 'image' ? 'hình ảnh' : 'video'} này khỏi bài đăng? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowDeleteMediaConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMedia}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm shadow-red-200"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {schedulingCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn" id="schedule_modal_backdrop">
          <div className="bg-white rounded-3xl border border-gray-200/50 shadow-2xl w-full max-w-md overflow-hidden font-sans">
            
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600 animate-pulse" />
                  Lên lịch đăng bài viết
                </h4>
                <p className="text-xs text-gray-400 mt-1">Chọn ngày và giờ đăng bài lên kênh truyền thông</p>
              </div>
              <button 
                onClick={() => setSchedulingCard(null)}
                className="p-1 px-3 text-sm text-slate-400 hover:text-slate-655 hover:bg-slate-100 rounded-md font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-xs text-left">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-dashed border-gray-200">
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Bài viết được chọn:</p>
                <h5 className="font-bold text-gray-800 text-xs mt-1 leading-snug">{schedulingCard.title}</h5>
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded text-[9px] font-mono text-indigo-700">
                  Kênh: {schedulingCard.channel}
                </span>
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">
                  Chọn tài khoản đăng *
                </label>
                {loadingIntegrationsForSchedule ? (
                  <div className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center gap-2 text-gray-400">
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-650" />
                    <span>Đang tải danh sách tài khoản...</span>
                  </div>
                ) : availableIntegrations.length > 0 ? (
                  <select
                    disabled={isScheduling}
                    className={`w-full p-2.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium text-gray-750 ${
                      isScheduling ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""
                    }`}
                    value={scheduleIntegrationId}
                    onChange={(e) => setScheduleIntegrationId(e.target.value)}
                  >
                    {availableIntegrations.map((integration) => (
                      <option key={integration._id} value={integration._id}>
                        {integration.displayName} ({integration.username || "Chưa có username"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 border border-amber-250 bg-amber-50 text-amber-800 rounded-xl space-y-1.5">
                    <p className="font-semibold leading-normal">
                      Chưa có tài khoản liên kết nào cho kênh này.
                    </p>
                    <p className="text-[10px] text-amber-700 leading-normal font-sans">
                      Vui lòng vào mục <strong>Cài đặt -&gt; MXH Doanh nghiệp</strong> để kết nối tài khoản {schedulingCard.channel} trước.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Ngày đăng bài *</label>
                <input 
                  type="date" 
                  required
                  disabled={isScheduling}
                  className={`w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                    isScheduling ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""
                  }`}
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Giờ đăng bài *</label>
                <input 
                  type="time" 
                  required
                  disabled={isScheduling}
                  className={`w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                    isScheduling ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""
                  }`}
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end">
                <button 
                  type="button" 
                  disabled={isScheduling}
                  onClick={() => setSchedulingCard(null)}
                  className={`px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-all text-xs ${
                    isScheduling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  Bỏ qua
                </button>
                <button 
                  type="button" 
                  disabled={isScheduling || availableIntegrations.length === 0}
                  onClick={handleConfirmSchedule}
                  className={`px-5 py-2 text-white rounded-lg font-bold transition-colors text-xs shadow-sm flex items-center gap-1.5 ${
                    isScheduling || availableIntegrations.length === 0
                      ? "bg-gray-300 text-gray-400 cursor-not-allowed shadow-none"
                      : "bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-sm shadow-indigo-200"
                  }`}
                >
                  {isScheduling ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Xác nhận lên lịch"
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

interface ModerationPipCardProps {
  key?: string;
  card: ContentApprovalCard;
  onNextStatus?: (() => void) | null;
  onPrevStatus?: (() => void) | null;
  onDelete?: (() => void) | null;
  onPreviewMedia: (type: 'image' | 'video', url: string) => void;
  onGenerateMedia: (card: ContentApprovalCard, type?: 'image' | 'video') => void;
}

// PIPELINE CARD widget component representing moderation cards
function ModerationPipCard({ 
  card, 
  onNextStatus, 
  onPrevStatus, 
  onDelete,
  onPreviewMedia,
  onGenerateMedia
}: ModerationPipCardProps) {
  return (
    <div className="bg-white border text-left border-gray-150/70 p-3.5 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-2 relative group" id={`approval_card_${card.id}`}>
      
      {/* Category header */}
      <div className="flex justify-between items-center">
        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded-sm text-[9px] font-mono font-bold text-indigo-700 tracking-wider">
          Phân phối: {card.channel}
        </span>
        <span className="text-[9px] text-gray-400 font-mono tracking-wide">{card.contentType}</span>
      </div>

      {/* Media Thumbnails */}
      {card.imageUrl && (
        <div 
          onClick={() => onPreviewMedia('image', card.imageUrl!)}
          className="relative cursor-pointer overflow-hidden rounded-lg aspect-video w-full border border-gray-100 shadow-xs hover:scale-[1.02] transition-transform bg-slate-50"
        >
          <img src={card.imageUrl} alt="AI Illustration" className="w-full h-full object-cover" />
        </div>
      )}

      {card.videoUrl && (
        <div 
          onClick={() => onPreviewMedia('video', card.videoUrl!)}
          className="relative cursor-pointer overflow-hidden rounded-lg aspect-video w-full border border-gray-100 shadow-xs hover:scale-[1.02] transition-transform bg-slate-900 flex items-center justify-center"
        >
          <video src={card.videoUrl} className="w-full h-full object-cover opacity-80 animate-fadeIn" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center text-slate-800 shadow-md">
              <span className="ml-0.5 text-xs">▶</span>
            </div>
          </div>
        </div>
      )}

      {/* Generate Media Button if none exists */}
      {!card.imageUrl && !card.videoUrl && card.status !== 'published' && (
        <button
          onClick={() => onGenerateMedia(card)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 border border-purple-200 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
        >
          <Sparkles className="h-3 w-3 text-purple-500 animate-pulse" />
          <span>Tạo Ảnh / Video AI</span>
        </button>
      )}

      <h5 className="font-bold text-gray-800 leading-tight text-xs font-sans line-clamp-2">{card.title}</h5>
      <p className="text-[11px] text-gray-500 leading-relaxed font-sans bg-slate-50/50 p-2 rounded-lg border border-dashed select-text max-h-[120px] overflow-y-auto whitespace-pre-wrap">
        {card.bodyText}
      </p>

      {card.outline && (
        <details className="text-[10px] text-gray-500 bg-slate-50/80 p-2 rounded-lg border border-gray-150">
          <summary className="cursor-pointer font-bold text-gray-600 select-none text-[9px] font-mono">🔍 XEM DÀN Ý (OUTLINE)</summary>
          <div className="mt-1.5 whitespace-pre-wrap font-sans text-gray-500 leading-relaxed border-t border-gray-100 pt-1.5 max-h-[100px] overflow-y-auto">{card.outline}</div>
        </details>
      )}

      {/* Detail list status */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[9px]">
        <span className="text-gray-400 font-mono text-[8px]">{formatCardDate(card.generatedAt)}</span>
        
        {/* Approve/Reject Controls action buttons */}
        <div className="flex items-center gap-1">
          {onPrevStatus && (
            <button 
              onClick={onPrevStatus}
              title={card.status === "pending" ? "Mục cũ: Nháp" : card.status === "approved" ? "Mục cũ: Chờ duyệt" : "Mục cũ: Đã duyệt"}
              className="p-1 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md font-bold transition-all flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>
          )}

          {onDelete && (
            <button 
              onClick={onDelete}
              title="Xóa bài đăng"
              className="p-1 text-red-500 hover:bg-red-50 rounded-md font-bold transition-all flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          {onNextStatus && (
            <button 
              onClick={onNextStatus}
              className="p-1 px-1.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold transition-all flex items-center gap-0.5 text-[9px] cursor-pointer"
            >
              <span>{card.status === "draft" ? "Sẵn sàng" : card.status === "pending" ? "Duyệt ✓" : "Lên lịch 📅"}</span>
              <ArrowRight className="h-2.5 w-2.5" />
            </button>
          )}

          {card.status === "scheduled" && (
            <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm text-[8px] font-bold font-mono">
              ✓ ĐỒNG BỘ
            </span>
          )}
        </div>
      </div>

    </div>
  );
}

// SCHEDULED CARD - hiển thị với nút đăng Facebook / TikTok
interface ScheduledCardProps {
  key?: string;
  card: ContentApprovalCard;
  isUserRole: boolean;
  onPrevStatus: () => void;
  onDelete: () => void;
  fbIntegration?: { isConnected: boolean; pageId: string; pageName: string; pageAccessToken: string; isMock?: boolean } | null;
  tiktokIntegration?: { isConnected: boolean; username: string; displayName: string; isMock?: boolean; privacyLevel?: string } | null;
  onPreviewMedia: (type: 'image' | 'video', url: string) => void;
  onGenerateMedia: (card: ContentApprovalCard, type?: 'image' | 'video') => void;
  onPublishToTikTok?: () => void;
  isPublishingTikTok?: boolean;
}

function ScheduledCard({ 
  card, 
  isUserRole, 
  onPrevStatus, 
  onDelete, 
  fbIntegration,
  tiktokIntegration,
  onPreviewMedia,
  onGenerateMedia,
  onPublishToTikTok,
  isPublishingTikTok = false,
}: ScheduledCardProps) {
  return (
    <div className="bg-white border text-left border-gray-150/70 p-3.5 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-2 relative group" id={`scheduled_card_${card.id}`}>
      
      <div className="flex justify-between items-center">
        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded-sm text-[9px] font-mono font-bold text-indigo-700 tracking-wider">
          {card.channel}
        </span>
        <span className="text-[9px] text-gray-400 font-mono tracking-wide">{card.contentType}</span>
      </div>

      {/* Media Thumbnails */}
      {card.imageUrl && (
        <div 
          onClick={() => onPreviewMedia('image', card.imageUrl!)}
          className="relative cursor-pointer overflow-hidden rounded-lg aspect-video w-full border border-gray-100 shadow-xs hover:scale-[1.02] transition-transform bg-slate-50"
        >
          <img src={card.imageUrl} alt="AI Illustration" className="w-full h-full object-cover" />
        </div>
      )}

      {card.videoUrl && (
        <div 
          onClick={() => onPreviewMedia('video', card.videoUrl!)}
          className="relative cursor-pointer overflow-hidden rounded-lg aspect-video w-full border border-gray-100 shadow-xs hover:scale-[1.02] transition-transform bg-slate-900 flex items-center justify-center"
        >
          <video src={card.videoUrl} className="w-full h-full object-cover opacity-80 animate-fadeIn" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center text-slate-800 shadow-md">
              <span className="ml-0.5 text-xs">▶</span>
            </div>
          </div>
        </div>
      )}

      {/* Generate Media Button if none exists */}
      {!card.imageUrl && !card.videoUrl && (
        <button
          onClick={() => onGenerateMedia(card)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 border border-purple-200 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
        >
          <Sparkles className="h-3 w-3 text-purple-500 animate-pulse" />
          <span>Tạo Ảnh / Video AI</span>
        </button>
      )}

      <h5 className="font-bold text-gray-800 leading-tight text-xs font-sans line-clamp-2">{card.title}</h5>
      <p className="text-[11px] text-gray-500 leading-relaxed font-sans bg-slate-50/50 p-2 rounded-lg border border-dashed select-text max-h-[100px] overflow-y-auto whitespace-pre-wrap">
        {card.bodyText}
      </p>

      {card.outline && (
        <details className="text-[10px] text-gray-500 bg-slate-50/80 p-2 rounded-lg border border-gray-150">
          <summary className="cursor-pointer font-bold text-gray-600 select-none text-[9px] font-mono">🔍 XEM DÀN Ý (OUTLINE)</summary>
          <div className="mt-1.5 whitespace-pre-wrap font-sans text-gray-500 leading-relaxed border-t border-gray-100 pt-1.5 max-h-[80px] overflow-y-auto">{card.outline}</div>
        </details>
      )}

      {card.scheduledDate && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
          <Clock className="h-3 w-3" />
          {card.scheduledDate} {card.scheduledTime && `lúc ${card.scheduledTime}`}
        </div>
      )}

      {card.status === "failed" && card.publishError && (
        <div className="flex flex-col gap-1 text-[10px] text-red-700 font-mono bg-red-50 border border-red-200 p-2.5 rounded-lg">
          <span className="font-extrabold flex items-center gap-1">⚠️ LỖI TỰ ĐỘNG ĐĂNG:</span>
          <span className="leading-relaxed font-sans font-medium text-red-650">{card.publishError}</span>
        </div>
      )}

      {/* TikTok Publish Button - chỉ hiện khi channel TikTok và đã kết nối */}
      {card.channel === 'TikTok' && tiktokIntegration?.isConnected && onPublishToTikTok && (
        <button
          onClick={onPublishToTikTok}
          disabled={isPublishingTikTok || !card.videoUrl}
          title={!card.videoUrl ? 'Cần có video để đăng lên TikTok' : (isPublishingTikTok ? 'Đang đăng...' : 'Đăng video lên TikTok')}
          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
            !card.videoUrl
              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
              : isPublishingTikTok
              ? 'bg-slate-800 text-white border-slate-700 opacity-75 cursor-wait'
              : 'bg-black hover:bg-slate-800 text-white border-black shadow-md hover:shadow-lg active:scale-[0.98]'
          }`}
          id={`tiktok_publish_btn_${card.id}`}
        >
          {isPublishingTikTok ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /><span>Đang đăng lên TikTok...</span></>
          ) : (
            <><span className="text-sm">♪</span><span>Đăng lên TikTok {tiktokIntegration.isMock ? '(Demo)' : ''}</span></>
          )}
        </button>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[9px]">
        <span className="text-gray-400 font-mono text-[8px]">{formatCardDate(card.generatedAt)}</span>
        <div className="flex items-center gap-1">
          <button onClick={onPrevStatus} title="Quay lại: Đã duyệt"
            className="p-1 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md font-bold transition-all flex items-center justify-center cursor-pointer">
            <ArrowLeft className="h-3 w-3" />
          </button>
          <button onClick={onDelete} title="Xóa bài đăng"
            className="p-1 text-red-500 hover:bg-red-50 rounded-md font-bold transition-all flex items-center justify-center cursor-pointer">
            <Trash2 className="h-3 w-3" />
          </button>
          {card.status === "failed" ? (
            <span className="px-1.5 py-0.5 bg-red-550 bg-red-500 text-white rounded-sm text-[8px] font-bold font-mono animate-pulse">
              ⚠️ LỖI ĐĂNG
            </span>
          ) : (
            <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm text-[8px] font-bold font-mono">
              ✓ LỊCH
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// PUBLISHED CARD - hiển thị bài đã đăng lên Facebook
interface PublishedCardProps {
  key?: string;
  card: ContentApprovalCard;
  onDelete: () => void;
  isUserRole: boolean;
  onPreviewMedia: (type: 'image' | 'video', url: string) => void;
}

function PublishedCard({ card, onDelete, isUserRole, onPreviewMedia }: PublishedCardProps) {
  const mockPageUrl = `https://www.facebook.com/permalink.php?story_fbid=${card.facebookPostId}&id=mock`;

  return (
    <div className="bg-white border text-left border-green-200 p-3.5 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-2 relative" id={`published_card_${card.id}`}>
      
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 border border-green-300 rounded-sm text-[9px] font-mono font-bold text-green-700 tracking-wider">
          <CheckCircle2 className="h-3 w-3" /> ĐÃ ĐĂNG
        </span>
        <span className="text-[9px] text-gray-400 font-mono">{card.channel}</span>
      </div>

      {/* Media Thumbnails */}
      {card.imageUrl && (
        <div 
          onClick={() => onPreviewMedia('image', card.imageUrl!)}
          className="relative cursor-pointer overflow-hidden rounded-lg aspect-video w-full border border-gray-100 shadow-xs hover:scale-[1.02] transition-transform bg-slate-50"
        >
          <img src={card.imageUrl} alt="AI Illustration" className="w-full h-full object-cover" />
        </div>
      )}

      {card.videoUrl && (
        <div 
          onClick={() => onPreviewMedia('video', card.videoUrl!)}
          className="relative cursor-pointer overflow-hidden rounded-lg aspect-video w-full border border-gray-100 shadow-xs hover:scale-[1.02] transition-transform bg-slate-900 flex items-center justify-center"
        >
          <video src={card.videoUrl} className="w-full h-full object-cover opacity-80" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center text-slate-800 shadow-md">
              <span className="ml-0.5 text-xs">▶</span>
            </div>
          </div>
        </div>
      )}

      <h5 className="font-bold text-gray-800 leading-tight text-xs font-sans line-clamp-2">{card.title}</h5>
      <p className="text-[11px] text-gray-500 leading-relaxed font-sans bg-green-50/50 p-2 rounded-lg border border-dashed border-green-200 select-text max-h-[80px] overflow-y-auto whitespace-pre-wrap">
        {card.bodyText}
      </p>

      {card.outline && (
        <details className="text-[10px] text-gray-500 bg-slate-50/80 p-2 rounded-lg border border-gray-150">
          <summary className="cursor-pointer font-bold text-gray-600 select-none text-[9px] font-mono">🔍 XEM DÀN Ý (OUTLINE)</summary>
          <div className="mt-1.5 whitespace-pre-wrap font-sans text-gray-500 leading-relaxed border-t border-gray-100 pt-1.5 max-h-[80px] overflow-y-auto">{card.outline}</div>
        </details>
      )}

      {card.publishedAt && (
        <div className="text-[10px] text-green-700 font-mono bg-green-50 border border-green-200 px-2 py-1 rounded-md flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Đăng lúc: {new Date(card.publishedAt).toLocaleString('vi-VN')}
        </div>
      )}

      {card.facebookPostId && (
        <div
          title={`Facebook Post ID: ${card.facebookPostId}`}
          className="text-[10px] text-blue-600 font-mono bg-blue-50 border border-blue-200 px-2 py-1 rounded-md flex items-center justify-between gap-1 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => {
            if (card.facebookPostId?.includes('mock')) {
              toast.success(`[Demo] Bài đăng Facebook ID: ${card.facebookPostId}`);
            }
          }}
        >
          <span className="flex items-center gap-1">
            <Facebook className="h-3 w-3" />
            Post ID: {card.facebookPostId?.slice(0, 20)}...
          </span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </div>
      )}

      <div className="flex items-center justify-end border-t border-gray-100 pt-2">
        <button onClick={onDelete} title="Xóa bài đăng"
          className="p-1 text-red-400 hover:bg-red-50 rounded-md transition-all flex items-center justify-center cursor-pointer">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
