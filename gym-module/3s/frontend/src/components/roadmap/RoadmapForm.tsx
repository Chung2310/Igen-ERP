import { useEffect, useState, useMemo, useRef, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  Layers,
  Loader2,
  Plus,
  Scale,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  Zap,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { errorMessage } from '../../types';
import type { InBodyRecordData } from '../../types/inbody';
import {
  generateSmartRoadmap,
  type RoadmapCustomerMeta,
  type RoadmapEvaluationCheckpoint,
  type RoadmapGoalType,
  type RoadmapNutritionStrategy,
  type RoadmapPhaseProposal,
  type RoadmapStrategyProposal,
} from '../../services/roadmapGenerator';
import { evaluateGoalFeasibility } from '../../services/goalFeasibilityService';
import CustomerSelect from '../ui/CustomerSelect';
import CustomSelect from '../ui/CustomSelect';
import { useToast } from '../ui/ToastProvider';
import type { Roadmap } from '../../types/roadmap';
import InfeasibleGoalModal from './InfeasibleGoalModal';

export type { Roadmap };

interface RoadmapFormProps {
  onSaved: () => void;
  onCancel: () => void;
  initialData?: Roadmap | null;
}

const newPhase = (order: number): RoadmapPhaseProposal => ({
  order,
  name: '',
  durationWeeks: 1,
  goals: [],
  weeks: [],
});

export default function RoadmapForm({ onSaved, onCancel, initialData }: RoadmapFormProps) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Core Form State
  const [customerId, setCustomerId] = useState(initialData?.customerId || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [phases, setPhases] = useState<RoadmapPhaseProposal[]>((initialData?.phases as RoadmapPhaseProposal[]) || [newPhase(1)]);
  const [strategy, setStrategy] = useState<RoadmapStrategyProposal | null>((initialData?.strategy as RoadmapStrategyProposal) || null);
  const [baseline, setBaseline] = useState<Record<string, number>>((initialData?.baseline as Record<string, number>) || {});
  const [phaseError, setPhaseError] = useState('');
  const [loading, setLoading] = useState(false);

  // Customer Context & InBody Data
  const [customerMeta, setCustomerMeta] = useState<RoadmapCustomerMeta | null>(null);
  const [latestInbody, setLatestInbody] = useState<InBodyRecordData | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextCustomerId, setContextCustomerId] = useState('');
  const generationRef = useRef<AbortController | null>(null);
  const contextReady = Boolean(customerId && contextCustomerId === customerId && !loadingContext);

  // Smart Proposal Generator Controls
  const [goalType, setGoalType] = useState<RoadmapGoalType>('FAT_LOSS');
  const [targetValue, setTargetValue] = useState<number>(5);
  const [targetUnit, setTargetUnit] = useState<string>('kg');
  const [durationWeeks, setDurationWeeks] = useState<number>(12);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(3);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(60);

  // Realtime AI Goal Feasibility Assessment (Tư vấn tính khả thi của mục tiêu)
  const feasibility = useMemo(() => {
    return evaluateGoalFeasibility({
      goalType,
      targetValue,
      targetUnit,
      durationWeeks,
      sessionsPerWeek,
      customerMeta,
      latestInbody,
    });
  }, [goalType, targetValue, targetUnit, durationWeeks, sessionsPerWeek, customerMeta, latestInbody]);

  // Modal cảnh báo mục tiêu bất khả thi
  const [showInfeasibleModal, setShowInfeasibleModal] = useState(false);

  const handleApplyRecommendedWeeks = (weeks: number) => {
    setDurationWeeks(weeks);
    setShowInfeasibleModal(false);
    toast.success(`Đã đổi thời gian thành ${weeks} tuần!`);
  };

  const handleApplyRecommendedTarget = (target: number) => {
    setTargetValue(target);
    setShowInfeasibleModal(false);
    toast.success(`Đã đổi mục tiêu thành ${target} ${targetUnit}!`);
  };

  // UI Accordion toggles
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({ 0: true });
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0);
  const [aiStep, setAiStep] = useState(1);
  const [aiProgress, setAiProgress] = useState(15);

  // Timer & dynamic step progression for AI generation
  useEffect(() => {
    if (!loadingAi) {
      setAiElapsedSeconds(0);
      setAiStep(1);
      setAiProgress(15);
      return;
    }

    const timer = setInterval(() => {
      setAiElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next <= 5) {
          setAiStep(1);
          setAiProgress(15 + next * 2);
        } else if (next <= 60) {
          setAiStep(2);
          setAiProgress(25 + Math.floor(((next - 5) / 55) * 35));
        } else if (next <= 120) {
          setAiStep(3);
          setAiProgress(60 + Math.floor(((next - 60) / 60) * 25));
        } else {
          setAiStep(4);
          setAiProgress(Math.min(96, 85 + Math.floor(((next - 120) / 60) * 11)));
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loadingAi]);

  // Reset context before loading another customer; late responses cannot replace current data.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    generationRef.current?.abort();
    generationRef.current = null;
    setLoadingAi(false);
    setCustomerMeta(null);
    setLatestInbody(null);
    setContextCustomerId('');
    setCustomNotes('');
    setSessionDurationMinutes(60);
    setGoalType('FAT_LOSS');
    setTargetValue(5);
    setTargetUnit('kg');
    setDurationWeeks(12);
    setSessionsPerWeek(3);
    setLoadingContext(Boolean(customerId));
    if (customerId) {
      void Promise.all([
        api.get<RoadmapCustomerMeta>(`/api/customers/${customerId}`, { signal: controller.signal }),
        api.get<InBodyRecordData[]>(`/api/inbody?customerId=${customerId}&limit=1`, { signal: controller.signal }),
        api.get<Array<{ type?: RoadmapGoalType; targetValue?: number; targetUnit?: string; sessionsPerWeek?: number }>>(`/api/goals?customerId=${customerId}&limit=1`, { signal: controller.signal }),
      ]).then(([customer, inbody, goals]) => {
        if (!active) return;
        setCustomerMeta(customer.data);
        setLatestInbody(inbody.data[0] ?? null);
        setCustomNotes(customer.data.medicalNotes || '');
        const goal = goals.data[0];
        if (goal?.type) setGoalType(goal.type);
        if (goal?.targetValue != null) setTargetValue(Number(goal.targetValue));
        if (goal?.targetUnit) setTargetUnit(goal.targetUnit);
        if (goal?.sessionsPerWeek) setSessionsPerWeek(Number(goal.sessionsPerWeek));
        setContextCustomerId(customerId);
      }).catch((err: unknown) => {
        if (active) toastRef.current.error(`Không tải được hồ sơ học viên: ${errorMessage(err)}`);
      }).finally(() => {
        if (active) setLoadingContext(false);
      });
    }
    return () => {
      active = false;
      controller.abort();
      generationRef.current?.abort();
    };
  }, [customerId]);

  const changeCustomer = (id: string) => {
    if (id === customerId) return;
    generationRef.current?.abort();
    setContextCustomerId('');
    setTitle('');
    setStrategy(null);
    setBaseline({});
    setPhases([newPhase(1)]);
    setPhaseError('');
    setCustomerId(id);
  };

  // Fast Instant Sports Science Roadmap Generation
  const applyInstantSportsScienceRoadmap = () => {
    if (!contextReady) return;
    if (feasibility.status === 'INFEASIBLE') {
      setShowInfeasibleModal(true);
      return;
    }

    const fallbackProposal = generateSmartRoadmap(
      customerMeta || { _id: customerId, fullName: 'Học viên' },
      latestInbody,
      {
        type: goalType,
        targetValue,
        targetUnit,
        durationWeeks,
        sessionsPerWeek,
        customNotes,
        sessionDurationMinutes,
      }
    );

    setTitle(fallbackProposal.title);
    setStrategy(fallbackProposal.strategy);
    setPhases(fallbackProposal.phases);
    setBaseline(fallbackProposal.baseline);

    const expandedMap: Record<number, boolean> = {};
    fallbackProposal.phases.forEach((_, idx) => {
      expandedMap[idx] = true;
    });
    setExpandedPhases(expandedMap);
    setLoadingAi(false);
  };

  // Generate with cancellation on timeout, customer change and unmount.
  const handleGenerateSmartProposal = async () => {
    if (!Number.isInteger(sessionDurationMinutes) || sessionDurationMinutes < 20 || sessionDurationMinutes > 180) {
      toast.error('Thời lượng mỗi buổi phải từ 20 đến 180 phút.');
      return;
    }
    if (!contextReady || loadingAi) {
      toast.error('Vui lòng chọn học viên và chờ tải đầy đủ hồ sơ trước khi tạo lộ trình.');
      return;
    }

    if (feasibility.status === 'INFEASIBLE') {
      setShowInfeasibleModal(true);
      return;
    }

    setLoadingAi(true);
    const requestText = `Mục tiêu chính: ${goalType}, Số lượng/Chỉ số: ${targetValue} ${targetUnit}, Thời lượng: ${durationWeeks} tuần, Tần suất: ${sessionsPerWeek} buổi/tuần, tối đa ${sessionDurationMinutes} phút/buổi. Ghi chú & Yêu cầu riêng: ${customNotes || 'Tối ưu hóa thể hình và sức khỏe toàn diện'}`;

    const controller = new AbortController();
    generationRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 180_000);
    try {
      const result = await api.post<{
        title: string; strategy: RoadmapStrategyProposal; phases: RoadmapPhaseProposal[];
        baseline: Record<string, number>;
      }>('/api/content-drafts/roadmap', {
        customerId, request: requestText, durationWeeks, sessionsPerWeek, goalType, targetValue, targetUnit, sessionDurationMinutes,
      }, { signal: controller.signal });
      if (controller.signal.aborted || generationRef.current !== controller) return;
      const proposal = result.data;
      if (!proposal?.title || !proposal.strategy || !Array.isArray(proposal.phases) || !proposal.phases.length) {
        throw new ApiError('Phản hồi lộ trình không hợp lệ. Vui lòng thử lại.', 502);
      }
      setTitle(proposal.title);
      setStrategy(proposal.strategy);
      setPhases(proposal.phases);
      setBaseline(proposal.baseline || {});
      setExpandedPhases(Object.fromEntries(proposal.phases.map((_, i) => [i, true])));
      toast.success(result.message || 'AI đã tạo bản nháp lộ trình. PT cần kiểm tra trước khi lưu.');
    } catch (err: unknown) {
      if (generationRef.current !== controller || (controller.signal.aborted && !timedOut)) return;
      const canUseTemplate = timedOut || err instanceof TypeError || (err instanceof ApiError && [408, 502, 503, 504].includes(err.status));
      if (canUseTemplate) {
        applyInstantSportsScienceRoadmap();
        toast.info(`${timedOut ? 'Hết thời gian chờ AI.' : errorMessage(err)} Đã tạo BẢN MẪU theo quy tắc, không phải kết quả AI. PT cần kiểm tra và chỉnh sửa.`);
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      clearTimeout(timer);
      if (generationRef.current === controller) {
        generationRef.current = null;
        setLoadingAi(false);
      }
    }
  };

  // Phase & Week Manipulation Helpers
  const togglePhaseExpand = (index: number) => {
    setExpandedPhases((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const updatePhase = (index: number, change: Partial<RoadmapPhaseProposal>) => {
    setPhases((current) =>
      current.map((phase, pIdx) => (pIdx === index ? { ...phase, ...change } : phase))
    );
  };

  const applyPhaseStructure = (next: RoadmapPhaseProposal[]) => {
    let week = 1;
    const updated = next.map((phase, i) => ({ ...phase, order: i + 1,
      durationWeeks: phase.weeks.length || 1,
      weeks: phase.weeks.map((item) => ({ ...item, week: week++ })),
    }));
    setPhases(updated);
    setStrategy((prev) => prev ? { ...prev, estimatedWeeks: updated.reduce((sum, phase) => sum + phase.durationWeeks, 0) } : null);
  };

  const removePhase = (index: number) => {
    if (phases.length <= 1) {
      toast.error('Lộ trình phải có ít nhất 1 giai đoạn (Phase).');
      return;
    }
    applyPhaseStructure(phases.filter((_, i) => i !== index));
  };

  const addPhase = () => {
    applyPhaseStructure([...phases, { ...newPhase(phases.length + 1), weeks: [{ week: 1, focus: '', sessionTargets: sessionsPerWeek, sessions: [] }] }]);
    setExpandedPhases((prev) => ({ ...prev, [phases.length]: true }));
  };

  const addWeek = (phaseIndex: number) => {
    applyPhaseStructure(phases.map((phase, i) => i === phaseIndex
      ? { ...phase, weeks: [...phase.weeks, { week: 1, focus: '', sessionTargets: sessionsPerWeek, sessions: [] }] }
      : phase));
  };

  const updateWeekFocus = (phaseIndex: number, weekIndex: number, focus: string) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        return {
          ...phase,
          weeks: phase.weeks.map((w, wIdx) => (wIdx === weekIndex ? { ...w, focus } : w)),
        };
      })
    );
  };

  const removeWeek = (phaseIndex: number, weekIndex: number) => {
    if (phases[phaseIndex].weeks.length <= 1) return;
    applyPhaseStructure(phases.map((phase, i) => i === phaseIndex
      ? { ...phase, weeks: phase.weeks.filter((_, w) => w !== weekIndex) }
      : phase));
  };

  const addPhaseGoal = (phaseIndex: number) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        return { ...phase, goals: [...(phase.goals || []), ''] };
      })
    );
  };

  const updatePhaseGoal = (phaseIndex: number, goalIndex: number, text: string) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        const newGoals = [...(phase.goals || [])];
        newGoals[goalIndex] = text;
        return { ...phase, goals: newGoals };
      })
    );
  };

  const removePhaseGoal = (phaseIndex: number, goalIndex: number) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        return { ...phase, goals: (phase.goals || []).filter((_, gIdx) => gIdx !== goalIndex) };
      })
    );
  };

  const updateWeekSessionTargets = (phaseIndex: number, weekIndex: number, sessionTargets: number) => {
    setPhases((current) =>
      current.map((phase, pIdx) => {
        if (pIdx !== phaseIndex) return phase;
        return {
          ...phase,
          weeks: phase.weeks.map((w, wIdx) => (wIdx === weekIndex ? { ...w, sessionTargets } : w)),
        };
      })
    );
  };

  const updateStrategy = (change: Partial<RoadmapStrategyProposal>) => {
    setStrategy((prev) => (prev ? { ...prev, ...change } : null));
  };

  const updateNutrition = (change: Partial<RoadmapNutritionStrategy>) => {
    setStrategy((prev) => (prev ? { ...prev, nutrition: { ...prev.nutrition, ...change } } : null));
  };

  const updateCheckpoint = (index: number, change: Partial<RoadmapEvaluationCheckpoint>) => {
    setStrategy((prev) => {
      if (!prev) return null;
      const cps = [...prev.checkpoints];
      if (cps[index]) {
        cps[index] = { ...cps[index], ...change };
      }
      return { ...prev, checkpoints: cps };
    });
  };

  const addCheckpoint = () => {
    setStrategy((prev) => {
      if (!prev) return null;
      const newCp: RoadmapEvaluationCheckpoint = {
        week: (prev.checkpoints.length + 1) * 4,
        title: `Mốc ${prev.checkpoints.length + 1}: Đánh giá & InBody`,
        description: 'Kiểm tra tỷ lệ cơ/mỡ và tinh chỉnh lộ trình',
      };
      return { ...prev, checkpoints: [...prev.checkpoints, newCp] };
    });
  };

  const removeCheckpoint = (index: number) => {
    setStrategy((prev) => {
      if (!prev) return null;
      return { ...prev, checkpoints: prev.checkpoints.filter((_, idx) => idx !== index) };
    });
  };

  // Submit Handler
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contextReady || loadingAi) {
      toast.error('Vui lòng chờ tải hồ sơ và hoàn tất tạo lộ trình trước khi lưu.');
      return;
    }
    if (feasibility.status === 'INFEASIBLE') {
      setShowInfeasibleModal(true);
      return;
    }
    if (new Set(phases.map((phase) => phase.order)).size !== phases.length) {
      setPhaseError('Thứ tự phase không được trùng.');
      return;
    }
    setPhaseError('');
    setLoading(true);

    try {
      const sanitizedPhases = phases.map((phase) => ({
        ...phase,
        goals: (phase.goals || []).map((g) => g.trim()).filter(Boolean),
        weeks: phase.weeks.map((week) => ({
          week: week.week,
          focus: week.focus.trim(),
          sessionTargets: week.sessionTargets || sessionsPerWeek,
          sessions: [],
        })),
      }));

      const payload = {
        customerId,
        title,
        baseline: baseline || {},
        strategy: strategy || {},
        phases: sanitizedPhases,
      };

      if (initialData?._id) {
        const { customerId: _customerId, ...updatePayload } = payload;
        const result = await api.patch<Roadmap>(`/api/roadmaps/${initialData._id}`, updatePayload);
        toast.success(result.message || 'Cập nhật roadmap thành công.');
      } else {
        const result = await api.post<Roadmap>('/api/roadmaps', payload);
        toast.success(result.message || 'Tạo roadmap thành công.');
      }
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <form className="panel p-3.5 sm:p-6 flex flex-col gap-4 sm:gap-5 max-w-full" onSubmit={submit}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Sparkles size={22} color="var(--secondary-color)" /> {initialData ? 'Chỉnh sửa Lộ trình Roadmap' : 'Đề xuất Lộ trình & Mục tiêu Toàn diện'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>
            Hệ thống kết hợp chỉ số InBody, hồ sơ học viên và mục tiêu của PT để tự động sinh lộ trình chi tiết theo từng giai đoạn.
          </p>
        </div>
      </div>

      {strategy?.generationSource && (
        <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <strong>{strategy.generationSource === 'AI' ? 'Bản nháp do AI tạo — cần PT duyệt' : 'Bản mẫu theo quy tắc — không phải kết quả AI'}</strong>
          {strategy.assumptions?.map((note, i) => <p key={i} className="mt-1">{note}</p>)}
        </div>
      )}

      {strategy?.sessionBudget && (
        <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          Phân bổ mỗi buổi: khởi động {strategy.sessionBudget.warmupMinutes} phút · kháng lực {strategy.sessionBudget.strengthMinutes} phút · cardio {strategy.sessionBudget.cardioMinutes} phút · hồi phục {strategy.sessionBudget.cooldownMinutes} phút.
        </p>
      )}
      {/* 1. Customer Selector & Quick Baseline Card */}
      <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 max-w-full">
        <div className="form-grid" style={{ marginBottom: '12px' }}>
          <CustomerSelect
            label="Học viên / Khách hàng"
            name="customerId"
            value={customerId}
            onChange={changeCustomer}
            disabled={loadingAi || loading || Boolean(initialData)}
            required
            placeholder="Chọn hoặc tìm học viên..."
          />
          <label className="field">
            <span style={{ fontWeight: 700 }}>Tên Lộ trình</span>
            <input
              aria-label="Tên roadmap"
              placeholder="Ví dụ: Lộ trình Giảm mỡ & Tái cấu trúc 12 tuần..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
        </div>

        {/* Snapshot info of the selected customer & InBody */}
        {customerId && (
          <div className="mt-3 p-3 sm:p-4 bg-white rounded-lg border border-slate-200 text-sm max-w-full">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Scale size={16} color="var(--secondary-color)" /> Hồ sơ Thể trạng & Dữ liệu InBody gần nhất:
              </span>
              {loadingContext && <span style={{ color: 'var(--secondary-color)' }}>Đang tải dữ liệu...</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Cân nặng</div>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{latestInbody?.weight || customerMeta?.initialWeight || 'Chưa đo'} kg</strong>
              </div>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>% Mỡ cơ thể</div>
                <strong style={{ fontSize: '1rem', color: latestInbody?.bodyFatPercentage && latestInbody.bodyFatPercentage > 25 ? '#dc2626' : '#16a34a' }}>
                  {latestInbody?.bodyFatPercentage ? `${latestInbody.bodyFatPercentage}%` : 'Chưa có'}
                </strong>
              </div>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Khối lượng Cơ (SMM)</div>
                <strong style={{ fontSize: '1rem', color: '#0284c7' }}>{latestInbody?.muscleMass ? `${latestInbody.muscleMass} kg` : 'Chưa có'}</strong>
              </div>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Mỡ nội tạng / Điểm</div>
                <strong style={{ fontSize: '1rem', color: '#d97706' }}>Level {latestInbody?.visceralFatLevel || '--'} • {latestInbody?.inbodyScore || '--'}đ</strong>
              </div>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>BMR / TDEE cơ bản</div>
                <strong style={{ fontSize: '1rem', color: '#475569' }}>{latestInbody?.bmr || 1600} kcal</strong>
              </div>
            </div>

            {customerMeta?.medicalNotes && (
              <div style={{ marginTop: '8px', color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} /> <strong>Lưu ý bệnh lý / Chấn thương:</strong> {customerMeta.medicalNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Goal & Roadmap Parameter Controls */}
      <div className="p-3.5 sm:p-5 rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white max-w-full">
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 14px' }}>
          <Target size={18} /> Thiết lập Thông số Mục tiêu
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          <div>
            <CustomSelect<RoadmapGoalType>
              label="Mục tiêu chính"
              value={goalType}
              onChange={(val) => setGoalType(val)}
              options={[
                { value: 'FAT_LOSS', label: '🔥 Giảm mỡ & Giữ cơ (Fat Loss)' },
                { value: 'WEIGHT_LOSS', label: '📉 Giảm cân toàn thân (Weight Loss)' },
                { value: 'MUSCLE_GAIN', label: '💪 Tăng cơ nạc (Muscle Gain / Bulking)' },
                { value: 'RECOMPOSITION', label: '⚡ Tái cấu trúc vóc dáng (Recomposition)' },
                { value: 'FITNESS', label: '🏃 Cải thiện Thể lực & Sức bền (Fitness)' },
                { value: 'STRENGTH', label: '🏋️ Tăng Sức mạnh nền tảng (Strength)' },
              ]}
            />
          </div>

          <div className="flex flex-col">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Chỉ số mục tiêu
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                aria-label="Chỉ số mục tiêu"
                step="0.5"
                min="0.5"
                max="50"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                required
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: '42px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  padding: '0 12px',
                  background: '#ffffff',
                }}
              />
              <div style={{ width: '95px', flexShrink: 0 }}>
                <CustomSelect
                  value={targetUnit}
                  onChange={(val) => setTargetUnit(val)}
                  options={[
                    { value: 'kg', label: 'kg' },
                    { value: '% mỡ', label: '% mỡ' },
                    { value: 'cm eo', label: 'cm eo' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <CustomSelect<number>
              label="Thời gian dự kiến (Tuần)"
              value={durationWeeks}
              onChange={(val) => setDurationWeeks(val)}
              options={[
                { value: 4, label: '4 tuần (1 tháng - Cấp tốc)' },
                { value: 8, label: '8 tuần (2 tháng - Cơ bản)' },
                { value: 12, label: '12 tuần (3 tháng - Chuẩn khuyến nghị)' },
                { value: 16, label: '16 tuần (4 tháng - Chuyên sâu)' },
                { value: 24, label: '24 tuần (6 tháng - Chuyển hóa toàn diện)' },
              ]}
            />
          </div>

          <div>
            <CustomSelect<number>
              label="Tần suất tập luyện"
              value={sessionsPerWeek}
              onChange={(val) => setSessionsPerWeek(val)}
              options={[
                { value: 3, label: '3 buổi / tuần (Full Body Split)' },
                { value: 4, label: '4 buổi / tuần (Upper / Lower)' },
                { value: 5, label: '5 buổi / tuần (Push / Pull / Legs)' },
                { value: 6, label: '6 buổi / tuần (Vận động viên)' },
              ]}
            />
          </div>
        </div>

        {/* Realtime AI Feasibility Advisory Card */}
        {feasibility.status === 'INFEASIBLE' ? (
          <div
            data-testid="feasibility-card"
            style={{
              marginTop: '16px',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '1.5px solid #fca5a5',
              background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '240px', flex: '1 1 auto' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} color="#ef4444" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#991b1b' }}>
                    AI Cảnh Báo: Mục Tiêu Bất Khả Thi
                  </strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#ef4444',
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    BẤT KHẢ THI
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#b91c1c', fontWeight: 500 }}>
                  {feasibility.headline}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfeasibleModal(true)}
              style={{
                background: '#ffffff',
                color: '#dc2626',
                border: '1.5px solid #fca5a5',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <AlertCircle size={15} />
              Xem chi tiết cảnh báo & gợi ý khắc phục →
            </button>
          </div>
        ) : (
          <div
            data-testid="feasibility-card"
            style={{
              marginTop: '16px',
              borderRadius: '12px',
              padding: '14px 16px',
              border:
                feasibility.status === 'CHALLENGING'
                  ? '1.5px solid #f59e0b'
                  : '1.5px solid #10b981',
              background:
                feasibility.status === 'CHALLENGING'
                  ? 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)'
                  : 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {feasibility.status === 'CHALLENGING' ? (
                  <AlertCircle size={20} color="#f59e0b" />
                ) : (
                  <CheckCircle2 size={20} color="#10b981" />
                )}
                <strong
                  style={{
                    fontSize: '0.92rem',
                    color:
                      feasibility.status === 'CHALLENGING'
                        ? '#92400e'
                        : '#065f46',
                  }}
                >
                  {feasibility.status === 'CHALLENGING'
                    ? 'AI TƯ VẤN: MỤC TIÊU KHÁ THÁCH THỨC'
                    : 'AI TƯ VẤN: MỤC TIÊU HOÀN TOÀN KHẢ THI'}
                </strong>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: feasibility.badgeColor,
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {feasibility.badgeLabel}
              </span>
            </div>

            <p
              style={{
                margin: '0 0 10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color:
                  feasibility.status === 'CHALLENGING'
                    ? '#b45309'
                    : '#047857',
              }}
            >
              {feasibility.headline}
            </p>

            {/* Reasons List */}
            <ul style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {feasibility.reasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>

            {/* Quick-Fix One-Click Action Buttons for Challenging */}
            {(feasibility.recommendedWeeks || feasibility.recommendedTarget) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px dashed rgba(0,0,0,0.1)',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                  💡 Gợi ý điều chỉnh 1-chạm từ AI:
                </span>

                {feasibility.recommendedWeeks && (
                  <button
                    type="button"
                    onClick={() => setDurationWeeks(feasibility.recommendedWeeks!)}
                    style={{
                      background: '#ffffff',
                      color: '#0284c7',
                      border: '1.5px solid #0284c7',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Áp dụng thời lượng an toàn theo khuyến nghị của AI"
                  >
                    <Clock size={13} /> Giãn thời gian: {feasibility.recommendedWeeks} tuần
                  </button>
                )}

                {feasibility.recommendedTarget && (
                  <button
                    type="button"
                    onClick={() => setTargetValue(feasibility.recommendedTarget!)}
                    style={{
                      background: '#ffffff',
                      color: '#059669',
                      border: '1.5px solid #059669',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Áp dụng mức mục tiêu khả thi theo thời gian hiện tại"
                  >
                    <Target size={13} /> Đặt mục tiêu khả thi: {feasibility.recommendedTarget} {targetUnit}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <label className="field">
          <span>Thời lượng tối đa mỗi buổi (phút)</span>
          <input type="number" min={20} max={180} step={5} required placeholder="Ví dụ: 60"
            value={sessionDurationMinutes} disabled={loadingAi}
            onChange={(event) => setSessionDurationMinutes(Number(event.target.value))}
            className="rounded-lg border border-slate-300 p-2 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-50" />
        </label>

        <label className="field" style={{ marginTop: '12px' }}>
          <span style={{ fontWeight: 700 }}>Ghi chú cá nhân hóa</span>
          <input
            placeholder="Ví dụ: Dân văn phòng ngồi nhiều đau lưng dưới, ưu tiên siết mỡ đùi và eo, tập sáng..."
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
          />
        </label>

        <div className="mt-4 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            className="button button-primary w-full sm:w-auto justify-center"
            onClick={handleGenerateSmartProposal}
            disabled={loadingAi || loading || !contextReady}
            style={{
              background:
                feasibility.status === 'INFEASIBLE'
                  ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #003b70 100%)',
              padding: '10px 22px',
              fontSize: '0.95rem',
              fontWeight: 800,
              boxShadow:
                feasibility.status === 'INFEASIBLE'
                  ? '0 4px 14px rgba(220,38,38,0.25)'
                  : '0 4px 14px rgba(2,132,199,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: loadingAi ? 'not-allowed' : 'pointer',
              opacity: loadingAi ? 0.75 : 1,
            }}
          >
            {feasibility.status === 'INFEASIBLE' ? (
              <AlertTriangle size={18} />
            ) : (
              <Sparkles size={18} />
            )}
            {loadingAi
              ? 'AI đang suy nghĩ, phân tích...'
              : feasibility.status === 'INFEASIBLE'
              ? 'Xem cảnh báo mục tiêu bất khả thi'
              : 'Tạo Lộ trình với AI'}
          </button>
        </div>

        {/* AI Detailed Loading Progress Overlay Card */}
        {loadingAi && (
          <div
            style={{
              marginTop: '16px',
              padding: '18px 20px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: '12px',
              border: '1px solid #334155',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              display: 'grid',
              gap: '14px',
            }}
          >
            {/* Header with timer and fast-skip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  <Loader2 size={18} className="spin" />
                </div>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#f8fafc', display: 'block' }}>
                    Đang xử lý & phân kỳ lộ trình bằng AI
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Kết hợp hồ sơ {customerMeta?.fullName || 'học viên'}, dữ liệu InBody và mục tiêu PT
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> {aiElapsedSeconds}s
                </span>
                <button
                  type="button"
                  onClick={applyInstantSportsScienceRoadmap}
                  style={{
                    background: '#eab308',
                    color: '#000000',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Bỏ qua chờ đợi, dùng ngay bộ tạo chuẩn Khoa học Thể thao"
                >
                  <Zap size={13} /> Lấy ngay (0.01s)
                </button>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${aiProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* 4 Steps Indicator */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '0.76rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: aiStep >= 1 ? '#38bdf8' : '#64748b', fontWeight: aiStep === 1 ? 700 : 500 }}>
                {aiStep > 1 ? <CheckCircle2 size={14} color="#4ade80" /> : <Loader2 size={14} className="spin" />}
                <span>1. Đọc InBody & Hồ sơ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: aiStep >= 2 ? '#38bdf8' : '#64748b', fontWeight: aiStep === 2 ? 700 : 500 }}>
                {aiStep > 2 ? <CheckCircle2 size={14} color="#4ade80" /> : aiStep === 2 ? <Loader2 size={14} className="spin" /> : <span style={{ width: '14px', textAlign: 'center' }}>•</span>}
                <span>2. Gửi LLM & Suy luận</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: aiStep >= 3 ? '#38bdf8' : '#64748b', fontWeight: aiStep === 3 ? 700 : 500 }}>
                {aiStep > 3 ? <CheckCircle2 size={14} color="#4ade80" /> : aiStep === 3 ? <Loader2 size={14} className="spin" /> : <span style={{ width: '14px', textAlign: 'center' }}>•</span>}
                <span>3. Tính Calo & Cardio</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: aiStep >= 4 ? '#38bdf8' : '#64748b', fontWeight: aiStep === 4 ? 700 : 500 }}>
                {aiStep > 4 ? <CheckCircle2 size={14} color="#4ade80" /> : aiStep === 4 ? <Loader2 size={14} className="spin" /> : <span style={{ width: '14px', textAlign: 'center' }}>•</span>}
                <span>4. Dựng Phase & Tuần</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Comprehensive Strategy Overview (Editable) */}
      {strategy && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-6 shadow-xs flex flex-col gap-4 sm:gap-5 max-w-full overflow-hidden">
          {/* Header với Tiêu đề & Cấu hình Thời lượng/Tần suất đẹp mắt */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-primary flex items-center gap-2 m-0">
                <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Chiến lược Huấn luyện & Dinh dưỡng</span>
              </h3>
              <p className="m-0 mt-1 text-xs text-slate-500 leading-relaxed break-words">
                Định hướng phương pháp huấn luyện, phân chia lịch tập, cardio, macro dinh dưỡng và các mốc kiểm tra.
              </p>
            </div>

            {/* Duration & Sessions bar: responsive flex wrap */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-50 p-2.5 sm:px-3.5 sm:py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm self-start sm:self-auto shrink-0 max-w-full">
              <div className="flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="text-slate-600 font-semibold text-xs whitespace-nowrap">Thời lượng:</span>
                <input
                  aria-label="Số tuần ước tính"
                  type="number"
                  min="1"
                  max="52"
                  value={strategy.estimatedWeeks || durationWeeks}
                  onChange={(e) => updateStrategy({ estimatedWeeks: Number(e.target.value) })}
                  className="w-12 px-1.5 py-1 text-xs font-bold border border-slate-300 rounded-md text-center bg-white text-slate-900"
                />
                <span className="text-slate-500 font-semibold text-xs whitespace-nowrap">Tuần</span>
              </div>

              <span className="hidden sm:inline text-slate-300">|</span>

              <div className="flex items-center gap-1.5 shrink-0">
                <Dumbbell className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="text-slate-600 font-semibold text-xs whitespace-nowrap">Tần suất:</span>
                <input
                  aria-label="Số buổi mỗi tuần"
                  type="number"
                  min="1"
                  max="7"
                  value={strategy.sessionsPerWeek || sessionsPerWeek}
                  onChange={(e) => updateStrategy({ sessionsPerWeek: Number(e.target.value) })}
                  className="w-10 px-1.5 py-1 text-xs font-bold border border-slate-300 rounded-md text-center bg-white text-slate-900"
                />
                <span className="text-slate-500 font-semibold text-xs whitespace-nowrap">Buổi / Tuần</span>
              </div>
            </div>
          </div>

          {/* BỐ CỤC 2 CỘT RỘNG RÃI VÀ THOÁNG MẮT (Training + Cardio vs Nutrition) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* CỘT 1: HUẤN LUYỆN & CARDIO (TRAINING & CARDIO) */}
            <div className="bg-slate-50 p-3.5 sm:p-5 rounded-xl border border-slate-200 flex flex-col gap-3.5 sm:gap-4 max-w-full overflow-hidden">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(2, 132, 199, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Dumbbell size={16} color="var(--secondary-color)" />
                </div>
                Phương pháp tập & Lịch phân chia
              </div>

              {/* Training Method */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phương pháp tập luyện (Training Method):</span>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 400 }}>Tùy chỉnh theo học viên</span>
                </label>
                <textarea
                  aria-label="Phương pháp tập luyện"
                  rows={3}
                  value={strategy.trainingMethod || ''}
                  onChange={(e) => updateStrategy({ trainingMethod: e.target.value })}
                  placeholder="Ví dụ: Progressive Overload (Tăng tiến quá tải) kết hợp Hypertrophy..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: '#1e293b',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Training Split */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700 }}>
                  Lịch tập phân chia (Split):
                </label>
                <input
                  aria-label="Lịch tập phân chia"
                  value={strategy.trainingSplit || ''}
                  onChange={(e) => updateStrategy({ trainingSplit: e.target.value })}
                  placeholder="Ví dụ: Upper / Lower / Full Body luân phiên..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.88rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: '#1e293b',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Cardio Protocol */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartPulse size={15} color="#ef4444" />
                  <span>Chiến lược Cardio & Tim mạch (Cardio Protocol):</span>
                </label>
                <textarea
                  aria-label="Chiến lược cardio"
                  rows={4}
                  value={strategy.cardioProtocol || ''}
                  onChange={(e) => updateStrategy({ cardioProtocol: e.target.value })}
                  placeholder="Ví dụ: Kết hợp Cardio Zone 2 (30-45 phút, 3-4 buổi/tuần) để tối ưu đốt mỡ..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: '#1e293b',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* CỘT 2: DINH DƯỠNG & MACROS (NUTRITION & MACROS) */}
            <div className="bg-slate-50 p-3.5 sm:p-5 rounded-xl border border-slate-200 flex flex-col gap-3.5 sm:gap-4 max-w-full overflow-hidden">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(22, 163, 74, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Utensils size={16} color="#16a34a" />
                </div>
                Mục tiêu Dinh dưỡng & Calo hàng ngày
              </div>

              {/* Calo & Deficit/Surplus Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Flame size={14} color="#f97316" /> Calo mục tiêu (kcal/ngày)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      aria-label="Calo mục tiêu"
                      type="number"
                      value={strategy.nutrition?.targetCalories || 0}
                      onChange={(e) => updateNutrition({ targetCalories: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>kcal</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Scale size={14} color="#8b5cf6" /> Thâm hụt / Thặng dư
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      aria-label="Thâm hụt hoặc thặng dư calo"
                      type="number"
                      value={strategy.nutrition?.calorieDeficitOrSurplus || 0}
                      onChange={(e) => updateNutrition({ calorieDeficitOrSurplus: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: (strategy.nutrition?.calorieDeficitOrSurplus || 0) < 0 ? '#dc2626' : '#16a34a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>kcal</span>
                  </div>
                </div>
              </div>

              {/* 3 Macros: Đạm, Carb, Fat */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: '0.74rem', color: '#991b1b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🥩 Đạm (Protein)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      aria-label="Protein grams"
                      type="number"
                      value={strategy.nutrition?.proteinGrams || 0}
                      onChange={(e) => updateNutrition({ proteinGrams: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        textAlign: 'center',
                        background: '#ffffff',
                        color: '#991b1b',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>g</span>
                  </div>
                </div>

                <div style={{ background: '#fffbeb', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '0.74rem', color: '#92400e', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🍚 Tinh bột (Carb)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      aria-label="Carb grams"
                      type="number"
                      value={strategy.nutrition?.carbsGrams || 0}
                      onChange={(e) => updateNutrition({ carbsGrams: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        border: '1px solid #fcd34d',
                        borderRadius: '6px',
                        textAlign: 'center',
                        background: '#ffffff',
                        color: '#92400e',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>g</span>
                  </div>
                </div>

                <div style={{ background: '#f5f3ff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                  <span style={{ fontSize: '0.74rem', color: '#6b21a8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🥑 Chất béo (Fat)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      aria-label="Fat grams"
                      type="number"
                      value={strategy.nutrition?.fatGrams || 0}
                      onChange={(e) => updateNutrition({ fatGrams: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        border: '1px solid #c4b5fd',
                        borderRadius: '6px',
                        textAlign: 'center',
                        background: '#ffffff',
                        color: '#6b21a8',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 600 }}>g</span>
                  </div>
                </div>
              </div>

              {/* Nước uống */}
              <div className="bg-sky-50 px-3 py-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-sky-200 flex flex-wrap items-center justify-between gap-2 max-w-full">
                <span className="text-xs sm:text-[0.82rem] text-sky-800 font-bold inline-flex items-center gap-1.5 shrink-0">
                  <Droplets size={15} className="text-sky-600 shrink-0" />
                  <span>Lượng nước tối thiểu:</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    aria-label="Lượng nước"
                    type="number"
                    step="0.1"
                    value={strategy.nutrition?.waterLiters || 2.5}
                    onChange={(e) => updateNutrition({ waterLiters: Number(e.target.value) })}
                    className="w-16 px-2 py-1 text-sm font-bold border border-sky-300 rounded-md text-center bg-white text-sky-800 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                  />
                  <span className="text-xs font-semibold text-sky-800 whitespace-nowrap">Lít / ngày</span>
                </div>
              </div>

              {/* Lời khuyên dinh dưỡng */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700 }}>
                  Lời khuyên & Định hướng Dinh dưỡng:
                </label>
                <textarea
                  aria-label="Lời khuyên dinh dưỡng"
                  rows={3}
                  value={strategy.nutrition?.advice || ''}
                  onChange={(e) => updateNutrition({ advice: e.target.value })}
                  placeholder="Ví dụ: Tập trung vào thực phẩm toàn phần, giàu protein, chất xơ. Hạn chế đồ uống có đường..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: '#1e293b',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* HÀNG 2: CÁC MỐC ĐÁNH GIÁ & CHECKPOINTS (FULL WIDTH RỘNG RÃI) */}
          <div className="bg-slate-50 p-3.5 sm:p-5 rounded-xl border border-slate-200 flex flex-col gap-4 max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-full">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="m-0 text-sm sm:text-base font-extrabold text-slate-900">
                    Các mốc Đánh giá & Đo lường Thể chất
                  </h4>
                  <span className="text-xs text-slate-500">
                    Các cột mốc kiểm tra InBody, chụp ảnh vóc dáng và đánh giá mức độ thích nghi định kỳ
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={addCheckpoint}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm mốc kiểm tra
              </button>
            </div>

            {/* Grid các Checkpoint Card độc lập - Rộng rãi, KHÔNG tràn border trên mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0 max-w-full">
              {(strategy.checkpoints || []).map((cp, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-2.5 min-w-0 max-w-full overflow-hidden"
                >
                  {/* Row 1 on Desktop (1-line) vs Mobile (Split Badge/Delete on top, Title below) */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full">
                    {/* Top Row on mobile: Badge Tuần + Delete button */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                      <div className="inline-flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 shrink-0">
                        <span className="text-xs font-bold text-purple-700">Tuần</span>
                        <input
                          aria-label={`Tuần mốc ${idx + 1}`}
                          type="number"
                          min="1"
                          max="52"
                          value={cp.week}
                          onChange={(e) => updateCheckpoint(idx, { week: Number(e.target.value) })}
                          className="w-10 px-1 py-0.5 text-xs font-extrabold text-purple-700 border border-purple-300 rounded text-center bg-white"
                        />
                      </div>

                      {/* Mobile delete button */}
                      <button
                        type="button"
                        onClick={() => removeCheckpoint(idx)}
                        className="sm:hidden text-slate-400 hover:text-rose-500 p-1 rounded cursor-pointer transition-colors"
                        title="Xóa mốc này"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    </div>

                    {/* Title input: full width on mobile, flex-1 min-w-0 on desktop */}
                    <input
                      aria-label={`Tiêu đề mốc ${idx + 1}`}
                      value={cp.title}
                      onChange={(e) => updateCheckpoint(idx, { title: e.target.value })}
                      placeholder="Ví dụ: Mốc 1: Đánh giá thích nghi..."
                      className="flex-1 min-w-0 w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-hidden"
                    />

                    {/* Desktop delete button */}
                    <button
                      type="button"
                      onClick={() => removeCheckpoint(idx)}
                      className="hidden sm:flex text-slate-400 hover:text-rose-500 p-1 rounded cursor-pointer transition-colors shrink-0"
                      title="Xóa mốc này"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>

                  {/* Row 2: Textarea mô tả */}
                  <textarea
                    aria-label={`Mô tả mốc ${idx + 1}`}
                    rows={2}
                    value={cp.description}
                    onChange={(e) => updateCheckpoint(idx, { description: e.target.value })}
                    placeholder="Mô tả chi tiết nội dung kiểm tra, đo lường InBody, điều chỉnh kế hoạch..."
                    className="w-full min-w-0 p-2 sm:p-2.5 text-xs sm:text-[0.82rem] leading-relaxed border border-slate-300 rounded-lg bg-white text-slate-700 placeholder:text-slate-400 focus:border-purple-500 focus:outline-hidden resize-y box-border"
                  />
                </div>
              ))}

              {(!strategy.checkpoints || strategy.checkpoints.length === 0) && (
                <div className="col-span-full text-xs text-slate-400 italic text-center p-4 bg-white rounded-lg border border-dashed border-slate-300">
                  Chưa có mốc đánh giá định kỳ nào. Bấm &quot;Thêm mốc kiểm tra&quot; để thiết lập các cột mốc đo lường InBody.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Multi-Phase Breakdown (Phases -> Weeks & Goals) */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <h3 className="text-base sm:text-lg font-extrabold text-primary flex items-center gap-2 m-0">
            <Layers className="w-5 h-5 text-secondary shrink-0" />
            <span>Lộ trình Phân kỳ ({phases.length} Phase • {phases.reduce((acc, p) => acc + (p.durationWeeks || 0), 0)} Tuần)</span>
          </h3>
          <button
            type="button"
            className="button button-secondary text-xs self-start sm:self-auto flex items-center gap-1.5 shrink-0"
            onClick={addPhase}
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Phase
          </button>
        </div>

        {phases.map((phase, phaseIndex) => {
          const isExpanded = Boolean(expandedPhases[phaseIndex]);
          const cleanPhaseName = (phase.name || `Giai đoạn ${phase.order}`).replace(
            new RegExp(`^Phase\\s*${phase.order}\\s*[:\\-]\\s*`, 'i'),
            ''
          );

          return (
            <div
              key={phaseIndex}
              className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden w-full"
            >
              {/* Phase Card Header */}
              <div
                className={`p-3 sm:px-4 sm:py-3.5 cursor-pointer select-none transition-colors border-b ${isExpanded
                  ? 'bg-slate-100/90 border-slate-200'
                  : 'bg-slate-50/70 border-transparent hover:bg-slate-100/60'
                  }`}
                onClick={() => togglePhaseExpand(phaseIndex)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  {/* Left Block on desktop / Split Meta Row & Title on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                    {/* Top row on mobile: Badge + Duration pill + Trash + Chevron */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                      <span className="bg-primary text-white font-extrabold text-xs px-2.5 py-1 rounded-md shrink-0 whitespace-nowrap shadow-2xs">
                        Phase {phase.order}
                      </span>

                      {/* Mobile-only duration badge, trash, and chevron */}
                      <div className="flex items-center gap-2 sm:hidden shrink-0">
                        <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                          {phase.durationWeeks} tuần • {phase.weeks?.length || 0} tuần chi tiết
                        </span>
                        <button
                          type="button"
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer transition-colors shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhase(phaseIndex);
                          }}
                          title="Xóa Phase này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-slate-500 shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>

                    {/* Phase Title - full width on mobile, inline on desktop */}
                    <strong className="text-sm sm:text-[0.92rem] font-bold text-slate-900 leading-snug break-words min-w-0">
                      {cleanPhaseName}
                    </strong>
                  </div>

                  {/* Right Block (Desktop only: duration + trash + chevron) */}
                  <div className="hidden sm:flex items-center gap-2.5 shrink-0">
                    <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
                      {phase.durationWeeks} tuần • {phase.weeks?.length || 0} tuần chi tiết
                    </span>
                    <button
                      type="button"
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer transition-colors shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhase(phaseIndex);
                      }}
                      title="Xóa Phase này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-slate-500 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase Card Body */}
              {isExpanded && (
                <div className="p-3.5 sm:p-5 flex flex-col gap-4 bg-slate-50/50 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_140px] gap-3">
                    <label className="field">
                      <span className="font-bold text-xs text-slate-700">Thứ tự</span>
                      <input
                        aria-label={`Thứ tự phase ${phaseIndex + 1}`}
                        type="number"
                        min="1"
                        value={phase.order}
                        onChange={(e) => updatePhase(phaseIndex, { order: Number(e.target.value) })}
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="font-bold text-xs text-slate-700">Tên giai đoạn (Phase Name)</span>
                      <input
                        aria-label={`Tên phase ${phaseIndex + 1}`}
                        placeholder="Ví dụ: Giai đoạn 1: Thích nghi & Chuẩn hóa Kỹ thuật..."
                        value={phase.name}
                        onChange={(e) => updatePhase(phaseIndex, { name: e.target.value })}
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="font-bold text-xs text-slate-700">Thời lượng (Tuần)</span>
                      <input
                        aria-label={`Thời lượng phase ${phaseIndex + 1}`}
                        type="number"
                        min="1"
                        value={phase.durationWeeks}
                        onChange={(e) => updatePhase(phaseIndex, { durationWeeks: Number(e.target.value) })}
                        required
                      />
                    </label>
                  </div>

                  {/* Phase Goals List (Editable) */}
                  <div className="bg-white p-3 sm:px-4 sm:py-3.5 rounded-lg border border-slate-200 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs sm:text-sm text-primary flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <span>Mục tiêu giai đoạn Phase {phase.order}:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => addPhaseGoal(phaseIndex)}
                        className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Thêm mục tiêu
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {(phase.goals || []).map((goal, gIdx) => (
                        <div key={gIdx} className="flex items-center gap-2">
                          <input
                            aria-label={`Mục tiêu ${gIdx + 1} phase ${phase.order}`}
                            value={goal}
                            onChange={(e) => updatePhaseGoal(phaseIndex, gIdx, e.target.value)}
                            placeholder="Ví dụ: Chuẩn hóa kỹ thuật Squat & Deadlift..."
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-md bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => removePhaseGoal(phaseIndex, gIdx)}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition-colors shrink-0"
                            title="Xóa mục tiêu này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(!phase.goals || phase.goals.length === 0) && (
                        <div className="text-xs text-slate-400 italic py-1">
                          Chưa có mục tiêu cho giai đoạn này. Bấm &quot;Thêm mục tiêu&quot; để thiết lập.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Weeks list inside Phase */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-700">
                        Chi tiết các tuần huấn luyện trong Phase {phase.order}:
                      </span>
                      <button
                        type="button"
                        className="button button-secondary text-xs self-start sm:self-auto flex items-center gap-1.5"
                        onClick={() => addWeek(phaseIndex)}
                      >
                        <Plus className="w-3 h-3" /> Thêm tuần vào phase {phaseIndex + 1}
                      </button>
                    </div>

                    {phase.weeks.map((week, weekIndex) => (
                      <div
                        key={weekIndex}
                        className="bg-white p-3 sm:px-3.5 sm:py-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3"
                      >
                        {/* Top / Left: Week badge & Focus input */}
                        <div className="flex items-center gap-2 flex-1 min-w-0 w-full">
                          <span className="bg-sky-600 text-white font-extrabold text-xs px-2.5 py-1 rounded shrink-0 whitespace-nowrap">
                            Tuần {week.week}
                          </span>
                          <input
                            aria-label={`Trọng tâm tuần ${week.week} phase ${phaseIndex + 1}`}
                            placeholder={`Trọng tâm & mục tiêu huấn luyện tuần ${week.week}...`}
                            value={week.focus}
                            onChange={(e) => updateWeekFocus(phaseIndex, weekIndex, e.target.value)}
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-md bg-white focus:border-primary focus:outline-hidden"
                            required
                          />
                        </div>

                        {/* Bottom / Right: Tần suất select + Delete button */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500 whitespace-nowrap">Tần suất:</span>
                            <div style={{ width: '130px' }}>
                              <CustomSelect<number>
                                size="sm"
                                ariaLabel={`Tần suất tuần ${week.week}`}
                                value={week.sessionTargets || sessionsPerWeek}
                                onChange={(val) => updateWeekSessionTargets(phaseIndex, weekIndex, val)}
                                options={[
                                  { value: 2, label: '2 buổi/tuần' },
                                  { value: 3, label: '3 buổi/tuần' },
                                  { value: 4, label: '4 buổi/tuần' },
                                  { value: 5, label: '5 buổi/tuần' },
                                  { value: 6, label: '6 buổi/tuần' },
                                ]}
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition-colors shrink-0"
                            onClick={() => removeWeek(phaseIndex, weekIndex)}
                            title="Xóa tuần này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {phaseError && <p className="field-error" role="alert">{phaseError}</p>}

      {/* Action Footer */}
      <div className="modal-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <button className="button button-secondary" type="button" onClick={onCancel}>
          Hủy
        </button>
        <button className="button button-secondary" type="button" onClick={addPhase}>
          Thêm phase
        </button>
        <button
          className="button button-primary"
          type="submit"
          disabled={loading || loadingAi || !contextReady}
          style={{ minWidth: '140px', fontWeight: 800 }}
        >
          {loading ? 'Đang lưu...' : initialData ? 'Cập nhật Roadmap' : 'Lưu roadmap'}
        </button>
      </div>
    </form>

    {/* Popup Cảnh Báo Mục Tiêu Bất Khả Thi */}
    <InfeasibleGoalModal
      open={showInfeasibleModal}
      onClose={() => setShowInfeasibleModal(false)}
      feasibility={feasibility}
      targetUnit={targetUnit}
      currentWeeks={durationWeeks}
      currentTarget={targetValue}
      onApplyRecommendedWeeks={handleApplyRecommendedWeeks}
      onApplyRecommendedTarget={handleApplyRecommendedTarget}
    />
    </>
  );
}
