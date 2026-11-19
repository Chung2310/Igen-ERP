import { useState } from 'react';
import {
  Calendar,
  Ruler,
  Sparkles,
  Target,
} from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';
import ProgressCharts from '../progress/ProgressCharts';
import InBodyDetailView from '../inbody/InBodyDetailView';

interface CustomerInBodyGoalsProps {
  journey: CustomerJourneyDto;
}

export default function CustomerInBodyGoals({ journey }: CustomerInBodyGoalsProps) {
  const { inbodyRecords, goals, measurements } = journey;

  // Selected InBody record for detailed view (default: latest)
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const activeRecord = inbodyRecords && inbodyRecords.length > 0 ? inbodyRecords[selectedRecordIndex] : null;
  const previousRecord = inbodyRecords && selectedRecordIndex < inbodyRecords.length - 1
    ? inbodyRecords[selectedRecordIndex + 1]
    : null;

  return (
    <div className="space-y-6">
      {/* 1. GOALS CARDS */}
      {Array.isArray(goals) && goals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 font-oswald text-xl font-bold uppercase tracking-wide text-primary">
              <Target size={20} className="text-accent" />
              Mục tiêu Huấn luyện viên đã đặt cho bạn
            </h3>
            <span className="text-xs text-slate-500">{goals.length} mục tiêu đang theo dõi</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal, idx) => (
              <div
                key={goal._id || idx}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-accent hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="rounded-md bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 uppercase">
                      {goal.type || 'Mục tiêu thể hình'}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {goal.status === 'PUBLISHED' ? 'Đang thực hiện' : goal.status || 'Đang thực hiện'}
                    </span>
                  </div>

                  <h4 className="mt-3 font-oswald text-lg font-bold text-slate-900">{goal.title}</h4>

                  {goal.targetValue != null && (
                    <div className="mt-3 flex items-baseline gap-2 rounded-xl bg-slate-50 p-3">
                      <span className="text-xs text-slate-500">Mục tiêu cần đạt:</span>
                      <span className="font-oswald text-xl font-bold text-primary">
                        {goal.targetValue} {goal.targetUnit || ''}
                      </span>
                    </div>
                  )}

                  {goal.cardioNotes && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Cardio / Lối sống:</span> {goal.cardioNotes}
                    </p>
                  )}

                  {goal.evaluationNotes && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Đánh giá từ PT:</span> {goal.evaluationNotes}
                    </p>
                  )}
                </div>

                {goal.deadline && (
                  <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <Calendar size={13} className="text-slate-400" />
                    <span>Hạn chót: {new Date(goal.deadline).toLocaleDateString('vi-VN')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. INBODY DETAIL — reuse PT's InBodyDetailView */}
      {inbodyRecords && inbodyRecords.length > 0 ? (
        <div className="space-y-5">
          {/* Record Selector Header */}
          <div
            style={{
              background: 'linear-gradient(90deg, #003b70 0%, #0369a1 100%)',
              borderRadius: '14px',
              padding: '14px 20px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <Sparkles size={18} color="#38bdf8" />
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#bae6fd', letterSpacing: '0.5px' }}>
                  Phiếu phân tích chỉ số cơ thể
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Kết quả đo InBody {activeRecord ? new Date(activeRecord.measurementDate).toLocaleDateString('vi-VN') : ''}
                </h3>
              </div>
            </div>

            {/* Record Selector Tabs if multiple */}
            {inbodyRecords.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '4px 6px' }}>
                {inbodyRecords.map((rec, idx) => (
                  <button
                    key={rec._id || idx}
                    type="button"
                    onClick={() => setSelectedRecordIndex(idx)}
                    style={{
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: idx === selectedRecordIndex ? '#ffffff' : 'transparent',
                      color: idx === selectedRecordIndex ? '#003b70' : 'rgba(255,255,255,0.8)',
                      boxShadow: idx === selectedRecordIndex ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {new Date(rec.measurementDate).toLocaleDateString('vi-VN')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reuse the exact same detail view from PT side */}
          {activeRecord && (
            <InBodyDetailView
              record={activeRecord}
              previousRecord={previousRecord}
              historyRecords={inbodyRecords}
              hideConsultation
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 mb-3">
            <Ruler size={30} />
          </div>
          <h3 className="font-oswald text-xl font-bold uppercase text-slate-800">
            Chưa có phiếu đo InBody được công bố
          </h3>
          <p className="mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
            Bạn hãy yêu cầu Huấn luyện viên quét và phân tích phiếu đo InBody trong buổi tập sắp tới nhé!
          </p>
        </div>
      )}

      {/* 3. PROGRESS CHARTS */}
      <div className="space-y-4">
        <h3 className="font-oswald text-xl font-bold uppercase tracking-wide text-primary">
          Biểu đồ theo dõi tiến độ cơ thể
        </h3>
        <ProgressCharts measurements={measurements} />
      </div>
    </div>
  );
}
