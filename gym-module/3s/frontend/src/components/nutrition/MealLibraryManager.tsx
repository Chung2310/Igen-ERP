import { useState, useEffect, useMemo, useId } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Utensils,
  Flame,
  Filter,
  Layers,
  Info,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getCustomFoods,
  saveCustomFoods,
  getAllCombinedFoods,
  deleteCustomFood,
  resetCustomFoods,
  DEFAULT_AVAILABLE_FOODS,
  type CustomFoodItem,
  type FoodItem,
  type FoodCategory,
} from '../../services/foodDatabase';

interface MealLibraryManagerProps {
  onSelectForPlan?: (food: FoodItem) => void;
}

export default function MealLibraryManager({ onSelectForPlan }: MealLibraryManagerProps) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [customFoods, setCustomFoods] = useState<CustomFoodItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'calories_desc' | 'calories_asc' | 'protein_desc'>('name');

  // Pagination State (Phân trang kho món ăn)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);

  // Form State (for both Add and Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [foodName, setFoodName] = useState('');
  const [foodCategory, setFoodCategory] = useState<FoodCategory>('protein');
  const [foodServing, setFoodServing] = useState('1 đĩa (150g)');
  const [foodGrams, setFoodGrams] = useState('150');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [foodPrepTip, setFoodPrepTip] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deletingFood, setDeletingFood] = useState<FoodItem | null>(null);

  // Sync with localStorage
  const refreshFromStorage = () => {
    const custom = getCustomFoods();
    setCustomFoods(custom);
    setFoods(getAllCombinedFoods());
  };

  useEffect(() => {
    refreshFromStorage();
    const handleDbUpdated = () => refreshFromStorage();
    window.addEventListener('3s-food-db-updated', handleDbUpdated);
    return () => window.removeEventListener('3s-food-db-updated', handleDbUpdated);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Reset form inputs
  const resetForm = () => {
    setFoodName('');
    setFoodCategory('protein');
    setFoodServing('1 đĩa (150g)');
    setFoodGrams('150');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    setFoodPrepTip('');
    setEditingFoodId(null);
    setShowForm(false);
  };

  // Open Edit form with existing data
  const handleStartEdit = (food: FoodItem) => {
    setEditingFoodId(food.id);
    setFoodName(food.name);
    setFoodCategory(food.category);
    setFoodServing(food.servingLabel || `${food.defaultServingGrams}g`);
    setFoodGrams(String(food.defaultServingGrams));
    const factor = food.defaultServingGrams / 100;
    setFoodCalories(String(Math.round(food.caloriesPer100g * factor)));
    setFoodProtein(String(parseFloat((food.proteinPer100g * factor).toFixed(1))));
    setFoodCarbs(String(parseFloat((food.carbsPer100g * factor).toFixed(1))));
    setFoodFat(String(parseFloat((food.fatPer100g * factor).toFixed(1))));
    setFoodPrepTip(food.prepTip || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save (Create or Update)
  const handleSaveFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) return;

    const grams = parseFloat(foodGrams) || 150;
    const p = parseFloat(foodProtein) || 0;
    const c = parseFloat(foodCarbs) || 0;
    const f = parseFloat(foodFat) || 0;
    const kcal = parseFloat(foodCalories) || Math.round(p * 4 + c * 4 + f * 9);

    const factor = grams > 0 ? 100 / grams : 1;
    const p100 = parseFloat((p * factor).toFixed(1));
    const c100 = parseFloat((c * factor).toFixed(1));
    const f100 = parseFloat((f * factor).toFixed(1));
    const kcal100 = Math.round(kcal * factor);

    if (editingFoodId) {
      const existsInCustom = customFoods.some((f) => f.id === editingFoodId);
      let nextList: CustomFoodItem[];
      if (existsInCustom) {
        nextList = customFoods.map((item) =>
          item.id === editingFoodId
            ? {
              ...item,
              name: foodName.trim(),
              category: foodCategory,
              caloriesPer100g: kcal100,
              proteinPer100g: p100,
              carbsPer100g: c100,
              fatPer100g: f100,
              defaultServingGrams: grams,
              servingLabel: foodServing.trim() || `${grams}g`,
              prepTip: foodPrepTip.trim() || undefined,
            }
            : item
        );
      } else {
        const overrideItem: CustomFoodItem = {
          id: `custom_override_${editingFoodId}_${Date.now()}`,
          name: foodName.trim(),
          category: foodCategory,
          categoryLabel: 'Món tự thêm',
          caloriesPer100g: kcal100,
          proteinPer100g: p100,
          carbsPer100g: c100,
          fatPer100g: f100,
          unit: 'phần',
          defaultServingGrams: grams,
          servingLabel: foodServing.trim() || `${grams}g`,
          prepTip: foodPrepTip.trim() || undefined,
          isCustom: true,
        };
        nextList = [overrideItem, ...customFoods];
      }
      saveCustomFoods(nextList);
      showToast(`Đã cập nhật món "${foodName.trim()}" thành công!`);
    } else {
      const newFood: CustomFoodItem = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: foodName.trim(),
        category: foodCategory,
        categoryLabel: 'Món tự thêm',
        caloriesPer100g: kcal100,
        proteinPer100g: p100,
        carbsPer100g: c100,
        fatPer100g: f100,
        unit: 'phần',
        defaultServingGrams: grams,
        servingLabel: foodServing.trim() || `${grams}g`,
        prepTip: foodPrepTip.trim() || undefined,
        isCustom: true,
      };
      saveCustomFoods([newFood, ...customFoods]);
      showToast(`Đã thêm món mới "${foodName.trim()}" vào kho dữ liệu!`);
    }

    resetForm();
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (!deletingFood) return;
    deleteCustomFood(deletingFood.id);
    showToast(`Đã xóa món "${deletingFood.name}" khỏi kho dữ liệu.`);
    setDeletingFood(null);
    refreshFromStorage();
  };

  // Reset to default foods
  const handleResetDefaults = () => {
    if (window.confirm('Bạn có chắc muốn khôi phục kho món ăn về danh sách chuẩn ban đầu của 3S Gym?')) {
      resetCustomFoods();
      showToast('Đã khôi phục kho món ăn về mặc định chuẩn 3S Gym.');
      refreshFromStorage();
    }
  };

  // Live Macro preview calculation
  const previewP = parseFloat(foodProtein) || 0;
  const previewC = parseFloat(foodCarbs) || 0;
  const previewF = parseFloat(foodFat) || 0;
  const autoCalculatedCalories = Math.round(previewP * 4 + previewC * 4 + previewF * 9);
  const totalMacroGrams = previewP + previewC + previewF;
  const pctP = totalMacroGrams > 0 ? Math.round((previewP / totalMacroGrams) * 100) : 0;
  const pctC = totalMacroGrams > 0 ? Math.round((previewC / totalMacroGrams) * 100) : 0;
  const pctF = totalMacroGrams > 0 ? 100 - pctP - pctC : 0;

  // Filter & Sort
  const filteredFoods = useMemo(() => {
    let list = foods.filter((f) => {
      // Category filter
      if (selectedCategory === 'custom') {
        if (!(f as CustomFoodItem).isCustom) return false;
      } else if (selectedCategory !== 'all') {
        if (f.category !== selectedCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = f.name.toLowerCase().includes(q);
        const matchTip = f.prepTip?.toLowerCase().includes(q);
        const matchCat = f.categoryLabel.toLowerCase().includes(q);
        if (!matchName && !matchTip && !matchCat) return false;
      }
      return true;
    });

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'calories_desc') return b.caloriesPer100g - a.caloriesPer100g;
      if (sortBy === 'calories_asc') return a.caloriesPer100g - b.caloriesPer100g;
      if (sortBy === 'protein_desc') return b.proteinPer100g - a.proteinPer100g;
      return a.name.localeCompare(b.name, 'vi');
    });

    return list;
  }, [foods, selectedCategory, searchQuery, sortBy]);

  // Reset pagination when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sortBy, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredFoods.length / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedFoods = useMemo(() => {
    return filteredFoods.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredFoods, startIndex, itemsPerPage]);
  const displayStart = filteredFoods.length === 0 ? 0 : startIndex + 1;
  const displayEnd = Math.min(startIndex + itemsPerPage, filteredFoods.length);

  // Metric counts
  const countAll = foods.length;
  const countCustom = customFoods.length;
  const countProtein = foods.filter((f) => f.category === 'protein').length;
  const countCarbs = foods.filter((f) => f.category === 'carbs').length;
  const countVeggies = foods.filter((f) => f.category === 'veggies').length;
  const countFat = foods.filter((f) => f.category === 'fat').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.86rem',
            fontWeight: 700,
            zIndex: 9999,
          }}
        >
          <CheckCircle2 size={18} color="#22c55e" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner & Summary */}
      <div
        style={{
          background: 'linear-gradient(135deg, #003b70 0%, #0284c7 100%)',
          borderRadius: '16px',
          padding: '20px 24px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Utensils size={20} color="#ffffff" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>
              Quản Lý Kho Món Ăn & Dinh Dưỡng
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              if (showForm && !editingFoodId) {
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            style={{
              background: '#ffffff',
              color: '#003b70',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.86rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            }}
          >
            {showForm && !editingFoodId ? <X size={16} /> : <Plus size={16} />}
            <span>{showForm && !editingFoodId ? 'Đóng Form' : '+ Thêm Món Mới'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            title="Khôi phục danh sách mặc định"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <RotateCcw size={14} /> Mặc Định
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div
          onClick={() => setSelectedCategory('all')}
          style={{
            background: selectedCategory === 'all' ? '#e0f2fe' : '#ffffff',
            border: selectedCategory === 'all' ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>TẤT CẢ MÓN</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#003b70', marginTop: '2px' }}>{countAll}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('custom')}
          style={{
            background: selectedCategory === 'custom' ? '#fef3c7' : '#ffffff',
            border: selectedCategory === 'custom' ? '1.5px solid #d97706' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>MÓN TỰ THÊM</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>{countCustom}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('protein')}
          style={{
            background: selectedCategory === 'protein' ? '#eff6ff' : '#ffffff',
            border: selectedCategory === 'protein' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>NHÓM ĐẠM</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>{countProtein}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('carbs')}
          style={{
            background: selectedCategory === 'carbs' ? '#fffbeb' : '#ffffff',
            border: selectedCategory === 'carbs' ? '1.5px solid #d97706' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>TINH BỘT</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>{countCarbs}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('veggies')}
          style={{
            background: selectedCategory === 'veggies' ? '#ecfdf5' : '#ffffff',
            border: selectedCategory === 'veggies' ? '1.5px solid #10b981' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>RAU CỦ</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857', marginTop: '2px' }}>{countVeggies}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('fat')}
          style={{
            background: selectedCategory === 'fat' ? '#fdf2f8' : '#ffffff',
            border: selectedCategory === 'fat' ? '1.5px solid #db2777' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#db2777', fontWeight: 700 }}>CHẤT BÉO</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#be185d', marginTop: '2px' }}>{countFat}</div>
        </div>
      </div>

      {/* Form: Thêm Mới hoặc Sửa Món Ăn */}
      {showForm && (
        <form
          onSubmit={handleSaveFood}
          style={{
            background: '#ffffff',
            border: '2px solid #0284c7',
            borderRadius: '14px',
            padding: '20px 22px',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {editingFoodId ? <Edit3 size={16} /> : <Plus size={16} />}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#003b70' }}>
                {editingFoodId ? 'Chỉnh Sửa Thông Tin Món Ăn' : 'Thêm Món Ăn Mới Vào Kho Dữ Liệu'}
              </h3>
            </div>

            <button
              type="button"
              onClick={resetForm}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Cột 1: Thông tin cơ bản */}
            <div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Tên món ăn <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="VD: Ức gà nướng sốt cam, Bò lúc lắc..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Nhóm dinh dưỡng chính
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'protein', label: 'Đạm (Protein)', color: '#2563eb' },
                    { id: 'carbs', label: 'Tinh bột (Carbs)', color: '#d97706' },
                    { id: 'veggies', label: 'Rau củ (Fiber)', color: '#059669' },
                    { id: 'fat', label: 'Chất béo (Fat)', color: '#db2777' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFoodCategory(cat.id as FoodCategory)}
                      style={{
                        background: foodCategory === cat.id ? '#003b70' : '#f8fafc',
                        color: foodCategory === cat.id ? '#ffffff' : '#475569',
                        border: '1.5px solid',
                        borderColor: foodCategory === cat.id ? '#003b70' : '#cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Định lượng khẩu phần
                  </label>
                  <input
                    type="text"
                    value={foodServing}
                    onChange={(e) => setFoodServing(e.target.value)}
                    placeholder="VD: 1 đĩa (150g), 1 bát con..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Khối lượng (gram)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="10"
                    value={foodGrams}
                    onChange={(e) => setFoodGrams(e.target.value)}
                    placeholder="150"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Cột 2: Chỉ số dinh dưỡng & Macro Preview */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#003b70', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={15} color="#ea580c" /> Giá Trị Dinh Dưỡng Theo Khẩu Phần ({foodGrams}g)
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                    Calo (kcal)
                  </label>
                  <input
                    type="number"
                    aria-label="Calo (kcal)"
                    value={foodCalories}
                    onChange={(e) => setFoodCalories(e.target.value)}
                    placeholder={String(autoCalculatedCalories || 'Tự tính')}
                    style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, color: '#ea580c' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', marginBottom: '3px' }}>
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    aria-label="Protein (g)"
                    value={foodProtein}
                    onChange={(e) => setFoodProtein(e.target.value)}
                    placeholder="VD: 25"
                    style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, color: '#1d4ed8' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#d97706', marginBottom: '3px' }}>
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    aria-label="Carbs (g)"
                    value={foodCarbs}
                    onChange={(e) => setFoodCarbs(e.target.value)}
                    placeholder="VD: 5"
                    style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, color: '#b45309' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#db2777', marginBottom: '3px' }}>
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    aria-label="Fat (g)"
                    value={foodFat}
                    onChange={(e) => setFoodFat(e.target.value)}
                    placeholder="VD: 4"
                    style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800, color: '#be185d' }}
                  />
                </div>
              </div>

              {/* Macro Proportion Bar */}
              {totalMacroGrams > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '3px' }}>
                    <span style={{ color: '#1d4ed8' }}>Đạm: {pctP}%</span>
                    <span style={{ color: '#b45309' }}>Carbs: {pctC}%</span>
                    <span style={{ color: '#be185d' }}>Béo: {pctF}%</span>
                  </div>
                  <div style={{ display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0' }}>
                    <div style={{ width: `${pctP}%`, background: '#2563eb' }} />
                    <div style={{ width: `${pctC}%`, background: '#f59e0b' }} />
                    <div style={{ width: `${pctF}%`, background: '#ec4899' }} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Cách chế biến / Lưu ý khi nấu (tùy chọn)
                </label>
                <input
                  type="text"
                  value={foodPrepTip}
                  onChange={(e) => setFoodPrepTip(e.target.value)}
                  placeholder="VD: Áp chảo ít dầu, nướng nồi chiên không dầu 180°C..."
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 22px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #003b70 100%)',
                color: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Check size={16} /> {editingFoodId ? 'Lưu Thay Đổi Món Ăn' : 'Lưu Vào Kho Món Ăn'}
            </button>
          </div>
        </form>
      )}

      {/* Toolbar: Search, Filters & Sorters */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên món ăn hoặc cách nấu..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
            }}
          />
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#334155',
                background: '#ffffff',
              }}
            >
              <option value="name">Tên A-Z</option>
              <option value="calories_desc">Calo cao nhất</option>
              <option value="calories_asc">Calo thấp nhất</option>
              <option value="protein_desc">Protein cao nhất</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Hiển thị:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#334155',
                background: '#ffffff',
              }}
            >
              <option value={9}>9 món / trang</option>
              <option value={12}>12 món / trang</option>
              <option value={18}>18 món / trang</option>
              <option value={24}>24 món / trang</option>
              <option value={1000}>Tất cả món</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Pills Slider */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: `Tất Cả (${countAll})` },
          { id: 'custom', label: `Món Tự Thêm (${countCustom})` },
          { id: 'protein', label: `Nhóm Đạm (${countProtein})` },
          { id: 'carbs', label: `Tinh Bột (${countCarbs})` },
          { id: 'veggies', label: `Rau Củ (${countVeggies})` },
          { id: 'fat', label: `Chất Béo (${countFat})` },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id as any)}
            style={{
              background: selectedCategory === c.id ? '#003b70' : '#ffffff',
              color: selectedCategory === c.id ? '#ffffff' : '#334155',
              border: '1px solid',
              borderColor: selectedCategory === c.id ? '#003b70' : '#cbd5e1',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Result Count and Quick Page Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
        <div>
          Hiển thị <strong style={{ color: '#003b70' }}>{displayStart} - {displayEnd}</strong> trên tổng số <strong>{filteredFoods.length}</strong> món ăn
        </div>
        {totalPages > 1 && (
          <div>
            Trang <strong style={{ color: '#0284c7' }}>{safeCurrentPage}</strong> / <strong>{totalPages}</strong>
          </div>
        )}
      </div>

      {/* Grid of Dishes (Paginated) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {paginatedFoods.map((item) => {
          const isCust = Boolean((item as CustomFoodItem).isCustom);
          return (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: isCust ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: isCust ? '0 2px 8px rgba(59, 130, 246, 0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative',
              }}
            >
              <div>
                {/* Header tags */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background:
                        item.category === 'protein'
                          ? '#eff6ff'
                          : item.category === 'carbs'
                            ? '#fef3c7'
                            : item.category === 'veggies'
                              ? '#ecfdf5'
                              : '#fdf2f8',
                      color:
                        item.category === 'protein'
                          ? '#1d4ed8'
                          : item.category === 'carbs'
                            ? '#b45309'
                            : item.category === 'veggies'
                              ? '#047857'
                              : '#be185d',
                    }}
                  >
                    {item.categoryLabel}
                  </span>

                  {isCust ? (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        background: '#dbeafe',
                        color: '#1e40af',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      Món tự thêm
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#64748b',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                   
                    </span>
                  )}
                </div>

                {/* Dish Name */}
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px', lineHeight: 1.3 }}>
                  {item.name}
                </div>

                {/* Serving & Kcal per 100g */}
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px' }}>
                  Khẩu phần: <strong style={{ color: '#003b70' }}>{item.servingLabel || `${item.defaultServingGrams}g`}</strong> •{' '}
                  <span style={{ color: '#ea580c', fontWeight: 800 }}>{item.caloriesPer100g} kcal/100g</span>
                </div>

                {/* Macro Badges */}
                <div style={{ display: 'flex', gap: '6px', fontSize: '0.74rem', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    P: {item.proteinPer100g}g
                  </span>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    C: {item.carbsPer100g}g
                  </span>
                  <span style={{ background: '#fdf2f8', color: '#be185d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    F: {item.fatPer100g}g
                  </span>
                </div>

                {/* Prep Tip */}
                {item.prepTip && (
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', marginBottom: '10px' }}>
                    "{item.prepTip}"
                  </div>
                )}
              </div>

              {/* Action Buttons: Sửa & Xóa (Bỏ nút dùng món này) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '10px',
                  marginTop: '4px',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleStartEdit(item)}
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                  title="Chỉnh sửa thông tin món ăn"
                >
                  <Edit3 size={14} /> Sửa
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingFood(item)}
                  style={{
                    background: '#fff1f2',
                    color: '#e11d48',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                  title="Xóa món ăn khỏi kho dữ liệu"
                >
                  <Trash2 size={14} /> Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div
          data-testid="meal-pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 18px',
            marginTop: '8px',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            Hiển thị <strong style={{ color: '#003b70' }}>{displayStart} - {displayEnd}</strong> / <strong>{filteredFoods.length}</strong> món ăn
            <span style={{ margin: '0 6px' }}>•</span>
            Trang <strong style={{ color: '#0284c7' }}>{safeCurrentPage}</strong> / <strong>{totalPages}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                background: safeCurrentPage <= 1 ? '#f1f5f9' : '#ffffff',
                color: safeCurrentPage <= 1 ? '#94a3b8' : '#003b70',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ChevronLeft size={14} /> Trước
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              // Hide middle pages if too many
              if (
                totalPages > 7 &&
                p !== 1 &&
                p !== totalPages &&
                Math.abs(p - safeCurrentPage) > 1
              ) {
                if (p === 2 || p === totalPages - 1) {
                  return (
                    <span key={p} style={{ padding: '0 4px', color: '#94a3b8' }}>
                      ...
                    </span>
                  );
                }
                return null;
              }

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    minWidth: '34px',
                    height: '34px',
                    padding: '0 6px',
                    borderRadius: '8px',
                    border: p === safeCurrentPage ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                    background: p === safeCurrentPage ? '#0284c7' : '#ffffff',
                    color: p === safeCurrentPage ? '#ffffff' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                background: safeCurrentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                color: safeCurrentPage >= totalPages ? '#94a3b8' : '#003b70',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {filteredFoods.length === 0 && (
        <div
          style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <Utensils size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
            Không tìm thấy món ăn nào phù hợp
          </div>
          <p style={{ margin: '4px 0 12px', fontSize: '0.8rem' }}>
            Thử tìm kiếm với từ khóa khác hoặc bấm nút bên dưới để tạo món ăn mới.
          </p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="button button-primary"
            style={{ fontSize: '0.82rem' }}
          >
            + Thêm Món Ăn Này
          </button>
        </div>
      )}

      {/* Modal Xác Nhận Xóa */}
      {deletingFood && (
        <div className="modal-backdrop" role="dialog" aria-label="Xác nhận xóa món ăn">
          <div className="modal" style={{ maxWidth: '420px', padding: '20px 22px', borderRadius: '14px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', fontWeight: 800, color: '#e11d48' }}>
              Xác Nhận Xóa Món Ăn
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#475569' }}>
              Bạn có chắc chắn muốn xóa món <strong>"{deletingFood.name}"</strong> khỏi kho thực đơn? Thao tác này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeletingFood(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Đồng Ý Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
