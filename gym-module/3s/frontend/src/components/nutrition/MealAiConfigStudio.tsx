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
import CustomSelect from '../ui/CustomSelect';

export const DIET_STYLES = [
  { id:'vietnamese_easy', label:'Món Việt dễ nấu / Tiết kiệm', desc:'Thực phẩm tươi sống chợ Việt, nhanh 15-20p' },
  { id:'eat_clean', label:'Eat Clean', desc:'Ức gà, cá áp chảo, gạo lứt, khoai lang, rau luộc' },
  { id:'office_eating_out', label:'Cơm Văn Phòng / Ăn Ngoài', desc:'Chọn món tiện lợi quán cơm bình dân' },
  { id:'high_protein_vegan', label:'Ăn Chay Giàu Protein', desc:'Đậu phụ, nấm, hạt dinh dưỡng, yến mạch' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
            <Sparkles size={16} />
          </div>
          <div>
            <strong style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', display: 'block' }}>
              Cấu hình nhu cầu dinh dưỡng
            </strong>
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
              <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Flame size={14} color="#ea580c" /> CALO MỤC TIÊU (KCAL/NGÀY)
              </label>
              {appliedNutrition && (
                <button
                  type="button"
                  onClick={() => setTargetKcalInput(String(appliedNutrition.targetCalories))}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Điền {appliedNutrition.targetCalories} kcal
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
                    height: '36px',
                    padding: '0 44px 0 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>
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
                      height: '36px',
                      padding: '0 9px',
                      borderRadius: '8px',
                      border: targetKcalInput === String(k) ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                      background: targetKcalInput === String(k) ? '#e0f2fe' : '#ffffff',
                      color: targetKcalInput === String(k) ? '#0284c7' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: targetKcalInput === String(k) ? 600 : 500,
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
            <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <Layers size={14} color="#0ea5e9" /> SỐ LƯỢNG BỮA ĂN TRONG NGÀY
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
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: active ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                      background: active ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.84rem', fontWeight: active ? 600 : 500, color: active ? '#0284c7' : '#0f172a' }}>
                        {opt.label}
                      </strong>
                      {active && <Check size={14} color="#0ea5e9" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field 3: Diet Style Cards */}
          <div>
            <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
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
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: active ? '1px solid #86efac' : '1px solid #e2e8f0',
                      background: active ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: active ? 600 : 500, color: active ? '#15803d' : '#0f172a' }}>
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
            <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <Clock size={14} color="#0ea5e9" /> LỊCH TẬP & LỐI SỐNG SINH HOẠT
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {SCHEDULE_PRESETS.map((preset) => {
                const active = workoutSchedule.includes(preset.split(' ')[0]);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWorkoutSchedule(preset)}
                    style={{
                      background: active ? '#e0f2fe' : '#f8fafc',
                      color: active ? '#0284c7' : '#475569',
                      border: active ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '4px 9px',
                      fontSize: '0.73rem',
                      fontWeight: active ? 600 : 500,
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
                height: '36px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.82rem',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Field 5: Allergies / Restrictions */}
          <div>
            <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
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
                      color: active ? '#dc2626' : '#475569',
                      border: active ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                      borderRadius: '999px',
                      padding: '4px 11px',
                      fontSize: '0.73rem',
                      fontWeight: active ? 600 : 500,
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
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Coins size={14} color="#d97706" /> NGÂN SÁCH
              </label>
              <CustomSelect
                value={budgetLevel}
                onChange={(val) => setBudgetLevel(val)}
                ariaLabel="Ngân sách thực đơn"
                options={[
                  { value: 'BUDGET', label: 'Tiết kiệm' },
                  { value: 'STANDARD', label: 'Tiêu chuẩn' },
                  { value: 'PREMIUM', label: 'Cao cấp' },
                ]}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                GHI CHÚ THÊM TỪ PT
              </label>
              <input
                value={customDietNotes}
                onChange={(e) => setCustomDietNotes(e.target.value)}
                placeholder="VD: Thích cafe đen, ghét ức gà luộc..."
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.82rem',
                  color: '#0f172a',
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
        className="button button-primary"
        onClick={onAiGenerate}
        disabled={loadingAi}
        style={{
          width: '100%',
          minHeight: '40px',
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '6px',
        }}
      >
        {loadingAi ? <RefreshCw size={16} aria-hidden="true" className="spin" /> : <Wand2 size={16} aria-hidden="true" />}
        {loadingAi ? 'AI đang thiết kế thực đơn cơm Việt...' : 'Sinh thực đơn AI'}
      </button>
    </div>
  );
}
