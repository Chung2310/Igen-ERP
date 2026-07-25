import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSchedule } from '../../hooks/useSchedule';
import { ScheduleEvent } from '../../types';
import { ErpCard, ErpFilterTab } from '../Erp/ErpUI';
import { useEntityLabel } from '../../hooks/useEntityLabel';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

const typeStyle = (type: ScheduleEvent['type']) => {
  switch (type) {
    case 'exam':
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case 'resource':
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    default:
      return "bg-brand-primary/10 text-brand-primary border-brand-primary/20";
  }
};

/** Lịch tháng tổng hợp: lớp học định kỳ + kỳ thi + booking tài nguyên (nguồn GET /schedule) */
export function ScheduleCalendar({ selectedCenter }: { selectedCenter?: string }) {
  const entityLabel = useEntityLabel();
  const isCandidate = entityLabel.preset === 'candidate';
  const [selectedType, setSelectedType] = useState<'all' | 'class' | 'exam' | 'resource'>('all');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Khoảng ngày của tháng đang xem — nạp lịch tổng hợp từ server
  const fromDate = useMemo(() => `${year}-${pad2(month + 1)}-01`, [year, month]);
  const toDate = useMemo(() => `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`, [year, month, daysInMonth]);
  const { events } = useSchedule(fromDate, toDate, selectedCenter === 'all' ? undefined : selectedCenter);

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Chủ nhật

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthLabel = currentMonth.toLocaleString('vi-VN', { month: 'long', year: 'numeric' });

  const totalGridCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
  const daysArray = Array.from({ length: totalGridCells }, (_, index) => {
    const dayNumber = index - startDayOfWeek + 1;
    const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
    const dateString = isValidDay ? `${year}-${pad2(month + 1)}-${pad2(dayNumber)}` : '';
    return { dayNumber, isValidDay, dateString };
  });

  const filteredEvents = events.filter(evt => selectedType === 'all' || evt.type === selectedType);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const evt of filteredEvents) {
      const list = map.get(evt.date) || [];
      list.push(evt);
      map.set(evt.date, list);
    }
    return map;
  }, [filteredEvents]);

  const todayString = new Date().toISOString().slice(0, 10);
  const upcomingEvents = filteredEvents.filter(e => e.date >= todayString).slice(0, 6);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 text-left">
      {/* Calendar */}
      <ErpCard className="xl:col-span-2 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-black capitalize tracking-tight min-w-[140px] text-center text-slate-800">
              {monthLabel}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ErpFilterTab active={selectedType === 'all'} onClick={() => setSelectedType('all')}>Tất cả</ErpFilterTab>
            {!isCandidate && <ErpFilterTab active={selectedType === 'class'} onClick={() => setSelectedType('class')}>Lớp học</ErpFilterTab>}
            {!isCandidate && <ErpFilterTab active={selectedType === 'exam'} onClick={() => setSelectedType('exam')}>Kỳ thi</ErpFilterTab>}
            {!isCandidate && <ErpFilterTab active={selectedType === 'resource'} onClick={() => setSelectedType('resource')}>Tài nguyên</ErpFilterTab>}
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
            <div key={day} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400 py-2">{day}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysArray.map((day, idx) => {
            const dayEvents = day.isValidDay ? (eventsByDate.get(day.dateString) || []) : [];
            const isToday = day.dateString === todayString;
            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[72px] p-1.5 rounded-xl border text-left transition-all",
                  !day.isValidDay && "opacity-0 pointer-events-none",
                  isToday
                    ? "border-brand-primary/50 bg-brand-primary/5"
                    : "border-slate-100 hover:border-slate-200"
                )}
              >
                {day.isValidDay && (
                  <>
                    <span className={cn(
                      "text-[10px] font-black",
                      isToday ? "text-brand-primary" : "text-slate-500"
                    )}>
                      {day.dayNumber}
                    </span>
                    <div className="space-y-0.5 mt-1">
                      {dayEvents.slice(0, 2).map(evt => (
                        <div
                          key={evt.id}
                          title={`${evt.title} (${evt.time}) — ${evt.details}`}
                          className={cn("px-1.5 py-0.5 rounded-md border text-[8px] font-black truncate", typeStyle(evt.type))}
                        >
                          {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[8px] font-black text-slate-400 px-1">+{dayEvents.length - 2} sự kiện</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ErpCard>

      {/* Upcoming events list */}
      <ErpCard className="p-6 space-y-4">
        <h3 className="text-sm font-black tracking-tight text-slate-800">Sự kiện sắp tới</h3>
        {upcomingEvents.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 py-8 text-center">
            Không có sự kiện nào trong thời gian tới.<br />
            Mở lớp, tạo đợt thi hoặc đặt lịch tài nguyên để hiển thị tại đây.
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(evt => (
              <div
                key={evt.id}
                className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider", typeStyle(evt.type))}>
                    {evt.type === 'exam' ? 'Kỳ thi' : evt.type === 'resource' ? 'Tài nguyên' : 'Lớp học'}
                  </span>
                  <span className="text-[9px] font-black text-slate-400">
                    {evt.date.split('-').reverse().join('/')} • {evt.time}
                  </span>
                </div>
                <p className="text-xs font-black truncate text-slate-800">{evt.title}</p>
                <p className="text-[10px] font-bold text-slate-500 truncate">{evt.details}</p>
              </div>
            ))}
          </div>
        )}
      </ErpCard>
    </div>
  );
}
