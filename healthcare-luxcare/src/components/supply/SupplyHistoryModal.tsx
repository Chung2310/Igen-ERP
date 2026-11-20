import React from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, X } from "lucide-react";
import type { SupplyItem, SupplyTransaction } from "../../types/supply";

interface Props {
  isOpen: boolean;
  supply: SupplyItem | null;
  transactions: SupplyTransaction[];
  loading: boolean;
  onClose: () => void;
}

export const SupplyHistoryModal: React.FC<Props> = ({
  isOpen,
  supply,
  transactions,
  loading,
  onClose,
}) => {
  if (!isOpen || !supply) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-slate-100 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Lịch sử Xuất / Nhập kho: {supply.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{supply.code}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
              Đang tải lịch sử...
            </div>
          ) : transactions.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">Chưa có phát sinh giao dịch nào.</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx._id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    {tx.type === "in" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                        <ArrowDownRight className="w-3 h-3" />
                        Nhập kho: +{tx.quantity} {supply.unit}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-[11px]">
                        <ArrowUpRight className="w-3 h-3" />
                        Xuất dùng: -{tx.quantity} {supply.unit}
                      </span>
                    )}
                    <span className="text-slate-400">
                      {new Date(tx.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className="text-slate-700 mt-1">
                    {tx.type === "out" && tx.recipientDepartment && (
                      <span className="font-semibold text-slate-900 mr-2">
                        Tiếp nhận: {tx.recipientDepartment}
                      </span>
                    )}
                    {tx.reason}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    Người thực hiện: {tx.performerName} · Tồn sau: {tx.balanceAfter} {supply.unit}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
