/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import { Search, Zap, Plus } from "lucide-react";
import { ExtendedLeadCard } from "../../services/crmService";
import { PipelineCard } from "./PipelineCard";
import { HrEmptyIllustration } from "../../../../../components/hr/HrEmptyIllustration";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";

import { CustomerInbox } from "../../../shared/types/index";

type PipelineTabProps = {
  leads: ExtendedLeadCard[];
  searchPipeline: string;
  setSearchPipeline: (val: string) => void;
  triggerUpsellCampaignOptimized: () => void;
  setShowCreateLeadModal: (show: boolean) => void;
  moveLeadPipeline: (id: string, newStatus: "cold" | "warm" | "hot") => void;
  deleteLead: (id: string) => void;
  handleGoToChat: (customerName: string) => void;
  activeChannel: "all" | "facebook" | "zalo" | "tiktok";
  inboxCustomers: CustomerInbox[];
  isFbConnected: boolean;
  isZaloConnected: boolean;
};

export const PipelineTab: React.FC<PipelineTabProps> = ({
  leads,
  searchPipeline,
  setSearchPipeline,
  triggerUpsellCampaignOptimized,
  setShowCreateLeadModal,
  moveLeadPipeline,
  deleteLead,
  handleGoToChat,
  activeChannel,
  inboxCustomers,
  isFbConnected,
  isZaloConnected,
}) => {

  // HTML5 Drag and Drop states
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLeadId(id);
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, status: "cold" | "warm" | "hot") => {
    e.preventDefault();
    setActiveColumn(status);
  };

  const handleDragLeave = () => {
    setActiveColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: "cold" | "warm" | "hot") => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedLeadId;
    if (id) {
      moveLeadPipeline(id, targetStatus);
    }
    setDraggedLeadId(null);
    setActiveColumn(null);
  };

  // Lọc và gom nhóm cơ hội theo trạng thái và kênh mxh
  const filteredLeads = leads.filter(l => {
    // 1. Tìm kiếm
    const matchesSearch =
      l.customerName.toLowerCase().includes(searchPipeline.toLowerCase()) ||
      l.company.toLowerCase().includes(searchPipeline.toLowerCase()) ||
      (l.productOfChoice && l.productOfChoice.toLowerCase().includes(searchPipeline.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Phân loại theo kênh mạng xã hội
    const isFbLead =
      l.company.toLowerCase().includes("facebook") ||
      inboxCustomers.some(c => c.name.toLowerCase() === l.customerName.toLowerCase() && c.channel === "facebook");

    const isZaloLead =
      l.company.toLowerCase().includes("zalo") ||
      inboxCustomers.some(c => c.name.toLowerCase() === l.customerName.toLowerCase() && c.channel === "zalo");

    const isTiktokLead =
      l.company.toLowerCase().includes("tiktok") ||
      inboxCustomers.some(c => c.name.toLowerCase() === l.customerName.toLowerCase() && c.channel === "tiktok");

    if (activeChannel === "all") return true;
    if (activeChannel === "facebook") return isFbLead;
    if (activeChannel === "zalo") return isZaloLead;
    if (activeChannel === "tiktok") return isTiktokLead;
  });

  const groupedLeads = {
    cold: [] as ExtendedLeadCard[],
    warm: [] as ExtendedLeadCard[],
    hot: [] as ExtendedLeadCard[],
  };

  filteredLeads.forEach((lead) => {
    if (lead.status === "cold") {
      groupedLeads.cold.push(lead);
      return;
    }
    if (lead.status === "warm") {
      groupedLeads.warm.push(lead);
      return;
    }
    if (lead.status === "hot") {
      groupedLeads.hot.push(lead);
    }
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 md:p-4" id="leads_pipeline_kanban">

      {/* Search and Action Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
        <div className="relative min-w-0 w-full sm:max-w-md">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            aria-label="Tìm kiếm cơ hội bán hàng"
            placeholder="Tìm kiếm cơ hội bán hàng (tên, công ty, sản phẩm)..."
            value={searchPipeline}
            onChange={(e) => setSearchPipeline(e.target.value)}
            className="min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary focus:ring-0"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={triggerUpsellCampaignOptimized}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
          >
            <Zap aria-hidden="true" className="size-4 text-primary" />
            Gửi ưu đãi hàng loạt
          </button>
          <button
            type="button"
            onClick={() => setShowCreateLeadModal(true)}
            className={`${primaryCreateButtonClass} min-h-10 rounded-md`}
          >
            <Plus aria-hidden="true" className="size-4" />
            Thêm cơ hội mới
          </button>
        </div>
      </div>

      {/* Pipeline Columns Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3" id="pipeline_columns_grid">

        {/* COLD: KHÁCH LẠNH */}
        <div
          onDragOver={(e) => handleDragOver(e, "cold")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "cold")}
          className={`flex min-h-56 flex-col overflow-hidden rounded-md border p-3 ${activeColumn === "cold" ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-lowest"
            }`}
          id="pipeline_cold"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between border-b border-outline-variant pb-3">
            <div className="text-left">
              <span className="block text-sm font-semibold text-on-surface">Khách lạnh</span>
              <span className="mt-0.5 block text-xs text-on-surface-variant">Chưa xác định rõ nhu cầu</span>
            </div>
            <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-surface-container px-1.5 text-xs font-medium tabular-nums text-on-surface">
              {groupedLeads.cold.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {groupedLeads.cold.map(l => (
              <PipelineCard
                key={l.id}
                lead={l}
                onMove={(ns) => moveLeadPipeline(l.id, ns)}
                onDelete={() => deleteLead(l.id)}
                onDragStart={(e) => handleDragStart(e, l.id)}
                onGoToChat={handleGoToChat}
              />
            ))}
            {groupedLeads.cold.length === 0 && (
              <div className="flex min-h-44 flex-col items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface px-3 py-4 text-center text-sm text-on-surface-variant">
                <HrEmptyIllustration kind="worker" className="h-20 w-36" />
                <span>Không có khách hàng</span>
              </div>
            )}
          </div>
        </div>

        {/* WARM: KHÁCH ẤM */}
        <div
          onDragOver={(e) => handleDragOver(e, "warm")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "warm")}
          className={`flex min-h-56 flex-col overflow-hidden rounded-md border p-3 ${activeColumn === "warm" ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-lowest"
            }`}
          id="pipeline_warm"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between border-b border-outline-variant pb-3">
            <div className="text-left">
              <span className="block text-sm font-semibold text-on-surface">Khách ấm (tiềm năng)</span>
              <span className="mt-0.5 block text-xs text-on-surface-variant">Đã tương tác hoặc nhận báo giá</span>
            </div>
            <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-surface-container px-1.5 text-xs font-medium tabular-nums text-on-surface">
              {groupedLeads.warm.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {groupedLeads.warm.map(l => (
              <PipelineCard
                key={l.id}
                lead={l}
                onMove={(ns) => moveLeadPipeline(l.id, ns)}
                onDelete={() => deleteLead(l.id)}
                onDragStart={(e) => handleDragStart(e, l.id)}
                onGoToChat={handleGoToChat}
              />
            ))}
            {groupedLeads.warm.length === 0 && (
              <div className="flex min-h-44 flex-col items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface px-3 py-4 text-center text-sm text-on-surface-variant">
                <HrEmptyIllustration kind="worker" className="h-20 w-36" />
                <span>Không có khách hàng</span>
              </div>
            )}
          </div>
        </div>

        {/* HOT: KHÁCH NÓNG */}
        <div
          onDragOver={(e) => handleDragOver(e, "hot")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "hot")}
          className={`flex min-h-56 flex-col overflow-hidden rounded-md border p-3 ${activeColumn === "hot" ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-lowest"
            }`}
          id="pipeline_hot"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between border-b border-outline-variant pb-3">
            <div className="text-left">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                Khách nóng (sắp chốt)
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-on-surface-variant">Chuẩn bị ký kết & chốt hợp đồng</span>
            </div>
            <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-surface-container px-1.5 text-xs font-medium tabular-nums text-on-surface">
              {groupedLeads.hot.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {groupedLeads.hot.map(l => (
              <PipelineCard
                key={l.id}
                lead={l}
                onMove={(ns) => moveLeadPipeline(l.id, ns)}
                onDelete={() => deleteLead(l.id)}
                onDragStart={(e) => handleDragStart(e, l.id)}
                onGoToChat={handleGoToChat}
              />
            ))}
            {groupedLeads.hot.length === 0 && (
              <div className="flex min-h-44 flex-col items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface px-3 py-4 text-center text-sm text-on-surface-variant">
                <HrEmptyIllustration kind="worker" className="h-20 w-36" />
                <span>Không có khách hàng</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
