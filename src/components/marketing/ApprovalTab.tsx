import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { ContentApprovalCard } from "../../types";
import { marketingService } from "../../services/marketingService";
import { toast } from "../../pages/Toast";
import { ModerationPipCard, ScheduledCard, PublishedCard } from "./CardWidgets";
import CardDetailDrawer from "./CardDetailDrawer";

interface ApprovalTabProps {
  userProfile: any;
  isUserRole: boolean;
  approvalCards: ContentApprovalCard[];
  setApprovalCards: React.Dispatch<React.SetStateAction<ContentApprovalCard[]>>;
  updateCardStatus: (id: string, newStatus: "draft" | "pending" | "approved" | "scheduled" | "published") => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  handleInitAIGeneration: (card: ContentApprovalCard, type?: "image" | "video") => void;
  handleOpenLightbox: (card: ContentApprovalCard, type: "image" | "video", url: string) => void;
  handlePublishToTikTok: (card: ContentApprovalCard) => Promise<void>;
  publishingTikTokId: string | null;
  setSchedulingCard: (card: ContentApprovalCard | null) => void;
  setScheduleDate: (date: string) => void;
  setScheduleTime: (time: string) => void;
  onPublishToPlatform?: (card: ContentApprovalCard) => Promise<void>;
  isPublishing?: boolean;
}

