import { useState } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  Dumbbell,
  FileText,
  Flame,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';

interface CustomerWorkoutsProps {
  journey: CustomerJourneyDto;
}

export default function CustomerWorkouts({ journey }: CustomerWorkoutsProps) {
  const { plans } = journey;
  const activePlan = plans?.active || (plans?.published && plans.published[0]);
  const historyPlans = plans?.history || [];
  const allPublished = plans?.published || [];

  // Selected workout day index (0-based)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  // Expand history item
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Extract sessions / day routines from active plan
  const sessions = (activePlan?.sessions as Array<{
    name: string;
    exercises: Array<{
      name: string;
      sets?: number;
      reps?: string;
      weight?: string;
      rest?: string;
      tempo?: string;
      notes?: string;
      exerciseId?: string;
    }>;
  }>) || [];

  // Or if plan uses scheduledExercises
  const scheduledExercises = (activePlan?.scheduledExercises as Array<{
    dayNumber: number;
    name: string;
    sets?: number;
    reps?: string;
    weight?: string;
    rpe?: number;
    tempo?: string;
    restSeconds?: number;
    notes?: string;
  }>) || [];

  // Group scheduledExercises by day if sessions array is empty
  const derivedSessions = sessions.length > 0
    ? sessions
    : scheduledExercises.length > 0
    ? Object.entries(
        scheduledExercises.reduce<Record<number, typeof scheduledExercises>>((acc, ex) => {
          const day = ex.dayNumber || 1;
          if (!acc[day]) acc[day] = [];
          acc[day].push(ex);
          return acc;
        }, {})
      ).map(([day, exs]) => ({
        name: `Ngày ${day}`,
        exercises: exs.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          rest: e.restSeconds ? `${e.restSeconds}s` : '',
          tempo: e.tempo,
          notes: e.notes,
        })),
      }))
    : [];

  const currentSession = derivedSessions[selectedDayIndex] || derivedSessions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── ACTIVE WORKOUT PLAN CARD ── */}
      {activePlan ? (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          {/* Plan Header Bar */}
          <div
            style={{
              background: 'linear-gradient(90deg, #003b70 0%, #0369a1 100%)',
              padding: '18px 22px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: '280px', flex: '1 1 300px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Dumbbell size={20} color="#38bdf8" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#e0f2fe',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={11} /> {String(activePlan.level || 'Cá nhân hóa')}
                    </span>
                    {Array.isArray(activePlan.muscleGroups) && activePlan.muscleGroups.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#bae6fd', fontWeight: 600 }}>
                        Nhóm cơ: {activePlan.muscleGroups.map(String).join(', ')}
                      </span>
                    )}
                  </div>
                  <h2 style={{ margin: '4px 0 2px', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                    {String(activePlan.title || 'Giáo án tập luyện 3S')}
                  </h2>
                  {Boolean(activePlan.goal) && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#e0f2fe' }}>
                      <span style={{ fontWeight: 600 }}>Mục tiêu:</span> {String(activePlan.goal)}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick stats pills */}
              {derivedSessions.length > 0 && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    textAlign: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#bae6fd', fontWeight: 700, display: 'block' }}>
                    Lịch phân bổ
                  </span>
                  <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                    {derivedSessions.length} Buổi / Tuần
                  </strong>
                </div>
              )}
            </div>

            {Boolean(activePlan.technicalNotes) && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: '#f0f9ff',
                }}
              >
                <strong style={{ color: '#fde047', marginRight: '6px' }}>⚡ Dặn dò kỹ thuật từ PT:</strong>
                {String(activePlan.technicalNotes)}
              </div>
            )}
          </div>

          {/* ── Day Routine Selector & Exercise Details ── */}
          {derivedSessions.length > 0 ? (
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Day Tabs */}
              <div>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Chọn ngày tập luyện:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {derivedSessions.map((session, idx) => {
                    const isActive = idx === selectedDayIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDayIndex(idx)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          background: isActive ? '#003b70' : '#f1f5f9',
                          color: isActive ? '#ffffff' : '#334155',
                          border: isActive ? '1px solid #003b70' : '1px solid #cbd5e1',
                          boxShadow: isActive ? '0 2px 6px rgba(0, 59, 112, 0.2)' : 'none',
                        }}
                      >
                        <Dumbbell size={14} color={isActive ? '#38bdf8' : '#64748b'} />
                        <span>{session.name}</span>
                        <span
                          style={{
                            background: isActive ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                            color: isActive ? '#ffffff' : '#64748b',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}
                        >
                          {session.exercises?.length || 0} bài
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session Exercises Matrix */}
              {currentSession && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#003b70' }}>
                      Chi tiết {currentSession.name} ({currentSession.exercises?.length || 0} bài tập)
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Thực hiện đúng form và nghỉ theo thời gian quy định
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                    {currentSession.exercises?.map((exercise, exIdx) => (
                      <div
                        key={exIdx}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          {/* Exercise Name with Index */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                background: '#003b70',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {exIdx + 1}
                            </span>
                            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{exercise.name}</strong>
                          </div>

                          {/* Exercise Parameters Matrix */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '6px',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '8px',
                              textAlign: 'center',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block' }}>
                                Hiệp (Sets)
                              </span>
                              <strong style={{ fontSize: '0.86rem', color: '#003b70' }}>
                                {exercise.sets ? `${exercise.sets} hiệp` : '3-4'}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block' }}>
                                Số lần (Reps)
                              </span>
                              <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                                {exercise.reps || '8 - 12'}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block' }}>
                                Mức tạ
                              </span>
                              <strong style={{ fontSize: '0.86rem', color: '#15803d' }}>
                                {exercise.weight || 'Gợi ý PT'}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block' }}>
                                Nghỉ (Rest)
                              </span>
                              <strong style={{ fontSize: '0.86rem', color: '#475569' }}>
                                {exercise.rest || '60s - 90s'}
                              </strong>
                            </div>
                          </div>

                          {/* Tempo & Notes */}
                          {(exercise.tempo || exercise.notes) && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                              {exercise.tempo && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                                  <Clock size={12} color="#0284c7" />
                                  <span>
                                    <strong>Nhịp điệu (Tempo):</strong> {exercise.tempo}
                                  </span>
                                </div>
                              )}
                              {exercise.notes && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 8px', color: '#92400e' }}>
                                  <strong>Lưu ý:</strong> {exercise.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
              Chưa có chi tiết bài tập theo ngày. Huấn luyện viên đang cập nhật phân bổ buổi tập.
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '14px',
            padding: '36px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <BookOpen size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Chưa có giáo án đang áp dụng
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', maxWidth: '440px', marginInline: 'auto', lineHeight: 1.5 }}>
            Huấn luyện viên phụ trách đang phân tích thể trạng và thiết lập giáo án phù hợp cho bạn. Bạn có thể trao đổi trực tiếp với PT trong buổi tập tới!
          </p>
        </div>
      )}

      {/* ── WORKOUT PLANS HISTORY & ARCHIVES ── */}
      {(historyPlans.length > 0 || allPublished.length > 1) && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#003b70', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#0284c7" /> Lịch Sử Các Giáo Án Đã Hoàn Thành
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {historyPlans.map((plan) => {
              const planId = String(plan._id);
              const isExpanded = expandedHistoryId === planId;
              return (
                <div
                  key={planId}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => setExpandedHistoryId(isExpanded ? null : planId)}
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isExpanded ? '#f1f5f9' : '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#475569',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={16} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>
                          {String(plan.title)}
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {plan.archivedAt
                            ? `Đã hoàn thành ngày ${new Date(String(plan.archivedAt)).toLocaleDateString('vi-VN')}`
                            : 'Giáo án lưu trữ'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>{isExpanded ? 'Thu gọn' : 'Xem lại'}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.8rem', color: '#334155' }}>
                      {Boolean(plan.goal) && (
                        <div style={{ marginBottom: '6px' }}>
                          <strong style={{ color: '#0f172a' }}>Mục tiêu:</strong> {String(plan.goal)}
                        </div>
                      )}
                      {Boolean(plan.technicalNotes) && (
                        <div style={{ marginBottom: '6px' }}>
                          <strong style={{ color: '#0f172a' }}>Ghi chú:</strong> {String(plan.technicalNotes)}
                        </div>
                      )}
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        Giáo án này đã được lưu trữ trong hồ sơ tiến trình luyện tập của bạn.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
