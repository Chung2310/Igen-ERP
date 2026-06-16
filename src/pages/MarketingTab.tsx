import React, { useState, useEffect, lazy, Suspense } from "react";
import { 
  Zap, 
  Trash2, 
  Calendar, 
  RefreshCw 
} from "lucide-react";
import { MarketingSubTabType, ContentApprovalCard } from "../types";
import { marketingService, extractDraftContent } from "../services/marketingService";
import { toast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { socialIntegrationService, SocialIntegration } from "../services/socialIntegrationService";
import { useSubTabRouter } from "../hooks/useSubTabRouter";

// Lazy-loaded subcomponents
const IdeationTab = lazy(() => import("../components/marketing/IdeationTab"));
const ApprovalTab = lazy(() => import("../components/marketing/ApprovalTab"));
const CalendarTab = lazy(() => import("../components/marketing/CalendarTab"));
const ContentStudioWorkspace = lazy(() =>
  import("../components/content-studio/ContentStudioWorkspace").then((module) => ({
    default: module.ContentStudioWorkspace,
  }))
);

export default function MarketingTab() {
  const { userProfile } = useAuth();
  const isUserRole = userProfile?.role === "user" || userProfile?.role === "manager";
  const MARKETING_SUB_TAB_ROUTES = [
    { slug: "y-tuong", value: "LÊN Ý TƯỞNG AI" as MarketingSubTabType },
    { slug: "duyet-noi-dung", value: "DUYỆT NỘI DUNG" as MarketingSubTabType },
    { slug: "lich-dang", value: "LỊCH ĐĂNG CONTENT" as MarketingSubTabType },
    { slug: "xuong-noi-dung", value: "XƯỞNG NỘI DUNG" as MarketingSubTabType },
  ] as const;
  const [subTab, setSubTab] = useSubTabRouter<MarketingSubTabType>(MARKETING_SUB_TAB_ROUTES as any, "LÊN Ý TƯỞNG AI");

  // AI Media Generation States
  const [publishingTikTokId, setPublishingTikTokId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
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

  // Scheduler States
  const [schedulingCard, setSchedulingCard] = useState<ContentApprovalCard | null>(null);
  const [scheduleDate, setScheduleDate] = useState("2026-10-15");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [isScheduling, setIsScheduling] = useState(false);
  const [availableIntegrations, setAvailableIntegrations] = useState<SocialIntegration[]>([]);
  const [scheduleIntegrationId, setScheduleIntegrationId] = useState("");
  const [loadingIntegrationsForSchedule, setLoadingIntegrationsForSchedule] = useState(false);

  // Shared Approval Cards State
  const [approvalCards, setApprovalCards] = useState<ContentApprovalCard[]>([]);

  // Real-time Firestore Live Synchronization
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
    try {
      await marketingService.updateCardStatus(id, newStatus);
      setApprovalCards(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      toast.success(`Đã cập nhật trạng thái bài viết.`);
    } catch (e) {
      toast.error("Không thể cập nhật trạng thái.");
    }
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
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;
    try {
      await marketingService.deleteCard(id);
      setApprovalCards(prev => prev.filter(c => c.id !== id));
      toast.success("Đã xóa bài viết.");
    } catch (e) {
      toast.error("Xóa bài viết thất bại.");
    }
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
        tiktok.isMock ?? false,
        tiktok.privacyLevel ?? 'SELF_ONLY'
      );
      toast.success(`Đã đăng video lên TikTok thành công! ${(tiktok.isMock ?? false) ? '(Demo)' : ''} ID: ${postId.slice(-8)}`);
    } catch (e: any) {
      console.error("Lỗi đăng TikTok:", e);
      toast.error(parseFirebaseError(e, "Không thể đăng bài lên TikTok. Vui lòng thử lại."));
    } finally {
      setPublishingTikTokId(null);
    }
  }

  const handlePublishCard = async (card: ContentApprovalCard) => {
    if (card.channel === 'TikTok') {
      await handlePublishToTikTok(card);
      return;
    }

    if (card.channel === 'Facebook') {
      const fb = userProfile?.facebookIntegration;
      if (!fb?.isConnected) {
        toast.error("Chưa kết nối Facebook Page. Vui lòng vào Cài đặt → Liên kết MXH để kết nối.");
        return;
      }
      if (!fb.pageId || !fb.pageAccessToken) {
        toast.error("Thông tin kết nối Facebook Page không đầy đủ.");
        return;
      }
      setIsPublishing(true);
      try {
        const postId = await marketingService.publishToFacebook(
          card.id,
          fb.pageAccessToken,
          fb.pageId,
          card.bodyText,
          fb.isMock ?? false,
          card.imageUrl || undefined,
          card.videoUrl || undefined
        );
        toast.success(`Đã đăng bài lên Facebook thành công! ${fb.isMock ? '(Demo)' : ''} ID: ${postId.slice(-8)}`);
      } catch (e: any) {
        console.error("Lỗi đăng Facebook:", e);
        toast.error("Không thể đăng bài lên Facebook. Vui lòng thử lại.");
      } finally {
        setIsPublishing(false);
      }
      return;
    }

    toast.error(`Kênh "${card.channel}" chưa hỗ trợ đăng tải trực tiếp.`);
  };;

  const handleInitAIGeneration = (card: ContentApprovalCard, type?: 'image' | 'video') => {
    const selectedType = type ?? (card.channel === 'TikTok' ? 'video' : 'image');
    
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

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="marketing_tab_wrapper">
      <h1 className="sr-only">Chiến dịch Marketing - {subTab}</h1>
      
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

      </div>

      <div className="flex-1 p-6 overflow-y-auto" id="marketing_tab_content">
        <Suspense fallback={<TabLoader label="Đang tải dữ liệu marketing..." />}>
          {/* SUB TAB 1: LÊN Ý TƯỞNG AI */}
          <div style={{ display: subTab === "LÊN Ý TƯỞNG AI" ? "block" : "none" }}>
            <IdeationTab 
              userProfile={userProfile}
              setApprovalCards={setApprovalCards}
              setSubTab={setSubTab}
            />
          </div>

          {/* SUB TAB 2: DUYỆT NỘI DUNG */}
          {subTab === "DUYỆT NỘI DUNG" && (
            <ApprovalTab 
              userProfile={userProfile}
              isUserRole={isUserRole}
              approvalCards={approvalCards}
              setApprovalCards={setApprovalCards}
              updateCardStatus={updateCardStatus}
              deleteCard={deleteCard}
              handleInitAIGeneration={handleInitAIGeneration}
              handleOpenLightbox={handleOpenLightbox}
              handlePublishToTikTok={handlePublishToTikTok}
              publishingTikTokId={publishingTikTokId}
              setSchedulingCard={setSchedulingCard}
              setScheduleDate={setScheduleDate}
              setScheduleTime={setScheduleTime}
              onPublishToPlatform={handlePublishCard}
              isPublishing={isPublishing}
            />
          )}

          {/* SUB TAB 3: LỊCH ĐĂNG CONTENT */}
          {subTab === "LỊCH ĐĂNG CONTENT" && (
            <CalendarTab 
              isUserRole={isUserRole}
              approvalCards={approvalCards}
            />
          )}

          {/* SUB TAB 4: XƯỞNG NỘI DUNG */}
          {subTab === "XƯỞNG NỘI DUNG" && (
            <ContentStudioWorkspace 
              initialParams={contentStudioParams}
              onClearParams={() => setContentStudioParams(null)}
              onMediaSaved={handleMediaSaved}
            />
          )}
        </Suspense>
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

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-150 p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}
