import React from "react";
import { 
  Clock, 
  Trash2, 
  Sparkles, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Facebook, 
  ExternalLink, 
  RefreshCw,
  Video,
  Image as ImageIcon
} from "lucide-react";
import { ContentApprovalCard } from "../../types";
import { toast } from "../../pages/Toast";

export const formatCardDate = (dateStr: any): string => {
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

interface ModerationPipCardProps {
  key?: string | number | null;
  card: ContentApprovalCard;
  onNextStatus: ((...args: any[]) => any) | null;
  onPrevStatus: ((...args: any[]) => any) | null;
  onDelete?: ((...args: any[]) => any) | null;
  onPreviewMedia: (type: 'image' | 'video', url: string) => void;
  onGenerateMedia: (card: ContentApprovalCard, type?: 'image' | 'video') => void;
}

export function ModerationPipCard({ 
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

interface ScheduledCardProps {
  key?: string | number | null;
  card: ContentApprovalCard;
  isUserRole: boolean;
  onPrevStatus: (...args: any[]) => any;
  onDelete: (...args: any[]) => any;
  fbIntegration?: { isConnected: boolean; pageId: string; pageName: string; pageAccessToken: string; isMock?: boolean } | null;
  tiktokIntegration?: { isConnected: boolean; username: string; displayName: string; isMock?: boolean; privacyLevel?: string } | null;
  onPreviewMedia: (type: 'image' | 'video', url: string) => void;
  onGenerateMedia: (card: ContentApprovalCard, type?: 'image' | 'video') => void;
  onPublishToTikTok?: (...args: any[]) => any;
  isPublishingTikTok?: boolean;
}

export function ScheduledCard({ 
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
            <><span className="text-sm font-sans">♪</span><span>Đăng lên TikTok {tiktokIntegration.isMock ? '(Demo)' : ''}</span></>
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
            <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-sm text-[8px] font-bold font-mono animate-pulse">
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

interface PublishedCardProps {
  key?: string | number | null;
  card: ContentApprovalCard;
  onDelete: (...args: any[]) => any;
  isUserRole: boolean;
  onPreviewMedia: (type: 'image' | 'video', url: string) => void;
}

export function PublishedCard({ card, onDelete, isUserRole, onPreviewMedia }: PublishedCardProps) {
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

      <h5 className="font-bold text-gray-850 leading-tight text-xs font-sans line-clamp-2">{card.title}</h5>
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
