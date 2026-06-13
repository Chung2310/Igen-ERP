import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { ContentApprovalCard } from "../../types";
import { marketingService } from "../../services/marketingService";
import { toast } from "../../pages/Toast";
import { ModerationPipCard, ScheduledCard, PublishedCard } from "./CardWidgets";

interface ApprovalTabProps {
  userProfile: any;
  isUserRole: boolean;
  approvalCards: ContentApprovalCard[];
  setApprovalCards: React.Dispatch<React.SetStateAction<ContentApprovalCard[]>>;
  updateCardStatus: (id: string, newStatus: "draft" | "pending" | "approved" | "scheduled" | "published") => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  handleInitAIGeneration: (card: ContentApprovalCard, type?: 'image' | 'video') => void;
  handleOpenLightbox: (card: ContentApprovalCard, type: 'image' | 'video', url: string) => void;
  handlePublishToTikTok: (card: ContentApprovalCard) => Promise<void>;
  publishingTikTokId: string | null;
  setSchedulingCard: (card: ContentApprovalCard | null) => void;
  setScheduleDate: (date: string) => void;
  setScheduleTime: (time: string) => void;
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
  setScheduleTime
}: ApprovalTabProps) {
  const [promptMore, setPromptMore] = useState("");

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

  const handleAIGenerateMore = async () => {
    const topic = promptMore.trim();
    if (!topic) return;

    try {
      const card = newProductiveDraft(topic);
      const savedCard = await marketingService.saveCard(card);
      setApprovalCards(prev => [savedCard, ...prev]);
      setPromptMore("");
      toast.success("Đã tạo bài đăng nháp mới từ AI!");
    } catch (e) {
      console.error(e);
      toast.error("Không thể tạo bài đăng nháp từ AI.");
    }
  };

  return (
    <div className="space-y-6" id="moderation_pipeline_tab">
      
      {isUserRole && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold select-none text-left">
          <span>🔒 Bạn đang sử dụng tài khoản quyền **USER**. Bạn có quyền tạo bài viết mới, gửi duyệt nháp, lên lịch đăng tải và xóa bài viết của mình, nhưng không có quyền phê duyệt bài viết đang chờ duyệt.</span>
        </div>
      )}

      {/* Quick Prompt generator row */}
      <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex gap-3 items-end" id="prompt_more_bar">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-gray-400 font-mono uppercase mb-1.5 text-left">Prompt AI viết thêm bài đăng chủ đề mới:</label>
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
  );
}
