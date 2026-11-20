import React, { useState } from "react";
import { X, User, Phone, Mail, MapPin, Clock, Tag, Building2, UserPlus, AlertCircle } from "lucide-react";

interface BranchItem {
  _id: string;
  code: string;
  name: string;
}

interface CustomerLeadCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchItem[];
  defaultBranchId?: string;
  onCreate: (payload: any) => Promise<void>;
}

export default function CustomerLeadCreateModal({
  isOpen,
  onClose,
  branches,
  defaultBranchId,
  onCreate,
}: CustomerLeadCreateModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId || "");
  const [serviceInterest, setServiceInterest] = useState("Khám & Tư vấn tổng quát");
  const [preferredContactTime, setPreferredContactTime] = useState("Bất kỳ lúc nào");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<"manual" | "website" | "referral">("manual");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setFullName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setBranchId(defaultBranchId || "");
      setServiceInterest("Khám & Tư vấn tổng quát");
      setPreferredContactTime("Bất kỳ lúc nào");
      setNotes("");
      setSource("manual");
      setErrorMsg(null);
    }
  }, [isOpen, defaultBranchId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim().replace(/[\s.-]/g, "");

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg("Vui lòng nhập họ và tên (tối thiểu 2 ký tự).");
      return;
    }

    const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      setErrorMsg("Số điện thoại không hợp lệ (Ví dụ: 0912345678).");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        branchId: branchId || undefined,
        serviceInterest: serviceInterest.trim() || undefined,
        preferredContactTime: preferredContactTime || undefined,
        notes: notes.trim() || undefined,
        source,
        qrCampaign: source === "manual" ? "Tạo thủ công tại quầy" : "Khách giới thiệu",
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi tạo mới khách hàng");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thêm Khách Hàng Mới</h2>
              <p className="text-xs text-slate-500">Ghi nhận thông tin khách hàng gọi điện hoặc tới quầy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Họ và tên */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Họ và tên <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-3.5 w-3.5" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Trần Văn Cường"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Số điện thoại <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cuong@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Chi nhánh */}
            {branches.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chi nhánh tiếp nhận</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
                >
                  <option value="">-- Toàn hệ thống --</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Nguồn */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nguồn tiếp nhận</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
              >
                <option value="manual">Đến quầy / Gọi hotline</option>
                <option value="referral">Người quen giới thiệu</option>
                <option value="website">Website doanh nghiệp</option>
              </select>
            </div>

            {/* Dịch vụ quan tâm */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nhu cầu & Dịch vụ quan tâm</label>
              <input
                type="text"
                value={serviceInterest}
                onChange={(e) => setServiceInterest(e.target.value)}
                placeholder="Ví dụ: Khám tổng quát, Mua máy đo huyết áp..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Địa chỉ */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Địa chỉ</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, đường, quận/huyện..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Ghi chú */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Ghi chú tiếp nhận ban đầu</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thông tin thêm về tình trạng, nhu cầu của khách hàng..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {submitting ? "Đang lưu..." : "Tạo khách hàng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
