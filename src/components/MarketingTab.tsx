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
  CheckCircle2
} from "lucide-react";
import { MarketingSubTabType, MarketingConcept, ContentApprovalCard, PublishEvent } from "../types";
import { marketingService, extractDraftContent } from "../services/marketingService";
import { geminiApi } from "../api/gemini";
import { toast } from "./Toast";
import { useAuth } from "../context/AuthContext";

export default function MarketingTab() {
  const { userProfile } = useAuth();
  const isUserRole = userProfile?.role === "user";
  const [subTab, setSubTab] = useState<MarketingSubTabType>("LÊN Ý TƯỞNG AI");

  // AI Media Generation States
  const [aiGenCard, setAiGenCard] = useState<ContentApprovalCard | null>(null);
  const [aiGenType, setAiGenType] = useState<'image' | 'video' | null>(null);
  const [aiGenPrompt, setAiGenPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState<number>(6);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  const [aiGenLoadingText, setAiGenLoadingText] = useState("");
  const [publishingTikTokId, setPublishingTikTokId] = useState<string | null>(null);

  // Lightbox Preview States
  const [activeLightboxCard, setActiveLightboxCard] = useState<ContentApprovalCard | null>(null);
  const [activeLightboxType, setActiveLightboxType] = useState<'image' | 'video' | null>(null);
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");

  // 1. AI Campaign Ideation States
  const [campaignInput, setCampaignInput] = useState("");
  const [analyzedTopic, setAnalyzedTopic] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [developingIdx, setDevelopingIdx] = useState<number | null>(null);

  const [schedulingCard, setSchedulingCard] = useState<ContentApprovalCard | null>(null);
  const [scheduleDate, setScheduleDate] = useState("2026-10-15");
  const [scheduleTime, setScheduleTime] = useState("09:00");

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
      const data = await geminiApi.generateMarketingIdeas(topic, selectedPillars);
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

  // Real-time Auto-post checker for Scheduled Cards (Client-side background trigger)
  useEffect(() => {
    const checkScheduledCards = async () => {
      const now = new Date();
      // Format as YYYY-MM-DD
      const currentDateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
      // Format as HH:MM
      const currentTimeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

      const dueCards = approvalCards.filter(card => {
        if (card.status !== "scheduled" || !card.scheduledDate) return false;
        const scheduledTime = card.scheduledTime || "00:00";
        return (
          card.scheduledDate < currentDateStr ||
          (card.scheduledDate === currentDateStr && scheduledTime <= currentTimeStr)
        );
      });

      for (const card of dueCards) {
        if (autoPublishingRef.current.has(card.id)) continue;
        autoPublishingRef.current.add(card.id);

        console.log(`[iGen Autopost Client] Tự động đăng bài do đến lịch: "${card.title}" (ID: ${card.id})`);
        const fbIntegration = userProfile?.facebookIntegration;
        if (!fbIntegration?.isConnected) {
          console.warn(`[iGen Autopost Client] Bỏ qua "${card.title}": Tài khoản chưa kết nối MXH.`);
          autoPublishingRef.current.delete(card.id);
          continue;
        }

        try {
          await marketingService.publishToFacebook(
            card.id,
            fbIntegration.pageAccessToken,
            fbIntegration.pageId,
            card.bodyText,
            !!fbIntegration.isMock,
            card.imageUrl
          );
          toast.success(`[Tự động] Đã đăng bài "${card.title}" lên Facebook Page thành công!`);
        } catch (e: any) {
          console.error(`[iGen Autopost Client] Lỗi tự động đăng bài "${card.title}":`, e);
          const errMsg = e?.message || e?.details || e?.code || "Lỗi tự động đăng bài.";
          toast.error(`[Tự động thất bại] ${card.title}: ${errMsg}`);
        } finally {
          autoPublishingRef.current.delete(card.id);
        }
      }
    };

    const interval = setInterval(checkScheduledCards, 15000); // Kiểm tra mỗi 15 giây
    return () => clearInterval(interval);
  }, [approvalCards, userProfile?.facebookIntegration]);

  const updateCardStatus = async (id: string, newStatus: "draft" | "pending" | "approved" | "scheduled" | "published") => {
    await marketingService.updateCardStatus(id, newStatus);
  };

  const handleConfirmSchedule = async () => {
    if (!schedulingCard) return;

    if (schedulingCard.channel === "Facebook") {
      const isFbConnected = userProfile?.facebookIntegration?.isConnected;
      if (!isFbConnected) {
        toast.error("Không thể lên lịch: Tài khoản chưa liên kết với Facebook Page. Vui lòng kết nối ở phần Cài đặt.");
        return;
      }
    } else if (schedulingCard.channel === "TikTok") {
      toast.error("Không thể lên lịch: Tính năng đăng bài tự động lên TikTok hiện đang được phát triển và chưa hoạt động.");
      return;
    }

    try {
      await marketingService.scheduleCard(schedulingCard.id, scheduleDate, scheduleTime);
      toast.success(`Đã lên lịch đăng bài "${schedulingCard.title}" thành công!`);
      setSchedulingCard(null);
    } catch (e) {
      console.error("Lỗi khi lên lịch bài đăng:", e);
      toast.error("Lỗi khi lên lịch bài đăng.");
    }
  };

  const deleteCard = async (id: string) => {
    await marketingService.deleteCard(id);
  };

  const [promptMore, setPromptMore] = useState("");
  const handleAIGenerateMore = async () => {
    if (!promptMore.trim()) return;
    const card = newProductiveDraft(promptMore);
    await marketingService.saveCard(card);
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
      generatedAt: new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      authorUid: userProfile?.uid ?? ''
    };
  };

  const handleDevelopConcept = async (concept: MarketingConcept, idx: number) => {
    setDevelopingIdx(idx);
    try {
      const result = await marketingService.developIdea({
        title: concept.title,
        summary: concept.summary,
        suggestedContent: concept.suggestedContent,
        channels: concept.channels
      });

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
            generatedAt: "Vừa xong",
            authorUid: userProfile?.uid ?? ''
          };
        });

        await marketingService.saveCards(newCards);
        setSubTab("DUYỆT NỘI DUNG");
      }
    } catch (e) {
      console.error("Lỗi phát triển ý tưởng đa kênh:", e);
      toast.error("Lỗi kết nối Trợ lý AI khi lập dàn ý chi tiết.");
    } finally {
      setDevelopingIdx(null);
    }
  };

  // AI Media generation and management handlers
  const handleInitAIGeneration = (card: ContentApprovalCard, type?: 'image' | 'video') => {
    setAiGenCard(card);
    // Nếu không truyền type, mặc định theo kênh nhưng user vẫn có thể thay đổi trong modal
    setAiGenType(type ?? (card.channel === 'TikTok' ? 'video' : 'image'));
    const cleanText = extractDraftContent(card.bodyText);
    setAiGenPrompt(cleanText);
  };

  const handleExecuteAIGeneration = async () => {
    if (!aiGenCard || !aiGenType || !aiGenPrompt.trim()) return;

    setIsGeneratingMedia(true);
    setAiGenLoadingText(
      aiGenType === "image"
        ? "AI đang vẽ ảnh minh họa..."
        : "AI đang dựng video, việc này có thể tốn từ 1-2 phút..."
    );

    try {
      let result;
      if (aiGenType === "image") {
        result = await geminiApi.generateImage(aiGenPrompt);
      } else {
        result = await geminiApi.generateVideo(aiGenPrompt, videoDuration);
      }

      const tempUrl = result.url;
      const filename = tempUrl.split("/").pop() || `${aiGenType}_${Date.now()}`;

      // Upload to Firebase Storage
      setAiGenLoadingText("Đang tải phương tiện lên Firebase Storage...");
      const storageUrl = await marketingService.uploadMediaToStorage(tempUrl, filename, aiGenType);

      // Update media only for this card
      setAiGenLoadingText("Đang cập nhật cơ sở dữ liệu...");
      await marketingService.updateCardMedia(storageUrl, aiGenType, [aiGenCard.id]);

      toast.success(`Sinh ${aiGenType === "image" ? "ảnh" : "video"} AI và tải lên Storage thành công!`);
      
      // Clear state
      setAiGenCard(null);
      setAiGenType(null);
    } catch (e: any) {
      console.error("Lỗi sinh phương tiện AI:", e);
      toast.error(e.message || "Lỗi trong quá trình tạo phương tiện AI.");
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const handleOpenLightbox = (card: ContentApprovalCard, type: 'image' | 'video', url: string) => {
    setActiveLightboxCard(card);
    setActiveLightboxType(type);
    setActiveLightboxUrl(url);
    const cleanText = extractDraftContent(card.bodyText);
    setRegeneratePrompt(cleanText);
  };

  const handleRegenerateMedia = async () => {
    if (!activeLightboxCard || !activeLightboxType || !regeneratePrompt.trim()) return;

    setIsRegenerating(true);
    try {
      let result;
      if (activeLightboxType === "image") {
        result = await geminiApi.generateImage(regeneratePrompt);
      } else {
        result = await geminiApi.generateVideo(regeneratePrompt, videoDuration);
      }

      const tempUrl = result.url;
      const filename = tempUrl.split("/").pop() || `${activeLightboxType}_${Date.now()}`;

      const storageUrl = await marketingService.uploadMediaToStorage(tempUrl, filename, activeLightboxType);

      await marketingService.updateCardMedia(storageUrl, activeLightboxType, [activeLightboxCard.id]);

      setActiveLightboxUrl(storageUrl);
      toast.success("Đã tạo lại phương tiện mới thành công!");
    } catch (e: any) {
      console.error("Lỗi tạo lại phương tiện AI:", e);
      toast.error(e.message || "Lỗi khi tạo lại phương tiện.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!activeLightboxCard || !activeLightboxType) return;

    if (!confirm("Bạn có chắc chắn muốn xóa phương tiện này khỏi bài đăng?")) return;

    try {
      await marketingService.updateCardMedia(null, activeLightboxType, [activeLightboxCard.id]);
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
      toast.error(e.message || "Không thể đăng bài lên TikTok. Vui lòng thử lại.");
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
          {["LÊN Ý TƯỞNG AI", "DUYỆT NỘI DUNG", "LỊCH ĐĂNG CONTENT"].map((tab) => (
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
                          if (card.channel === "Facebook") {
                            const isFbConnected = userProfile?.facebookIntegration?.isConnected;
                            if (!isFbConnected) {
                              toast.error(
                                "Không thể lên lịch: Tài khoản chưa liên kết với Facebook Page. Vui lòng kết nối Fanpage trong phần Cài đặt -> Liên kết MXH trước."
                              );
                              return;
                            }
                          } else if (card.channel === "TikTok") {
                            toast.error(
                              "Không thể lên lịch: Kết nối tự động qua TikTok API hiện đang được phát triển và chưa hoạt động."
                            );
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
                    📅 ĐÃ LÊN LỊCH ({approvalCards.filter(c => c.status === "scheduled").length})
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {approvalCards.filter(c => c.status === "scheduled").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Kéo duyệt để lên lịch!</div>
                  ) : (
                    approvalCards.filter(c => c.status === "scheduled").map(card => (
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

                <div className="border-t border-white/15 pt-3">
                  <label className="block text-[9px] font-bold text-purple-400 font-mono uppercase tracking-wider mb-1">
                    Prompt AI đã sử dụng:
                  </label>
                  <textarea 
                    value={regeneratePrompt}
                    onChange={(e) => setRegeneratePrompt(e.target.value)}
                    placeholder="Nhập prompt điều chỉnh để tạo lại..."
                    className="w-full h-24 p-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors leading-relaxed"
                  />
                </div>

                {activeLightboxType === "video" && (
                  <div className="border-t border-white/15 pt-3">
                    <label className="block text-[9px] font-bold text-purple-400 font-mono uppercase tracking-wider mb-1">
                      Thời lượng Video:
                    </label>
                    <div className="flex gap-2">
                      {[4, 6, 8].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setVideoDuration(sec)}
                          className={`flex-1 py-1.5 rounded-lg font-bold border text-[10px] transition-all cursor-pointer ${
                            videoDuration === sec
                              ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {sec} giây
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 italic bg-white/5 p-2 rounded-lg leading-relaxed">
                  Tip: Bạn có thể sửa prompt trên để tạo lại hình ảnh/video mới cho bài viết này.
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-white/15">
                <button 
                  onClick={handleRegenerateMedia}
                  disabled={isRegenerating || !regeneratePrompt.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isRegenerating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang tạo lại...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Tạo lại bằng AI</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={handleDeleteMedia}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 border border-red-900/50 hover:border-red-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa phương tiện</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* AI Prompt fine-tuning popup */}
      {aiGenCard && aiGenType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200/50 shadow-2xl w-full max-w-md overflow-hidden font-sans text-left">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                  <Sparkles className="h-5 w-5 text-purple-600 animate-pulse" />
                  Tạo Media AI
                </h4>
                <p className="text-xs text-gray-400 mt-1">Chọn loại, tinh chỉnh prompt và để AI sáng tạo nội dung</p>
              </div>
              <button 
                onClick={() => {
                  setAiGenCard(null);
                  setAiGenType(null);
                }}
                className="p-1 px-3 text-sm text-slate-400 hover:text-slate-655 hover:bg-slate-100 rounded-md font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Media type selector */}
              <div>
                <label className="block text-gray-500 font-bold mb-2 uppercase tracking-wide text-[10px]">Loại Media *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiGenType('image')}
                    className={`flex flex-col items-center gap-2 py-3 px-4 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                      aiGenType === 'image'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <span className="text-lg">🖼️</span>
                    <span className="text-[11px]">Ảnh Minh Họa</span>
                    <span className={`text-[9px] font-normal ${aiGenType === 'image' ? 'text-purple-200' : 'text-gray-400'}`}>gemini-flash-image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiGenType('video')}
                    className={`flex flex-col items-center gap-2 py-3 px-4 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                      aiGenType === 'video'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <span className="text-lg">🎬</span>
                    <span className="text-[11px]">Video Ngắn</span>
                    <span className={`text-[9px] font-normal ${aiGenType === 'video' ? 'text-purple-200' : 'text-gray-400'}`}>veo-3 · 4–8 giây</span>
                  </button>
                </div>
              </div>

              {/* Model info badge */}
              <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-purple-950 leading-relaxed">
                <span className="font-bold">Mô hình AI:</span> {aiGenType === "image" ? "Nano-Banana (gemini-3.1-flash-image)" : "Veo3 (veo-3.1-generate-preview)"}
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Nhập Prompt Điều Khiển AI *</label>
                <textarea 
                  value={aiGenPrompt}
                  onChange={(e) => setAiGenPrompt(e.target.value)}
                  placeholder="Mô tả chi tiết những gì bạn muốn xuất hiện..."
                  className="w-full h-28 p-3 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none leading-relaxed"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Mẹo: Prompt mô tả chi tiết, trực quan sẽ giúp mô hình tạo ra kết quả đẹp mắt hơn.
                </span>
              </div>

              {aiGenType === "video" && (
                <div>
                  <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Thời lượng Video *</label>
                  <div className="flex gap-2">
                    {[4, 6, 8].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setVideoDuration(sec)}
                        className={`flex-1 py-2 rounded-lg font-bold border text-xs transition-all cursor-pointer ${
                          videoDuration === sec
                            ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => {
                    setAiGenCard(null);
                    setAiGenType(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-all cursor-pointer text-xs"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button" 
                  onClick={handleExecuteAIGeneration}
                  disabled={!aiGenPrompt.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-sm flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Bắt đầu {aiGenType === 'image' ? 'Vẽ Ảnh' : 'Dựng Video'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isGeneratingMedia && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-xs text-center border border-gray-100">
            <RefreshCw className="h-8 w-8 text-purple-600 animate-spin mb-4" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Đang xử lý với AI</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{aiGenLoadingText}</p>
            {aiGenType === "video" && (
              <span className="text-[9px] text-purple-500 font-mono mt-3 animate-pulse uppercase font-semibold">
                Quá trình này tốn từ 1 - 2 phút để render
              </span>
            )}
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

              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Ngày đăng bài *</label>
                <input 
                  type="date" 
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Giờ đăng bài *</label>
                <input 
                  type="time" 
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setSchedulingCard(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-all cursor-pointer text-xs"
                >
                  Bỏ qua
                </button>
                <button 
                  type="button" 
                  onClick={handleConfirmSchedule}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs shadow-sm"
                >
                  Xác nhận lên lịch
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
        <span className="text-gray-400 font-mono text-[8px]">{card.generatedAt}</span>
        
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
        <span className="text-gray-400 font-mono text-[8px]">{card.generatedAt}</span>
        <div className="flex items-center gap-1">
          <button onClick={onPrevStatus} title="Quay lại: Đã duyệt"
            className="p-1 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md font-bold transition-all flex items-center justify-center cursor-pointer">
            <ArrowLeft className="h-3 w-3" />
          </button>
          <button onClick={onDelete} title="Xóa bài đăng"
            className="p-1 text-red-500 hover:bg-red-50 rounded-md font-bold transition-all flex items-center justify-center cursor-pointer">
            <Trash2 className="h-3 w-3" />
          </button>
          <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm text-[8px] font-bold font-mono">
            ✓ LỊCH
          </span>
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
