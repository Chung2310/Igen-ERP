import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Calculator, Calendar, Database, Flame, Image as ImageIcon, Pencil, Plus, Salad, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import RecordEditor from "./RecordEditor";
import NutritionPlanStudio from "./NutritionPlanStudio";
import { dateLabel, Feedback, Field, GymEmptyState, messageOf, secondary, useGymQuery } from "./ui";

type NutritionTab = "calculator" | "plans" | "foods" | "activity" | "logs";
const ACTIVITY_TONES = ["blue", "green", "red", "violet", "orange"] as const;
const SCHEDULE_TONES = ["blue", "green", "red", "violet"] as const;
const HABIT_TONES = ["orange", "teal", "pink", "indigo", "blue"] as const;

const ACTIVITIES = [
  { id: "gym_hiit", name: "Gym / Kháng lực cường độ cao (1h)", category: "STRENGTH", met: 6.5, minutes: 60, distance: 0, note: "Tập tạ nặng, nghỉ ngắn, superset", benchmark: "1h tập tạ ~ 400 - 500 kcal" },
  { id: "running_5k", name: "Chạy bộ 5km (Pace ~6:00)", category: "CARDIO", met: 9.8, minutes: 30, distance: 5, note: "Chạy tốc độ trung bình 10 km/h", benchmark: "Chạy 5km ~ 450 - 550 kcal" },
  { id: "swimming_1k", name: "Bơi lội 1km (Bơi sải / Ếch)", category: "CARDIO", met: 7.5, minutes: 40, distance: 1, note: "Vận động toàn thân dưới nước", benchmark: "Bơi 1km ~ 350 - 450 kcal" },
  { id: "cycling_20k", name: "Cycling / Đạp xe 20km ngoài trời", category: "CARDIO", met: 7.5, minutes: 50, distance: 20, note: "Tốc độ 22–25 km/h", benchmark: "Đạp xe 20km ~ 350 - 500 kcal" },
  { id: "tabata_hiit", name: "Tabata / HIIT ngắt quãng (30p)", category: "CARDIO", met: 9.5, minutes: 30, distance: 0, note: "20s nỗ lực tối đa + 10s nghỉ", benchmark: "30 phút HIIT ~ 350 - 450 kcal" },
  { id: "boxing_kickfit", name: "Boxing / Kickfit (45p)", category: "MARTIAL_ARTS", met: 8.5, minutes: 45, distance: 0, note: "Đấm bao cát và di chuyển linh hoạt", benchmark: "45 phút Boxing ~ 400 - 500 kcal" },
  { id: "jump_rope", name: "Nhảy dây tốc độ (30p)", category: "CARDIO", met: 10, minutes: 30, distance: 0, note: "100–120 nhịp/phút", benchmark: "30 phút nhảy dây ~ 400 - 550 kcal" },
  { id: "badminton", name: "Cầu lông / Tennis đối kháng (1h)", category: "SPORTS", met: 6.5, minutes: 60, distance: 0, note: "Di chuyển bước chân liên tục", benchmark: "1h đối kháng ~ 360 - 480 kcal" },
  { id: "cardio_zone2", name: "Cardio Zone 2 / LISS (45p)", category: "CARDIO", met: 5.5, minutes: 45, distance: 0, note: "Nhịp tim 60–70% Max HR", benchmark: "45 phút Zone 2 ~ 250 - 350 kcal" },
  { id: "yoga_mobility", name: "Yoga & Giãn cơ phục hồi (45p)", category: "RECOVERY", met: 3, minutes: 45, distance: 0, note: "Tăng tầm vận động khớp", benchmark: "45 phút Yoga ~ 120 - 200 kcal" },
] as const;

const BODY_TYPES = [
  { label: "Endomorph", value: "Endomorph (Dễ tích mỡ)" },
  { label: "Ectomorph", value: "Ectomorph (Khó tăng cân)" },
  { label: "Mesomorph", value: "Mesomorph (Cân đối, dễ tăng cơ)" },
  { label: "Skinny Fat", value: "Skinny Fat (Gầy nhưng mỡ bụng cao)" },
] as const;

const SCHEDULE_PRESETS = [
  "Văn phòng ngồi nhiều, tập chiều 18h-19h30",
  "Làm ca kíp / Ca đêm, tập linh hoạt",
  "Bận rộn, chỉ nấu 2 bữa/ngày",
  "Tập sáng sớm 6h-7h15, nặng",
] as const;

const HABIT_PRESETS = [
  "Món Việt dễ nấu, không hải sản vỏ, không lactose",
  "Eat Clean, ưu tiên hấp/luộc/áp chảo ít dầu",
  "Ăn chay thể hình (trứng, sữa, đậu hũ)",
  "Nhịn ăn gián đoạn 16/8",
  "Ăn ngoài quán cơm bình dân buổi trưa",
] as const;

const FOOD_CATEGORIES = [
  ["PROTEIN", "Đạm (Protein)"],
  ["CARB", "Tinh bột (Carbs)"],
  ["VEGGIE", "Rau củ (Fiber)"],
  ["FAT", "Chất béo (Fat)"],
] as const;

const iconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary";

const dangerIconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-error/30 bg-surface-container-lowest text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-primary";

