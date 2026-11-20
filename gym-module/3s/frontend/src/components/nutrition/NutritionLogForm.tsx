import { useEffect, useState, type FormEvent } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Dumbbell,
  Flame,
  Plus,
  RefreshCw,
  Salad,
  Trash2,
  Utensils,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';

interface NutritionLogEntry {
  _id: string;
  customerId: string;
  ptId?: string;
  loggedAt: string;
  type: 'FOOD' | 'ACTIVITY';
  name: string;
  calories: number;
  durationMinutes?: number;
  macros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  notes?: string;
  createdAt?: string;
}

interface NutritionLogFormProps {
  customerId: string;
  onSaved: () => void;
}

export default function NutritionLogForm({ customerId, onSaved }: NutritionLogFormProps) {
  const toast = useToast();
  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    loggedAt: todayStr,
    type: 'FOOD' as 'FOOD' | 'ACTIVITY',
    name: '',
    calories: '',
    durationMinutes: '',
    protein: '',
    carbs: '',
    fat: '',
  });

  const [logs, setLogs] = useState<NutritionLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load logs for this customer
  const loadLogs = async () => {
    if (!customerId) return;
    try {
      setLoadingLogs(true);
      const res = await api.get<NutritionLogEntry[]>(`/api/nutrition/logs?customerId=${customerId}&page=1&limit=30`);
      setLogs(res.data || []);
    } catch (err) {
      // silently handle or toast
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [customerId]);

  const handleQuickPreset = (presetName: string, defaultKcal: number, defaultMacros?: { p?: number; c?: number; f?: number }) => {
    setForm((prev) => ({
      ...prev,
      name: presetName,
      calories: String(defaultKcal),
      protein: defaultMacros?.p ? String(defaultMacros.p) : prev.protein,
      carbs: defaultMacros?.c ? String(defaultMacros.c) : prev.carbs,
      fat: defaultMacros?.f ? String(defaultMacros.f) : prev.fat,
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!customerId) {
      toast.error('Vui lòng chọn học viên trước khi lưu nhật ký.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên món ăn hoặc hoạt động.');
      return;
    }
    if (!form.calories || Number(form.calories) <= 0) {
      toast.error('Vui lòng nhập số calories hợp lệ.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        customerId,
        loggedAt: form.loggedAt ? new Date(form.loggedAt).toISOString() : new Date().toISOString(),
        type: form.type,
        name: form.name.trim(),
        calories: Number(form.calories),
      };

      if (form.type === 'ACTIVITY' && form.durationMinutes) {
        payload.durationMinutes = Number(form.durationMinutes);
      }

      if (form.type === 'FOOD' && (form.protein || form.carbs || form.fat)) {
        payload.macros = {
          protein: Number(form.protein) || 0,
          carbs: Number(form.carbs) || 0,
          fat: Number(form.fat) || 0,
        };
      }

      const result = await api.post('/api/nutrition/logs', payload);
      toast.success(result.message || 'Đã lưu nhật ký thành công!');

      // Reset form fields
      setForm((prev) => ({
        ...prev,
        name: '',
        calories: '',
        durationMinutes: '',
        protein: '',
        carbs: '',
        fat: '',
      }));

      void loadLogs();
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      setDeletingId(logId);
      const result = await api.delete(`/api/nutrition/logs/${logId}`);
      toast.success(result.message || 'Đã xóa bản ghi nhật ký.');
      setLogs((prev) => prev.filter((l) => l._id !== logId));
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px', alignItems: 'start' }}>
      {/* Ghi nhật ký mới (Form) */}
      <form
        className="panel"
        onSubmit={submit}
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                Ghi Nhật Ký Dinh Dưỡng & Vận Động
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ghi nhận calo nạp từ bữa ăn hoặc calo đốt cháy từ tập luyện</span>
            </div>
          </div>
        </div>

        {/* Type Toggle Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => setForm({ ...form, type: 'FOOD' })}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: form.type === 'FOOD' ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
              background: form.type === 'FOOD' ? '#f0fdf4' : '#ffffff',
              color: form.type === 'FOOD' ? '#15803d' : '#64748b',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Salad size={16} /> 🥗 Món Ăn (Calo Nạp Vào)
          </button>

          <button
            type="button"
            onClick={() => setForm({ ...form, type: 'ACTIVITY' })}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: form.type === 'ACTIVITY' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
              background: form.type === 'ACTIVITY' ? '#fff7ed' : '#ffffff',
              color: form.type === 'ACTIVITY' ? '#c2410c' : '#64748b',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Flame size={16} /> 🔥 Vận Động (Calo Tiêu Hao)
          </button>
        </div>

        {/* Quick Presets */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Gợi ý nhanh:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {form.type === 'FOOD' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Bữa sáng: Trứng ốp la + Bánh mì đen + Sữa hạt', 420, { p: 25, c: 45, f: 14 })}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🍳 Bữa Sáng (420 kcal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Bữa trưa: Cơm gạo lứt + Ức gà áp chảo + Rau luộc', 650, { p: 48, c: 65, f: 12 })}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🥗 Bữa Trưa (650 kcal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Bữa tối: Cá hồi nướng + Khoai lang + Salad dầu giấm', 580, { p: 40, c: 45, f: 20 })}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🥩 Bữa Tối (580 kcal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Bữa phụ: 1 Muỗng Whey Isolate + 1 Quả chuối', 220, { p: 27, c: 25, f: 1 })}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🍌 Bữa Phụ / Whey (220 kcal)
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Tập Gym kháng lực cường độ cao (60p)', 450)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🏋️ Gym 1h (450 kcal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Chạy bộ ngoài trời 5km Pace 6:00 (30p)', 360)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🏃 Chạy 5km (360 kcal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Bơi lội liên tục 1km (40p)', 350)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🏊 Bơi 1km (350 kcal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Đạp xe ngoài trời 20km (50p)', 420)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer', color: '#334155' }}
                >
                  🚴 Cycling 20km (420 kcal)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Input Fields */}
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Ngày ghi nhận</span>
              <input
                type="date"
                aria-label="Ngày nhật ký"
                value={form.loggedAt}
                onChange={(e) => setForm({ ...form, loggedAt: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </label>

            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {form.type === 'FOOD' ? 'Năng lượng nạp (kcal)' : 'Năng lượng tiêu hao (kcal)'}
              </span>
              <input
                type="number"
                aria-label="Calories nhật ký"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
                placeholder="VD: 550"
                required
                min={1}
                max={10000}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
              />
            </label>
          </div>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Tên món ăn hoặc hoạt động</span>
            <input
              aria-label="Tên món hoặc hoạt động"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={form.type === 'FOOD' ? 'VD: Cơm ức gà áp chảo + Bông cải xanh' : 'VD: Chạy bộ 5km hoặc Tập tạ ngực'}
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </label>

          {/* Optional Macros for FOOD */}
          {form.type === 'FOOD' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '2px' }}>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>Protein (g)</span>
                <input
                  type="number"
                  placeholder="g"
                  value={form.protein}
                  onChange={(e) => setForm({ ...form, protein: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.82rem', background: '#eff6ff' }}
                />
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>Carbs (g)</span>
                <input
                  type="number"
                  placeholder="g"
                  value={form.carbs}
                  onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.82rem', background: '#fffbeb' }}
                />
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem', color: '#be185d', fontWeight: 700 }}>Fat (g)</span>
                <input
                  type="number"
                  placeholder="g"
                  value={form.fat}
                  onChange={(e) => setForm({ ...form, fat: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fbcfe8', fontSize: '0.82rem', background: '#fdf2f8' }}
                />
              </label>
            </div>
          )}

          {/* Optional Duration for ACTIVITY */}
          {form.type === 'ACTIVITY' && (
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Thời gian tập luyện (Phút)</span>
              <input
                type="number"
                placeholder="VD: 45 phút"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </label>
          )}
        </div>

        <button
          type="submit"
          className="button button-primary"
          disabled={submitting}
          style={{ width: '100%', marginTop: '16px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700 }}
        >
          {submitting ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
          Lưu nhật ký
        </button>
      </form>

      {/* Danh sách nhật ký đã ghi gần đây (History Timeline) */}
      <div
        className="panel"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Lịch Sử Nhật Ký Gần Đây
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Danh sách các bữa ăn & hoạt động đã ghi</span>
          </div>

          <button
            type="button"
            onClick={() => void loadLogs()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
            title="Tải lại danh sách"
          >
            <RefreshCw size={15} className={loadingLogs ? 'spin' : ''} />
          </button>
        </div>

        {loadingLogs ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.85rem' }}>
            Đang tải nhật ký...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            Chưa có bữa ăn hoặc bài tập nào được ghi nhận cho học viên này.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {logs.map((item) => {
              const isFood = item.type === 'FOOD';
              const dateDisplay = item.loggedAt ? new Date(item.loggedAt).toLocaleDateString('vi-VN') : '';

              return (
                <div
                  key={item._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: isFood ? '#fcfdfd' : '#fffbf7',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isFood ? '#f0fdf4' : '#fff7ed',
                        color: isFood ? '#16a34a' : '#ea580c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isFood ? <Utensils size={15} /> : <Flame size={15} />}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b' }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>• {dateDisplay}</span>
                      </div>

                      {isFood && item.macros && (item.macros.protein || item.macros.carbs || item.macros.fat) ? (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          P: <strong style={{ color: '#1d4ed8' }}>{item.macros.protein || 0}g</strong> • C: <strong style={{ color: '#b45309' }}>{item.macros.carbs || 0}g</strong> • F: <strong style={{ color: '#be185d' }}>{item.macros.fat || 0}g</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        color: isFood ? '#15803d' : '#ea580c',
                        background: isFood ? '#f0fdf4' : '#fff7ed',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: isFood ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                      }}
                    >
                      {isFood ? `+${item.calories}` : `-${item.calories}`} kcal
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleDeleteLog(item._id)}
                      disabled={deletingId === item._id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Xóa bản ghi"
                    >
                      <Trash2 size={15} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
