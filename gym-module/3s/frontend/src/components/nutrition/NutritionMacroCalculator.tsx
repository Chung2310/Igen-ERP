import { useState, useEffect, useId } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { Customer, CalculatedNutrition, AiNutritionAnalysisResult } from '../../types';

interface NutritionMacroCalculatorProps {
  selectedCustomer?: Customer | null;
  onApplyPlan?: (result: CalculatedNutrition, rawAiAnalysis?: AiNutritionAnalysisResult) => void;
}

const BODY_TYPE_PRESETS = [
  'Endomorph (Dễ tích mỡ)',
  'Ectomorph (Khó tăng cân)',
  'Mesomorph (Cơ địa thể thao)',
  'Skinny Fat (Ít cơ, nhiều mỡ)',
];

const SCHEDULE_PRESETS = [
  'Văn phòng ngồi nhiều, tập chiều 18h-19h30',
  'Làm ca kíp / Ca đêm, tập sáng sớm 7h-8h30',
  'Bận rộn, chỉ nấu 2 bữa/ngày, tập trưa 11h30',
  'Tập sáng sớm 6h-7h15, năng động cả ngày',
];

const DIETARY_PRESETS = [
  'Món Việt dễ nấu, không hải sản vỏ, không lactose',
  'Eat Clean (nhiều rau, ức gà, cá, gạo lứt)',
  'Ăn chay thể hình (đậu phụ, nấm, trứng, sữa hạt)',
  'Nhịn ăn gián đoạn 16/8',
  'Ăn ngoài quán cơm bình dân',
];

