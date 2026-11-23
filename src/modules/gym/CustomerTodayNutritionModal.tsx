import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Flame,
  Info,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import type { GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import { secondary } from "./ui";

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

const VIETNAMESE_DAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const EMPTY_DAY_PLAN: DayPlan = { meals: [] };

export function MealImagePreviewModal({
  previewImage,
  onClose,
}: {
  previewImage: { url: string; title: string } | null;
  onClose: () => void;
}) {
  if (!previewImage) return null;
  return (
    <ErpModal
      native
      title={previewImage.title}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3">
        <div className="flex justify-end">
          <a
            href={previewImage.url}
            download={`meal_${Date.now()}.jpg`}
            target="_blank"
            rel="noreferrer"
            className={secondary}
          >
            <Download className="size-3.5" aria-hidden="true" />
            Tải ảnh
          </a>
        </div>
        <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-low">
          <img
            src={previewImage.url}
            alt={previewImage.title}
            className="max-h-[70dvh] w-full object-contain"
          />
        </div>
      </div>
    </ErpModal>
  );
}

function parseTimeRange(timeSlot?: string) {
  if (!timeSlot) return null;
  const parts = timeSlot.split(/[-–]/).map((s) => s.trim());
  if (parts.length === 1 && /^\d{1,2}:\d{2}$/.test(parts[0])) {
    const [h, m] = parts[0].split(":").map(Number);
    if (!Number.isFinite(h)) return null;
    const start = h * 60 + (m || 0);
    return { startMinutes: start, endMinutes: start + 60 };
  }
  if (parts.length < 2) return null;
  const [startH, startM] = parts[0].split(":").map(Number);
  const [endH, endM] = parts[1].split(":").map(Number);
  if (!Number.isFinite(startH) || !Number.isFinite(endH)) return null;
  return {
    startMinutes: startH * 60 + (startM || 0),
    endMinutes: endH * 60 + (endM || 0),
  };
}

export function normalizePlanDays(plan: GymRecord | null): DayPlan[] {
  if (!plan) return [];

  // Structure 1: Hierarchical weeks (menu[].days[])
  if (Array.isArray(plan.menu) && plan.menu.length > 0 && plan.menu[0]?.days) {
    const allDays: DayPlan[] = [];
    for (const week of plan.menu) {
      if (Array.isArray(week.days)) {
        for (const day of week.days) {
          allDays.push({
            dayNumber: day.dayNumber,
            dayOfWeek: day.dayOfWeek || `Ngày ${day.dayNumber}`,
            date: day.date,
            meals: Array.isArray(day.meals) ? day.meals : [],
          });
        }
      }
    }
    if (allDays.length > 0) return allDays;
  }

  // Structure 2: dailyPlans array
  if (Array.isArray(plan.dailyPlans) && plan.dailyPlans.length > 0) {
    return plan.dailyPlans.map((d: any, idx: number) => ({
      dayNumber: d.dayNumber || idx + 1,
      dayOfWeek: d.dayOfWeek || VIETNAMESE_DAYS[(idx + 1) % 7],
      date: d.date,
      meals: Array.isArray(d.meals) ? d.meals : [],
    }));
  }

  // Structure 3: menu is array of days (menu[].meals)
  if (Array.isArray(plan.menu) && plan.menu.length > 0 && plan.menu[0]?.meals) {
    return plan.menu.map((d: any, idx: number) => ({
      dayNumber: idx + 1,
      dayOfWeek: d.dayOfWeek || `Ngày ${idx + 1}`,
      date: d.date,
      meals: Array.isArray(d.meals) ? d.meals : [],
    }));
  }

  // Structure 4: flat meal list applied every day
  if (Array.isArray(plan.menu) && plan.menu.length > 0) {
    return [
      {
        dayNumber: 1,
        dayOfWeek: "Hàng ngày",
        meals: plan.menu.map((m: any, idx: number) => ({
          name: m.name || m.meal || `Bữa ${idx + 1}`,
          timeSlot: m.timeSlot || m.time || "",
          calories: m.calories || 0,
          imageUrl: m.imageUrl,
          items: Array.isArray(m.items)
            ? m.items
            : m.foods
              ? [
                  {
                    name: String(m.foods),
                    calories: Number(m.calories || 0),
                    protein: Number(m.protein || 0),
                    carbs: Number(m.carbs || 0),
                    fat: Number(m.fat || 0),
                  },
                ]
              : [],
        })),
      },
    ];
  }

  return [];
}

export function CustomerTodayNutritionModal({
  plan,
  customerName,
  onClose,
}: {
  plan: GymRecord | null;
  customerName?: string;
  onClose: () => void;
}) {
  const now = new Date();
  const currentDayOfWeekName = VIETNAMESE_DAYS[now.getDay()];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeNumber = currentHour * 60 + currentMinute;
  const currentTimeString = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  const normalizedDays = useMemo(() => normalizePlanDays(plan), [plan]);

  const todayDayIndex = useMemo(() => {
    if (normalizedDays.length === 0) return 0;
    const todayIso = now.toLocaleDateString("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const indexByDate = normalizedDays.findIndex((d) =>
      d.date?.startsWith(todayIso),
    );
    if (indexByDate !== -1) return indexByDate;

    const indexByDayOfWeek = normalizedDays.findIndex((d) =>
      d.dayOfWeek?.toLowerCase().includes(currentDayOfWeekName.toLowerCase()),
    );
    if (indexByDayOfWeek !== -1) return indexByDayOfWeek;

    const dayMapIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    if (normalizedDays[dayMapIndex]) return dayMapIndex;
    return 0;
  }, [normalizedDays, currentDayOfWeekName]);

  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(todayDayIndex);
  useEffect(() => {
    setSelectedDayIdx(todayDayIndex);
  }, [plan?._id, todayDayIndex]);

  const activeDay = useMemo(
    () => normalizedDays[selectedDayIdx] || normalizedDays[0] || EMPTY_DAY_PLAN,
    [normalizedDays, selectedDayIdx],
  );
  const isViewingToday = selectedDayIdx === todayDayIndex;

  const [viewMode, setViewMode] = useState<"realtime" | "all">("realtime");
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [expandedMeals, setExpandedMeals] = useState<Record<number, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const realtimeMealInfo = useMemo(() => {
    const meals = activeDay.meals || [];
    if (meals.length === 0) return null;

    if (!isViewingToday) {
      return {
        meal: meals[0],
        index: 0,
        status: "SELECTED" as const,
        label: meals[0].name,
      };
    }

    for (let i = 0; i < meals.length; i++) {
      const range = parseTimeRange(meals[i].timeSlot);
      if (
        range &&
        currentTimeNumber >= range.startMinutes &&
        currentTimeNumber <= range.endMinutes
      ) {
        return {
          meal: meals[i],
          index: i,
          status: "CURRENT" as const,
          label: "Đang trong giờ ăn",
        };
      }
    }

    for (let i = 0; i < meals.length; i++) {
      const range = parseTimeRange(meals[i].timeSlot);
      if (range && range.startMinutes > currentTimeNumber) {
        return {
          meal: meals[i],
          index: i,
          status: "UPCOMING" as const,
          label: "Bữa ăn tiếp theo",
        };
      }
    }

    let fallbackIdx = 0;
    if (currentHour < 10) fallbackIdx = 0;
    else if (currentHour < 14) fallbackIdx = Math.min(1, meals.length - 1);
    else if (currentHour < 17) fallbackIdx = Math.min(2, meals.length - 1);
    else fallbackIdx = Math.min(meals.length > 3 ? 3 : 2, meals.length - 1);

    const isAfterAll = currentHour >= 21;
    return {
      meal: meals[fallbackIdx],
      index: fallbackIdx,
      status: isAfterAll ? ("COMPLETED" as const) : ("CURRENT" as const),
      label: isAfterAll ? "Bữa ăn cuối ngày hôm nay" : "Bữa ăn hiện tại",
    };
  }, [activeDay, currentTimeNumber, currentHour, isViewingToday]);

  const toggleMeal = (mIdx: number) => {
    setExpandedMeals((prev) => ({ ...prev, [mIdx]: !prev[mIdx] }));
  };

  const mealCalories = (m: Meal) =>
    m.calories ||
    m.items?.reduce((s, i) => s + (Number(i.calories) || 0), 0) ||
    0;

  const dayTotalCalories = useMemo(
    () => activeDay.meals.reduce((total, m) => total + mealCalories(m), 0),
    [activeDay],
  );

  if (!plan) return null;

  const currentMeal = realtimeMealInfo?.meal;

  return (
    <>
      <ErpModal
        native
        title={`Hôm nay ăn gì: ${customerName || "Học viên"}`}
        onClose={onClose}
        maxWidth="max-w-xl"
      >
        <div className="space-y-3">
          {/* Realtime context header */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low/60 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-change-up/15 px-2.5 py-0.5 font-semibold text-change-up tabular-nums">
                <span className="size-1.5 rounded-full bg-change-up" aria-hidden="true" />
                Thời gian thực · {currentTimeString}
              </span>
              <span className="font-medium text-on-surface-variant">
                {activeDay.dayOfWeek}
                {activeDay.date ? ` (${String(activeDay.date).slice(0, 10)})` : ""}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 font-semibold text-on-surface">
              <Utensils className="size-3.5 text-primary" aria-hidden="true" />
              {plan.title || "Thực đơn Dinh dưỡng"}
            </span>
          </div>

          {/* Mode toggle + Day selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low/40 px-3 py-2 text-xs">
            <div className="inline-flex rounded-md border border-outline-variant bg-surface-container p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === "realtime"}
                onClick={() => setViewMode("realtime")}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 font-semibold transition-colors",
                  viewMode === "realtime"
                    ? "bg-surface-container-lowest text-primary shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                Bữa hiện tại
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "all"}
                onClick={() => setViewMode("all")}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 font-semibold transition-colors",
                  viewMode === "all"
                    ? "bg-surface-container-lowest text-primary shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                Cả ngày ({activeDay.meals.length} bữa)
              </button>
            </div>

            <div className="flex items-center gap-2">
              {normalizedDays.length > 1 && (
                <button
                  type="button"
                  aria-expanded={showDaySelector}
                  onClick={() => setShowDaySelector((prev) => !prev)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors",
                    showDaySelector
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container",
                  )}
                >
                  <Calendar className="size-3.5" aria-hidden="true" />
                  <span>{isViewingToday ? "Hôm nay" : activeDay.dayOfWeek}</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      showDaySelector && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
              )}
              {!isViewingToday && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayIdx(todayDayIndex);
                    setShowDaySelector(false);
                  }}
                  className="cursor-pointer font-semibold text-primary hover:underline"
                >
                  Về hôm nay
                </button>
              )}
            </div>
          </div>

          {showDaySelector && normalizedDays.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto rounded-md border border-outline-variant bg-surface-container-low/50 p-2">
              {normalizedDays.map((d, idx) => {
                const isToday = idx === todayDayIndex;
                const isSelected = idx === selectedDayIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedDayIdx(idx);
                      setShowDaySelector(false);
                    }}
                    className={cn(
                      "shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-on-primary"
                        : isToday
                          ? "border-change-up/40 bg-change-up/10 text-change-up"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    <span>
                      {d.dayNumber ? `Ngày ${d.dayNumber} · ` : ""}
                      {d.dayOfWeek}
                    </span>
                    {isToday && <span className="ml-1 opacity-80">(Hôm nay)</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Main scrollable meal body */}
          <div className="max-h-[58dvh] space-y-3 overflow-y-auto pr-0.5">
            {viewMode === "realtime" && (
              <div className="space-y-3">
                {currentMeal ? (
                  <div className="overflow-hidden rounded-lg border-2 border-change-up/50 bg-surface-container-lowest shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-change-up/20 bg-change-up/8 px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-change-up px-2 py-0.5 text-[11px] font-semibold text-on-primary">
                          <Sparkles className="size-3" aria-hidden="true" />
                          {realtimeMealInfo?.label}
                        </span>
                        <strong className="text-sm font-semibold text-on-surface">
                          {currentMeal.name}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                        {currentMeal.timeSlot && (
                          <span className="inline-flex items-center gap-1 text-on-surface-variant font-medium">
                            <Clock className="size-3" aria-hidden="true" />
                            {currentMeal.timeSlot}
                          </span>
                        )}
                        {mealCalories(currentMeal) > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-error-container/50 px-2 py-0.5 text-error">
                            <Flame className="size-3" aria-hidden="true" />
                            {mealCalories(currentMeal)} kcal
                          </span>
                        )}
                      </div>
                    </div>

                    {currentMeal.imageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: currentMeal.imageUrl!,
                            title: currentMeal.name,
                          })
                        }
                        className="relative block h-44 w-full cursor-pointer overflow-hidden bg-surface-container"
                        title="Bấm để xem ảnh lớn"
                      >
                        <img
                          src={currentMeal.imageUrl}
                          alt={currentMeal.name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                    )}

                    <div className="space-y-2 p-3.5">
                      <p className="text-[11px] font-semibold uppercase text-on-surface-variant">
                        Món ăn &amp; định lượng ({currentMeal.items?.length || 0} món)
                      </p>
                      {Array.isArray(currentMeal.items) &&
                      currentMeal.items.length > 0 ? (
                        <div className="space-y-2">
                          {currentMeal.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 rounded-md border border-outline-variant/70 bg-surface-container-low/40 p-2.5"
                            >
                              {item.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: item.imageUrl!,
                                      title: item.name,
                                    })
                                  }
                                  className="shrink-0 cursor-pointer overflow-hidden rounded-md border border-outline-variant"
                                  aria-label={`Xem ảnh ${item.name}`}
                                >
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="size-12 object-cover"
                                  />
                                </button>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-on-surface">
                                  {item.name}
                                </p>
                                {item.prepTip && (
                                  <p className="mt-0.5 text-xs italic text-on-surface-variant">
                                    Mẹo: {item.prepTip}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 text-right tabular-nums">
                                {item.amount && (
                                  <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                    {item.amount}
                                  </span>
                                )}
                                {item.calories ? (
                                  <p className="mt-0.5 text-[11px] text-on-surface-variant">
                                    {item.calories} kcal
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-2 text-xs italic text-on-surface-variant">
                          Chưa có chi tiết thực phẩm cụ thể cho bữa này.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-low/40 py-8 text-center text-xs text-on-surface-variant">
                    Không tìm thấy dữ liệu bữa ăn cho ngày hôm nay.
                  </div>
                )}

                {activeDay.meals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low/50 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span>
                      Xem thêm {activeDay.meals.length - 1} bữa khác trong ngày
                    </span>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {viewMode === "all" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5 text-xs text-on-surface-variant">
                  <span>
                    Toàn bộ thực đơn {activeDay.dayOfWeek} ({activeDay.meals.length} bữa)
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewMode("realtime")}
                    className="cursor-pointer font-semibold text-primary hover:underline"
                  >
                    Quay lại bữa hiện tại
                  </button>
                </div>

                {activeDay.meals.map((meal, mIdx) => {
                  const isCurrent =
                    realtimeMealInfo?.index === mIdx && isViewingToday;
                  const isExpanded = Boolean(expandedMeals[mIdx]);
                  const kcal = mealCalories(meal);

                  return (
                    <div
                      key={meal.id || mIdx}
                      className={cn(
                        "overflow-hidden rounded-lg border bg-surface-container-lowest transition-colors",
                        isCurrent
                          ? "border-change-up/60 ring-1 ring-change-up/25"
                          : "border-outline-variant",
                      )}
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleMeal(mIdx)}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-surface-container-low/60"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-on-primary",
                              isCurrent ? "bg-change-up" : "bg-on-surface/75",
                            )}
                          >
                            {mIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-on-surface">
                                {meal.name}
                              </span>
                              {isCurrent && (
                                <span className="rounded bg-change-up/15 px-1.5 py-0.5 text-[10px] font-semibold text-change-up">
                                  Giờ này
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-on-surface-variant">
                              {meal.timeSlot ? `${meal.timeSlot} · ` : ""}
                              {meal.items?.length || 0} món
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {kcal > 0 && (
                            <span className="text-xs font-semibold tabular-nums text-on-surface">
                              {kcal} kcal
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
                            {isExpanded ? "Thu gọn" : "Xem món"}
                            {isExpanded ? (
                              <ChevronUp className="size-3" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="size-3" aria-hidden="true" />
                            )}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="space-y-2 border-t border-outline-variant/60 bg-surface-container-low/40 p-3">
                          {meal.imageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImage({
                                  url: meal.imageUrl!,
                                  title: meal.name,
                                })
                              }
                              className="block h-32 w-full cursor-pointer overflow-hidden rounded-md border border-outline-variant"
                            >
                              <img
                                src={meal.imageUrl}
                                alt={meal.name}
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            </button>
                          )}
                          {Array.isArray(meal.items) && meal.items.length > 0 ? (
                            <div className="space-y-1.5">
                              {meal.items.map((item, iIdx) => (
                                <div
                                  key={iIdx}
                                  className="flex items-center gap-2.5 rounded-md border border-outline-variant/70 bg-surface-container-lowest p-2 text-xs"
                                >
                                  {item.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewImage({
                                          url: item.imageUrl!,
                                          title: item.name,
                                        })
                                      }
                                      className="shrink-0 cursor-pointer overflow-hidden rounded border border-outline-variant"
                                      aria-label={`Xem ảnh ${item.name}`}
                                    >
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="size-10 object-cover"
                                      />
                                    </button>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-on-surface">
                                      {item.name}
                                    </p>
                                    {item.prepTip && (
                                      <p className="mt-0.5 text-[11px] italic text-on-surface-variant">
                                        {item.prepTip}
                                      </p>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right tabular-nums">
                                    {item.amount && (
                                      <span className="font-semibold text-primary">
                                        {item.amount}
                                      </span>
                                    )}
                                    {item.calories ? (
                                      <p className="text-[11px] text-on-surface-variant">
                                        {item.calories} kcal
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs italic text-on-surface-variant">
                              Chưa có chi tiết món ăn.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {plan.notes && (
              <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest text-xs">
                <button
                  type="button"
                  aria-expanded={showNotes}
                  onClick={() => setShowNotes((prev) => !prev)}
                  className="flex w-full cursor-pointer items-center justify-between px-3 py-2 font-semibold text-on-surface hover:bg-surface-container-low/50"
                >
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <Info className="size-3.5 shrink-0" aria-hidden="true" />
                    Lưu ý từ Huấn luyện viên
                  </span>
                  {showNotes ? (
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  )}
                </button>
                {showNotes && (
                  <p className="whitespace-pre-line border-t border-outline-variant/60 bg-surface-container-low/40 p-3 leading-relaxed text-on-surface-variant">
                    {plan.notes}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-outline-variant pt-3 text-xs">
            <span className="text-on-surface-variant tabular-nums">
              Tổng ngày:{" "}
              <strong className="text-on-surface">
                {(dayTotalCalories > 0
                  ? dayTotalCalories
                  : Number(plan.targetCalories || 0)
                ).toLocaleString("vi-VN")}{" "}
                kcal
              </strong>
            </span>
            <button type="button" className={secondary} onClick={onClose}>
              <X className="size-3.5" aria-hidden="true" />
              Đóng
            </button>
          </div>
        </div>
      </ErpModal>

      <MealImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}
