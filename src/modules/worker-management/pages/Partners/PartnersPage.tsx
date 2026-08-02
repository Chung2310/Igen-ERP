import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Handshake,
  Wallet,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  Landmark,
  Download,
  Upload,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { apiFetch } from "../../lib/api";
import { toast } from "../../../../pages/Toast";
import {
  ErpPageHeader,
  ErpPrimaryButton,
  ErpSearchBar,
  ErpFilterTab,
  ErpFilterRail,
  ErpEmptyState,
  ErpLoadingState,
  ErpCard,
  ErpStatCard,
  ErpConfirmModal,
} from "../../components/Erp/ErpUI";
import { formatVND } from "../../lib/utils";
import { AddPartnerModal } from "./components/AddPartnerModal";
import { PartnerDetailModal } from "./components/PartnerDetailModal";
import { AddPayoutModal } from "./components/AddPayoutModal";
import { CommissionLevelModal } from "./components/CommissionLevelModal";
import { ImportPartnerModal } from "./components/ImportPartnerModal";
import { Partner } from "../../types";
import * as XLSX from "xlsx";
import { useEntityLabel } from "../../hooks/useEntityLabel";
import { getWorkerOperationalCopy } from "../../config/workerRecruitmentCopy";
import { getPartnerActionVisibility } from "./partnerAccess";
import { useBranch } from "../../../../context/BranchContext";
import { buildPartnerBranchHeaders } from "./partnerBranchScope";

interface PartnersPageProps {
  selectedCenter?: string;
  canManagePartners: boolean;
}

