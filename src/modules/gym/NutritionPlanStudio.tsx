import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Flame,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Salad,
  Save,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { MealImagePreviewModal } from "./CustomerTodayNutritionModal";
import MealSwapperModal from "./MealSwapperModal";
import { CustomerPicker, Feedback, messageOf, primary, secondary, useGymQuery } from "./ui";
import {
  buildMealsFromTemplate,
  randomizeDayMeals,
  VIETNAMESE_7DAYS_TEMPLATES,
} from "./nutritionVariationEngine";

type Food = {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTip?: string;
  imageUrl?: string;
};

type Meal = {
  id: string;
  name: string;
  timeSlot: string;
  items: Food[];
  imageUrl?: string;
};

type Day = {
  dayNumber: number;
  date: string;
  dayOfWeek: string;
  meals: Meal[];
};

const DAYS_OF_WEEK_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

const DIET_STYLES = [
  { id: "Món Việt dễ nấu", label: "VN Món Việt dễ nấu / Tiết kiệm" },
  { id: "Eat Clean", label: "Eat Clean" },
  { id: "Cơm văn phòng", label: "Cơm Văn Phòng / Ăn Ngoài" },
  { id: "Ăn chay giàu Protein", label: "Ăn Chay Giàu Protein" },
] as const;

const MEAL_COUNT_OPTIONS = [
  { value: 3, label: "3 Bữa" },
  { value: 4, label: "4 Bữa" },
  { value: 5, label: "5 Bữa" },
  { value: 2, label: "2 Bữa (IF 16/8)" },
] as const;

const SCHEDULE_PRESETS = [
  "Tập chiều 17h30 - 19h00 (Phổ biến)",
  "Tập sáng sớm 06h00 - 07h30",
  "Tập tối 19h30 - 21h00",
  "Làm văn phòng ngồi nhiều",
] as const;

const ALLERGY_CHIPS = [
  "Dị ứng hải sản (tôm, cua)",
  "Không dung nạp lactose (sữa bò)",
  "Không ăn thịt đỏ (bò/heo)",
  "Không ăn cay / tiêu",
  "Không ăn trứng gà",
  "Không ăn đồ sống",
] as const;

const KCAL_PRESETS = [1500, 1800, 2000, 2200, 2500] as const;

const DURATION_PRESETS = [
  { days: 3, label: "3 ngày" },
  { days: 7, label: "7 ngày (1 tuần)" },
  { days: 14, label: "14 ngày (2 tuần)" },
  { days: 21, label: "21 ngày (3 tuần)" },
  { days: 30, label: "30 ngày (1 tháng)" },
] as const;

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatDisplayDate = (iso: string) => {
  if (!iso) return "";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

const dayOfWeekVi = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return DAYS_OF_WEEK_VI[d.getUTCDay()] || "Thứ Hai";
};

const manualSeedMeal = (index = 0): Meal => ({
  id: globalThis.crypto?.randomUUID?.() || `meal-${Date.now()}-${index}`,
  name: `Bữa ${index + 1}`,
  timeSlot: "15:00",
  items: [
    {
      name: "Món ăn dinh dưỡng",
      amount: "150g",
      calories: 150,
      protein: 10,
      carbs: 15,
      fat: 5,
    },
  ],
});

const emptyDay = (number: number, start: string, withInitialMeal = false): Day => {
  const date = addDays(start, number - 1);
  return {
    dayNumber: number,
    date,
    dayOfWeek: dayOfWeekVi(date),
    meals: withInitialMeal ? [manualSeedMeal(0)] : [],
  };
};

function normalizeDays(
  record: GymRecord | undefined,
  prefill: Record<string, any> | undefined,
  start: string,
  count: number,
  seedFirstDayManual: boolean,
): Day[] {
  const daily = prefill?.dailyPlans || record?.dailyPlans;
  const weekly = prefill?.menu?.[0]?.days
    ? prefill.menu
    : record?.menu?.[0]?.days
      ? record.menu
      : [];
  const legacy =
    !weekly.length && !daily?.length ? prefill?.menu || record?.menu || [] : [];
  const hasSourceData = Boolean(
    (Array.isArray(daily) && daily.length > 0) ||
      (Array.isArray(weekly) && weekly.length > 0) ||
      (Array.isArray(legacy) && legacy.length > 0),
  );

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const raw =
      daily?.find((item: any) => Number(item.dayNumber) === number) ||
      weekly[Math.floor(index / 7)]?.days?.find(
        (item: any) => Number(item.dayNumber) === number,
      ) ||
      (Array.isArray(daily) && daily.length > 0 ? daily[index % daily.length] : undefined);

    const base = emptyDay(number, start, !hasSourceData && seedFirstDayManual && index === 0);
    if (!raw && !legacy.length) return base;
    const sourceMeals = raw?.meals || (index === 0 ? legacy : []) || [];
    return {
      ...base,
      date: raw?.date?.slice(0, 10) || base.date,
      dayOfWeek: raw?.dayOfWeek || base.dayOfWeek,
      meals: sourceMeals.map((meal: any, mealIndex: number) => ({
        id: String(
          meal.id ||
            globalThis.crypto?.randomUUID?.() ||
            `${number}-${mealIndex}`,
        ),
        name: meal.name || `Bữa ${mealIndex + 1}`,
        timeSlot: meal.timeSlot || meal.time || "15:00",
        imageUrl: meal.imageUrl,
        items:
          Array.isArray(meal.items) && meal.items.length
            ? meal.items.map((item: any) => ({
                name: item.name || "Món ăn dinh dưỡng",
                amount: item.amount || "150g",
                calories: Number(item.calories || 0),
                protein: Number(item.protein || 0),
                carbs: Number(item.carbs || 0),
                fat: Number(item.fat || 0),
                prepTip: item.prepTip || "",
                imageUrl: item.imageUrl,
              }))
            : meal.foods
              ? [
                  {
                    name: meal.foods,
                    amount: "1 khẩu phần",
                    calories: Number(meal.calories || 0),
                    protein: Number(meal.protein || 0),
                    carbs: Number(meal.carbs || 0),
                    fat: Number(meal.fat || 0),
                  },
                ]
              : [],
      })),
    };
  });
}

const sum = (items: Food[], key: "calories" | "protein" | "carbs" | "fat") =>
  items.reduce((total, item) => total + Number(item[key] || 0), 0);

const cloneMeals = (meals: Meal[]) =>
  meals.map((meal) => ({
    ...meal,
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    items: meal.items.map((item) => ({ ...item })),
  }));

const fromVariation = (meals: ReturnType<typeof buildMealsFromTemplate>): Meal[] =>
  meals.map((meal) => ({ ...meal }));

