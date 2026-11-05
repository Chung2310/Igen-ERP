import React from "react";
import { Clock, Trash2, MessageSquare } from "lucide-react";
import { ExtendedLeadCard } from "../../services/crmService";

type PipelineCardProps = {
  lead: ExtendedLeadCard;
  onMove: (ns: "cold" | "warm" | "hot") => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onGoToChat: (customerName: string) => void;
};

function getCustomerInitials(customerName: string) {
  const parts = customerName.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "KH";
}

function getSafeLeadAvatar(lead: ExtendedLeadCard) {
  const avatar = String(lead.avatar || "").trim();
  if (avatar && !/(?:Ã|Â|ðŸ|â€|�)/u.test(avatar)) return avatar;
  return getCustomerInitials(lead.customerName);
}

export const PipelineCard: React.FC<PipelineCardProps> = ({
  lead,
  onMove,
  onDelete,
  onDragStart,
  onGoToChat
}) => {
  return (
    <div 
      draggable
      onDragStart={onDragStart}
      className="relative flex cursor-grab flex-col gap-2.5 rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-left active:cursor-grabbing"
      id={`pipeline_card_${lead.id}`}
    >
      {/* Badge & Avatar Header */}
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 select-none rounded-md border border-outline-variant bg-surface-container p-1 text-lg">
          {getSafeLeadAvatar(lead)}
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="truncate text-sm font-semibold leading-tight text-on-surface">{lead.customerName}</h5>
          <p className="mt-0.5 truncate text-xs text-on-surface-variant">{lead.company}</p>
        </div>
      </div>

      {/* Status & Value Row */}
      <div className="flex items-center justify-between border-y border-outline-variant py-2 text-xs leading-tight">
        <div>
          <span className="block text-xs text-on-surface-variant">Tiến độ</span>
          <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
            lead.lastInteraction === "Sắp chốt HD" 
              ? "bg-red-50 text-red-600 border border-red-100" 
              : lead.lastInteraction === "Đã gửi báo giá"
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}>
            {lead.lastInteraction || "Mới tiếp cận"}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-xs text-on-surface-variant">Dự toán đơn</span>
          <strong className="mt-0.5 block text-sm font-semibold tabular-nums text-primary">
            {lead.value > 0 ? `${lead.value.toLocaleString("vi-VN")} đ` : "Chưa xác định"}
          </strong>
        </div>
      </div>

      {/* Time & Delete Action Row */}
      <div className="flex items-center justify-between pt-0.5 text-xs text-on-surface-variant">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-300" />
          <span>{lead.lastInteractionTime || "Chưa rõ"}</span>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }} 
          className="cursor-pointer rounded-md p-1 text-error hover:bg-error-container focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
          title="Xóa cơ hội này"
          aria-label="Xóa cơ hội này"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hybrid Action Controls for Lowtech Users */}
      <div className="mt-0.5 grid shrink-0 grid-cols-2 gap-1.5 border-t border-outline-variant pt-2">
        <button
          onClick={() => onGoToChat(lead.customerName)}
          className="flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
        >
          <MessageSquare className="w-3 h-3 shrink-0" />
          Nhắn tin
        </button>

        {lead.status === "cold" && (
          <button 
            onClick={() => onMove("warm")}
            className="flex min-h-8 cursor-pointer items-center justify-center gap-0.5 rounded-md bg-primary px-2 text-xs font-medium text-white hover:bg-primary/90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
          >
            Chuyển Ấm →
          </button>
        )}
        
        {lead.status === "hot" && (
          <button 
            onClick={() => onMove("warm")}
            className="flex min-h-8 cursor-pointer items-center justify-center gap-0.5 rounded-md border border-outline-variant bg-surface-container px-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
          >
            ← Chuyển Ấm
          </button>
        )}

        {lead.status === "warm" && (
          <div className="flex gap-1">
            <button 
              onClick={() => onMove("cold")}
              className="min-h-8 flex-1 cursor-pointer rounded-md border border-outline-variant bg-surface-container px-1 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
              title="Chuyển Lạnh"
            >
              ← Lạnh
            </button>
            <button 
              onClick={() => onMove("hot")}
              className="min-h-8 flex-1 cursor-pointer rounded-md bg-primary px-1 text-xs font-medium text-white hover:bg-primary/90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
              title="Chuyển Nóng"
            >
              Nóng →
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
