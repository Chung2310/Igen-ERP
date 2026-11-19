import { AlertTriangle, ArrowRight, Clock, Target, X } from 'lucide-react';
import type { FeasibilityAssessment } from '../../services/goalFeasibilityService';

interface InfeasibleGoalModalProps {
  open: boolean;
  onClose: () => void;
  feasibility: FeasibilityAssessment;
  targetUnit: string;
  currentWeeks?: number;
  currentTarget?: number;
  onApplyRecommendedWeeks?: (weeks: number) => void;
  onApplyRecommendedTarget?: (target: number) => void;
}

export default function InfeasibleGoalModal({
  open,
  onClose,
  feasibility,
  targetUnit,
  onApplyRecommendedWeeks,
  onApplyRecommendedTarget,
}: InfeasibleGoalModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="infeasible-modal-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-[450px] overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 pb-3 flex items-start justify-between gap-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h2 id="infeasible-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
                Mục tiêu chưa khả thi
              </h2>
              <p className="text-xs text-rose-600 font-medium">
                Vượt ngưỡng an toàn sinh lý học
              </p>
            </div>
          </div>

          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Headline & Quick Stat */}
          <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-rose-900 mb-2">
              {feasibility.headline}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-rose-200/50 text-[11px] text-slate-600">
              <span>Tốc độ: <strong className="text-rose-600 font-bold">{feasibility.weeklyRate} {feasibility.weeklyRateUnit}</strong></span>
              <span>An toàn: <strong className="text-emerald-700 font-bold">≤ {feasibility.safeWeeklyRateMax} {feasibility.weeklyRateUnit}</strong></span>
            </div>
          </div>

          {/* 1-Click Suggestions */}
          {(feasibility.recommendedWeeks || feasibility.recommendedTarget) && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">
                Gợi ý điều chỉnh nhanh từ AI:
              </div>

              {feasibility.recommendedWeeks && onApplyRecommendedWeeks && (
                <button
                  type="button"
                  onClick={() => onApplyRecommendedWeeks(feasibility.recommendedWeeks!)}
                  className="w-full bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-950 rounded-xl px-3.5 py-2.5 text-left transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-sky-600 shrink-0" />
                    <span className="text-xs font-bold text-sky-900">
                      Tăng thời gian lên {feasibility.recommendedWeeks} tuần
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-sky-600 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Áp dụng <ArrowRight size={13} />
                  </span>
                </button>
              )}

              {feasibility.recommendedTarget && onApplyRecommendedTarget && (
                <button
                  type="button"
                  onClick={() => onApplyRecommendedTarget(feasibility.recommendedTarget!)}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 rounded-xl px-3.5 py-2.5 text-left transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-emerald-900">
                      Đổi mục tiêu thành {feasibility.recommendedTarget} {targetUnit}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Áp dụng <ArrowRight size={13} />
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            className="button button-secondary text-xs px-3.5 py-1.5"
            onClick={onClose}
          >
            Đóng để tự chỉnh
          </button>
        </div>
      </section>
    </div>
  );
}
