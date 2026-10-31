import React, { useState, useEffect, useMemo } from "react";
import {
  Eye,
  Printer,
  Pencil,
  Trash2,
  Clock,
  ArrowRight,
  Warehouse as WarehouseIcon,
  Search,
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { Dropdown, type DropdownOption } from "../common/Dropdown";
import { DatePeriodFilter } from "../common/DatePeriodFilter";
import { TableFilterToolbar } from "../common/TableFilterToolbar";
import {
  inventoryReceivingService,
  type Warehouse,
} from "../../services/inventoryReceivingService";
import { OutboundCreateModal } from "./outbound/OutboundCreateModal";
import { OutboundDetailModal } from "./outbound/OutboundDetailModal";
import {
  printOutboundVoucher,
  purposeLabel,
  type OutboundTicket,
} from "./outbound/printOutboundVoucher";
import type { StockLog, StockLogPurpose } from "../../types";
import { useConfirmation } from "../../context/ConfirmationContext";
import { emptyDatePeriodFilter, getDatePeriodRange, isDateInPeriod, type DatePeriodFilterValue } from "../../utils/datePeriodFilter";

export interface OutboundSectionProps {
  onReverse?: (id: string, reason: string) => Promise<{ _id: string }>;
  stockLogs?: StockLog[];
  isLoading?: boolean;
  onCreateTransaction: (payload: any) => Promise<void>;
  onUpdateTransaction: (payload: any) => Promise<void>;
  onUpdateStatus?: (
    logId: string,
    status: "Đang chờ" | "Đang xử lý" | "Hoàn thành"
  ) => Promise<void>;
  onDeleteTransaction?: (logId: string) => Promise<void>;
}

export function OutboundSection({
  onReverse,
  stockLogs = [],
  isLoading = false,
  onCreateTransaction,
  onUpdateTransaction,
  onUpdateStatus,
  onDeleteTransaction,
}: OutboundSectionProps) {
  const requestConfirmation = useConfirmation();
  // Warehouses list
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("all");
  const [selectedPurposeFilter, setSelectedPurposeFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DatePeriodFilterValue>(emptyDatePeriodFilter);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<OutboundTicket | null>(null);
  const [viewingTicket, setViewingTicket] = useState<OutboundTicket | null>(null);

  // Tải danh sách kho hàng
  const loadWarehouses = async () => {
    setWarehousesLoading(true);
    try {
      const whList = await inventoryReceivingService.listWarehouses();
      setWarehouses(whList);
    } catch {
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  };

  useEffect(() => {
    void loadWarehouses();
  }, []);

  // Chuẩn hóa một StockLog thành OutboundTicket
  const normalizeTicket = (log: StockLog): OutboundTicket => {
    const typedLog = log as any;
    const items = typedLog.items && typedLog.items.length > 0
      ? typedLog.items.map((i: any) => ({
        productId: i.productId,
        variantId: i.variantId,
        sku: i.sku || log.sku,
        productName: i.productName || log.productName,
        displayName: i.displayName,
        quantity: Number(i.quantity) || 1,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        unitCost: i.unitCost,
        unitIdentifiers: i.unitIdentifiers || [],
        serialNumbers: i.serialNumbers || [],
      }))
      : [
        {
          sku: log.sku,
          productName: log.productName,
          quantity: Number(log.quantity) || 1,
          unitIdentifiers: typedLog.unitIdentifiers || [],
          serialNumbers: typedLog.serialNumbers || [],
        },
      ];

    return {
      id: log.id,
      refType: typedLog.refType,
      refId: typedLog.refId,
      reversalId: typedLog.reversalId,
      title: log.title || `Xuất kho: ${log.productName || log.sku}`,
      createdAt: log.createdAt,
      status: (log.status === "Thành công" ? "Hoàn thành" : log.status) || "Đang chờ",
      purpose: log.purpose || "bán",
      customerId: typedLog.customerId,
      customerName: typedLog.customerName || "",
      operatorName: log.operatorName || "",
      notes: log.notes || "",
      warehouseId: typedLog.warehouseId,
      items,
    };
  };

  // Chỉ lấy các phiếu thuộc loại "xuất"
  const outboundLogs = useMemo(() => {
    return stockLogs
      .filter((l) => String(l.type).toLowerCase().startsWith("x"))
      .map(normalizeTicket);
  }, [stockLogs]);
  const dateRange = getDatePeriodRange(dateFilter);

  // Thống kê nhanh (KPI)
  const kpiMetrics = useMemo(() => {
    const total = outboundLogs.length;
    const pending = outboundLogs.filter((l) => l.status === "Đang chờ").length;
    const processing = outboundLogs.filter((l) => l.status === "Đang xử lý").length;
    const effective = outboundLogs.filter((l) => l.status === "Hoàn thành" && !l.reversalId);
    const completed = effective.length;
    const totalUnits = effective.reduce(
      (sum, l) => sum + l.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );

    return { total, pending, processing, completed, totalUnits };
  }, [outboundLogs]);

  // Lọc danh sách theo từ khóa và tiêu chí
  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return outboundLogs.filter((ticket) => {
      if (!isDateInPeriod(ticket.createdAt, dateRange)) return false;

      // Lọc theo Kho xuất
      if (selectedWarehouseFilter !== "all" && ticket.warehouseId !== selectedWarehouseFilter) {
        return false;
      }

      // Lọc theo Mục đích
      if (selectedPurposeFilter !== "all" && ticket.purpose !== selectedPurposeFilter) {
        return false;
      }

      // Lọc theo Trạng thái
      if (selectedStatusFilter !== "all" && ticket.status !== selectedStatusFilter) {
        return false;
      }

      // Tìm kiếm theo từ khóa
      if (query) {
        const itemText = ticket.items
          .map(
            (i) =>
              `${i.productName} ${i.sku} ${(i.serialNumbers || []).join(" ")} ${(i.unitIdentifiers || []).join(" ")}`
          )
          .join(" ")
          .toLowerCase();

        const isMongo = /^[0-9a-fA-F]{24}$/.test(ticket.id);
        const shortCode = isMongo ? `px-${ticket.id.slice(-6).toLowerCase()}` : "";

        const match =
          ticket.id.toLowerCase().includes(query) ||
          (shortCode && (shortCode.includes(query) || ticket.id.slice(-6).toLowerCase().includes(query))) ||
          (ticket.title || "").toLowerCase().includes(query) ||
          (ticket.customerName || "").toLowerCase().includes(query) ||
          (ticket.operatorName || "").toLowerCase().includes(query) ||
          (ticket.notes || "").toLowerCase().includes(query) ||
          itemText.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [
    outboundLogs,
    searchQuery,
    selectedWarehouseFilter,
    selectedPurposeFilter,
    selectedStatusFilter,
    dateRange.from,
    dateRange.to,
  ]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const visibleLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Xử lý tạo / cập nhật phiếu
  const handleSaveDraft = async (payload: any) => {
    if (payload.id) {
      await onUpdateTransaction(payload);
      toast.success("Đã cập nhật thông tin phiếu xuất kho.");
    } else {
      await onCreateTransaction(payload);
      toast.success("Đã tạo phiếu xuất kho mới thành công.");
    }
    setCreateModalOpen(false);
    setEditingTicket(null);
  };

  // In nhanh từ danh sách
  const handleQuickPrint = (ticket: OutboundTicket) => {
    const wh = warehouses.find((w) => w._id === ticket.warehouseId);
    printOutboundVoucher({
      ticket,
      warehouse: wh,
      includeSerials: true,
    });
  };

  // Mở sửa phiếu
  const handleOpenEdit = (ticket: OutboundTicket) => {
    setEditingTicket(ticket);
    setCreateModalOpen(true);
  };

  // Xóa phiếu
  const handleDeleteTicket = async (ticketId: string) => {
    if (!onDeleteTransaction) return;
    const confirmed = await requestConfirmation({ title: "Xóa phiếu xuất?", description: `Bạn có chắc chắn muốn xóa phiếu xuất ${ticketId}?`, confirmLabel: "Xóa phiếu", tone: "danger" });
    if (!confirmed) return;

    try {
      await onDeleteTransaction(ticketId);
      toast.success(`Đã xóa phiếu ${ticketId}.`);
    } catch (err: any) {
      toast.error(err?.message || "Không thể xóa phiếu.");
    }
  };

  // Dropdown options
  const warehouseFilterOptions: DropdownOption[] = [
    { value: "all", label: "Tất cả kho xuất" },
    ...warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      sublabel: `Mã: ${w.code}`,
    })),
  ];

  const purposeFilterOptions: DropdownOption[] = [
    { value: "all", label: "Tất cả mục đích xuất" },
    { value: "chuyển kho", label: "Điều chuyển kho sang cơ sở khác" },
    { value: "nội bộ", label: "Xuất nhân viên nội bộ sử dụng" },
    { value: "hủy", label: "Xuất hủy / lỗi / bảo hành" },
  ];

  const statusFilterOptions: DropdownOption[] = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "Đang chờ", label: "Đang chờ duyệt" },
    { value: "Đang xử lý", label: "Đang xuất kho" },
    { value: "Hoàn thành", label: "Đã hoàn thành" },
  ];

  // Helpers cho hiển thị mục đích & trạng thái
  const getPurposeBadge = (purpose?: string) => {
    const label = purposeLabel(purpose);
    switch (purpose) {
      case "chuyển kho":
        return {
          label,
          className: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "bán":
        return {
          label,
          className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "nội bộ":
        return {
          label,
          className: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "hủy":
        return {
          label,
          className: "bg-rose-50 text-rose-700 border-rose-200",
        };
      default:
        return {
          label,
          className: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Hoàn thành":
        return {
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dotClass: "bg-emerald-500",
        };
      case "Đang xử lý":
        return {
          badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
          dotClass: "bg-orange-500",
        };
      default:
        return {
          badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
          dotClass: "bg-slate-400",
        };
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Header Section */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Xuất hàng</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadWarehouses()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTicket(null);
              setCreateModalOpen(true);
            }}
            className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-cyan-800 transition-colors"
          >
            + Tạo phiếu xuất mới
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Tổng phiếu xuất
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800 tabular-nums">
            {kpiMetrics.total}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Đang chờ duyệt
          </div>
          <div className="mt-1 text-xl font-bold text-amber-800 tabular-nums">
            {kpiMetrics.pending}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
            Đang xuất kho
          </div>
          <div className="mt-1 text-xl font-bold text-orange-800 tabular-nums">
            {kpiMetrics.processing}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Đã hoàn thành
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-800 tabular-nums">
            {kpiMetrics.completed}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">
            Máy đã xuất (chưa đảo)
          </div>
          <div className="mt-1 text-xl font-bold text-cyan-800 tabular-nums">
            {kpiMetrics.totalUnits.toLocaleString("vi-VN")}
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <TableFilterToolbar
        search={{
          value: searchQuery,
          onChange: (val) => {
            setSearchQuery(val);
            setPage(1);
          },
          placeholder: "Tìm mã phiếu, khách hàng, SKU, IMEI...",
          ariaLabel: "Tìm phiếu xuất kho",
        }}
        dateFilter={{
          label: "thời gian phiếu xuất kho",
          value: dateFilter,
          onChange: (next) => {
            setDateFilter(next);
            setPage(1);
          },
        }}
        totalCount={filteredLogs.length}
        countLabel="phiếu xuất"
        hasActiveFilters={Boolean(
          searchQuery ||
            selectedWarehouseFilter !== "all" ||
            selectedPurposeFilter !== "all" ||
            selectedStatusFilter !== "all" ||
            dateFilter.mode !== "all"
        )}
        onResetFilters={() => {
          setSearchQuery("");
          setSelectedWarehouseFilter("all");
          setSelectedPurposeFilter("all");
          setSelectedStatusFilter("all");
          setDateFilter(emptyDatePeriodFilter());
          setPage(1);
        }}
        resetLabel="Đặt lại bộ lọc"
      >
        <div className="w-full sm:w-48 shrink-0">
          <Dropdown
            value={selectedWarehouseFilter}
            onChange={(val) => {
              setSelectedWarehouseFilter(val);
              setPage(1);
            }}
            options={warehouseFilterOptions}
            variant="filter"
            size="sm"
            aria-label="Kho xuất"
          />
        </div>
        <div className="w-full sm:w-44 shrink-0">
          <Dropdown
            value={selectedPurposeFilter}
            onChange={(val) => {
              setSelectedPurposeFilter(val);
              setPage(1);
            }}
            options={purposeFilterOptions}
            variant="filter"
            size="sm"
            aria-label="Mục đích xuất"
          />
        </div>
        <div className="w-full sm:w-44 shrink-0">
          <Dropdown
            value={selectedStatusFilter}
            onChange={(val) => {
              setSelectedStatusFilter(val);
              setPage(1);
            }}
            options={statusFilterOptions}
            variant="filter"
            size="sm"
            aria-label="Trạng thái xuất"
          />
        </div>
      </TableFilterToolbar>

      {/* 4. Tickets Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50/95 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-3.5 py-3 w-[155px]">Mã phiếu / Ngày tạo</th>
              <th className="px-3.5 py-3 w-[195px]">Kho xuất hàng</th>
              <th className="px-3.5 py-3 w-[170px]">Mục đích & Nơi nhận</th>
              <th className="px-3.5 py-3 w-[190px]">Mặt hàng xuất</th>
              <th className="px-3 py-3 w-[65px] text-center">Tổng SL</th>
              <th className="px-3 py-3 w-[95px]">Phụ trách</th>
              <th className="px-3 py-3 w-[105px]">Trạng thái</th>
              <th className="px-3 py-3 w-[105px] text-right sticky right-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] border-l border-slate-200/80 whitespace-nowrap">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                  Đang tải danh sách phiếu xuất kho...
                </td>
              </tr>
            ) : visibleLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                  {outboundLogs.length === 0
                    ? "Chưa có phiếu xuất kho nào. Nhấn 'Tạo phiếu xuất mới' để bắt đầu."
                    : "Không tìm thấy phiếu xuất nào khớp với điều kiện lọc."}
                </td>
              </tr>
            ) : (
              visibleLogs.map((ticket) => {
                const wh = warehouses.find((w) => w._id === ticket.warehouseId);
                const totalQty = ticket.items.reduce((s, i) => s + i.quantity, 0);
                const totalImeis = ticket.items.reduce(
                  (s, i) => s + (i.serialNumbers?.length || i.unitIdentifiers?.length || 0),
                  0
                );
                const itemsSummary = ticket.items.map((i) => i.productName || i.sku).join(", ");
                const purposeBadge = getPurposeBadge(ticket.purpose);
                const statusBadge = getStatusBadge(ticket.status);
                const isMongo = /^[0-9a-fA-F]{24}$/.test(ticket.id);
                const displayId = isMongo ? `PX-${ticket.id.slice(-6).toUpperCase()}` : ticket.id;

                const ticketDate = new Date(ticket.createdAt);
                const timeStr = ticketDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                const dateStr = ticketDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

                return (
                  <tr
                    key={ticket.id}
                    onClick={() => setViewingTicket(ticket)}
                    className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    {/* Mã phiếu / Ngày tạo */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap inline-block select-all"
                          title={`Mã phiếu: ${ticket.id}`}
                        >
                          {displayId}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 inline-flex items-center gap-1 mt-1 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{timeStr} · {dateStr}</span>
                      </div>
                    </td>

                    {/* Kho xuất */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-slate-800">
                        <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]" title={wh?.name || "Kho mặc định"}>
                          {wh?.name || "Kho mặc định"}
                        </span>
                      </div>
                      <div className="mt-0.5 pl-5">
                        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wide">
                          {wh?.code || "DEFAULT"}
                        </span>
                      </div>
                    </td>

                    {/* Mục đích & Nơi nhận */}
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold border whitespace-nowrap ${purposeBadge.className}`}
                      >
                        {purposeBadge.label}
                      </span>
                      {ticket.customerName && (
                        <div
                          className="flex items-center gap-1 text-xs text-slate-700 font-medium mt-1 truncate max-w-[160px]"
                          title={ticket.customerName}
                        >
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{ticket.customerName}</span>
                        </div>
                      )}
                    </td>

                    {/* Mặt hàng */}
                    <td className="px-3.5 py-2.5 max-w-[190px]">
                      <div className="text-xs text-slate-900 font-semibold truncate" title={itemsSummary}>
                        {ticket.items[0]?.productName || ticket.items[0]?.sku || "Không có mặt hàng"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-nowrap">
                        {ticket.items.length > 1 ? (
                          <span className="font-medium text-slate-600 whitespace-nowrap shrink-0">
                            +{ticket.items.length - 1} mặt hàng khác
                          </span>
                        ) : (
                          <span
                            className="font-mono text-slate-400 truncate max-w-[110px] whitespace-nowrap block"
                            title={ticket.items[0]?.sku}
                          >
                            {ticket.items[0]?.sku}
                          </span>
                        )}
                        {totalImeis > 0 && (
                          <span className="inline-flex items-center font-mono text-[10px] font-bold bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-200 shrink-0 whitespace-nowrap">
                            {totalImeis} IMEI
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tổng SL */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                        {totalQty}
                      </span>
                    </td>

                    {/* Phụ trách */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                          {(ticket.operatorName || "TK").charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[75px]" title={ticket.operatorName || "Thủ kho"}>
                          {ticket.operatorName || "Thủ kho"}
                        </span>
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${statusBadge.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                        {ticket.reversalId ? "Đã đảo toàn bộ" : ticket.status}
                      </span>
                    </td>

                    {/* Thao tác (Sticky, Lucide icon buttons) */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] border-l border-slate-100">
                      <div
                        className="inline-flex items-center gap-1 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Chi tiết (Lucide Eye) */}
                        <button
                          type="button"
                          onClick={() => setViewingTicket(ticket)}
                          aria-label="Chi tiết"
                          title="Chi tiết phiếu xuất & In phiếu"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-cyan-300 bg-cyan-50/80 text-cyan-800 shadow-2xs hover:bg-cyan-100 hover:border-cyan-400 active:scale-95 transition-all cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-cyan-700" aria-hidden="true" />
                          <span className="sr-only">Chi tiết</span>
                        </button>

                        {/* Sửa (Lucide Pencil) */}
                        {ticket.status === "Đang chờ" && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ticket)}
                            aria-label="Sửa phiếu xuất"
                            title="Sửa phiếu xuất"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-amber-200 bg-amber-50/80 text-amber-700 shadow-2xs hover:bg-amber-100 active:scale-95 transition-all cursor-pointer"
                          >
                            <Pencil className="w-4 h-4 text-amber-700" aria-hidden="true" />
                            <span className="sr-only">Sửa</span>
                          </button>
                        )}

                        {/* Xóa (Lucide Trash2) */}
                        {onDeleteTransaction && ticket.status !== "Hoàn thành" && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteTicket(ticket.id)}
                            aria-label="Xóa phiếu"
                            title="Xóa phiếu"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-rose-200 bg-rose-50/80 text-rose-600 shadow-2xs hover:bg-rose-100 hover:border-rose-300 active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" aria-hidden="true" />
                            <span className="sr-only">Xóa</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
          <span>
            Trang {page} / {totalPages} (Hiển thị {visibleLogs.length} trên tổng {filteredLogs.length} phiếu)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* 6. Modals */}
      {createModalOpen && (
        <OutboundCreateModal
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            setEditingTicket(null);
          }}
          initialTicket={editingTicket}
          warehouses={warehouses}
          onSave={handleSaveDraft}
        />
      )}

      {viewingTicket && (
        <OutboundDetailModal
          ticket={viewingTicket}
          onClose={() => setViewingTicket(null)}
          warehouses={warehouses}
          onUpdateStatus={onUpdateStatus}
          onReverse={onReverse ? async (id, reason) => {
            const result = await onReverse(id, reason);
            setViewingTicket((current) => current?.id === id ? { ...current, reversalId: result._id } : current);
            return result;
          } : undefined}
          onEdit={(t) => {
            setViewingTicket(null);
            setEditingTicket(t);
            setCreateModalOpen(true);
          }}
        />
      )}

    </div>
  );
}
