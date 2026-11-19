import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Flame,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Salad,
  Send,
  Sparkles,
  Trash2,
  Utensils,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import ConfirmModal from '../ui/ConfirmModal';
import Pagination from '../ui/Pagination';
import { errorMessage } from '../../types';
import type { Customer, PaginationMeta } from '../../types';

export interface NutritionPlanItem {
  _id: string;
  id?: string;
  customerId: string | { _id: string; fullName?: string; phone?: string };
  ptId: string | { _id: string; fullName?: string };
  title: string;
  bmr?: number | null;
  tdee?: number | null;
  targetCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  menu: Array<{
    name: string;
    timeSlot?: string;
    calories?: number;
    items?: Array<{
      name: string;
      amount: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      prepTip?: string;
    }>;
    imageUrl?: string;
  }>;
  notes?: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt?: string | null;
  version?: number;
  createdAt: string;
  updatedAt?: string;
}

interface NutritionPlanListProps {
  selectedCustomer: Customer | null;
  customerId: string;
  onCreateNew: () => void;
  onEditPlan: (plan: NutritionPlanItem) => void;
}

export default function NutritionPlanList({
  selectedCustomer,
  customerId,
  onCreateNew,
  onEditPlan,
}: NutritionPlanListProps) {
  const toast = useToast();
  const [plans, setPlans] = useState<NutritionPlanItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NutritionPlanItem | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const toggleNoteExpand = (planId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNotes((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const loadPlans = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const query = new URLSearchParams({ page: String(page), limit: '6' });
        if (customerId) query.set('customerId', customerId);

        const res = await api.get<NutritionPlanItem[]>(`/api/nutrition-plans?${query}`);
        setPlans(Array.isArray(res.data) ? res.data : []);
        if (res.meta) setMeta(res.meta);
      } catch (err) {
        toast.error(errorMessage(err));
        setPlans([]);
      } finally {
        setLoading(false);
      }
    },
    [customerId, toast]
  );

  useEffect(() => {
    void loadPlans(1);
  }, [loadPlans]);

  const handleTogglePublish = async (plan: NutritionPlanItem) => {
    const isPublished = plan.status === 'PUBLISHED';
    try {
      setPublishingId(plan._id);
      const action = isPublished ? 'unpublish' : 'publish';
      const result = await api.patch(`/api/nutrition-plans/${plan._id}/${action}`);
      toast.success(result.message || (isPublished ? 'Đã thu hồi thực đơn về bản nháp' : 'Đã công bố thực đơn cho học viên áp dụng!'));
      await loadPlans(meta.page);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const result = await api.delete(`/api/nutrition-plans/${deleteTarget._id}`);
      toast.success(result.message || 'Đã xóa bản kế hoạch thực đơn.');
      setDeleteTarget(null);
      await loadPlans(meta.page);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}>
      {/* Header Action Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Salad size={20} color="#00a4e4" />
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#003b70', fontWeight: 800 }}>
              Danh Sách Kế Hoạch Thực Đơn Dinh Dưỡng
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {selectedCustomer
              ? `Các bản thực đơn đã lưu & công bố của học viên ${selectedCustomer.fullName} (${plans.length} bản)`
              : `Toàn bộ các bản thực đơn dinh dưỡng của học viên (${plans.length} bản)`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void loadPlans(1)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '9px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Đang tải...' : 'Làm mới'}
          </button>

          <button
            type="button"
            onClick={onCreateNew}
            style={{
              background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: 800,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0, 59, 112, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} /> Tạo Thực Đơn Mới
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={28} className="spin" style={{ color: '#00a4e4', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Đang tải danh sách các bản thực đơn...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && plans.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 24px',
            background: '#ffffff',
            borderRadius: '16px',
            border: '2px dashed #cbd5e1',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#f0f9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#00a4e4',
            }}
          >
            <Sparkles size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#003b70', fontWeight: 800 }}>
            {selectedCustomer
              ? `Chưa có thực đơn nào cho ${selectedCustomer.fullName}`
              : 'Chưa có kế hoạch thực đơn nào'}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.84rem', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            Bấm vào nút bên dưới để AI tự động phân tích thể trạng và thiết kế mâm cơm Việt thực tế cho học viên.
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            style={{
              background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0, 59, 112, 0.25)',
            }}
          >
            <Plus size={16} /> Thiết Kế Thực Đơn Mới Ngay
          </button>
        </div>
      )}

      {/* List of Nutrition Plans */}
      {plans.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {plans.map((plan) => {
            const isPub = plan.status === 'PUBLISHED';
            const isHierarchical = Array.isArray(plan.menu) && plan.menu.length > 0 && Boolean((plan.menu[0] as any)?.days);
            const weeksCount = isHierarchical ? plan.menu.length : 0;
            const previewMeals: any[] = isHierarchical
              ? ((plan.menu[0] as any)?.days?.[0]?.meals || [])
              : (plan.menu || []);
            const mealsCount = previewMeals.length;
            const createdDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('vi-VN') : '—';
            const isCurrentPublishing = publishingId === plan._id;

            const now = new Date();
            const hasDates = Boolean(plan.startDate);
            const startDateObj = plan.startDate ? new Date(plan.startDate) : null;
            const endDateObj = plan.endDate
              ? new Date(plan.endDate)
              : startDateObj
                ? new Date(startDateObj.getTime() + ((plan.durationDays || 7) - 1) * 86400000)
                : null;
            if (endDateObj) endDateObj.setHours(23, 59, 59, 999);
            const isCurrentlyActive = Boolean(startDateObj && endDateObj && now >= startDateObj && now <= endDateObj);
            const isUpcoming = Boolean(startDateObj && now < startDateObj);

            return (
              <div
                key={plan._id}
                style={{
                  background: '#ffffff',
                  border: isCurrentlyActive
                    ? '2px solid #22c55e'
                    : isPub
                      ? '1.5px solid #86efac'
                      : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: isCurrentlyActive ? '0 6px 20px rgba(34, 197, 94, 0.15)' : '0 4px 16px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div>
                  {/* Top Status & Date Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: isPub ? '#f0fdf4' : '#fefce8',
                          color: isPub ? '#166534' : '#854d0e',
                          border: isPub ? '1px solid #bbf7d0' : '1px solid #fef08a',
                        }}
                      >
                        {isPub ? <CheckCircle2 size={12} /> : <FileText size={12} />}
                        {isPub ? 'ĐÃ CÔNG BỐ' : 'BẢN NHÁP'}
                      </span>

                      {isCurrentlyActive && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                          }}
                        >
                          🟢 Đang ăn kỳ này
                        </span>
                      )}
                      {isUpcoming && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                          }}
                        >
                          🔵 Sắp tới
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Tạo: {createdDate}
                    </span>
                  </div>

                  {/* Scheduled Date Range Banner */}
                  {hasDates && startDateObj && endDateObj && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isCurrentlyActive ? '#15803d' : '#0369a1',
                        background: isCurrentlyActive ? '#f0fdf4' : '#f0f9ff',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: `1px solid ${isCurrentlyActive ? '#bbf7d0' : '#bae6fd'}`,
                        marginBottom: '10px',
                      }}
                    >
                      <Calendar size={13} />
                      <span>
                        Lịch ăn: {startDateObj.toLocaleDateString('vi-VN')} - {endDateObj.toLocaleDateString('vi-VN')}
                        {' '}({plan.durationDays || Math.round((endDateObj.getTime() - startDateObj.getTime()) / 86400000) + 1} ngày)
                      </span>
                    </div>
                  )}

                  {/* Plan Title */}
                  <h3 style={{ margin: '0 0 10px', fontSize: '1.05rem', color: '#003b70', fontWeight: 800, lineHeight: 1.3 }}>
                    {plan.title}
                  </h3>

                  {/* Calories & Macros Banner */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>TỔNG CALO</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16a34a', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                        {plan.targetCalories} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>kcal</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>ĐẠM (P)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7' }}>
                          {plan.macros?.protein || 0}g
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>CARB (C)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#d97706' }}>
                          {plan.macros?.carbs || 0}g
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>FAT (F)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#dc2626' }}>
                          {plan.macros?.fat || 0}g
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meals Preview */}
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#003b70', marginBottom: '4px' }}>
                      <Layers size={13} color="#00a4e4" />
                      {isHierarchical ? `${weeksCount} Tuần (${plan.durationDays || 30} Ngày) • ${mealsCount} Bữa/Ngày:` : `${mealsCount} Bữa Ăn Trong Ngày:`}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {previewMeals.map((m: any, idx: number) => (
                        <span
                          key={idx}
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {m.name} ({m.items?.length || 0} món)
                        </span>
                      ))}
                    </div>
                  </div>

                  {plan.notes && (() => {
                    const cleanNotes = plan.notes
                      .replace(/^(?:💡\s*)?(?:Lời khuyên(?:\s+dinh dưỡng)?|Ghi chú|Lưu ý)\s*:\s*/i, '')
                      .trim() || plan.notes;
                    const isLong = cleanNotes.length > 80 || cleanNotes.includes('\n');
                    const isExpanded = Boolean(expandedNotes[plan._id]);

                    return (
                      <div
                        onClick={(e) => {
                          if (isLong) toggleNoteExpand(plan._id, e);
                        }}
                        title={isLong ? (isExpanded ? 'Bấm để thu gọn' : 'Bấm để xem đầy đủ lời khuyên') : undefined}
                        style={{
                          fontSize: '0.74rem',
                          color: '#475569',
                          background: isExpanded ? '#fef9c3' : '#fefce8',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: isExpanded ? '1px solid #fde047' : '1px solid #fef08a',
                          marginTop: '8px',
                          cursor: isLong ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          lineHeight: 1.45,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div
                            style={{
                              flex: 1,
                              overflow: isExpanded ? 'visible' : 'hidden',
                              textOverflow: isExpanded ? 'clip' : 'ellipsis',
                              display: isExpanded ? 'block' : '-webkit-box',
                              WebkitLineClamp: isExpanded ? 'unset' : 2,
                              WebkitBoxOrient: 'vertical',
                              whiteSpace: isExpanded ? 'pre-line' : 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            <span style={{ color: '#854d0e', fontWeight: 800 }}>💡 Lời khuyên: </span>
                            <span>{cleanNotes}</span>
                          </div>

                          {isLong && (
                            <button
                              type="button"
                              onClick={(e) => toggleNoteExpand(plan._id, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '1px 4px',
                                color: '#0284c7',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                flexShrink: 0,
                                marginTop: '1px',
                                borderRadius: '4px',
                              }}
                              title={isExpanded ? 'Thu gọn lời khuyên' : 'Xem đầy đủ lời khuyên'}
                            >
                              {isExpanded ? (
                                <>
                                  Thu gọn <ChevronUp size={12} />
                                </>
                              ) : (
                                <>
                                  Xem thêm <ChevronDown size={12} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Actions Row */}
                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onEditPlan(plan)}
                    style={{
                      flex: 1,
                      background: '#003b70',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Pencil size={13} /> Xem & Sửa Thực Đơn
                  </button>

                  <button
                    type="button"
                    disabled={isCurrentPublishing}
                    onClick={() => void handleTogglePublish(plan)}
                    style={{
                      background: isPub ? '#fef2f2' : '#f0fdf4',
                      color: isPub ? '#dc2626' : '#166534',
                      border: isPub ? '1px solid #fecaca' : '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: isCurrentPublishing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title={isPub ? 'Thu hồi về trạng thái nháp' : 'Công bố cho học viên áp dụng'}
                  >
                    <Send size={13} /> {isPub ? 'Thu hồi' : 'Công bố'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(plan)}
                    style={{
                      background: '#fff',
                      color: '#94a3b8',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Xóa thực đơn này"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {meta.totalPages > 1 && (
        <div style={{ marginTop: '16px' }}>
          <Pagination
            page={meta.page || 1}
            totalPages={meta.totalPages || 1}
            totalItems={meta.total}
            pageSize={6}
            itemLabel="thực đơn"
            loading={loading}
            onPageChange={(p) => void loadPlans(p)}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa thực đơn"
        description={`Bạn có chắc chắn muốn xóa "${deleteTarget?.title}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa thực đơn"
        cancelLabel="Hủy"
        danger={true}
        onConfirm={() => void handleDeleteConfirm()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
