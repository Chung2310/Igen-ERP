import {
  ArrowRightLeft,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

export interface MealFoodItem {
  name: string;
  amount: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  prepTip?: string;
  imageUrl?: string;
}

export interface MealBlock {
  id: string;
  name: string;
  timeSlot?: string;
  targetKcal: number;
  items: MealFoodItem[];
  imageUrl?: string;
}

interface MealCardItemProps {
  meal: MealBlock;
  mealIdx: number;
  mealsCount: number;
  isGeneratingImg: boolean;
  isGeneratingAllItems?: boolean;
  generatingItemKey?: string | null;
  onUpdateMealName: (mealIdx: number, name: string) => void;
  onUpdateMealTimeSlot: (mealIdx: number, timeSlot: string) => void;
  onRemoveMeal: (mealIdx: number) => void;
  onAddItem: (mealIdx: number) => void;
  onRemoveItem: (mealIdx: number, itemIdx: number) => void;
  onUpdateItem: (mealIdx: number, itemIdx: number, field: keyof MealFoodItem, val: any) => void;
  onGenerateImage?: (mealIdx: number) => void;
  onGenerateItemImage: (mealIdx: number, itemIdx: number, force?: boolean) => void;
  onGenerateAllMealItemsImages: (mealIdx: number) => void;
  onPreviewImage: (preview: { url: string; title: string }) => void;
  onOpenSwapper?: (mealIdx: number, itemIdx?: number) => void;
}

export default function MealCardItem({
  meal,
  mealIdx,
  mealsCount,
  isGeneratingImg,
  isGeneratingAllItems = false,
  generatingItemKey = null,
  onUpdateMealName,
  onUpdateMealTimeSlot,
  onRemoveMeal,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onGenerateImage,
  onGenerateItemImage,
  onGenerateAllMealItemsImages,
  onPreviewImage,
  onOpenSwapper,
}: MealCardItemProps) {
  const mealKcal = meal.items.reduce((s, i) => s + (i.calories || 0), 0);
  const mealP = meal.items.reduce((s, i) => s + (i.protein || 0), 0);
  const mealC = meal.items.reduce((s, i) => s + (i.carbs || 0), 0);
  const mealF = meal.items.reduce((s, i) => s + (i.fat || 0), 0);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Meal Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', gap: '8px', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={meal.name}
            onChange={(e) => onUpdateMealName(mealIdx, e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: '#003b70',
              outline: 'none',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <Clock size={12} color="#64748b" />
            <input
              value={meal.timeSlot || ''}
              onChange={(e) => onUpdateMealTimeSlot(mealIdx, e.target.value)}
              placeholder="07:00 - 07:45"
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.74rem',
                color: '#64748b',
                fontWeight: 600,
                outline: 'none',
                width: '110px',
              }}
            />
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div>
            <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#16a34a' }}>
              {mealKcal} kcal
            </span>
            <div style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700 }}>
              P:{mealP}g | C:{mealC}g | F:{mealF}g
            </div>
          </div>
          {mealsCount > 1 && (
            <button
              type="button"
              onClick={() => onRemoveMeal(mealIdx)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
              title="Xóa bữa ăn này"
            >
              <X size={14} color="#ef4444" />
            </button>
          )}
        </div>
      </div>

      {/* Generating AI Image Indicator */}
      {isGeneratingImg && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <RefreshCw size={18} className="spin" color="#16a34a" />
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#15803d' }}>
              FLUX.2 Klein 4B đang vẽ ảnh ẩm thực...
            </div>
            <div style={{ fontSize: '0.7rem', color: '#166534' }}>
              Tạo ảnh chất lượng cao 4K cho món ăn trong bữa
            </div>
          </div>
        </div>
      )}

      {/* AI Meal Image Display (if generated) */}
      {!isGeneratingImg && meal.imageUrl && (
        <div
          style={{
            position: 'relative',
            borderRadius: '10px',
            overflow: 'hidden',
            height: '140px',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
          onClick={() => onPreviewImage({ url: meal.imageUrl!, title: meal.name })}
        >
          <img
            src={meal.imageUrl}
            alt={meal.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Meal Food Items List */}
      <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
        {meal.items.map((item, itemIdx) => {
          const itemKey = `${meal.id || mealIdx}-${itemIdx}`;
          const isItemGenerating = generatingItemKey === itemKey;

          return (
            <div
              key={itemIdx}
              style={{
                background: '#f8fafc',
                border: '1px solid #f1f5f9',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                minWidth: 0,
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Dish Image Thumbnail / Generate Button */}
              <div style={{ flexShrink: 0, width: '56px', marginTop: '2px' }}>
                {isItemGenerating ? (
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      background: '#f0fdf4',
                      border: '1px dashed #86efac',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#16a34a',
                    }}
                    title="Đang tạo ảnh AI cho món này..."
                  >
                    <RefreshCw size={18} className="spin" />
                  </div>
                ) : item.imageUrl ? (
                  <div style={{ width: '56px', overflow: 'hidden', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
                    <button
                      type="button"
                      style={{ display: 'block', height: '56px', width: '100%', border: 'none', padding: 0, cursor: 'zoom-in', overflow: 'hidden' }}
                      onClick={() => onPreviewImage({ url: item.imageUrl!, title: item.name })}
                      aria-label={`Xem ảnh món ${item.name}`}
                      title="Xem ảnh món ăn"
                    >
                      <img src={item.imageUrl} alt={item.name} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', borderTop: '1px solid #f1f5f9', background: '#f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => onGenerateItemImage(mealIdx, itemIdx, true)}
                        disabled={isGeneratingAllItems}
                        style={{ display: 'flex', height: '26px', alignItems: 'center', justifyContent: 'center', background: '#fff', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        aria-label={`Vẽ lại ảnh món ${item.name}`}
                        title="Vẽ lại ảnh món này"
                      >
                        <RefreshCw size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateItem(mealIdx, itemIdx, 'imageUrl', undefined)}
                        disabled={isGeneratingAllItems}
                        style={{ display: 'flex', height: '26px', alignItems: 'center', justifyContent: 'center', background: '#fff', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        aria-label={`Xóa ảnh món ${item.name} khỏi thực đơn`}
                        title="Xóa ảnh khỏi thực đơn"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGenerateItemImage(mealIdx, itemIdx, false)}
                    disabled={isGeneratingAllItems}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      border: '1px dashed #94a3b8',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      cursor: 'pointer',
                      color: '#0284c7',
                      padding: 0,
                    }}
                    title="Tạo ảnh AI cho món này"
                  >
                    <Sparkles size={14} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>Tạo ảnh</span>
                  </button>
                )}
              </div>

              {/* Item Content (Inputs & Details) */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Row 1: Dish Name + Calories + Delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minWidth: 0 }}>
                  <input
                    value={item.name}
                    onChange={(e) => onUpdateItem(mealIdx, itemIdx, 'name', e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                    placeholder="Tên món ăn..."
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        padding: '2px 5px',
                      }}
                      title="Chỉnh sửa lượng calo"
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.calories ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, '');
                          onUpdateItem(mealIdx, itemIdx, 'calories', clean === '' ? 0 : parseInt(clean, 10));
                        }}
                        style={{
                          width: '36px',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          color: '#16a34a',
                          textAlign: 'right',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a' }}>kcal</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(mealIdx, itemIdx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                      title="Xóa món"
                    >
                      <Trash2 size={13} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>

                {/* Row 2: Amount */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#64748b', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: '#64748b', flexShrink: 0 }}>Định lượng:</span>
                  <input
                    value={item.amount}
                    onChange={(e) => onUpdateItem(mealIdx, itemIdx, 'amount', e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      padding: '3px 6px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                    placeholder="VD: 150g thịt ức gà"
                  />
                </div>

                {/* Row 3: P / C / F + Đổi món button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', flexWrap: 'wrap', marginTop: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', minWidth: 0 }}>
                    {/* Protein (P) */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '4px',
                        padding: '1px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#1d4ed8',
                      }}
                      title="Chỉnh sửa lượng Protein (g)"
                    >
                      <span>P:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.protein ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, '');
                          onUpdateItem(mealIdx, itemIdx, 'protein', clean === '' ? 0 : parseInt(clean, 10));
                        }}
                        style={{
                          width: '22px',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#1d4ed8',
                          textAlign: 'center',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                      <span>g</span>
                    </div>

                    {/* Carbs (C) */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: '4px',
                        padding: '1px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#b45309',
                      }}
                      title="Chỉnh sửa lượng Carbs (g)"
                    >
                      <span>C:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.carbs ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, '');
                          onUpdateItem(mealIdx, itemIdx, 'carbs', clean === '' ? 0 : parseInt(clean, 10));
                        }}
                        style={{
                          width: '22px',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#b45309',
                          textAlign: 'center',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                      <span>g</span>
                    </div>

                    {/* Fat (F) */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        background: '#fdf2f8',
                        border: '1px solid #fbcfe8',
                        borderRadius: '4px',
                        padding: '1px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#be185d',
                      }}
                      title="Chỉnh sửa lượng Fat (g)"
                    >
                      <span>F:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.fat ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, '');
                          onUpdateItem(mealIdx, itemIdx, 'fat', clean === '' ? 0 : parseInt(clean, 10));
                        }}
                        style={{
                          width: '22px',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#be185d',
                          textAlign: 'center',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                      <span>g</span>
                    </div>
                  </div>

                  {onOpenSwapper && (
                    <button
                      type="button"
                      onClick={() => onOpenSwapper(mealIdx, itemIdx)}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '2px 7px',
                        cursor: 'pointer',
                        color: '#1d4ed8',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                      title={`Đổi món "${item.name}" sang món tương đương`}
                    >
                      <ArrowRightLeft size={11} /> Đổi món
                    </button>
                  )}
                </div>

                {item.prepTip && (
                  <div style={{ fontSize: '0.7rem', color: '#0284c7', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', minWidth: 0 }}>
                    <span style={{ flexShrink: 0 }}>🍳 Chế biến:</span>
                    <input
                      value={item.prepTip}
                      onChange={(e) => onUpdateItem(mealIdx, itemIdx, 'prepTip', e.target.value)}
                      style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', background: 'transparent', fontSize: '0.7rem', color: '#0284c7', fontStyle: 'italic', outline: 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add item & AI Image buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '6px' }}>
        <button
          type="button"
          onClick={() => onAddItem(mealIdx)}
          style={{
            background: 'none',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.76rem',
            color: '#0284c7',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Plus size={13} /> Thêm món
        </button>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>

          <button
            type="button"
            onClick={() => onGenerateAllMealItemsImages(mealIdx)}
            disabled={isGeneratingAllItems}
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              color: '#166534',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Tạo ảnh AI cho từng món ăn trong bữa"
          >
            {isGeneratingAllItems ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} color="#16a34a" />}
            {isGeneratingAllItems ? 'Đang tạo ảnh các món...' : 'Tạo ảnh tất cả món'}
          </button>
        </div>
      </div>
    </div>
  );
}
