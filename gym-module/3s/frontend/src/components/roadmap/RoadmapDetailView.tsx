/**
 * RoadmapDetailView — shared read-only view for roadmap content.
 * Used by both PT's RoadmapDetailModal and Customer's CustomerRoadmap page.
 * Renders: Key Metrics → Strategy Details → Phase/Week Accordion → Checkpoints.
 */
import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Target,
  Utensils,
  Zap,
} from 'lucide-react';
import type { Roadmap } from '../../types';

interface RoadmapDetailViewProps {
  roadmap: Roadmap;
  /** Optional – hides baseline section when viewing as customer (customer doesn't have this data) */
  hideBaseline?: boolean;
}

export default function RoadmapDetailView({ roadmap, hideBaseline }: RoadmapDetailViewProps) {
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>(() => {
    // Auto-expand the first phase
    if (roadmap.phases?.length > 0) return { [roadmap.phases[0].order]: true };
    return {};
  });

  const strategy = roadmap.strategy;
  const baseline = roadmap.baseline;

  const togglePhase = (order: number) => {
    setExpandedPhases((prev) => ({ ...prev, [order]: !prev[order] }));
  };

  const expandAllPhases = () => {
    const map: Record<number, boolean> = {};
    roadmap.phases.forEach((p) => {
      map[p.order] = true;
    });
    setExpandedPhases(map);
  };

  const collapseAllPhases = () => {
    setExpandedPhases({});
  };

  return (
    <div className="flex flex-col gap-4">
      {strategy?.generationSource && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <strong>{strategy.generationSource === 'AI' ? 'Nguồn đề xuất: AI' : 'Nguồn đề xuất: bản mẫu theo quy tắc'}</strong>
          {strategy.assumptions?.map((note, index) => <p key={index} className="mt-1">{note}</p>)}
        </div>
      )}
      {strategy?.sessionBudget && (
        <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          Phân bổ mỗi buổi: khởi động {strategy.sessionBudget.warmupMinutes} phút · kháng lực {strategy.sessionBudget.strengthMinutes} phút · cardio {strategy.sessionBudget.cardioMinutes} phút · hồi phục {strategy.sessionBudget.cooldownMinutes} phút.
        </p>
      )}
      {/* ── Top Key Metrics Banner ── */}
      {strategy && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-xs text-slate-500 font-semibold block mb-0.5">Thời lượng kế hoạch</span>
            <strong className="text-sm sm:text-base text-primary font-bold">
              {strategy.estimatedWeeks} Tuần • {strategy.sessionsPerWeek} Buổi/tuần
            </strong>
          </div>

          {strategy.nutrition && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              <span className="text-xs text-emerald-800 font-semibold block mb-0.5">Calo mục tiêu</span>
              <strong className="text-sm sm:text-base text-emerald-700 font-bold">
                {strategy.nutrition.targetCalories} kcal/ngày
              </strong>
              <div className="text-xs text-emerald-800 mt-0.5">
                P: {strategy.nutrition.proteinGrams || 0}g • C: {strategy.nutrition.carbsGrams || 0}g • F: {strategy.nutrition.fatGrams || 0}g
              </div>
            </div>
          )}

          {!hideBaseline && baseline && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-xs text-slate-500 font-semibold block mb-0.5">Chỉ số ban đầu</span>
              <strong className="text-sm sm:text-base text-slate-900 font-bold">
                {baseline.initialWeight ? `${baseline.initialWeight} kg` : '—'}
              </strong>
              <div className="text-xs text-slate-500 mt-0.5">
                % Mỡ: {baseline.initialBodyFat ? `${baseline.initialBodyFat}%` : '—'} • Cơ: {baseline.initialMuscleMass ? `${baseline.initialMuscleMass}kg` : '—'}
              </div>
            </div>
          )}

          {strategy.nutrition?.waterLiters && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
              <span className="text-xs text-blue-800 font-semibold block mb-0.5">Nước uống mỗi ngày</span>
              <strong className="text-sm sm:text-base text-blue-600 font-bold">
                {strategy.nutrition.waterLiters} Lít / ngày
              </strong>
            </div>
          )}
        </div>
      )}

      {/* ── Strategy Details Block ── */}
      {strategy && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
          <h3 className="m-0 text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-secondary shrink-0" />
            <span>Định hướng Phương pháp & Dinh dưỡng</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <strong className="text-primary flex items-center gap-1.5 mb-1 text-xs sm:text-sm">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Phương pháp & Lịch tập
              </strong>
              <p className="m-0 mb-1 text-slate-700 text-xs sm:text-sm leading-relaxed">{strategy.trainingMethod}</p>
              <div className="text-xs text-slate-500">
                <strong className="text-slate-700">Lịch:</strong> {strategy.trainingSplit}
              </div>
            </div>

            {strategy.cardioProtocol && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong className="text-rose-600 flex items-center gap-1.5 mb-1 text-xs sm:text-sm">
                  <HeartPulse className="w-3.5 h-3.5 shrink-0" /> Chiến lược Cardio
                </strong>
                <p className="m-0 text-slate-700 text-xs sm:text-sm leading-relaxed">{strategy.cardioProtocol}</p>
              </div>
            )}
          </div>

          {(strategy.nutrition?.advice || strategy.nutritionStrategy) && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs sm:text-sm">
              <strong className="text-emerald-700 flex items-center gap-1.5 mb-1">
                <Utensils className="w-3.5 h-3.5 shrink-0" /> Lời khuyên dinh dưỡng
              </strong>
              <p className="m-0 text-slate-700 leading-relaxed">{strategy.nutrition?.advice || strategy.nutritionStrategy}</p>
            </div>
          )}

          {/* Checkpoints */}
          {strategy.checkpoints && strategy.checkpoints.length > 0 && (
            <div className="mt-0.5">
              <span className="text-xs font-bold text-slate-600 block mb-2">
                Các mốc đánh giá & Đo InBody (Checkpoints):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {strategy.checkpoints.map((cp, idx) => (
                  <div
                    key={idx}
                    className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 text-xs"
                  >
                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span>Tuần {cp.week}: {cp.title}</span>
                    </div>
                    {cp.description && (
                      <div className="text-purple-700 mt-1 text-xs leading-relaxed">{cp.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Phase & Weekly Breakdown Accordion ── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-1">
          <h3 className="m-0 text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span>Chi tiết các Phase & Mục tiêu từng tuần ({roadmap.phases?.length || 0} Phase)</span>
          </h3>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={expandAllPhases}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              Mở rộng tất cả
            </button>
            <button
              type="button"
              onClick={collapseAllPhases}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              Thu gọn
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {[...(roadmap.phases || [])]
            .sort((a, b) => a.order - b.order)
            .map((phase) => {
              const isExpanded = Boolean(expandedPhases[phase.order]);
              const cleanPhaseName = phase.name.replace(
                new RegExp(`^Phase\\s*${phase.order}\\s*[:\\-]\\s*`, 'i'),
                ''
              );

              return (
                <div
                  key={phase.order}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs transition-shadow"
                >
                  {/* Phase Header */}
                  <div
                    className={`p-3 sm:px-4 sm:py-3.5 cursor-pointer select-none transition-colors border-b ${
                      isExpanded
                        ? 'bg-slate-100/90 border-slate-200'
                        : 'bg-slate-50/70 border-transparent hover:bg-slate-100/60'
                    }`}
                    onClick={() => togglePhase(phase.order)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      {/* Left Block on desktop / Split Meta Row & Title on mobile */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                        {/* Mobile top meta row: Badge + Duration pill + Chevron */}
                        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                          <span className="bg-primary text-white font-extrabold text-xs px-2.5 py-1 rounded-md shrink-0 whitespace-nowrap shadow-2xs">
                            Phase {phase.order}
                          </span>

                          {/* Mobile-only duration badge and chevron */}
                          <div className="flex items-center gap-2 sm:hidden shrink-0">
                            <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {phase.durationWeeks} tuần • {phase.weeks?.length || 0} tuần chi tiết
                            </span>
                            <span className="text-slate-500 shrink-0">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </div>
                        </div>

                        {/* Phase Title - full width on mobile, inline on desktop */}
                        <strong className="text-sm sm:text-[0.92rem] font-bold text-slate-900 leading-snug break-words">
                          {cleanPhaseName}
                        </strong>
                      </div>

                      {/* Right Block (Desktop only: duration + chevron) */}
                      <div className="hidden sm:flex items-center gap-2.5 shrink-0">
                        <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
                          {phase.durationWeeks} tuần • {phase.weeks?.length || 0} tuần chi tiết
                        </span>
                        <span className="text-slate-500 shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Phase Body */}
                  {isExpanded && (
                    <div className="p-3 sm:p-4 border-t border-slate-200 flex flex-col gap-3 bg-slate-50/50">
                      {/* Phase Goals */}
                      {phase.goals && phase.goals.length > 0 && (
                        <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-lg border border-slate-200 text-xs sm:text-sm">
                          <strong className="text-primary flex items-center gap-1.5 mb-2 font-bold">
                            <Target className="w-3.5 h-3.5 text-secondary shrink-0" />
                            <span>Mục tiêu giai đoạn:</span>
                          </strong>
                          <ul className="m-0 pl-4 text-slate-700 flex flex-col gap-1.5 list-disc">
                            {phase.goals.map((g, gIdx) => (
                              <li key={gIdx} className="leading-relaxed">{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weeks List */}
                      <div className="flex flex-col gap-2">
                        {phase.weeks?.map((w, wIdx) => (
                          <div
                            key={wIdx}
                            className="bg-white p-3 sm:px-4 sm:py-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span className="bg-sky-100 text-sky-800 font-extrabold text-xs px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap mt-0.5">
                                Tuần {w.week}
                              </span>
                              <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed break-words min-w-0">
                                {w.focus}
                              </div>
                            </div>

                            <span className="self-start sm:self-center text-xs text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium whitespace-nowrap shrink-0">
                              {w.sessionTargets || 3} buổi/tuần
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
