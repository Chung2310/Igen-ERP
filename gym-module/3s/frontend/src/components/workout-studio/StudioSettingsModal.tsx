import React, { useState, useEffect } from 'react';
import { X, Sliders, Calendar, Target, Award, FileText } from 'lucide-react';

interface StudioSettingsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  goal: string;
  level: string;
  durationDays: number;
  technicalNotes?: string;
  onTitleChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onDurationDaysChange: (value: number) => void;
  onTechnicalNotesChange?: (value: string) => void;
  readOnly?: boolean;
}

export default function StudioSettingsModal({
  open,
  onClose,
  title,
  goal,
  level,
  durationDays,
  technicalNotes = '',
  onTitleChange,
  onGoalChange,
  onLevelChange,
  onDurationDaysChange,
  onTechnicalNotesChange,
  readOnly = false,
}: StudioSettingsModalProps) {
  const [durationDraft, setDurationDraft] = useState<string>(String(durationDays));

  useEffect(() => {
    setDurationDraft(String(durationDays));
  }, [durationDays]);

  if (!open) return null;

  const handleDurationBlur = () => {
    const parsed = Number(durationDraft);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 365) {
      onDurationDaysChange(parsed);
    } else {
      setDurationDraft(String(durationDays));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                Cài đặt thông tin giáo án
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Tùy chỉnh tiêu đề, mục tiêu, độ khó và thời lượng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-sky-600" /> Tên giáo án:
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Tăng cơ toàn thân 4 tuần, Hypertrophy Pro..."
              value={title}
              disabled={readOnly}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all bg-white"
            />
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Target size={14} className="text-emerald-600" /> Mục tiêu chính:
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Phát triển cơ bắp ngực & xô, giảm mỡ giữ cơ..."
              value={goal}
              disabled={readOnly}
              onChange={(e) => onGoalChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all bg-white"
            />
          </div>

          {/* Level & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Award size={14} className="text-amber-600" /> Cấp độ học viên:
              </label>
              <select
                value={level}
                disabled={readOnly}
                onChange={(e) => onLevelChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all bg-white"
              >
                <option value="BEGINNER">🌱 Cơ bản (Beginner)</option>
                <option value="INTERMEDIATE">⚡ Trung cấp (Intermediate)</option>
                <option value="ADVANCED">🔥 Nâng cao (Advanced)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" /> Tổng số ngày giáo án:
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={durationDraft}
                  disabled={readOnly}
                  onChange={(e) => setDurationDraft(e.target.value)}
                  onBlur={handleDurationBlur}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all bg-white"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ngày
                </span>
              </div>
            </div>
          </div>

          {/* Technical Notes */}
          {onTechnicalNotesChange && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ghi chú kỹ thuật & Lời khuyên HLV:
              </label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Chú ý khởi động kỹ khớp vai trước buổi tập, giữ RPE 7-8..."
                value={technicalNotes}
                disabled={readOnly}
                onChange={(e) => onTechnicalNotesChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-normal text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all bg-white resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            Đã xong
          </button>
        </div>
      </div>
    </div>
  );
}
