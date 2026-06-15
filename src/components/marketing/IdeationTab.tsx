import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Zap, 
  Facebook, 
  Instagram, 
  Linkedin, 
  Video, 
  Image as ImageIcon
} from "lucide-react";
import { MarketingConcept, ContentApprovalCard } from "../../types";
import { marketingService } from "../../services/marketingService";
import { socialIntegrationService } from "../../services/socialIntegrationService";
import { geminiApi } from "../../api/gemini";
import { toast } from "../../pages/Toast";

interface IdeationTabProps {
  userProfile: any;
  setApprovalCards: React.Dispatch<React.SetStateAction<ContentApprovalCard[]>>;
  setSubTab: (tab: any) => void;
}

export default function IdeationTab({ userProfile, setApprovalCards, setSubTab }: IdeationTabProps) {
  const hasFetchedRef = useRef(false);

  // 1. AI Campaign Ideation States
  const [campaignInput, setCampaignInput] = useState("");
  const [analyzedTopic, setAnalyzedTopic] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [developingIdx, setDevelopingIdx] = useState<number | null>(null);

  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [autoPilotStatus, setAutoPilotStatus] = useState<string>("");

  // Auto-pilot scheduling & integrations configuration
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [autoScheduleDate, setAutoScheduleDate] = useState(tomorrowStr);
  const [autoScheduleTime, setAutoScheduleTime] = useState("09:00");
  const [integrationsList, setIntegrationsList] = useState<any[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, string>>({});

  const [selectedChannels, setSelectedChannels] = useState<string[]>(["Facebook"]);
  const [mediaType, setMediaType] = useState<string>("image"); // "none" | "image" | "video"
  
  // Image Options
  const [imageModel, setImageModel] = useState("nano-banana-pro");
  const [imageResolution, setImageResolution] = useState("1K");
  const [imageAspectRatio, setImageAspectRatio] = useState("1:1");

  // Video Options
  const [videoModel, setVideoModel] = useState("piapi-veo31-video-fast-audio");
  const [videoQuality, setVideoQuality] = useState("720p");
  const [videoDuration, setVideoDuration] = useState("4");
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9");

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

  // Load suggestions from AI on mount
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const loadSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const suggestions = await marketingService.fetchSuggestions();
        setQuickSuggestions(suggestions);
      } catch (err: any) {
        console.error("Lỗi tải gợi ý chiến dịch:", err);
        toast.error(err.message || "Không thể tải gợi ý chiến dịch marketing từ AI.");
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadSuggestions();
  }, []);

    // Load connected integrations on mount
    useEffect(() => {
      const loadAllIntegrations = async () => {
        setLoadingIntegrations(true);
        try {
          const list = await socialIntegrationService.getIntegrations();
          setIntegrationsList(list.filter(item => item.isConnected));
        } catch (err) {
          console.error("Lỗi khi tải liên kết mạng xã hội:", err);
        } finally {
          setLoadingIntegrations(false);
        }
      };
      loadAllIntegrations();
    }, []);

    // Set default selected integrations when integrationsList is loaded
    useEffect(() => {
      const initialMapping: Record<string, string> = {};
      const platforms = ["Facebook", "TikTok", "Zalo"];
      platforms.forEach(p => {
        const match = integrationsList.find(item => item.platform === p);
        if (match) {
          initialMapping[p] = match._id || "";
        }
      });
      setSelectedIntegrations(prev => ({ ...initialMapping, ...prev }));
    }, [integrationsList]);

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
    } catch (err: any) {
      console.error("Lỗi phân tích Content Pillars:", err);
      toast.error(err.message || "Lỗi phân tích Content Pillars.");
    } finally {
      setLoadingPillars(false);
    }
  };

  const togglePillar = (id: string) => {
    if (selectedPillars.includes(id)) {
      if (selectedPillars.length === 1) {
        toast.warning("Cần chọn nhất 1 trụ cột nội dung để trợ lý AI định hướng.");
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
      let pillarsToUse = selectedPillars;
      if (isAutoPilot) {
        setAutoPilotStatus("Đang phân tích định hướng Content Pillars...");
        try {
          const pillarsData = await geminiApi.analyzeMarketingPillars(topic);
          if (pillarsData.pillars && Array.isArray(pillarsData.pillars) && pillarsData.pillars.length > 0) {
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
            const mappedPillars = pillarsData.pillars.map((p: any, idx: number) => ({
              id: p.id,
              title: p.title,
              ratio: p.ratio || "33% tỉ trọng",
              description: p.description,
              ...styles[idx % styles.length]
            }));
            setPillars(mappedPillars);
            const activePillars = mappedPillars.map((p: any) => p.id);
            setSelectedPillars(activePillars);
            setAnalyzedTopic(topic);
            pillarsToUse = activePillars;
          }
        } catch (pillarErr: any) {
          console.error("Lỗi phân tích pillars tự động:", pillarErr);
          toast.warning("Lỗi phân tích Content Pillars tự động, đang thử lên ý tưởng trực tiếp...");
        }
      }

      setAutoPilotStatus("Đang lên ý tưởng chiến dịch...");
      const actualMediaType = isAutoPilot ? mediaType : "none";
      const data = await geminiApi.generateMarketingIdeas(topic, pillarsToUse, selectedChannels, actualMediaType);
      
      const generatedConcepts = data.concepts || [];
      if (generatedConcepts.length === 0) {
        throw new Error("AI không thể tạo ý tưởng chiến dịch phù hợp.");
      }
      
      setConcepts(generatedConcepts);

      if (isAutoPilot) {
        // Run auto-pilot flow
        const sortedConcepts = [...generatedConcepts].sort((a: any, b: any) => (b.matchPercent || 0) - (a.matchPercent || 0));
        const bestConcept = sortedConcepts[0];
        
        setAutoPilotStatus(`Đang tự động viết nội dung chi tiết cho ý tưởng: "${bestConcept.title}"...`);
        const result = await marketingService.developIdea({
          title: bestConcept.title,
          summary: bestConcept.summary,
          suggestedContent: bestConcept.suggestedContent,
          channels: bestConcept.channels,
          mediaType: actualMediaType,
          imageModel,
          imageResolution,
          imageAspectRatio,
          videoModel,
          videoQuality,
          videoDuration: parseInt(videoDuration),
          videoAspectRatio
        });

        if (!result || !result.posts || result.posts.length === 0) {
          throw new Error("AI không thể phát triển chi tiết bài viết.");
        }

        setAutoPilotStatus("Đang lưu bài viết và chuẩn bị lên lịch đăng...");
        const newCards: ContentApprovalCard[] = result.posts.map((post: any, index: number) => {
          return {
            id: `mod_dev_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            title: bestConcept.title,
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

        const savedCards = await marketingService.saveCards(newCards);

        // Check if there are any cards with pending video tasks
        const pendingCards = savedCards.filter(c => c.videoUrl && c.videoUrl.startsWith("pending://piapi/"));
        if (pendingCards.length > 0) {
          setAutoPilotStatus("Đang kết xuất video AI hoàn chỉnh (Mất khoảng 1-3 phút)...");
          
          let attempts = 0;
          const maxAttempts = 24; // 4 minutes timeout (24 * 10 seconds)
          const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
          
          let resolvedCards = [...savedCards];
          
          while (attempts < maxAttempts) {
            const stillPending = resolvedCards.filter(c => c.videoUrl && c.videoUrl.startsWith("pending://piapi/"));
            if (stillPending.length === 0) {
              console.log("[Auto-pilot] All video tasks completed successfully!");
              break;
            }
            
            setAutoPilotStatus(`Đang kết xuất video AI hoàn chỉnh (Thời gian chờ còn lại: ${Math.max(0, 240 - attempts * 10)}s)...`);
            await delay(10000);
            
            try {
              const updatedList = await Promise.all(
                resolvedCards.map(async (card) => {
                  if (card.videoUrl && card.videoUrl.startsWith("pending://piapi/")) {
                    try {
                      const freshCard = await marketingService.getCardById(card.id);
                      return freshCard;
                    } catch (e) {
                      console.error("[Auto-pilot polling] error fetching card status:", e);
                      return card;
                    }
                  }
                  return card;
                })
              );
              resolvedCards = updatedList;
            } catch (err) {
              console.error("[Auto-pilot polling] error polling loop:", err);
            }
            attempts++;
          }
          
          // Use the updated cards (with resolved video URLs) for the rest of the flow
          savedCards.forEach((card, idx) => {
            const rc = resolvedCards.find(item => item.id === card.id);
            if (rc) {
              savedCards[idx] = rc;
            }
          });
        }
        
        setAutoPilotStatus("Đang tự động thiết lập thời gian và kết nối mạng xã hội...");
        
        // Schedule each card using selected integrations and scheduled date/time
        const scheduledCards = await Promise.all(
          savedCards.map(async (card, idx) => {
            try {
              const platform = card.channel;
              const integrationId = selectedIntegrations[platform] || undefined;

              const scheduledDate = autoScheduleDate;
              let scheduledTime = autoScheduleTime;
              try {
                const [hStr, mStr] = autoScheduleTime.split(":");
                const startHour = parseInt(hStr);
                const hour = (startHour + idx) % 24;
                scheduledTime = `${hour.toString().padStart(2, '0')}:${mStr}`;
              } catch (e) {
                console.warn("Lỗi tính toán giờ đăng tự động:", e);
              }

              if (platform === "Facebook" || platform === "TikTok") {
                await marketingService.scheduleCard(card.id, scheduledDate, scheduledTime, integrationId);
              } else {
                await marketingService.updateCard(card.id, {
                  status: 'scheduled',
                  scheduledDate,
                  scheduledTime,
                  integrationId
                });
              }
              
              return {
                ...card,
                status: "scheduled" as const,
                scheduledDate,
                scheduledTime,
                integrationId
              };
            } catch (schErr) {
              console.error(`Tự động lên lịch cho card ${card.id} thất bại:`, schErr);
              const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
              const scheduledDate = tomorrow.toISOString().slice(0, 10);
              const scheduledTime = "09:00";
              
              await marketingService.updateCard(card.id, {
                status: 'scheduled',
                scheduledDate,
                scheduledTime
              });
              
              return {
                ...card,
                status: "scheduled" as const,
                scheduledDate,
                scheduledTime
              };
            }
          })
        );

        setApprovalCards(prev => [...prev, ...scheduledCards]);
        toast.success("Đã kích hoạt chế độ Tự động hoàn toàn (Auto-pilot) thành công!");
        setSubTab("LỊCH ĐĂNG CONTENT"); // Switch to Calendar tab directly
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Tự động hóa thất bại. Vui lòng kiểm tra lại cấu hình hoặc số dư ví.");
    } finally {
      setLoadingAI(false);
      setAutoPilotStatus("");
    }
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
        mediaType: isAutoPilot ? mediaType : "none",
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
    } catch (e: any) {
      console.error("Lỗi phát triển ý tưởng đa kênh:", e);
      toast.error(e.message || "Lỗi kết nối Trợ lý AI khi lập dàn ý chi tiết.");
    } finally {
      console.log("[handleDevelopConcept] Resetting developing index.");
      setDevelopingIdx(null);
    }
  };

  return (
    <div className="space-y-6" id="ai_marketing_ideas_tab">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="ideation_grid">
        
        {/* Creator Form */}
        <div className="lg:col-span-2 bg-slate-50 border border-gray-200 p-6 rounded-2xl flex flex-col justify-between relative" id="ideation_campaign_form">
          {loadingAI && isAutoPilot && (
            <div className="absolute inset-0 bg-white/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-20 rounded-2xl animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-4 border border-purple-100 animate-bounce">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-extrabold text-purple-800 text-sm tracking-wide uppercase font-mono">
                🤖 Chế độ Auto-pilot đang vận hành...
              </h4>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full animate-pulse" style={{ width: '65%' }}></div>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-3.5 leading-relaxed font-sans max-w-sm">
                {autoPilotStatus}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono italic">
                Hệ thống đang tự động kết nối API Gemini & n8n Scheduler
              </p>
            </div>
          )}
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
                            if (!isAutoPilot) {
                              handleAnalyzePillars(s);
                            } else {
                              setAnalyzedTopic(s);
                            }
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

              {/* Auto-pilot completely automated flow */}
              <div className="flex flex-col gap-3 mt-5 select-none bg-purple-50/40 p-4 border border-purple-150 rounded-2xl">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoPilot}
                    onChange={(e) => setIsAutoPilot(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-650 peer-checked:bg-purple-600 font-sans"></div>
                  <span className="ml-2.5 text-xs font-bold text-gray-750 uppercase tracking-wider font-mono text-purple-700 flex items-center gap-1">
                    🤖 Chế độ Tự động hoàn toàn (Auto-pilot: Ý tưởng → Viết bài → Đặt lịch đăng)
                  </span>
                </label>

                {isAutoPilot && (
                  <div className="mt-2.5 border-t border-purple-200/50 pt-3.5 space-y-3.5 text-left animate-fadeIn">
                    <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block font-mono">
                      📅 Thiết lập đặt lịch & Tài khoản đăng bài:
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Scheduled Date */}
                      <div className="space-y-1.5">
                        <label className="block text-gray-500 font-bold text-[10px] uppercase font-mono">Ngày đăng bài *</label>
                        <input 
                          type="date" 
                          required
                          className="w-full p-2.5 border border-slate-200 bg-white rounded-lg text-xs font-mono focus:ring-1 focus:ring-purple-500 outline-none"
                          value={autoScheduleDate}
                          onChange={(e) => setAutoScheduleDate(e.target.value)}
                        />
                      </div>

                      {/* Scheduled Time */}
                      <div className="space-y-1.5">
                        <label className="block text-gray-500 font-bold text-[10px] uppercase font-mono">Giờ đăng bài *</label>
                        <input 
                          type="time" 
                          required
                          className="w-full p-2.5 border border-slate-200 bg-white rounded-lg text-xs font-mono focus:ring-1 focus:ring-purple-500 outline-none"
                          value={autoScheduleTime}
                          onChange={(e) => setAutoScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Integrations Selectors */}
                    <div className="space-y-3">
                      {selectedChannels.map(channel => {
                        if (channel !== "Facebook" && channel !== "TikTok") return null;
                        const platform = channel;
                        const available = integrationsList.filter(item => item.platform === platform);
                        const selectedVal = selectedIntegrations[platform] || "";

                        return (
                          <div key={platform} className="space-y-1.5">
                            <label className="block text-gray-655 font-bold text-[10px] uppercase font-mono">
                              Chọn tài khoản {platform} đăng bài *
                            </label>
                            {loadingIntegrations ? (
                              <div className="p-2 border border-slate-200 rounded-lg text-xs text-gray-400 bg-white">
                                Đang tải danh sách tài khoản...
                              </div>
                            ) : available.length > 0 ? (
                              <select
                                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-xs focus:ring-1 focus:ring-purple-500 outline-none font-medium text-gray-750"
                                value={selectedVal}
                                onChange={(e) => setSelectedIntegrations(prev => ({ ...prev, [platform]: e.target.value }))}
                              >
                                {available.map(item => (
                                  <option key={item._id} value={item._id}>
                                    {item.displayName} ({item.username || "no-username"})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="p-2.5 border border-amber-250 bg-amber-50 text-amber-800 rounded-lg text-[10px] leading-normal font-sans">
                                ⚠️ Chưa có tài khoản {platform} nào được liên kết. Vui lòng vào Cài đặt &rarr; Liên kết mạng xã hội để kết nối trước khi đặt lịch.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Media Type Selection */}
              {isAutoPilot && (
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
              {isAutoPilot && mediaType === "image" && (
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
                        <option value="nano-banana-pro">iGen Image Pro</option>
                        <option value="nano-banana-2">iGen Image Flash</option>
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
              {isAutoPilot && mediaType === "video" && (
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
                        <option value="piapi-veo31-video-fast-audio">iGen video 3.1 Fast</option>
                        <option value="piapi-veo31-video-audio">iGen video 3.1</option>
                        <option value="piapi-veo31-video-fast-no-audio">iGen video 3.1 Fast Silent</option>
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
              disabled={loadingAI || !campaignInput.trim() || (!isAutoPilot && campaignInput.trim() !== analyzedTopic.trim())}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans flex items-center gap-2 select-none shadow-sm transition-all ${
                loadingAI || !campaignInput.trim() || (!isAutoPilot && campaignInput.trim() !== analyzedTopic.trim())
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
                <div className="flex items-center gap-1.5 text-indigo-600 font-bold mb-1.5">
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
  );
}
