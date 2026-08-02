import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar,
  FileText,
  Loader2,
  Save,
  CreditCard,
  QrCode,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Student } from "../../types";
import { useAuth } from "../../../../context/AuthContext";
import { toast } from "../../../../pages/Toast";
import { getVietQRBankCode, toDisplayDate } from "../../lib/utils";

const BANK_NAMES: Record<string, string> = {
  mbbank: "MBBank",
  vietcombank: "Vietcombank",
  techcombank: "Techcombank",
  vietinbank: "Vietinbank",
  bidv: "BIDV",
  agribank: "Agribank",
  acb: "ACB",
  sacombank: "Sacombank",
  tpbank: "TPBank",
  vpbank: "VPBank",
};

function removeVietnameseTones(str: string): string {
  let result = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(//g, "d").replace(//g, "D");
  result = result.replace(/[^a-zA-Z0-9\s-_/.]/g, "");
  result = result.replace(/\s+/g, " ");
  return result.trim().toUpperCase();
}

function getLocalVietQrConfig() {
  const saved = localStorage.getItem("vietqrConfig");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as {
      bankId?: string;
      accountNo?: string;
      accountName?: string;
      enabled?: boolean;
      template?: string;
    };
  } catch {
    return null;
  }
}

interface AddPaymentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentModal({
  student,
  isOpen,
  onClose,
  onSuccess,
}: AddPaymentModalProps) {
  const { userProfile } = useAuth();
  const user = userProfile as any;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [vietqrConfig, setVietqrConfig] = useState(() => {
    const localConfig = getLocalVietQrConfig();
    const bankId = localConfig?.bankId || user?.bankId || "";
    const accountNo = localConfig?.accountNo || user?.bankAccountNo || "";
    const accountName =
      localConfig?.accountName ||
      user?.bankAccountName ||
      user?.displayName ||
      "";
    const enabled = localConfig?.enabled ?? user?.bankQrEnabled !== false;
    const template =
      localConfig?.template || "[Mã HV] - [Họ tên] - Nộp học phí khóa {hang}";
    return { enabled, bankId, accountNo, accountName, template };
  });

  React.useEffect(() => {
    if (!isOpen) return;
    const localConfig = getLocalVietQrConfig();
    setVietqrConfig({
      enabled: localConfig?.enabled ?? user?.bankQrEnabled !== false,
      bankId: localConfig?.bankId || user?.bankId || "",
      accountNo: localConfig?.accountNo || user?.bankAccountNo || "",
      accountName:
        localConfig?.accountName ||
        user?.bankAccountName ||
        user?.displayName ||
        "",
      template:
        localConfig?.template || "[Mã HV] - [Họ tên] - Nộp học phí khóa {hang}",
    });
  }, [isOpen, user]);

  React.useEffect(() => {
    if (isOpen && student) {
      const timer = setTimeout(() => {
        const totalFee = parseInt(student.fee.replace(/\D/g, ""));
        const remaining = totalFee - (student.paidAmount || 0);
        if (remaining > 0) {
          setAmount(new Intl.NumberFormat("vi-VN").format(remaining));
        } else {
          setAmount("");
        }

        if (vietqrConfig.enabled && vietqrConfig.template) {
          const compiled = vietqrConfig.template
            .replace(
              /\[Mã HV\]|\[Ma HV\]/gi,
              student.id || student.idCard || "",
            )
            .replace(/\[Họ tên\]|\[Ho ten\]/gi, student.fullName || "")
            .replace(/\{hang\}|\{rank\}/gi, student.rank || "");
          setNote(removeVietnameseTones(compiled));
        } else {
          setNote("");
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, student, vietqrConfig]);

  if (!isOpen || !student || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !student) return;

    try {
      const rawAmount = amount.replace(/\D/g, "");
      const rawFee = (student.fee || "0").replace(/\D/g, "");
      const payAmount = parseInt(rawAmount, 10);
      const totalFee = parseInt(rawFee, 10);
      const paidSoFar = student.paidAmount || 0;
      const remaining = totalFee - paidSoFar;

      if (isNaN(payAmount) || payAmount <= 0) {
        toast.warning("Vui lòng nhập số tiền hợp lệ");
        return;
      }

      if (payAmount > remaining) {
        toast.warning(
          "Số tiền đóng vượt quá số tiền còn nợ. Vui lòng kiểm tra lại!",
        );
        return;
      }

      setIsSubmitting(true);

      await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.fullName,
          amount: payAmount,
          date: toDisplayDate(date),
          note: note.trim(),
        }),
      });

      window.dispatchEvent(new Event("payment-mutation"));
      window.dispatchEvent(new Event("student-mutation"));

      toast.success("Ghi nhận thanh toán thành công!");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Payment Submission Error:", error);
      toast.error(
        "Đã có lỗi xảy ra khi ghi nhận thanh toán: " +
          (error instanceof Error ? error.message : "Lỗi không xác định"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatInputCurrency = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) return "";
    return new Intl.NumberFormat("vi-VN").format(parseInt(raw));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h3 className="text-xl font-extrabold text-slate-800">
              Thanh toán học phí
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-6 overflow-y-auto no-scrollbar"
          >
            <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100/50 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 leading-none">
                  {student.fullName}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 ">
                  <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">
                    Học phí: {student.fee}đ
                  </p>
                  <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-300" />
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                    Còn nợ:{" "}
                    {new Intl.NumberFormat("vi-VN").format(
                      parseInt(student.fee.replace(/\D/g, "")) -
                        (student.paidAmount || 0),
                    )}
                    đ
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Số tiền đóng (VNĐ)*
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={amount}
                    onChange={(e) =>
                      setAmount(formatInputCurrency(e.target.value))
                    }
                    placeholder="VD: 5.000.000"
                    className="w-full h-14 bg-slate-50 px-5 rounded-2xl border border-slate-200 text-lg font-black text-cyan-600 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    VNĐ
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Ngày đóng
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-14 bg-slate-50 px-5 rounded-2xl border border-slate-200 text-base font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all"
                  />
                  <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Ghi chú
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Đóng đợt 1, chuyển khoản..."
                    className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all resize-none"
                  />
                  <FileText className="absolute right-5 top-5 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {vietqrConfig.enabled &&
                vietqrConfig.bankId &&
                vietqrConfig.accountNo &&
                (() => {
                  const qrCodeMemo = (() => {
                    let m = note;
                    const objectIdRegex = /[0-9a-fA-F]{24}/;
                    if (student.id && !objectIdRegex.test(m)) {
                      m = `${m} ${student.id}`.trim();
                    }
                    return m;
                  })();

                  return (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-cyan-600" /> Quét
                          mã thanh toán (VietQR)
                        </span>
                        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                          Tự động điền số tiền
                        </span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="bg-white p-2 border border-slate-100 rounded-xl shrink-0 flex items-center justify-center">
                          <img
                            src={`https://img.vietqr.io/image/${getVietQRBankCode(vietqrConfig.bankId)}-${vietqrConfig.accountNo}-compact2.png?amount=${amount.replace(/\D/g, "") || "0"}&addInfo=${encodeURIComponent(qrCodeMemo)}&accountName=${encodeURIComponent(vietqrConfig.accountName)}`}
                            alt="VietQR Chuyển khoản"
                            className="w-24 h-24 object-contain"
                          />
                        </div>
                        <div className="text-xs space-y-1.5 select-all flex-1 min-w-0">
                          <p className="font-medium text-slate-500">
                            Ngân hàng:{" "}
                            <span className="text-slate-800 font-bold uppercase">
                              {BANK_NAMES[vietqrConfig.bankId] ||
                                vietqrConfig.bankId.toUpperCase()}
                            </span>
                          </p>
                          <p className="font-medium text-slate-500">
                            Số tài khoản:{" "}
                            <span className="text-slate-800 font-bold">
                              {vietqrConfig.accountNo}
                            </span>
                          </p>
                          <p className="font-medium text-slate-500">
                            Chủ tài khoản:{" "}
                            <span className="text-slate-800 font-bold uppercase">
                              {vietqrConfig.accountName}
                            </span>
                          </p>
                          <p className="font-medium text-slate-500 flex flex-col gap-0.5">
                            <span>Nội dung chuyển khoản QR:</span>
                            <span className="bg-slate-200/80 text-slate-800 font-mono px-1.5 py-0.5 rounded text-[10px] font-semibold break-all inline-block select-all">
                              {qrCodeMemo || "(Trống)"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl text-base font-black hover:bg-slate-200 transition-all"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] flex items-center justify-center gap-3 h-14 bg-cyan-600 text-white rounded-2xl text-base font-black shadow-xl shadow-cyan-100 hover:bg-cyan-700 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Xác nhận
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
