import {
  Check,
  Clock,
  Coins,
  Flame,
  Layers,
  RefreshCw,
  Salad,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import type { CalculatedNutrition } from '../../types';

export const DIET_STYLES = [
  { id: 'vietnamese_easy', label: '🇻🇳 Món Việt dễ nấu / Tiết kiệm', desc: 'Thực phẩm tươi sống chợ Việt, nhanh 15-20p' },
  { id: 'eat_clean', label: '🥗 Eat Clean ', desc: 'Ức gà, cá áp chảo, gạo lứt, khoai lang, rau luộc' },
  { id: 'office_eating_out', label: '🏢 Cơm Văn Phòng / Ăn Ngoài', desc: 'Chọn món tiện lợi quán cơm bình dân' },
  { id: 'high_protein_vegan', label: '🌿 Ăn Chay Giàu Protein', desc: 'Đậu phụ, nấm, hạt dinh dưỡng, yến mạch' },
];

export const MEAL_COUNT_OPTIONS = [
  { value: 3, label: '3 Bữa', sub: 'Sáng • Trưa • Tối' },
  { value: 4, label: '4 Bữa ', sub: 'Sáng • Trưa • Phụ trước tập • Tối' },
  { value: 5, label: '5 Bữa', sub: '3 Chính + 2 Phụ Tăng Cơ' },
  { value: 2, label: '2 Bữa (IF 16/8)', sub: 'Bỏ sáng, ăn Trưa & Tối' },
];

export const ALLERGY_CHIPS = [
  'Dị ứng hải sản (tôm, cua)',
  'Không dung nạp lactose (sữa bò)',
  'Không ăn thịt đỏ (bò/heo)',
  'Không ăn cay / tiêu',
  'Không ăn trứng gà',
  'Không ăn đồ sống',
];

const SCHEDULE_PRESETS = [
  'Tập chiều 17h30 - 19h00 (Phổ biến)',
  'Tập sáng sớm 06h00 - 07h30',
  'Tập tối 19h30 - 21h00',
  'Làm văn phòng ngồi nhiều',
];

const KCAL_PRESETS = [1500, 1800, 2000, 2200, 2500];

interface MealAiConfigStudioProps {
  mealCount: number;
  setMealCount: (val: number) => void;
  targetKcalInput: string;
  setTargetKcalInput: (val: string) => void;
  dietStyle: string;
  setDietStyle: (val: string) => void;
  budgetLevel: string;
  setBudgetLevel: (val: string) => void;
  workoutSchedule: string;
  setWorkoutSchedule: (val: string) => void;
  selectedAllergies: string[];
  toggleAllergy: (chip: string) => void;
  customDietNotes: string;
  setCustomDietNotes: (val: string) => void;
  loadingAi: boolean;
  onAiGenerate: () => void;
  appliedNutrition?: CalculatedNutrition | null;
}

export default function MealAiConfigStudio({
  mealCount,
  setMealCount,
  targetKcalInput,
  setTargetKcalInput,
  dietStyle,
  setDietStyle,
  budgetLevel,
  setBudgetLevel,
  workoutSchedule,
  setWorkoutSchedule,
  selectedAllergies,
  toggleAllergy,
  customDietNotes,
  setCustomDietNotes,
  loadingAi,
  onAiGenerate,
  appliedNutrition,
}: MealAiConfigStudioProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <strong style={{ fontSize: '0.98rem', color: '#003b70', display: 'block' }}>
              Cấu Hình Nhu Cầu Dinh Dưỡng
            </strong>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Tùy chỉnh số bữa, calo mục tiêu, khẩu vị & giờ tập để AI sinh thực đơn cơm Việt chính xác
            </span>
          </div>
        </div>

        {appliedNutrition && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '8px', fontSize: '0.74rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Zap size={13} /> Đã nhận chỉ số Macro từ Tab 1: <strong>{appliedNutrition.targetCalories} kcal</strong>
          </div>
        )}
      </div>

      {/* Grid Layout: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* LEFT COLUMN: Calo, Số Bữa & Phong Cách */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Field 1: Target Calories */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Flame size={14} color="#ea580c" /> CALO MỤC TIÊU (KCAL/NGÀY)
              </label>
              {appliedNutrition && (
                <button
                  type="button"
                  onClick={() => setTargetKcalInput(String(appliedNutrition.targetCalories))}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  ⚡ Điền {appliedNutrition.targetCalories} kcal
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="number"
                  value={targetKcalInput}
                  onChange={(e) => setTargetKcalInput(e.target.value)}
                  placeholder="VD: 1850"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: '#003b70',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                  kcal
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {KCAL_PRESETS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTargetKcalInput(String(k))}
                    style={{
                      padding: '8px 8px',
                      borderRadius: '8px',
                      border: targetKcalInput === String(k) ? '1.5px solid #00a4e4' : '1px solid #e2e8f0',
                      background: targetKcalInput === String(k) ? '#f0f9ff' : '#f8fafc',
                      color: targetKcalInput === String(k) ? '#0284c7' : '#64748b',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Field 2: Meal Count Selector */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <Layers size={14} color="#0284c7" /> SỐ LƯỢNG BỮA ĂN TRONG NGÀY
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {MEAL_COUNT_OPTIONS.map((opt) => {
                const active = mealCount === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMealCount(opt.value)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: active ? '2px solid #00a4e4' : '1px solid #e2e8f0',
                      background: active ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: active ? '0 2px 8px rgba(0, 164, 228, 0.15)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.84rem', color: active ? '#003b70' : '#1e293b' }}>
                        {opt.label}
                      </strong>
                      {active && <Check size={14} color="#00a4e4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field 3: Diet Style Cards */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <Salad size={14} color="#16a34a" /> PHONG CÁCH ẨM THỰC
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              {DIET_STYLES.map((s) => {
                const active = dietStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDietStyle(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: active ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                      background: active ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: active ? '#166534' : '#1e293b' }}>
                      {s.label}
                    </div>
                    {active && <Check size={14} color="#16a34a" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Giờ tập, Dị ứng & Ghi chú */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Field 4: Workout Schedule & Presets */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <Clock size={14} color="#0284c7" /> LỊCH TẬP & LỐI SỐNG SINH HOẠT
            </label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {SCHEDULE_PRESETS.map((preset) => {
                const active = workoutSchedule.includes(preset.split(' ')[0]);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWorkoutSchedule(preset)}
                    style={{
                      background: active ? '#eff6ff' : '#f8fafc',
                      color: active ? '#1d4ed8' : '#64748b',
                      border: active ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <input
              value={workoutSchedule}
              onChange={(e) => setWorkoutSchedule(e.target.value)}
              placeholder="VD: Tập chiều 17h30-19h, văn phòng ngồi nhiều..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                color: '#1e293b',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Field 5: Allergies / Restrictions */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              KIÊNG KỴ & DỊ ỨNG
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ALLERGY_CHIPS.map((chip) => {
                const active = selectedAllergies.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleAllergy(chip)}
                    style={{
                      background: active ? '#fef2f2' : '#f8fafc',
                      color: active ? '#dc2626' : '#64748b',
                      border: active ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '5px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {active ? '✓ ' : '+ '} {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field 6: Budget & Custom Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Coins size={14} color="#d97706" /> NGÂN SÁCH
              </label>
              <select
                value={budgetLevel}
                onChange={(e) => setBudgetLevel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              >
                <option value="BUDGET">Tiết kiệm</option>
                <option value="STANDARD">Tiêu chuẩn</option>
                <option value="PREMIUM">Cao cấp</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                📝 GHI CHÚ THÊM TỪ PT
              </label>
              <input
                value={customDietNotes}
                onChange={(e) => setCustomDietNotes(e.target.value)}
                placeholder="VD: Thích cafe đen, ghét ức gà luộc..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BIG GENERATE ACTION BUTTON */}
      <button
        type="button"
        onClick={onAiGenerate}
        disabled={loadingAi}
        style={{
          background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '12px',
          padding: '14px 24px',
          fontWeight: 800,
          fontSize: '0.94rem',
          cursor: loadingAi ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0, 59, 112, 0.25)',
          marginTop: '6px',
          transition: 'all 0.15s ease',
        }}
      >
        {loadingAi ? <RefreshCw size={18} className="spin" /> : <Wand2 size={18} />}
        {loadingAi ? 'AI đang thiết kế thực đơn cơm Việt...' : 'Sinh Thực Đơn AI'}
      </button>
    </div>
  );
}
