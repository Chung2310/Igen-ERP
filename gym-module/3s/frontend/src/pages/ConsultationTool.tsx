import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { API_BASE_URL } from '../config';
import MealInfographicPoster from '../components/MealInfographicPoster';
import type { MealDish } from '../components/MealInfographicPoster';
import { useToast } from '../components/ui/ToastProvider';
import { errorMessage } from '../types';
import { 
  Calculator, 
  Utensils, 
  Activity, 
  Target, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
  Users,
  BarChart3,
  LogOut,
  Globe,
  Home,
  User as UserIcon,
  Search,
  Scale,
  Droplets,
  Dumbbell,
  Camera,
  Upload,
  FileText,
  CheckCircle2,
  Menu,
  X
} from 'lucide-react';

interface NutritionForm { clientName: string; gender: string; weight: string; height: string; age: string; activityLevel: string; mealCount: string; timeframe: string }
interface PosterDay { weekTitle: string; dishes: MealDish[] }
interface NutritionResult {
  clientName: string; bmi: number; bmiCategory: string; minIdealWeight: number; maxIdealWeight: number;
  actionRecommendation: string; actionTargetText?: string; bmiAdvice?: string; bmr: number; tdee: number;
  targetCalories: number; macros: { protein: number; carbs: number; fat: number }; timeframeLabel: string;
  posterList: PosterDay[]; adviceText?: string; openRouterResponse?: string; isRealAI?: boolean;
}
interface ParsedStep { stepNum: number; title: string; content: string }
interface BmiResult { bmi: number; category: string; minWeight: number; maxWeight: number }
interface TdeeResult { bmr: number; tdee: number; loseCal: number; gainCal: number }
interface BfpResult { bodyFat: number; fatMass: number; leanMass: number; category: string }
interface WaterResult { totalLiters: number; glasses: number }
interface OneRmResult { onerm: number; pct95: number; pct90: number; pct85: number; pct75: number }

const FOOD_DATABASE = [
  { id: 1, name: 'Ức gà tươi (không da)', category: 'meat', calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: '100g' },
  { id: 2, name: 'Thịt bò thăn nạc', category: 'meat', calories: 250, protein: 26, carbs: 0, fat: 15, unit: '100g' },
  { id: 3, name: 'Cá hồi Na Uy', category: 'meat', calories: 206, protein: 22, carbs: 0, fat: 13, unit: '100g' },
  { id: 4, name: 'Tôm thô luộc', category: 'meat', calories: 99, protein: 24, carbs: 0.2, fat: 0.3, unit: '100g' },
  { id: 5, name: 'Thịt thăn heo nạc', category: 'meat', calories: 143, protein: 26, carbs: 0, fat: 3.5, unit: '100g' },
  { id: 6, name: 'Trứng gà (1 quả vừa ~ 50g)', category: 'meat', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, unit: '1 quả' },
  { id: 7, name: 'Lòng trắng trứng gà (1 quả)', category: 'meat', calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1, unit: '1 quả' },
  { id: 8, name: 'Cơm trắng', category: 'carbs', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: '100g' },
  { id: 9, name: 'Cơm gạo lứt', category: 'carbs', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, unit: '100g' },
  { id: 10, name: 'Khoai lang luộc', category: 'carbs', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, unit: '100g' },
  { id: 11, name: 'Yến mạch thô', category: 'carbs', calories: 389, protein: 16.9, carbs: 66, fat: 6.9, unit: '100g' },
  { id: 12, name: 'Bánh mì nguyên cám (1 lát ~ 30g)', category: 'carbs', calories: 80, protein: 4, carbs: 13, fat: 1, unit: '1 lát' },
  { id: 13, name: 'Bông cải xanh (Súp lơ)', category: 'veggies', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, unit: '100g' },
  { id: 14, name: 'Rau muống luộc', category: 'veggies', calories: 19, protein: 3.2, carbs: 2.1, fat: 0.4, unit: '100g' },
  { id: 15, name: 'Bơ sáp chín', category: 'veggies', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, unit: '100g' },
  { id: 16, name: 'Táo tây (1 quả vừa ~ 180g)', category: 'veggies', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, unit: '1 quả' },
  { id: 17, name: 'Chuối chín (1 quả vừa ~ 120g)', category: 'veggies', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, unit: '1 quả' },
  { id: 18, name: 'Whey Protein Isolate (1 muỗng ~ 30g)', category: 'supplements', calories: 120, protein: 27, carbs: 1, fat: 0.5, unit: '1 muỗng' },
  { id: 19, name: 'Sữa chua không đường (1 hũ ~ 100g)', category: 'supplements', calories: 63, protein: 3.7, carbs: 5.3, fat: 3.2, unit: '1 hũ' },
  { id: 20, name: 'Hạt hạnh nhân nướng', category: 'supplements', calories: 579, protein: 21, carbs: 22, fat: 50, unit: '100g' }
];

