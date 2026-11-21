import { useCallback, useState } from 'react';
import {
  Activity,
  Calculator,
  RefreshCw,
  RotateCcw,
  Salad,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/ToastProvider';
import CustomerSelect from '../../components/ui/CustomerSelect';
import { errorMessage } from '../../types';
import type { Customer, NutritionSummary } from '../../types';

import NutritionMacroCalculator from '../../components/nutrition/NutritionMacroCalculator';
import ActivityLibraryCalculator from '../../components/nutrition/ActivityLibraryCalculator';
import MealPlannerBuilder from '../../components/nutrition/MealPlannerBuilder';
import NutritionPlanList, { type NutritionPlanItem } from '../../components/nutrition/NutritionPlanList';
import NutritionLogForm from '../../components/nutrition/NutritionLogForm';
import MealLibraryManager from '../../components/nutrition/MealLibraryManager';

type NutritionTab = 'macro_calculator' | 'meal_swapper' | 'meal_manager' | 'activity_library' | 'logs_balance';

export default function NutritionPage() {
  const toast = useToast();
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<NutritionTab>('macro_calculator');
  const [summary, setSummary] = useState<NutritionSummary>({});
  const [loading, setLoading] = useState(false);
  const [appliedNutrition, setAppliedNutrition] = useState<any>(null);
  const [appliedAiAnalysis, setAppliedAiAnalysis] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<NutritionPlanItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const load = useCallback(
    async (targetId?: string) => {
      const idToLoad = targetId || customerId;
      if (!idToLoad) return;
      try {
        setLoading(true);
        const result = await api.get<unknown[]>(`/api/nutrition/logs?customerId=${idToLoad}&page=1&limit=20`);
        setSummary((result.summary as NutritionSummary | undefined) || {});
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [customerId, toast]
  );

  const handleApplyMacroToPlan = (nutrition: any, rawAi?: any) => {
    setAppliedNutrition(nutrition);
    if (rawAi) setAppliedAiAnalysis(rawAi);
    setEditingPlan(null);
    setIsCreatingNew(true);
    setActiveTab('meal_swapper');
  };

  return (
    <section style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Compact Customer Lookup Bar */}
      <div style={{ padding: '0 0 10px', marginBottom: '10px', borderBottom: '1px solid #d8e2f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', maxWidth: '420px', minWidth: '220px' }}>
            <CustomerSelect
              label=""
              name="customerId"
              value={customerId}
              ariaLabel="Học viên / Khách hàng"
              onSelectCustomer={(c) => {
                setSelectedCustomer(c);
              }}
              onChange={(selectedId) => {
                setCustomerId(selectedId);
                if (selectedId) void load(selectedId);
              }}
              placeholder="Chọn học viên theo tên, số điện thoại..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void load()}
              disabled={!customerId || loading}
              style={{
                minHeight: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <RefreshCw size={14} aria-hidden="true" className={loading ? 'spin' : ''} /> {loading ? 'Đang tải...' : 'Tải nhật ký'}
            </button>

            {customerId && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setCustomerId('');
                  setSelectedCustomer(null);
                  setSummary({});
                  setAppliedNutrition(null);
                  setAppliedAiAnalysis(null);
                }}
                style={{
                  minHeight: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <RotateCcw size={14} aria-hidden="true" /> Xóa
              </button>
            )}
          </div>
        </div>

        {selectedCustomer && (
          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px dashed #d8e2f0',
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              fontSize: '0.78rem',
              color: '#475569',
            }}
          >
            <span><strong style={{ color: '#071629' }}>Học viên:</strong> {selectedCustomer.fullName}</span>
            {selectedCustomer.gender && <span><strong style={{ color: '#071629' }}>Giới tính:</strong> {selectedCustomer.gender === 'FEMALE' ? 'Nữ' : 'Nam'}</span>}
            {selectedCustomer.initialWeight && <span><strong style={{ color: '#071629' }}>Cân nặng:</strong> {selectedCustomer.initialWeight} kg</span>}
            {selectedCustomer.height && <span><strong style={{ color: '#071629' }}>Chiều cao:</strong> {selectedCustomer.height} cm</span>}
            {selectedCustomer.initialGoal && <span><strong style={{ color: '#071629' }}>Mục tiêu:</strong> {selectedCustomer.initialGoal}</span>}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="tab-bar" role="tablist" aria-label="Phân mục dinh dưỡng">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'macro_calculator'}
          className={activeTab === 'macro_calculator' ? 'active' : ''}
          onClick={() => setActiveTab('macro_calculator')}
        >
          <Calculator size={15} aria-hidden="true" />
          1. Tính BMR & Macro Cá Nhân
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'meal_swapper'}
          className={activeTab === 'meal_swapper' ? 'active' : ''}
          onClick={() => setActiveTab('meal_swapper')}
        >
          <Sparkles size={15} aria-hidden="true" />
          2. Thiết Kế Thực Đơn
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'meal_manager'}
          className={activeTab === 'meal_manager' ? 'active' : ''}
          onClick={() => setActiveTab('meal_manager')}
        >
          <UtensilsCrossed size={15} aria-hidden="true" />
          3. Quản Lý Kho Món Ăn
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'activity_library'}
          className={activeTab === 'activity_library' ? 'active' : ''}
          onClick={() => setActiveTab('activity_library')}
        >
          <Activity size={15} aria-hidden="true" />
          4. Tiêu Hao Vận Động
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'logs_balance'}
          className={activeTab === 'logs_balance' ? 'active' : ''}
          onClick={() => setActiveTab('logs_balance')}
        >
          <Salad size={15} aria-hidden="true" />
          5. Nhật Ký Calo In / Out
        </button>
      </div>

      {/* Tab Contents */}
      <div style={{ marginTop: '10px', minWidth: 0 }}>
        {/* Tab 1: Macro Calculator */}
        {activeTab === 'macro_calculator' && (
          <NutritionMacroCalculator
            selectedCustomer={selectedCustomer}
            onApplyPlan={handleApplyMacroToPlan}
          />
        )}

        {/* Tab 2: Meal Planner Builder & List */}
        {activeTab === 'meal_swapper' && (
          editingPlan || isCreatingNew ? (
            <MealPlannerBuilder
              selectedCustomer={selectedCustomer}
              customerId={customerId}
              editingPlan={editingPlan}
              onBack={() => {
                setEditingPlan(null);
                setIsCreatingNew(false);
              }}
              onSaved={() => {
                setEditingPlan(null);
                setIsCreatingNew(false);
                void load();
              }}
              appliedNutrition={appliedNutrition}
              appliedAiAnalysis={appliedAiAnalysis}
            />
          ) : (
            <NutritionPlanList
              selectedCustomer={selectedCustomer}
              customerId={customerId}
              onCreateNew={() => {
                setEditingPlan(null);
                setIsCreatingNew(true);
              }}
              onEditPlan={(plan) => {
                setEditingPlan(plan);
                setIsCreatingNew(false);
                const cId = typeof plan.customerId === 'object' && plan.customerId ? plan.customerId._id : (plan.customerId as string);
                if (cId) {
                  setCustomerId(cId);
                  if (typeof plan.customerId === 'object' && plan.customerId) {
                    setSelectedCustomer(plan.customerId as Customer);
                  }
                }
              }}
            />
          )
        )}

        {/* Tab 3: Meal Library Manager (Kho Món Ăn Thêm / Sửa / Xóa) */}
        {activeTab === 'meal_manager' && (
          <MealLibraryManager />
        )}

        {/* Tab 4: Activity Calorie Library */}
        {activeTab === 'activity_library' && (
          <ActivityLibraryCalculator selectedCustomer={selectedCustomer} onLogged={() => void load()} />
        )}

        {/* Tab 5: Logs & Calorie Balance */}
        {activeTab === 'logs_balance' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Calories In / Out Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CALO NẠP VÀO (IN)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#003b70', margin: '4px 0' }}>
                  {summary.consumedCalories || 0} <span style={{ fontSize: '0.85rem' }}>kcal</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Từ các bữa ăn trong ngày</span>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CALO TIÊU HAO (OUT)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c', margin: '4px 0' }}>
                  {summary.burnedCalories || 0} <span style={{ fontSize: '0.85rem' }}>kcal</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Từ tập luyện & hoạt động</span>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CALO RÒNG (NET)</span>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 900,
                    color: (summary.netCalories || 0) < 0 ? '#16a34a' : '#003b70',
                    margin: '4px 0',
                  }}
                >
                  {summary.netCalories || 0} <span style={{ fontSize: '0.85rem' }}>kcal</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Calo Nạp - Calo Tiêu Hao</span>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TỔNG PROTEIN NẠP</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', margin: '4px 0' }}>
                  {summary.protein || 0} <span style={{ fontSize: '0.85rem' }}>g</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Đã ghi nhận trong ngày</span>
              </div>
            </div>

            {/* Log form & History */}
            {customerId ? (
              <NutritionLogForm customerId={customerId} onSaved={() => void load()} />
            ) : (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#64748b' }}>
                Vui lòng chọn học viên ở thanh tìm kiếm phía trên để ghi và xem nhật ký ăn uống / vận động.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