export default function NutritionPage({
  api,
  canWrite,
  customerId: fixedCustomerId,
  initialCustomerId,
  embedded = false,
}: {
  api: GymApi;
  canWrite: boolean;
  customerId?: string;
  initialCustomerId?: string;
  embedded?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<NutritionTab>(
    fixedCustomerId || initialCustomerId ? "plans" : "calculator",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    fixedCustomerId || initialCustomerId || "",
  );
  const [revision, setRevision] = useState(0);
  const [planPage, setPlanPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodCategory, setFoodCategory] = useState<string>("ALL");
  const [foodSort, setFoodSort] = useState<"name" | "cal-asc" | "cal-desc" | "protein-desc">("name");
  const [foodPageSize, setFoodPageSize] = useState<number>(12);
  const [foodPage, setFoodPage] = useState<number>(1);
  const [editor, setEditor] = useState<{
    entity: "nutrition-plans" | "nutrition-logs";
    mode?: "ai" | "manual";
    record?: GymRecord;
    customerId?: string;
    prefill?: {
      title?: string;
      bmr?: number | string;
      tdee?: number | string;
      targetCalories?: number;
      startDate?: string;
      endDate?: string;
      macros?: { protein: number; carbs: number; fat: number };
      menu?: any[];
      notes?: string;
      durationDays?: number;
      dailyPlans?: any[];
    };
  }>();
  const [studioVersion, setStudioVersion] = useState(0);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<{ entity: "nutrition-plans" | "nutrition-logs" | "food-images"; record: GymRecord }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Interactive BMR & Macro calculator state (matching 3S-Gym Tab 1)
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(172);
  const [age, setAge] = useState(26);
  const [bodyFat, setBodyFat] = useState("");
  const [calculatorMode, setCalculatorMode] = useState<"AI_EXPERT" | "FORMULA">("AI_EXPERT");
  const [formulaReady, setFormulaReady] = useState(false);
  const [quickPreviewReady, setQuickPreviewReady] = useState(false);
  const [foodImageFile, setFoodImageFile] = useState<File | null>(null);
  const [seedingFoods, setSeedingFoods] = useState(false);
  const autoSeededFoodsRef = useRef(false);
  const [activity, setActivity] = useState(1.55);
  const [formulaGoal, setFormulaGoal] = useState("FAT_LOSS_MODERATE");
  const [proteinRatio, setProteinRatio] = useState(2);
  const [fatRatio, setFatRatio] = useState(0.8);
  const [bodyType, setBodyType] = useState<string>("Endomorph (Dễ tích mỡ)");
  const [scheduleNote, setScheduleNote] = useState("Văn phòng ngồi nhiều, tập chiều 18h-19h30");
  const [eatingHabits, setEatingHabits] = useState("Món Việt dễ nấu, không hải sản vỏ, không lactose");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [specificGoal, setSpecificGoal] = useState("Giảm 3-4kg mỡ, săn chắc cơ bụng trong 8 tuần");
  const [customAiRequest, setCustomAiRequest] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<{
    bmr: number;
    tdee: number;
    targetCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    waterLiters: number;
    summary: string;
    mealTiming: string[];
    recommendations: string[];
    warnings: string[];
  } | null>(null);

  // Inline Add / Edit Food form state (matching 3S-Gym Tab 3)
  const [showAddFood, setShowAddFood] = useState(false);
  const [editingFood, setEditingFood] = useState<GymRecord | null>(null);
  const [foodName, setFoodName] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState<string>("PROTEIN");
  const [servingLabel, setServingLabel] = useState("1 đĩa (150g)");
  const [servingGrams, setServingGrams] = useState<number>(150);
  const [foodCalories, setFoodCalories] = useState<string>("");
  const [foodProtein, setFoodProtein] = useState<string>("");
  const [foodCarbs, setFoodCarbs] = useState<string>("");
  const [foodFat, setFoodFat] = useState<string>("");
  const [cookingNote, setCookingNote] = useState("");
  const [savingFood, setSavingFood] = useState(false);
  const [foodFormError, setFoodFormError] = useState("");

  const resetFoodForm = () => {
    setEditingFood(null);
    setFoodName("");
    setNewFoodCategory("PROTEIN");
    setServingLabel("1 đĩa (150g)");
    setServingGrams(150);
    setFoodCalories("");
    setFoodProtein("");
    setFoodCarbs("");
    setFoodFat("");
    setCookingNote("");
    setFoodImageFile(null);
    setFoodFormError("");
    setShowAddFood(false);
  };

  const startEditFood = (food: GymRecord) => {
    setEditingFood(food);
    setFoodName(String(food.name || ""));
    setNewFoodCategory(String(food.category || "PROTEIN"));
    setServingLabel(String(food.servingLabel || "1 đĩa (150g)"));
    setServingGrams(Number(food.servingGrams || 150));
    setFoodCalories(food.calories != null ? String(food.calories) : "");
    setFoodProtein(food.protein != null ? String(food.protein) : "");
    setFoodCarbs(food.carbs != null ? String(food.carbs) : "");
    setFoodFat(food.fat != null ? String(food.fat) : "");
    setCookingNote(String(food.cookingNote || food.prompt || ""));
    setFoodImageFile(null);
    setFoodFormError("");
    setShowAddFood(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [selectedActivityId, setSelectedActivityId] = useState<string>(ACTIVITIES[0].id);
  const [activityCategory, setActivityCategory] = useState<string>("ALL");
  const [activityMinutes, setActivityMinutes] = useState<number>(60);
  const [activityDistance, setActivityDistance] = useState<number>(0);
  const [activitySaving, setActivitySaving] = useState(false);
  const [activityError, setActivityError] = useState("");
  const selectedActivity = ACTIVITIES.find(a => a.id === selectedActivityId) || ACTIVITIES[0];
  const burnedCalories = Math.round(((selectedActivity.met * 3.5 * Math.max(weight, 30)) / 200) * Math.max(activityMinutes, 1));
  const filteredActivities = ACTIVITIES.filter(a => activityCategory === "ALL" || a.category === activityCategory);
  const selectActivity = (id: string) => {
    const item = ACTIVITIES.find(activity => activity.id === id);
    if (!item) return;
    setSelectedActivityId(id);
    setActivityMinutes(item.minutes);
    setActivityDistance(item.distance);
  };
  const saveActivityLog = async () => {
    if (!customerId) { setActivityError("Vui lòng chọn học viên trước khi lưu nhật ký vận động."); return; }
    setActivitySaving(true); setActivityError("");
    try {
      await api.save("nutrition-logs", { customerId, date: new Date().toISOString(), type: "ACTIVITY", mealType: selectedActivity.name, foods: "", calories: burnedCalories, durationMinutes: activityMinutes, notes: `Tiêu hao ước tính: MET ${selectedActivity.met} | Cân nặng ${weight}kg | Thời gian ${activityMinutes} phút${activityDistance ? ` | Quãng đường ${activityDistance}km` : ""}` });
      refresh();
    } catch (cause) { setActivityError(messageOf(cause)); } finally { setActivitySaving(false); }
  };

  const refresh = () => setRevision(v => v + 1);
  const customerId = fixedCustomerId || selectedCustomerId;

  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=200", 0);
  const customerMap = useMemo(() => {
    const map = new Map<string, GymRecord>();
    for (const c of customersQuery.data?.data || []) map.set(c._id, c);
    return map;
  }, [customersQuery.data]);

  const plansQuery = useGymQuery<GymList>(
    api,
    `/nutrition-plans?page=${planPage}&limit=15${customerId ? `&customerId=${customerId}` : ""}`,
    revision,
  );
  const logsQuery = useGymQuery<GymList>(
    api,
    `/nutrition-logs?page=${logPage}&limit=15${customerId ? `&customerId=${customerId}` : ""}`,
    revision,
  );
  const foodsQuery = useGymQuery<GymList>(
    api,
    `/food-images?limit=200`,
    revision,
  );

  const allFoods = foodsQuery.data?.data || [];
  const seedDefaultFoods = async () => {
    if (seedingFoods) return;
    setSeedingFoods(true);
    setError("");
    try {
      await api.request("/food-images/seed-defaults", "POST", {});
      refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSeedingFoods(false);
    }
  };

  useEffect(() => {
    if (
      activeTab === "foods" &&
      canWrite &&
      !autoSeededFoodsRef.current &&
      !foodsQuery.loading &&
      foodsQuery.data &&
      foodsQuery.data.meta.total === 0
    ) {
      autoSeededFoodsRef.current = true;
      void seedDefaultFoods();
    }
  }, [activeTab, canWrite, foodsQuery.loading, foodsQuery.data]);
  const foodCounts = useMemo(() => ({
    ALL: allFoods.length,
    UPLOAD: allFoods.filter(f => f.source === "UPLOAD").length,
    PROTEIN: allFoods.filter(f => f.category === "PROTEIN").length,
    CARB: allFoods.filter(f => f.category === "CARB").length,
    VEGGIE: allFoods.filter(f => f.category === "VEGGIE").length,
    FAT: allFoods.filter(f => f.category === "FAT").length,
  }), [allFoods]);

  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase();
    let list = allFoods.filter(f => {
      if (foodCategory === "UPLOAD" && f.source !== "UPLOAD") return false;
      if (!["ALL", "UPLOAD"].includes(foodCategory) && f.category !== foodCategory) return false;
      if (q && !String(f.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (foodSort === "cal-asc") return Number(a.calories || 0) - Number(b.calories || 0);
      if (foodSort === "cal-desc") return Number(b.calories || 0) - Number(a.calories || 0);
      if (foodSort === "protein-desc") return Number(b.protein || 0) - Number(a.protein || 0);
      return String(a.name || "").localeCompare(String(b.name || ""), "vi");
    });
    return list;
  }, [allFoods, foodCategory, foodSearch, foodSort]);

  const foodTotalPages = Math.max(1, Math.ceil(filteredFoods.length / foodPageSize));
  const pagedFoods = filteredFoods.slice((foodPage - 1) * foodPageSize, foodPage * foodPageSize);

  const computedFoodCalories =
    foodCalories.trim() !== ""
      ? Number(foodCalories) || 0
      : Math.round((Number(foodProtein) || 0) * 4 + (Number(foodCarbs) || 0) * 4 + (Number(foodFat) || 0) * 9);

  const handleSaveFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingFood) return;
    setFoodFormError("");
    if (!foodName.trim()) {
      setFoodFormError("Vui lòng nhập tên món ăn.");
      return;
    }
    setSavingFood(true);
    try {
      if (editingFood) {
        if (foodImageFile) {
          const fd = new FormData();
          fd.append("file", foodImageFile);
          fd.append("name", foodName.trim());
          fd.append("category", newFoodCategory);
          fd.append("servingLabel", servingLabel.trim());
          fd.append("servingGrams", String(Number(servingGrams) || 0));
          fd.append("calories", String(computedFoodCalories));
          fd.append("protein", String(Number(foodProtein) || 0));
          fd.append("carbs", String(Number(foodCarbs) || 0));
          fd.append("fat", String(Number(foodFat) || 0));
          fd.append("cookingNote", cookingNote.trim());
          fd.append("prompt", cookingNote.trim());
          await api.request(`/food-images/${editingFood._id}/upload`, "POST", fd);
        } else {
          await api.save(
            "food-images",
            {
              name: foodName.trim(),
              category: newFoodCategory,
              servingLabel: servingLabel.trim(),
              servingGrams: Number(servingGrams) || 0,
              calories: computedFoodCalories,
              protein: Number(foodProtein) || 0,
              carbs: Number(foodCarbs) || 0,
              fat: Number(foodFat) || 0,
              cookingNote: cookingNote.trim(),
              prompt: cookingNote.trim(),
              source: editingFood.source || "UPLOAD",
              imageUrl: editingFood.imageUrl || null,
              keywords: editingFood.keywords || [],
            },
            editingFood,
          );
        }
      } else if (foodImageFile) {
        const fd = new FormData();
        fd.append("file", foodImageFile);
        fd.append("name", foodName.trim());
        fd.append("category", newFoodCategory);
        fd.append("servingLabel", servingLabel.trim());
        fd.append("servingGrams", String(Number(servingGrams) || 0));
        fd.append("calories", String(computedFoodCalories));
        fd.append("protein", String(Number(foodProtein) || 0));
        fd.append("carbs", String(Number(foodCarbs) || 0));
        fd.append("fat", String(Number(foodFat) || 0));
        fd.append("cookingNote", cookingNote.trim());
        fd.append("source", "UPLOAD");
        await api.request("/food-images/upload", "POST", fd);
      } else {
        await api.save("food-images", {
          name: foodName.trim(),
          category: newFoodCategory,
          servingLabel: servingLabel.trim(),
          servingGrams: Number(servingGrams) || 0,
          calories: computedFoodCalories,
          protein: Number(foodProtein) || 0,
          carbs: Number(foodCarbs) || 0,
          fat: Number(foodFat) || 0,
          cookingNote: cookingNote.trim(),
          source: "UPLOAD",
          keywords: [],
        });
      }
      resetFoodForm();
      refresh();
    } catch (err) {
      setFoodFormError(messageOf(err));
    } finally {
      setSavingFood(false);
    }
  };

  const rawBodyFat = Number(bodyFat);
  const formulaBmr = Number.isFinite(rawBodyFat) && rawBodyFat > 3 && rawBodyFat < 60
    ? Math.round(370 + 21.6 * weight * (1 - rawBodyFat / 100))
    : Math.round(10 * weight + 6.25 * height - 5 * age + (gender === "MALE" ? 5 : -161));
  const bmr = calculatorMode === "AI_EXPERT" ? aiAnalysis?.bmr ?? formulaBmr : formulaBmr;
  const tdee = calculatorMode === "AI_EXPERT" ? aiAnalysis?.tdee ?? Math.round(bmr * activity) : Math.round(bmr * activity);
  const formulaAdjustment = formulaGoal === "FAT_LOSS_FAST" ? -500 : formulaGoal === "FAT_LOSS_MODERATE" ? -350 : formulaGoal === "LEAN_BULK" ? 300 : 0;
  const targetCalories = calculatorMode === "AI_EXPERT" ? aiAnalysis?.targetCalories ?? tdee : Math.round(tdee + formulaAdjustment);
  const proteinG = calculatorMode === "AI_EXPERT" ? aiAnalysis?.macros.protein ?? Math.round(weight * proteinRatio) : Math.round(weight * proteinRatio);
  const fatG = calculatorMode === "AI_EXPERT" ? aiAnalysis?.macros.fat ?? Math.round(weight * fatRatio) : Math.round(weight * fatRatio);
  const carbsG = calculatorMode === "AI_EXPERT" ? aiAnalysis?.macros.carbs ?? Math.max(0, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4)) : Math.max(0, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4));
  const waterL = calculatorMode === "AI_EXPERT" ? aiAnalysis?.waterLiters ?? Math.max(1.5, Math.round(weight * 0.04 * 10) / 10) : Math.round((weight * 0.04 + (activity > 1.5 ? 0.5 : 0)) * 10) / 10;
  const analysisNotes = [
    aiAnalysis?.summary,
    bodyType && `Thể chất: ${bodyType}`,
    scheduleNote.trim() && `Lịch trình: ${scheduleNote.trim()}`,
    eatingHabits.trim() && `Thói quen/Dị ứng: ${eatingHabits.trim()}`,
    medicalNotes.trim() && `Lưu ý sức khỏe: ${medicalNotes.trim()}`,
    specificGoal.trim() && `Mục tiêu: ${specificGoal.trim()}`,
  ].filter(Boolean).join("\n");

  const handleAnalyzeNutrition = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const res = await api.request<NonNullable<typeof aiAnalysis>>("/nutrition/analyze", "POST", {
        customerId: customerId || undefined,
        gender,
        weight,
        height,
        age,
        bodyFat,
        bodyType,
        scheduleNote,
        eatingHabits,
        medicalNotes,
        specificGoal,
        customAiRequest,
      });
      setAiAnalysis(res);
    } catch (err) {
      setAnalyzeError(messageOf(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const onSelectCustomer = (nextId: string) => {
    setSelectedCustomerId(nextId);
    setPlanPage(1);
    setLogPage(1);
    const found = customerMap.get(nextId);
    if (found) {
      if (typeof found.initialWeight === "number" && found.initialWeight > 0) setWeight(found.initialWeight);
      if (typeof found.height === "number" && found.height > 0) setHeight(found.height);
      if (found.gender === "MALE" || found.gender === "FEMALE") setGender(found.gender);
      if (found.dateOfBirth) {
        const dob = Date.parse(String(found.dateOfBirth));
        if (Number.isFinite(dob)) {
          const calcAge = Math.floor((Date.now() - dob) / (365.25 * 24 * 3600 * 1000));
          if (calcAge > 10 && calcAge < 100) setAge(calcAge);
        }
      }
      if (found.initialGoal) setSpecificGoal(String(found.initialGoal));
      if (found.medicalNotes) setMedicalNotes(String(found.medicalNotes));
    }
  };

  const logTotals = useMemo(() => {
    const items = logsQuery.data?.data || [];
    return items.reduce(
      (acc, item) => {
        const isActivity = item.type === "ACTIVITY";
        const cal = Number(item.calories || 0);
        return {
          consumed: acc.consumed + (isActivity ? 0 : cal),
          burned: acc.burned + (isActivity ? cal : 0),
          protein: acc.protein + (isActivity ? 0 : Number(item.protein || 0)),
          carbs: acc.carbs + (isActivity ? 0 : Number(item.carbs || 0)),
          fat: acc.fat + (isActivity ? 0 : Number(item.fat || 0)),
        };
      },
      { consumed: 0, burned: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [logsQuery.data]);

  if (editor?.entity === "nutrition-plans") {
    return (
      <NutritionPlanStudio
        key={studioVersion}
        api={api}
        record={editor.record}
        prefill={editor.prefill}
        fixedCustomerId={editor.customerId || customerId || undefined}
        initialMode={editor.mode || "manual"}
        onBack={() => setEditor(undefined)}
        onSaved={() => {
          setEditor(undefined);
          refresh();
        }}
      />
    );
  }

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Dinh dưỡng">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant">
        <nav aria-label="Công cụ dinh dưỡng" className="flex gap-1 overflow-x-auto">
          {([
            ["calculator", "Tính BMR & Macro", Calculator],
            ["plans", "Thực đơn", Salad],
            ["foods", "Kho món ăn", UtensilsCrossed],
            ["activity", "Tiêu hao vận động", Activity],
            ["logs", "Nhật ký calo", Flame],
          ] as const).map(([key, label, Icon]) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2 pb-1.5">
          {!embedded && !fixedCustomerId && (
            <Dropdown
              aria-label="Học viên"
              variant="filter"
              searchable
              searchPlaceholder="Tìm tên hoặc SĐT..."
              value={selectedCustomerId}
              onChange={onSelectCustomer}
              options={[
                { value: "", label: "Tất cả học viên" },
                ...(customersQuery.data?.data || []).map(c => ({
                  value: c._id,
                  label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                })),
              ]}
            />
          )}
          {!embedded && (
            <ErpRefreshButton loading={plansQuery.loading || logsQuery.loading} onClick={refresh} />
          )}
          {canWrite && activeTab === "plans" && (
            <button
              type="button"
              className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => {
                setStudioVersion(v => v + 1);
                setEditor({
                  entity: "nutrition-plans",
                  mode: "ai",
                  prefill: {
                    bmr,
                    tdee,
                    targetCalories,
                    macros: { protein: proteinG, carbs: carbsG, fat: fatG },
                  },
                });
              }}
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI tạo thực đơn
            </button>
          )}
          {canWrite && (activeTab === "plans" || activeTab === "logs") && (
            <button
              type="button"
              className={cn(primaryCreateButtonClass, "min-h-9")}
              onClick={() => {
                setStudioVersion(v => v + 1);
                setEditor({
                  entity: activeTab === "logs" ? "nutrition-logs" : "nutrition-plans",
                  mode: "manual",
                });
              }}
            >
              <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
              {activeTab === "logs" ? "Ghi nhật ký" : "Tạo thực đơn"}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Interactive BMR & Macro Calculator */}
      {activeTab === "calculator" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
            <h2 className="text-base font-semibold text-on-surface">Trợ lý dinh dưỡng & thực đơn</h2>
            <div className="inline-flex gap-1 rounded-md border border-outline-variant bg-surface-container-low p-1" role="tablist" aria-label="Chế độ tính dinh dưỡng">
              <button type="button" role="tab" aria-selected={calculatorMode === "AI_EXPERT"} onClick={() => setCalculatorMode("AI_EXPERT")} className={cn("rounded px-3 py-1.5 text-xs font-semibold", calculatorMode === "AI_EXPERT" ? "bg-primary text-on-primary" : "text-on-surface-variant")}>Hỏi Chuyên Gia AI</button>
              <button type="button" role="tab" aria-selected={calculatorMode === "FORMULA"} onClick={() => setCalculatorMode("FORMULA")} className={cn("rounded px-3 py-1.5 text-xs font-semibold", calculatorMode === "FORMULA" ? "bg-primary text-on-primary" : "text-on-surface-variant")}>Công thức</button>
            </div>
          </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-7">
            <h3 data-typography="section-title" className="text-balance text-sm font-semibold text-on-surface">
              Chỉ số cơ thể
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Giới tính"
                value={gender}
                options={[["MALE", "Nam"], ["FEMALE", "Nữ"]]}
                onChange={v => setGender(v as "MALE" | "FEMALE")}
              />
              <Field label="Cân nặng (kg)" type="number" min={25} max={250} value={weight} onChange={v => setWeight(Number(v) || 0)} />
              <Field label="Chiều cao (cm)" type="number" min={100} max={240} value={height} onChange={v => setHeight(Number(v) || 0)} />
              <Field label="Tuổi" type="number" min={10} max={100} value={age} onChange={v => setAge(Number(v) || 0)} />
              <Field label="% Mỡ" placeholder="VD: 18" value={bodyFat} onChange={setBodyFat} />
              {calculatorMode === "AI_EXPERT" && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setQuickPreviewReady(true)}
                    className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Calculator className="size-3.5" aria-hidden="true" />
                    Tính Ngay
                  </button>
                </div>
              )}
              {calculatorMode === "FORMULA" && <Field
                label="Mức vận động"
                value={String(activity)}
                options={[
                  ["1.2", "Ít vận động"],
                  ["1.375", "Nhẹ (1–3 buổi/tuần)"],
                  ["1.55", "Vừa (3–5 buổi/tuần)"],
                  ["1.725", "Cao (6–7 buổi/tuần)"],
                ]}
                onChange={v => setActivity(Number(v))}
              />}
            </div>

            {calculatorMode === "FORMULA" && <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Mục tiêu thể hình" value={formulaGoal} onChange={setFormulaGoal} options={[["FAT_LOSS_FAST", "Giảm mỡ nhanh"], ["FAT_LOSS_MODERATE", "Giảm mỡ bền vững"], ["MAINTENANCE", "Duy trì vóc dáng"], ["LEAN_BULK", "Tăng cơ nạc"]]} />
              <Field label="Protein ratio (g/kg)" type="number" min={0} value={proteinRatio} onChange={v => setProteinRatio(Number(v) || 0)} />
              <Field label="Fat ratio (g/kg)" type="number" min={0} value={fatRatio} onChange={v => setFatRatio(Number(v) || 0)} />
              <button type="button" className={cn(primaryCreateButtonClass, "min-h-9 sm:col-span-3")} onClick={() => setFormulaReady(true)}>Tính theo công thức</button>
            </div>}

            {calculatorMode === "AI_EXPERT" && <>
            <div className="space-y-2">
              <Field
                label="Dạng thể chất & cơ chế chuyển hóa"
                multiline
                value={bodyType}
                onChange={setBodyType}
                placeholder="VD: Endomorph (Dễ tích mỡ)..."
              />
              <div className="flex flex-wrap gap-1.5">
                {BODY_TYPES.map((type, index) => (
                  <button
                    key={type.label}
                    type="button"
                    aria-pressed={bodyType === type.value}
                    onClick={() => setBodyType(type.value)}
                    className={`gym-choice-label gym-choice-label--${ACTIVITY_TONES[index]}`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Field
                label="Lịch trình sinh hoạt & giờ tập luyện"
                multiline
                value={scheduleNote}
                onChange={setScheduleNote}
                placeholder="VD: Văn phòng ngồi nhiều, tập chiều 18h-19h30..."
              />
              <div className="flex flex-wrap gap-1.5">
                {SCHEDULE_PRESETS.map((preset, index) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScheduleNote(preset)}
                    aria-pressed={scheduleNote === preset}
                    className={`gym-choice-label gym-choice-label--${SCHEDULE_TONES[index]}`}
                    title={preset}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Field
                label="Thói quen ăn uống, dị ứng & nhu cầu đặc thù"
                multiline
                value={eatingHabits}
                onChange={setEatingHabits}
                placeholder="VD: Món Việt dễ nấu, không hải sản vỏ, không lactose..."
              />
              <div className="flex flex-wrap gap-1.5">
                {HABIT_PRESETS.map((preset, index) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEatingHabits(preset)}
                    aria-pressed={eatingHabits === preset}
                    className={`gym-choice-label gym-choice-label--${HABIT_TONES[index]}`}
                    title={preset}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label="Mục tiêu cụ thể của học viên"
              value={specificGoal}
              onChange={setSpecificGoal}
              placeholder="VD: Giảm 3-4kg mỡ, săn chắc cơ bụng trong 8 tuần"
            />
            <Field label="Lưu ý sức khỏe / bệnh lý" multiline value={medicalNotes} onChange={setMedicalNotes} />
            <Field label="Yêu cầu bổ sung cho AI" multiline value={customAiRequest} onChange={setCustomAiRequest} />

            <Feedback error={analyzeError} />
            <button
              type="button"
              disabled={analyzing}
              className={cn(primaryCreateButtonClass, "min-h-10 w-full")}
              onClick={() => void handleAnalyzeNutrition()}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {analyzing ? "AI đang phân tích..." : "AI phân tích thể chất & tính toán chuyên sâu"}
            </button>
            </>}
          </div>

          <div className="flex flex-col justify-between space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-5">
            {calculatorMode === "AI_EXPERT" && !aiAnalysis && !quickPreviewReady && !analyzing ? <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">Điền thể trạng, lịch sinh hoạt và thói quen ăn uống, rồi bấm “Tính Ngay” hoặc “AI phân tích thể chất” để nhận kết quả.</div> : calculatorMode === "FORMULA" && !formulaReady ? <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">Nhập chỉ số và mục tiêu, rồi bấm “Tính theo công thức”.</div> : analyzing ? <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-primary/40 p-6 text-sm text-primary"><Sparkles className="mb-2 size-6" />AI đang phân tích thể trạng, BMR, TDEE và Macro...</div> : <>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 data-typography="section-title" className="text-balance text-sm font-semibold text-on-surface">
                  Năng lượng &amp; Macro
                </h3>
                <HrStatusBadge tone="info" className="max-w-[180px] truncate normal-case">
                  {bodyType.split(" (")[0] || "Thể chất"}
                </HrStatusBadge>
              </div>
              <dl className="grid grid-cols-3 gap-2.5">
                <div className="rounded-md border border-outline-variant bg-surface-container-low/50 p-3">
                  <dt className="text-xs text-on-surface-variant">BMR</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{bmr}</dd>
                  <span className="text-[11px] text-on-surface-variant">kcal</span>
                </div>
                <div className="rounded-md border border-outline-variant bg-surface-container-low/50 p-3">
                  <dt className="text-xs text-on-surface-variant">TDEE</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{tdee}</dd>
                  <span className="text-[11px] text-on-surface-variant">kcal</span>
                </div>
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                  <dt className="text-xs font-medium text-primary">Mục tiêu</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-primary">{targetCalories}</dd>
                  <span className="text-[11px] text-on-surface-variant">kcal</span>
                </div>
              </dl>

              <div className="space-y-2 rounded-md border border-outline-variant p-3">
                <p className="text-xs font-medium text-on-surface-variant">Macro / ngày</p>
                <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                  <div className="rounded-md bg-surface-container-low p-2">
                    <span className="block text-xs text-on-surface-variant">Đạm</span>
                    <strong className="text-base text-on-surface">{proteinG}g</strong>
                  </div>
                  <div className="rounded-md bg-surface-container-low p-2">
                    <span className="block text-xs text-on-surface-variant">Tinh bột</span>
                    <strong className="text-base text-on-surface">{carbsG}g</strong>
                  </div>
                  <div className="rounded-md bg-surface-container-low p-2">
                    <span className="block text-xs text-on-surface-variant">Chất béo</span>
                    <strong className="text-base text-on-surface">{fatG}g</strong>
                  </div>
                </div>
              </div>

              {aiAnalysis && (
                <div className="space-y-2.5 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-primary">Phân tích AI</p>
                    <span className="tabular-nums text-on-surface-variant">Nước: ≥ {waterL}L/ngày</span>
                  </div>
                  {aiAnalysis.summary && (
                    <p className="text-pretty leading-relaxed text-on-surface">{aiAnalysis.summary}</p>
                  )}
                  {aiAnalysis.mealTiming.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-on-surface-variant">
                      {aiAnalysis.mealTiming.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                  {aiAnalysis.recommendations.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-on-surface-variant">
                      {aiAnalysis.recommendations.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                  {aiAnalysis.warnings.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-tertiary">
                      {aiAnalysis.warnings.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {canWrite && (
              <button
                type="button"
                className={cn(primaryCreateButtonClass, "min-h-9 w-full")}
                onClick={() =>
                  setEditor({
                    entity: "nutrition-plans",
                    prefill: {
                      bmr,
                      tdee,
                      targetCalories,
                      macros: { protein: proteinG, carbs: carbsG, fat: fatG },
                      notes: analysisNotes,
                    },
                  })
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Tạo thực đơn từ kết quả
              </button>
            )}
            </>}
          </div>
        </div>
        </div>
      )}

      {/* TAB 2: Nutrition Plans (3S NutritionPlanList layout) */}
      {activeTab === "plans" && (
        <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
            <h3 className="flex items-center gap-2 text-base font-bold text-on-surface">
              <Salad className="size-4 text-primary" aria-hidden="true" />
              Danh Sách Kế Hoạch Thực Đơn Dinh Dưỡng
            </h3>
          </div>

          <Feedback error={plansQuery.error || error} loading={plansQuery.loading} />
          {!plansQuery.loading && !plansQuery.error && !(plansQuery.data?.data || []).length && (
            <GymEmptyState
              kind="task"
              filtered={Boolean(customerId)}
              title="Chưa có kế hoạch thực đơn nào."
            />
          )}
          {!plansQuery.loading && !plansQuery.error && (plansQuery.data?.data || []).length > 0 && (
            <div className="flex-1">
              <div className="grid gap-4 lg:grid-cols-2">
              {(plansQuery.data?.data || []).map(row => {
                const isPub = row.status === "PUBLISHED";
                const isHierarchical = Array.isArray(row.menu) && row.menu.length > 0 && Boolean(row.menu[0]?.days);
                const weeksCount = isHierarchical ? row.menu.length : 1;
                const previewMeals: any[] = isHierarchical
                  ? (row.menu[0]?.days?.[0]?.meals || [])
                  : Array.isArray(row.dailyPlans) && row.dailyPlans.length > 0
                    ? (row.dailyPlans[0]?.meals || [])
                    : (Array.isArray(row.menu) ? row.menu : []);
                const mealsCount = previewMeals.length;
                const cleanNotes = String(row.notes || "")
                  .replace(/^(?:💡\s*)?(?:Lời khuyên(?:\s+dinh dưỡng)?|Ghi chú|Lưu ý)\s*:\s*/i, "")
                  .trim();
                const isLongNote = cleanNotes.length > 85 || cleanNotes.includes("\n");
                const isNoteExpanded = Boolean(expandedNotes[row._id]);

                return (
                  <article
                    key={row._id}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border bg-surface-container-lowest p-4 shadow-2xs transition-colors",
                      isPub ? "border-change-up/40" : "border-outline-variant",
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase",
                            isPub
                              ? "border-change-up/30 bg-change-up/10 text-change-up"
                              : "border-tertiary/30 bg-tertiary-container/40 text-tertiary",
                          )}
                        >
                          {isPub ? "ĐÃ CÔNG BỐ" : "BẢN NHÁP"}
                        </span>
                        <span className="text-xs tabular-nums text-on-surface-variant">
                          Tạo: {dateLabel(row.createdAt)}
                        </span>
                      </div>

                      {row.startDate && (
                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
                            <Calendar className="size-3.5" aria-hidden="true" />
                            Lịch ăn: {dateLabel(row.startDate)} - {dateLabel(row.endDate)} ({row.durationDays || 7} ngày)
                          </span>
                        </div>
                      )}

                      <h4 className="text-balance text-base font-bold text-on-surface">{row.title}</h4>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low/50 px-3.5 py-2.5 tabular-nums">
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-on-surface-variant">TỔNG CALO</span>
                          <strong className="text-base font-bold text-change-up">{row.targetCalories} kcal</strong>
                        </div>
                        <div className="flex gap-3 text-center">
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-on-surface-variant">ĐẠM (P)</span>
                            <strong className="text-sm font-bold text-primary">{row.macros?.protein ?? 0}g</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-on-surface-variant">CARB (C)</span>
                            <strong className="text-sm font-bold text-tertiary">{row.macros?.carbs ?? 0}g</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-on-surface-variant">FAT (F)</span>
                            <strong className="text-sm font-bold text-error">{row.macros?.fat ?? 0}g</strong>
                          </div>
                        </div>
                      </div>

                      {mealsCount > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-on-surface">
                            {weeksCount} Tuần ({row.durationDays || 7} Ngày) • {mealsCount} Bữa/Ngày:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {previewMeals.map((m, idx) => (
                              <span key={idx} className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                                {m.name || `Bữa ${idx + 1}`} ({Array.isArray(m.items) ? m.items.length : 1} món)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {cleanNotes && (
                        <div className="rounded-lg border border-tertiary/30 bg-tertiary-container/25 px-3 py-2 text-xs text-on-surface-variant">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("flex-1", !isNoteExpanded && "line-clamp-2")}>
                              <strong className="text-tertiary">Lời khuyên: </strong>
                              {cleanNotes}
                            </p>
                            {isLongNote && (
                              <button
                                type="button"
                                onClick={() => setExpandedNotes(prev => ({ ...prev, [row._id]: !prev[row._id] }))}
                                className="shrink-0 cursor-pointer font-semibold text-primary hover:underline"
                              >
                                {isNoteExpanded ? "Thu gọn" : "Xem thêm"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-outline-variant/70 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (canWrite) {
                            setStudioVersion(v => v + 1);
                            setEditor({ entity: "nutrition-plans", record: row, mode: "manual" });
                          } else {
                            setDetail(row);
                          }
                        }}
                        className="inline-flex min-h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {canWrite ? "Xem & Sửa Thực Đơn" : "Xem Thực Đơn"}
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          disabled={busy}
                          className={secondary}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              await api.request(
                                `/nutrition-plans/${row._id}/${isPub ? "unpublish" : "publish"}`,
                                "PATCH",
                                { revision: row.revision },
                              );
                              refresh();
                            } catch (cause) {
                              setError(messageOf(cause));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {isPub ? "Thu hồi" : "Công bố"}
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          aria-label="Xóa thực đơn"
                          title="Xóa thực đơn này"
                          className={dangerIconActionClass}
                          onClick={() => {
                            setError("");
                            setDeleting({ entity: "nutrition-plans", record: row });
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              </div>
            </div>
          )}
          {plansQuery.data && (
            <TablePagination
              appearance="erp"
              currentPage={planPage}
              totalPages={plansQuery.data.meta.totalPages}
              pageSize={15}
              totalItems={plansQuery.data.meta.total}
              pageSizeOptions={[15]}
              onPageChange={setPlanPage}
              onPageSizeChange={() => {}}
            />
          )}
        </div>
      )}

      {/* TAB 4: Activity Calorie Calculator */}
      {activeTab === "activity" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-2xs">
            <h3 data-typography="section-title" className="text-balance text-sm font-semibold text-on-surface">
              Tiêu hao calo vận động
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["gym_hiit", "Gym 1h"],
                ["running_5k", "Chạy 5km"],
                ["swimming_1k", "Bơi 1km"],
                ["cycling_20k", "Cycling 20km"],
                ["tabata_hiit", "Tabata 30p"],
              ] as const).map(([id, label], index) => {
                const active = selectedActivityId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      selectActivity(id);
                      setActivityCategory("ALL");
                    }}
                    className={`gym-choice-label gym-choice-label--${ACTIVITY_TONES[index]}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-7">
              <div className="flex flex-wrap gap-1.5">
                {[["ALL", "Tất cả"], ["STRENGTH", "Tập tạ / Gym"], ["CARDIO", "Cardio"], ["MARTIAL_ARTS", "Võ thuật"], ["SPORTS", "Thể thao"], ["RECOVERY", "Phục hồi"]].map(([cat, label], index) => {
                  const active = activityCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setActivityCategory(cat)}
                      className={`gym-choice-label gym-choice-label--${ACTIVITY_TONES[index % ACTIVITY_TONES.length]}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                {filteredActivities.map(act => {
                  const active = act.id === selectedActivity.id;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        selectActivity(act.id);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-outline-variant hover:border-primary/40 hover:bg-surface-container-low/40",
                      )}
                    >
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-on-surface">{act.name}</span>
                        <span className="mt-0.5 block text-xs text-on-surface-variant">{act.note}</span>
                        <span className="mt-0.5 block text-xs text-on-surface-variant">{act.benchmark}</span>
                      </div>
                      <span className="shrink-0 rounded-md bg-surface-container px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        MET {act.met}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-5">
              <h3 className="text-balance text-base font-semibold text-on-surface">{selectedActivity.name}</h3>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Cân nặng (kg)" type="number" min={25} max={250} value={weight} onChange={v => setWeight(Number(v) || 0)} />
                <Field label="Thời gian (phút)" type="number" min={5} max={360} value={activityMinutes} onChange={v => setActivityMinutes(Number(v) || 0)} />
                {selectedActivity.distance > 0 && <Field label="Quãng đường (km)" type="number" min={0} value={activityDistance} onChange={v => setActivityDistance(Number(v) || 0)} />}
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs text-on-surface-variant">Năng lượng tiêu hao</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-change-up">{burnedCalories} kcal</p>
                <p className="mt-1 text-xs tabular-nums text-on-surface-variant">
                  ~{Math.round(burnedCalories / Math.max(activityMinutes, 1))} kcal/phút · MET {selectedActivity.met}
                </p>
              </div>
              <p className="text-xs text-on-surface-variant">Calories = (MET × 3.5 × {weight}kg / 200) × {activityMinutes} phút = {burnedCalories} kcal</p>
              <Feedback error={activityError} />

              {canWrite && (
                <button
                  type="button"
                  disabled={activitySaving}
                  onClick={() => void saveActivityLog()}
                  className={cn(primaryCreateButtonClass, "min-h-9 w-full justify-center")}
                >
                  {activitySaving ? "Đang lưu..." : "Ghi nhật ký tiêu hao"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Kho món ăn */}
      {activeTab === "foods" && (
        <div className="flex flex-1 flex-col gap-3">
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {([
              ["ALL", "Tất cả", foodCounts.ALL, "text-on-surface"],
              ["UPLOAD", "Tự thêm", foodCounts.UPLOAD, "text-tertiary"],
              ["PROTEIN", "Đạm", foodCounts.PROTEIN, "text-primary"],
              ["CARB", "Tinh bột", foodCounts.CARB, "text-tertiary"],
              ["VEGGIE", "Rau củ", foodCounts.VEGGIE, "text-change-up"],
              ["FAT", "Chất béo", foodCounts.FAT, "text-error"],
            ] as const).map(([key, label, count, numClass]) => {
              const active = foodCategory === key;
              return (
                <div key={key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setFoodCategory(key); setFoodPage(1); }}
                    className={cn(
                      "flex w-full cursor-pointer flex-col rounded-md border bg-surface-container-lowest px-3.5 py-2.5 text-left shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                      active ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/40",
                    )}
                  >
                    <dt className="truncate text-xs text-on-surface-variant">{label}</dt>
                    <dd className={cn("mt-1 text-xl font-semibold tabular-nums", numClass)}>{count}</dd>
                  </button>
                </div>
              );
            })}
          </dl>

          {showAddFood && canWrite && (
            <form
              onSubmit={handleSaveFood}
              className="space-y-4 rounded-md border border-primary/40 bg-surface-container-lowest p-4 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-on-surface">
                  {editingFood ? "Chỉnh sửa thông tin món ăn" : "Thêm món ăn mới"}
                </h3>
                <button
                  type="button"
                  onClick={resetFoodForm}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                >
                  Đóng
                </button>
              </div>
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="space-y-3 lg:col-span-6">
                  <Field
                    label="Tên món ăn"
                    required
                    value={foodName}
                    onChange={setFoodName}
                    placeholder="VD: Ức gà nướng sốt cam, Bò lúc lắc..."
                  />
                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-on-surface-variant">Nhóm dinh dưỡng chính</span>
                    <div className="flex flex-wrap gap-1.5">
                      {FOOD_CATEGORIES.map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={newFoodCategory === key}
                          onClick={() => setNewFoodCategory(key)}
                          className={cn(
                            "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                            newFoodCategory === key
                              ? "border-primary bg-primary text-on-primary"
                              : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Định lượng khẩu phần"
                      value={servingLabel}
                      onChange={setServingLabel}
                      placeholder="1 đĩa (150g)"
                    />
                    <Field
                      label="Khối lượng (gram)"
                      type="number"
                      min={1}
                      value={servingGrams}
                      onChange={v => setServingGrams(Number(v) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-low/40 p-3 lg:col-span-6">
                  <p className="text-xs font-semibold text-on-surface">
                    Giá trị dinh dưỡng theo khẩu phần ({servingGrams || 0}g)
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <Field
                      label="Calo (kcal)"
                      type="number"
                      min={0}
                      value={foodCalories}
                      onChange={setFoodCalories}
                      placeholder={computedFoodCalories ? String(computedFoodCalories) : "Tự tính"}
                    />
                    <Field
                      label="Protein (g)"
                      type="number"
                      min={0}
                      value={foodProtein}
                      onChange={setFoodProtein}
                      placeholder="VD: 25"
                    />
                    <Field
                      label="Carbs (g)"
                      type="number"
                      min={0}
                      value={foodCarbs}
                      onChange={setFoodCarbs}
                      placeholder="VD: 5"
                    />
                    <Field
                      label="Fat (g)"
                      type="number"
                      min={0}
                      value={foodFat}
                      onChange={setFoodFat}
                      placeholder="VD: 4"
                    />
                  </div>
                  <Field
                    label="Cách chế biến / lưu ý"
                    value={cookingNote}
                    onChange={setCookingNote}
                    placeholder="VD: Áp chảo ít dầu, nướng nồi chiên không dầu 180°C..."
                  />
                  <div className="space-y-1">
                    <span className="block text-xs font-medium text-on-surface-variant">Ảnh món ăn (tùy chọn)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={cn(secondary, "cursor-pointer")}>
                        <ImageIcon className="size-3.5" aria-hidden="true" />
                        {foodImageFile ? "Đổi ảnh món" : "Tải ảnh món ăn"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => setFoodImageFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      {foodImageFile && (
                        <span className="truncate text-xs text-on-surface-variant">{foodImageFile.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Feedback error={foodFormError} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetFoodForm}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button type="submit" disabled={savingFood} className={cn(primaryCreateButtonClass, "min-h-9")}>
                  {savingFood
                    ? "Đang lưu..."
                    : editingFood
                      ? "Lưu thay đổi món ăn"
                      : "Lưu vào kho món ăn"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
            <TableFilterToolbar
              appearance="plain"
              actions={
                canWrite ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={seedingFoods}
                      aria-label="Khôi phục danh sách món mặc định"
                      title="Khôi phục danh sách món mặc định"
                      className={cn(secondary, "size-9 p-0")}
                      onClick={() => void seedDefaultFoods()}
                    >
                      <Database className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={cn(primaryCreateButtonClass, "min-h-9")}
                      onClick={() => {
                        if (showAddFood && !editingFood) {
                          resetFoodForm();
                        } else {
                          resetFoodForm();
                          setShowAddFood(true);
                        }
                      }}
                    >
                      <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                      {showAddFood && !editingFood ? "Đóng form" : "Thêm món ăn"}
                    </button>
                  </div>
                ) : undefined
              }
              search={{
                value: foodSearch,
                onChange: value => { setFoodSearch(value); setFoodPage(1); },
                placeholder: "Tìm tên món ăn...",
                ariaLabel: "Tìm món ăn",
                className: "min-w-0",
              }}
              totalCount={filteredFoods.length}
              countLabel="món ăn"
              hasActiveFilters={Boolean(foodSearch.trim() || foodCategory !== "ALL" || foodSort !== "name")}
              onResetFilters={() => { setFoodSearch(""); setFoodCategory("ALL"); setFoodSort("name"); setFoodPage(1); }}
            >
              <Dropdown
                aria-label="Sắp xếp món ăn"
                variant="filter"
                value={foodSort}
                onChange={v => setFoodSort(v as typeof foodSort)}
                options={[
                  { value: "name", label: "Tên A-Z" },
                  { value: "cal-asc", label: "Calo thấp → cao" },
                  { value: "cal-desc", label: "Calo cao → thấp" },
                  { value: "protein-desc", label: "Đạm cao nhất" },
                ]}
              />
              <Dropdown
                aria-label="Số món mỗi trang"
                variant="filter"
                value={String(foodPageSize)}
                onChange={v => { setFoodPageSize(Number(v)); setFoodPage(1); }}
                options={[
                  { value: "12", label: "12 / trang" },
                  { value: "24", label: "24 / trang" },
                ]}
              />
            </TableFilterToolbar>

            <Feedback error={foodsQuery.error} loading={foodsQuery.loading} />

            {!foodsQuery.loading && !pagedFoods.length ? (
              <GymEmptyState
                kind="task"
                filtered={Boolean(foodSearch.trim() || foodCategory !== "ALL")}
                title="Chưa có món ăn phù hợp."
              />
            ) : (
              <div className="flex-1">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pagedFoods.map(item => (
                  <article key={item._id} className="flex flex-col justify-between gap-2.5 rounded-md border border-outline-variant bg-surface-container-lowest p-3 shadow-2xs transition-colors hover:border-primary/40">
                    <div className="flex gap-3">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} loading="lazy" className="size-16 shrink-0 rounded-md border border-outline-variant/60 object-cover" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <HrStatusBadge
                            tone={item.category === "PROTEIN" ? "info" : item.category === "VEGGIE" ? "success" : item.category === "FAT" ? "danger" : "warning"}
                            className="normal-case"
                          >
                            {item.category === "PROTEIN" ? "Đạm" : item.category === "CARB" ? "Tinh bột" : item.category === "VEGGIE" ? "Rau củ" : item.category === "FAT" ? "Chất béo" : item.category || "Khác"}
                          </HrStatusBadge>
                          {item.calories != null && (
                            <span className="text-xs font-semibold tabular-nums text-tertiary">{item.calories} kcal</span>
                          )}
                        </div>
                        <h4 className="truncate text-sm font-semibold text-on-surface" title={item.name}>{item.name}</h4>
                        {item.servingLabel && (
                          <p className="truncate text-xs text-on-surface-variant">{item.servingLabel}</p>
                        )}
                        {item.cookingNote && (
                          <p className="line-clamp-1 text-xs text-on-surface-variant">{item.cookingNote}</p>
                        )}
                        <div className="flex flex-wrap gap-1 text-[11px] font-medium tabular-nums">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">P {item.protein ?? 0}g</span>
                          <span className="rounded bg-tertiary-container/60 px-1.5 py-0.5 text-on-tertiary-container">C {item.carbs ?? 0}g</span>
                          <span className="rounded bg-error-container/50 px-1.5 py-0.5 text-error">F {item.fat ?? 0}g</span>
                        </div>
                      </div>
                    </div>

                    {canWrite && (
                      <div className="flex items-center justify-end gap-1.5 border-t border-outline-variant/60 pt-2">
                        <button
                          type="button"
                          onClick={() => startEditFood(item)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                        >
                          <Pencil className="size-3" aria-hidden="true" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setDeleting({ entity: "food-images", record: item });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-error/30 bg-error-container/20 px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/40"
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                          Xóa
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                </div>
              </div>
            )}

            {filteredFoods.length > foodPageSize && (
              <TablePagination
                appearance="erp"
                currentPage={foodPage}
                totalPages={foodTotalPages}
                pageSize={foodPageSize}
                totalItems={filteredFoods.length}
                pageSizeOptions={[12, 24]}
                onPageChange={setFoodPage}
                onPageSizeChange={size => { setFoodPageSize(size); setFoodPage(1); }}
                itemLabel="món ăn"
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Nhật ký calo */}
      {activeTab === "logs" && (
        <div className="flex flex-1 flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Calo nạp", value: `${logTotals.consumed.toLocaleString("vi-VN")} kcal`, color: "text-on-surface" },
              { label: "Calo tiêu hao", value: `${logTotals.burned.toLocaleString("vi-VN")} kcal`, color: "text-tertiary" },
              { label: "Calo ròng", value: `${(logTotals.consumed - logTotals.burned).toLocaleString("vi-VN")} kcal`, color: "text-on-surface" },
              { label: "TDEE tham chiếu", value: `${tdee.toLocaleString("vi-VN")} kcal`, color: "text-change-up" },
              { label: "Tổng đạm", value: `${logTotals.protein} g`, color: "text-primary" },
            ].map(item => (
              <div key={item.label} className="rounded-md border border-outline-variant bg-surface-container-lowest p-3.5 text-center shadow-2xs">
                <dt className="text-xs text-on-surface-variant">{item.label}</dt>
                <dd className={cn("mt-1 text-xl font-semibold tabular-nums", item.color)}>{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
            <Feedback error={logsQuery.error || error} loading={logsQuery.loading} />
            {!logsQuery.loading && !logsQuery.error && (
              <div className="flex-1 overflow-x-auto rounded-md border border-outline-variant">
                <table className="min-w-[740px] w-full border-collapse text-left text-sm tabular-nums">
                  <ErpTableHead
                    appearance="healthcare"
                    columns={[
                      "Ngày",
                      ...(!fixedCustomerId ? ["Học viên"] : []),
                      "Món / Hoạt động",
                      "Calories",
                      "Macros (P / C / F)",
                      "Thao tác",
                    ]}
                  />
                  <tbody className="divide-y divide-outline-variant [&>tr]:transition-colors [&>tr:hover]:bg-surface-container-low/40">
                    {(logsQuery.data?.data || []).map(row => (
                      <tr key={row._id}>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs">{dateLabel(row.date)}</td>
                        {!fixedCustomerId && (
                          <td className="px-3 py-2.5 align-middle text-xs font-medium text-on-surface">
                            {customerMap.get(row.customerId)?.fullName || "—"}
                          </td>
                        )}
                        <td className="px-3 py-2.5 align-middle">
                          <span className="block font-medium text-on-surface">{row.mealType}</span>
                          {row.type === "ACTIVITY" && <span className="text-[11px] font-medium text-primary">Vận động · {row.durationMinutes || 0} phút</span>}
                          {row.foods && <span className="line-clamp-1 text-xs text-on-surface-variant">{row.foods}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle font-semibold text-primary">
                          {row.calories} kcal
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-on-surface-variant">
                          {row.protein ?? 0}g / {row.carbs ?? 0}g / {row.fat ?? 0}g
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                          {canWrite && (
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" aria-label="Sửa nhật ký" title="Sửa" className={iconActionClass} onClick={() => setEditor({ entity: "nutrition-logs", record: row })}>
                                <Pencil className="size-4" aria-hidden="true" />
                              </button>
                              <button type="button" aria-label="Xóa nhật ký" title="Xóa" className={dangerIconActionClass} onClick={() => { setError(""); setDeleting({ entity: "nutrition-logs", record: row }); }}>
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!(logsQuery.data?.data || []).length && (
                      <tr>
                        <td colSpan={fixedCustomerId ? 5 : 6} className="p-4">
                          <GymEmptyState
                            kind="calendar"
                            filtered={Boolean(customerId)}
                            title="Chưa có nhật ký dinh dưỡng."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {logsQuery.data && (
              <TablePagination
                appearance="erp"
                currentPage={logPage}
                totalPages={logsQuery.data.meta.totalPages}
                pageSize={15}
                totalItems={logsQuery.data.meta.total}
                pageSizeOptions={[15]}
                onPageChange={setLogPage}
                onPageSizeChange={() => {}}
              />
            )}
          </div>
        </div>
      )}

      {editor?.entity === "nutrition-logs" && (
        <RecordEditor
          api={api}
          entity={editor.entity}
          record={editor.record}
          customerId={editor.customerId || customerId || undefined}
          initialValues={
            editor.prefill
              ? {
                  ...(editor.prefill.title ? { title: editor.prefill.title } : {}),
                  ...(editor.prefill.bmr != null ? { bmr: editor.prefill.bmr } : {}),
                  ...(editor.prefill.tdee != null ? { tdee: editor.prefill.tdee } : {}),
                  ...(editor.prefill.targetCalories != null ? { targetCalories: editor.prefill.targetCalories } : {}),
                  ...(editor.prefill.startDate ? { startDate: editor.prefill.startDate } : {}),
                  ...(editor.prefill.endDate ? { endDate: editor.prefill.endDate } : {}),
                  ...(editor.prefill.notes ? { notes: editor.prefill.notes } : {}),
                }
              : undefined
          }
          initialMacros={editor.prefill?.macros}
          initialMenu={editor.prefill?.menu}
          onClose={() => setEditor(undefined)}
          onSaved={() => { setEditor(undefined); refresh(); }}
        />
      )}

      {detail && (
        <ErpModal native title={detail.title || "Chi tiết thực đơn"} onClose={() => setDetail(undefined)} maxWidth="max-w-3xl">
          <div className="space-y-3">
            <dl className="grid grid-cols-3 gap-2.5 text-center tabular-nums">
              <div className="rounded-lg border border-outline-variant p-2.5"><dt className="text-xs text-on-surface-variant">BMR</dt><dd className="font-semibold">{detail.bmr || "—"} kcal</dd></div>
              <div className="rounded-lg border border-outline-variant p-2.5"><dt className="text-xs text-on-surface-variant">TDEE</dt><dd className="font-semibold">{detail.tdee || "—"} kcal</dd></div>
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5"><dt className="text-xs text-primary">Mục tiêu</dt><dd className="font-semibold text-primary">{detail.targetCalories} kcal</dd></div>
            </dl>
            {Array.isArray(detail.menu) && detail.menu.flatMap((entry: any) => Array.isArray(entry.days) ? entry.days.flatMap((day: any) => (day.meals || []).map((meal: any) => ({ ...meal, dayNumber: day.dayNumber, date: day.date }))) : [entry]).map((meal: any, idx: number) => (
              <div key={idx} className="flex gap-3 rounded-lg border border-outline-variant p-3">
                {meal.imageUrl && <img src={meal.imageUrl} alt={meal.name} className="size-16 shrink-0 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-on-surface">{meal.name}{meal.time ? ` · ${meal.time}` : ""}</p>
                  {meal.dayNumber && <p className="text-xs text-on-surface-variant">Ngày {meal.dayNumber}{meal.date ? ` · ${String(meal.date).slice(0, 10)}` : ""}</p>}
                  <p className="mt-0.5 text-xs text-on-surface-variant">{Array.isArray(meal.items) ? meal.items.map((item: any) => `${item.name}${item.amount ? ` (${item.amount})` : ""}`).join(", ") : meal.foods}</p>
                  <p className="mt-1 text-xs font-medium tabular-nums text-primary">{meal.calories || (meal.items || []).reduce((sum: number, item: any) => sum + Number(item.calories || 0), 0)} kcal · P {meal.protein || (meal.items || []).reduce((sum: number, item: any) => sum + Number(item.protein || 0), 0)}g · C {meal.carbs || (meal.items || []).reduce((sum: number, item: any) => sum + Number(item.carbs || 0), 0)}g · F {meal.fat || (meal.items || []).reduce((sum: number, item: any) => sum + Number(item.fat || 0), 0)}g</p>
                </div>
              </div>
            ))}
          </div>
        </ErpModal>
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xóa bản ghi?"
        description="Dữ liệu đã xóa không thể khôi phục."
        confirmLabel="Xóa vĩnh viễn"
        isSubmitting={busy}
        error={error}
        onClose={() => { if (!busy) setDeleting(undefined); }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api.remove(deleting.entity, deleting.record);
            setDeleting(undefined);
            refresh();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
