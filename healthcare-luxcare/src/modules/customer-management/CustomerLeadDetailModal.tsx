import React, { useState } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Tag,
  Building2,
  Calendar,
  MessageSquare,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";

export interface ContactHistoryItem {
  date: string | Date;
  note: string;
  status: string;
  updatedBy?: {
    displayName?: string;
    email?: string;
  } | null;
}

export interface CustomerLeadItem {
  _id: string;
  companyCode: string;
  branchId?: string | null;
  branchCode?: string;
  branchName?: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  source: string;
  qrCampaign?: string;
  status: "new" | "contacted" | "in_consultation" | "converted" | "cancelled";
  assignedTo?: {
    _id?: string;
    displayName?: string;
    email?: string;
  } | null;
  contactHistory?: ContactHistoryItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface CustomerLeadDetailModalProps {
  lead: CustomerLeadItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STATUS_CONFIG: Record<
  CustomerLeadItem["status"],
  { label: string; bg: string; text: string; border: string }
> = {
  new: { label: "Mới tiếp nhận", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  contacted: { label: "Đã liên hệ", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  in_consultation: { label: "Đang tư vấn", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  converted: { label: "Thành công", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  cancelled: { label: "Đã hủy", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

export default function CustomerLeadDetailModal({
  lead,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: CustomerLeadDetailModalProps) {
  const [currentStatus, setCurrentStatus] = useState<CustomerLeadItem["status"]>(lead?.status || "new");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (lead) {
      setCurrentStatus(lead.status);
      setNewNote("");
      setErrorMsg(null);
      setConfirmDeleteOpen(false);
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleSaveStatusAndNote = async () => {
    if (currentStatus === lead.status && !newNote.trim()) {
      onClose();
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onUpdate(lead._id, {
        status: currentStatus,
        addNote: newNote.trim() || undefined,
      });
      setNewNote("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi cập nhật thông tin khách hàng");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);
    try {
      await onDelete(lead._id);
      setConfirmDeleteOpen(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi xóa khách hàng");
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white font-bold text-base shadow-sm">
              {lead.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{lead.fullName}</h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tiếp nhận lúc: {new Date(lead.createdAt).toLocaleString("vi-VN")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Khối thông tin liên hệ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-2xl bg-slate-50/80 p-4 border border-slate-100 text-xs">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Phone className="h-4 w-4 text-teal-600 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Số điện thoại:</span>
                <a href={`tel:${lead.phone}`} className="font-semibold text-teal-700 hover:underline">
                  {lead.phone}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700">
              <Mail className="h-4 w-4 text-teal-600 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Email:</span>
                <span className="font-medium text-slate-800">{lead.email || "Chưa cung cấp"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700">
              <Building2 className="h-4 w-4 text-teal-600 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Cơ sở / Chi nhánh:</span>
                <span className="font-medium text-slate-800">
                  {lead.branchName ? `${lead.branchName} (${lead.branchCode || ""})` : "Toàn hệ thống"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700">
              <Tag className="h-4 w-4 text-teal-600 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Nguồn thu thập:</span>
                <span className="font-medium text-slate-800">
                  {lead.source === "qr_code" ? `Mã QR (${lead.qrCampaign || "Trực tiếp"})` : "Thêm thủ công"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700 sm:col-span-2">
              <Clock className="h-4 w-4 text-teal-600 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Khung giờ tiện liên hệ:</span>
                <span className="font-medium text-slate-800">{lead.preferredContactTime || "Bất kỳ lúc nào"}</span>
              </div>
            </div>

            {lead.address && (
              <div className="flex items-center gap-2.5 text-slate-700 sm:col-span-2">
                <MapPin className="h-4 w-4 text-teal-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Địa chỉ:</span>
                  <span className="font-medium text-slate-800">{lead.address}</span>
                </div>
              </div>
            )}
          </div>

          {/* Dịch vụ & Ghi chú từ khách */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nhu cầu & Dịch vụ quan tâm
            </h3>
            <p className="text-sm font-semibold text-teal-900">
              {lead.serviceInterest || "Tư vấn tổng quát"}
            </p>
            {lead.notes && (
              <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100">
                <span className="font-semibold block text-slate-500 mb-0.5">Lời nhắn của khách hàng:</span>
                {lead.notes}
              </div>
            )}
          </div>

          {/* Cập nhật trạng thái xử lý */}
          <div className="rounded-2xl border border-teal-100 bg-teal-50/30 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
              Cập nhật tiến trình tư vấn
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(Object.keys(STATUS_CONFIG) as Array<CustomerLeadItem["status"]>).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setCurrentStatus(st)}
                  className={`rounded-xl py-2 px-2.5 text-center text-xs font-semibold transition-all border ${
                    currentStatus === st
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {STATUS_CONFIG[st].label}
                </button>
              ))}
            </div>

            {/* Thêm ghi chú trao đổi */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Ghi chú trao đổi mới (lưu vào nhật ký)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ví dụ: Đã gọi điện lần 1, khách hẹn cuối tuần tới cơ sở..."
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Lịch sử trao đổi / Nhật ký chăm sóc */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nhật ký chăm sóc ({lead.contactHistory?.length || 0})
            </h3>
            {lead.contactHistory && lead.contactHistory.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {lead.contactHistory
                  .slice()
                  .reverse()
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{new Date(item.date).toLocaleString("vi-VN")}</span>
                        <span className="font-medium text-slate-600">
                          {item.updatedBy?.displayName || "Hệ thống"}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">{item.note}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa có nhật ký trao đổi nào.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleting}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" /> {deleting ? "Đang xóa..." : "Xóa khách hàng"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveStatusAndNote}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => {
          if (!deleting) setConfirmDeleteOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        title="Xóa khách hàng?"
        description={`Bạn có chắc chắn muốn xóa khách hàng "${lead.fullName}" không? Dữ liệu này sẽ không thể khôi phục.`}
        confirmLabel="Xóa khách hàng"
        cancelLabel="Hủy"
        tone="danger"
        isSubmitting={deleting}
      />
    </div>
  );
}
