import React from "react";
import { MetricBar, MetricBarItem } from "../../common/MetricBar";
import { formatNumber, StockLogStatsData } from "./stockLogUtils";

interface StockLogStatsProps {
  stats: StockLogStatsData;
  activeTypeFilter?: "all" | "inbound" | "outbound" | "pos";
  onSelectTypeFilter?: (type: "all" | "inbound" | "outbound" | "pos") => void;
  activeStatusFilter?: "all" | "pending" | "processing" | "completed";
  onSelectStatusFilter?: (status: "all" | "pending" | "processing" | "completed") => void;
}

export function StockLogStats({
  stats,
  activeTypeFilter = "all",
  onSelectTypeFilter,
  activeStatusFilter = "all",
  onSelectStatusFilter,
}: StockLogStatsProps) {
  const items: MetricBarItem[] = [
    {
      id: "total",
      label: "Quy mô giao dịch",
      value: formatNumber(stats.total),
      unit: "phiếu",
      subtext: "Toàn bộ biến động kho & POS",
      tone: "default",
      isActive: activeTypeFilter === "all" && activeStatusFilter === "all",
      onClick: onSelectTypeFilter
        ? () => {
            onSelectTypeFilter("all");
            onSelectStatusFilter?.("all");
          }
        : undefined,
    },
    {
      id: "inbound",
      label: "Nhập kho thực tế",
      value: `+${formatNumber(stats.inboundQty)}`,
      unit: "sp",
      tone: "emerald",
      subtext: (
        <span className="text-emerald-600 font-medium">
          Ghi nhận {formatNumber(stats.inboundCount)} phiếu nhập hàng
        </span>
      ),
      isActive: activeTypeFilter === "inbound",
      onClick: onSelectTypeFilter
        ? () => {
            onSelectTypeFilter(activeTypeFilter === "inbound" ? "all" : "inbound");
          }
        : undefined,
    },
    {
      id: "outbound_pos",
      label: "Đã xuất bán & POS",
      value: `-${formatNumber(stats.outboundQty)}`,
      unit: "sp",
      tone: "blue",
      subtext: (
        <span className="text-blue-600 font-medium">
          Xuất: {formatNumber(stats.outboundCount)} · Bán POS: {formatNumber(stats.posSalesCount)} đơn
        </span>
      ),
      isActive: activeTypeFilter === "outbound" || activeTypeFilter === "pos",
      onClick: onSelectTypeFilter
        ? () => {
            onSelectTypeFilter(activeTypeFilter === "pos" ? "all" : "pos");
          }
        : undefined,
    },
    {
      id: "pending",
      label: "Cần xử lý / Chờ duyệt",
      value: formatNumber(stats.pendingCount),
      unit: "phiếu",
      tone: "amber",
      valueClassName: stats.pendingCount > 0 ? "text-amber-700" : "text-slate-600",
      subtext: stats.pendingCount > 0 ? "Cần kiểm tra hoặc xác nhận" : "Đã hoàn tất toàn bộ",
      isActive: activeStatusFilter === "pending",
      onClick: onSelectStatusFilter
        ? () => {
            onSelectStatusFilter(activeStatusFilter === "pending" ? "all" : "pending");
          }
        : undefined,
    },
  ];

  return (
    <MetricBar
      id="stock_log_stats_strip"
      items={items}
      columns={4}
    />
  );
}