export default function ApprovalTab({
  userProfile,
  isUserRole,
  approvalCards,
  setApprovalCards,
  updateCardStatus,
  deleteCard,
  handleInitAIGeneration,
  handleOpenLightbox,
  handlePublishToTikTok,
  publishingTikTokId,
  setSchedulingCard,
  setScheduleDate,
  setScheduleTime,
  onPublishToPlatform,
  isPublishing = false,
}: ApprovalTabProps) {
  const [promptMore, setPromptMore] = useState("");
  const [selectedDetailCard, setSelectedDetailCard] = useState<ContentApprovalCard | null>(null);

  const activeDrawerCard = selectedDetailCard
    ? approvalCards.find((c) => c.id === selectedDetailCard.id) || null
    : null;

  const newProductiveDraft = (topic: string): ContentApprovalCard => {
    return {
      id: "mod_" + Date.now(),
      title: `Campaign: ${topic.slice(0, 30)}...`,
      channel: "Facebook",
      contentType: "Bài viết AI Copywriter soạn thảo",
      status: "draft",
      bodyText: `Chao don su but pha cua du an moi! Voi chu de "${topic}", hay trien khai mot chien dich truyen thong hap dan, giau cam xuc de tiep can dung khach hang muc tieu va lam noi bat gia tri giai phap iGen. Dang ky ngay hom nay de nhan tu van chi tiet!`,
      generatedAt: new Date().toISOString(),
      authorUid: userProfile?.uid ?? "",
    };
  };

  const handleAIGenerateMore = async () => {
    const topic = promptMore.trim();
    if (!topic) return;

    try {
      const card = newProductiveDraft(topic);
      const savedCard = await marketingService.saveCard(card);
      setApprovalCards((prev) => [savedCard, ...prev]);
      setPromptMore("");
      toast.success("Da tao bai dang nhap moi tu AI!");
    } catch (e) {
      console.error(e);
      toast.error("Khong the tao bai dang nhap tu AI.");
    }
  };

  const handleDeleteCard = async (id: string) => {
    await deleteCard(id);
    if (selectedDetailCard?.id === id) {
      setSelectedDetailCard(null);
    }
  };

  const handleUpdateCardLocal = (id: string, updatedFields: Partial<ContentApprovalCard>) => {
    setApprovalCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updatedFields } : c)));
  };

  const pendingCards = approvalCards.filter((c) => c.status === "pending");
  const approvedCards = approvalCards.filter((c) => c.status === "approved");
  const scheduledCards = approvalCards.filter((c) => c.status === "scheduled" || c.status === "failed");
  const publishedCards = approvalCards.filter((c) => c.status === "published");

  return (
    <div className="space-y-6" id="moderation_pipeline_tab">
      {isUserRole && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold select-none text-left">
          <span>Bạn đang sử dụng tài khoản quyền USER. Bạn có thể tạo bài viết mới, gửi duyệt nhập, lên lịch đăng tải và xóa bài viết của mình, nhưng không có quyền phê duyệt bài viết đang chờ duyệt.</span>
        </div>
      )}



      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin" id="moderation_columns">
        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px] flex-1 min-w-[280px] md:min-w-[320px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
            <span className="text-[11px] font-bold text-amber-800 tracking-wider flex items-center gap-1">
              CHỜ DUYỆT ({pendingCards.length})
            </span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {pendingCards.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Hết bài duyệt cho!</div>
            ) : (
              pendingCards.map((card) => (
                <ModerationPipCard
                  key={card.id}
                  card={card}
                  onNextStatus={isUserRole ? null : () => updateCardStatus(card.id, "approved")}
                  onPrevStatus={() => updateCardStatus(card.id, "draft")}
                  onDelete={() => handleDeleteCard(card.id)}
                  onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                  onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                  onOpenDetail={() => setSelectedDetailCard(card)}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px] flex-1 min-w-[280px] md:min-w-[320px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
            <span className="text-[11px] font-bold text-blue-800 tracking-wider flex items-center gap-1">
              ĐÃ DUYỆT ({approvedCards.length})
            </span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {approvedCards.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Chua co bai da duyet</div>
            ) : (
              approvedCards.map((card) => (
                <ModerationPipCard
                  key={card.id}
                  card={card}
                  onNextStatus={() => {
                    if (card.channel !== "Facebook" && card.channel !== "TikTok") {
                      toast.error(`Kenh "${card.channel}" chua ho tro tu dong len lich.`);
                      return;
                    }
                    setSchedulingCard(card);
                    setScheduleDate(new Date().toISOString().split("T")[0]);
                    setScheduleTime("09:00");
                  }}
                  onPrevStatus={isUserRole ? null : () => updateCardStatus(card.id, "pending")}
                  onDelete={() => handleDeleteCard(card.id)}
                  onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                  onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                  onOpenDetail={() => setSelectedDetailCard(card)}
                  onPublishToPlatform={onPublishToPlatform}
                  isPublishing={isPublishing}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex flex-col min-h-[450px] flex-1 min-w-[280px] md:min-w-[320px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
            <span className="text-[11px] font-bold text-emerald-800 tracking-wider flex items-center gap-1">
              ĐÃ LÊN LỊCH ({scheduledCards.length})
            </span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {scheduledCards.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Kéo bài viết để lên lịch!</div>
            ) : (
              scheduledCards.map((card) => (
                <ScheduledCard
                  key={card.id}
                  card={card}
                  isUserRole={isUserRole}
                  onPrevStatus={() => updateCardStatus(card.id, "approved")}
                  onDelete={() => handleDeleteCard(card.id)}
                  fbIntegration={userProfile?.facebookIntegration}
                  tiktokIntegration={userProfile?.tiktokIntegration}
                  onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                  onGenerateMedia={(c, type) => handleInitAIGeneration(c, type)}
                  onPublishToTikTok={() => handlePublishToTikTok(card)}
                  isPublishingTikTok={publishingTikTokId === card.id}
                  onPublishToFacebook={() => onPublishToPlatform && onPublishToPlatform(card)}
                  isPublishingFacebook={isPublishing}
                  onOpenDetail={() => setSelectedDetailCard(card)}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-green-50/70 border border-green-200 rounded-2xl p-3 flex flex-col min-h-[450px] flex-1 min-w-[280px] md:min-w-[320px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-green-200">
            <span className="text-[11px] font-bold text-green-800 tracking-wider flex items-center gap-1">
              ĐÃ ĐĂNG TẢI ({publishedCards.length})
            </span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {publishedCards.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Chưa có bài nào được đăng tải!</div>
            ) : (
              publishedCards.map((card) => (
                <PublishedCard
                  key={card.id}
                  card={card}
                  onDelete={() => handleDeleteCard(card.id)}
                  isUserRole={isUserRole}
                  onPreviewMedia={(type, url) => handleOpenLightbox(card, type, url)}
                  onOpenDetail={() => setSelectedDetailCard(card)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <CardDetailDrawer
        card={activeDrawerCard}
        isOpen={!!activeDrawerCard}
        onClose={() => setSelectedDetailCard(null)}
        isUserRole={isUserRole}
        onNextStatus={updateCardStatus as any}
        onPrevStatus={updateCardStatus as any}
        onDelete={handleDeleteCard}
        onPreviewMedia={(type, url) => handleOpenLightbox(activeDrawerCard!, type, url)}
        onGenerateMedia={handleInitAIGeneration}
        fbIntegration={userProfile?.facebookIntegration}
        tiktokIntegration={userProfile?.tiktokIntegration}
        onPublishToTikTok={handlePublishToTikTok}
        isPublishingTikTok={publishingTikTokId === activeDrawerCard?.id}
        setSchedulingCard={setSchedulingCard}
        setScheduleDate={setScheduleDate}
        setScheduleTime={setScheduleTime}
        onUpdateCard={handleUpdateCardLocal}
      />
    </div>
  );
}
