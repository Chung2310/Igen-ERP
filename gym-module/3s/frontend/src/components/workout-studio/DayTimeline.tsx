import React, { type CSSProperties, type DragEventHandler, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Plus, Dumbbell, Calendar, Clock, Trash2, CalendarMinus, Edit3, Sparkles } from 'lucide-react';
import { formatMinute } from '../../services/workoutStudioModel';
import type { MovePreview, ScheduledExercise } from '../../types/workoutStudio';

interface Props {
  activeDay: number;
  items: ScheduledExercise[];
  selectedId?: string;
  preview?: MovePreview;
  wrapperRef?: RefObject<HTMLElement | null>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  onSelect: (id: string) => void;
  onMoveStart?: (event: ReactPointerEvent, item: ScheduledExercise) => void;
  onResizeStart?: (event: ReactPointerEvent, item: ScheduledExercise) => void;
  onKeyboardMove?: (item: ScheduledExercise, minutes: number) => void;
  onAddExercise?: () => void;
  onRemoveExercise?: (id: string) => void;
  onUnscheduleExercise?: (id: string) => void;
  readOnly?: boolean;
}

export default function DayTimeline({
  activeDay,
  items,
  selectedId,
  wrapperRef,
  onSelect,
  onAddExercise,
  onRemoveExercise,
  onUnscheduleExercise,
  readOnly = false,
}: Props) {
  // Sort chronologically by startMinute
  const sortedItems = [...items].sort((a, b) => a.startMinute - b.startMinute);
  const totalMinutes = sortedItems.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);

  const getTrackingTypeBadge = (type: string) => {
    switch (type) {
      case 'STRENGTH':
        return { label: 'Tạ / Kháng lực', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'BODYWEIGHT':
        return { label: 'Bodyweight', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CARDIO':
        return { label: 'Cardio', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'INTERVAL':
        return { label: 'Interval', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'MOBILITY':
        return { label: 'Giãn cơ', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      default:
        return { label: type, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const renderPrescriptionChips = (item: ScheduledExercise) => {
    const p = (item.prescription || {}) as Record<string, any>;
    const chips: React.ReactNode[] = [];

    if (p.sets !== undefined) {
      chips.push(
        <span key="sets" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
          🔥 {p.sets} hiệp
        </span>
      );
    }
    if (p.reps !== undefined) {
      chips.push(
        <span key="reps" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200/80">
          🔁 {p.reps} reps
        </span>
      );
    }
    const weight = p.targetWeight ?? p.addedWeight;
    if (weight !== undefined && weight !== null && weight !== '') {
      chips.push(
        <span key="weight" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200/80">
          🏋️ {weight} kg
        </span>
      );
    }
    if (p.restSeconds !== undefined) {
      chips.push(
        <span key="rest" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          ⏱️ Nghỉ {p.restSeconds}s
        </span>
      );
    }
    if (p.targetRpe !== undefined) {
      chips.push(
        <span key="rpe" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/80">
          ⚡ RPE {p.targetRpe}
        </span>
      );
    }
    if (p.durationMinutes !== undefined && item.trackingType === 'CARDIO') {
      chips.push(
        <span key="dur" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
          🏃 {p.durationMinutes}p
        </span>
      );
    }
    if (p.rounds !== undefined) {
      chips.push(
        <span key="rounds" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
          🔄 {p.rounds} vòng
        </span>
      );
    }

    if (chips.length === 0) {
      return (
        <span className="text-[11px] text-slate-400 italic">
          Chưa cài đặt thông số hiệp/lần
        </span>
      );
    }

    return chips;
  };

  return (
    <main ref={wrapperRef} className="w-full space-y-4">
      {/* Action Header Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800">
              <Calendar size={13} /> Ngày {activeDay}
            </span>
            <span className="text-xs font-bold text-slate-700">
              {items.length} bài tập · {totalMinutes} phút
            </span>
          </div>
          <p className="text-[11px] text-slate-500 m-0 mt-0.5">
            Bấm vào từng bài để chỉnh sửa thông số (sets, reps, tạ, thời gian nghỉ)
          </p>
        </div>

        {onAddExercise && !readOnly && (
          <button
            type="button"
            onClick={onAddExercise}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={15} /> Thêm bài tập
          </button>
        )}
      </div>

      {/* Empty State */}
      {sortedItems.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center my-6">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 mx-auto flex items-center justify-center mb-3">
            <Dumbbell size={28} />
          </div>
          <h4 className="text-base font-black text-slate-800 m-0 mb-1">
            Chưa có bài tập cho Ngày {activeDay}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto m-0 mb-4">
            Ngày này chưa được xếp lịch bài tập nào. Bạn có thể chọn bài từ thư viện hoặc xếp bài có sẵn từ danh sách Chưa xếp lịch.
          </p>
          {onAddExercise && !readOnly && (
            <button
              type="button"
              onClick={onAddExercise}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              <Plus size={16} /> Thêm bài tập vào Ngày {activeDay}
            </button>
          )}
        </div>
      )}

      {/* Agenda Card List */}
      {sortedItems.length > 0 && (
        <div className="space-y-3">
          {sortedItems.map((item, index) => {
            const isSelected = selectedId === item.id;
            const badge = getTrackingTypeBadge(item.trackingType || 'STRENGTH');
            const startStr = formatMinute(item.startMinute);
            const endStr = formatMinute(item.startMinute + item.durationMinutes);

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`group bg-white rounded-2xl border transition-all duration-150 p-4 sm:p-4.5 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-xs hover:shadow-md ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-200 bg-sky-50/20'
                    : 'border-slate-200/80 hover:border-sky-300'
                }`}
              >
                {/* Left: Number & Time & Exercise Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Order Index & Time badge */}
                  <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl px-2.5 py-1.5 min-w-[64px] shrink-0">
                    <span className="text-xs font-black text-slate-800">
                      {startStr}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {item.durationMinutes}p
                    </span>
                  </div>

                  {/* Exercise Title & Tags */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      {item.muscleGroup && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          {item.muscleGroup}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {startStr} – {endStr}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 m-0 truncate group-hover:text-sky-600 transition-colors">
                      {item.name}
                    </h4>

                    {/* Prescriptions summary row */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {renderPrescriptionChips(item)}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div
                  className="flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    title="Chỉnh sửa thông số bài tập"
                    onClick={() => onSelect(item.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-sky-300 bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Edit3 size={13} /> Sửa
                  </button>

                  {onUnscheduleExercise && !readOnly && (
                    <button
                      type="button"
                      title="Chuyển về Chưa xếp lịch"
                      onClick={() => onUnscheduleExercise(item.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-300 bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition-colors cursor-pointer"
                    >
                      <CalendarMinus size={15} />
                    </button>
                  )}

                  {onRemoveExercise && !readOnly && (
                    <button
                      type="button"
                      title="Xóa bài tập khỏi ngày"
                      onClick={() => onRemoveExercise(item.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
