/**
 * InBodyDetailView — shared read-only view for InBody record details.
 * Used by both PT's InBodyDetailModal (inside modal) and Customer's CustomerInBodyGoals page.
 * Renders: Score/Comparison banner → Goal alignment → Body Composition grid → Segmental Analysis → Strengths/Priorities → PT Consultation Notes → Alerts → Evolution Chart.
 */
import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  Flame,
  Info,
  Layers,
  MessageSquare,
  Salad,
  Scale,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { InBodyRecordData, CustomerGoalData } from '../../types/inbody';
import { analyzeInBody } from '../../services/inbodyAnalytics';
import InBodyEvolutionChart from './InBodyEvolutionChart';

interface InBodyDetailViewProps {
  record: InBodyRecordData;
  previousRecord?: InBodyRecordData | null;
  historyRecords?: InBodyRecordData[];
  customerMeta?: { fullName?: string; gender?: string; height?: number; phone?: string };
  customerGoal?: CustomerGoalData | null;
  /** Hide PT-only sections like internal talking points script */
  hideConsultation?: boolean;
}

export default function InBodyDetailView({
  record,
  previousRecord,
  historyRecords,
  customerMeta,
  customerGoal,
  hideConsultation,
}: InBodyDetailViewProps) {
  const analysis = useMemo(() => {
    return analyzeInBody(record, previousRecord, customerMeta, customerGoal);
  }, [record, previousRecord, customerMeta, customerGoal]);

  if (!analysis) return null;

  const sm = record.segmentalMuscle;
  const sf = record.segmentalFat;
  const hasSegmental = Boolean(
    sm?.rightArm || sm?.leftArm || sm?.trunk || sm?.rightLeg || sm?.leftLeg ||
    sf?.rightArm || sf?.leftArm || sf?.trunk || sf?.rightLeg || sf?.leftLeg
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Section 1: InBody Score & Comparison Summary Banner */}
      <div
        className={`grid ${record.inbodyScore != null ? 'grid-cols-1 md:grid-cols-[200px_1fr]' : 'grid-cols-1'} gap-3.5 sm:gap-4 items-stretch max-w-full`}
      >
        {/* Score Box */}
        {record.inbodyScore != null && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-100 border border-green-200 rounded-2xl p-3.5 sm:p-5 flex flex-row md:flex-col items-center justify-between md:justify-center text-left md:text-center gap-3 shadow-2xs">
            <div className="flex flex-col items-start md:items-center">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Điểm InBody Score
              </span>
              <span className="mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-700 text-white shadow-2xs inline-block">
                {analysis.classifications.inbodyScore?.label || 'Đạt chuẩn'}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-700 leading-none shrink-0">
              <span>{record.inbodyScore}</span>
              <span className="text-sm sm:text-base font-semibold text-emerald-600">/100</span>
            </div>
          </div>
        )}

        {/* Comparison / Delta Card or Status Banner */}
        <div
          className={`rounded-2xl p-3.5 sm:p-5 border flex flex-col justify-center min-w-0 max-w-full shadow-2xs ${
            analysis.comparison
              ? analysis.comparison.trendType === 'EXCELLENT'
                ? 'bg-emerald-50/70 border-emerald-200'
                : analysis.comparison.trendType === 'NEEDS_ADJUSTMENT'
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-sky-50/70 border-sky-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          {analysis.comparison ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`w-4 h-4 shrink-0 ${analysis.comparison.trendType === 'NEEDS_ADJUSTMENT' ? 'text-rose-600' : 'text-sky-600'}`} />
                <strong className="text-xs sm:text-sm text-slate-900 leading-snug break-words">
                  So sánh với lần đo ngày {previousRecord?.measurementDate ? new Date(previousRecord.measurementDate).toLocaleDateString('vi-VN') : 'trước'} (cách {analysis.comparison.daysBetween} ngày):
                </strong>
              </div>
              <p className="m-0 mb-3 text-xs sm:text-sm text-slate-700 font-semibold leading-relaxed">
                {analysis.comparison.trendSummary}
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {/* Cân nặng */}
                <div className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs inline-flex flex-wrap items-center gap-1.5 max-w-full">
                  <span className="text-slate-500 font-medium">Cân nặng:</span>
                  <strong className="text-slate-900">
                    {previousRecord?.weight != null ? `${previousRecord.weight} kg` : '—'} ➔ {record.weight} kg
                  </strong>
                  <span
                    className={`font-bold ${
                      analysis.comparison.deltaWeight > 0
                        ? 'text-amber-600'
                        : analysis.comparison.deltaWeight < 0
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                    }`}
                  >
                    ({analysis.comparison.deltaWeight > 0 ? `+${analysis.comparison.deltaWeight} kg` : analysis.comparison.deltaWeight < 0 ? `${analysis.comparison.deltaWeight} kg` : 'Không đổi'})
                  </span>
                </div>

                {/* % Mỡ */}
                <div className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs inline-flex flex-wrap items-center gap-1.5 max-w-full">
                  <span className="text-slate-500 font-medium">% Mỡ:</span>
                  <strong className="text-slate-900">
                    {previousRecord?.bodyFatPercentage != null ? `${previousRecord.bodyFatPercentage}%` : '—'} ➔ {record.bodyFatPercentage != null ? `${record.bodyFatPercentage}%` : '—'}
                  </strong>
                  <span
                    className={`font-bold ${
                      analysis.comparison.deltaFatPercentage < 0
                        ? 'text-emerald-700'
                        : analysis.comparison.deltaFatPercentage > 0
                          ? 'text-rose-600'
                          : 'text-slate-500'
                    }`}
                  >
                    ({analysis.comparison.deltaFatPercentage > 0 ? `+${analysis.comparison.deltaFatPercentage}%` : analysis.comparison.deltaFatPercentage < 0 ? `${analysis.comparison.deltaFatPercentage}%` : 'Không đổi'})
                  </span>
                </div>

                {/* Khối lượng cơ */}
                <div className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs inline-flex flex-wrap items-center gap-1.5 max-w-full">
                  <span className="text-slate-500 font-medium">Khối lượng cơ:</span>
                  <strong className="text-slate-900">
                    {previousRecord?.muscleMass != null ? `${previousRecord.muscleMass} kg` : '—'} ➔ {record.muscleMass != null ? `${record.muscleMass} kg` : '—'}
                  </strong>
                  <span
                    className={`font-bold ${
                      analysis.comparison.deltaMuscleMass > 0
                        ? 'text-emerald-700'
                        : analysis.comparison.deltaMuscleMass < 0
                          ? 'text-amber-600'
                          : 'text-slate-500'
                    }`}
                  >
                    ({analysis.comparison.deltaMuscleMass > 0 ? `+${analysis.comparison.deltaMuscleMass} kg` : analysis.comparison.deltaMuscleMass < 0 ? `${analysis.comparison.deltaMuscleMass} kg` : 'Không đổi'})
                  </span>
                </div>

                {/* Mỡ nội tạng */}
                {previousRecord?.visceralFatLevel != null && record.visceralFatLevel != null && (
                  <div className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs inline-flex flex-wrap items-center gap-1.5 max-w-full">
                    <span className="text-slate-500 font-medium">Mỡ nội tạng:</span>
                    <strong className="text-slate-900">
                      Lv {previousRecord.visceralFatLevel} ➔ Lv {record.visceralFatLevel}
                    </strong>
                    <span
                      className={`font-bold ${
                        analysis.comparison.deltaVisceralFat < 0
                          ? 'text-emerald-700'
                          : analysis.comparison.deltaVisceralFat > 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                      }`}
                    >
                      ({analysis.comparison.deltaVisceralFat > 0 ? `+${analysis.comparison.deltaVisceralFat} Lv` : analysis.comparison.deltaVisceralFat < 0 ? `${analysis.comparison.deltaVisceralFat} Lv` : 'Không đổi'})
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-sky-600 shrink-0" />
              <div>
                <strong className="text-sky-950 block text-sm">
                  Phiếu InBody khởi điểm (Baseline)
                </strong>
                <p className="m-0 mt-0.5 text-xs text-slate-600">
                  Đây là kết quả đo đầu tiên hoặc chưa có dữ liệu đối chiếu. Các lần đo tiếp theo sẽ tự động so sánh mức độ tiến bộ.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 1.5: Active Customer Goal Alignment Card */}
      {analysis.goalAlignment && (
        <div className="p-3.5 sm:p-5 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-full shadow-2xs">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm sm:text-[0.95rem] text-sky-950 break-words">
                  Mục tiêu đang theo đuổi: {analysis.goalAlignment.goal.title}
                </strong>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-600 text-white whitespace-nowrap">
                  {analysis.goalAlignment.goalTypeLabel}
                </span>
              </div>
              <p className="m-0 mt-1 text-xs sm:text-sm text-sky-800 font-semibold leading-relaxed">
                {analysis.goalAlignment.statusSummary}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-700 shrink-0 self-start sm:self-auto">
            {analysis.goalAlignment.goal.deadline && (
              <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block text-[0.7rem] uppercase font-bold">Hạn chót</span>
                <strong className="text-slate-900 font-bold">{new Date(analysis.goalAlignment.goal.deadline).toLocaleDateString('vi-VN')}</strong>
              </div>
            )}
            {analysis.goalAlignment.goal.sessionsPerWeek && (
              <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block text-[0.7rem] uppercase font-bold">Lịch tập</span>
                <strong className="text-slate-900 font-bold">{analysis.goalAlignment.goal.sessionsPerWeek} buổi/tuần</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Core Body Composition Metrics Grid */}
      <div className="flex flex-col gap-3 max-w-full">
        <h3 className="m-0 text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Scale className="w-4 h-4 text-sky-600 shrink-0" />
          <span>Phân Tích Thành Phần Cơ Thể (Body Composition)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 max-w-full">
          {/* 1. Cân nặng */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
            <span className="text-xs font-semibold text-slate-500 block">Cân nặng (Weight)</span>
            <div className="text-lg sm:text-2xl font-extrabold text-primary my-1">
              <span>{record.weight}</span> <span className="text-xs sm:text-sm font-semibold text-slate-500">kg</span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              {analysis.classifications.bmi && (
                <span className="font-bold" style={{ color: analysis.classifications.bmi.color }}>
                  BMI: {record.bmi || '—'} ({analysis.classifications.bmi.label})
                </span>
              )}
              {(record.height || customerMeta?.height || (typeof record.customerId === 'object' && record.customerId?.height)) && (
                <span className="text-slate-500 font-medium truncate">
                  Cao: <strong className="text-slate-800">{record.height || customerMeta?.height || (typeof record.customerId === 'object' && record.customerId?.height)} cm</strong>
                </span>
              )}
            </div>
          </div>

          {/* 2. Tỷ lệ mỡ */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
            <span className="text-xs font-semibold text-slate-500 block">Tỷ lệ mỡ (Body Fat %)</span>
            <div className="text-lg sm:text-2xl font-extrabold text-slate-900 my-1">
              <span>{record.bodyFatPercentage != null ? record.bodyFatPercentage : '—'}</span>{' '}
              {record.bodyFatPercentage != null && <span className="text-xs sm:text-sm font-semibold text-slate-500">%</span>}
            </div>
            {analysis.classifications.bodyFat && (
              <span className="text-xs font-bold" style={{ color: analysis.classifications.bodyFat.color }}>
                {analysis.classifications.bodyFat.label}
              </span>
            )}
          </div>

          {/* 3. Khối lượng cơ xương */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
            <span className="text-xs font-semibold text-slate-500 block">Khối lượng cơ (Muscle)</span>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-700 my-1">
              <span>{record.muscleMass != null ? record.muscleMass : '—'}</span>{' '}
              {record.muscleMass != null && <span className="text-xs sm:text-sm font-semibold text-slate-500">kg</span>}
            </div>
            <span className="text-xs text-slate-500 font-medium truncate">
              {record.weight && record.muscleMass ? `~${((record.muscleMass / record.weight) * 100).toFixed(1)}% cơ thể` : 'Cơ xương (SMM)'}
            </span>
          </div>

          {/* 4. Khối lượng mỡ (Body Fat Mass) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
            <span className="text-xs font-semibold text-slate-500 block">Khối lượng mỡ (Fat Mass)</span>
            <div className="text-lg sm:text-2xl font-extrabold text-amber-700 my-1">
              <span>
                {record.bodyFatMass != null
                  ? record.bodyFatMass
                  : record.weight && record.bodyFatPercentage
                    ? ((record.weight * record.bodyFatPercentage) / 100).toFixed(1)
                    : '—'}
              </span>{' '}
              <span className="text-xs sm:text-sm font-semibold text-slate-500">kg</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Tổng lượng mỡ</span>
          </div>

          {/* 5. Mỡ nội tạng (Visceral Fat) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
            <span className="text-xs font-semibold text-slate-500 block">Mỡ nội tạng (Visceral Fat)</span>
            <div
              className={`text-lg sm:text-2xl font-extrabold my-1 ${
                record.visceralFatLevel && record.visceralFatLevel >= 10 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              Level <span>{record.visceralFatLevel != null ? record.visceralFatLevel : '—'}</span>
            </div>
            {analysis.classifications.visceralFat && (
              <span className="text-xs font-bold" style={{ color: analysis.classifications.visceralFat.color }}>
                {analysis.classifications.visceralFat.label}
              </span>
            )}
          </div>

          {/* 6. BMR Trao đổi chất */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
            <span className="text-xs font-semibold text-slate-500 block">Trao đổi chất cơ bản (BMR)</span>
            <div className="text-lg sm:text-2xl font-extrabold text-sky-700 my-1">
              <span>{record.bmr != null ? record.bmr : '—'}</span> <span className="text-xs sm:text-sm font-semibold text-slate-500">kcal</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Đốt thụ động / ngày</span>
          </div>

          {/* 7. Lượng nước (Body Water) */}
          {record.bodyWater != null && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
              <span className="text-xs font-semibold text-slate-500 block">Tổng lượng nước (TBW)</span>
              <div className="text-lg sm:text-2xl font-extrabold text-sky-600 my-1">
                <span>{record.bodyWater}</span> <span className="text-xs sm:text-sm font-semibold text-slate-500">L</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Độ hydrat hóa</span>
            </div>
          )}

          {/* 8. Khoáng chất xương (Bone Mineral) */}
          {record.boneMineral != null && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
              <span className="text-xs font-semibold text-slate-500 block">Khoáng chất xương (BMC)</span>
              <div className="text-lg sm:text-2xl font-extrabold text-emerald-600 my-1">
                <span>{record.boneMineral}</span> <span className="text-xs sm:text-sm font-semibold text-slate-500">kg</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Mật độ khoáng xương</span>
            </div>
          )}

          {/* 9. Tỷ lệ eo / mông (WHR) */}
          {record.waistHipRatio != null && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between min-w-0 max-w-full">
              <span className="text-xs font-semibold text-slate-500 block">Tỷ lệ eo / mông (WHR)</span>
              <div className="text-lg sm:text-2xl font-extrabold text-purple-600 my-1">
                <span>{record.waistHipRatio}</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Phân bố mỡ bụng</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Segmental Muscle & Fat Breakdown */}
      {hasSegmental && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-5 max-w-full">
          <h4 className="m-0 mb-3 text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Phân Tích Cơ & Mỡ Từng Phần (Segmental Lean & Fat)</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
            {[
              { label: 'Tay Phải (Right Arm)', m: sm?.rightArm, f: sf?.rightArm },
              { label: 'Tay Trái (Left Arm)', m: sm?.leftArm, f: sf?.leftArm },
              { label: 'Thân mình (Trunk)', m: sm?.trunk, f: sf?.trunk },
              { label: 'Chân Phải (Right Leg)', m: sm?.rightLeg, f: sf?.rightLeg },
              { label: 'Chân Trái (Left Leg)', m: sm?.leftLeg, f: sf?.leftLeg },
            ].map((part) => (
              <div key={part.label} className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs">
                <span className="text-[0.72rem] sm:text-xs font-bold text-slate-600 block truncate">{part.label}</span>
                <div className="mt-1 text-xs">
                  <span className="text-emerald-700 font-bold block">
                    Cơ: {part.m != null ? `${part.m} kg` : '—'}
                  </span>
                  <span className="text-amber-700 font-semibold block text-[0.7rem] sm:text-xs">
                    Mỡ: {part.f != null ? `${part.f} kg` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {(analysis.segmentalAnalysis.muscleImbalanceArm.hasImbalance || analysis.segmentalAnalysis.muscleImbalanceLeg.hasImbalance) && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3 text-xs text-amber-900">
              <strong>⚠️ Lưu ý mất cân đối cơ:</strong>
              {analysis.segmentalAnalysis.muscleImbalanceArm.hasImbalance && (
                <div>• {analysis.segmentalAnalysis.muscleImbalanceArm.note}</div>
              )}
              {analysis.segmentalAnalysis.muscleImbalanceLeg.hasImbalance && (
                <div>• {analysis.segmentalAnalysis.muscleImbalanceLeg.note}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 max-w-full">
        {/* Box: Strengths & Highlights */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 sm:p-5">
          <div className="flex items-center gap-2 mb-2.5 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <h4 className="m-0 text-sm sm:text-base font-extrabold">Điểm Mạnh Của Học Viên</h4>
          </div>
          {record.strengths ? (
            <p className="m-0 text-xs sm:text-sm text-emerald-900 leading-relaxed">{record.strengths}</p>
          ) : analysis.strengths.length > 0 ? (
            <ul className="m-0 pl-5 flex flex-col gap-1.5 text-xs sm:text-sm text-emerald-900">
              {analysis.strengths.map((s, idx) => (
                <li key={idx} className="leading-relaxed">{s}</li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs sm:text-sm text-emerald-800">Thể trạng ở mức khởi đầu, sẵn sàng cho lộ trình rèn luyện mới.</p>
          )}
        </div>

        {/* Box: Improvements & Priority Focus */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 sm:p-5">
          <div className="flex items-center gap-2 mb-2.5 text-amber-800">
            <Flame className="w-5 h-5 shrink-0" />
            <h4 className="m-0 text-sm sm:text-base font-extrabold">Điểm Cần Cải Thiện & Ưu Tiên</h4>
          </div>
          <div className="flex flex-col gap-2 text-xs sm:text-sm text-amber-900">
            {record.priorities ? (
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border-l-4 border-amber-600 shadow-2xs">
                <strong className="text-amber-900 block text-xs uppercase">
                  🎯 Ưu tiên từ PT:
                </strong>
                <p className="m-0 mt-0.5 font-bold text-amber-950">
                  {record.priorities}
                </p>
              </div>
            ) : analysis.priorities.length > 0 ? (
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border-l-4 border-amber-600 shadow-2xs">
                <strong className="text-amber-900 block text-xs uppercase">
                  🎯 Mục Tiêu Ưu Tiên Số 1:
                </strong>
                <p className="m-0 mt-0.5 font-bold text-amber-950">
                  {analysis.priorities[0]}
                </p>
              </div>
            ) : null}

            {analysis.improvements.length > 0 && !record.priorities && (
              <div>
                <strong className="block mb-1 text-xs sm:text-sm">Cần cải thiện:</strong>
                <ul className="m-0 pl-5 flex flex-col gap-1 text-xs sm:text-sm">
                  {analysis.improvements.map((imp, idx) => (
                    <li key={idx}>{imp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4.5: PT Consultation Notes & Advice */}
      {(record.consultationNotes || record.recommendation) && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 sm:p-5 max-w-full">
          <div className="flex items-center gap-2 mb-2 text-sky-800">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <h4 className="m-0 text-sm sm:text-base font-extrabold">Tư Vấn & Lời Khuyên Từ Huấn Luyện Viên</h4>
          </div>
          <p className="m-0 text-xs sm:text-sm text-sky-950 leading-relaxed whitespace-pre-line">
            {record.consultationNotes || record.recommendation}
          </p>
        </div>
      )}

      {/* Section 5: Health & Biometric Alerts */}
      {analysis.alerts.length > 0 && (
        <div className="flex flex-col gap-2.5 max-w-full">
          <h4 className="m-0 text-sm sm:text-base font-extrabold text-rose-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Cảnh Báo Chỉ Số Sức Khỏe Cần Theo Dõi Sát
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-full">
            {analysis.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl p-3 border ${
                  alert.level === 'danger' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <strong className="block text-xs sm:text-sm mb-0.5 font-bold">
                  ⚠️ {alert.title}
                </strong>
                <p className="m-0 text-xs leading-relaxed opacity-90">{alert.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 6: History Evolution Chart */}
      {historyRecords && historyRecords.length >= 2 && (
        <InBodyEvolutionChart records={historyRecords} title="Biểu Đồ Xu Hướng Thay Đổi Thể Chất Qua Các Lần Đo" />
      )}

      {/* Section 7: PT Consultation Guide (when not hidden) */}
      {!hideConsultation && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col gap-3.5 max-w-full">
          <div className="flex items-center gap-2 text-primary">
            <MessageSquare className="w-5 h-5 text-sky-600 shrink-0" />
            <h4 className="m-0 text-sm sm:text-base font-extrabold">
              Kịch Bản & Hướng Dẫn Tư Vấn Chuyên Sâu Cho PT
            </h4>
          </div>

          {/* Talking Points */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
            <strong className="text-primary block text-xs sm:text-sm mb-2">
              🗣️ Lời thoại gợi ý khi trao đổi trực tiếp với học viên:
            </strong>
            <div className="flex flex-col gap-2 text-xs sm:text-sm text-slate-700">
              {analysis.consultationGuide.talkingPoints.map((tp, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="bg-sky-100 text-sky-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="m-0 leading-relaxed">{tp}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Nutrition & Workout Targets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-full">
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
              <strong className="text-emerald-700 flex items-center gap-1.5 text-xs sm:text-sm mb-1.5">
                <Salad className="w-4 h-4 shrink-0" /> Định hướng Dinh dưỡng:
              </strong>
              <p className="m-0 mb-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {analysis.consultationGuide.nutritionAdvice}
              </p>
              <div className="text-xs text-slate-600 bg-emerald-50/70 p-2 rounded-lg mt-1.5 border border-emerald-100">
                💧 <strong>Nước & Protein:</strong> {analysis.consultationGuide.proteinRecommendation}. {analysis.consultationGuide.waterRecommendation}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
              <strong className="text-sky-700 flex items-center gap-1.5 text-xs sm:text-sm mb-1.5">
                <Dumbbell className="w-4 h-4 shrink-0" /> Định hướng Tập luyện:
              </strong>
              <p className="m-0 mb-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {analysis.consultationGuide.workoutAdvice}
              </p>
              <div className="text-xs text-slate-600 bg-sky-50/70 p-2 rounded-lg mt-1.5 border border-sky-100">
                ⚡ <strong>Calo đề xuất:</strong> Giảm mỡ: {analysis.consultationGuide.targetCaloriesRecommendation.fatLoss} kcal | Tăng cơ: {analysis.consultationGuide.targetCaloriesRecommendation.muscleGain} kcal/ngày.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
