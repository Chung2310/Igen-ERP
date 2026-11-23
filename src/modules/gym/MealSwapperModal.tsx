import { useMemo, useState, type FormEvent } from "react";
import { ArrowRightLeft, Check, Layers, Plus, Search, Trash2 } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import type { GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { Feedback, Field, messageOf, primary, secondary } from "./ui";

export interface SwapperDishContext {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTip?: string;
  imageUrl?: string;
}

export interface SwapFoodOption {
  id: string;
  record?: GymRecord;
  name: string;
  category: "PROTEIN" | "CARB" | "VEGGIE" | "FAT" | "READY";
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultGrams: number;
  servingLabel: string;
  prepTip?: string;
  imageUrl?: string;
}

const BUILTIN_SWAP_FOODS: SwapFoodOption[] = [
  // PROTEIN
  { id: "uc_ga_tieu", name: "Ức gà áp chảo sốt tiêu đen", category: "PROTEIN", caloriesPer100g: 144, proteinPer100g: 25, carbsPer100g: 1, fatPer100g: 2.8, defaultGrams: 180, servingLabel: "180g (1 phần)", prepTip: "Ướp tiêu, tỏi, áp chảo chín tới không khô" },
  { id: "bo_toi_tay", name: "Thịt thăn bò áp chảo tỏi tây", category: "PROTEIN", caloriesPer100g: 187, proteinPer100g: 25.3, carbsPer100g: 0.7, fatPer100g: 8, defaultGrams: 150, servingLabel: "150g (1 phần)", prepTip: "Áp chảo lửa lớn 3-4 phút" },
  { id: "ca_hoi", name: "Cá hồi áp chảo măng tây", category: "PROTEIN", caloriesPer100g: 206, proteinPer100g: 22, carbsPer100g: 2, fatPer100g: 12, defaultGrams: 150, servingLabel: "150g cá + măng tây", prepTip: "Áp chảo mặt da giòn rụm, giàu Omega-3" },
  { id: "tom_hap", name: "Tôm hấp sả nước dừa tươi", category: "PROTEIN", caloriesPer100g: 99, proteinPer100g: 21, carbsPer100g: 1, fatPer100g: 0.8, defaultGrams: 200, servingLabel: "200g (1 đĩa)", prepTip: "Hấp 5 phút tôm vừa chín tới" },
  { id: "heo_than_nam", name: "Thịt heo thăn xào nấm rơm", category: "PROTEIN", caloriesPer100g: 156, proteinPer100g: 22.5, carbsPer100g: 3.1, fatPer100g: 5.6, defaultGrams: 160, servingLabel: "160g nạc thăn + nấm", prepTip: "Xào nhanh lửa lớn với hành khô" },
  { id: "trung_luoc", name: "Trứng gà luộc lòng đào", category: "PROTEIN", caloriesPer100g: 145, proteinPer100g: 13, carbsPer100g: 1, fatPer100g: 10, defaultGrams: 100, servingLabel: "2 quả (100g)", prepTip: "Luộc sôi 6 phút ngâm nước đá" },
  { id: "dau_hu_ca_chua", name: "Đậu hũ trắng sốt cà chua ít dầu", category: "PROTEIN", caloriesPer100g: 76, proteinPer100g: 8, carbsPer100g: 2, fatPer100g: 4.5, defaultGrams: 200, servingLabel: "1 đĩa (200g)", prepTip: "Thanh đạm, dễ tiêu" },
  { id: "ca_ro_phi", name: "Cá rô phi phi lê áp chảo", category: "PROTEIN", caloriesPer100g: 105, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 2.2, defaultGrams: 180, servingLabel: "180g phi lê", prepTip: "Áp chảo rắc muối hồng & thì là" },
  { id: "muc_hap", name: "Mực ống hấp gừng sả", category: "PROTEIN", caloriesPer100g: 92, proteinPer100g: 18, carbsPer100g: 2.2, fatPer100g: 1.1, defaultGrams: 180, servingLabel: "180g (1 đĩa)", prepTip: "Hấp giòn ngọt chấm muối tiêu chanh" },
  { id: "whey_iso", name: "Whey Protein Isolate", category: "PROTEIN", caloriesPer100g: 400, proteinPer100g: 90, carbsPer100g: 3.3, fatPer100g: 1.6, defaultGrams: 30, servingLabel: "1 muỗng (30g)", prepTip: "Pha với 250ml nước lạnh" },
  // CARB
  { id: "com_trang", name: "Cơm trắng nấu chín", category: "CARB", caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, defaultGrams: 150, servingLabel: "1 chén vừa (150g)", prepTip: "Dễ tiêu hóa, thích hợp trước/sau tập" },
  { id: "com_gao_lut", name: "Cơm gạo lứt huyết rồng", category: "CARB", caloriesPer100g: 112, proteinPer100g: 2.6, carbsPer100g: 23.5, fatPer100g: 0.9, defaultGrams: 150, servingLabel: "1 chén (150g)", prepTip: "Ngâm gạo 2 giờ trước khi nấu để mềm dẻo" },
  { id: "khoai_lang", name: "Khoai lang mật luộc/nướng", category: "CARB", caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20, fatPer100g: 0.1, defaultGrams: 150, servingLabel: "1 củ vừa (150g)", prepTip: "Nướng nồi chiên không dầu 180°C trong 25 phút" },
  { id: "yen_mach", name: "Yến mạch cán dẹt nấu chín", category: "CARB", caloriesPer100g: 380, proteinPer100g: 13, carbsPer100g: 67, fatPer100g: 6.5, defaultGrams: 50, servingLabel: "50g yến mạch khô", prepTip: "Ngâm sữa tươi không đường qua đêm hoặc nấu cháo" },
  { id: "banh_mi_den", name: "Bánh mì đen nguyên cám", category: "CARB", caloriesPer100g: 250, proteinPer100g: 9, carbsPer100g: 48, fatPer100g: 3.3, defaultGrams: 70, servingLabel: "2 lát (70g)", prepTip: "Nướng giòn nhẹ, giàu chất xơ" },
  { id: "bun_gao_lut", name: "Bún gạo lứt luộc", category: "CARB", caloriesPer100g: 110, proteinPer100g: 2.5, carbsPer100g: 24, fatPer100g: 0.5, defaultGrams: 150, servingLabel: "1 phần (150g)", prepTip: "Trụng nước sôi rồi xả nước lạnh cho tơi" },
  { id: "chuoi_tieu", name: "Chuối tiêu chín", category: "CARB", caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, defaultGrams: 120, servingLabel: "1 quả lớn (120g)", prepTip: "Ăn trước tập 30-45 phút bổ sung năng lượng nhanh" },
  // VEGGIE
  { id: "bong_cai_xanh", name: "Bông cải xanh luộc/hấp", category: "VEGGIE", caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7, fatPer100g: 0.4, defaultGrams: 150, servingLabel: "1 đĩa (150g)", prepTip: "Hấp cách thủy 4 phút giữ độ giòn & vitamin C" },
  { id: "rau_muong_luoc", name: "Rau muống luộc chanh", category: "VEGGIE", caloriesPer100g: 22, proteinPer100g: 2.6, carbsPer100g: 3.1, fatPer100g: 0.2, defaultGrams: 150, servingLabel: "1 đĩa (150g)", prepTip: "Luộc nước sôi già giữ màu xanh tươi" },
  { id: "canh_chua_ca", name: "Canh chua cá lóc miền Tây", category: "VEGGIE", caloriesPer100g: 54, proteinPer100g: 7.2, carbsPer100g: 3.2, fatPer100g: 1.2, defaultGrams: 250, servingLabel: "1 tô lớn (250g)", prepTip: "Nấu cùng dứa, cà chua, đậu bắp thanh nhiệt" },
  { id: "salad_dua_leo", name: "Salad dưa leo cà chua bi", category: "VEGGIE", caloriesPer100g: 24, proteinPer100g: 1, carbsPer100g: 4.5, fatPer100g: 0.2, defaultGrams: 150, servingLabel: "1 đĩa (150g)", prepTip: "Trộn dầu giấm táo ít đường" },
  // FAT
  { id: "bo_sap", name: "Bơ sáp tươi", category: "FAT", caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7, defaultGrams: 80, servingLabel: "1/2 quả (80g)", prepTip: "Chất béo tốt hỗ trợ nội tiết" },
  { id: "hanh_nhan", name: "Hạnh nhân rang mộc không muối", category: "FAT", caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, defaultGrams: 20, servingLabel: "1 nắm nhỏ (20g)", prepTip: "Bữa phụ giàu Vitamin E" },
  // READY
  { id: "bo_thien_ly", name: "Thịt bò xào bông thiên lý", category: "READY", caloriesPer100g: 146, proteinPer100g: 18.6, carbsPer100g: 4, fatPer100g: 6, defaultGrams: 150, servingLabel: "1 đĩa (150g)", prepTip: "Xào lửa lớn giữ độ giòn ngọt" },
  { id: "ca_bong_kho", name: "Cá bống kho tiêu gừng", category: "READY", caloriesPer100g: 130, proteinPer100g: 20, carbsPer100g: 2.6, fatPer100g: 4, defaultGrams: 150, servingLabel: "1 đĩa (150g)", prepTip: "Kho keo ít đường, thêm tiêu đen" },
  { id: "uc_ga_mu_tat", name: "Ức gà nướng sốt mù tạt mật ong", category: "READY", caloriesPer100g: 152, proteinPer100g: 24.4, carbsPer100g: 3.3, fatPer100g: 3.8, defaultGrams: 180, servingLabel: "1 phần (180g)", prepTip: "Nồi chiên không dầu 180°C trong 15 phút" },
  { id: "trung_cuon_rau", name: "Trứng cuộn rau củ ngũ sắc", category: "READY", caloriesPer100g: 120, proteinPer100g: 10, carbsPer100g: 2.6, fatPer100g: 7.3, defaultGrams: 150, servingLabel: "1 đĩa (150g)", prepTip: "Trộn cà rốt băm, hành tây cuộn ít dầu" },
];

const CATEGORIES = [
  ["ALL", "Tất cả"],
  ["PROTEIN", "Đạm (Protein)"],
  ["CARB", "Tinh bột (Carb)"],
  ["VEGGIE", "Rau củ"],
  ["FAT", "Chất béo tốt"],
  ["READY", "Món Việt có sẵn"],
] as const;

export default function MealSwapperModal({
  api,
  currentDish,
  libraryFoods = [],
  onClose,
  onApplySwap,
  onLibraryUpdated,
}: {
  api?: GymApi;
  currentDish?: SwapperDishContext;
  libraryFoods?: GymRecord[];
  onClose: () => void;
  onApplySwap?: (next: SwapperDishContext) => void;
  onLibraryUpdated?: () => void;
}) {
  const [modalTab, setModalTab] = useState<"swap" | "manage">("swap");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string>("");
  const [grams, setGrams] = useState<number>(150);

  // Quick add food form in Tab 2 ("Quản Lý Kho Món")
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("PROTEIN");
  const [newGrams, setNewGrams] = useState(150);
  const [newCalories, setNewCalories] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFat, setNewFat] = useState("");
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const allOptions = useMemo<SwapFoodOption[]>(() => {
    const fromLibrary: SwapFoodOption[] = libraryFoods.map((f) => {
      const cat = ["PROTEIN", "CARB", "VEGGIE", "FAT"].includes(String(f.category || "").toUpperCase())
        ? (String(f.category).toUpperCase() as SwapFoodOption["category"])
        : "READY";
      const servingGrams = Math.max(10, Number(f.servingGrams || 100));
      const scale = 100 / servingGrams;
      return {
        id: `lib_${f._id}`,
        record: f,
        name: String(f.name || "Món ăn"),
        category: cat,
        caloriesPer100g: Math.round(Number(f.calories || 150) * scale),
        proteinPer100g: Math.round(Number(f.protein || 10) * scale * 10) / 10,
        carbsPer100g: Math.round(Number(f.carbs || 15) * scale * 10) / 10,
        fatPer100g: Math.round(Number(f.fat || 5) * scale * 10) / 10,
        defaultGrams: servingGrams,
        servingLabel: String(f.servingLabel || `1 phần (${servingGrams}g)`),
        prepTip: f.cookingNote ? String(f.cookingNote) : undefined,
        imageUrl: f.imageUrl ? String(f.imageUrl) : undefined,
      };
    });
    const libNames = new Set(fromLibrary.map((item) => item.name.toLocaleLowerCase("vi")));
    return [
      ...fromLibrary,
      ...BUILTIN_SWAP_FOODS.filter((item) => !libNames.has(item.name.toLocaleLowerCase("vi"))),
    ];
  }, [libraryFoods]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    const targetKcal = Math.max(50, Number(currentDish?.calories || 250));
    return allOptions
      .filter((item) => {
        if (category !== "ALL" && item.category !== category) return false;
        if (q && !item.name.toLocaleLowerCase("vi").includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const aKcal = (a.caloriesPer100g * a.defaultGrams) / 100;
        const bKcal = (b.caloriesPer100g * b.defaultGrams) / 100;
        return Math.abs(aKcal - targetKcal) - Math.abs(bKcal - targetKcal);
      });
  }, [allOptions, search, category, currentDish?.calories]);

  const selected = useMemo(
    () => allOptions.find((item) => item.id === selectedId) || filtered[0] || null,
    [allOptions, selectedId, filtered],
  );

  const pickOption = (opt: SwapFoodOption) => {
    setSelectedId(opt.id);
    const targetKcal = Number(currentDish?.calories || 0);
    if (targetKcal > 20 && opt.caloriesPer100g > 0) {
      const scaled = Math.max(20, Math.min(600, Math.round(((targetKcal / opt.caloriesPer100g) * 100) / 10) * 10));
      setGrams(scaled);
    } else {
      setGrams(opt.defaultGrams);
    }
  };

  const calc = useMemo(() => {
    if (!selected) return null;
    const ratio = Math.max(10, grams) / 100;
    return {
      calories: Math.round(selected.caloriesPer100g * ratio),
      protein: Math.round(selected.proteinPer100g * ratio * 10) / 10,
      carbs: Math.round(selected.carbsPer100g * ratio * 10) / 10,
      fat: Math.round(selected.fatPer100g * ratio * 10) / 10,
    };
  }, [selected, grams]);

  const handleAddCustomFood = async (e: FormEvent) => {
    e.preventDefault();
    if (!api || busy) return;
    if (!newName.trim()) {
      setError("Vui lòng nhập tên món ăn.");
      return;
    }
    setBusy(true);
    setError("");
    const p = Number(newProtein) || 0;
    const c = Number(newCarbs) || 0;
    const f = Number(newFat) || 0;
    const cal = newCalories.trim() ? Number(newCalories) || 0 : Math.round(p * 4 + c * 4 + f * 9);
    try {
      await api.save("food-images", {
        name: newName.trim(),
        category: newCategory,
        servingLabel: `1 phần (${newGrams || 150}g)`,
        servingGrams: Number(newGrams) || 150,
        calories: cal,
        protein: p,
        carbs: c,
        fat: f,
        cookingNote: newNote.trim(),
        source: "UPLOAD",
        keywords: [],
      });
      setNewName("");
      setNewCalories("");
      setNewProtein("");
      setNewCarbs("");
      setNewFat("");
      setNewNote("");
      setShowAddForm(false);
      onLibraryUpdated?.();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLibraryFood = async (rec: GymRecord) => {
    if (!api || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.remove("food-images", rec);
      onLibraryUpdated?.();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpModal
      native
      title={currentDish ? "Hoán đổi món ăn tương đương Macro" : "Đổi Món & Quản Lý Kho Món"}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-3">
        {/* 2 Tabs matching 3S MealSwapperModal */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-2">
          <div className="flex gap-1.5" role="tablist" aria-label="Chế độ đổi món">
            <button
              type="button"
              role="tab"
              aria-selected={modalTab === "swap"}
              onClick={() => setModalTab("swap")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                modalTab === "swap"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface",
              )}
            >
              <ArrowRightLeft className="size-3.5" aria-hidden="true" />
              Hoán Đổi &amp; Gợi Ý
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modalTab === "manage"}
              onClick={() => setModalTab("manage")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                modalTab === "manage"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Layers className="size-3.5" aria-hidden="true" />
              Quản Lý Kho Món ({libraryFoods.length})
            </button>
          </div>
          {api && (
            <button
              type="button"
              className={secondary}
              onClick={() => {
                setModalTab("manage");
                setShowAddForm(true);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Thêm Món Mới
            </button>
          )}
        </div>

        <Feedback error={error} />

        {modalTab === "swap" ? (
          <>
            {currentDish && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low/60 px-3.5 py-2.5 text-xs">
                <div>
                  <span className="text-on-surface-variant">Đang thay thế món: </span>
                  <strong className="text-sm text-on-surface">{currentDish.name || "Món hiện tại"}</strong>
                  {currentDish.amount && <span className="ml-1.5 text-on-surface-variant">({currentDish.amount})</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 font-semibold tabular-nums">
                  <span className="rounded bg-error-container/50 px-2 py-0.5 text-error">{currentDish.calories} kcal</span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">P {currentDish.protein}g</span>
                  <span className="rounded bg-tertiary-container/60 px-2 py-0.5 text-on-tertiary-container">C {currentDish.carbs}g</span>
                  <span className="rounded bg-surface-container px-2 py-0.5 text-on-surface">F {currentDish.fat}g</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60" aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Tìm món thay thế"
                  placeholder="Tìm món ăn (VD: ức gà, cá hồi, khoai lang, đậu hũ...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-8 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={category === key}
                    onClick={() => setCategory(key)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      category === key
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border border-outline-variant p-2">
                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-xs text-on-surface-variant">
                    Không tìm thấy món phù hợp.
                  </p>
                ) : (
                  filtered.map((opt) => {
                    const isSelected = selected?.id === opt.id;
                    const defaultKcal = Math.round((opt.caloriesPer100g * opt.defaultGrams) / 100);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => pickOption(opt)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-md border p-2 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/8"
                            : "border-outline-variant/60 bg-surface-container-lowest hover:border-primary/40",
                        )}
                      >
                        {opt.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt={opt.name}
                            className="size-10 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-on-surface">{opt.name}</p>
                          <p className="text-[11px] tabular-nums text-on-surface-variant">
                            {opt.servingLabel} · ~{defaultKcal} kcal · P {Math.round((opt.proteinPer100g * opt.defaultGrams) / 100)}g
                          </p>
                        </div>
                        {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex flex-col justify-between space-y-3 rounded-md border border-outline-variant bg-surface-container-low/40 p-3">
                {selected && calc ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-primary">Món đã chọn</p>
                      <h4 className="mt-0.5 text-sm font-semibold text-on-surface">{selected.name}</h4>
                      {selected.prepTip && (
                        <p className="mt-1 text-xs italic text-on-surface-variant">{selected.prepTip}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-on-surface">
                        Điều chỉnh định lượng (gram)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={10}
                          max={1000}
                          step={10}
                          value={grams}
                          onChange={(e) => setGrams(Math.max(10, Number(e.target.value) || 10))}
                          className="w-24 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm font-semibold tabular-nums text-on-surface focus:border-primary focus:outline-none"
                        />
                        <span className="text-xs text-on-surface-variant">g</span>
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-1.5 text-xs tabular-nums">
                      <div className="rounded border border-outline-variant bg-surface-container-lowest p-2">
                        <dt className="text-[11px] text-on-surface-variant">Calories</dt>
                        <dd className="font-bold text-error">{calc.calories} kcal</dd>
                      </div>
                      <div className="rounded border border-outline-variant bg-surface-container-lowest p-2">
                        <dt className="text-[11px] text-on-surface-variant">Protein</dt>
                        <dd className="font-bold text-primary">{calc.protein} g</dd>
                      </div>
                      <div className="rounded border border-outline-variant bg-surface-container-lowest p-2">
                        <dt className="text-[11px] text-on-surface-variant">Carbs</dt>
                        <dd className="font-bold text-on-surface">{calc.carbs} g</dd>
                      </div>
                      <div className="rounded border border-outline-variant bg-surface-container-lowest p-2">
                        <dt className="text-[11px] text-on-surface-variant">Fat</dt>
                        <dd className="font-bold text-on-surface">{calc.fat} g</dd>
                      </div>
                    </dl>

                    {currentDish && (
                      <p className="text-[11px] tabular-nums text-on-surface-variant">
                        Chênh lệch calo:{" "}
                        <strong className="text-on-surface">
                          {calc.calories - currentDish.calories >= 0
                            ? `+${calc.calories - currentDish.calories}`
                            : calc.calories - currentDish.calories}{" "}
                          kcal
                        </strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">Chọn một món bên trái để tính định lượng.</p>
                )}

                <div className="flex justify-end gap-2 border-t border-outline-variant pt-2.5">
                  <button type="button" className={secondary} onClick={onClose}>
                    Đóng
                  </button>
                  {onApplySwap && (
                    <button
                      type="button"
                      disabled={!selected || !calc}
                      className={cn(primary, "min-h-9")}
                      onClick={() => {
                        if (!selected || !calc) return;
                        onApplySwap({
                          name: selected.name,
                          amount: `${grams}g`,
                          calories: calc.calories,
                          protein: calc.protein,
                          carbs: calc.carbs,
                          fat: calc.fat,
                          prepTip: selected.prepTip || "",
                          imageUrl: selected.imageUrl,
                        });
                      }}
                    >
                      <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                      {currentDish ? "Áp dụng đổi món" : "Thêm vào bữa đầu"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {showAddForm && api && (
              <form
                onSubmit={handleAddCustomFood}
                className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-primary">Thêm món ăn mới vào Kho</h4>
                  <button
                    type="button"
                    className="cursor-pointer text-xs text-on-surface-variant hover:text-on-surface"
                    onClick={() => setShowAddForm(false)}
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Field label="Tên món ăn" required value={newName} onChange={setNewName} placeholder="VD: Bò xào hành tây" />
                  <Field
                    label="Nhóm chất"
                    value={newCategory}
                    options={[
                      ["PROTEIN", "Đạm (Protein)"],
                      ["CARB", "Tinh bột (Carbs)"],
                      ["VEGGIE", "Rau củ"],
                      ["FAT", "Chất béo tốt"],
                    ]}
                    onChange={setNewCategory}
                  />
                  <Field label="Khối lượng (g)" type="number" min={10} value={newGrams} onChange={(v) => setNewGrams(Number(v) || 100)} />
                  <Field label="Calories (tự tính nếu trống)" type="number" min={0} value={newCalories} onChange={setNewCalories} />
                  <Field label="Protein (g)" type="number" min={0} value={newProtein} onChange={setNewProtein} />
                  <Field label="Carbs (g)" type="number" min={0} value={newCarbs} onChange={setNewCarbs} />
                  <Field label="Fat (g)" type="number" min={0} value={newFat} onChange={setNewFat} />
                  <div className="sm:col-span-2">
                    <Field label="Ghi chú chế biến" value={newNote} onChange={setNewNote} placeholder="VD: Ít dầu, hấp hoặc áp chảo" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className={secondary} onClick={() => setShowAddForm(false)}>
                    Hủy
                  </button>
                  <button type="submit" disabled={busy} className={primary}>
                    {busy ? "Đang lưu..." : "Lưu món ăn"}
                  </button>
                </div>
              </form>
            )}

            <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border border-outline-variant p-2">
              {libraryFoods.length === 0 ? (
                <p className="py-8 text-center text-xs text-on-surface-variant">
                  Chưa có món ăn lưu trong kho chi nhánh. Bấm “+ Thêm Món Mới” để tạo.
                </p>
              ) : (
                libraryFoods.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-2 rounded-md border border-outline-variant/60 bg-surface-container-lowest p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-on-surface">{item.name}</p>
                      <p className="tabular-nums text-[11px] text-on-surface-variant">
                        {item.servingLabel || "1 phần"} · {item.calories || 0} kcal · P {item.protein || 0}g · C {item.carbs || 0}g · F {item.fat || 0}g
                      </p>
                    </div>
                    {api && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Xóa món ${item.name}`}
                        onClick={() => void handleDeleteLibraryFood(item)}
                        className="cursor-pointer rounded p-1.5 text-error hover:bg-error-container/30"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </ErpModal>
  );
}
