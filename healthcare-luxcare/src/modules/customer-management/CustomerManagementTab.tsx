import React, { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { branchService, type BranchRecord } from "../../services/branchService";
import CustomerQrModal from "./CustomerQrModal";
import CustomerLeadDetailModal, { type CustomerLeadItem } from "./CustomerLeadDetailModal";
import CustomerLeadCreateModal from "./CustomerLeadCreateModal";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  new: { label: "Mới tiếp nhận", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  contacted: { label: "Đã liên hệ", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  in_consultation: { label: "Đang tư vấn", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  converted: { label: "Thành công", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  cancelled: { label: "Đã hủy", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

export default function CustomerManagementTab() {
  const { userProfile } = useAuth();
  const [leads, setLeads] = useState<CustomerLeadItem[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    todayNew: 0,
    new: 0,
    contacted: 0,
    in_consultation: 0,
    converted: 0,
    cancelled: 0,
  });

  // Bộ lọc
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CustomerLeadItem | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<CustomerLeadItem | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);

  // Tải danh sách chi nhánh
  useEffect(() => {
    async function loadBranches() {
      try {
        const list = await branchService.list();
        setBranches(list.filter((b) => b.isActive));
      } catch (err) {
        console.warn("Không thể tải danh sách chi nhánh:", err);
      }
    }
    loadBranches();
  }, []);

  // Tải thống kê
  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const branchQuery = selectedBranchId !== "all" ? `?branchId=${selectedBranchId}` : "";
      const res = await fetch(`/api/v1/customer-leads/stats${branchQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === "success") {
        setStats(json.data);
      }
    } catch (err) {
      console.warn("Lỗi khi tải thống kê:", err);
    }
  }, [selectedBranchId]);

  // Tải danh sách khách hàng
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const query = new URLSearchParams({
        page: String(currentPage),
        limit: "20",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(selectedBranchId !== "all" ? { branchId: selectedBranchId } : {}),
        ...(selectedStatus !== "all" ? { status: selectedStatus } : {}),
        ...(selectedSource !== "all" ? { source: selectedSource } : {}),
      });

      const res = await fetch(`/api/v1/customer-leads?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === "success") {
        setLeads(json.leads || []);
        setTotalPages(json.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách khách hàng:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, selectedBranchId, selectedStatus, selectedSource]);

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [fetchLeads, fetchStats]);

  // Thao tác cập nhật lead
  const handleUpdateLead = async (id: string, updates: any) => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`/api/v1/customer-leads/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok || json.status !== "success") {
      throw new Error(json.message || "Lỗi khi cập nhật");
    }
    await fetchLeads();
    await fetchStats();
  };

  // Thao tác xóa lead
  const handleDeleteLead = async (id: string) => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`/api/v1/customer-leads/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || json.status !== "success") {
      throw new Error(json.message || "Lỗi khi xóa");
    }
    await fetchLeads();
    await fetchStats();
  };

  const handleConfirmDeleteLead = async () => {
    if (!leadToDelete) return;
    setDeletingLead(true);
    try {
      await handleDeleteLead(leadToDelete._id);
      toast.success(`Đã xóa khách hàng "${leadToDelete.fullName}".`);
      setLeadToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa khách hàng.");
    } finally {
      setDeletingLead(false);
    }
  };

  // Thao tác tạo mới lead
  const handleCreateLead = async (payload: any) => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch("/api/v1/customer-leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.status !== "success") {
      throw new Error(json.message || "Lỗi khi tạo mới");
    }
    await fetchLeads();
    await fetchStats();
  };

  // Xuất file Excel (.xlsx)
  const handleExportExcel = () => {
    if (leads.length === 0) {
      toast.warning("Chưa có dữ liệu khách hàng để xuất.");
      return;
    }

    const rows = leads.map((l, index) => ({
      "STT": index + 1,
      "Họ và tên": l.fullName || "",
      "Số điện thoại": l.phone || "",
      "Email": l.email || "",
      "Dịch vụ quan tâm": l.serviceInterest || "",
      "Nguồn thu thập": l.source === "qr_code" ? "Mã QR" : "Thủ công",
      "Chiến dịch/Vị trí QR": l.qrCampaign || "",
      "Chi nhánh": l.branchName || "",
      "Khung giờ liên hệ": l.preferredContactTime || "",
      "Trạng thái": STATUS_MAP[l.status]?.label || l.status,
      "Ngày tạo": new Date(l.createdAt).toLocaleDateString("vi-VN"),
      "Ghi chú": l.notes || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Căn chỉnh độ rộng cột
    worksheet["!cols"] = [
      { wch: 6 },  // STT
      { wch: 22 }, // Họ và tên
      { wch: 15 }, // Số điện thoại
      { wch: 25 }, // Email
      { wch: 25 }, // Dịch vụ quan tâm
      { wch: 16 }, // Nguồn thu thập
      { wch: 22 }, // Chiến dịch/Vị trí QR
      { wch: 20 }, // Chi nhánh
      { wch: 18 }, // Khung giờ liên hệ
      { wch: 16 }, // Trạng thái
      { wch: 14 }, // Ngày tạo
      { wch: 30 }, // Ghi chú
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KhachHang");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Danh_sach_khach_hang_${dateStr}.xlsx`);
    toast.success("Xuất file Excel danh sách khách hàng thành công!");
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 font-sans text-slate-800">
      {/* 1. Header & Bộ nút hành động */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            Quản lý khách hàng
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Tiếp nhận thông tin khách hàng tự động qua mã QR và theo dõi tiến trình tư vấn
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Nút Cấp mã QR */}
          <button
            onClick={() => setQrModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 py-2.5 px-4 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:from-teal-700 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer"
          >
            <QrCode className="h-4 w-4" /> Cấp mã QR thu thập
          </button>

          {/* Nút Thêm khách hàng thủ công */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 text-teal-600" /> Thêm khách hàng
          </button>

          {/* Nút Xuất file Excel */}
          <button
            onClick={handleExportExcel}
            title="Xuất file Excel (.xlsx)"
            className="flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Khối KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng khách</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{stats.total}</div>
          <p className="mt-1 text-[11px] text-slate-400">Toàn bộ khách hàng ghi nhận</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mới hôm nay</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600">{stats.todayNew}</div>
          <p className="mt-1 text-[11px] text-slate-400">Khách mới gửi biểu mẫu hôm nay</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đang tư vấn</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">{stats.in_consultation}</div>
          <p className="mt-1 text-[11px] text-slate-400">Khách đang được chăm sóc</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Thành công</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{stats.converted}</div>
          <p className="mt-1 text-[11px] text-slate-400">Đã chốt dịch vụ thành công</p>
        </div>
      </div>

      {/* 3. Thanh tìm kiếm và bộ lọc */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm kiếm theo họ tên, số điện thoại, email, dịch vụ..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Chi nhánh */}
            {branches.length > 0 && (
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
              >
                <option value="all">Tất cả chi nhánh</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Trạng thái */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">Mới tiếp nhận</option>
              <option value="contacted">Đã liên hệ</option>
              <option value="in_consultation">Đang tư vấn</option>
              <option value="converted">Thành công</option>
              <option value="cancelled">Đã hủy</option>
            </select>

            {/* Nguồn */}
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">Tất cả nguồn</option>
              <option value="qr_code">Mã QR</option>
              <option value="manual">Thủ công tại quầy</option>
            </select>

            {/* Nút reset/refresh */}
            <button
              onClick={() => {
                fetchLeads();
                fetchStats();
              }}
              title="Làm mới danh sách"
              className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-teal-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bảng danh sách khách hàng */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-teal-600 mb-3" />
            <span className="text-xs font-medium">Đang tải danh sách khách hàng...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Chưa có dữ liệu khách hàng phù hợp</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hãy tạo mã QR để đặt tại quầy tiếp đón hoặc bấm &quot;Thêm khách hàng&quot; để ghi nhận thông tin thủ công.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setQrModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-700 transition-colors"
              >
                <QrCode className="h-4 w-4" /> Cấp mã QR thu thập ngay
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Giao diện Mobile Cards (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {leads.map((lead) => {
                const statusInfo = STATUS_MAP[lead.status] || STATUS_MAP.new;
                return (
                  <div
                    key={lead._id}
                    onClick={() => setSelectedLead(lead)}
                    className="p-4 space-y-3 hover:bg-teal-50/20 active:bg-teal-50/40 transition-colors cursor-pointer"
                  >
                    {/* Header card: Avatar, Tên, Trạng thái */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800 font-bold text-sm shrink-0">
                          {lead.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm leading-tight">{lead.fullName}</div>
                          {lead.email && <div className="text-[11px] text-slate-400 mt-0.5">{lead.email}</div>}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border} shrink-0`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* SĐT & Dịch vụ */}
                    <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Số điện thoại:</span>
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3 text-teal-600" /> {lead.phone}
                        </a>
                      </div>
                      {lead.serviceInterest && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-400 text-[11px] shrink-0">Dịch vụ:</span>
                          <span className="font-medium text-slate-800 text-right line-clamp-1">{lead.serviceInterest}</span>
                        </div>
                      )}
                    </div>

                    {/* Nguồn & Thời gian */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        {lead.source === "qr_code" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                            <QrCode className="h-2.5 w-2.5" /> {lead.qrCampaign || "Mã QR"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            <User className="h-2.5 w-2.5" /> Thủ công
                          </span>
                        )}
                        {lead.branchName && (
                          <span className="text-slate-500 font-medium truncate max-w-[130px]">
                            • {lead.branchName}
                          </span>
                        )}
                      </div>

                      <span>
                        {new Date(lead.createdAt).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Nút hành động */}
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLead(lead);
                        }}
                        className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors cursor-pointer"
                      >
                        Xem chi tiết & Xử lý
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeadToDelete(lead);
                        }}
                        className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Xóa khách hàng"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Giao diện Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Khách hàng</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4">Dịch vụ quan tâm</th>
                    <th className="py-3 px-4">Nguồn</th>
                    <th className="py-3 px-4">Chi nhánh</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const statusInfo = STATUS_MAP[lead.status] || STATUS_MAP.new;
                    return (
                      <tr
                        key={lead._id}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-teal-50/30 transition-colors cursor-pointer"
                      >
                        {/* Cột khách hàng */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100/80 text-teal-800 font-bold text-xs shrink-0">
                              {lead.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{lead.fullName}</div>
                              {lead.email && <div className="text-[11px] text-slate-400">{lead.email}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Cột số điện thoại */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-teal-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Phone className="h-3 w-3 text-teal-500" />
                            {lead.phone}
                          </a>
                        </td>

                        {/* Cột dịch vụ quan tâm */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span className="truncate block font-medium text-slate-800" title={lead.serviceInterest}>
                            {lead.serviceInterest || "Tư vấn chung"}
                          </span>
                          {lead.preferredContactTime && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" /> {lead.preferredContactTime}
                            </span>
                          )}
                        </td>

                        {/* Cột nguồn */}
                        <td className="py-3.5 px-4">
                          {lead.source === "qr_code" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                              <QrCode className="h-3 w-3" /> {lead.qrCampaign || "Mã QR"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                              <User className="h-3 w-3" /> Thủ công
                            </span>
                          )}
                        </td>

                        {/* Cột chi nhánh */}
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-medium text-slate-700">
                            {lead.branchName || "Hệ thống chung"}
                          </span>
                        </td>

                        {/* Cột thời gian */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </td>

                        {/* Cột trạng thái */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Cột thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-teal-600 transition-colors cursor-pointer"
                            >
                              Xử lý
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeadToDelete(lead);
                              }}
                              className="rounded-xl border border-transparent p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa khách hàng"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
            <span>Trang {currentPage} / {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CustomerQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        companyCode={userProfile?.companyCode || "COMPANY"}
        companyName={userProfile?.companyName || "Lux Care"}
        branches={branches}
        userBranchId={userProfile?.branchId}
      />

      <CustomerLeadCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        branches={branches}
        defaultBranchId={userProfile?.branchId}
        onCreate={handleCreateLead}
      />

      <CustomerLeadDetailModal
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onUpdate={handleUpdateLead}
        onDelete={handleDeleteLead}
      />

      <ConfirmDialog
        isOpen={Boolean(leadToDelete)}
        onClose={() => {
          if (!deletingLead) setLeadToDelete(null);
        }}
        onConfirm={handleConfirmDeleteLead}
        title="Xóa khách hàng?"
        description={`Bạn có chắc chắn muốn xóa khách hàng "${leadToDelete?.fullName}" không? Dữ liệu này sẽ không thể khôi phục.`}
        confirmLabel="Xóa khách hàng"
        cancelLabel="Hủy"
        tone="danger"
        isSubmitting={deletingLead}
      />
    </div>
  );
}
