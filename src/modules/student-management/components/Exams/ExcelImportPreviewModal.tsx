import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PreviewStudent {
  phone: string;
  fullName: string;
  rank?: string;
  overallResult: string;
  theory?: number;
  practice?: number;
  simulation?: number;
}

export interface InvalidStudent {
  phone: string;
  fullName: string;
  reason: string;
}

interface ExcelImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  validList: PreviewStudent[];
  invalidList: InvalidStudent[];
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

export function ExcelImportPreviewModal({
  isOpen,
  onClose,
  validList,
  invalidList,
  onConfirm,
  isSubmitting
}: ExcelImportPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid');

  // Automatically switch tab if one list is empty
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (validList.length === 0 && invalidList.length > 0) {
          setActiveTab('invalid');
        } else {
          setActiveTab('valid');
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [validList.length, invalidList.length, isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800">Kết quả kiểm tra dữ liệu Excel</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Vui lòng kiểm tra lại danh sách trước khi đưa lên hệ thống</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs header */}
          <div className="flex border-b border-slate-100 px-6 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('valid')}
              className={cn(
                "flex items-center gap-2 py-4 px-4 text-sm font-bold border-b-2 transition-all outline-none",
                activeTab === 'valid'
                  ? "border-cyan-600 text-cyan-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Đủ điều kiện ({validList.length})
            </button>
            <button
              onClick={() => setActiveTab('invalid')}
              className={cn(
                "flex items-center gap-2 py-4 px-4 text-sm font-bold border-b-2 transition-all outline-none",
                activeTab === 'invalid'
                  ? "border-rose-500 text-rose-500"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Không đủ điều kiện ({invalidList.length})
            </button>
          </div>

          {/* Content list */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
            {activeTab === 'valid' ? (
              validList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic text-sm">
                  Không có học viên nào đủ điều kiện nhập.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Họ và tên</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-center">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {validList.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-extrabold text-slate-700">{s.fullName}</td>
                          <td className="px-4 py-3 font-bold text-slate-500">{s.phone}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                              s.overallResult === 'Đậu' && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                              s.overallResult === 'Trượt' && "bg-rose-50 text-rose-700 border border-rose-100",
                              s.overallResult === 'Chưa có' && "bg-slate-50 text-slate-600 border border-slate-150"
                            )}>
                              {s.overallResult}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              invalidList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic text-sm">
                  Không có dòng lỗi nào.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Học viên</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Lý do lỗi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invalidList.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 bg-rose-50/10">
                          <td className="px-4 py-3 font-bold text-slate-700">{s.fullName}</td>
                          <td className="px-4 py-3 font-bold text-slate-500">{s.phone}</td>
                          <td className="px-4 py-3 font-extrabold text-rose-600">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-5 border-t border-slate-100 flex items-center gap-4 bg-slate-50/30">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-black transition-all active:scale-95"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={validList.length === 0 || isSubmitting}
              className="flex-[2] flex items-center justify-center gap-2 h-12 bg-cyan-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Xác nhận thêm vào đợt thi ({validList.length})
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
