import React from 'react';
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

interface Props {
  days: number[];
  activeDay: number;
  activeWeek?: number;
  totalDays?: number;
  dayExerciseCounts?: Record<number, number>;
  totalMinutes: number;
  onChange: (day: number) => void;
}

export default function StudioDayNavigator({
  days,
  activeDay,
  activeWeek = 1,
  totalDays = 7,
  dayExerciseCounts = {},
  totalMinutes,
  onChange,
}: Props) {
  const currentIndex = days.indexOf(activeDay);
  const globalDayIndex = (activeWeek - 1) * 7 + activeDay;

  return (
    <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs mb-3 space-y-2">
      {/* Navigation & Chips Header in one clean row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left Arrow Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Ngày trước"
            disabled={currentIndex <= 0}
            onClick={() => currentIndex > 0 && onChange(days[currentIndex - 1])}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-baseline gap-1.5 px-1">
            <span className="text-xs font-black text-slate-900">
              Tuần {activeWeek} · Ngày {activeDay}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
              (ngày {globalDayIndex}/{totalDays})
            </span>
          </div>

          <button
            type="button"
            aria-label="Ngày sau"
            disabled={currentIndex >= days.length - 1}
            onClick={() => currentIndex < days.length - 1 && onChange(days[currentIndex + 1])}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right: Total Time */}
        <div className="flex items-center gap-1 text-xs font-bold text-slate-600 ml-auto bg-slate-100 px-2.5 py-1 rounded-lg">
          <Clock3 size={13} className="text-sky-600" />
          <span>{totalMinutes} phút</span>
        </div>
      </div>

      {/* Day Chips Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 no-scrollbar">
        {days.map((day) => {
          const isSelected = day === activeDay;
          const count = dayExerciseCounts[day] || 0;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onChange(day)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <span>Ngày {day}</span>
              {count > 0 && (
                <span
                  className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center ${
                    isSelected ? 'bg-white text-sky-700' : 'bg-sky-600 text-white'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
