import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { toInputDate } from '../../../lib/utils';
import { VietnameseDatePicker } from '../../Batches/VietnameseDatePicker';
import { RoadmapPicker } from '../../ui/RoadmapPicker';

interface EditingPaymentData {
  index: number;
  id: string;
  amount: string;
  date: string;
  note: string;
  method: 'Tiền mặt' | 'Chuyển khoản';
  recipient: string;
}

interface EditPaymentModalProps {
  editingPayment: EditingPaymentData | null;
  setEditingPayment: React.Dispatch<React.SetStateAction<EditingPaymentData | null>>;
  handleSavePaymentEdit: () => Promise<void>;
}

export function EditPaymentModal({
  editingPayment,
  setEditingPayment,
  handleSavePaymentEdit
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
            className="relative z-[81] flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-sky-100 px-5 py-4">
              <h3 className="border-l-4 border-brand-primary pl-3 text-base font-medium text-slate-900">Chỉnh sửa đợt thanh toán</h3>
              <button onClick={() => setEditingPayment(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5 no-scrollbar">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-normal text-slate-700">Số tiền đóng (VNĐ) *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editingPayment.amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const formatted = raw ? new Intl.NumberFormat('vi-VN').format(parseInt(raw)) : '';
                        setEditingPayment((prev) => prev ? { ...prev, amount: formatted } : null);
                      }}
                      placeholder="VD: 5.000.000"
                      className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 pr-12 text-sm font-medium text-brand-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-500">VNĐ</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-normal text-slate-700">Ngày đóng</label>
                  <VietnameseDatePicker ariaLabel="Ngày đóng" required value={toInputDate(editingPayment.date)} onChange={(value) => setEditingPayment((prev) => prev ? { ...prev, date: value } : null)} selectionOnly variant="filter" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-normal text-slate-700">Phương thức</label>
                  <RoadmapPicker value={editingPayment.method} placeholder="Chọn phương thức" allowClear={false} options={[{ value: 'Chuyển khoản', label: 'Chuyển khoản' }, { value: 'Tiền mặt', label: 'Tiền mặt' }]} onChange={(value) => setEditingPayment((prev) => prev ? { ...prev, method: value as 'Tiền mặt' | 'Chuyển khoản' } : null)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-normal text-slate-700">Ghi chú</label>
                  <textarea
                    rows={2}
                    value={editingPayment.note}
                    onChange={(e) => setEditingPayment((prev) => prev ? { ...prev, note: e.target.value } : null)}
                    placeholder="Ghi chú đóng tiền..."
                    className="w-full resize-none rounded-xl border border-sky-100 bg-white p-3 text-sm font-normal text-slate-800 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-sky-100 pt-4">
                <button
                  type="button"
                  onClick={handleSavePaymentEdit}
                  className="h-9 rounded-xl bg-brand-primary px-5 text-xs font-medium text-white transition-colors hover:bg-brand-primary/90"
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