export function PartnersPage({
  selectedCenter,
  canManagePartners,
}: PartnersPageProps) {
  const entityLabel = useEntityLabel();
  const operationalCopy = getWorkerOperationalCopy(entityLabel.preset);
  const actions = getPartnerActionVisibility(canManagePartners);
  const { activeBranchId } = useBranch();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Modal triggers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null,
  );
  const [payingPartner, setPayingPartner] = useState<Partner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter !== "all") {
        params.append("isActive", statusFilter === "active" ? "true" : "false");
      }
      if (selectedCenter && selectedCenter !== "all") {
        params.append("ownerFilter", selectedCenter);
      }

      const res = await apiFetch(`/partners?${params.toString()}`, {
        headers: buildPartnerBranchHeaders(activeBranchId),
      });
      if (res.success && res.partners) {
        setPartners(res.partners);
      }
    } catch (error) {
      console.error("Failed to fetch partners:", error);
      toast.error("Không thể lấy danh sách đối tác.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, selectedCenter, activeBranchId, toast]);

  useEffect(() => {
    setTimeout(() => {
      fetchPartners();
    }, 0);
  }, [fetchPartners]);

  // Listener to handle internal mutations (e.g. payout recorded inside detail modal)
  useEffect(() => {
    const handleMutation = () => {
      fetchPartners();
    };
    window.addEventListener("partner-mutation", handleMutation);
    return () => window.removeEventListener("partner-mutation", handleMutation);
  }, [fetchPartners]);

  const handleDeleteConfirm = async () => {
    if (!deletingPartner) return;
    try {
      const res = await apiFetch(`/partners/${deletingPartner._id}`, {
        method: "DELETE",
        headers: buildPartnerBranchHeaders(activeBranchId),
      });
      if (res.success) {
        toast.success(`Đã xóa đối tác "${deletingPartner.name}" thành công!`);
        fetchPartners();
        setDeletingPartner(null);
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi khi xóa đối tác.";
      toast.error(msg);
    }
  };

  const handleExportExcel = () => {
    if (partners.length === 0) {
      toast.warning("Không có dữ liệu để xuất.");
      return;
    }

    const headers = [
      "Tên đối tác",
      "Số điện thoại",
      "Email",
      "Ngân hàng",
      "Số tài khoản",
      "Tên chủ tài khoản",
      "Trạng thái",
      "Ghi chú",
      operationalCopy.partnerReferralCountLabel,
      operationalCopy.partnerReferralValueLabel,
      "Tổng hoa hồng",
      "Đã thanh toán",
      "Còn nợ",
      "Level hoa hồng",
      "Owner ID",
    ];

    const rows = partners.map((partner) => [
      partner.name || "",
      partner.phone || "",
      partner.email || "",
      partner.bankName || "",
      partner.bankAccountNo || "",
      partner.bankAccountName || "",
      partner.isActive ? "Đang hoạt động" : "Ngưng hoạt động",
      partner.notes || "",
      partner.referredStudentsCount || 0,
      partner.totalReferredTuition || 0,
      partner.totalCommission || 0,
      partner.totalPaid || 0,
      partner.unpaidBalance || 0,
      partner.levelName || "",
      partner.ownerId || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Partners");
    XLSX.writeFile(
      wb,
      `danh_sach_doi_tac_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}.xlsx`,
    );
  };

  // Compute total stats based on loaded partners list (reflects filters/search results)
  const stats = useMemo(() => {
    const totalPartners = partners.length;
    const activePartners = partners.filter((p) => p.isActive).length;
    const totalCommission = partners.reduce(
      (sum, p) => sum + (p.totalCommission || 0),
      0,
    );
    const totalPaid = partners.reduce((sum, p) => sum + (p.totalPaid || 0), 0);
    const pendingPayout = partners.reduce(
      (sum, p) => sum + (p.unpaidBalance || 0),
      0,
    );

    return {
      totalPartners,
      activePartners,
      totalCommission,
      totalPaid,
      pendingPayout,
    };
  }, [partners]);

  return (
    <div className="space-y-6 text-left">
      <ErpPageHeader
        title="Quản lý Đối tác & Cộng tác viên"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {actions.configureCommission && (
              <button
                onClick={() => setShowLevelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-750 rounded-lg text-[11px] font-black transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-200/40"
              >
                <Landmark className="w-3.5 h-3.5 text-sky-600" />
                Cấu hình Level Hoa hồng
              </button>
            )}
            {actions.exportPartners && (
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-750 rounded-lg text-[11px] font-black transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-200/40"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Xuất Excel
              </button>
            )}
            {actions.importPartners && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-750 rounded-lg text-[11px] font-black transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-200/40"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                Nhập Excel
              </button>
            )}
            {actions.createPartner && (
              <ErpPrimaryButton
                onClick={() => {
                  setEditingPartner(null);
                  setShowAddModal(true);
                }}
              >
                Khai báo đối tác mới
              </ErpPrimaryButton>
            )}
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ErpStatCard
          name="Tổng số đối tác"
          value={`${stats.totalPartners}`}
          icon={Handshake}
          color="from-cyan-600 to-blue-500"
        />
        <ErpStatCard
          name="Đang hoạt động"
          value={`${stats.activePartners}`}
          icon={CheckCircle}
          color="from-emerald-600 to-teal-500"
        />
        <ErpStatCard
          name="Tổng hoa hồng"
          value={formatVND(String(stats.totalCommission))}
          icon={Wallet}
          color="from-indigo-600 to-purple-500"
        />
        <ErpStatCard
          name="Hoa hồng cần trả"
          value={formatVND(String(stats.pendingPayout))}
          icon={AlertCircle}
          color="from-rose-600 to-amber-500"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <ErpSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Tìm đối tác theo tên hoặc số điện thoại..."
        />

        <ErpFilterRail>
          <ErpFilterTab
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            Tất cả
          </ErpFilterTab>
          <ErpFilterTab
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
          >
            Đang hoạt động
          </ErpFilterTab>
          <ErpFilterTab
            active={statusFilter === "inactive"}
            onClick={() => setStatusFilter("inactive")}
          >
            Ngưng hoạt động
          </ErpFilterTab>
        </ErpFilterRail>
      </div>

      {/* Partners List Table */}
      <ErpCard className="overflow-hidden border border-slate-100">
        {loading && partners.length === 0 ? (
          <ErpLoadingState message="Đang tải danh sách đối tác..." />
        ) : partners.length === 0 ? (
          <ErpEmptyState
            icon={Handshake}
            title="Không tìm thấy đối tác nào"
            subtitle="Không có đối tác nào khớp với bộ lọc tìm kiếm hoặc chưa có đối tác nào được khai báo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-semibold">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2 px-3 text-left">Họ tên & SĐT</th>
                  <th className="py-2 px-3 text-left">Cấp bậc hoa hồng</th>
                  <th className="py-2 px-3 text-center">Đã giới thiệu</th>
                  <th className="py-2 px-3 text-right">Tổng hoa hồng</th>
                  <th className="py-2 px-3 text-right">Đã thanh toán</th>
                  <th className="py-2 px-3 text-right">Còn nợ</th>
                  <th className="py-2 px-3 text-center">Trạng thái</th>
                  <th className="py-2 px-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((partner) => (
                  <tr
                    key={partner._id}
                    className="hover:bg-slate-55/30 transition-all text-slate-700"
                  >
                    <td className="py-1.5 px-3">
                      <div className="text-[11px] font-bold text-slate-900">
                        {partner.name}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {partner.phone}
                      </div>
                    </td>
                    <td className="py-1.5 px-3">
                      {partner.levelName === "Mặc định" ? (
                        <>
                          <div className="text-[9px] font-black text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded-full inline-block">
                            Mặc định
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Tỷ lệ:{" "}
                            <span className="font-bold text-slate-700">1%</span>{" "}
                            {operationalCopy.isWorker
                              ? "giá trị giới thiệu"
                              : operationalCopy.isCustomer
                                ? "giá trị dịch vụ"
                                : "học phí"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] font-bold text-slate-900">
                            {partner.levelName}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Tỷ lệ:{" "}
                            <span className="font-bold text-slate-700">
                              {partner.commissionValue}%
                            </span>{" "}
                            {operationalCopy.isWorker
                              ? "giá trị giới thiệu"
                              : operationalCopy.isCustomer
                                ? "giá trị dịch vụ"
                                : "học phí"}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-center font-bold">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[9px]">
                        {partner.referredStudentsCount}{" "}
                        {operationalCopy.partnerReferralUnit}
                      </span>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {operationalCopy.partnerValueLabel}:{" "}
                        {formatVND(String(partner.totalReferredTuition || 0))}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-right text-[11px] font-black text-slate-800">
                      {formatVND(String(partner.totalCommission))}
                    </td>
                    <td className="py-1.5 px-3 text-right text-[11px] font-black text-emerald-600">
                      {formatVND(String(partner.totalPaid))}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 px-3 text-right text-[11px] font-black",
                        partner.unpaidBalance > 0
                          ? "text-rose-600"
                          : "text-slate-450",
                      )}
                    >
                      {formatVND(String(partner.unpaidBalance))}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold",
                          partner.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-400",
                        )}
                      >
                        {partner.isActive ? "Đang chạy" : "Tạm dừng"}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedPartnerId(partner._id)}
                          className="p-1 rounded-md text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 transition-all cursor-pointer"
                          title="Xem chi tiết & Lịch sử giới thiệu"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        {actions.editPartner && (
                          <button
                            onClick={() => {
                              setEditingPartner(partner);
                              setShowAddModal(true);
                            }}
                            className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                            title="Chỉnh sửa thông tin đối tác"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        )}
                        {actions.payCommission && partner.unpaidBalance > 0 && (
                          <button
                            onClick={() => setPayingPartner(partner)}
                            className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                            title="Chi trả tiền hoa hồng"
                          >
                            <Landmark className="w-3 h-3" />
                          </button>
                        )}
                        {actions.deletePartner && (
                          <button
                            onClick={() => setDeletingPartner(partner)}
                            className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="Xóa đối tác"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ErpCard>

      {/* Add / Edit Partner Modal */}
      {actions.createPartner && showAddModal && (
        <AddPartnerModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingPartner(null);
          }}
          onSuccess={fetchPartners}
          partner={editingPartner}
        />
      )}

      {/* Detail Modal */}
      {selectedPartnerId && (
        <PartnerDetailModal
          isOpen={!!selectedPartnerId}
          onClose={() => setSelectedPartnerId(null)}
          partnerId={selectedPartnerId}
          onMutation={fetchPartners}
          entityPreset={entityLabel.preset}
        />
      )}

      {/* Payout Modal */}
      {actions.payCommission && payingPartner && (
        <AddPayoutModal
          isOpen={!!payingPartner}
          onClose={() => setPayingPartner(null)}
          onSuccess={fetchPartners}
          partnerId={payingPartner._id}
          partnerName={payingPartner.name}
          unpaidBalance={payingPartner.unpaidBalance}
        />
      )}

      {/* Delete Confirmation Modal */}
      {actions.deletePartner && deletingPartner && (
        <ErpConfirmModal
          isOpen={!!deletingPartner}
          title="Xác nhận xóa đối tác"
          message={`Bạn có chắc chắn muốn xóa đối tác "${deletingPartner.name}" khỏi hệ thống? Lưu ý: chỉ có thể xóa đối tác chưa có bất kỳ lượt giới thiệu ${entityLabel.singular} nào.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingPartner(null)}
        />
      )}

      {/* Commission Level Modal */}
      {actions.configureCommission && (
        <CommissionLevelModal
          isOpen={showLevelModal}
          onClose={() => setShowLevelModal(false)}
          selectedCenter={selectedCenter}
        />
      )}

      {/* Import Partner Modal */}
      {actions.importPartners && showImportModal && (
        <ImportPartnerModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={fetchPartners}
        />
      )}
    </div>
  );
}