const ConsultationTool = () => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('ai_assistant');
  const [isFormulaMenuOpen, setIsFormulaMenuOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [bmiCalcForm, setBmiCalcForm] = useState({ height: '172', weight: '70', gender: 'male' });
  const [bmiCalcResult, setBmiCalcResult] = useState<BmiResult | null>(null);

  const [tdeeCalcForm, setTdeeCalcForm] = useState({ gender: 'male', weight: '70', height: '172', age: '25', activity: 'moderate', goal: 'lose' });
  const [tdeeCalcResult, setTdeeCalcResult] = useState<TdeeResult | null>(null);

  const [bfpForm, setBfpForm] = useState({ gender: 'male', weight: '70', height: '172', waist: '80', neck: '38', hip: '95' });
  const [bfpResult, setBfpResult] = useState<BfpResult | null>(null);

  const [waterForm, setWaterForm] = useState({ weight: '70', workoutMinutes: '45' });
  const [waterResult, setWaterResult] = useState<WaterResult | null>(null);

  const [onermForm, setOnermForm] = useState({ weight: '80', reps: '5' });
  const [onermResult, setOnermResult] = useState<OneRmResult | null>(null);

  const [formData, setFormData] = useState<NutritionForm>({
    clientName: '',
    gender: 'male',
    weight: '70',
    height: '172',
    age: '25',
    activityLevel: 'moderate',
    mealCount: '3',
    timeframe: '1_day'
  });

  const [loading, setLoading] = useState(false);
  const [scanningInbody, setScanningInbody] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState('');
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [currentAiStep, setCurrentAiStep] = useState(0);
  const [activePosterTab, setActivePosterTab] = useState(0);

  const handleInbodyFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setScanningInbody(true);
    setScanSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64Data = evt.target?.result;
      try {
        const response = await fetch(`${API_BASE_URL}/api/nutrition/scan-inbody`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Data })
        });
        const resData = await response.json();

        if (response.ok && resData.success && resData.data) {
          const d = resData.data;
          const updatedFormData = {
            clientName: d.clientName || formData.clientName || 'Hội viên InBody',
            gender: d.gender === 'female' ? 'female' : 'male',
            age: d.age ? String(d.age) : formData.age,
            height: d.height ? String(d.height) : formData.height,
            weight: d.weight ? String(d.weight) : formData.weight,
            activityLevel: formData.activityLevel || 'moderate',
            mealCount: formData.mealCount || '3',
            timeframe: formData.timeframe || '1_day'
          };

          setFormData(updatedFormData);
          setScanSuccessMsg(`AI đã đọc thành công phiếu của ${updatedFormData.clientName}! Chiều cao: ${updatedFormData.height}cm, Cân nặng: ${updatedFormData.weight}kg.`);
          toast.success(`Quét InBody thành công cho ${updatedFormData.clientName}`);

          try {
            setLoading(true);
            const calcRes = await fetch(`${API_BASE_URL}/api/nutrition/calculate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...updatedFormData, useAI: true })
            });
            const calcPayload = await calcRes.json();
            if (!calcRes.ok || calcPayload.success === false) throw new Error(calcPayload.message || 'Không thể tính toán dinh dưỡng.');
            setResult(calcPayload.data);
          } catch (calcErr) {
            console.error('Calculation post-scan error:', calcErr);
            toast.error(errorMessage(calcErr));
          } finally {
            setLoading(false);
          }
        } else {
          toast.error(resData.message || 'Không thể đọc chỉ số từ phiếu InBody. Vui lòng kiểm tra lại file ảnh/PDF!');
        }
      } catch (err) {
        console.error('InBody scan upload error:', err);
        toast.error('Lỗi kết nối khi quét phiếu InBody. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại!');
      } finally {
        setScanningInbody(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const getParsedSteps = (rawText?: string): ParsedStep[] => {
    if (!rawText) return [];
    
    const text = rawText.replace(/\r\n/g, '\n').trim();
    
    const firstStepIndex = text.search(/(?:\*\*|##)?\s*BƯỚC\s*1/i);
    let introText = '';
    let bodyText = text;

    if (firstStepIndex > 0) {
      introText = text.substring(0, firstStepIndex).trim();
      bodyText = text.substring(firstStepIndex).trim();
    }

    const stepRegex = /(?:\*\*|##)?\s*BƯỚC\s*(\d+)[:\s-]*(.*?)(?=(?:\*\*|##)?\s*BƯỚC\s*\d+|$)/gsi;
    
    const stepsMap: Partial<Record<number, ParsedStep>> = {};
    let match: RegExpExecArray | null;

    while ((match = stepRegex.exec(bodyText)) !== null) {
      const num = parseInt(match[1], 10);
      const fullBlock = match[0].trim();
      
      const lines = fullBlock.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = lines[0] ? lines[0].replace(/[*#]/g, '').trim() : `BƯỚC ${num}`;
      
      let content = lines.slice(1).join('\n').trim();
      
      if (!content) content = fullBlock;
      
      if (num === 1 && introText) {
        content = `${introText}\n\n${content}`;
      }

      stepsMap[num] = {
        stepNum: num,
        title: titleLine,
        content
      };
    }

    const defaultTitles = [
      'BƯỚC 1: PHÂN TÍCH THỂ TRẠNG & BMI',
      'BƯỚC 2: ĐỀ XUẤT LỜI KHUYÊN & MỤC TIÊU',
      'BƯỚC 3: MỨC CALO MỤC TIÊU MỖI NGÀY',
      'BƯỚC 4: TỶ LỆ DINH DƯỠNG (MACROS)',
      'BƯỚC 5: ĐỀ XUẤT THỰC ĐƠN & BÀI TẬP'
    ];

    const resultSteps: ParsedStep[] = [];
    for (let i = 1; i <= 5; i++) {
      const parsedStep = stepsMap[i];
      if (parsedStep) {
        resultSteps.push(parsedStep);
      } else {
        resultSteps.push({
          stepNum: i,
          title: defaultTitles[i - 1],
          content: 'Đang cập nhật thông tin chi tiết cho bước này...'
        });
      }
    }

    return resultSteps;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCalculate = async (e?: FormEvent, customData: NutritionForm | null = null) => {
    e?.preventDefault();
    setLoading(true);

    const targetData = (typeof customData === 'object' && customData !== null) ? customData : formData;

    try {
      const response = await fetch(`${API_BASE_URL}/api/nutrition/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...targetData, useAI: true })
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Không thể tính toán dinh dưỡng.');
      setResult(payload.data);
    } catch (err) {
      console.error('Error connecting to nutrition server:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandaloneBMI = (e: FormEvent) => {
    e.preventDefault();
    const h = parseFloat(bmiCalcForm.height) / 100;
    const w = parseFloat(bmiCalcForm.weight);
    const bmi = parseFloat((w / (h * h)).toFixed(1));

    let category = '';
    if (bmi < 18.5) category = 'Thiếu cân (Underweight)';
    else if (bmi <= 24.9) category = 'Bình thường / Cân đối (Normal)';
    else if (bmi <= 29.9) category = 'Thừa cân (Overweight)';
    else category = 'Béo phì (Obese)';

    const minWeight = parseFloat((18.5 * h * h).toFixed(1));
    const maxWeight = parseFloat((24.9 * h * h).toFixed(1));

    setBmiCalcResult({ bmi, category, minWeight, maxWeight });
  };

  const calculateStandaloneTDEE = (e: FormEvent) => {
    e.preventDefault();
    const h = parseFloat(tdeeCalcForm.height);
    const w = parseFloat(tdeeCalcForm.weight);
    const age = parseInt(tdeeCalcForm.age);

    let bmr = (10 * w) + (6.25 * h) - (5 * age);
    bmr = tdeeCalcForm.gender === 'female' ? bmr - 161 : bmr + 5;

    const mults: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * (mults[tdeeCalcForm.activity] || 1.55));
    
    let loseCal = tdee - 500;
    let gainCal = tdee + 500;

    setTdeeCalcResult({ bmr: Math.round(bmr), tdee, loseCal, gainCal });
  };

  const calculateBFP = (e: FormEvent) => {
    e.preventDefault();
    const h = parseFloat(bfpForm.height);
    const w = parseFloat(bfpForm.weight);
    const waist = parseFloat(bfpForm.waist);
    const neck = parseFloat(bfpForm.neck);
    const hip = parseFloat(bfpForm.hip);

    let bodyFat = 0;
    if (bfpForm.gender === 'male') {
      bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
    } else {
      bodyFat = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450;
    }

    bodyFat = parseFloat(Math.max(3, Math.min(50, bodyFat)).toFixed(1));
    const fatMass = parseFloat((w * (bodyFat / 100)).toFixed(1));
    const leanMass = parseFloat((w - fatMass).toFixed(1));

    let category = '';
    if (bfpForm.gender === 'male') {
      if (bodyFat < 6) category = 'Vận động viên thi đấu (Essential Fat)';
      else if (bodyFat <= 13) category = 'Vận động viên (Athletic)';
      else if (bodyFat <= 17) category = 'Cân đối / Săn chắc (Fitness)';
      else if (bodyFat <= 24) category = 'Trung bình (Average)';
      else category = 'Thừa mỡ (Obese)';
    } else {
      if (bodyFat < 14) category = 'Vận động viên thi đấu (Essential Fat)';
      else if (bodyFat <= 20) category = 'Vận động viên (Athletic)';
      else if (bodyFat <= 24) category = 'Cân đối / Săn chắc (Fitness)';
      else if (bodyFat <= 31) category = 'Trung bình (Average)';
      else category = 'Thừa mỡ (Obese)';
    }

    setBfpResult({ bodyFat, fatMass, leanMass, category });
  };

  const calculateWaterIntake = (e: FormEvent) => {
    e.preventDefault();
    const w = parseFloat(waterForm.weight);
    const mins = parseInt(waterForm.workoutMinutes) || 0;

    let baseWater = w * 0.035;
    let workoutWater = (mins / 30) * 0.35;
    let totalLiters = parseFloat((baseWater + workoutWater).toFixed(1));
    let glasses = Math.round(totalLiters / 0.25);

    setWaterResult({ totalLiters, glasses });
  };

  const calculate1RM = (e: FormEvent) => {
    e.preventDefault();
    const w = parseFloat(onermForm.weight);
    const r = parseInt(onermForm.reps);

    const onerm = Math.round(w * (1 + r / 30));
    const pct95 = Math.round(onerm * 0.95);
    const pct90 = Math.round(onerm * 0.90);
    const pct85 = Math.round(onerm * 0.85);
    const pct75 = Math.round(onerm * 0.75);

    setOnermResult({ onerm, pct95, pct90, pct85, pct75 });
  };

  const filteredFoods = FOOD_DATABASE.filter(food => {
    const matchesSearch = food.name.toLowerCase().includes(foodQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || food.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <section style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div className="section-header">
        <div>
          <h1>Trợ lý dinh dưỡng & Công cụ tính</h1>
          <p>Trợ lý PT AI hỗ trợ quét phiếu InBody và các công cụ tính toán chỉ số thể chất chuẩn xác.</p>
        </div>
      </div>
      
      <div className="tab-bar">
        <button type="button" className={activeTab === 'ai_assistant' ? 'active' : ''} onClick={() => setActiveTab('ai_assistant')}>Trợ lí PT AI</button>
        <button type="button" className={activeTab === 'inbody_scan' ? 'active' : ''} onClick={() => setActiveTab('inbody_scan')}>Quét Phiếu InBody (AI)</button>
        <button type="button" className={activeTab === 'food_calculator' ? 'active' : ''} onClick={() => setActiveTab('food_calculator')}>Tra cứu Calo</button>
        <button type="button" className={activeTab === 'bmi_calculator' ? 'active' : ''} onClick={() => setActiveTab('bmi_calculator')}>Tính BMI & Cân nặng</button>
        <button type="button" className={activeTab === 'tdee_calculator' ? 'active' : ''} onClick={() => setActiveTab('tdee_calculator')}>Tính Calo TDEE & BMR</button>
        <button type="button" className={activeTab === 'bfp_calculator' ? 'active' : ''} onClick={() => setActiveTab('bfp_calculator')}>Tính % Mỡ (BFP)</button>
        <button type="button" className={activeTab === 'water_calculator' ? 'active' : ''} onClick={() => setActiveTab('water_calculator')}>Tính Nước Nạp</button>
        <button type="button" className={activeTab === 'onerm_calculator' ? 'active' : ''} onClick={() => setActiveTab('onerm_calculator')}>Tính Sức Mạnh 1RM</button>
        <button type="button" className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>Quản lý Hội viên</button>
        <button type="button" className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>Thống kê Calo</button>
      </div>

      <div style={{ marginTop: '20px', width: '100%', minWidth: 0 }}>
          
          {activeTab === 'inbody_scan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              <div style={{ background: 'white', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '1.05rem', color: '#003b70', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                  <Upload size={18} color="#00a4e4" /> TẢI PHIẾU INBODY & CHỌN CẤU HÌNH THỰC ĐƠN
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'center' }}>
                  <div style={{
                    border: '2px dashed #00a4e4',
                    borderRadius: '16px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: '#f0f9ff',
                    transition: 'all 0.2s ease'
                  }}>
                    <FileText size={48} color="#00a4e4" style={{ marginBottom: '12px' }} />
                    <h4 style={{ margin: '0 0 6px 0', color: '#003b70', fontWeight: 800, fontSize: '1rem' }}>
                      Chọn hoặc Kéo thả File Phiếu InBody
                    </h4>
                    <p style={{ margin: '0 0 18px 0', fontSize: '0.82rem', color: '#64748b' }}>
                      Định dạng hỗ trợ: File ảnh (.JPG, .PNG, .WEBP) hoặc File tài liệu PDF
                    </p>

                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: scanningInbody ? '#cbd5e1' : 'linear-gradient(135deg, #003b70, #00a4e4)',
                      color: 'white',
                      padding: '12px 26px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: scanningInbody ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(0,164,228,0.3)',
                      transition: 'all 0.2s ease'
                    }}>
                      {scanningInbody ? (
                        <>
                          <div style={{ width: '18px', height: '18px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          <span>AI đang bóc tách phiếu InBody...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={20} />
                          <span>Tải Phiếu InBody Ngay</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleInbodyFileUpload}
                        disabled={scanningInbody}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', background: '#f8fafc', padding: '22px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '8px', display: 'block', fontFamily: "'Be Vietnam Pro', sans-serif" }}>Số Bữa Ăn Muốn Chọn Trong Ngày</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {['2', '3', '4'].map(count => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              const updated = { ...formData, mealCount: count };
                              setFormData(updated);
                              if (result) handleCalculate(undefined, updated);
                            }}
                            style={{
                              padding: '10px', borderRadius: '8px', border: '1.5px solid',
                              borderColor: formData.mealCount === count ? '#00a4e4' : '#cbd5e1',
                              background: formData.mealCount === count ? '#e0f2fe' : 'white',
                              color: formData.mealCount === count ? '#003b70' : '#475569',
                              fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                              fontFamily: "'Be Vietnam Pro', sans-serif", letterSpacing: '0', textTransform: 'none'
                            }}
                          >
                            {count} Bữa
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '8px', display: 'block', fontFamily: "'Be Vietnam Pro', sans-serif" }}>Thời Lượng Lộ Trình Thực Đơn</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[{ id: '1_day', label: '1 Ngày' }, { id: '1_week', label: '1 Tuần' }, { id: '1_month', label: '1 Tháng' }].map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              const updated = { ...formData, timeframe: t.id };
                              setFormData(updated);
                              if (result) handleCalculate(undefined, updated);
                            }}
                            style={{
                              padding: '10px', borderRadius: '8px', border: '1.5px solid',
                              borderColor: formData.timeframe === t.id ? '#00a4e4' : '#cbd5e1',
                              background: formData.timeframe === t.id ? '#003b70' : 'white',
                              color: formData.timeframe === t.id ? 'white' : '#475569',
                              fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                              fontFamily: "'Be Vietnam Pro', sans-serif", letterSpacing: '0', textTransform: 'none'
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {scanSuccessMsg && (
                  <div style={{ marginTop: '18px', padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', fontSize: '0.88rem', color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} color="#22c55e" /> {scanSuccessMsg}
                  </div>
                )}
              </div>

              {(loading || scanningInbody) && (
                <div style={{ background: 'white', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1.5px solid rgba(0,164,228,0.3)', width: '100%', marginTop: '24px' }}>
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
                    <img src="/chuoi-gym/images/loading_penguin.gif" alt="AI đang làm việc..." style={{ width: '110px', height: 'auto', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,164,228,0.2)' }} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', color: '#003b70', fontWeight: 800, fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: '6px' }}>
                    {scanningInbody ? 'Trợ Lý AI Vision đang đọc phiếu InBody...' : 'Trợ Lý AI 3S đang phân tích chỉ số & thiết kế mâm cơm...'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                    {scanningInbody ? 'Chú chim cánh cụt PT 3S Gym đang chăm chỉ kiểm tra hình ảnh và bóc tách chỉ số!' : 'Vui lòng chờ trong giây lát để hệ thống tính toán calo và tạo hình ảnh lộ trình dinh dưỡng!'}
                  </p>
                </div>
              )}

              {!loading && !scanningInbody && result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Hội viên InBody</div>
                      <div style={{ fontSize: '1.2rem', color: '#003b70', fontWeight: 800, marginTop: '4px' }}>{result.clientName}</div>
                    </div>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Chỉ số BMI</div>
                      <div style={{ fontSize: '1.2rem', color: '#00a4e4', fontWeight: 800, marginTop: '4px' }}>{result.bmi} kg/m²</div>
                    </div>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Khuyến nghị</div>
                      <div style={{ fontSize: '1.1rem', color: '#ef4444', fontWeight: 800, marginTop: '4px' }}>{result.actionRecommendation}</div>
                    </div>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Calo Mục Tiêu</div>
                      <div style={{ fontSize: '1.2rem', color: '#003b70', fontWeight: 800, marginTop: '4px' }}>{result.targetCalories} Kcal/ngày</div>
                    </div>
                  </div>

                  {result.posterList && result.posterList.length > 0 && (
                    <MealInfographicPoster
                      titleTag="Thực Đơn Tư Vấn Phiếu InBody"
                      subTitle="Lộ Trình Dinh Dưỡng Cá Nhân Hóa"
                      timeframeText={`${result.timeframeLabel || '1 Ngày'} - 3S GYM`}
                      dishes={result.posterList[activePosterTab]?.dishes || result.posterList[0]?.dishes}
                    />
                  )}

                  {result.adviceText && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                      <h3 style={{ fontSize: '1.1rem', color: '#003b70', fontWeight: 800, fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={20} color="#00a4e4" /> LỜI KHUYÊN & LỘ TRÌNH CHI TIẾT TỪ TRỢ LÝ AI
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {getParsedSteps(result.adviceText).map((step, idx) => (
                          <div key={idx} style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #00a4e4' }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                              {step.title}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {step.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {activeTab === 'ai_assistant' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div className="dashboard-grid-layout">
                <div style={{ background: 'white', padding: '26px', borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-color)', marginBottom: '18px', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calculator size={18} color="var(--secondary-color)" /> CHỈ SỐ HỘI VIÊN
                  </h3>
                  <form onSubmit={(e) => handleCalculate(e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Họ tên hội viên</label>
                      <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} placeholder="Ví dụ: Nguyễn Văn A..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Giới tính</label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange} style={{ width: '100%', padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}>
                          <option value="male">Nam</option>
                          <option value="female">Nữ</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Tuổi</label>
                        <input type="number" name="age" value={formData.age} onChange={handleInputChange} placeholder="25" style={{ width: '100%', padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Chiều cao (cm)</label>
                        <input type="number" name="height" value={formData.height} onChange={handleInputChange} placeholder="170" style={{ width: '100%', padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Cân nặng (kg)</label>
                        <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} placeholder="70" style={{ width: '100%', padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Mức độ vận động</label>
                      <select name="activityLevel" value={formData.activityLevel} onChange={handleInputChange} style={{ width: '100%', padding: '10px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                        <option value="sedentary">Ít vận động (Văn phòng)</option>
                        <option value="light">Vận động nhẹ (Tập 1-3 buổi/tuần)</option>
                        <option value="moderate">Vận động vừa (Tập 3-5 buổi/tuần)</option>
                        <option value="active">Vận động cao (Tập 6-7 buổi/tuần)</option>
                        <option value="very_active">Vận động rất cao (VĐV)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>Số bữa ăn chọn trong ngày</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { count: '2', label: '2 Bữa' },
                          { count: '3', label: '3 Bữa' },
                          { count: '4', label: '4 Bữa' }
                        ].map((item) => (
                          <button
                            key={item.count}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, mealCount: item.count }))}
                            style={{
                              padding: '9px',
                              borderRadius: '8px',
                              border: formData.mealCount === item.count ? '2px solid var(--secondary-color)' : '1px solid #cbd5e1',
                              background: formData.mealCount === item.count ? 'rgba(0,164,228,0.1)' : '#f8fafc',
                              color: formData.mealCount === item.count ? 'var(--secondary-color)' : 'var(--text-dark)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: '0.88rem',
                              fontFamily: "'Be Vietnam Pro', sans-serif",
                              letterSpacing: '0',
                              textTransform: 'none'
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px', display: 'block', fontFamily: "'Be Vietnam Pro', sans-serif" }}>Thời lượng lộ trình dinh dưỡng</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { key: '1_day', label: '1 Ngày' },
                          { key: '1_week', label: '1 Tuần' },
                          { key: '1_month', label: '1 Tháng' }
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, timeframe: item.key }))}
                            style={{
                              padding: '9px',
                              borderRadius: '8px',
                              border: formData.timeframe === item.key ? '2px solid #003b70' : '1px solid #cbd5e1',
                              background: formData.timeframe === item.key ? '#003b70' : '#f8fafc',
                              color: formData.timeframe === item.key ? '#ffffff' : 'var(--text-dark)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: '0.88rem',
                              fontFamily: "'Be Vietnam Pro', sans-serif",
                              letterSpacing: '0',
                              textTransform: 'none'
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="btn btn-secondary" style={{ width: '100%', marginTop: '4px' }}>
                      {loading ? <>Đang phân tích...</> : <><Sparkles size={18} /> TÍNH TOÁN</>}
                    </button>
                  </form>
                </div>
                <div>
                  {loading && (
                    <div style={{ background: 'white', borderRadius: '20px', padding: '60px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1.5px solid rgba(0,164,228,0.3)', width: '100%', height: '100%', minHeight: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                        <img 
                          src="/chuoi-gym/images/loading_penguin.gif" 
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://media1.tenor.com/m/3fQbTuU0YPoAAAAC/pengu-pudgy.gif'; }}
                          alt="Trợ Lý AI 3S Gym đang tập luyện & phân tích..." 
                          style={{ width: '160px', height: '160px', borderRadius: '24px', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,164,228,0.25)', border: '3px solid #00a4e4' }} 
                        />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', color: '#003b70', fontWeight: 800, fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: '8px' }}>
                        Trợ Lý AI 3S đang phân tích & lên thực đơn...
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto', lineHeight: 1.5 }}>
                        Chú chim cánh cụt PT 3S Gym đang hăng hái tập luyện và tính toán calo cá nhân hóa cho hội viên!
                      </p>
                    </div>
                  )}
                  {!result && !loading && (
                    <div style={{ background: 'white', padding: '60px 24px', borderRadius: '20px', textAlign: 'center', border: '2px dashed #cbd5e1', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                      <Sparkles size={48} color="#00a4e4" style={{ marginBottom: '16px' }} />
                      <h3 style={{ fontSize: '1.25rem', color: '#003b70', fontWeight: 800, fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                        Nhập Chỉ Số & Bấm "TÍNH TOÁN"
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '380px', margin: '8px auto 0', lineHeight: 1.6 }}>
                        Trợ Lý AI 3S Gym sẽ tự động phân tích thể trạng, chỉ số BMI, calo mục tiêu và thiết kế <strong>Bộ Poster Thực Đơn Dinh Dưỡng Cân Bằng</strong> cá nhân hóa cho hội viên!
                      </p>
                    </div>
                  )}
                  {!loading && result && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ background: 'white', padding: '16px 24px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
                        <div>
                          <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 800 }}>
                            KẾT QUẢ TƯ VẤN: <span style={{ color: 'var(--secondary-color)', textTransform: 'uppercase' }}>{result.clientName}</span>
                          </h2>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px' }}>
                            Ngày tạo: {new Date().toLocaleDateString('vi-VN')} | 3S Wellness Admin
                          </div>
                        </div>
                      </div>
                      <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
                        <h3 style={{ fontSize: '1.05rem', color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Activity size={20} color="var(--secondary-color)" /> 1. CHỈ SỐ BMI & KHOẢNG CÂN NẶNG CHUẨN
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '20px', alignItems: 'center' }}>
                          <div style={{ background: 'rgba(0, 59, 112, 0.03)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(0, 59, 112, 0.08)' }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary-color)', lineHeight: 1 }}>{result.bmi}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>BMI (kg/m²)</div>
                            <div style={{ 
                              marginTop: '8px', 
                              display: 'inline-block', 
                              background: result.bmiCategory?.includes('Béo phì') ? '#fee2e2' : result.bmiCategory?.includes('Thừa cân') ? '#ffedd5' : result.bmiCategory?.includes('Thiếu cân') ? '#fef3c7' : '#dcfce7', 
                              color: result.bmiCategory?.includes('Béo phì') ? '#dc2626' : result.bmiCategory?.includes('Thừa cân') ? '#c2410c' : result.bmiCategory?.includes('Thiếu cân') ? '#d97706' : '#15803d', 
                              padding: '4px 12px', 
                              borderRadius: '12px', 
                              fontSize: '0.75rem', 
                              fontWeight: 700 
                            }}>
                              {result.bmiCategory}
                            </div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                background: result.actionRecommendation?.includes('TĂNG') ? '#fff7ed' : result.actionRecommendation?.includes('GIẢM') ? '#eff6ff' : '#f0fdf4',
                                color: result.actionRecommendation?.includes('TĂNG') ? '#c2410c' : result.actionRecommendation?.includes('GIẢM') ? '#1d4ed8' : '#166534',
                                border: '1px solid rgba(0,164,228,0.2)',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                              }}>
                                {result.actionRecommendation || 'ĐỀ XUẤT DINH DƯỠNG'}
                              </span>
                              {result.minIdealWeight && result.maxIdealWeight && (
                                <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#003b70', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                  Mức Cân Chuẩn: {result.minIdealWeight}kg - {result.maxIdealWeight}kg
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
                              {result.actionTargetText || result.bmiAdvice}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
                        <h3 style={{ fontSize: '1.05rem', color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Target size={20} color="var(--secondary-color)" /> 2. NHU CẦU CALO & MACROS
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>BMR</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-color)' }}>{result.bmr} <span style={{ fontSize: '0.75rem' }}>kcal</span></div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>TDEE</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-color)' }}>{result.tdee} <span style={{ fontSize: '0.75rem' }}>kcal</span></div>
                          </div>
                          <div style={{ background: 'rgba(0,164,228,0.08)', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(0,164,228,0.2)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', fontWeight: 700 }}>MỤC TIÊU CALO</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--secondary-color)' }}>{result.targetCalories} <span style={{ fontSize: '0.75rem' }}>kcal</span></div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                          <div style={{ background: 'rgba(0, 59, 112, 0.04)', padding: '12px 14px', borderRadius: '10px', borderLeft: '3px solid var(--primary-color)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)' }}>Protein (30%)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark)' }}>{result.macros.protein}g</div>
                          </div>
                          <div style={{ background: 'rgba(0, 164, 228, 0.04)', padding: '12px 14px', borderRadius: '10px', borderLeft: '3px solid var(--secondary-color)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-color)' }}>Carbs (45%)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark)' }}>{result.macros.carbs}g</div>
                          </div>
                          <div style={{ background: 'rgba(245, 158, 11, 0.04)', padding: '12px 14px', borderRadius: '10px', borderLeft: '3px solid #f59e0b' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>Fat (25%)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark)' }}>{result.macros.fat}g</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!loading && result && result.openRouterResponse ? (() => {
                const steps = getParsedSteps(result.openRouterResponse);
                const activeStepObj = steps[currentAiStep] || steps[0];
                const stepTitles = ['1. Thể Trạng & BMI', '2. Lời Khuyên & Mục Tiêu', '3. Mức Calo Nạp', '4. Dinh Dưỡng Macros', '5. Thực Đơn Chi Tiết'];
                return (
                  <div style={{ background: 'white', padding: '24px 28px', borderRadius: '20px', boxShadow: '0 2px 14px rgba(0,0,0,0.03)', border: '1px solid rgba(0,164,228,0.3)', width: '100%', height: '520px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <h3 style={{ fontSize: '1.15rem', color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <Bot size={22} color="var(--secondary-color)" /> PHÂN TÍCH CHUYÊN SÂU TỪ TRỢ LÝ AI 3S GYM
                      </h3>
                      <span style={{ fontSize: '0.75rem', background: result.isRealAI ? 'linear-gradient(135deg, #003b70, #00a4e4)' : '#64748b', color: 'white', padding: '4px 14px', borderRadius: '16px', fontWeight: 700 }}>
                        {result.isRealAI ? 'AI Phân tích Real-time' : 'Trợ Lý AI 3S Gym'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {stepTitles.map((stTitle, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => setCurrentAiStep(sIdx)}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: 'none',
                            background: currentAiStep === sIdx ? 'linear-gradient(135deg, #003b70, #00264d)' : '#f1f5f9',
                            color: currentAiStep === sIdx ? 'white' : '#64748b',
                            fontWeight: currentAiStep === sIdx ? 700 : 600,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            boxShadow: currentAiStep === sIdx ? '0 4px 12px rgba(0,59,112,0.2)' : 'none'
                          }}
                        >
                          {stTitle}
                        </button>
                      ))}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', height: '300px', overflowY: 'auto' }}>
                      <h4 style={{ fontSize: '1.05rem', color: '#003b70', fontWeight: 800, marginBottom: '12px', fontFamily: "'Be Vietnam Pro', sans-serif", borderLeft: '4px solid #00a4e4', paddingLeft: '10px' }}>
                        {activeStepObj?.title || `BƯỚC ${currentAiStep + 1}`}
                      </h4>
                      <div style={{ lineHeight: 1.65, fontSize: '0.9rem', color: '#334155' }}>
                        {activeStepObj?.content.split('\n').map((line, lIdx) => {
                          const trimmed = line.trim();
                          if (!trimmed) return null;
                          const parts = trimmed.split(/(\*\*.*?\*\*)/g);
                          const parsedLine = parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={pIdx} style={{ color: '#003b70', fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          });
                          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                            return (
                              <div key={lIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginLeft: '6px', marginBottom: '8px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                                <span style={{ color: '#00a4e4', fontWeight: 'bold' }}>•</span>
                                <div style={{ flex: 1 }}>{parsedLine}</div>
                              </div>
                            );
                          }
                          return (
                            <p key={lIdx} style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                              {parsedLine}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => setCurrentAiStep((prev) => Math.max(0, prev - 1))}
                        disabled={currentAiStep === 0}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 18px', borderRadius: '20px',
                          border: '1px solid #cbd5e1', background: currentAiStep === 0 ? '#f1f5f9' : 'white',
                          color: currentAiStep === 0 ? '#cbd5e1' : '#003b70',
                          fontWeight: 700, fontSize: '0.85rem', cursor: currentAiStep === 0 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <ChevronLeft size={16} /> Trang Trước
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', background: 'rgba(0,164,228,0.1)', padding: '4px 14px', borderRadius: '12px' }}>
                        Trang {currentAiStep + 1} / {steps.length > 5 ? 5 : steps.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentAiStep((prev) => Math.min(steps.length - 1, prev + 1))}
                        disabled={currentAiStep === (steps.length - 1) || currentAiStep === 4}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 20px', borderRadius: '20px',
                          border: 'none', background: (currentAiStep === 4 || currentAiStep === steps.length - 1) ? '#cbd5e1' : 'linear-gradient(135deg, #00a4e4, #0082c5)',
                          color: 'white', fontWeight: 700, fontSize: '0.85rem',
                          cursor: (currentAiStep === 4 || currentAiStep === steps.length - 1) ? 'not-allowed' : 'pointer',
                          boxShadow: (currentAiStep === 4 || currentAiStep === steps.length - 1) ? 'none' : '0 4px 12px rgba(0,164,228,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Trang Tiếp <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              })() : null}
              {result && result.posterList && result.posterList.length > 0 && (
                <div style={{ background: 'white', padding: '24px 28px', borderRadius: '20px', boxShadow: '0 2px 14px rgba(0,0,0,0.03)', border: '1px solid rgba(0,164,228,0.3)', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Utensils size={22} color="var(--secondary-color)" /> THỰC ĐƠN DINH DƯỠNG CÂN BẰNG (INFOGRAPHIC CHUẨN)
                    </h3>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{ background: 'linear-gradient(135deg, #003b70, #00264d)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,59,112,0.2)' }}
                    >
                      In / Tải Xuất Poster Infographic
                    </button>
                  </div>
                  {result.posterList.length > 1 && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {result.posterList.map((pItem, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setActivePosterTab(pIdx)}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '12px',
                            border: activePosterTab === pIdx ? 'none' : '1px solid #cbd5e1',
                            background: activePosterTab === pIdx ? 'linear-gradient(135deg, #003b70, #00264d)' : '#f8fafc',
                            color: activePosterTab === pIdx ? 'white' : '#64748b',
                            fontWeight: activePosterTab === pIdx ? 700 : 600,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: activePosterTab === pIdx ? '0 4px 12px rgba(0,59,112,0.2)' : 'none'
                          }}
                        >
                          {pItem.weekTitle || `Tuần ${pIdx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  <MealInfographicPoster 
                    titleTag="Bữa Ăn Khoa Học - Dễ Chế Biến"
                    subTitle="Thực Đơn Dinh Dưỡng Cân Bằng"
                    timeframeText={`${result.timeframeLabel || '1 Ngày'} - ${result.posterList[activePosterTab]?.weekTitle || 'Khẩu Phần Chuẩn'}`}
                    dishes={result.posterList[activePosterTab]?.dishes || result.posterList[0]?.dishes}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'food_calculator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'white', padding: '32px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0,164,228,0.1)', color: 'var(--secondary-color)', padding: '4px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                  <Utensils size={16} /> CÔNG CỤ DINH DƯỠNG KHÔNG AI (100% MATH)
                </div>
                <h2 style={{ fontSize: '2.2rem', color: '#003b70', fontWeight: 800, fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: '8px' }}>
                  Tra cứu calo thực phẩm
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
                  Tra cứu nhanh lượng calories, đạm, tinh bột và chất béo trong các thực phẩm fitness quen thuộc hàng ngày.
                </p>
                <div style={{ position: 'relative', maxWidth: '600px', marginBottom: '20px' }}>
                  <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="Tìm kiếm thực phẩm... (Ví dụ: ức gà, cơm lứt, trứng, cá hồi...)"
                    style={{ width: '100%', padding: '14px 16px 14px 48px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: 'Tất cả thực phẩm' },
                    { id: 'meat', label: 'Thịt & Đạm' },
                    { id: 'carbs', label: 'Tinh bột' },
                    { id: 'veggies', label: 'Rau củ & Trái cây' },
                    { id: 'supplements', label: 'Sữa & Whey' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{
                        padding: '8px 16px', borderRadius: '20px', border: 'none',
                        background: selectedCategory === cat.id ? '#003b70' : '#f1f5f9',
                        color: selectedCategory === cat.id ? 'white' : '#475569',
                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {filteredFoods.map(food => (
                  <div key={food.id} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontWeight: 800, color: '#003b70', fontSize: '1.05rem', marginBottom: '4px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                      {food.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>Hàm lượng tính trên: {food.unit}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', background: '#fafcfd', padding: '12px 8px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Calo</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#00a4e4' }}>{food.calories}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Protein</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#003b70' }}>{food.protein}g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Carbs</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#00a4e4' }}>{food.carbs}g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Fat</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#d97706' }}>{food.fat}g</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bmi_calculator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px', alignItems: 'start' }}>
              <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} color="#00a4e4" /> TÍNH CHỈ SỐ BMI & CÂN NẶNG CHUẨN
                </h3>
                <form onSubmit={calculateStandaloneBMI} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', display: 'block' }}>Chiều cao (cm)</label>
                    <input type="number" value={bmiCalcForm.height} onChange={(e) => setBmiCalcForm({ ...bmiCalcForm, height: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', display: 'block' }}>Cân nặng (kg)</label>
                    <input type="number" value={bmiCalcForm.weight} onChange={(e) => setBmiCalcForm({ ...bmiCalcForm, weight: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
                    TÍNH CHỈ SỐ BMI
                  </button>
                </form>
              </div>
              <div>
                {bmiCalcResult ? (
                  <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '20px', fontWeight: 800 }}>KẾT QUẢ TÍNH BMI & CÂN NẶNG LÝ TƯỞNG</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div style={{ background: 'rgba(0,164,228,0.08)', padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#00a4e4', fontWeight: 700 }}>CHỈ SỐ BMI</div>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: '#003b70', margin: '6px 0' }}>{bmiCalcResult.bmi}</div>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem' }}>{bmiCalcResult.category}</span>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>KHOẢNG CÂN NẶNG CHUẨN LÝ TƯỞNG</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#00a4e4', margin: '8px 0' }}>{bmiCalcResult.minWeight} - {bmiCalcResult.maxWeight} kg</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Dựa trên tiêu chuẩn y khoa WHO cho chiều cao {bmiCalcForm.height}cm</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'white', padding: '60px', borderRadius: '18px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                    <Activity size={48} color="#00a4e4" style={{ marginBottom: '12px' }} />
                    <h4 style={{ color: '#003b70' }}>Sẵn sàng tính chỉ số BMI</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nhập chiều cao và cân nặng bên trái để xem ngay kết quả.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tdee_calculator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px', alignItems: 'start' }}>
              <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={20} color="#00a4e4" /> TÍNH TDEE & BMR (MIFFLIN-ST JEOR)
                </h3>
                <form onSubmit={calculateStandaloneTDEE} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Giới tính</label>
                      <select value={tdeeCalcForm.gender} onChange={(e) => setTdeeCalcForm({ ...tdeeCalcForm, gender: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Tuổi</label>
                      <input type="number" value={tdeeCalcForm.age} onChange={(e) => setTdeeCalcForm({ ...tdeeCalcForm, age: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Chiều cao (cm)</label>
                      <input type="number" value={tdeeCalcForm.height} onChange={(e) => setTdeeCalcForm({ ...tdeeCalcForm, height: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Cân nặng (kg)</label>
                      <input type="number" value={tdeeCalcForm.weight} onChange={(e) => setTdeeCalcForm({ ...tdeeCalcForm, weight: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Tần suất tập luyện</label>
                    <select value={tdeeCalcForm.activity} onChange={(e) => setTdeeCalcForm({ ...tdeeCalcForm, activity: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <option value="sedentary">Ít vận động (Văn phòng)</option>
                      <option value="light">Nhẹ (Tập 1-3 buổi/tuần)</option>
                      <option value="moderate">Vừa (Tập 3-5 buổi/tuần)</option>
                      <option value="active">Nhiều (Tập 6-7 buổi/tuần)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '6px' }}>
                    TÍNH CALO TDEE
                  </button>
                </form>
              </div>
              <div>
                {tdeeCalcResult ? (
                  <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '20px', fontWeight: 800 }}>KẾT QUẢ TÍNH TDEE & MỤC TIÊU CALO HÀNG NGÀY</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>BMR (Tỷ lệ trao đổi chất)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#003b70' }}>{tdeeCalcResult.bmr} kcal</div>
                      </div>
                      <div style={{ background: 'rgba(0,164,228,0.08)', padding: '20px', borderRadius: '14px', textAlign: 'center', border: '1px solid rgba(0,164,228,0.2)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#00a4e4', fontWeight: 700 }}>TDEE (Calo duy trì)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#00a4e4' }}>{tdeeCalcResult.tdee} kcal</div>
                      </div>
                      <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700 }}>Calo Giảm Cân (-500)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#b45309' }}>{tdeeCalcResult.loseCal} kcal</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'white', padding: '60px', borderRadius: '18px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                    <Target size={48} color="#00a4e4" style={{ marginBottom: '12px' }} />
                    <h4 style={{ color: '#003b70' }}>Sẵn sàng tính chỉ số TDEE</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nhập thông tin bên trái để tính lượng calo tiêu thụ mỗi ngày.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bfp_calculator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px', alignItems: 'start' }}>
              <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={20} color="#00a4e4" /> TÍNH TỶ LỆ % MỠ (US NAVY)
                </h3>
                <form onSubmit={calculateBFP} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '4px', display: 'block' }}>Giới tính</label>
                    <select value={bfpForm.gender} onChange={(e) => setBfpForm({ ...bfpForm, gender: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Chiều cao (cm)</label>
                      <input type="number" value={bfpForm.height} onChange={(e) => setBfpForm({ ...bfpForm, height: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Cân nặng (kg)</label>
                      <input type="number" value={bfpForm.weight} onChange={(e) => setBfpForm({ ...bfpForm, weight: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Vòng cổ (cm)</label>
                      <input type="number" value={bfpForm.neck} onChange={(e) => setBfpForm({ ...bfpForm, neck: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Vòng eo (cm)</label>
                      <input type="number" value={bfpForm.waist} onChange={(e) => setBfpForm({ ...bfpForm, waist: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                  </div>
                  {bfpForm.gender === 'female' && (
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70' }}>Vòng hông (cm - Cho Nữ)</label>
                      <input type="number" value={bfpForm.hip} onChange={(e) => setBfpForm({ ...bfpForm, hip: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                    </div>
                  )}
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '6px' }}>
                    TÍNH TỶ LỆ % MỠ
                  </button>
                </form>
              </div>
              <div>
                {bfpResult ? (
                  <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '20px', fontWeight: 800 }}>KẾT QUẢ TÍNH TỶ LỆ MỠ CƠ THỂ</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div style={{ background: 'rgba(0,164,228,0.08)', padding: '20px', borderRadius: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#00a4e4', fontWeight: 700 }}>TỶ LỆ % MỠ (BFP)</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#003b70', margin: '4px 0' }}>{bfpResult.bodyFat}%</div>
                        <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>{bfpResult.category}</span>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>KHỐI LƯỢNG MỠ</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#d97706', margin: '4px 0' }}>{bfpResult.fatMass} kg</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>KHỐI CƠ NẠC (LEAN MASS)</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#003b70', margin: '4px 0' }}>{bfpResult.leanMass} kg</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'white', padding: '60px', borderRadius: '18px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                    <Scale size={48} color="#00a4e4" style={{ marginBottom: '12px' }} />
                    <h4 style={{ color: '#003b70' }}>Sẵn sàng tính % mỡ cơ thể</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nhập chỉ số vòng eo, cổ bên trái và bấm nút tính toán.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'water_calculator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px', alignItems: 'start' }}>
              <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Droplets size={20} color="#00a4e4" /> TÍNH LƯỢNG NƯỚC NẠP HÀNG NGÀY
                </h3>
                <form onSubmit={calculateWaterIntake} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', display: 'block' }}>Cân nặng cơ thể (kg)</label>
                    <input type="number" value={waterForm.weight} onChange={(e) => setWaterForm({ ...waterForm, weight: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', display: 'block' }}>Thời gian tập luyện / ngày (Phút)</label>
                    <input type="number" value={waterForm.workoutMinutes} onChange={(e) => setWaterForm({ ...waterForm, workoutMinutes: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
                    TÍNH LƯỢNG NƯỚC CẦN UỐNG
                  </button>
                </form>
              </div>
              <div>
                {waterResult ? (
                  <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '20px', fontWeight: 800 }}>KẾT QUẢ KHUYẾN NGHỊ LƯỢNG NƯỚC</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div style={{ background: 'rgba(0,164,228,0.08)', padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#00a4e4', fontWeight: 700 }}>LƯỢNG NƯỚC TIÊU CHUẨN</div>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: '#003b70', margin: '6px 0' }}>{waterResult.totalLiters} <span style={{ fontSize: '1.2rem' }}>Lít/ngày</span></div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>TƯƠNG ĐƯƠNG SỐ CỐC NƯỚC</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#00a4e4', margin: '6px 0' }}>~ {waterResult.glasses} Cốc</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Dung tích 250ml / cốc tiêu chuẩn</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'white', padding: '60px', borderRadius: '18px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                    <Droplets size={48} color="#00a4e4" style={{ marginBottom: '12px' }} />
                    <h4 style={{ color: '#003b70' }}>Sẵn sàng tính lượng nước</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nhập cân nặng và thời gian tập luyện để nhận kết quả.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'onerm_calculator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px', alignItems: 'start' }}>
              <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Dumbbell size={20} color="#00a4e4" /> TÍNH SỨC MẠNH TỐI ĐA (1RM)
                </h3>
                <form onSubmit={calculate1RM} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', display: 'block' }}>Mức tạ tập được (kg)</label>
                    <input type="number" value={onermForm.weight} onChange={(e) => setOnermForm({ ...onermForm, weight: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px', display: 'block' }}>Số lần lặp tối đa (Reps)</label>
                    <input type="number" value={onermForm.reps} onChange={(e) => setOnermForm({ ...onermForm, reps: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
                    TÍNH 1RM MAX TẠ
                  </button>
                </form>
              </div>
              <div>
                {onermResult ? (
                  <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid #edf2f7' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#003b70', marginBottom: '20px', fontWeight: 800 }}>KẾT QUẢ SỨC MẠNH 1RM MAX TẠ (EPLEY FORMULA)</h3>
                    <div style={{ background: 'rgba(0,164,228,0.08)', padding: '24px', borderRadius: '16px', textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#00a4e4', fontWeight: 700 }}>1RM TẠ TỐI ĐA (1 LẦN LẶP)</div>
                      <div style={{ fontSize: '3.2rem', fontWeight: 800, color: '#003b70', margin: '4px 0' }}>{onermResult.onerm} <span style={{ fontSize: '1.5rem' }}>kg</span></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center' }}>
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>95% 1RM (~2 reps)</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003b70' }}>{onermResult.pct95} kg</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>90% 1RM (~4 reps)</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003b70' }}>{onermResult.pct90} kg</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>85% 1RM (~6 reps)</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003b70' }}>{onermResult.pct85} kg</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>75% 1RM (~10 reps)</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003b70' }}>{onermResult.pct75} kg</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'white', padding: '60px', borderRadius: '18px', textAlign: 'center', border: '1px solid #edf2f7' }}>
                    <Dumbbell size={48} color="#00a4e4" style={{ marginBottom: '12px' }} />
                    <h4 style={{ color: '#003b70' }}>Sẵn sàng tính sức mạnh 1RM</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Nhập mức tạ và số reps lặp được bên trái.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              <h2 style={{ color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: '16px' }}>DANH SÁCH HỘI VIÊN DỰ ÁN 3S GYM</h2>
              <p style={{ color: 'var(--text-light)' }}>Tính năng quản lý danh sách và lịch sử thực đơn hội viên đang hoạt động.</p>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              <h2 style={{ color: 'var(--primary-color)', fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: '16px' }}>THỐNG KÊ CALO & HIỆU SUẤT TẬP LUYỆN</h2>
              <p style={{ color: 'var(--text-light)' }}>Hệ thống đang lưu trữ và thống kê lượng calo trung bình của các gói tập PT.</p>
            </div>
          )}
      </div>
    </section>
  );
};

export default ConsultationTool;
