import { generateNutritionJob } from '../../services/nutritionJobs';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Salad,
  Save,
  Send,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { Customer, NutritionDraftPlan, CalculatedNutrition, AiNutritionAnalysisResult } from '../../types';
import MealAiConfigStudio, { DIET_STYLES } from './MealAiConfigStudio';
import MealCardItem, { type MealBlock, type MealFoodItem } from './MealCardItem';
import MealImagePreviewModal from './MealImagePreviewModal';
import MealSwapperModal, { type SwapResultPayload } from './MealSwapperModal';
import {
  VIETNAMESE_7DAYS_TEMPLATES,
  buildMealsFromTemplate,
  randomizeDayMeals,
} from './nutritionVariationEngine';

export interface DayMenuPlan {
  dayNumber: number;
  date: string;
  dayOfWeek: string;
  meals: MealBlock[];
}

export interface WeekMenuPlan {
  weekNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  days: DayMenuPlan[];
}

const DAYS_OF_WEEK_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function normalizeDayOfWeek(str?: string): string {
  if (!str) return '';
  const s = str.trim().toLowerCase();
  if (s.includes('2') || s.includes('hai') || s.includes('mon')) return 'Thứ Hai';
  if (s.includes('3') || s.includes('ba') || s.includes('tue')) return 'Thứ Ba';
  if (s.includes('4') || s.includes('tư') || s.includes('tu') || s.includes('wed')) return 'Thứ Tư';
  if (s.includes('5') || s.includes('năm') || s.includes('nam') || s.includes('thu')) return 'Thứ Năm';
  if (s.includes('6') || s.includes('sáu') || s.includes('sau') || s.includes('fri')) return 'Thứ Sáu';
  if (s.includes('7') || s.includes('bảy') || s.includes('bay') || s.includes('sat')) return 'Thứ Bảy';
  if (s.includes('nhật') || s.includes('nhat') || s.includes('cn') || s.includes('sun')) return 'Chủ Nhật';
  return str;
}