export default function NutritionMacroCalculator({ selectedCustomer, onApplyPlan }: NutritionMacroCalculatorProps) {
  const toast = useToast();
  const [activeMode, setActiveMode] = useState<'AI_EXPERT' | 'FORMULA'>('AI_EXPERT');

  // Common Customer State
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>(selectedCustomer?.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
  const [weight, setWeight] = useState<string>(selectedCustomer?.initialWeight ? String(selectedCustomer.initialWeight) : '72');
  const [height, setHeight] = useState<string>(selectedCustomer?.height ? String(selectedCustomer.height) : '173');
  const [age, setAge] = useState<string>('26');
  const [bodyFat, setBodyFat] = useState<string>('');

  // AI-Specific Context Inputs
  const [bodyType, setBodyType] = useState(BODY_TYPE_PRESETS[0]);
  const [dailySchedule, setDailySchedule] = useState(SCHEDULE_PRESETS[0]);
  const [dietaryPreferences, setDietaryPreferences] = useState(DIETARY_PRESETS[0]);
  const [medicalNotes, setMedicalNotes] = useState(selectedCustomer?.medicalNotes || 'Dạ dày và huyết áp bình thường.');
  const [fitnessGoal, setFitnessGoal] = useState(
    selectedCustomer?.initialGoal || selectedCustomer?.fitnessGoal || 'Giảm 3-4kg mỡ, săn chắc cơ bụng trong 8 tuần',
  );
  const [customAiRequest, setCustomAiRequest] = useState('');

  // Formula-Specific Inputs
  const [activityFactor, setActivityFactor] = useState<string>('1.55');
  const [formulaGoal, setFormulaGoal] = useState<string>('FAT_LOSS_MODERATE');
  const [proteinRatio, setProteinRatio] = useState<string>('2.0');
  const [fatRatio, setFatRatio] = useState<string>('0.8');

  // Loading & Results
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingStage, setLoadingStage] = useState<number>(0);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [aiAnalysis, setAiAnalysis] = useState<AiNutritionAnalysisResult | null>(null);
  const [formulaResult, setFormulaResult] = useState<CalculatedNutrition | null>(null);

  // Animated Loading Progress Tracker
  useEffect(() => {
    if (!loadingAi) {
      setLoadingProgress(0);
      setLoadingStage(0);
      return;
    }
    setLoadingProgress(18);
    setLoadingStage(1);
    const t1 = setTimeout(() => { setLoadingProgress(45); setLoadingStage(2); }, 1100);
    const t2 = setTimeout(() => { setLoadingProgress(72); setLoadingStage(3); }, 2600);
    const t3 = setTimeout(() => { setLoadingProgress(90); setLoadingStage(4); }, 4200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loadingAi]);

  // Sync when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      if (selectedCustomer.gender) setGender(selectedCustomer.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
      if (selectedCustomer.initialWeight) setWeight(String(selectedCustomer.initialWeight));
      if (selectedCustomer.height) setHeight(String(selectedCustomer.height));
      if (selectedCustomer.initialGoal || selectedCustomer.fitnessGoal) {
        setFitnessGoal(String(selectedCustomer.initialGoal || selectedCustomer.fitnessGoal));
      }
      if (selectedCustomer.medicalNotes) setMedicalNotes(selectedCustomer.medicalNotes);
    }
  }, [selectedCustomer]);

  // Handle AI Nutrition Analysis
  const handleAnalyzeAi = async () => {
    try {
      setLoadingAi(true);
      const payload = {
        customerId: selectedCustomer?._id || undefined,
        weight: parseFloat(weight) || 70,
        height: parseFloat(height) || 170,
        gender,
        age: parseInt(age, 10) || 26,
        bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
        bodyType,
        dailySchedule,
        dietaryPreferences,
        medicalNotes,
        fitnessGoal,
        request: customAiRequest || undefined,
      };

      const res = await api.post<AiNutritionAnalysisResult>('/api/content-drafts/nutrition-analysis', payload);
      if (res.data) {
        setAiAnalysis(res.data);
        toast.success('AI đã phân tích thể trạng và tính toán dinh dưỡng cá nhân hóa thành công!');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingAi(false);
    }
  };

  // Handle Manual Formula Calculation
  const handleCalculateFormula = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const w = parseFloat(weight) || 70;
    const h = parseFloat(height) || 172;
    const a = parseFloat(age) || 25;
    const bf = parseFloat(bodyFat);
    const act = parseFloat(activityFactor) || 1.55;

    let bmr = 0;
    let formulaName = 'Mifflin-St Jeor';
    if (!isNaN(bf) && bf > 3 && bf < 60) {
      const lbm = w * (1 - bf / 100);
      bmr = Math.round(370 + 21.6 * lbm);
      formulaName = 'Katch-McArdle (% Mỡ InBody)';
    } else {
      const base = 10 * w + 6.25 * h - 5 * a;
      bmr = Math.round(base + (gender === 'MALE' ? 5 : -161));
    }

    const tdee = Math.round(bmr * act);
    let targetCalories = tdee;
    let deficitOrSurplus = 0;
    let goalLabel = 'Duy trì vóc dáng (Maintenance)';

    switch (formulaGoal) {
      case 'FAT_LOSS_FAST':
        deficitOrSurplus = -500;
        targetCalories = Math.round(tdee - 500);
        goalLabel = 'Giảm mỡ nhanh';
        break;
      case 'FAT_LOSS_MODERATE':
        deficitOrSurplus = -350;
        targetCalories = Math.round(tdee - 350);
        goalLabel = 'Giảm mỡ bền vững';
        break;
      case 'LEAN_BULK':
        deficitOrSurplus = 300;
        targetCalories = Math.round(tdee + 300);
        goalLabel = 'Tăng cơ nạc';
        break;
      default:
        targetCalories = tdee;
    }

    const pRatio = parseFloat(proteinRatio) || 2.0;
    const fRatio = parseFloat(fatRatio) || 0.8;
    const proteinGrams = Math.round(w * pRatio);
    const fatGrams = Math.round(w * fRatio);
    const proteinKcal = proteinGrams * 4;
    const fatKcal = fatGrams * 9;
    const remainingKcal = Math.max(0, targetCalories - proteinKcal - fatKcal);
    const carbsGrams = Math.round(remainingKcal / 4);
    const carbsKcal = carbsGrams * 4;
    const totalCalculatedKcal = proteinKcal + fatKcal + carbsKcal || 1;

    const calculated: CalculatedNutrition = {
      formula: formulaName,
      bmr,
      tdee,
      targetCalories,
      deficitOrSurplus,
      goal: formulaGoal,
      goalLabel,
      macros: { protein: proteinGrams, carbs: carbsGrams, fat: fatGrams },
      macroCalories: { proteinKcal, carbsKcal, fatKcal },
      macroPercentages: {
        proteinPct: Math.round((proteinKcal / totalCalculatedKcal) * 100),
        carbsPct: Math.round((carbsKcal / totalCalculatedKcal) * 100),
        fatPct: Math.round((fatKcal / totalCalculatedKcal) * 100),
      },
      waterLiters: parseFloat((w * 0.04 + (act > 1.5 ? 0.5 : 0)).toFixed(1)),
    };

    setFormulaResult(calculated);
  };

  const handleApplyToPlan = (nutritionData: CalculatedNutrition, rawAi?: AiNutritionAnalysisResult) => {
    if (onApplyPlan) {
      onApplyPlan(nutritionData, rawAi);
      toast.success('Đã áp dụng thông số Macro sang Trợ Lý Lên Thực Đơn AI!');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Top Banner & Mode Switcher */}
      <div
        style={{
          background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 15px rgba(0, 59, 112, 0.12)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 800 }}>
            {selectedCustomer ? `Phân Tích Dinh Dưỡng: ${selectedCustomer.fullName}` : 'Phân Tích Năng Lượng & Macro Cá Nhân Hóa'}
          </h2>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveMode('AI_EXPERT')}
            style={{
              background: activeMode === 'AI_EXPERT' ? '#ffffff' : 'transparent',
              color: activeMode === 'AI_EXPERT' ? '#003b70' : '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Hỏi Chuyên Gia AI
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('FORMULA')}
            style={{
              background: activeMode === 'FORMULA' ? '#ffffff' : 'transparent',
              color: activeMode === 'FORMULA' ? '#003b70' : '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Công thức
          </button>
        </div>
      </div>

      {/* Main Grid: Inputs vs Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {/* LEFT COLUMN: Inputs */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          {/* Base Physical Stats */}
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#003b70', fontWeight: 800 }}>
              Chỉ Số Thể Trạng Cơ Bản
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>GIỚI TÍNH</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>CÂN NẶNG (KG)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>CHIỀU CAO (CM)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>TUỔI</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>% MỠ (INBODY)</label>
                <input
                  type="number"
                  value={bodyFat}
                  placeholder="VD: 18%"
                  onChange={(e) => setBodyFat(e.target.value)}
                  style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                />
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  handleCalculateFormula();
                  setActiveMode('FORMULA');
                }}
                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700 }}
              >
                Tính Ngay
              </button>
            </div>
          </div>

          {/* AI MODE INPUTS */}
          {activeMode === 'AI_EXPERT' && (
            <>
              {/* Body Type & Metabolism */}
              <div>
                <label style={{ fontSize: '0.74rem', color: '#003b70', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Dạng Thể Chất & Cơ Chế Chuyển Hóa
                </label>
                <textarea
                  rows={2}
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value)}
                  placeholder="Mô tả cơ địa (VD: Khó tăng cân, dễ tích mỡ bụng, kháng insulin nhẹ...)"
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#1e293b' }}
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {BODY_TYPE_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBodyType(p)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.68rem',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {p.split('(')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule & Workout Times */}
              <div>
                <label style={{ fontSize: '0.74rem', color: '#003b70', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Lịch Trình Sinh Hoạt & Giờ Tập Luyện
                </label>
                <textarea
                  rows={2}
                  value={dailySchedule}
                  onChange={(e) => setDailySchedule(e.target.value)}
                  placeholder="Mô tả giờ làm việc, giờ tập và giấc ngủ thực tế..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#1e293b' }}
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {SCHEDULE_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDailySchedule(p)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.68rem',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {p.split('(')[0].slice(0, 25)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary Habits & Allergies */}
              <div>
                <label style={{ fontSize: '0.74rem', color: '#003b70', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Thói Quen Ăn Uống, Dị Ứng & Nhu Cầu Đặc Thù
                </label>
                <textarea
                  rows={2}
                  value={dietaryPreferences}
                  onChange={(e) => setDietaryPreferences(e.target.value)}
                  placeholder="Dị ứng (tôm, cua, lactose), ăn chay, nhịn ăn gián đoạn 16/8, thói quen ăn ngoài..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#1e293b' }}
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {DIETARY_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDietaryPreferences(p)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.68rem',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {p.split('(')[0].slice(0, 24)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal & Custom Request */}
              <div>
                <label style={{ fontSize: '0.74rem', color: '#003b70', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Mục Tiêu Cụ Thể Của Học Viên
                </label>
                <input
                  value={fitnessGoal}
                  onChange={(e) => setFitnessGoal(e.target.value)}
                  placeholder="VD: Giảm 4kg mỡ bụng, giữ nguyên cơ bắp trong 8 tuần"
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}
                />
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => void handleAnalyzeAi()}
                disabled={loadingAi}
                style={{
                  background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 59, 112, 0.2)',
                  marginTop: '6px',
                }}
              >
                {loadingAi ? 'AI đang phân tích chuyển hóa & lịch trình...' : 'AI Phân Tích Thể Chất & Tính Toán Chuyên Sâu'}
              </button>
            </>
          )}

          {/* FORMULA MODE INPUTS */}
          {activeMode === 'FORMULA' && (
            <>
              <div>
                <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>HỆ SỐ VẬN ĐỘNG (ACTIVITY FACTOR)</label>
                <select
                  value={activityFactor}
                  onChange={(e) => setActivityFactor(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="1.2">1.2 - Ít vận động</option>
                  <option value="1.375">1.375 - Vận động nhẹ</option>
                  <option value="1.55">1.55 - Vận động vừa</option>
                  <option value="1.725">1.725 - Vận động nặng</option>
                  <option value="1.9">1.9 - Vận động rất nặng</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>MỤC TIÊU THỂ HÌNH</label>
                <select
                  value={formulaGoal}
                  onChange={(e) => setFormulaGoal(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="FAT_LOSS_FAST">Giảm mỡ nhanh</option>
                  <option value="FAT_LOSS_MODERATE">Giảm mỡ bền vững</option>
                  <option value="MAINTENANCE">Duy trì vóc dáng</option>
                  <option value="LEAN_BULK">Tăng cơ nạc</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>PROTEIN RATIO (G/KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={proteinRatio}
                    onChange={(e) => setProteinRatio(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>FAT RATIO (G/KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={fatRatio}
                    onChange={(e) => setFatRatio(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={handleCalculateFormula}
                style={{ padding: '10px 16px', fontSize: '0.88rem', fontWeight: 700, marginTop: '8px' }}
              >
                Tính theo công thức
              </button>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Results Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* AI ANALYSIS RESULTS */}
          {activeMode === 'AI_EXPERT' && (
            <>
              {loadingAi ? (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    border: '2px dashed #38bdf8',
                    borderRadius: '14px',
                    padding: '24px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 4px 16px rgba(56, 189, 248, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.92rem', color: '#003b70' }}>
                      AI Đang Tính Năng Lượng & Macro...
                    </strong>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0284c7' }}>
                      {loadingProgress}%
                    </span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div style={{ width: '100%', height: '8px', background: '#bae6fd', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${loadingProgress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                        borderRadius: '4px',
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>

                  {/* 4 Step Progress Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: loadingStage >= 1 ? '#0369a1' : '#94a3b8', fontWeight: loadingStage === 1 ? 800 : 600 }}>
                      <span style={{ fontWeight: 800 }}>{loadingStage > 1 ? '✓' : '•'}</span>
                      <span>1. Phân tích thể trạng, % mỡ InBody & phân loại cơ địa</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: loadingStage >= 2 ? '#0369a1' : '#94a3b8', fontWeight: loadingStage === 2 ? 800 : 600 }}>
                      <span style={{ fontWeight: 800 }}>{loadingStage > 2 ? '✓' : '•'}</span>
                      <span>2. Tính toán BMR, TDEE & thâm hụt calo theo giờ tập</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: loadingStage >= 3 ? '#0369a1' : '#94a3b8', fontWeight: loadingStage === 3 ? 800 : 600 }}>
                      <span style={{ fontWeight: 800 }}>{loadingStage > 3 ? '✓' : '•'}</span>
                      <span>3. Phân bổ 3 chất đa lượng Protein/Carbs/Fat & thời điểm nạp</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: loadingStage >= 4 ? '#0369a1' : '#94a3b8', fontWeight: loadingStage === 4 ? 800 : 600 }}>
                      <span style={{ fontWeight: 800 }}>{loadingStage > 4 ? '✓' : '•'}</span>
                      <span>4. Tổng hợp danh mục thực phẩm nên ăn & chất bổ sung</span>
                    </div>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Summary Box */}
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ color: '#1e40af', fontWeight: 800, fontSize: '0.84rem', marginBottom: '4px' }}>
                      Đánh Giá Thể Trạng & Cơ Chế Chuyển Hóa
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5 }}>
                      {aiAnalysis.summary}
                    </p>
                  </div>

                  {/* Calories Row: BMR, TDEE, Target */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>BMR TỰ NHIÊN</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b' }}>{aiAnalysis.bmr} kcal</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>TDEE TIÊU HAO</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b' }}>{aiAnalysis.tdee} kcal</div>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>MỤC TIÊU NẠP</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>{aiAnalysis.targetCalories} kcal</div>
                      <span style={{ fontSize: '0.65rem', color: aiAnalysis.deficitOrSurplus < 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                        {aiAnalysis.deficitOrSurplus > 0 ? `+${aiAnalysis.deficitOrSurplus}` : aiAnalysis.deficitOrSurplus} kcal
                      </span>
                    </div>
                  </div>

                  {/* Macros: Protein, Carbs, Fat */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #dbeafe' }}>
                      <span style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>PROTEIN</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e40af' }}>{aiAnalysis.macros.protein}g</div>
                      <span style={{ fontSize: '0.65rem', color: '#60a5fa' }}>{aiAnalysis.macroPercentages?.proteinPct || 30}% calo</span>
                    </div>
                    <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #fef3c7' }}>
                      <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>CARBS</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#92400e' }}>{aiAnalysis.macros.carbs}g</div>
                      <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>{aiAnalysis.macroPercentages?.carbsPct || 45}% calo</span>
                    </div>
                    <div style={{ background: '#fdf2f8', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #fce7f3' }}>
                      <span style={{ fontSize: '0.72rem', color: '#be185d', fontWeight: 700 }}>FAT (CHẤT BÉO)</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#9d174d' }}>{aiAnalysis.macros.fat}g</div>
                      <span style={{ fontSize: '0.65rem', color: '#ec4899' }}>{aiAnalysis.macroPercentages?.fatPct || 25}% calo</span>
                    </div>
                  </div>

                  {/* Water Target */}
                  <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: '#0f766e', fontWeight: 700 }}>
                      Lượng nước khuyến nghị:
                    </span>
                    <strong style={{ color: '#0d9488', fontSize: '0.9rem' }}>{aiAnalysis.waterLiters || 2.5} Lít / ngày</strong>
                  </div>

                  {/* Timing Strategy Timeline */}
                  {aiAnalysis.timingStrategy && aiAnalysis.timingStrategy.length > 0 && (
                    <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#003b70', fontWeight: 800, marginBottom: '8px' }}>
                        Phân Bổ Thời Điểm Ăn Trong Ngày
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {aiAnalysis.timingStrategy.map((ts, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.76rem',
                            }}
                          >
                            <span style={{ fontWeight: 800, color: '#0284c7' }}>{ts.time} - {ts.meal}</span>
                            <span style={{ color: '#475569' }}>{ts.focus}</span>
                            <strong style={{ color: '#16a34a' }}>~{ts.calorieTarget} kcal</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dietary Advice Tips */}
                  {aiAnalysis.dietaryAdvice && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', fontSize: '0.8rem' }}>
                      <div style={{ marginBottom: '6px' }}>
                        <strong style={{ color: '#15803d' }}>Nên ăn: </strong>
                        <span style={{ color: '#334155' }}>{aiAnalysis.dietaryAdvice.recommendedFoods?.join(', ')}</span>
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong style={{ color: '#dc2626' }}>Cần tránh: </strong>
                        <span style={{ color: '#334155' }}>{aiAnalysis.dietaryAdvice.avoidFoods?.join(', ')}</span>
                      </div>
                      {aiAnalysis.dietaryAdvice.supplements && (
                        <div style={{ marginBottom: '6px' }}>
                          <strong style={{ color: '#7c3aed' }}>Thực phẩm bổ sung: </strong>
                          <span style={{ color: '#334155' }}>{aiAnalysis.dietaryAdvice.supplements.join(', ')}</span>
                        </div>
                      )}
                      {aiAnalysis.dietaryAdvice.keyNotes && (
                        <div style={{ color: '#003b70', fontStyle: 'italic', marginTop: '4px' }}>
                          <strong>Lưu ý: </strong>{aiAnalysis.dietaryAdvice.keyNotes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Apply Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const calculatedNutrition: CalculatedNutrition = {
                        formula: 'AI Chuyên Gia Dinh Dưỡng 3S',
                        bmr: aiAnalysis.bmr,
                        tdee: aiAnalysis.tdee,
                        targetCalories: aiAnalysis.targetCalories,
                        deficitOrSurplus: aiAnalysis.deficitOrSurplus,
                        goal: 'AI_CUSTOMIZED',
                        goalLabel: aiAnalysis.goalLabel,
                        macros: aiAnalysis.macros,
                        macroCalories: aiAnalysis.macroCalories,
                        macroPercentages: aiAnalysis.macroPercentages,
                        waterLiters: aiAnalysis.waterLiters,
                      };
                      handleApplyToPlan(calculatedNutrition, aiAnalysis);
                    }}
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 18px',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    Áp Dụng Sang Lên Thực Đơn AI Ngay
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', maxWidth: '340px', lineHeight: 1.5 }}>
                    Điền dạng thể chất, giờ làm việc & thói quen ăn uống bên trái, sau đó bấm <strong>&quot;AI Phân Tích Thể Chất&quot;</strong> để nhận chiến lược dinh dưỡng chuẩn xác.
                  </p>
                </div>
              )}
            </>
          )}

          {/* FORMULA RESULTS */}
          {activeMode === 'FORMULA' && formulaResult && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#003b70', fontWeight: 800 }}>
                  Kết Quả Nhu Cầu Năng Lượng
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Công thức: {formulaResult.formula}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>BMR (Tối thiểu)</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{formulaResult.bmr} kcal</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>TDEE (Tiêu hao)</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{formulaResult.tdee} kcal</div>
                </div>
                <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>Mục tiêu Nạp</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>{formulaResult.targetCalories} kcal</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>PROTEIN</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e40af' }}>{formulaResult.macros.protein}g</div>
                </div>
                <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>CARBS</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#92400e' }}>{formulaResult.macros.carbs}g</div>
                </div>
                <div style={{ background: '#fdf2f8', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#be185d', fontWeight: 700 }}>CHẤT BÉO</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#9d174d' }}>{formulaResult.macros.fat}g</div>
                </div>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={() => handleApplyToPlan(formulaResult)}
                style={{ padding: '10px 16px', fontSize: '0.85rem' }}
              >
                Áp Dụng Sang Lên Thực Đơn AI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
