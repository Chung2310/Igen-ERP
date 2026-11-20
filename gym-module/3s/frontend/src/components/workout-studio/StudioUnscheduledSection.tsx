import React from 'react';
import { CalendarPlus, Trash2, Inbox } from 'lucide-react';
import type { ScheduledExercise } from '../../types/workoutStudio';

interface StudioUnscheduledSectionProps {
  unscheduled: ScheduledExercise[];
  activeDay: number;
  onPlaceUnscheduled: (item: ScheduledExercise) => void;
  onRemoveUnscheduled: (id: string) => void;
  readOnly?: boolean;
}

export default function StudioUnscheduledSection({
  unscheduled,
  activeDay,
  onPlaceUnscheduled,
  onRemoveUnscheduled,
  readOnly = false,
}: StudioUnscheduledSectionProps) {
  if (unscheduled.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
            <Inbox size={15} />
          </div>
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 m-0">
            Bài tập chưa xếp lịch ({unscheduled.length})
          </h3>
        </div>
        <span className="text-[10px] text-slate-400">
          Chưa gán ngày
        </span>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {unscheduled.map((item) => (
          <div
            key={item.id}
            className="p-2.5 rounded-xl border border-amber-200/70 bg-amber-50/20 hover:bg-amber-50/40 flex items-center justify-between gap-2.5 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white text-slate-600 border border-slate-200">
                  {item.trackingType || 'STRENGTH'}
                </span>
                {item.muscleGroup && (
                  <span className="text-[10px] font-semibold text-slate-500 truncate">
                    {item.muscleGroup}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 m-0 truncate">
                {item.name}
              </h4>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => onPlaceUnscheduled(item)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] cursor-pointer shadow-xs transition-colors"
              >
                <CalendarPlus size={12} />
                <span>+ Ngày {activeDay}</span>
              </button>

              {!readOnly && (
                <button
                  type="button"
                  title="Xóa bài tập"
                  onClick={() => onRemoveUnscheduled(item.id)}
                  className="p-1 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
