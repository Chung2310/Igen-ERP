import React, { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { ContentApprovalCard, PublishEvent } from "../../types";
import { toast } from "../../pages/Toast";

interface CalendarTabProps {
  isUserRole: boolean;
  approvalCards: ContentApprovalCard[];
}

export default function CalendarTab({ isUserRole, approvalCards }: CalendarTabProps) {
  // 1. Calendar States
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const monthNamesVi = [
    "THÁNG 1", "THÁNG 2", "THÁNG 3", "THÁNG 4", "THÁNG 5", "THÁNG 6",
    "THÁNG 7", "THÁNG 8", "THÁNG 9", "THÁNG 10", "THÁNG 11", "THÁNG 12"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  };

  const startOffset = (() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    return firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  })();

  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const joinedEvents: PublishEvent[] = (approvalCards || [])
    .filter((c) => c.status === "scheduled")
    .map((c, index): PublishEvent | null => {
      let assignedDay = ((index * 5 + 11) % 28) + 1;
      if (c.scheduledDate) {
        const dateObj = new Date(c.scheduledDate);
        if (!isNaN(dateObj.getTime())) {
          if (dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth) {
            assignedDay = dateObj.getDate();
          } else {
            return null;
          }
        }
      }
      return {
        id: c.id,
        date: assignedDay,
        title: `[Lịch đăng] ${c.title}${c.scheduledTime ? ` - ${c.scheduledTime}` : ""}`,
        type: c.contentType,
        channel: c.channel,
        status: "Approved" as const,
      };
    })
    .filter((e): e is PublishEvent => e !== null);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="publishing_calendar_block">
      {/* Left 2 Cols: Monthly grid view */}
      <div className="xl:col-span-2 bg-slate-50 border border-gray-200 p-6 rounded-2xl text-xs flex flex-col justify-between" id="calendar_grid_container">
        <div>
          <div className="flex justify-between items-center mb-5">
            <h4 className="font-bold text-slate-800 text-sm font-sans tracking-tight flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-blue-500" />
              Lịch Xuất Bản Content • {monthNamesVi[currentMonth]}, {currentYear}
            </h4>
            <div className="flex items-center gap-1 bg-white p-1 rounded-md border text-[11px] font-mono select-none">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-sm cursor-pointer">‹</button>
              <span className="font-bold px-2">{monthNamesVi[currentMonth]}, {currentYear}</span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-sm cursor-pointer">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 bg-gray-200 p-1 rounded-xl text-center font-bold tracking-wider text-slate-600 text-[10px] uppercase mb-1">
            <div>T2</div>
            <div>T3</div>
            <div>T4</div>
            <div>T5</div>
            <div>T6</div>
            <div>T7</div>
            <div>CN</div>
          </div>

          {/* Grid squares rendering dynamic items */}
          <div className="grid grid-cols-7 gap-1 font-mono text-[11px]" id="calendar_days_grid">
            {/* Mock padded previous month days */}
            {Array.from({ length: startOffset }).map((_, idx) => {
              const dayVal = prevMonthLastDate - startOffset + idx + 1;
              return (
                <div key={`prev-${idx}`} className="h-16 p-2 bg-gray-150 text-gray-300 rounded-lg select-none text-left opacity-40">
                  {dayVal}
                </div>
              );
            })}

            {Array.from({ length: daysInMonth }).map((_, dIdx) => {
              const dayNum = dIdx + 1;
              const matchEvents = joinedEvents.filter(e => e.date === dayNum);
              const isSelected = selectedDay === dayNum;
              return (
                <div 
                  key={dayNum}
                  onClick={() => setSelectedDay(dayNum)}
                  className={`h-16 p-2 text-left rounded-lg border transition-all cursor-pointer relative ${
                    isSelected 
                      ? "bg-blue-50 border-blue-400 text-blue-800" 
                      : "bg-white border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-semibold select-none text-[10px]">{dayNum}</span>
                  {matchEvents.length > 0 && (
                    <div className="absolute bottom-1 left-2.5 right-2.5 flex flex-col gap-0.5">
                      {matchEvents.map(e => (
                        <div key={e.id} className={`px-1 rounded-sm text-[8px] font-sans truncate font-bold uppercase tracking-wider ${
                          e.status === "Published" 
                            ? "bg-green-500 text-white" 
                            : e.status === "Approved" 
                              ? "bg-blue-500 text-white" 
                              : "bg-amber-400 text-white"
                        }`}>
                          {e.channel}: {e.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-150 rounded-b-xl select-none text-center text-[10px] text-gray-400 font-mono mt-4">
          Click chọn các ngày có gắn sự kiện để truy lục lịch truyền thông tương ứng của iGen ERP
        </div>
      </div>

      {/* Right Card: Day content schedule timeline detail */}
      <div className="bg-white border p-6 rounded-2xl flex flex-col justify-between" id="calendar_events_details_col">
        {selectedDay ? (
          <div>
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-gray-850 text-sm font-sans tracking-tight uppercase">
                📅 Lịch đăng ngày {selectedDay}/{currentMonth + 1}/{currentYear}
              </h4>
              <button 
                onClick={() => setSelectedDay(null)}
                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-mono text-[9px] font-bold border border-indigo-150 transition-colors cursor-pointer"
              >
                Xem tất cả ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Danh sách chuỗi nội dung truyền thông cần vận hành trong ngày.</p>

            <div className="h-64 overflow-y-auto mt-6 space-y-4 text-xs text-slate-550 text-left">
              {joinedEvents.filter(e => e.date === selectedDay).length === 0 ? (
                <div className="p-8 text-center bg-gray-50 text-gray-400 italic rounded-xl">
                  Không có lịch đăng tải nào được lập cho ngày này! Bạn có thể chuyển bản nháp sang Chờ đăng tải.
                </div>
              ) : (
                joinedEvents.filter(e => e.date === selectedDay).map(event => (
                  <div key={event.id} className="p-4 bg-slate-50 border border-gray-155 rounded-xl relative flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 bg-slate-200 rounded-sm font-bold font-mono text-[9px] uppercase">
                        Kênh: {event.channel}
                      </span>
                      <span className={`px-2 py-0.5 rounded-sm font-bold font-mono text-[9px] uppercase text-white ${
                        event.status === "Published" 
                          ? "bg-green-500" 
                          : event.status === "Approved" 
                            ? "bg-blue-600" 
                            : "bg-amber-500"
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <h5 className="font-bold font-sans text-xs text-slate-800 leading-normal">{event.title}</h5>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Định dạng: {event.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-gray-850 text-sm font-sans tracking-tight uppercase">
                📅 Lịch đăng tháng {currentMonth + 1}/{currentYear}
              </h4>
              <span className="px-2 py-0.5 bg-slate-100 rounded font-mono text-[9px] font-bold border border-gray-200">
                {joinedEvents.length} bài viết
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Tất cả bài đăng dự kiến trong tháng này.</p>

            <div className="h-64 overflow-y-auto mt-6 space-y-4 text-xs text-slate-550 text-left">
              {joinedEvents.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 text-gray-400 italic rounded-xl">
                  Không có lịch đăng tải nào được lập trong tháng này!
                </div>
              ) : (
                [...joinedEvents]
                  .sort((a, b) => a.date - b.date)
                  .map(event => (
                    <div key={event.id} className="p-4 bg-slate-50 border border-gray-150 rounded-xl relative flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="px-2 py-0.5 bg-slate-200 rounded-sm font-bold font-mono text-[9px] uppercase">
                          Ngày {event.date} • {event.channel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-sm font-bold font-mono text-[9px] uppercase text-white ${
                          event.status === "Published" 
                            ? "bg-green-500" 
                            : event.status === "Approved" 
                              ? "bg-blue-600" 
                              : "bg-amber-500"
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      <h5 className="font-bold font-sans text-xs text-slate-800 leading-normal">{event.title}</h5>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Định dạng: {event.type}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-150 flex flex-col gap-2">
          <button 
            onClick={() => {
              if (isUserRole) {
                toast.error("Tài khoản quyền USER không có quyền kích hoạt Autopost!");
                return;
              }
              toast.success("Kích hoạt kết nối Autopost tự động qua Meta & Tiktok APIs của iGen ERP thành công!");
            }}
            disabled={isUserRole}
            className={`w-full text-center py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
              isUserRole
                ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed select-none"
                : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>{isUserRole ? "🔒 Quyền Autopost bị hạn chế" : "Kích hoạt Autopost đồng bộ"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