export default function NutritionPlanStudio({
  api,
  record,
  prefill,
  fixedCustomerId,
  initialMode = "manual",
  onBack,
  onSaved,
}: {
  api: GymApi;
  record?: GymRecord;
  prefill?: Record<string, any>;
  fixedCustomerId?: string;
  initialMode?: "ai" | "manual";
  onBack: () => void;
  onSaved: () => void;
}) {
  const initial = { ...record, ...prefill };
  const initialStart = String(initial.startDate || today()).slice(0, 10);
  const initialDuration = Math.max(
    1,
    Math.min(
      31,
      Number(initial.durationDays || initial.dailyPlans?.length || 7),
    ),
  );
  const isEditingExistingPlan = Boolean(record?._id);
  const hasPrefilledMeals = Boolean(
    record?.dailyPlans?.length ||
      record?.menu?.length ||
      prefill?.dailyPlans?.length ||
      prefill?.menu?.length,
  );

  const [customerId, setCustomerId] = useState(
    fixedCustomerId || record?.customerId || prefill?.customerId || "",
  );
  const [title, setTitle] = useState(String(initial.title || ""));
  const [startDate, setStartDate] = useState(initialStart);
  const [durationDays, setDurationDays] = useState(initialDuration);
  const [endDate, setEndDate] = useState(
    addDays(initialStart, initialDuration - 1),
  );
  const [targetKcalInput, setTargetKcalInput] = useState(
    String(initial.targetCalories || 1850),
  );
  const [bmr] = useState<number | null>(initial.bmr ?? null);
  const [tdee] = useState<number | null>(initial.tdee ?? null);
  const [notes, setNotes] = useState(String(initial.notes || ""));
  const [isEditingAdvice, setIsEditingAdvice] = useState(false);

  const [days, setDays] = useState<Day[]>(() =>
    normalizeDays(
      record,
      prefill,
      initialStart,
      initialDuration,
      !isEditingExistingPlan && !hasPrefilledMeals && initialMode === "manual",
    ),
  );
  const [activeDay, setActiveDay] = useState(1);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [swapTarget, setSwapTarget] = useState<{ meal: number; food?: number }>();
  const [swapOpenStandalone, setSwapOpenStandalone] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [generatingItemKey, setGeneratingItemKey] = useState<string | null>(null);
  const [generatingAllMealIdx, setGeneratingAllMealIdx] = useState<number | null>(null);

  // 3S MealAiConfigStudio state
  const [showConfigStudio, setShowConfigStudio] = useState(
    !isEditingExistingPlan && !hasPrefilledMeals && initialMode === "ai",
  );
  const [aiMealCount, setAiMealCount] = useState(4);
  const [aiDietStyle, setAiDietStyle] = useState<string>(DIET_STYLES[0].id);
  const [aiBudget, setAiBudget] = useState("STANDARD");
  const [aiSchedule, setAiSchedule] = useState(
    "Tập gym chiều 17h30 - 19h00, làm văn phòng ngồi nhiều",
  );
  const [aiAllergies, setAiAllergies] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [mealAiProgress, setMealAiProgress] = useState(0);
  const [mealAiStage, setMealAiStage] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);

  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=200", 0);
  const selectedCustomer = useMemo(
    () => (customersQuery.data?.data || []).find((c) => c._id === customerId),
    [customersQuery.data, customerId],
  );
  const effectiveCustomerName = selectedCustomer?.fullName || "";

  const library = useGymQuery<GymList>(
    api,
    "/food-images?limit=200",
    libraryRevision,
  );
  const libraryFoods = library.data?.data || [];

  useEffect(() => {
    if (!aiBusy) {
      setMealAiProgress(0);
      setMealAiStage(0);
      return;
    }
    setMealAiProgress(18);
    setMealAiStage(1);
    const t1 = window.setTimeout(() => {
      setMealAiProgress(45);
      setMealAiStage(2);
    }, 900);
    const t2 = window.setTimeout(() => {
      setMealAiProgress(74);
      setMealAiStage(3);
    }, 2000);
    const t3 = window.setTimeout(() => {
      setMealAiProgress(92);
      setMealAiStage(4);
    }, 3200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [aiBusy]);

  const current = days[activeDay - 1] || days[0];
  const meals = current?.meals || [];
  const hasAnyMeals = days.some((d) => d.meals.length > 0);
  const activeWeek = Math.floor((activeDay - 1) / 7) + 1;
  const totalWeeks = Math.max(1, Math.ceil(durationDays / 7));
  const weekDays = days.slice((activeWeek - 1) * 7, activeWeek * 7);
  const weekStart = weekDays[0]?.date || startDate;
  const weekEnd = weekDays[weekDays.length - 1]?.date || endDate;

  const totalKcal = meals.reduce(
    (acc, meal) => acc + sum(meal.items, "calories"),
    0,
  );
  const totalProtein = meals.reduce(
    (acc, meal) => acc + sum(meal.items, "protein"),
    0,
  );
  const totalCarbs = meals.reduce(
    (acc, meal) => acc + sum(meal.items, "carbs"),
    0,
  );
  const totalFat = meals.reduce((acc, meal) => acc + sum(meal.items, "fat"), 0);
  const targetCalories = Math.max(500, Number(targetKcalInput) || 1850);

  const mutate = (fn: () => void) => {
    setDirty(true);
    fn();
  };

  const handleStartDateChange = (nextStart: string) => {
    if (!nextStart) return;
    const nextEnd = addDays(nextStart, durationDays - 1);
    mutate(() => {
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setDays((prev) =>
        prev.map((day, idx) => {
          const d = addDays(nextStart, idx);
          return {
            ...day,
            date: d,
            dayOfWeek: dayOfWeekVi(d),
          };
        }),
      );
    });
  };

  const handleDurationPreset = (nextDuration: number) => {
    const clamped = Math.max(1, Math.min(31, nextDuration));
    const nextEnd = addDays(startDate, clamped - 1);
    mutate(() => {
      setDurationDays(clamped);
      setEndDate(nextEnd);
      setDays((prev) =>
        Array.from({ length: clamped }, (_, idx) => {
          if (prev[idx]) {
            const d = addDays(startDate, idx);
            return { ...prev[idx], date: d, dayOfWeek: dayOfWeekVi(d) };
          }
          return emptyDay(idx + 1, startDate, false);
        }),
      );
      setActiveDay((curr) => Math.min(curr, clamped));
    });
  };

  const handleEndDateChange = (nextEnd: string) => {
    if (!nextEnd) return;
    const s = new Date(`${startDate}T12:00:00Z`).getTime();
    const e = new Date(`${nextEnd}T12:00:00Z`).getTime();
    const diff = Math.round((e - s) / 86400000) + 1;
    const clamped = Math.max(1, Math.min(31, Number.isFinite(diff) ? diff : 7));
    handleDurationPreset(clamped);
  };

  const updateMeals = (nextMeals: Meal[]) =>
    mutate(() =>
      setDays((previous) =>
        previous.map((day, index) =>
          index === activeDay - 1 ? { ...day, meals: nextMeals } : day,
        ),
      ),
    );

  const updateMeal = (index: number, patch: Partial<Meal>) =>
    updateMeals(
      current.meals.map((meal, position) =>
        position === index ? { ...meal, ...patch } : meal,
      ),
    );

  const updateFood = (
    mealIndex: number,
    foodIndex: number,
    patch: Partial<Food>,
  ) =>
    updateMeal(mealIndex, {
      items: current.meals[mealIndex].items.map((food, index) =>
        index === foodIndex ? { ...food, ...patch } : food,
      ),
    });

  const handleAddMealBlock = () => {
    updateMeals([...(current?.meals || []), manualSeedMeal(current?.meals.length || 0)]);
  };

  const handleAddItem = (mealIndex: number) => {
    const meal = current.meals[mealIndex];
    if (!meal) return;
    updateMeal(mealIndex, {
      items: [
        ...meal.items,
        {
          name: "Món ăn mới",
          amount: "100g",
          calories: 120,
          protein: 15,
          carbs: 10,
          fat: 2,
          prepTip: "Chế biến ít dầu mỡ",
        },
      ],
    });
  };

  const copyDay = (scope: "week" | "all") => {
    const source = current.meals;
    if (!source.length) {
      setError("Chưa có bữa ăn nào trong ngày hiện tại để sao chép.");
      return;
    }
    setError("");
    mutate(() =>
      setDays((previous) =>
        previous.map((day) =>
          day.dayNumber === activeDay ||
          (scope === "week" &&
            Math.floor((day.dayNumber - 1) / 7) + 1 !== activeWeek)
            ? day
            : { ...day, meals: cloneMeals(source) },
        ),
      ),
    );
  };

  const copyWeek = () => {
    const source = days.slice((activeWeek - 1) * 7, activeWeek * 7);
    if (!source.length) return;
    mutate(() =>
      setDays((previous) =>
        previous.map((day) =>
          Math.floor((day.dayNumber - 1) / 7) + 1 === activeWeek
            ? day
            : {
                ...day,
                meals: cloneMeals(
                  source[((day.dayNumber - 1) % 7) % source.length].meals,
                ),
              },
        ),
      ),
    );
  };

  const randomizeDay = () => {
    if (!current.meals.length) {
      setError("Chưa có bữa ăn nào trong ngày để đổi món.");
      return;
    }
    setError("");
    updateMeals(
      fromVariation(
        randomizeDayMeals(
          current.meals.map((meal) => ({
            ...meal,
            targetKcal: sum(meal.items, "calories"),
          })),
          targetCalories,
          current.dayOfWeek,
        ),
      ),
    );
  };

  const randomizeWeek = () => {
    const currentWeek = activeWeek;
    const offset = Math.floor(Math.random() * VIETNAMESE_7DAYS_TEMPLATES.length);
    mutate(() =>
      setDays((previous) =>
        previous.map((day) =>
          Math.floor((day.dayNumber - 1) / 7) + 1 !== currentWeek
            ? day
            : {
                ...day,
                meals: fromVariation(
                  buildMealsFromTemplate(
                    VIETNAMESE_7DAYS_TEMPLATES[
                      (day.dayNumber - 1 + offset) %
                        VIETNAMESE_7DAYS_TEMPLATES.length
                    ],
                    targetCalories,
                    current.meals.length || aiMealCount || 4,
                  ),
                ),
              },
        ),
      ),
    );
  };

  const handleGenerateItemImage = async (
    mealIdx: number,
    itemIdx: number,
    force = false,
  ) => {
    const meal = current?.meals[mealIdx];
    const item = meal?.items[itemIdx];
    if (!item || !item.name.trim()) {
      setError("Vui lòng nhập tên món ăn trước khi tạo ảnh.");
      return;
    }
    const cleanName = item.name.replace(/\([^)]*\)/g, "").trim() || item.name.trim();
    const itemKey = `${meal.id}-${itemIdx}`;

    if (!force) {
      const q = cleanName.toLowerCase();
      const matched = libraryFoods.find(
        (f) =>
          f.imageUrl &&
          (String(f.name || "").toLowerCase().includes(q) ||
            q.includes(String(f.name || "").toLowerCase())),
      );
      if (matched?.imageUrl) {
        updateFood(mealIdx, itemIdx, { imageUrl: matched.imageUrl });
        return;
      }
    }

    setGeneratingItemKey(itemKey);
    setError("");
    try {
      const created = await api.request<GymRecord>(
        "/food-images/generate",
        "POST",
        {
          name: cleanName,
          category: "PROTEIN",
          servingLabel: item.amount || "1 khẩu phần",
          servingGrams: 150,
          calories: item.calories || 150,
          protein: item.protein || 10,
          carbs: item.carbs || 15,
          fat: item.fat || 5,
          source: "AI",
        },
      );
      if (created?.imageUrl) {
        updateFood(mealIdx, itemIdx, { imageUrl: created.imageUrl });
        setLibraryRevision((v) => v + 1);
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setGeneratingItemKey(null);
    }
  };

  const handleGenerateAllMealItemsImages = async (mealIdx: number) => {
    const meal = current?.meals[mealIdx];
    if (!meal || !meal.items.length) {
      setError("Vui lòng thêm các món ăn vào bữa trước khi tạo ảnh.");
      return;
    }
    setGeneratingAllMealIdx(mealIdx);
    setError("");
    try {
      for (let idx = 0; idx < meal.items.length; idx++) {
        if (meal.items[idx]?.name?.trim()) {
          await handleGenerateItemImage(mealIdx, idx, false);
        }
      }
    } finally {
      setGeneratingAllMealIdx(null);
    }
  };

  const runInlineAi = async () => {
    if (!customerId) {
      setError("Vui lòng chọn học viên trước khi để AI sinh thực đơn.");
      return;
    }
    setAiBusy(true);
    setError("");
    try {
      const generated = await api.request<Record<string, any>>(
        "/nutrition/generate-plan",
        "POST",
        {
          customerId,
          targetCalories,
          mealsPerDay: aiMealCount,
          durationDays: Math.min(14, durationDays),
          dietStyle: aiDietStyle,
          budgetLevel: aiBudget,
          allergies: aiAllergies,
          eatingHabits: `${aiDietStyle}. Lịch sinh hoạt: ${aiSchedule}`,
          notes: aiNotes,
          bmr,
          tdee,
        },
      );
      mutate(() => {
        if (generated.title) setTitle(String(generated.title));
        if (generated.notes) setNotes(String(generated.notes));
        const nextCount = Math.max(
          1,
          Math.min(
            31,
            Number(generated.durationDays || generated.dailyPlans?.length || durationDays),
          ),
        );
        setDurationDays(nextCount);
        setEndDate(addDays(startDate, nextCount - 1));
        setDays(
          normalizeDays(undefined, generated, startDate, nextCount, false),
        );
        setActiveDay(1);
        setShowConfigStudio(false);
      });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setAiBusy(false);
    }
  };

  const buildWeeksPayload = () =>
    Array.from({ length: Math.ceil(durationDays / 7) }, (_, index) => ({
      weekNumber: index + 1,
      name: `Tuần ${index + 1}`,
      startDate: days[index * 7]?.date || startDate,
      endDate:
        days[Math.min(days.length - 1, index * 7 + 6)]?.date || endDate,
      days: days.slice(index * 7, index * 7 + 7).map((day) => ({
        ...day,
        meals: day.meals.map((meal) => ({
          ...meal,
          calories: sum(meal.items, "calories"),
        })),
      })),
    }));

  const save = async (publish?: boolean) => {
    if (!customerId) {
      setError("Vui lòng chọn học viên trước khi lưu thực đơn.");
      return;
    }
    if (!days.some((day) => day.meals.some((meal) => meal.items.length))) {
      setError("Thêm món ăn vào ít nhất một bữa trước khi lưu.");
      return;
    }
    const resolvedTitle =
      title.trim() ||
      `Thực Đơn ${durationDays} Ngày (${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}) - ${effectiveCustomerName || "Học viên"}`;
    const shouldPublish =
      publish !== undefined ? publish : record?.status === "PUBLISHED";

    setBusy(true);
    setError("");
    try {
      const weeks = buildWeeksPayload();
      const saved = await api.save(
        "nutrition-plans",
        {
          customerId,
          title: resolvedTitle,
          bmr,
          tdee,
          targetCalories: totalKcal || targetCalories,
          macros: {
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
          },
          startDate,
          endDate: addDays(startDate, durationDays - 1),
          durationDays,
          menu: weeks,
          dailyPlans: days,
          notes: notes.trim() || undefined,
          createdByAi: Boolean(prefill?.dailyPlans || record?.createdByAi),
          reviewStatus: record?.reviewStatus || "NOT_REQUIRED",
          status: record?.status || "DRAFT",
        },
        record,
      );
      if (shouldPublish && saved.status !== "PUBLISHED") {
        await api.request(`/nutrition-plans/${saved._id}/publish`, "PATCH", {
          revision: saved.revision,
        });
      }
      setDirty(false);
      onSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (!dirty) {
      onBack();
      return;
    }
    setConfirmBackOpen(true);
  };

  return (
    <section className="space-y-4" aria-label="Thiết kế thực đơn dinh dưỡng">
      {/* 1. Top Banner & Quick Controls (3S MealPlannerBuilder Header) */}
      <header className="rounded-xl border border-outline-variant bg-surface-container-highest px-4 py-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={back}
              aria-label="Quay lại danh sách"
              title="Quay lại danh sách"
              className={cn(secondary, "size-9 p-0")}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-on-surface">
                  {effectiveCustomerName
                    ? `Thực Đơn: ${effectiveCustomerName}`
                    : "Thiết Kế Thực Đơn Dinh Dưỡng"}
                </h1>
                {isEditingExistingPlan && (
                  <span className="rounded bg-tertiary-container px-2 py-0.5 text-[11px] font-bold text-on-tertiary-container">
                    ĐANG CHỈNH SỬA BẢN CÓ SẴN
                  </span>
                )}
                {meals.length > 0 && (
                  <span className="rounded bg-change-up/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-change-up">
                    {meals.length} Bữa Ăn • {totalKcal} kcal
                  </span>
                )}
              </div>
              {meals.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-3 text-xs tabular-nums text-on-surface-variant">
                  <span>
                    Đạm (P): <strong className="text-on-surface">{totalProtein}g</strong>
                  </span>
                  <span>
                    Tinh bột (C): <strong className="text-on-surface">{totalCarbs}g</strong>
                  </span>
                  <span>
                    Chất béo (F): <strong className="text-on-surface">{totalFat}g</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={showConfigStudio}
              onClick={() => setShowConfigStudio((v) => !v)}
              className={cn(
                "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                showConfigStudio
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container",
              )}
            >
              <Sliders className="size-3.5" aria-hidden="true" />
              {showConfigStudio ? "Thu Gọn Cấu Hình" : "Cấu Hình Nhu Cầu AI"}
            </button>

            {meals.length > 0 && (
              <button
                type="button"
                className={cn(secondary, "min-h-9")}
                onClick={() => {
                  setSwapTarget(undefined);
                  setSwapOpenStandalone(true);
                }}
              >
                <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                Đổi Món &amp; Gợi Ý
              </button>
            )}

            {meals.length > 0 &&
              (isEditingExistingPlan ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className={cn(primary, "min-h-9")}
                >
                  <Save className="size-3.5" aria-hidden="true" />
                  {busy ? "Đang Cập Nhật..." : "Cập Nhật"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(false)}
                    className={cn(secondary, "min-h-9")}
                  >
                    <Save className="size-3.5" aria-hidden="true" />
                    {busy ? "Đang Lưu..." : "Lưu Nháp"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(true)}
                    className={cn(primary, "min-h-9")}
                  >
                    <Send className="size-3.5" aria-hidden="true" />
                    {busy ? "Đang Gửi..." : "Lưu & Gửi Học Viên"}
                  </button>
                </>
              ))}
          </div>
        </div>
      </header>

      <Feedback error={error} />

      {/* 2. Date Range & Timeframe Scheduler Card (Lịch Áp Dụng Thực Đơn Cho Học Viên) */}
      <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-bold text-on-surface">
              Lịch Áp Dụng Thực Đơn Cho Học Viên
            </h2>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-change-up/30 bg-change-up/10 px-3 py-1 text-xs font-semibold tabular-nums text-change-up">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>
              Áp dụng <strong>{durationDays} ngày</strong>: Từ{" "}
              <strong>{formatDisplayDate(startDate)}</strong> đến{" "}
              <strong>{formatDisplayDate(endDate)}</strong>
            </span>
          </span>
        </div>

        {!fixedCustomerId && (
          <div className="max-w-md">
            <CustomerPicker api={api} value={customerId} onChange={setCustomerId} />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="gym-meal-start-date"
              className="mb-1 block text-xs font-bold uppercase text-on-surface-variant"
            >
              NGÀY BẮT ĐẦU ĂN
            </label>
            <input
              id="gym-meal-start-date"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-low/50 px-3 text-xs font-semibold text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">
              SỐ NGÀY ÁP DỤNG ({durationDays} NGÀY)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((p) => {
                const active = durationDays === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => handleDurationPreset(p.days)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="gym-meal-end-date"
              className="mb-1 block text-xs font-bold uppercase text-on-surface-variant"
            >
              NGÀY KẾT THÚC
            </label>
            <input
              id="gym-meal-end-date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-low/50 px-3 text-xs font-semibold text-on-surface outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* 3. AI Configuration Studio (3S MealAiConfigStudio) */}
      {showConfigStudio && (
        <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold text-on-surface">
                Cấu Hình Nhu Cầu Dinh Dưỡng
              </h2>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* LEFT COLUMN: Calo, Số lượng bữa ăn, Phong cách ẩm thực */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="gym-ai-target-kcal"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface"
                >
                  <Flame className="size-3.5 text-tertiary" aria-hidden="true" />
                  CALO MỤC TIÊU (KCAL/NGÀY)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[140px] flex-1">
                    <input
                      id="gym-ai-target-kcal"
                      type="number"
                      min={800}
                      max={6000}
                      value={targetKcalInput}
                      onChange={(e) => setTargetKcalInput(e.target.value)}
                      placeholder="1850"
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-3 pr-12 text-sm font-bold tabular-nums text-on-surface outline-none focus:border-primary"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant">
                      kcal
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {KCAL_PRESETS.map((k) => {
                      const active = targetKcalInput === String(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTargetKcalInput(String(k))}
                          className={cn(
                            "cursor-pointer rounded-md border px-2.5 py-2 text-xs font-bold tabular-nums transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-outline-variant bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface",
                          )}
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface">
                  <Layers className="size-3.5 text-primary" aria-hidden="true" />
                  SỐ LƯỢNG BỮA ĂN TRONG NGÀY
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_COUNT_OPTIONS.map((opt) => {
                    const active = aiMealCount === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAiMealCount(opt.value)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                          active
                            ? "border-2 border-primary bg-primary/5 font-bold text-primary"
                            : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
                        )}
                      >
                        <span>{opt.label}</span>
                        {active && <Check className="size-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface">
                  <Salad className="size-3.5 text-change-up" aria-hidden="true" />
                  PHONG CÁCH ẨM THỰC
                </span>
                <div className="grid gap-1.5">
                  {DIET_STYLES.map((style) => {
                    const active = aiDietStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setAiDietStyle(style.id)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-xs font-semibold transition-colors",
                          active
                            ? "border-change-up bg-change-up/10 font-bold text-change-up"
                            : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
                        )}
                      >
                        <span>{style.label}</span>
                        {active && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Lịch tập, Kiêng kỵ & dị ứng, Ngân sách, Ghi chú thêm */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="gym-ai-schedule"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface"
                >
                  <Clock className="size-3.5 text-primary" aria-hidden="true" />
                  LỊCH TẬP &amp; LỐI SỐNG SINH HOẠT
                </label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {SCHEDULE_PRESETS.map((preset) => {
                    const active = aiSchedule === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAiSchedule(preset)}
                        className={cn(
                          "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-outline-variant bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface",
                        )}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="gym-ai-schedule"
                  type="text"
                  value={aiSchedule}
                  onChange={(e) => setAiSchedule(e.target.value)}
                  placeholder="VD: Tập chiều 17h30-19h, văn phòng ngồi nhiều..."
                  className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface">
                  KIÊNG KỴ &amp; DỊ ỨNG
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGY_CHIPS.map((chip) => {
                    const active = aiAllergies.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setAiAllergies((prev) =>
                            prev.includes(chip)
                              ? prev.filter((x) => x !== chip)
                              : [...prev, chip],
                          )
                        }
                        className={cn(
                          "cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                          active
                            ? "border-error/50 bg-error-container/40 text-error"
                            : "border-outline-variant bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface",
                        )}
                      >
                        {active ? "✓ " : "+ "}
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                <div>
                  <label
                    htmlFor="gym-ai-budget"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface"
                  >
                    <Coins className="size-3.5 text-tertiary" aria-hidden="true" />
                    NGÂN SÁCH
                  </label>
                  <select
                    id="gym-ai-budget"
                    value={aiBudget}
                    onChange={(e) => setAiBudget(e.target.value)}
                    className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-semibold text-on-surface outline-none focus:border-primary"
                  >
                    <option value="BUDGET">Tiết kiệm</option>
                    <option value="STANDARD">Tiêu chuẩn</option>
                    <option value="PREMIUM">Cao cấp</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gym-ai-notes"
                    className="mb-1.5 block text-xs font-bold uppercase text-on-surface"
                  >
                    GHI CHÚ THÊM TỪ PT
                  </label>
                  <input
                    id="gym-ai-notes"
                    type="text"
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    placeholder="VD: Thích cafe đen, ghét ức gà luộc..."
                    className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={aiBusy}
            onClick={() => void runInlineAi()}
            className={cn(
              primary,
              "min-h-11 w-full justify-center rounded-xl text-sm font-bold shadow-xs",
            )}
          >
            {aiBusy ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="size-4" aria-hidden="true" />
            )}
            {aiBusy ? "AI đang thiết kế thực đơn cơm Việt..." : "Sinh Thực Đơn AI"}
          </button>
        </section>
      )}

      {/* AI Generation 4-Stage Progress Banner */}
      {aiBusy && (
        <div className="space-y-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="size-5 animate-spin text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-bold text-on-surface">
                  Trợ Lý AI Đang Thiết Kế Thực Đơn Chi Tiết...
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Tính toán thâm hụt calo, phân bổ macro và chọn lọc món ăn thực tế
                </p>
              </div>
            </div>
            <span className="text-base font-bold tabular-nums text-primary">
              {mealAiProgress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${mealAiProgress}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "1. Định lượng Calo & Macro từng bữa",
              "2. Lọc kiêng kỵ & dị ứng thực phẩm",
              "3. Lên món Việt & định lượng gram",
              "4. Căn giờ nạp & mẹo chế biến",
            ].map((stepLabel, idx) => {
              const stepNum = idx + 1;
              return (
                <div
                  key={stepLabel}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-surface-container-lowest px-3 py-2 text-xs",
                    mealAiStage >= stepNum
                      ? "border-primary/40 font-semibold text-on-surface"
                      : "border-outline-variant text-on-surface-variant",
                  )}
                >
                  {mealAiStage > stepNum ? (
                    <CheckCircle2 className="size-4 shrink-0 text-change-up" />
                  ) : mealAiStage === stepNum ? (
                    <RefreshCw className="size-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <span className="size-3.5 shrink-0 rounded-full border border-outline-variant" />
                  )}
                  <span>{stepLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State when no meals exist yet (e.g. opened in AI mode before generating) */}
      {!aiBusy && !hasAnyMeals && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest px-6 py-8 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Salad className="size-6" aria-hidden="true" />
          </span>
          <h3 className="text-base font-bold text-on-surface">
            {effectiveCustomerName
              ? `Chưa có thực đơn cho ${effectiveCustomerName}`
              : "Sẵn Sàng Thiết Kế Thực Đơn Bằng AI"}
          </h3>
          <div className="mt-1 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              disabled={aiBusy}
              onClick={() => void runInlineAi()}
              className={cn(primary, "min-h-9")}
            >
              <Wand2 className="size-4" aria-hidden="true" />
              AI Sinh Thực Đơn Ngay
            </button>
            <button
              type="button"
              onClick={handleAddMealBlock}
              className={cn(secondary, "min-h-9")}
            >
              + Tạo bữa ăn thủ công
            </button>
          </div>
        </div>
      )}

      {/* 4. Total Macros Summary Strip (when meals exist) */}
      {meals.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
          <div className="min-w-[240px] flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label
                htmlFor="gym-meal-plan-title"
                className="text-[11px] font-bold uppercase text-on-surface-variant"
              >
                TÊN KẾ HOẠCH THỰC ĐƠN
              </label>
              <button
                type="button"
                onClick={() =>
                  mutate(() =>
                    setTitle(
                      `Thực Đơn ${durationDays} Ngày (${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}) - ${effectiveCustomerName || "Học viên"}`,
                    ),
                  )
                }
                className="cursor-pointer text-xs font-semibold text-primary underline hover:text-primary/80"
              >
                Đặt tên theo thời gian ({durationDays} ngày)
              </button>
            </div>
            <input
              id="gym-meal-plan-title"
              type="text"
              value={title}
              onChange={(e) => mutate(() => setTitle(e.target.value))}
              placeholder="VD: Thực Đơn Giảm Mỡ - Nguyễn Văn A"
              className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-bold text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-center tabular-nums">
            <div className="rounded-lg border border-outline-variant bg-surface-container-low/50 px-3.5 py-1.5">
              <span className="block text-[10px] font-bold uppercase text-on-surface-variant">
                TỔNG CALO
              </span>
              <strong className="text-base font-bold text-on-surface">
                {totalKcal} kcal
              </strong>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-1.5">
              <span className="block text-[10px] font-bold uppercase text-primary">
                PROTEIN
              </span>
              <strong className="text-base font-bold text-primary">
                {totalProtein}g
              </strong>
            </div>
            <div className="rounded-lg border border-tertiary/30 bg-tertiary-container/30 px-3.5 py-1.5">
              <span className="block text-[10px] font-bold uppercase text-tertiary">
                CARBS
              </span>
              <strong className="text-base font-bold text-tertiary">
                {totalCarbs}g
              </strong>
            </div>
            <div className="rounded-lg border border-error/30 bg-error-container/30 px-3.5 py-1.5">
              <span className="block text-[10px] font-bold uppercase text-error">
                FAT
              </span>
              <strong className="text-base font-bold text-error">
                {totalFat}g
              </strong>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className={cn(primary, "min-h-10 px-4 font-bold")}
          >
            <Save className="size-4" aria-hidden="true" />
            {busy
              ? "Đang Cập Nhật..."
              : isEditingExistingPlan
                ? "Cập Nhật"
                : "Lưu Thực Đơn"}
          </button>
        </div>
      )}

      {/* 5. Advice Note Banner */}
      {(notes || isEditingAdvice) && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-change-up/30 bg-change-up/10 p-3.5 text-xs">
          <div className="flex flex-1 items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-change-up" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-bold text-on-surface">
                Lời khuyên dinh dưỡng từ Chuyên Gia / Huấn luyện viên:
              </p>
              {isEditingAdvice ? (
                <div className="mt-1.5 space-y-2">
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => mutate(() => setNotes(e.target.value))}
                    placeholder="Nhập lời khuyên uống nước, thời điểm ăn bữa phụ trước tập..."
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-xs text-on-surface outline-none focus:border-primary"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditingAdvice(false)}
                      className={cn(primary, "min-h-7 px-3 text-xs")}
                    >
                      Xong
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-line leading-relaxed text-on-surface-variant">
                  {notes}
                </p>
              )}
            </div>
          </div>
          {!isEditingAdvice && (
            <button
              type="button"
              onClick={() => setIsEditingAdvice(true)}
              className={cn(secondary, "min-h-7 px-2.5 text-xs")}
            >
              <Pencil className="size-3" aria-hidden="true" />
              Sửa
            </button>
          )}
        </div>
      )}

      {/* 6. Hierarchical Level 1 (Weeks) & Level 2 (Days) Card (Image 5) */}
      {hasAnyMeals && (
        <div className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
          {/* LEVEL 1: WEEK NAVIGATION */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-on-surface">
                1. PHÂN CẤP THEO TUẦN ({totalWeeks} TUẦN)
              </span>
              {totalWeeks > 1 && (
                <button
                  type="button"
                  onClick={copyWeek}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-change-up/30 bg-change-up/10 px-2.5 py-1 text-xs font-semibold text-change-up hover:bg-change-up/15"
                >
                  <Copy className="size-3" aria-hidden="true" />
                  Sao chép Tuần {activeWeek} sang các tuần khác
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: totalWeeks }, (_, wIdx) => {
                const weekNum = wIdx + 1;
                const isSelected = weekNum === activeWeek;
                const wSlice = days.slice(wIdx * 7, wIdx * 7 + 7);
                const wStart = wSlice[0]?.date || startDate;
                const wEnd = wSlice[wSlice.length - 1]?.date || endDate;
                return (
                  <button
                    key={weekNum}
                    type="button"
                    onClick={() => setActiveDay(wIdx * 7 + 1)}
                    className={cn(
                      "flex shrink-0 cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-on-primary shadow-2xs"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>Tuần {weekNum}</span>
                      {isSelected && (
                        <span className="size-1.5 rounded-full bg-change-up" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        isSelected
                          ? "text-on-primary/80"
                          : "text-on-surface-variant",
                      )}
                    >
                      {formatDisplayDate(wStart).slice(0, 5)} -{" "}
                      {formatDisplayDate(wEnd).slice(0, 5)} ({wSlice.length} ngày)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* LEVEL 2: DAY NAVIGATION WITHIN ACTIVE WEEK */}
          <div className="border-t border-outline-variant/60 pt-3">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                2. PHÂN CẤP THEO NGÀY TRONG TUẦN {activeWeek}
              </span>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={randomizeDay}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-error/30 bg-error-container/30 px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/50"
                >
                  <Sparkles className="size-3" aria-hidden="true" />
                  Đổi món ngày này
                </button>
                <button
                  type="button"
                  onClick={randomizeWeek}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-tertiary/30 bg-tertiary-container/30 px-2.5 py-1 text-xs font-semibold text-tertiary hover:bg-tertiary-container/50"
                >
                  <Wand2 className="size-3" aria-hidden="true" />
                  Đổi món cả tuần
                </button>
                <button
                  type="button"
                  onClick={() => copyDay("week")}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                >
                  <Copy className="size-3" aria-hidden="true" />
                  Áp dụng ngày này cho cả Tuần {activeWeek}
                </button>
                {totalWeeks > 1 && (
                  <button
                    type="button"
                    onClick={() => copyDay("all")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-outline-variant bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container"
                  >
                    <Copy className="size-3" aria-hidden="true" />
                    Áp dụng cho toàn bộ {durationDays} ngày
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {weekDays.map((d) => {
                const isSelected = d.dayNumber === activeDay;
                const dayKcal = d.meals.reduce(
                  (acc, m) => acc + sum(m.items, "calories"),
                  0,
                );
                return (
                  <button
                    key={d.dayNumber}
                    type="button"
                    onClick={() => setActiveDay(d.dayNumber)}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 text-center transition-colors",
                      isSelected
                        ? "border-2 border-primary bg-primary/5 text-on-surface shadow-2xs"
                        : "border-outline-variant bg-surface-container-low/40 text-on-surface-variant hover:bg-surface-container-low",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold",
                        isSelected ? "text-primary" : "text-on-surface",
                      )}
                    >
                      {d.dayOfWeek}
                    </span>
                    <span className="text-[11px] tabular-nums text-on-surface-variant">
                      {formatDisplayDate(d.date).slice(0, 5)} (Ngày {d.dayNumber})
                    </span>
                    <span
                      className={cn(
                        "mt-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                        isSelected
                          ? "bg-primary/15 text-primary"
                          : "bg-surface-container text-on-surface-variant",
                      )}
                    >
                      {d.meals.length} bữa • {dayKcal} kcal
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. Hierarchical Level 3: Meals for Active Day (Images 5 & 6) */}
      {hasAnyMeals && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Salad className="size-4 text-change-up" aria-hidden="true" />
              <h3 className="text-sm font-bold text-on-surface">
                3. PHÂN CẤP THEO BỮA ĂN: {current?.dayOfWeek} (
                {formatDisplayDate(current?.date || startDate)}) • Tuần{" "}
                {activeWeek}
              </h3>
            </div>
            <span className="text-xs font-semibold tabular-nums text-on-surface-variant">
              {meals.length} Bữa • {totalKcal} kcal (P: {totalProtein}g | C:{" "}
              {totalCarbs}g | F: {totalFat}g)
            </span>
          </div>

          <div className="grid gap-4">
            {meals.map((meal, mealIndex) => {
              const mealKcal = sum(meal.items, "calories");
              const mealP = sum(meal.items, "protein");
              const mealC = sum(meal.items, "carbs");
              const mealF = sum(meal.items, "fat");
              const isGeneratingAll = generatingAllMealIdx === mealIndex;

              return (
                <article
                  key={meal.id}
                  className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs"
                >
                  {/* Meal Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-outline-variant/60 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Tên bữa ${mealIndex + 1}`}
                        value={meal.name}
                        onChange={(e) =>
                          updateMeal(mealIndex, { name: e.target.value })
                        }
                        className="w-full bg-transparent text-sm font-bold text-on-surface outline-none focus:underline"
                      />
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">
                        <Clock className="size-3" aria-hidden="true" />
                        <input
                          aria-label={`Giờ ăn ${meal.name}`}
                          value={meal.timeSlot}
                          onChange={(e) =>
                            updateMeal(mealIndex, { timeSlot: e.target.value })
                          }
                          placeholder="07:00 - 07:45"
                          className="w-28 bg-transparent text-xs font-medium text-on-surface-variant outline-none focus:text-on-surface"
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5 text-right tabular-nums">
                      <div>
                        <span className="block text-sm font-bold text-change-up">
                          {mealKcal} kcal
                        </span>
                        <span className="block text-[11px] font-semibold text-primary">
                          P:{mealP}g | C:{mealC}g | F:{mealF}g
                        </span>
                      </div>
                      {meals.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateMeals(
                              meals.filter((_, idx) => idx !== mealIndex),
                            )
                          }
                          aria-label={`Xóa ${meal.name}`}
                          title="Xóa bữa ăn này"
                          className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Meal Food Items List (3S MealCardItem compact rows) */}
                  <div className="space-y-2">
                    {meal.items.map((item, itemIdx) => {
                      const itemKey = `${meal.id}-${itemIdx}`;
                      const isItemGenerating = generatingItemKey === itemKey;

                      return (
                        <div
                          key={itemIdx}
                          className="flex items-start gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low/40 p-2.5"
                        >
                          {/* Dish Image Thumbnail / Generate Button */}
                          <div className="w-14 shrink-0">
                            {isItemGenerating ? (
                              <div className="flex size-14 items-center justify-center rounded-lg border border-dashed border-change-up bg-change-up/10 text-change-up">
                                <RefreshCw className="size-4 animate-spin" />
                              </div>
                            ) : item.imageUrl ? (
                              <div className="w-14 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: item.imageUrl!,
                                      title: item.name,
                                    })
                                  }
                                  className="block size-14 w-full cursor-pointer overflow-hidden"
                                  aria-label={`Xem ảnh món ${item.name}`}
                                >
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="size-full object-cover"
                                  />
                                </button>
                                <div className="grid grid-cols-2 divide-x divide-outline-variant border-t border-outline-variant">
                                  <button
                                    type="button"
                                    disabled={isGeneratingAll}
                                    onClick={() =>
                                      void handleGenerateItemImage(
                                        mealIndex,
                                        itemIdx,
                                        true,
                                      )
                                    }
                                    title="Vẽ lại ảnh món này"
                                    className="flex h-6 cursor-pointer items-center justify-center text-on-surface-variant hover:bg-surface-container"
                                  >
                                    <RefreshCw className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isGeneratingAll}
                                    onClick={() =>
                                      updateFood(mealIndex, itemIdx, {
                                        imageUrl: undefined,
                                      })
                                    }
                                    title="Xóa ảnh khỏi thực đơn"
                                    className="flex h-6 cursor-pointer items-center justify-center text-on-surface-variant hover:bg-surface-container"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isGeneratingAll}
                                onClick={() =>
                                  void handleGenerateItemImage(
                                    mealIndex,
                                    itemIdx,
                                    false,
                                  )
                                }
                                title="Tạo ảnh cho món này"
                                className="flex size-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest text-primary hover:border-primary"
                              >
                                <Sparkles className="size-3.5" aria-hidden="true" />
                                <span className="text-[10px] font-bold">
                                  Tạo ảnh
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Item Content */}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Row 1: Dish Name + Calories badge + Delete */}
                            <div className="flex items-center justify-between gap-2">
                              <input
                                aria-label="Tên món ăn"
                                value={item.name}
                                onChange={(e) =>
                                  updateFood(mealIndex, itemIdx, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Tên món ăn..."
                                className="min-w-0 flex-1 bg-transparent text-xs font-bold text-on-surface outline-none focus:underline"
                              />
                              <div className="flex shrink-0 items-center gap-1.5">
                                <div className="inline-flex items-center gap-1 rounded-md border border-change-up/30 bg-change-up/10 px-1.5 py-0.5 tabular-nums">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Calo ${item.name}`}
                                    value={item.calories ?? 0}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(
                                        /[^0-9]/g,
                                        "",
                                      );
                                      updateFood(mealIndex, itemIdx, {
                                        calories:
                                          clean === ""
                                            ? 0
                                            : parseInt(clean, 10),
                                      });
                                    }}
                                    className="w-10 bg-transparent text-right text-xs font-bold text-change-up outline-none"
                                  />
                                  <span className="text-[11px] font-bold text-change-up">
                                    kcal
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMeal(mealIndex, {
                                      items: meal.items.filter(
                                        (_, idx) => idx !== itemIdx,
                                      ),
                                    })
                                  }
                                  aria-label={`Xóa món ${item.name}`}
                                  title="Xóa món"
                                  className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                                >
                                  <Trash2 className="size-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Amount */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="shrink-0 font-medium text-on-surface-variant">
                                Định lượng:
                              </span>
                              <input
                                aria-label={`Định lượng ${item.name}`}
                                value={item.amount}
                                onChange={(e) =>
                                  updateFood(mealIndex, itemIdx, {
                                    amount: e.target.value,
                                  })
                                }
                                placeholder="VD: 150g"
                                className="h-7 min-w-0 flex-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-xs font-semibold text-on-surface outline-none focus:border-primary"
                              />
                            </div>

                            {/* Row 3: P / C / F badges + Đổi món button */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                              <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                                <div className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                                  <span>P:</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Protein ${item.name}`}
                                    value={item.protein ?? 0}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(
                                        /[^0-9]/g,
                                        "",
                                      );
                                      updateFood(mealIndex, itemIdx, {
                                        protein:
                                          clean === ""
                                            ? 0
                                            : parseInt(clean, 10),
                                      });
                                    }}
                                    className="w-6 bg-transparent text-center text-[11px] font-bold text-primary outline-none"
                                  />
                                  <span>g</span>
                                </div>

                                <div className="inline-flex items-center gap-1 rounded border border-tertiary/30 bg-tertiary-container/40 px-1.5 py-0.5 text-[11px] font-bold text-tertiary">
                                  <span>C:</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Carbs ${item.name}`}
                                    value={item.carbs ?? 0}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(
                                        /[^0-9]/g,
                                        "",
                                      );
                                      updateFood(mealIndex, itemIdx, {
                                        carbs:
                                          clean === ""
                                            ? 0
                                            : parseInt(clean, 10),
                                      });
                                    }}
                                    className="w-6 bg-transparent text-center text-[11px] font-bold text-tertiary outline-none"
                                  />
                                  <span>g</span>
                                </div>

                                <div className="inline-flex items-center gap-1 rounded border border-error/30 bg-error-container/40 px-1.5 py-0.5 text-[11px] font-bold text-error">
                                  <span>F:</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Fat ${item.name}`}
                                    value={item.fat ?? 0}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(
                                        /[^0-9]/g,
                                        "",
                                      );
                                      updateFood(mealIndex, itemIdx, {
                                        fat:
                                          clean === ""
                                            ? 0
                                            : parseInt(clean, 10),
                                      });
                                    }}
                                    className="w-6 bg-transparent text-center text-[11px] font-bold text-error outline-none"
                                  />
                                  <span>g</span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setSwapTarget({
                                    meal: mealIndex,
                                    food: itemIdx,
                                  })
                                }
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/15"
                              >
                                <ArrowRightLeft
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                Đổi món
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Meal Footer: + Thêm món & Tạo ảnh tất cả món */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddItem(mealIndex)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:border-primary hover:bg-primary/5"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Thêm món
                    </button>

                    <button
                      type="button"
                      disabled={isGeneratingAll}
                      onClick={() =>
                        void handleGenerateAllMealItemsImages(mealIndex)
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-change-up/30 bg-change-up/10 px-3 py-1.5 text-xs font-bold text-change-up hover:bg-change-up/15 disabled:opacity-50"
                    >
                      {isGeneratingAll ? (
                        <RefreshCw
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Sparkles className="size-3.5" aria-hidden="true" />
                      )}
                      {isGeneratingAll
                        ? "Đang tạo ảnh..."
                        : "Tạo ảnh tất cả món"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Add New Meal Block Button */}
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={handleAddMealBlock}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-surface-container-lowest px-6 py-2.5 text-xs font-bold text-primary hover:border-primary hover:bg-primary/5"
            >
              <Plus className="size-4" aria-hidden="true" />
              Thêm Một Bữa Ăn Mới (Bữa 5, Bữa Phụ...)
            </button>
          </div>

          {/* Sticky Save & Publish Action Bar (Image 6) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-highest px-5 py-4 shadow-xs">
            <div>
              <p className="text-sm font-bold text-on-surface">
                Tổng Thực Đơn:{" "}
                <span className="tabular-nums text-change-up">
                  {totalKcal} kcal
                </span>{" "}
                ({meals.length} bữa ăn)
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-on-surface-variant">
                P: <strong>{totalProtein}g</strong> | C:{" "}
                <strong>{totalCarbs}g</strong> | F: <strong>{totalFat}g</strong>{" "}
                • Học viên:{" "}
                <strong>{effectiveCustomerName || "Chưa chọn"}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {isEditingExistingPlan ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className={cn(primary, "min-h-10 px-5 font-bold")}
                >
                  <Save className="size-4" aria-hidden="true" />
                  {busy ? "Đang Cập Nhật..." : "Cập Nhật"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(false)}
                    className={cn(secondary, "min-h-10 px-4 font-bold")}
                  >
                    <Save className="size-4" aria-hidden="true" />
                    {busy ? "Đang Lưu..." : "Lưu Bản Nháp"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(true)}
                    className={cn(primary, "min-h-10 px-5 font-bold")}
                  >
                    <Send className="size-4" aria-hidden="true" />
                    {busy
                      ? "Đang Gửi..."
                      : "Lưu & Gửi Cho Học Viên Áp Dụng Ngay"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Swapper Modal */}
      {((swapTarget &&
        swapTarget.food !== undefined &&
        current?.meals[swapTarget.meal]?.items[swapTarget.food]) ||
        swapOpenStandalone) && (
        <MealSwapperModal
          api={api}
          currentDish={
            swapTarget && swapTarget.food !== undefined
              ? current?.meals[swapTarget.meal]?.items[swapTarget.food]
              : undefined
          }
          libraryFoods={libraryFoods}
          onLibraryUpdated={() => setLibraryRevision((v) => v + 1)}
          onClose={() => {
            setSwapTarget(undefined);
            setSwapOpenStandalone(false);
          }}
          onApplySwap={(swapped) => {
            if (swapTarget && swapTarget.food !== undefined) {
              updateFood(swapTarget.meal, swapTarget.food, swapped);
              setSwapTarget(undefined);
            } else {
              if (current?.meals.length) {
                updateMeal(0, { items: [...current.meals[0].items, swapped] });
              }
              setSwapOpenStandalone(false);
            }
          }}
        />
      )}

      <MealImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={confirmBackOpen}
        title="Thực đơn chưa lưu"
        description="Bạn có thay đổi chưa lưu. Bạn có chắc muốn quay lại danh sách thực đơn?"
        confirmLabel="Quay lại danh sách"
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setConfirmBackOpen(false)}
        onConfirm={() => {
          setConfirmBackOpen(false);
          onBack();
        }}
      />
    </section>
  );
}
