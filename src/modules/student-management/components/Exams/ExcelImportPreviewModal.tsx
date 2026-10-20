import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEntityLabel } from '../../hooks/useEntityLabel';

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
  const entityLabel = useEntityLabel();
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
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-medium text-slate-900 before:w-1 before:h-5 before:rounded-full before:bg-brand-primary">Kết quả kiểm tra dữ liệu Excel</h3>
              <p className="text-xs text-slate-500 mt-0.5">Vui lòng kiểm tra lại danh sách trước khi đưa lên hệ thống</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs header */}
          <div className="flex border-b border-slate-100 px-6 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('valid')}
              className={cn(
                "flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors outline-none",
                activeTab === 'valid'
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Đủ điều kiện ({validList.length})
            </button>
            <button
              onClick={() => setActiveTab('invalid')}
              className={cn(
                "flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors outline-none",
                activeTab === 'invalid'
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Không đủ điều kiện ({invalidList.length})
            </button>
          </div>

          {/* Content list */}
          <div className="flex-1 overflow-y-auto p-5 min-h-[180px]">
            {activeTab === 'valid' ? (
              validList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic text-sm">
                  Không có {entityLabel.singular} nào đủ điều kiện nhập.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-50 border-b border-sky-100">
                        <th className="px-4 py-3 font-medium text-slate-600">Họ và tên</th>
                        <th className="px-4 py-3 font-medium text-slate-600">Số điện thoại</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-center">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {validList.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-700">{s.fullName}</td>
                          <td className="px-4 py-3 text-slate-500">{s.phone}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
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
                      <tr className="bg-sky-50 border-b border-sky-100">
                        <th className="px-4 py-3 font-medium text-slate-600">{entityLabel.tabLabel}</th>
                        <th className="px-4 py-3 font-medium text-slate-600">Số điện thoại</th>
                        <th className="px-4 py-3 font-medium text-slate-600">Lý do lỗi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invalidList.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 bg-rose-50/10">
                          <td className="px-4 py-3 font-bold text-slate-700">{s.fullName}</td>
                          <td className="px-4 py-3 text-slate-500">{s.phone}</td>
                          <td className="px-4 py-3 font-medium text-rose-600">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end bg-white">
            <button
              type="button"
              onClick={onConfirm}
              disabled={validList.length === 0 || isSubmitting}
              className="flex items-center justify-center gap-2 h-10 px-4 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
