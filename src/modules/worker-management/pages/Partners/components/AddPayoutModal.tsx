import React, { useState } from "react";
import { toast } from "../../../../../pages/Toast";
import { apiFetch } from "../../../lib/api";
import {
  ErpModal,
  ErpField,
  ErpInput,
  ErpSelect,
  ErpSubmitButton,
} from "../../../components/Erp/ErpUI";
import {
  formatVND,
  getBankDisplayName,
  getVietQRBankCode,
} from "../../../lib/utils";
import { Loader2, QrCode } from "lucide-react";

function removeVietnameseTones(str: string): string {
  let result = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/đ/g, "d").replace(/Đ/g, "D");
  // Keep only alphanumeric, spaces, and hyphens/underscores/slashes/dots
  result = result.replace(/[^a-zA-Z0-9\s-_/.]/g, "");
  // Replace multiple spaces with a single space
  result = result.replace(/\s+/g, " ");
  return result.trim().toUpperCase();
}

interface AddPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partnerId: string;
  partnerName: string;
  unpaidBalance: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
}

export function AddPayoutModal({
  isOpen,
  onClose,
  onSuccess,
  partnerId,
  partnerName,
  unpaidBalance,
  bankName,
  bankAccountNo,
  bankAccountName,
}: AddPayoutModalProps) {
  const [amount, setAmount] = useState(() => {
    return unpaidBalance > 0 ? formatVND(String(unpaidBalance)) : "";
  });
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState<"Tiền mặt" | "Chuyển khoản">(
    "Chuyển khoản",
  );
  const [note, setNote] = useState(() => {
    return removeVietnameseTones(`CHI TRA HOA HONG ${partnerName}`);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amount.replace(/\D/g, ""), 10) || 0;

    if (cleanAmount <= 0) {
      toast.error("Số tiền chi trả phải lớn hơn 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/partners/${partnerId}/payouts`, {
        method: "POST",
        body: JSON.stringify({
          amount: cleanAmount,
          date: date.split("-").reverse().join("/"), // Convert YYYY-MM-DD to DD/MM/YYYY
          method,
          note,
        }),
      });

      if (res.success) {
        toast.success(
          `Đã chi trả thành công ${formatVND(String(cleanAmount))} cho ${partnerName}!`,
        );
        onSuccess();
        onClose();
        // Reset form
        setAmount("");
        setNote(removeVietnameseTones(`CHI TRA HOA HONG ${partnerName}`));
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi chi trả hoa hồng.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(formatVND(value));
  };

  if (!isOpen) return null;

  return (
    <ErpModal
      title={`Chi trả hoa hồng - ${partnerName}`}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="p-4 bg-cyan-50/50 border border-cyan-100 rounded-2xl flex justify-between items-center text-xs font-bold text-slate-800">
          <span>Còn nợ hoa hồng:</span>
          <span className="text-sm font-black text-cyan-600">
            {formatVND(String(unpaidBalance))}
          </span>
        </div>

        <ErpField label="Số tiền thanh toán (VND) *">
          <ErpInput
            type="text"
            required
            value={amount}
            onChange={handleAmountChange}
            placeholder="Nhập số tiền..."
          />
        </ErpField>

        <ErpField label="Ngày thanh toán *">
          <ErpInput
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </ErpField>

        <ErpField label="Phương thức *">
          <ErpSelect
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as "Tiền mặt" | "Chuyển khoản")
            }
          >
            <option value="Chuyển khoản">Chuyển khoản (Ngân hàng)</option>
            <option value="Tiền mặt">Tiền mặt</option>
          </ErpSelect>
        </ErpField>

        <ErpField label="Nội dung chi trả / Ghi chú">
          <ErpInput
            type="text"
            value={note}
            onChange={(e) => setNote(removeVietnameseTones(e.target.value))}
            placeholder="Nội dung ghi chú..."
          />
        </ErpField>

        {method === "Chuyển khoản" &&
          (bankAccountNo && bankName ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-cyan-600" /> Quét mã
                  chuyển khoản hoa hồng (VietQR)
                </span>
                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  Tự động điền số tiền
                </span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="bg-white p-2 border border-slate-100 rounded-xl shrink-0 flex items-center justify-center">
                  <img
                    src={`https://img.vietqr.io/image/${getVietQRBankCode(bankName)}-${bankAccountNo}-compact2.png?amount=${amount.replace(/\D/g, "") || "0"}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(bankAccountName || "")}`}
                    alt="VietQR Chuyển khoản"
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <div className="text-xs space-y-1.5 select-all flex-1 min-w-0">
                  <p className="font-medium text-slate-500">
                    Ngân hàng:{" "}
                    <span className="text-slate-800 font-bold uppercase">
                      {getBankDisplayName(bankName)}
                    </span>
                  </p>
                  <p className="font-medium text-slate-500">
                    Số tài khoản:{" "}
                    <span className="text-slate-800 font-bold">
                      {bankAccountNo}
                    </span>
                  </p>
                  <p className="font-medium text-slate-500">
                    Chủ tài khoản:{" "}
                    <span className="text-slate-800 font-bold uppercase">
                      {bankAccountName || "N/A"}
                    </span>
                  </p>
                  <p className="font-medium text-slate-500 flex flex-col gap-0.5">
                    <span>Nội dung chuyển khoản QR:</span>
                    <span className="bg-slate-200/80 text-slate-800 font-mono px-1.5 py-0.5 rounded text-[10px] font-semibold break-all inline-block select-all">
                      {note || "(Trống)"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700 font-bold">
              CTV này chưa cập nhật tài khoản ngân hàng. Hãy cập nhật trong
              thông tin CTV để dùng mã QR chuyển khoản hoa hồng.
            </div>
          ))}

        <ErpSubmitButton disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang thực hiện...
            </span>
          ) : (
            "Xác nhận chi trả"
          )}
        </ErpSubmitButton>
      </form>
    </ErpModal>
  );
}
