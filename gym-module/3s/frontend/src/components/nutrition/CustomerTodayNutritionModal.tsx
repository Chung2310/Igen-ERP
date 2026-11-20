import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  Utensils,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
} from 'lucide-react';
import MealImagePreviewModal from './MealImagePreviewModal';

interface FoodItem {
  name: string;
  amount?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  prepTip?: string;
  imageUrl?: string;
}

interface Meal {
  id?: string;
  name: string;
  timeSlot?: string;
  calories?: number;
  imageUrl?: string;
  items?: FoodItem[];
}

interface DayPlan {
  dayNumber?: number;
  dayOfWeek?: string;
  date?: string;
  meals: Meal[];
}

interface CustomerTodayNutritionModalProps {
  plan: any | null;
  customerName?: string;
  onClose: () => void;
}

const VIETNAMESE_DAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const EMPTY_DAY_PLAN: DayPlan = { meals: [] };

export const CustomerTodayNutritionModal: React.FC<CustomerTodayNutritionModalProps> = ({
  plan,
  customerName,
  onClose,
}) => {
  // 1. Xác định thời gian thực hiện tại
  const now = new Date();
  const currentDayOfWeekName = VIETNAMESE_DAYS[now.getDay()]; // vd: "Thứ Sáu"
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeNumber = currentHour * 60 + currentMinute;
  const currentTimeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  // 2. Trích xuất danh sách các ngày trong thực đơn (Hỗ trợ 4 cấu trúc dữ liệu khác nhau)
  const normalizedDays: DayPlan[] = useMemo(() => {
    if (!plan) return [];

    // Cấu trúc 1: Hierarchical weeks (menu[].days[])
    if (Array.isArray(plan.menu) && plan.menu.length > 0 && plan.menu[0]?.days) {
      const allDays: DayPlan[] = [];
      plan.menu.forEach((week: any) => {
        if (Array.isArray(week.days)) {
          week.days.forEach((day: any) => {
            allDays.push({
              dayNumber: day.dayNumber,
              dayOfWeek: day.dayOfWeek || `Ngày ${day.dayNumber}`,
              date: day.date,
              meals: Array.isArray(day.meals) ? day.meals : [],
            });
          });
        }
      });
      if (allDays.length > 0) return allDays;
    }

    // Cấu trúc 2: dailyPlans array (7 ngày trong tuần)
    if (Array.isArray(plan.dailyPlans) && plan.dailyPlans.length > 0) {
      return plan.dailyPlans.map((d: any, idx: number) => ({
        dayNumber: idx + 1,
        dayOfWeek: d.dayOfWeek || VIETNAMESE_DAYS[(idx + 1) % 7],
        meals: Array.isArray(d.meals) ? d.meals : [],
      }));
    }

    // Cấu trúc 3: menu là mảng các ngày (menu[].meals)
    if (Array.isArray(plan.menu) && plan.menu.length > 0 && plan.menu[0]?.meals) {
      return plan.menu.map((d: any, idx: number) => ({
        dayNumber: idx + 1,
        dayOfWeek: d.dayOfWeek || `Ngày ${idx + 1}`,
        date: d.date,
        meals: Array.isArray(d.meals) ? d.meals : [],
      }));
    }

    // Cấu trúc 4: menu là danh sách bữa ăn áp dụng chung cho mọi ngày
    if (Array.isArray(plan.menu) && plan.menu.length > 0) {
      return [
        {
          dayNumber: 1,
          dayOfWeek: 'Hàng ngày',
          meals: plan.menu.map((m: any, idx: number) => ({
            name: m.name || m.meal || `Bữa ${idx + 1}`,
            timeSlot: m.timeSlot || m.time || '',
            calories: m.calories || 0,
            imageUrl: m.imageUrl,
            items: Array.isArray(m.items) ? m.items : [],
          })),
        },
      ];
    }

    return [];
  }, [plan]);

  // 3. Tìm vị trí ngày hôm nay trong danh sách ngày
  const todayDayIndex = (() => {
    if (normalizedDays.length === 0) return 0;

    // Tìm theo tên thứ (vd: "Thứ Sáu")
    const indexByDayOfWeek = normalizedDays.findIndex((d) =>
      d.dayOfWeek?.toLowerCase().includes(currentDayOfWeekName.toLowerCase())
    );
    if (indexByDayOfWeek !== -1) return indexByDayOfWeek;

    // Tìm theo ngày trong tháng (date)
    const todayIso = now.toISOString().slice(0, 10);
    const indexByDate = normalizedDays.findIndex((d) => d.date?.startsWith(todayIso));
    if (indexByDate !== -1) return indexByDate;

    // Fallback theo thứ tự ngày trong tuần
    const dayMapIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    if (normalizedDays[dayMapIndex]) return dayMapIndex;

    return 0;
  })();

  // Tab ngày đang được xem (mặc định mở ra là ngày HÔM NAY)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(todayDayIndex);
  useEffect(() => {
    setSelectedDayIdx(todayDayIndex);
  }, [plan, todayDayIndex]);
  const activeDay = useMemo(
    () => normalizedDays[selectedDayIdx] || normalizedDays[0] || EMPTY_DAY_PLAN,
    [normalizedDays, selectedDayIdx]
  );
  const isViewingToday = selectedDayIdx === todayDayIndex;

  // Chế độ xem: 'realtime' (chỉ bữa hiện tại - mặc định) | 'all' (tất cả bữa trong ngày)
  const [viewMode, setViewMode] = useState<'realtime' | 'all'>('realtime');
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [expandedMeals, setExpandedMeals] = useState<Record<number, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Phân tích khoảng thời gian (hh:mm - hh:mm)
  const parseTimeRange = (timeSlot?: string) => {
    if (!timeSlot) return null;
    const parts = timeSlot.split(/[-–]/).map((s) => s.trim());
    if (parts.length < 2) return null;

    const [startH, startM] = parts[0].split(':').map(Number);
    const [endH, endM] = parts[1].split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return null;

    return {
      startMinutes: startH * 60 + (startM || 0),
      endMinutes: endH * 60 + (endM || 0),
    };
  };

  // Xác định bữa ăn phù hợp nhất với thời điểm hiện tại (Real-time active meal)
  const realtimeMealInfo = useMemo(() => {
    const meals = activeDay.meals || [];
    if (meals.length === 0) return null;

    if (!isViewingToday) {
      return {
        meal: meals[0],
        index: 0,
        status: 'SELECTED' as const,
        label: meals[0].name,
      };
    }

    // 1. Kiểm tra bữa nào đang trong khung giờ
    for (let i = 0; i < meals.length; i++) {
      const range = parseTimeRange(meals[i].timeSlot);
      if (range && currentTimeNumber >= range.startMinutes && currentTimeNumber <= range.endMinutes) {
        return {
          meal: meals[i],
          index: i,
          status: 'CURRENT' as const,
          label: 'Đang trong giờ ăn',
        };
      }
    }

    // 2. Tìm bữa tiếp theo sắp tới
    for (let i = 0; i < meals.length; i++) {
      const range = parseTimeRange(meals[i].timeSlot);
      if (range && range.startMinutes > currentTimeNumber) {
        return {
          meal: meals[i],
          index: i,
          status: 'UPCOMING' as const,
          label: 'Bữa ăn tiếp theo',
        };
      }
    }

    // 3. Fallback theo giờ nếu không có timeSlot
    let fallbackIdx = 0;
    if (currentHour < 10) fallbackIdx = 0;
    else if (currentHour < 14) fallbackIdx = Math.min(1, meals.length - 1);
    else if (currentHour < 17) fallbackIdx = Math.min(2, meals.length - 1);
    else fallbackIdx = Math.min(meals.length > 3 ? 3 : 2, meals.length - 1);

    const isAfterAll = currentHour >= 21;
    return {
      meal: meals[fallbackIdx],
      index: fallbackIdx,
      status: isAfterAll ? ('COMPLETED' as const) : ('CURRENT' as const),
      label: isAfterAll ? 'Bữa ăn cuối ngày hôm nay' : 'Bữa ăn hiện tại',
    };
  }, [activeDay, currentTimeNumber, currentHour, isViewingToday]);

  const toggleMeal = (mIdx: number) => {
    setExpandedMeals((prev) => ({
      ...prev,
      [mIdx]: !prev[mIdx],
    }));
  };

  // Tổng calo ngày đang xem
  const dayTotalCalories = useMemo(() => {
    return activeDay.meals.reduce((total, m) => {
      const mealKcal =
        m.calories ||
        m.items?.reduce((s, i) => s + (Number(i.calories) || 0), 0) ||
        0;
      return total + mealKcal;
    }, 0);
  }, [activeDay]);

  const currentMeal = realtimeMealInfo?.meal;

  if (!plan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* ================= HEADER ================= */}
        <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Thời Gian Thực • {currentTimeString}
              </span>
              <span className="text-xs text-slate-400 truncate">
                {activeDay.dayOfWeek}
              </span>
            </div>

            <h2 className="m-0 text-base font-bold text-white truncate flex items-center gap-2">
              <Utensils size={17} className="text-sky-400 shrink-0" />
              <span>Hôm nay ăn gì: <strong className="text-sky-300">{customerName || 'Học viên'}</strong></span>
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full border-none cursor-pointer transition-colors shrink-0 ml-2"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= THANH ĐIỀU HƯỚNG GỌN GÀNG (PROGRESSIVE DISCLOSURE) ================= */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 flex-wrap text-xs shrink-0">
          {/* Toggle Chế độ xem */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('realtime')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none ${
                viewMode === 'realtime'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ Bữa Hiện Tại
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none ${
                viewMode === 'all'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Cả Ngày ({activeDay.meals.length} bữa)
            </button>
          </div>

          {/* Nút mở rộng chọn ngày khác khi người dùng cần */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDaySelector((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border flex items-center gap-1 transition-all ${
                showDaySelector
                  ? 'bg-sky-50 text-sky-700 border-sky-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Calendar size={13} />
              <span>{isViewingToday ? 'Hôm nay' : activeDay.dayOfWeek}</span>
              <ChevronDown size={12} className={`transition-transform ${showDaySelector ? 'rotate-180' : ''}`} />
            </button>

            {!isViewingToday && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDayIdx(todayDayIndex);
                  setShowDaySelector(false);
                }}
                className="text-[11px] font-bold text-sky-600 hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                ↩ Về Hôm Nay
              </button>
            )}
          </div>
        </div>

        {/* BẢNG CHỌN NGÀY TRONG TUẦN (CHỈ HIỂN THỊ KHI NGƯỜI DÙNG BẤM "CHỌN NGÀY") */}
        {showDaySelector && (
          <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 animate-fadeIn">
            {normalizedDays.map((d, idx) => {
              const isToday = idx === todayDayIndex;
              const isSelected = idx === selectedDayIdx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedDayIdx(idx);
                    setShowDaySelector(false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : isToday
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{d.dayOfWeek}</span>
                  {isToday && <span className="ml-1 text-[10px] opacity-80">(Hôm nay)</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ================= NỘI DUNG CHÍNH (TIẾT GIẢM, CHỈ HIỆN ĐÚNG CÁI CẦN) ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* ================= CHẾ ĐỘ 1: BỮA HIỆN TẠI (THỜI GIAN THỰC) ================= */}
          {viewMode === 'realtime' && (
            <div>
              {currentMeal ? (
                <div className="rounded-xl border-2 border-emerald-500 bg-white shadow-sm overflow-hidden">
                  {/* Tiêu đề bữa ăn hiện tại */}
                  <div className="bg-emerald-50/80 px-4 py-3 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center gap-1">
                        <Sparkles size={11} />
                        {realtimeMealInfo.label}
                      </span>
                      <strong className="text-sm sm:text-base text-slate-900">
                        {currentMeal.name}
                      </strong>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                      {currentMeal.timeSlot && (
                        <span className="flex items-center gap-1 text-slate-500 font-medium">
                          <Clock size={12} /> {currentMeal.timeSlot}
                        </span>
                      )}
                      {currentMeal.calories ? (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                          🔥 {currentMeal.calories} kcal
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Ảnh món nếu có */}
                  {currentMeal.imageUrl && (
                    <div
                      className="w-full h-44 bg-slate-900 relative overflow-hidden cursor-pointer group"
                      onClick={() => setPreviewImage({ url: currentMeal.imageUrl!, title: currentMeal.name })}
                      title="Bấm để xem ảnh lớn"
                    >
                      <img
                        src={currentMeal.imageUrl}
                        alt={currentMeal.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Danh sách món ăn trong bữa */}
                  <div className="p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Món ăn & Định lượng ({currentMeal.items?.length || 0} món):
                    </div>

                    {Array.isArray(currentMeal.items) && currentMeal.items.length > 0 ? (
                      <div className="space-y-2">
                        {currentMeal.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                          >
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.name })}
                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                                title="Bấm để xem ảnh món ăn chi tiết"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                              {item.prepTip && (
                                <div className="text-xs text-slate-500 italic mt-0.5 flex items-center gap-1">
                                  <span>💡</span> {item.prepTip}
                                </div>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              {item.amount && (
                                <div className="font-extrabold text-sky-700 text-xs bg-sky-50 px-2 py-0.5 rounded">
                                  {item.amount}
                                </div>
                              )}
                              {item.calories ? (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {item.calories} kcal
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic py-2">
                        Chưa có chi tiết thực phẩm cụ thể cho bữa này.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  Không tìm thấy dữ liệu bữa ăn cho ngày hôm nay.
                </div>
              )}

              {/* Nút bấm xem các bữa khác khi cần */}
              {activeDay.meals.length > 1 && (
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className="w-full mt-3 py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-sky-700 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📋 Xem thêm {activeDay.meals.length - 1} bữa khác trong ngày hôm nay</span>
                  <ChevronDown size={14} />
                </button>
              )}
            </div>
          )}

          {/* ================= CHẾ ĐỘ 2: TOÀN BỘ CÁC BỮA TRONG NGÀY (ACCORDION THU GỌN) ================= */}
          {viewMode === 'all' && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs text-slate-500 px-1">
                <span>Toàn bộ thực đơn {activeDay.dayOfWeek} ({activeDay.meals.length} bữa)</span>
                <button
                  type="button"
                  onClick={() => setViewMode('realtime')}
                  className="text-sky-600 font-bold hover:underline bg-transparent border-none cursor-pointer p-0"
                >
                  ⚡ Quay lại bữa hiện tại
                </button>
              </div>

              {activeDay.meals.map((meal, mIdx) => {
                const isCurrent = realtimeMealInfo?.index === mIdx && isViewingToday;
                const isExpanded = Boolean(expandedMeals[mIdx]);

                return (
                  <div
                    key={meal.id || mIdx}
                    className={`rounded-xl border transition-all overflow-hidden bg-white ${
                      isCurrent
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* DÒNG TIÊU ĐỀ BỮA ĂN (CLICK ĐỂ MỞ XEM MÓN) */}
                    <div
                      onClick={() => toggleMeal(mIdx)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-md text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                            isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
                          }`}
                        >
                          {mIdx + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{meal.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                ● Giờ này
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            {meal.timeSlot && <span>{meal.timeSlot}</span>}
                            <span>•</span>
                            <span>{meal.items?.length || 0} món</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {meal.calories ? (
                          <span className="text-xs font-bold text-slate-700">
                            {meal.calories} kcal
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMeal(mIdx);
                          }}
                          className="text-sky-600 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded border border-sky-200 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        >
                          <span>{isExpanded ? 'Thu gọn' : 'Xem món'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* MỞ RỘNG CHI TIẾT MÓN ĂN KHI BẤM XEM */}
                    {isExpanded && (
                      <div className="p-3 pt-0 border-t border-slate-100 bg-slate-50/50 space-y-2">
                        {meal.imageUrl && (
                          <div
                            className="w-full h-32 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 mt-2 cursor-pointer group"
                            onClick={() => setPreviewImage({ url: meal.imageUrl!, title: meal.name })}
                            title="Bấm để xem ảnh lớn"
                          >
                            <img
                              src={meal.imageUrl}
                              alt={meal.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}

                        {Array.isArray(meal.items) && meal.items.length > 0 ? (
                          <div className="space-y-1.5 mt-2">
                            {meal.items.map((item, iIdx) => (
                              <div
                                key={iIdx}
                                className="flex items-center gap-2.5 p-2 rounded bg-white border border-slate-200 text-xs"
                              >
                                {item.imageUrl && (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.name })}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                                    title="Bấm để xem ảnh món ăn chi tiết"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-slate-800">{item.name}</div>
                                  {item.prepTip && (
                                    <div className="text-[11px] text-slate-500 italic mt-0.5">
                                      💡 {item.prepTip}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {item.amount && (
                                    <span className="font-bold text-sky-700">{item.amount}</span>
                                  )}
                                  {item.calories ? (
                                    <div className="text-[10px] text-slate-400">
                                      {item.calories} kcal
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic py-1">
                            Chưa có chi tiết món ăn.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ================= GHI CHÚ TỪ PT (CHỈ MỞ KHI BẤM VÀO) ================= */}
          {plan.notes && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowNotes((prev) => !prev)}
                className="w-full p-2.5 flex justify-between items-center font-bold text-slate-700 bg-transparent border-none cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-blue-900">
                  <Info size={14} className="text-blue-600 shrink-0" />
                  <span>Lưu ý từ Huấn Luyện Viên</span>
                </div>
                {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showNotes && (
                <div className="p-3 pt-0 text-slate-600 border-t border-slate-100 bg-slate-50/50 leading-relaxed whitespace-pre-line">
                  {plan.notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= FOOTER GỌN GÀNG ================= */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500">
            Tổng ngày: <strong className="text-slate-800">🔥 {dayTotalCalories > 0 ? dayTotalCalories.toLocaleString() : plan.targetCalories?.toLocaleString() || '—'} kcal</strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>

        {/* Modal xem preview ảnh món ăn phóng to */}
        <MealImagePreviewModal
          previewImage={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      </div>
    </div>
  );
};
