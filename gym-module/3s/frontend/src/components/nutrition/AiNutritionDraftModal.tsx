import { generateNutritionJob } from '../../services/nutritionJobs';
import { useState } from 'react';
import { ArrowRightLeft, Check, Sparkles, Utensils, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { NutritionDraftPlan } from '../../types';
import MealSwapperModal from './MealSwapperModal';
import MealInfographicPoster from '../MealInfographicPoster';

interface AiNutritionDraftModalProps {
  open: boolean;
  customerId: string;
  customerName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AiNutritionDraftModal({ open, customerId, customerName, onClose, onSaved }: AiNutritionDraftModalProps) {
  const toast = useToast();
  const [request, setRequest] = useState('Thực đơn 3 bữa/ngày, tập trung giảm mỡ bụng nhưng giữ cơ, ưu tiên món Việt dễ nấu (ức gà, cá hồi, trứng, gạo lứt, khoai lang, rau luộc).');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<NutritionDraftPlan | null>(null);
  const [showSwapper, setShowSwapper] = useState(false);
  const [showVisualPoster, setShowVisualPoster] = useState(false);

  if (!open) return null;

  const generate = async () => {
    try {
      setLoading(true);
      const result = { data: await generateNutritionJob<NutritionDraftPlan>({ customerId, request }) };

      // Enhance draft with visual poster dishes if menu exists
      const d = result.data;
      if (d && Array.isArray(d.menu) && d.menu.length > 0) {
        d.posterDishes = d.menu.map((m: any, idx: number) => ({
          id: idx + 1,
          title: m.name || m.title || `Bữa ${idx + 1}`,
          image: m.imageUrl || null,
          leftPills: Array.isArray(m.items)
            ? m.items.slice(0, 3).map((item: any) => ({
              label: typeof item === 'string' ? item : item.name || 'Món ăn',
              weight: typeof item === 'object' && item.amount ? String(item.amount) : '150g',
            }))
            : [{ label: 'Đạm + Tinh bột sạch + Xơ', weight: 'Khẩu phần chuẩn' }],
          rightPills: [
            { label: 'Calo Bữa', val: `${m.calories || Math.round(d.targetCalories / d.menu.length)} Kcal`, highlight: true },
            { label: 'Protein', val: `${m.protein || Math.round(d.macros.protein / d.menu.length)}g` },
          ],
        }));
      }

      setDraft(d);
      toast.success('AI đã tạo đề xuất thực đơn dinh dưỡng thành công!');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      setLoading(true);
      const planId = (draft as any)._id || (draft as any).id;
      let result;
      if (planId) {
        result = await api.patch(`/api/nutrition-plans/${planId}`, {
          customerId,
          title: draft.title,
          targetCalories: draft.targetCalories,
          macros: draft.macros,
          menu: draft.menu,
          notes: draft.advice || undefined,
        });
      } else {
        result = await api.post('/api/nutrition-plans', {
          customerId,
          title: draft.title,
          targetCalories: draft.targetCalories,
          macros: draft.macros,
          menu: draft.menu,
          notes: draft.advice || undefined,
        });
      }
      toast.success(result.message || 'Đã lưu thực đơn thành công!');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-label="Trợ lý dinh dưỡng AI">
        <div
          className="modal"
          style={{
            maxWidth: '820px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #003b70, #00a4e4)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  Trợ Lý AI Thiết Kế Thực Đơn & Hình Ảnh
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {customerName ? `Đang lên thực đơn cho: ${customerName}` : 'Tự động tính toán calo, phân bổ từng bữa và tạo hình ảnh poster thực tế.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Prompt input */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Yêu cầu và Mục tiêu ăn uống của học viên:
            </label>
            <textarea
              aria-label="Yêu cầu cho AI"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              placeholder="Ví dụ: Giảm mỡ bụng, 4 bữa/ngày, dị ứng hải sản, thích ăn thịt bò và ức gà..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {/* AI Generating Loading State Banner */}
          {loading && !draft && (
            <div
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '2px dashed #60a5fa',
                borderRadius: '12px',
                padding: '30px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <RefreshCw size={32} color="#2563eb" className="spin" />
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#1e3a8a', fontWeight: 800 }}>
                  Chuyên gia Dinh dưỡng AI đang thiết kế thực đơn...
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#1d4ed8' }}>
                  Đang phân tích thâm hụt calo, chia đạm/tinh bột/chất béo và chọn lọc món ăn theo yêu cầu.
                </p>
              </div>
            </div>
          )}

          {/* Generate Button */}
          {!draft && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void generate()}
                disabled={loading || !request.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                {loading ? 'AI đang thiết kế...' : 'Tạo bản nháp AI'}
              </button>
            </div>
          )}

          {/* AI Result Card */}
          {draft && (
            <div style={{ display: 'grid', gap: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontWeight: 700 }}>
                      Trạng thái: <strong>{draft.reviewStatus}</strong>
                    </span>
                  </div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Tên kế hoạch dinh dưỡng</label>
                  <input
                    aria-label="Tên kế hoạch"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.95rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowSwapper(true)}
                    style={{
                      background: '#ffffff',
                      color: '#003b70',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ArrowRightLeft size={14} color="#00a4e4" /> Đổi món tương đương
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowVisualPoster(!showVisualPoster)}
                    style={{
                      background: showVisualPoster ? '#003b70' : '#ffffff',
                      color: showVisualPoster ? '#ffffff' : '#003b70',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ImageIcon size={14} color={showVisualPoster ? '#38bdf8' : '#00a4e4'} />
                    {showVisualPoster ? 'Ẩn Poster Đồ Họa' : 'Xem Poster AI'}
                  </button>
                </div>
              </div>

              {/* Macro stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>TỔNG CALO</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-color)' }}>{draft.targetCalories} kcal</div>
                </div>
                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>PROTEIN</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e40af' }}>{draft.macros?.protein || 0}g</div>
                </div>
                <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>CARBS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#92400e' }}>{draft.macros?.carbs || 0}g</div>
                </div>
                <div style={{ background: '#fdf2f8', padding: '10px', borderRadius: '8px', border: '1px solid #fbcfe8', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#be185d', fontWeight: 700 }}>FAT</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#9d174d' }}>{draft.macros?.fat || 0}g</div>
                </div>
              </div>

              {/* Visual Infographic Poster View */}
              {showVisualPoster && (
                <div style={{ marginTop: '10px' }}>
                  <MealInfographicPoster
                    titleTag="Thực Đơn Khoa Học Đề Xuất"
                    subTitle={draft.title}
                    timeframeText="3S GYM NUTRITION AI"
                    dishes={draft.posterDishes || []}
                  />
                </div>
              )}

              {/* Detailed Meals List */}
              {Array.isArray(draft.menu) && draft.menu.length > 0 && (
                <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Utensils size={14} color="var(--secondary-color)" /> Danh sách các bữa ăn chi tiết:
                  </span>
                  {draft.menu.map((meal: any, idx: number) => (
                    <div key={idx} style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#003b70' }}>
                          {meal.name || meal.title || `Bữa ${idx + 1}`}
                        </strong>
                        {meal.calories && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                            {meal.calories} kcal
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                        {Array.isArray(meal.items) ? meal.items.join(' • ') : meal.description || 'Thực đơn cân bằng đa lượng'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal Footer Actions */}
          {draft && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void generate()}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Tạo lại phương án khác
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={onClose}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void save()}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Check size={16} /> Lưu kế hoạch đã review
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Swapper Modal */}
      <MealSwapperModal open={showSwapper} onClose={() => setShowSwapper(false)} />
    </>
  );
}
