import React, { useState } from "react";
import { Flag, ShieldAlert, Ban, X, CheckCircle, AlertTriangle, UserCheck, Loader2 } from "lucide-react";

export interface ReportTarget {
  reportedUserId: string;
  reportedUserName: string;
  roomId: string;
  messageId?: string;
  messageSnippet?: string;
}

export interface BlockTarget {
  userId: string;
  userName: string;
}

interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReportTarget | null;
  onSubmit: (data: {
    reportedUserId: string;
    roomId: string;
    messageId?: string;
    reason: "spam" | "harassment" | "inappropriate" | "fraud" | "other";
    details?: string;
  }) => Promise<void>;
}

const REPORT_REASONS = [
  { value: "harassment", label: "Quấy rối, xúc phạm hoặc đe dọa", desc: "Ngôn từ gây thù ghét, quấy rối hoặc bạo lực tinh thần" },
  { value: "inappropriate", label: "Nội dung nhạy cảm hoặc không phù hợp", desc: "Hình ảnh/video đồi trụy, bạo lực hoặc trái thuần phong mỹ tục" },
  { value: "spam", label: "Tin nhắn rác hoặc quảng cáo phiền toái", desc: "Gửi liên tục nội dung spam, quảng cáo không mong muốn" },
  { value: "fraud", label: "Lừa đảo hoặc giả mạo người khác", desc: "Hành vi lừa đảo thông tin, tài sản hoặc mạo danh đồng nghiệp" },
  { value: "other", label: "Lý do khác", desc: "Các hành vi vi phạm tiêu chuẩn cộng đồng khác" },
] as const;

export function ReportContentModal({ isOpen, onClose, target, onSubmit }: ReportContentModalProps) {
  const [selectedReason, setSelectedReason] = useState<"spam" | "harassment" | "inappropriate" | "fraud" | "other">("harassment");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit({
        reportedUserId: target.reportedUserId,
        roomId: target.roomId,
        messageId: target.messageId,
        reason: selectedReason,
        details: details.trim(),
      });
      onClose();
    } catch {
      // error handled in caller toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-150 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5 text-rose-600">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Báo cáo vi phạm (Guideline 1.2)</h3>
              <p className="text-[11px] text-slate-500">Giữ môi trường giao tiếp an toàn, văn minh</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Target info preview */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
            <p className="text-slate-500">
              Đối tượng bị báo cáo: <strong className="text-slate-800">{target.reportedUserName}</strong>
            </p>
            {target.messageSnippet && (
              <p className="text-slate-650 bg-white border border-slate-200 rounded-lg p-2 italic text-[11px] line-clamp-2">
                &ldquo;{target.messageSnippet}&rdquo;
              </p>
            )}
          </div>

          {/* Reason selection */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-700">Lý do báo cáo vi phạm *</label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => {
                const checked = selectedReason === r.value;
                return (
                  <label
                    key={r.value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                      checked
                        ? "bg-rose-50/60 border-rose-400 ring-1 ring-rose-300"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.value}
                      checked={checked}
                      onChange={() => setSelectedReason(r.value)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-xs">{r.label}</p>
                      <p className="text-[10px] text-slate-500">{r.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Detailed note */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Mô tả thêm (không bắt buộc)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Cung cấp thêm chi tiết để ban quản trị đối soát nhanh chóng..."
              rows={2}
              maxLength={1000}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
            />
          </div>

          {/* SLA disclaimer */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-start gap-2 text-[11px] text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Báo cáo của bạn được gửi trực tiếp đến ban quản trị nội bộ. Chúng tôi cam kết đối soát và xử lý các vi phạm trong vòng <strong>24 giờ</strong>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-150">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-100 font-semibold transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              Gửi báo cáo vi phạm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BlockConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: BlockTarget | null;
  onConfirm: (userId: string) => Promise<void>;
}

export function BlockConfirmModal({ isOpen, onClose, target, onConfirm }: BlockConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !target) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm(target.userId);
      onClose();
    } catch {
      // error handled in caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-left">
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base">
              Chặn người dùng {target.userName}?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sau khi chặn, toàn bộ tin nhắn từ <strong className="text-slate-700">{target.userName}</strong> sẽ được ẩn và hai bên sẽ không thể nhắn tin trực tiếp cho nhau.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500 text-left">
            <p>• Tin nhắn của người này sẽ không còn hiển thị với bạn.</p>
            <p>• Người này không nhận được thông báo rằng họ đã bị chặn.</p>
            <p>• Bạn có thể mở khóa / bỏ chặn người này bất kỳ lúc nào.</p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-100 font-semibold text-xs transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Xác nhận chặn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockedList: Array<{ blockId: string; blockedUser: any; reason: string; createdAt: string }>;
  onUnblock: (userId: string) => Promise<void>;
  loading: boolean;
}

export function BlockedUsersModal({ isOpen, onClose, blockedList, onUnblock, loading }: BlockedUsersModalProps) {
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUnblock = async (userId: string) => {
    try {
      setUnblockingId(userId);
      await onUnblock(userId);
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-left flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-150 px-6 py-4 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Danh sách người dùng đã chặn</h3>
              <p className="text-[11px] text-slate-500">{blockedList.length} người dùng đang bị chặn</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin mb-2 text-indigo-600" />
              <p className="text-xs">Đang tải danh sách chặn...</p>
            </div>
          ) : blockedList.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Bạn chưa chặn người dùng nào</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Nếu gặp người dùng quấy rối hoặc gửi nội dung phản cảm, bạn có thể chọn chặn họ trong cuộc trò chuyện.
              </p>
            </div>
          ) : (
            blockedList.map((item) => {
              const u = item.blockedUser || {};
              const targetId = String(u._id || u.uid || item.blockId);
              const isProcessing = unblockingId === targetId;

              return (
                <div
                  key={item.blockId}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0 overflow-hidden border border-slate-200">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (u.displayName || "U").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="font-bold text-slate-800 truncate">{u.displayName || u.email || "Người dùng"}</p>
                      <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(targetId)}
                    disabled={isProcessing}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-650 text-xs font-semibold transition shrink-0 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                    Bỏ chặn
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-150 px-6 py-3 bg-slate-50/70 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