function buildWeeksSchedule(
  startStr: string,
  totalDays: number,
  baseMeals: MealBlock[] = [],
  existingWeeks?: WeekMenuPlan[],
  _targetKcal: number = 1850,
  dailyPlanTemplates?: Array<{ dayOfWeek?: string; meals: MealBlock[] }>
): WeekMenuPlan[] {
  const parts = startStr.split('-');
  const baseDate = parts.length === 3
    ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    : new Date(startStr);

  const numWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const resultWeeks: WeekMenuPlan[] = [];

  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  for (let w = 0; w < numWeeks; w++) {
    const startDayIdx = w * 7;
    const endDayIdx = Math.min(totalDays - 1, (w + 1) * 7 - 1);

    const wStartD = new Date(baseDate.getTime() + startDayIdx * 86400000);
    const wEndD = new Date(baseDate.getTime() + endDayIdx * 86400000);

    const days: DayMenuPlan[] = [];
    for (let dIdx = startDayIdx; dIdx <= endDayIdx; dIdx++) {
      const curD = new Date(baseDate.getTime() + dIdx * 86400000);
      const dateYmd = formatYmd(curD);
      const dayOfWeek = DAYS_OF_WEEK_VI[curD.getDay()];

      let dayMeals: MealBlock[] = [];
      const existingDay = existingWeeks?.[w]?.days?.find(
        (ed) => ed.dayNumber === dIdx + 1 || ed.date === dateYmd
      );

      if (existingDay && existingDay.meals && existingDay.meals.length > 0) {
        // Giữ nguyên dữ liệu đã chỉnh sửa
        dayMeals = existingDay.meals;
      } else if (dailyPlanTemplates && dailyPlanTemplates.length > 0) {
        // Dữ liệu AI: match theo dayOfWeek chuẩn hóa, fallback theo index luân phiên
        const curNorm = normalizeDayOfWeek(dayOfWeek);
        const matched = dailyPlanTemplates.find(
          (p) => normalizeDayOfWeek(p.dayOfWeek) === curNorm
        ) || dailyPlanTemplates[dIdx % dailyPlanTemplates.length];
        dayMeals = (matched?.meals || []).map((m, mIdx) => ({
          ...m,
          id: `meal_w${w + 1}_d${dIdx + 1}_${mIdx + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          items: m.items.map((it) => ({ ...it })),
        }));
      } else if (baseMeals.length > 0) {
        // Fallback: clone baseMeals (legacy 1-day AI)
        dayMeals = baseMeals.map((m, mIdx) => ({
          ...m,
          id: `meal_w${w + 1}_d${dIdx + 1}_${mIdx + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          items: m.items.map((it) => ({ ...it })),
        }));
      }

      days.push({
        dayNumber: dIdx + 1,
        date: dateYmd,
        dayOfWeek,
        meals: dayMeals,
      });
    }

    resultWeeks.push({
      weekNumber: w + 1,
      name: `Tuần ${w + 1}`,
      startDate: formatYmd(wStartD),
      endDate: formatYmd(wEndD),
      days,
    });
  }

  return resultWeeks;
}

interface MealPlannerBuilderProps {
  selectedCustomer?: Customer | null;
  customerId?: string;
  onSaved?: () => void;
  onBack?: () => void;
  editingPlan?: any | null;
  appliedNutrition?: CalculatedNutrition | null;
  appliedAiAnalysis?: AiNutritionAnalysisResult | null;
}

export default function MealPlannerBuilder({
  selectedCustomer,
  customerId,
  onSaved,
  onBack,
  editingPlan,
  appliedNutrition,
  appliedAiAnalysis,
}: MealPlannerBuilderProps) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [dietAdviceNotes, setDietAdviceNotes] = useState('');
  const [isEditingAdvice, setIsEditingAdvice] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState<number>(4);
  const [targetKcalInput, setTargetKcalInput] = useState<string>('1850');

  const effectiveCustomerId = customerId
    || selectedCustomer?._id
    || (typeof editingPlan?.customerId === 'object' && editingPlan?.customerId ? editingPlan.customerId._id : (editingPlan?.customerId as string | undefined));

  const effectiveCustomerName = selectedCustomer?.fullName
    || (typeof editingPlan?.customerId === 'object' && editingPlan?.customerId ? editingPlan.customerId.fullName : '')
    || '';

  const isEditingExistingPlan = Boolean(editingPlan?._id || editingPlan?.id);
  const loadedPlanIdRef = useRef<string | null>(null);

  // Date Range / Duration State (max 31 days = 1 month)
  const computeEndDate = (startStr: string, days: number): string => {
    try {
      const parts = startStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + days - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      // fallback
    }
    const d = new Date(startStr);
    d.setDate(d.getDate() + days - 1);
    return d.toISOString().split('T')[0];
  };

  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dStr).toLocaleDateString('vi-VN');
  };

  const [startDate, setStartDate] = useState<string>(getTodayStr());
  const [durationDays, setDurationDays] = useState<number>(7);
  const [endDate, setEndDate] = useState<string>(computeEndDate(getTodayStr(), 7));

  // Hierarchical Week & Day State
  const [weeks, setWeeks] = useState<WeekMenuPlan[]>(() => buildWeeksSchedule(getTodayStr(), 7, []));
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);

  const activeWeek: WeekMenuPlan = weeks[selectedWeekIdx] || weeks[0] || { weekNumber: 1, name: 'Tuần 1', startDate: getTodayStr(), endDate: getTodayStr(), days: [] };
  const activeDay: DayMenuPlan = activeWeek.days?.[selectedDayIdx] || activeWeek.days?.[0] || { dayNumber: 1, date: getTodayStr(), dayOfWeek: 'Thứ Hai', meals: [] };
  const meals: MealBlock[] = activeDay?.meals || [];
  const hasAnyMeals = weeks.some((w) => w.days.some((d) => d.meals.length > 0));

  const updateActiveDayMeals = (updater: (prev: MealBlock[]) => MealBlock[]) => {
    setWeeks((prev) => {
      const next = [...prev];
      if (!next[selectedWeekIdx]) return prev;
      const week = { ...next[selectedWeekIdx] };
      if (!week.days[selectedDayIdx]) return prev;
      const day = { ...week.days[selectedDayIdx] };
      day.meals = updater(day.meals || []);
      week.days = [...week.days];
      week.days[selectedDayIdx] = day;
      next[selectedWeekIdx] = week;
      return next;
    });
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    const newEnd = computeEndDate(newStart, durationDays);
    setEndDate(newEnd);
    setWeeks((prev) => buildWeeksSchedule(newStart, durationDays, meals, prev));
  };

  const handleDurationPreset = (days: number) => {
    const clamped = Math.max(1, Math.min(31, days));
    setDurationDays(clamped);
    const newEnd = computeEndDate(startDate, clamped);
    setEndDate(newEnd);
    setWeeks((prev) => buildWeeksSchedule(startDate, clamped, meals, prev));
    setSelectedWeekIdx(0);
    setSelectedDayIdx(0);
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    try {
      const s = new Date(startDate).getTime();
      const e = new Date(newEnd).getTime();
      const diff = Math.round((e - s) / 86400000) + 1;
      let targetDays = durationDays;
      if (diff < 1) {
        toast.error('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu ăn.');
        targetDays = 1;
        setDurationDays(1);
        setEndDate(startDate);
      } else if (diff > 31) {
        toast.info('Khoảng thời gian tối đa cho 1 thực đơn là 1 tháng (31 ngày).');
        targetDays = 31;
        setDurationDays(31);
        setEndDate(computeEndDate(startDate, 31));
      } else {
        targetDays = diff;
        setDurationDays(diff);
      }
      setWeeks((prev) => buildWeeksSchedule(startDate, targetDays, meals, prev));
    } catch {
      // ignore
    }
  };

  // Copy helpers for hierarchical planning
  const handleCopyDayToWeek = () => {
    const currentDayMeals = activeDay?.meals;
    if (!currentDayMeals || currentDayMeals.length === 0) {
      toast.error('Chưa có bữa ăn nào trong ngày hiện tại để sao chép.');
      return;
    }
    setWeeks((prev) => {
      const next = prev.map((w, wIdx) => {
        if (wIdx !== selectedWeekIdx) return w;
        return {
          ...w,
          days: w.days.map((d) => ({
            ...d,
            meals: currentDayMeals.map((m) => ({
              ...m,
              id: `meal_w${wIdx + 1}_d${d.dayNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              items: m.items.map((it) => ({ ...it })),
            })),
          })),
        };
      });
      return next;
    });
    toast.success(`Đã áp dụng thực đơn ngày này cho toàn bộ ${activeWeek.name}!`);
  };

  const handleCopyDayToAllWeeks = () => {
    const currentDayMeals = activeDay?.meals;
    if (!currentDayMeals || currentDayMeals.length === 0) {
      toast.error('Chưa có bữa ăn nào trong ngày hiện tại để sao chép.');
      return;
    }
    setWeeks((prev) => {
      const next = prev.map((w, wIdx) => ({
        ...w,
        days: w.days.map((d) => ({
          ...d,
          meals: currentDayMeals.map((m) => ({
            ...m,
            id: `meal_w${wIdx + 1}_d${d.dayNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            items: m.items.map((it) => ({ ...it })),
          })),
        })),
      }));
      return next;
    });
    toast.success(`Đã áp dụng thực đơn ngày này cho toàn bộ ${durationDays} ngày!`);
  };

  const handleCopyWeekToAllWeeks = () => {
    const currentWeek = activeWeek;
    if (!currentWeek || currentWeek.days.length === 0) {
      toast.error('Chưa có dữ liệu tuần để sao chép.');
      return;
    }
    setWeeks((prev) => {
      const next = prev.map((w, wIdx) => {
        if (wIdx === selectedWeekIdx) return w;
        return {
          ...w,
          days: w.days.map((d, dIdx) => {
            const sourceDay = currentWeek.days[dIdx % currentWeek.days.length];
            return {
              ...d,
              meals: (sourceDay?.meals || []).map((m) => ({
                ...m,
                id: `meal_w${wIdx + 1}_d${d.dayNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                items: m.items.map((it) => ({ ...it })),
              })),
            };
          }),
        };
      });
      return next;
    });
    toast.success(`Đã sao chép toàn bộ ${currentWeek.name} sang các tuần còn lại!`);
  };

  // Đổi món ngẫu nhiên cho ngày đang chọn
  const handleRandomizeActiveDay = () => {
    const currentMeals = activeDay?.meals || [];
    if (currentMeals.length === 0) {
      toast.error('Chưa có bữa ăn nào trong ngày để đổi món.');
      return;
    }
    const targetKcal = Number(targetKcalInput) || 1850;
    const newMeals = randomizeDayMeals(currentMeals, targetKcal, activeDay?.dayOfWeek);
    updateActiveDayMeals(() => newMeals);
    toast.success(`Đã đổi món ngẫu nhiên cho ${activeDay?.dayOfWeek} (${formatDisplayDate(activeDay?.date)})!`);
  };

  // Đổi món toàn bộ các ngày trong tuần hiện tại
  const handleRandomizeActiveWeek = () => {
    const currentWeek = activeWeek;
    if (!currentWeek || currentWeek.days.length === 0) {
      toast.error('Chưa có dữ liệu tuần để đổi món.');
      return;
    }
    const targetKcal = Number(targetKcalInput) || 1850;
    const currentMeals = activeDay?.meals || [];
    const count = currentMeals.length || mealCount || 4;

    setWeeks((prev) => {
      const clone = [...prev];
      const curWeek = clone[selectedWeekIdx];
      if (!curWeek) return prev;

      const randomOffset = Math.floor(Math.random() * VIETNAMESE_7DAYS_TEMPLATES.length);
      const newDays = curWeek.days.map((d, idx) => {
        const rotatedTemplate = VIETNAMESE_7DAYS_TEMPLATES[(idx + randomOffset) % VIETNAMESE_7DAYS_TEMPLATES.length];
        const variedMeals = buildMealsFromTemplate(rotatedTemplate, targetKcal, count);
        return {
          ...d,
          meals: variedMeals.map((m: any, mIdx: number) => ({
            ...m,
            id: `meal_w${curWeek.weekNumber}_d${d.dayNumber}_${mIdx + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            items: m.items.map((it: any) => ({ ...it })),
          })),
        };
      });

      clone[selectedWeekIdx] = { ...curWeek, days: newDays };
      return clone;
    });
    toast.success(`Đã làm mới và đổi món phong phú cho toàn bộ ${activeWeek.name}!`);
  };

  // AI Configuration Studio State
  const [showConfigStudio, setShowConfigStudio] = useState(true);
  const [dietStyle, setDietStyle] = useState<string>('vietnamese_easy');
  const [workoutSchedule, setWorkoutSchedule] = useState<string>('Tập gym chiều 17h30 - 19h00, làm văn phòng ngồi nhiều');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customDietNotes, setCustomDietNotes] = useState<string>('');
  const [budgetLevel, setBudgetLevel] = useState<string>('STANDARD');

  // Loading & View States
  const [loadingAi, setLoadingAi] = useState(false);
  const [mealAiProgress, setMealAiProgress] = useState<number>(0);
  const [mealAiStage, setMealAiStage] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [generatingItemKey, setGeneratingItemKey] = useState<string | null>(null);
  const [generatingMealAllItemsId, setGeneratingMealAllItemsId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [swapperOpen, setSwapperOpen] = useState(false);
  const [swapperTarget, setSwapperTarget] = useState<{
    mealIdx: number;
    itemIdx?: number;
    foodItem?: MealFoodItem;
    mealName?: string;
    foodName?: string;
    amount?: string;
    calories?: number;
  } | null>(null);

  const handleOpenSwapper = (mealIdx?: number, itemIdx?: number) => {
    if (mealIdx !== undefined && itemIdx !== undefined) {
      const m = meals[mealIdx];
      const it = m?.items[itemIdx];
      if (it) {
        setSwapperTarget({
          mealIdx,
          itemIdx,
          foodItem: it,
          mealName: m.name,
          foodName: it.name,
          amount: it.amount,
          calories: it.calories,
        });
        setSwapperOpen(true);
        return;
      }
    } else if (mealIdx !== undefined) {
      const m = meals[mealIdx];
      const it = m?.items[0];
      setSwapperTarget({
        mealIdx,
        itemIdx: it ? 0 : undefined,
        foodItem: it,
        mealName: m?.name,
        foodName: it?.name,
        amount: it?.amount,
        calories: it?.calories,
      });
      setSwapperOpen(true);
      return;
    }
    setSwapperTarget(null);
    setSwapperOpen(true);
  };

  const handleApplySwap = (swapResult: SwapResultPayload) => {
    if (swapperTarget && swapperTarget.mealIdx !== undefined && swapperTarget.itemIdx !== undefined) {
      const { mealIdx, itemIdx } = swapperTarget;
      updateActiveDayMeals((curr) => {
        const next = [...curr];
        const m = { ...next[mealIdx] };
        const its = [...m.items];
        its[itemIdx] = {
          ...its[itemIdx],
          name: swapResult.name,
          amount: swapResult.amount,
          calories: swapResult.calories,
          protein: swapResult.protein,
          carbs: swapResult.carbs,
          fat: swapResult.fat,
          prepTip: swapResult.prepTip || its[itemIdx]?.prepTip,
          imageUrl: undefined,
        };
        m.items = its;
        next[mealIdx] = m;
        return next;
      });
      toast.success(`Đã đổi sang "${swapResult.name}" (${swapResult.amount})!`);
    } else {
      toast.success(`Đã tham khảo quy đổi: ${swapResult.name} (${swapResult.amount})`);
    }
    setSwapperOpen(false);
    setSwapperTarget(null);
  };

  // Animated Loading Progress Tracker
  useEffect(() => {
    if (!loadingAi) {
      setMealAiProgress(0);
      setMealAiStage(0);
      return;
    }
    setMealAiProgress(15);
    setMealAiStage(1);
    const t1 = setTimeout(() => { setMealAiProgress(42); setMealAiStage(2); }, 1200);
    const t2 = setTimeout(() => { setMealAiProgress(70); setMealAiStage(3); }, 2800);
    const t3 = setTimeout(() => { setMealAiProgress(92); setMealAiStage(4); }, 4600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loadingAi]);

  // Sync editingPlan or new draft when props change
  useEffect(() => {
    const editId = editingPlan?._id || editingPlan?.id || null;
    if (editId) {
      if (loadedPlanIdRef.current !== editId) {
        loadedPlanIdRef.current = editId;
        setCurrentPlanId(editId);
        if (editingPlan.title) setTitle(editingPlan.title);
        if (editingPlan.notes) setDietAdviceNotes(editingPlan.notes);
        if (editingPlan.targetCalories) setTargetKcalInput(String(editingPlan.targetCalories));

        let planStart = getTodayStr();
        let planDuration = 7;
        if (editingPlan.startDate) {
          planStart = new Date(editingPlan.startDate).toISOString().split('T')[0];
          setStartDate(planStart);
          if (editingPlan.endDate) {
            const e = new Date(editingPlan.endDate).toISOString().split('T')[0];
            setEndDate(e);
            const diff = Math.round((new Date(e).getTime() - new Date(planStart).getTime()) / 86400000) + 1;
            planDuration = editingPlan.durationDays || Math.max(1, Math.min(31, diff));
            setDurationDays(planDuration);
          } else if (editingPlan.durationDays) {
            planDuration = Math.max(1, Math.min(31, editingPlan.durationDays));
            setDurationDays(planDuration);
            setEndDate(computeEndDate(planStart, planDuration));
          }
        }

        if (Array.isArray(editingPlan.menu) && editingPlan.menu.length > 0) {
          // Check if hierarchical
          if (editingPlan.menu[0]?.days) {
            setWeeks(editingPlan.menu as WeekMenuPlan[]);
            setSelectedWeekIdx(0);
            setSelectedDayIdx(0);
            setShowConfigStudio(false);
          } else {
            setMealCount(editingPlan.menu.length);
            const parsedMeals: MealBlock[] = editingPlan.menu.map((m: any, idx: number) => {
              const rawItems = Array.isArray(m.items) ? m.items : [];
              const mealFoods: MealFoodItem[] = rawItems.map((it: any) => {
                if (typeof it === 'object' && it !== null) {
                  return {
                    name: it.name || 'Món ăn',
                    amount: it.amount || '100g',
                    calories: it.calories || 100,
                    protein: it.protein || 10,
                    carbs: it.carbs || 10,
                    fat: it.fat || 3,
                    prepTip: it.prepTip || undefined,
                    imageUrl: it.imageUrl || undefined,
                  };
                }
                const str = String(it);
                return {
                  name: str.split('(')[0]?.trim() || str,
                  amount: '1 khẩu phần',
                  calories: 120,
                  protein: 15,
                  carbs: 10,
                  fat: 3,
                };
              });

              return {
                id: `meal_loaded_${idx + 1}`,
                name: m.name || `Bữa ${idx + 1}`,
                timeSlot: m.timeSlot || '08:00',
                targetKcal: m.calories || 400,
                items: mealFoods,
                imageUrl: m.imageUrl || undefined,
              };
            });
            const loadedWeeks = buildWeeksSchedule(planStart, planDuration, parsedMeals);
            setWeeks(loadedWeeks);
            setSelectedWeekIdx(0);
            setSelectedDayIdx(0);
            setShowConfigStudio(false);
          }
        }
      }
    } else if (appliedAiAnalysis) {
      if (loadedPlanIdRef.current !== 'applied_ai') {
        loadedPlanIdRef.current = 'applied_ai';
        setCurrentPlanId(null);
        setTitle(`Thực Đơn ${appliedAiAnalysis.goalLabel} - ${effectiveCustomerName || 'Học viên'}`);
        setTargetKcalInput(String(appliedAiAnalysis.targetCalories));
        if (appliedAiAnalysis.dietaryAdvice?.keyNotes) {
          setDietAdviceNotes(appliedAiAnalysis.dietaryAdvice.keyNotes);
        }
        if (appliedAiAnalysis.timingStrategy && appliedAiAnalysis.timingStrategy.length > 0) {
          setMealCount(appliedAiAnalysis.timingStrategy.length);
          const timingMeals: MealBlock[] = appliedAiAnalysis.timingStrategy.map((ts: any, idx: number) => ({
            id: `meal_ai_timing_${idx + 1}`,
            name: `${ts.meal} (${ts.focus})`,
            timeSlot: ts.time,
            targetKcal: ts.calorieTarget,
            items: [],
          }));
          setWeeks(buildWeeksSchedule(startDate, durationDays, timingMeals));
        }
        setShowConfigStudio(true);
      }
    } else if (appliedNutrition) {
      if (loadedPlanIdRef.current !== 'applied_nutrition') {
        loadedPlanIdRef.current = 'applied_nutrition';
        setCurrentPlanId(null);
        setTitle(`Thực Đơn ${appliedNutrition.goalLabel} - ${effectiveCustomerName || 'Học viên'}`);
        setTargetKcalInput(String(appliedNutrition.targetCalories));
        setShowConfigStudio(true);
      }
    } else {
      if (loadedPlanIdRef.current !== 'new_blank') {
        loadedPlanIdRef.current = 'new_blank';
        setCurrentPlanId(null);
        if (effectiveCustomerName) {
          setTitle(`Thực Đơn Dinh Dưỡng - ${effectiveCustomerName}`);
        } else {
          setTitle('Kế Hoạch Thực Đơn Dinh Dưỡng');
        }
        setWeeks(buildWeeksSchedule(startDate, durationDays, []));
        setShowConfigStudio(true);
      }
    }
  }, [editingPlan, appliedAiAnalysis, appliedNutrition, effectiveCustomerName]);

  // Total Macros Calculation
  const totalKcal = meals.reduce((sum, m) => sum + m.items.reduce((s, i) => s + (i.calories || 0), 0), 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.items.reduce((s, i) => s + (i.protein || 0), 0), 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.items.reduce((s, i) => s + (i.carbs || 0), 0), 0);
  const totalFat = meals.reduce((sum, m) => sum + m.items.reduce((s, i) => s + (i.fat || 0), 0), 0);

  const toggleAllergy = (chip: string) => {
    setSelectedAllergies((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]));
  };

  /**
   * Handle Comprehensive AI Meal Generation
   */
  const handleAiGenerate = async () => {
    const targetId = effectiveCustomerId;
    if (!targetId) {
      toast.error('Vui lòng chọn học viên ở thanh tìm kiếm phía trên để AI cá nhân hóa chỉ số.');
      return;
    }

    const existingPlanId = currentPlanId || editingPlan?._id || editingPlan?.id || undefined;

    try {
      setLoadingAi(true);

      const styleObj = DIET_STYLES.find((s) => s.id === dietStyle);
      const compositeRequest = `
YÊU CẦU THIẾT KẾ THỰC ĐƠN:
- Thời gian áp dụng: ${durationDays} ngày (từ ${formatDisplayDate(startDate)} đến ${formatDisplayDate(endDate)}).
- Cấu trúc: Thiết kế 7 thực đơn riêng biệt cho 7 ngày trong tuần (Thứ Hai đến Chủ Nhật), mỗi ngày đúng ${mealCount} bữa/ngày với các món ăn và nguồn đạm khác nhau hoàn toàn để phân bổ vào chu kỳ ${durationDays} ngày.
- Số bữa ăn: ${mealCount} bữa/ngày.
- Calo mục tiêu: ${targetKcalInput ? `${targetKcalInput} kcal` : 'Tự động tính theo chỉ số'}.
- Phong cách ẩm thực: ${styleObj?.label || 'Món Việt Nam dễ nấu'} (${styleObj?.desc || ''}).
- Lịch trình sinh hoạt & giờ tập: ${workoutSchedule}.
- Kiêng kỵ & Dị ứng: ${selectedAllergies.length > 0 ? selectedAllergies.join(', ') : 'Không có dị ứng đặc biệt'}.
- Ngân sách: ${budgetLevel === 'BUDGET' ? 'Tiết kiệm / Sinh viên' : budgetLevel === 'PREMIUM' ? 'Cao cấp (cá hồi, bò Úc, whey isolate)' : 'Tiêu chuẩn'}.
${customDietNotes ? `- Yêu cầu bổ sung: ${customDietNotes}` : ''}
      `.trim();

      const res = { data: await generateNutritionJob<NutritionDraftPlan>({ customerId: targetId, request: compositeRequest, planId: existingPlanId || undefined, durationDays }) };

      const draft = res.data;
      if (draft) {
        // Chỉ gán ID mới nếu trước đó chưa có kế hoạch nào (tạo mới hoàn toàn)
        if (!existingPlanId) {
          const generatedId = (draft as any)._id || (draft as any).id;
          if (generatedId) {
            setCurrentPlanId(generatedId);
          }
        }
        if (draft.title) setTitle(draft.title);
        if ((draft as any).notes) setDietAdviceNotes((draft as any).notes);
        if (draft.advice) setDietAdviceNotes(draft.advice);

        const targetKcal = (draft as any).targetCalories || Number(targetKcalInput) || 1850;

        // Helper: parse raw AI meal items into MealFoodItem[]
        const parseMealItems = (rawItems: any[], mealCalories: number): MealFoodItem[] => {
          if (!Array.isArray(rawItems) || rawItems.length === 0) {
            return [{ name: 'Món ăn dinh dưỡng', amount: '150g', calories: 150, protein: 15, carbs: 15, fat: 3 }];
          }
          return rawItems.map((it: any) => {
            if (typeof it === 'object' && it !== null) {
              return {
                name: it.name || 'Món ăn dinh dưỡng',
                amount: it.amount || '150g',
                calories: it.calories || Math.round(mealCalories / (rawItems.length || 1)),
                protein: it.protein || 15,
                carbs: it.carbs || 20,
                fat: it.fat || 5,
                prepTip: it.prepTip || undefined,
                imageUrl: it.imageUrl || undefined,
              };
            }
            return {
              name: String(it),
              amount: '1 khẩu phần',
              calories: Math.round(mealCalories / (rawItems.length || 1)),
              protein: 15,
              carbs: 20,
              fat: 5,
            };
          });
        };

        // Helper: parse raw AI meal block into MealBlock
        const parseMealBlock = (m: any, idx: number, totalMeals: number): MealBlock => ({
          id: `meal_${idx + 1}`,
          name: m.name || m.title || `Bữa ${idx + 1}`,
          timeSlot: m.timeSlot || (idx === 0 ? '07:00 - 07:45' : idx === 1 ? '12:00 - 12:45' : idx === 2 ? '16:30 - 17:00' : '19:30 - 20:15'),
          targetKcal: m.calories || Math.round(targetKcal / totalMeals),
          items: parseMealItems(m.items, m.calories || Math.round(targetKcal / totalMeals)),
        });

        // *** LUỒNG CHÍNH: AI trả về dailyPlans[7] (7 ngày khác nhau) ***
        const aiDailyPlans = (draft as any).dailyPlans;
        if (Array.isArray(aiDailyPlans) && aiDailyPlans.length > 0) {
          const dailyPlanTemplates = aiDailyPlans.map((dp: any, dpIdx: number) => {
            const dpMeals = Array.isArray(dp.meals) ? dp.meals : [];
            return {
              dayOfWeek: normalizeDayOfWeek(dp.dayOfWeek || dp.dayName) || DAYS_OF_WEEK_VI[(dpIdx + 1) % 7], // +1 vì index 0 = Thứ Hai
              meals: dpMeals.map((m: any, mIdx: number) => parseMealBlock(m, mIdx, dpMeals.length)),
            };
          });

          // Dùng ngày đầu tiên làm baseMeals fallback (cho poster/tổng kết)
          const firstDayMeals = dailyPlanTemplates[0]?.meals || [];

          const newWeeks = buildWeeksSchedule(startDate, durationDays, firstDayMeals, undefined, targetKcal, dailyPlanTemplates);
          setWeeks(newWeeks);
          setSelectedWeekIdx(0);
          setSelectedDayIdx(0);
        }
        // *** LUỒNG PHỤ (backward compat): AI trả về menu[] cho 1 ngày ***
        else if (Array.isArray(draft.menu) && draft.menu.length > 0) {
          const generatedMeals: MealBlock[] = draft.menu.map((m: any, idx: number) =>
            parseMealBlock(m, idx, draft.menu.length)
          );
          const newWeeks = buildWeeksSchedule(startDate, durationDays, generatedMeals);
          setWeeks(newWeeks);
          setSelectedWeekIdx(0);
          setSelectedDayIdx(0);
        }
      }
      toast.success(`AI đã tự động sinh thực đơn chi tiết cho ${durationDays} ngày (${weeks.length} tuần)!`);
      setShowConfigStudio(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingAi(false);
    }
  };

  /**
   * Sinh ảnh cho bữa ăn: Ưu tiên lấy từ kho ảnh món ăn có sẵn (tiết kiệm chi phí), nếu chưa có mới dùng AI FLUX.2 và lưu kho
   */
  const handleGenerateMealImage = async (mealIdx: number) => {
    const meal = meals[mealIdx];
    if (!meal || meal.items.length === 0) {
      toast.error('Vui lòng thêm các món ăn vào bữa trước khi tạo ảnh minh họa.');
      return;
    }

    try {
      setGeneratingImageId(meal.id);

      const res = await api.post<{
        imageUrl: string;
        name: string;
        source: 'CACHE' | 'AI';
        reused: boolean;
        cost?: number;
        message: string;
      }>('/api/images/meal-image', {
        mealName: meal.name,
        items: meal.items.map((i) => i.name),
        aspectRatio: '4:3',
      });

      if (res.data?.imageUrl) {
        updateActiveDayMeals((curr) => {
          const next = [...curr];
          next[mealIdx] = {
            ...next[mealIdx],
            imageUrl: res.data.imageUrl,
          };
          return next;
        });

        toast.success('Tạo ảnh thành công!');
      }
    } catch (err: any) {
      const msg = errorMessage(err);
      if (msg.includes('402') || msg.includes('credit') || msg.includes('Insufficient') || msg.includes('OpenRouter')) {
        toast.error('Hệ thống gặp sự cố. Vui lòng liên hệ quản trị viên để được hỗ trợ');
      } else {
        toast.error(`Không thể tạo ảnh: ${msg}`);
      }
    } finally {
      setGeneratingImageId(null);
    }
  };

  /**
   * Sinh ảnh AI cho từng món ăn cụ thể:
   * Quy cách đặt tên trùng tên món ăn và lưu vào kho DB để sau này tự động tái sử dụng
   */
  const handleGenerateItemImage = async (mealIdx: number, itemIdx: number, force: boolean = false) => {
    const meal = meals[mealIdx];
    if (!meal) return;
    const item = meal.items[itemIdx];
    if (!item || !item.name.trim()) {
      toast.error('Vui lòng nhập tên món ăn trước khi tạo ảnh.');
      return;
    }

    const cleanDishName = item.name.replace(/\([^)]*\)/g, '').trim() || item.name.trim();
    const itemKey = `${meal.id || mealIdx}-${itemIdx}`;
    setGeneratingItemKey(itemKey);

    try {
      const res = await api.post<{
        imageUrl: string;
        name: string;
        source: 'CACHE' | 'AI';
        reused: boolean;
        message: string;
      }>('/api/images/meal-image', {
        mealName: cleanDishName,
        items: [cleanDishName],
        aspectRatio: '4:3',
        forceRegenerate: force,
      });

      if (res.data?.imageUrl) {
        updateActiveDayMeals((curr) => {
          const next = [...curr];
          const m = { ...next[mealIdx] };
          const its = [...m.items];
          its[itemIdx] = {
            ...its[itemIdx],
            imageUrl: res.data.imageUrl,
          };
          m.items = its;
          next[mealIdx] = m;
          return next;
        });

        toast.success('Tạo ảnh thành công!');
      }
    } catch (err: any) {
      const msg = errorMessage(err);
      if (msg.includes('402') || msg.includes('credit') || msg.includes('Insufficient') || msg.includes('OpenRouter')) {
        toast.error('Hệ thống gặp sự cố. Vui lòng liên hệ quản trị viên để được hỗ trợ');
      } else {
        toast.error(`Không thể tạo ảnh: ${msg}`);
      }
    } finally {
      setGeneratingItemKey(null);
    }
  };

  /**
   * Sinh ảnh cho tất cả các món ăn trong một bữa:
   * Lần lượt sinh hoặc lấy từ kho ảnh cho từng món ăn
   */
  const handleGenerateAllMealItemsImages = async (mealIdx: number) => {
    const meal = meals[mealIdx];
    if (!meal || meal.items.length === 0) {
      toast.error('Vui lòng thêm các món ăn vào bữa trước khi tạo ảnh.');
      return;
    }

    const validItems = meal.items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.name.trim().length > 0);

    if (validItems.length === 0) {
      toast.error('Vui lòng nhập tên món ăn hợp lệ.');
      return;
    }

    setGeneratingMealAllItemsId(meal.id || String(mealIdx));

    let successCount = 0;
    for (const { it, idx } of validItems) {
      const cleanDishName = it.name.replace(/\([^)]*\)/g, '').trim() || it.name.trim();
      const itemKey = `${meal.id || mealIdx}-${idx}`;
      setGeneratingItemKey(itemKey);

      try {
        const res = await api.post<{
          imageUrl: string;
          name: string;
          source: 'CACHE' | 'AI';
          reused: boolean;
        }>('/api/images/meal-image', {
          mealName: cleanDishName,
          items: [cleanDishName],
          aspectRatio: '4:3',
        });

        if (res.data?.imageUrl) {
          updateActiveDayMeals((curr) => {
            const next = [...curr];
            const m = { ...next[mealIdx] };
            const its = [...m.items];
            its[idx] = {
              ...its[idx],
              imageUrl: res.data.imageUrl,
            };
            m.items = its;
            next[mealIdx] = m;
            return next;
          });
          successCount++;
        }
      } catch (err) {
        console.error(`Error generating image for dish: ${cleanDishName}`, err);
      }
    }

    setGeneratingItemKey(null);
    setGeneratingMealAllItemsId(null);

    if (successCount > 0) {
      toast.success('Tạo ảnh thành công!');
    } else {
      toast.error('Không thể tạo ảnh món ăn. Vui lòng thử lại.');
    }
  };

  const handleSavePlan = async (publishToCustomer?: boolean) => {
    const targetId = effectiveCustomerId;
    if (!targetId) {
      toast.error('Vui lòng chọn học viên trước khi lưu thực đơn.');
      return;
    }
    if (!hasAnyMeals) {
      toast.error('Chưa có bữa ăn nào trong thực đơn. Vui lòng bấm AI Sinh Thực Đơn trước khi lưu.');
      return;
    }

    const shouldPublish = publishToCustomer !== undefined
      ? publishToCustomer
      : (editingPlan?.status === 'PUBLISHED');

    try {
      setSaving(true);
      const menuPayload = weeks.map((w) => ({
        weekNumber: w.weekNumber,
        name: w.name,
        startDate: w.startDate,
        endDate: w.endDate,
        days: w.days.map((d) => ({
          dayNumber: d.dayNumber,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          meals: d.meals.map((m) => ({
            id: m.id,
            name: m.name,
            timeSlot: m.timeSlot,
            calories: m.items.reduce((s, i) => s + (Number(i.calories) || 0), 0),
            items: m.items.map((i) => ({
              name: i.name,
              amount: i.amount,
              calories: i.calories,
              protein: i.protein || 0,
              carbs: i.carbs || 0,
              fat: i.fat || 0,
              prepTip: i.prepTip || undefined,
              imageUrl: i.imageUrl || undefined,
            })),
            imageUrl: m.imageUrl || undefined,
          })),
        })),
      }));

      const payload = {
        customerId: targetId,
        title: title || `Thực Đơn ${durationDays} Ngày (${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}) - ${effectiveCustomerName || 'Học viên'}`,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 6 * 86400000).toISOString(),
        durationDays: durationDays || 7,
        targetCalories: totalKcal,
        macros: {
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
        },
        menu: menuPayload,
        notes: dietAdviceNotes || undefined,
      };

      const existingPlanId = currentPlanId || editingPlan?._id || editingPlan?.id;
      let planId = existingPlanId;

      if (planId) {
        // CẬP NHẬT BẢN CÓ SẴN (PATCH) - TUYỆT ĐỐI KHÔNG TẠO BẢN MỚI
        await api.patch(`/api/nutrition-plans/${planId}`, payload);
      } else {
        // CHỈ TẠO MỚI (POST) KHI ĐANG TẠO BẢN HOÀN TOÀN MỚI
        const res = await api.post<any>('/api/nutrition-plans', payload);
        planId = res.data?._id || res.data?.id;
        if (planId) setCurrentPlanId(planId);
      }

      if (shouldPublish && planId) {
        await api.patch(`/api/nutrition-plans/${planId}/publish`, { publish: true });
        toast.success(
          existingPlanId
            ? 'Đã cập nhật thực đơn thành công!'
            : 'Đã lưu vào cơ sở dữ liệu và CÔNG BỐ thành công cho học viên áp dụng!'
        );
      } else {
        toast.success(
          existingPlanId
            ? 'Đã cập nhật thực đơn thành công!'
            : 'Đã lưu bản nháp thực đơn vào cơ sở dữ liệu thành công!'
        );
      }

      if (onSaved) onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = (mealIndex: number) => {
    updateActiveDayMeals((currMeals) => {
      const next = [...currMeals];
      next[mealIndex] = {
        ...next[mealIndex],
        items: [
          ...next[mealIndex].items,
          {
            name: 'Món ăn mới',
            amount: '100g',
            calories: 120,
            protein: 15,
            carbs: 10,
            fat: 2,
            prepTip: 'Chế biến ít dầu mỡ',
          },
        ],
      };
      return next;
    });
  };

  const handleRemoveItem = (mealIndex: number, itemIndex: number) => {
    updateActiveDayMeals((currMeals) => {
      const next = [...currMeals];
      const items = [...next[mealIndex].items];
      items.splice(itemIndex, 1);
      next[mealIndex] = { ...next[mealIndex], items };
      return next;
    });
  };

  const handleUpdateItem = (mealIndex: number, itemIndex: number, field: keyof MealFoodItem, val: any) => {
    updateActiveDayMeals((currMeals) => {
      const next = [...currMeals];
      const items = [...next[mealIndex].items];
      items[itemIndex] = { ...items[itemIndex], [field]: val };
      next[mealIndex] = { ...next[mealIndex], items };
      return next;
    });
  };

  const handleUpdateMealName = (mealIndex: number, name: string) => {
    updateActiveDayMeals((currMeals) => {
      const next = [...currMeals];
      next[mealIndex] = { ...next[mealIndex], name };
      return next;
    });
  };

  const handleUpdateMealTimeSlot = (mealIndex: number, timeSlot: string) => {
    updateActiveDayMeals((currMeals) => {
      const next = [...currMeals];
      next[mealIndex] = { ...next[mealIndex], timeSlot };
      return next;
    });
  };

  const handleAddMealBlock = () => {
    updateActiveDayMeals((currMeals) => {
      const newIdx = currMeals.length + 1;
      return [
        ...currMeals,
        {
          id: `meal_custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: `Bữa ${newIdx}`,
          timeSlot: '15:00',
          targetKcal: 300,
          items: [{ name: 'Món ăn dinh dưỡng', amount: '150g', calories: 150, protein: 10, carbs: 15, fat: 5 }],
        },
      ];
    });
  };

  const handleRemoveMealBlock = (mealIndex: number) => {
    updateActiveDayMeals((currMeals) => {
      const next = [...currMeals];
      next.splice(mealIndex, 1);
      return next;
    });
  };

  return (
    <div style={{ display: 'grid', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Top Banner & Quick Controls */}
      <div
        style={{
          background: 'linear-gradient(135deg, #003b70 0%, #002244 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '18px 22px',
          boxShadow: '0 4px 20px rgba(0, 59, 112, 0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                title="Quay lại danh sách các bản thực đơn của học viên"
              >
                <ArrowLeft size={16} /> Danh Sách
              </button>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: 800 }}>
                  THIẾT KẾ THỰC ĐƠN CƠM VIỆT
                </span>
                {isEditingExistingPlan && (
                  <span style={{ background: '#f59e0b', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                    ✏️ ĐANG CHỈNH SỬA BẢN CÓ SẴN
                  </span>
                )}
                {meals.length > 0 && (
                  <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                    {meals.length} Bữa Ăn • {totalKcal} kcal
                  </span>
                )}
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#ffffff', fontWeight: 800 }}>
                {effectiveCustomerName ? `Thực Đơn: ${effectiveCustomerName}` : 'Thiết Kế Thực Đơn Dinh Dưỡng'}
              </h2>
              {meals.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.76rem', color: '#93c5fd', flexWrap: 'wrap' }}>
                  <span>Đạm (P): <strong style={{ color: '#ffffff' }}>{totalProtein}g</strong></span>
                  <span>Tinh bột (C): <strong style={{ color: '#ffffff' }}>{totalCarbs}g</strong></span>
                  <span>Chất béo (F): <strong style={{ color: '#ffffff' }}>{totalFat}g</strong></span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowConfigStudio(!showConfigStudio)}
              style={{
                background: showConfigStudio ? '#0f172a' : '#ffffff',
                color: showConfigStudio ? '#38bdf8' : '#003b70',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 14px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sliders size={14} /> {showConfigStudio ? 'Thu Gọn Cấu Hình' : 'Cấu Hình Nhu Cầu AI'}
            </button>

            {meals.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenSwapper()}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '8px',
                  padding: '9px 14px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Tra cứu danh sách món ăn & gợi ý đổi món tương đương"
              >
                <ArrowRightLeft size={14} /> Đổi Món & Gợi Ý
              </button>
            )}

            {meals.length > 0 && (
              isEditingExistingPlan ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSavePlan()}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 18px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                  }}
                  title="Cập nhật thực đơn vào CSDL"
                >
                  <Save size={14} /> {saving ? 'Đang Cập Nhật...' : 'Cập Nhật'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSavePlan(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      borderRadius: '8px',
                      padding: '9px 14px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title="Lưu bản nháp vào CSDL để chỉnh sửa tiếp"
                  >
                    <Save size={14} /> {saving ? 'Đang Lưu...' : 'Lưu Nháp'}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSavePlan(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '9px 16px',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                    }}
                    title="Lưu vào CSDL và gửi trực tiếp cho học viên áp dụng trên Portal"
                  >
                    <Send size={14} /> {saving ? 'Đang Gửi...' : 'Lưu & Gửi Học Viên'}
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* Date Range & Timeframe Scheduler Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#003b70' }}>
                Lịch Áp Dụng Thực Đơn Cho Học Viên
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Chọn ngày bắt đầu ăn và khoảng thời gian áp dụng thực đơn (Tối đa 1 tháng)
              </p>
            </div>
          </div>

          {/* Quick Summary Pill */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '20px',
              padding: '5px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={14} color="#16a34a" />
            <span>
              Áp dụng <strong>{durationDays} ngày</strong>: Từ <strong>{formatDisplayDate(startDate)}</strong> đến <strong>{formatDisplayDate(endDate)}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', alignItems: 'flex-start' }}>
          {/* Start Date Picker */}
          <div>
            <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              NGÀY BẮT ĐẦU ĂN
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.86rem',
                fontWeight: 600,
                color: '#1e293b',
                background: '#f8fafc',
              }}
            />
          </div>

          {/* Duration Presets */}
          <div>
            <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              SỐ NGÀY ÁP DỤNG ({durationDays} NGÀY)
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { days: 3, label: '3 ngày' },
                { days: 7, label: '7 ngày (1 tuần)' },
                { days: 14, label: '14 ngày (2 tuần)' },
                { days: 21, label: '21 ngày (3 tuần)' },
                { days: 30, label: '30 ngày (1 tháng)' },
              ].map((p) => {
                const isActive = durationDays === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => handleDurationPreset(p.days)}
                    style={{
                      background: isActive ? '#003b70' : '#f1f5f9',
                      color: isActive ? '#ffffff' : '#334155',
                      border: `1px solid ${isActive ? '#003b70' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* End Date Picker */}
          <div>
            <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              NGÀY KẾT THÚC
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.86rem',
                fontWeight: 600,
                color: '#1e293b',
                background: '#f8fafc',
              }}
            />
          </div>
        </div>
      </div>

      {/* AI CONFIGURATION STUDIO COMPONENT */}
      {showConfigStudio && (
        <MealAiConfigStudio
          mealCount={mealCount}
          setMealCount={setMealCount}
          targetKcalInput={targetKcalInput}
          setTargetKcalInput={setTargetKcalInput}
          dietStyle={dietStyle}
          setDietStyle={setDietStyle}
          budgetLevel={budgetLevel}
          setBudgetLevel={setBudgetLevel}
          workoutSchedule={workoutSchedule}
          setWorkoutSchedule={setWorkoutSchedule}
          selectedAllergies={selectedAllergies}
          toggleAllergy={toggleAllergy}
          customDietNotes={customDietNotes}
          setCustomDietNotes={setCustomDietNotes}
          loadingAi={loadingAi}
          onAiGenerate={() => void handleAiGenerate()}
          appliedNutrition={appliedNutrition}
        />
      )}

      {/* Total Macros Summary Strip */}
      {meals.length > 0 && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800 }}>
                TÊN KẾ HOẠCH THỰC ĐƠN
              </label>
              <button
                type="button"
                onClick={() => setTitle(`Thực Đơn ${durationDays} Ngày (${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}) - ${effectiveCustomerName || 'Học viên'}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Đặt tên theo thời gian ({durationDays} ngày)
              </button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thực Đơn Giảm Mỡ - Nguyễn Văn A"
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontWeight: 800,
                fontSize: '0.92rem',
                color: '#003b70',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', padding: '6px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>TỔNG CALO</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-color)' }}>{totalKcal} kcal</div>
            </div>
            <div style={{ background: '#eff6ff', padding: '6px 14px', borderRadius: '10px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#1d4ed8', fontWeight: 700 }}>PROTEIN</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e40af' }}>{totalProtein}g</div>
            </div>
            <div style={{ background: '#fffbeb', padding: '6px 14px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 700 }}>CARBS</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#92400e' }}>{totalCarbs}g</div>
            </div>
            <div style={{ background: '#fdf2f8', padding: '6px 14px', borderRadius: '10px', border: '1px solid #fbcfe8', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#be185d', fontWeight: 700 }}>FAT</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#9d174d' }}>{totalFat}g</div>
            </div>
          </div>

          <button
            type="button"
            className="button button-primary"
            onClick={() => void handleSavePlan()}
            disabled={saving}
            style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 20px', fontSize: '0.88rem', fontWeight: 800 }}
          >
            {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
            {saving ? 'Đang Cập Nhật...' : (isEditingExistingPlan ? 'Cập Nhật' : 'Lưu Thực Đơn')}
          </button>
        </div>
      )}

      {/* Advice Note banner if available */}
      {dietAdviceNotes && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
            <Info size={16} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#14532d', marginBottom: '2px' }}>Lời khuyên dinh dưỡng từ Chuyên Gia / Huấn luyện viên:</div>
              {isEditingAdvice ? (
                <div style={{ marginTop: '6px' }}>
                  <textarea
                    value={dietAdviceNotes}
                    onChange={(e) => setDietAdviceNotes(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #86efac',
                      fontSize: '0.82rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      background: '#ffffff',
                      color: '#1e293b',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingAdvice(false)}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Xong
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: '#166534' }}>{dietAdviceNotes}</div>
              )}
            </div>
          </div>
          {!isEditingAdvice && (
            <button
              type="button"
              onClick={() => setIsEditingAdvice(true)}
              style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                flexShrink: 0,
              }}
              title="Chỉnh sửa lời khuyên"
            >
              <Pencil size={12} /> Sửa
            </button>
          )}
        </div>
      )}

      {/* AI Meal Generation Loading Banner */}
      {loadingAi && (
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '2px dashed #3b82f6',
            borderRadius: '14px',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 6px 20px rgba(37, 99, 235, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={22} color="#2563eb" className="spin" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1e3a8a', fontWeight: 900 }}>
                  Trợ Lý AI Đang Thiết Kế Thực Đơn Chi Tiết...
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>
                  Tính toán thâm hụt calo, phân bổ macro và chọn lọc món ăn thực tế
                </span>
              </div>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2563eb' }}>
              {mealAiProgress}%
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: '#bfdbfe', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${mealAiProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
                borderRadius: '4px',
                transition: 'width 0.6s ease',
              }}
            />
          </div>

          {/* 4 Clear Stages Checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '2px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: mealAiStage >= 1 ? '#1e3a8a' : '#94a3b8', fontWeight: mealAiStage === 1 ? 800 : 600 }}>
              {mealAiStage > 1 ? <CheckCircle2 size={15} color="#16a34a" /> : mealAiStage === 1 ? <RefreshCw size={13} color="#2563eb" className="spin" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
              <span>1. Định lượng Calo & Macro từng bữa</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: mealAiStage >= 2 ? '#1e3a8a' : '#94a3b8', fontWeight: mealAiStage === 2 ? 800 : 600 }}>
              {mealAiStage > 2 ? <CheckCircle2 size={15} color="#16a34a" /> : mealAiStage === 2 ? <RefreshCw size={13} color="#2563eb" className="spin" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
              <span>2. Lọc kiêng kỵ & dị ứng thực phẩm</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: mealAiStage >= 3 ? '#1e3a8a' : '#94a3b8', fontWeight: mealAiStage === 3 ? 800 : 600 }}>
              {mealAiStage > 3 ? <CheckCircle2 size={15} color="#16a34a" /> : mealAiStage === 3 ? <RefreshCw size={13} color="#2563eb" className="spin" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
              <span>3. Lên món Việt & định lượng gram</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: mealAiStage >= 4 ? '#1e3a8a' : '#94a3b8', fontWeight: mealAiStage === 4 ? 800 : 600 }}>
              {mealAiStage > 4 ? <CheckCircle2 size={15} color="#16a34a" /> : mealAiStage === 4 ? <RefreshCw size={13} color="#2563eb" className="spin" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
              <span>4. Căn giờ nạp & mẹo chế biến</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no meals exist yet and not loading */}
      {!loadingAi && !hasAnyMeals && (
        <div
          style={{
            background: '#ffffff',
            border: '2px dashed #cbd5e1',
            borderRadius: '14px',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div style={{ background: '#f0f9ff', borderRadius: '50%', padding: '16px', color: '#0284c7' }}>
            <Salad size={40} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#003b70', fontWeight: 800 }}>
            {selectedCustomer ? `Chưa có thực đơn cho ${selectedCustomer.fullName}` : 'Sẵn Sàng Thiết Kế Thực Đơn Bằng AI'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', maxWidth: '440px', lineHeight: 1.5 }}>
            Tùy chỉnh số lượng bữa ăn, phong cách ăn uống và lịch tập ở bảng phía trên, sau đó bấm <strong>&quot;AI Sinh Thực Đơn Chi Tiết&quot;</strong> để hệ thống tự động sinh thực đơn dinh dưỡng thực tế khớp 100% hồ sơ học viên.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => void handleAiGenerate()}
              disabled={loadingAi}
              style={{
                background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0, 59, 112, 0.2)',
              }}
            >
              {loadingAi ? <RefreshCw size={15} className="spin" /> : <Wand2 size={15} />}
              {loadingAi ? 'AI đang tạo thực đơn...' : 'AI Sinh Thực Đơn Ngay'}
            </button>
            <button
              type="button"
              onClick={handleAddMealBlock}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              + Tạo bữa ăn thủ công
            </button>
          </div>
        </div>
      )}

      {/* HIERARCHICAL RENDERING: LEVEL 1 (WEEKS) & LEVEL 2 (DAYS) */}
      {hasAnyMeals && weeks.length > 0 && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* LEVEL 1: WEEK NAVIGATION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#003b70', fontWeight: 800 }}>
                  1. PHÂN CẤP THEO TUẦN ({weeks.length} TUẦN)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  • Chọn tuần để xem lịch ăn
                </span>
              </div>

              {/* Quick Week Copy Button */}
              {weeks.length > 1 && (
                <button
                  type="button"
                  onClick={handleCopyWeekToAllWeeks}
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Sao chép toàn bộ các ngày của tuần hiện tại sang tất cả các tuần khác"
                >
                  <Copy size={12} /> Sao chép {activeWeek.name} sang các tuần khác
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {weeks.map((w, wIdx) => {
                const isSelected = wIdx === selectedWeekIdx;
                return (
                  <button
                    key={w.weekNumber}
                    type="button"
                    onClick={() => {
                      setSelectedWeekIdx(wIdx);
                      setSelectedDayIdx(0);
                    }}
                    style={{
                      flex: '0 0 auto',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #003b70' : '1px solid #cbd5e1',
                      background: isSelected ? '#003b70' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      boxShadow: isSelected ? '0 4px 12px rgba(0, 59, 112, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{w.name}</span>
                      {isSelected && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' }} />
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: isSelected ? '#93c5fd' : '#64748b' }}>
                      {formatDisplayDate(w.startDate).slice(0, 5)} - {formatDisplayDate(w.endDate).slice(0, 5)} ({w.days.length} ngày)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* LEVEL 2: DAY NAVIGATION WITHIN ACTIVE WEEK */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0284c7', fontWeight: 800 }}>
                  2. PHÂN CẤP THEO NGÀY TRONG {activeWeek.name}
                </span>

              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRandomizeActiveDay}
                  style={{
                    background: '#fdf2f8',
                    color: '#be185d',
                    border: '1px solid #fbcfe8',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Tự động đổi sang các món ăn dinh dưỡng khác cho ngày này"
                >
                  <Sparkles size={12} /> 🎲 Đổi món ngày này
                </button>



                <button
                  type="button"
                  onClick={handleRandomizeActiveWeek}
                  style={{
                    background: '#faf5ff',
                    color: '#7e22ce',
                    border: '1px solid #e9d5ff',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Tự động đổi món đa dạng cho tất cả 7 ngày trong tuần này"
                >
                  <Wand2 size={12} /> ✨ Đổi món cả tuần
                </button>

                <button
                  type="button"
                  onClick={handleCopyDayToWeek}
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Lấy thực đơn của ngày đang chọn áp dụng cho tất cả các ngày trong tuần này"
                >
                  <Copy size={12} /> Áp dụng ngày này cho cả {activeWeek.name}
                </button>

                {weeks.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyDayToAllWeeks}
                    style={{
                      background: '#fefce8',
                      color: '#854d0e',
                      border: '1px solid #fef08a',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Lấy thực đơn của ngày này áp dụng cho toàn bộ các ngày"
                  >
                    <Copy size={12} /> Áp dụng cho toàn bộ {durationDays} ngày
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 105px), 1fr))', gap: '8px', width: '100%', minWidth: 0 }}>
              {activeWeek.days.map((d, dIdx) => {
                const isSelected = dIdx === selectedDayIdx;
                const dayKcal = d.meals.reduce((sum, m) => sum + (m.items.reduce((s, it) => s + (Number(it.calories) || 0), 0)), 0);
                return (
                  <button
                    key={d.dayNumber}
                    type="button"
                    onClick={() => setSelectedDayIdx(dIdx)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      background: isSelected ? '#f0f9ff' : '#f8fafc',
                      color: isSelected ? '#003b70' : '#475569',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(2, 132, 199, 0.15)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? '#0284c7' : '#1e293b' }}>
                      {d.dayOfWeek}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: isSelected ? '#0369a1' : '#64748b' }}>
                      {formatDisplayDate(d.date).slice(0, 5)} (Ngày {d.dayNumber})
                    </div>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        marginTop: '2px',
                        background: isSelected ? '#bae6fd' : '#e2e8f0',
                        color: isSelected ? '#0369a1' : '#475569',
                        borderRadius: '4px',
                        padding: '2px 4px',
                      }}
                    >
                      {d.meals.length} bữa • {dayKcal} kcal
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 3: MEALS BANNER FOR ACTIVE DAY */}
      {hasAnyMeals && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Salad size={18} color="#16a34a" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#003b70' }}>
              3. PHÂN CẤP THEO BỮA ĂN: {activeDay.dayOfWeek} ({formatDisplayDate(activeDay.date)}) • {activeWeek.name}
            </h3>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700 }}>
            {meals.length} Bữa • {totalKcal} kcal (P: {totalProtein}g | C: {totalCarbs}g | F: {totalFat}g)
          </div>
        </div>
      )}

      {/* Meals Grid (Bữa Sáng, Bữa Trưa, Bữa Phụ, Bữa Tối, v.v.) */}
      {hasAnyMeals && meals.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: '16px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {meals.map((meal, mealIdx) => (
            <MealCardItem
              key={meal.id}
              meal={meal}
              mealIdx={mealIdx}
              mealsCount={meals.length}
              isGeneratingImg={generatingImageId === meal.id}
              isGeneratingAllItems={generatingMealAllItemsId === (meal.id || String(mealIdx))}
              generatingItemKey={generatingItemKey}
              onUpdateMealName={handleUpdateMealName}
              onUpdateMealTimeSlot={handleUpdateMealTimeSlot}
              onRemoveMeal={handleRemoveMealBlock}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
              onUpdateItem={handleUpdateItem}
              onGenerateImage={(idx) => void handleGenerateMealImage(idx)}
              onGenerateItemImage={(mIdx, itIdx, force) => void handleGenerateItemImage(mIdx, itIdx, force)}
              onGenerateAllMealItemsImages={(mIdx) => void handleGenerateAllMealItemsImages(mIdx)}
              onPreviewImage={(prev) => setPreviewImage(prev)}
              onOpenSwapper={handleOpenSwapper}
            />
          ))}
        </div>
      )}

      {/* Add New Meal Block Button */}
      {meals.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <button
            type="button"
            onClick={handleAddMealBlock}
            style={{
              background: '#ffffff',
              border: '2px dashed #00a4e4',
              borderRadius: '10px',
              padding: '10px 24px',
              fontSize: '0.84rem',
              color: '#003b70',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={16} color="#00a4e4" /> Thêm Một Bữa Ăn Mới (Bữa 5, Bữa Phụ...)
          </button>
        </div>
      )}

      {/* STICKY SAVE & PUBLISH ACTION BAR */}
      {meals.length > 0 && (
        <div
          style={{
            marginTop: '18px',
            background: 'linear-gradient(135deg, #003b70 0%, #002244 100%)',
            borderRadius: '14px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 8px 24px rgba(0, 59, 112, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ color: '#ffffff' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                Tổng Thực Đơn: <span style={{ color: '#4ade80' }}>{totalKcal} kcal</span> ({meals.length} bữa ăn)
              </div>
              <div style={{ fontSize: '0.76rem', color: '#93c5fd', marginTop: '2px' }}>
                P: <strong>{totalProtein}g</strong> | C: <strong>{totalCarbs}g</strong> | F: <strong>{totalFat}g</strong> • Học viên: <strong>{effectiveCustomerName || 'Chưa chọn'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isEditingExistingPlan ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSavePlan()}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
                }}
              >
                <Save size={16} /> {saving ? 'Đang Cập Nhật...' : 'Cập Nhật'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSavePlan(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Save size={15} /> {saving ? 'Đang Lưu...' : 'Lưu Bản Nháp'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSavePlan(true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 22px',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
                  }}
                >
                  <Send size={15} /> {saving ? 'Đang Gửi...' : 'Lưu & Gửi Cho Học Viên Áp Dụng Ngay'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Full-size Image Preview Modal */}
      <MealImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />

      {/* Swapper Modal */}
      <MealSwapperModal
        open={swapperOpen}
        onClose={() => {
          setSwapperOpen(false);
          setSwapperTarget(null);
        }}
        currentDish={
          swapperTarget?.foodItem
            ? {
              name: swapperTarget.foodItem.name,
              amount: swapperTarget.foodItem.amount,
              calories: swapperTarget.foodItem.calories,
              protein: swapperTarget.foodItem.protein,
              carbs: swapperTarget.foodItem.carbs,
              fat: swapperTarget.foodItem.fat,
              prepTip: swapperTarget.foodItem.prepTip,
              mealName: swapperTarget.mealName || (swapperTarget.mealIdx !== undefined ? meals[swapperTarget.mealIdx]?.name : undefined),
            }
            : undefined
        }
        initialFoodName={swapperTarget?.foodItem?.name || swapperTarget?.foodName}
        initialGrams={swapperTarget?.foodItem?.amount || swapperTarget?.amount}
        targetItemLabel={
          swapperTarget?.foodItem?.name
            ? `${swapperTarget.foodItem.name} (${swapperTarget.mealName || meals[swapperTarget.mealIdx]?.name || `Bữa ${swapperTarget.mealIdx + 1}`})`
            : swapperTarget?.foodName
              ? `${swapperTarget.foodName} (${meals[swapperTarget.mealIdx]?.name || `Bữa ${swapperTarget.mealIdx + 1}`})`
              : undefined
        }
        onApplySwap={swapperTarget ? handleApplySwap : undefined}
      />
    </div>
  );
}
