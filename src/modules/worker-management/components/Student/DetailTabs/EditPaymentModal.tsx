import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { toInputDate } from "../../../lib/utils";

interface EditingPaymentData {
  index: number;
  id: string;
  amount: string;
  date: string;
  note: string;
  method: "Tiền mặt" | "Chuyển khoản";
  recipient: string;
}

interface EditPaymentModalProps {
  editingPayment: EditingPaymentData | null;
  setEditingPayment: React.Dispatch<
    React.SetStateAction<EditingPaymentData | null>
  >;
  handleSavePaymentEdit: () => Promise<void>;
}

export function EditPaymentModal({
  editingPayment,
  setEditingPayment,
  handleSavePaymentEdit,
}: EditPaymentModalProps) {
  return (
    <AnimatePresence>
      {editingPayment && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingPayment(null)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-[81]"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-extrabold text-slate-800">
                Chỉnh sửa đợt thanh toán
              </h3>
              <button
                onClick={() => setEditingPayment(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Số tiền đóng (VNĐ)*
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editingPayment.amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        const formatted = raw
                          ? new Intl.NumberFormat("vi-VN").format(parseInt(raw))
                          : "";
                        setEditingPayment((prev) =>
                          prev ? { ...prev, amount: formatted } : null,
                        );
                      }}
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
                      value={toInputDate(editingPayment.date)}
                      onChange={(e) => {
                        setEditingPayment((prev) =>
                          prev ? { ...prev, date: e.target.value } : null,
                        );
                      }}
                      className="w-full h-14 bg-slate-50 px-5 rounded-2xl border border-slate-200 text-base font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Phương thức
                  </label>
                  <select
                    value={editingPayment.method}
                    onChange={(e) =>
                      setEditingPayment((prev) =>
                        prev
                          ? {
                              ...prev,
                              method: e.target.value as
                                | "Tiền mặt"
                                | "Chuyển khoản",
                            }
                          : null,
                      )
                    }
                    className="w-full h-14 bg-slate-50 px-5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all"
                  >
                    <option value="Chuyển khoản">Chuyển khoản</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Ghi chú
                  </label>
                  <textarea
                    rows={3}
                    value={editingPayment.note}
                    onChange={(e) =>
                      setEditingPayment((prev) =>
                        prev ? { ...prev, note: e.target.value } : null,
                      )
                    }
                    placeholder="Ghi chú đóng tiền..."
                    className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl text-base font-black hover:bg-slate-200 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSavePaymentEdit}
                  className="flex-[2] h-14 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl text-base font-black shadow-xl shadow-cyan-100 transition-all"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
