import { useMemo, useState } from 'react';
import { Calendar, LineChart } from 'lucide-react';
import type { InBodyRecordData } from '../../types/inbody';

type MetricTab = 'ALL' | 'WEIGHT' | 'MUSCLE' | 'FAT' | 'SCORE';

interface InBodyEvolutionChartProps {
  records: InBodyRecordData[];
  title?: string;
}

export default function InBodyEvolutionChart({ records, title }: InBodyEvolutionChartProps) {
  const [activeTab, setActiveTab] = useState<MetricTab>('ALL');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Filter & sort chronological (oldest to newest)
  const sorted = useMemo(() => {
    return [...records]
      .filter((r) => r.weight != null && r.weight > 0)
      .sort((a, b) => new Date(a.measurementDate).getTime() - new Date(b.measurementDate).getTime());
  }, [records]);

  // Overall summary deltas (latest vs first in list)
  const overallDelta = useMemo(() => {
    if (sorted.length < 2) return null;
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    return {
      deltaWeight: Number((latest.weight - first.weight).toFixed(1)),
      deltaMuscle:
        latest.muscleMass != null && first.muscleMass != null
          ? Number((latest.muscleMass - first.muscleMass).toFixed(1))
          : null,
      deltaFat:
        latest.bodyFatPercentage != null && first.bodyFatPercentage != null
          ? Number((latest.bodyFatPercentage - first.bodyFatPercentage).toFixed(1))
          : null,
      deltaScore:
        latest.inbodyScore != null && first.inbodyScore != null
          ? latest.inbodyScore - first.inbodyScore
          : null,
      firstDate: new Date(first.measurementDate).toLocaleDateString('vi-VN'),
      latestDate: new Date(latest.measurementDate).toLocaleDateString('vi-VN'),
    };
  }, [sorted]);

  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedIdx !== null ? selectedIdx : sorted.length - 1;
  const activeRecord = sorted[activeIdx] || sorted[sorted.length - 1];

  if (sorted.length < 2) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '24px 20px',
          background: '#f8fafc',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          color: '#64748b',
          fontSize: '0.86rem',
        }}
      >
        <LineChart size={28} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
        <strong style={{ display: 'block', color: '#334155', marginBottom: '2px' }}>
          Chưa đủ dữ liệu để vẽ biểu đồ tiến độ
        </strong>
        <span>Cần tối thiểu 2 lần đo InBody của học viên này để phân tích xu hướng thay đổi thể chất.</span>
      </div>
    );
  }

  // SVG Dimension Constants (260px height for optimal spacing)
  const width = 740;
  const height = 260;
  const paddingX = 52;
  const paddingTop = 36;
  const paddingBottom = 46;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) => paddingX + (idx * plotWidth) / (sorted.length - 1);

  // Min/Max Scale helper with safety margins
  const getBounds = (values: (number | null | undefined)[]) => {
    const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
    if (valid.length === 0) return { min: 0, max: 100, span: 100 };
    const rawMin = Math.min(...valid);
    const rawMax = Math.max(...valid);
    if (rawMin === rawMax) {
      return { min: Math.max(0, rawMin - 2), max: rawMax + 2, span: 4 };
    }
    const margin = (rawMax - rawMin) * 0.18 || 1;
    return { min: rawMin - margin, max: rawMax + margin, span: rawMax - rawMin + margin * 2 };
  };

  const weightBounds = getBounds(sorted.map((s) => s.weight));
  const muscleBounds = getBounds(sorted.map((s) => s.muscleMass));
  const fatBounds = getBounds(sorted.map((s) => s.bodyFatPercentage));
  const scoreBounds = getBounds(sorted.map((s) => s.inbodyScore));

  const getYWeight = (w: number | null | undefined) => {
    if (w == null) return height - paddingBottom;
    return height - paddingBottom - ((w - weightBounds.min) / weightBounds.span) * plotHeight;
  };

  const getYMuscle = (m: number | null | undefined) => {
    if (m == null) return height - paddingBottom;
    return height - paddingBottom - ((m - muscleBounds.min) / muscleBounds.span) * plotHeight;
  };

  const getYFat = (f: number | null | undefined) => {
    if (f == null) return height - paddingBottom;
    return height - paddingBottom - ((f - fatBounds.min) / fatBounds.span) * plotHeight;
  };

  const getYScore = (s: number | null | undefined) => {
    if (s == null) return height - paddingBottom;
    return height - paddingBottom - ((s - scoreBounds.min) / scoreBounds.span) * plotHeight;
  };

  // Build SVG Path strings
  const buildPolyline = (getYFn: (val: any) => number, key: keyof InBodyRecordData) => {
    return sorted
      .map((item, idx) => {
        const val = item[key];
        if (val == null) return null;
        return `${getX(idx)},${getYFn(val)}`;
      })
      .filter(Boolean)
      .join(' ');
  };

  const weightPoints = buildPolyline(getYWeight, 'weight');
  const musclePoints = buildPolyline(getYMuscle, 'muscleMass');
  const fatPoints = buildPolyline(getYFat, 'bodyFatPercentage');
  const scorePoints = buildPolyline(getYScore, 'inbodyScore');

  // Build Area Path for single metric mode
  const buildAreaPath = (pointsStr: string) => {
    if (!pointsStr) return '';
    const pts = pointsStr.split(' ');
    if (pts.length < 2) return '';
    const firstX = pts[0].split(',')[0];
    const lastX = pts[pts.length - 1].split(',')[0];
    const bottomY = height - paddingBottom;
    return `M ${firstX},${bottomY} L ${pointsStr.replace(/ /g, ' L ')} L ${lastX},${bottomY} Z`;
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header & Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: '1.02rem',
              fontWeight: 800,
              color: '#003b70',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <LineChart size={19} color="#0284c7" />
            {title || `Biểu Đồ Xu Hướng Thay Đổi Thể Chất (${sorted.length} lần đo)`}
          </h4>
          {overallDelta && (
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Từ ngày {overallDelta.firstDate} ➔ {overallDelta.latestDate}
            </p>
          )}
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'ALL', label: 'Tất cả' },
              { id: 'WEIGHT', label: 'Cân nặng' },
              { id: 'MUSCLE', label: 'Cơ' },
              { id: 'FAT', label: '% Mỡ' },
              { id: 'SCORE', label: 'Điểm' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#003b70' : '#64748b',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend & Quick Summary Pills */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '12px',
          fontSize: '0.82rem',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(activeTab === 'ALL' || activeTab === 'WEIGHT') && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0284c7' }}>
              <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#0284c7' }} />
              Cân nặng (kg)
            </span>
          )}
          {(activeTab === 'ALL' || activeTab === 'MUSCLE') && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#15803d' }}>
              <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#15803d' }} />
              Khối lượng cơ (kg)
            </span>
          )}
          {(activeTab === 'ALL' || activeTab === 'FAT') && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#e11d48' }}>
              <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#e11d48' }} />
              Tỷ lệ % Mỡ
            </span>
          )}
          {activeTab === 'SCORE' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#7c3aed' }}>
              <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#7c3aed' }} />
              Điểm InBody Score (/100)
            </span>
          )}
        </div>

        {/* Delta Badges */}
        {overallDelta && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1px solid #bae6fd',
              }}
            >
              Δ Cân: {overallDelta.deltaWeight > 0 ? `+${overallDelta.deltaWeight}` : overallDelta.deltaWeight} kg
            </span>
            {overallDelta.deltaMuscle != null && (
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                }}
              >
                Δ Cơ: {overallDelta.deltaMuscle > 0 ? `+${overallDelta.deltaMuscle}` : overallDelta.deltaMuscle} kg
              </span>
            )}
            {overallDelta.deltaFat != null && (
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#fff1f2',
                  color: '#e11d48',
                  border: '1px solid #fecdd3',
                }}
              >
                Δ Mỡ: {overallDelta.deltaFat > 0 ? `+${overallDelta.deltaFat}` : overallDelta.deltaFat}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* SVG Interactive Chart */}
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: '600px', height: 'auto', overflow: 'visible', userSelect: 'none' }}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="muscleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingTop} x2={width - paddingX} y2={paddingTop} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingTop + plotHeight * 0.33} x2={width - paddingX} y2={paddingTop + plotHeight * 0.33} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingTop + plotHeight * 0.66} x2={width - paddingX} y2={paddingTop + plotHeight * 0.66} stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke="#e2e8f0" strokeWidth="1.5" />

          {/* Area Fills for Single Metric mode */}
          {activeTab === 'WEIGHT' && weightPoints && (
            <path d={buildAreaPath(weightPoints)} fill="url(#weightGrad)" />
          )}
          {activeTab === 'MUSCLE' && musclePoints && (
            <path d={buildAreaPath(musclePoints)} fill="url(#muscleGrad)" />
          )}
          {activeTab === 'FAT' && fatPoints && (
            <path d={buildAreaPath(fatPoints)} fill="url(#fatGrad)" />
          )}
          {activeTab === 'SCORE' && scorePoints && (
            <path d={buildAreaPath(scorePoints)} fill="url(#scoreGrad)" />
          )}

          {/* Polylines */}
          {(activeTab === 'ALL' || activeTab === 'WEIGHT') && weightPoints && (
            <polyline points={weightPoints} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {(activeTab === 'ALL' || activeTab === 'MUSCLE') && musclePoints && (
            <polyline points={musclePoints} fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={activeTab === 'ALL' ? '4 2' : 'none'} />
          )}
          {(activeTab === 'ALL' || activeTab === 'FAT') && fatPoints && (
            <polyline points={fatPoints} fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={activeTab === 'ALL' ? '3 2' : 'none'} />
          )}
          {activeTab === 'SCORE' && scorePoints && (
            <polyline points={scorePoints} fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Data Points and Column Highlights */}
          {sorted.map((item, idx) => {
            const cx = getX(idx);
            const cyWeight = getYWeight(item.weight);
            const cyMuscle = getYMuscle(item.muscleMass);
            const cyFat = getYFat(item.bodyFatPercentage);
            const cyScore = getYScore(item.inbodyScore);

            const isHovered = hoveredIdx === idx;
            const isSelected = activeIdx === idx;
            const dateStr = new Date(item.measurementDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

            return (
              <g
                key={item._id || idx}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setSelectedIdx(idx)}
              >
                {/* Vertical guideline */}
                <line
                  x1={cx}
                  y1={paddingTop}
                  x2={cx}
                  y2={height - paddingBottom}
                  stroke={isSelected ? '#0284c7' : isHovered ? '#94a3b8' : '#f1f5f9'}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeDasharray={isSelected ? 'none' : '2 2'}
                />

                {/* Circles & Labels: Clean, uncrowded rendering */}
                {(activeTab === 'ALL' || activeTab === 'WEIGHT') && (
                  <g>
                    <circle
                      cx={cx}
                      cy={cyWeight}
                      r={isSelected ? 6.5 : isHovered ? 5.5 : 4.5}
                      fill={isSelected ? '#0284c7' : '#ffffff'}
                      stroke="#0284c7"
                      strokeWidth={2.5}
                    />
                    {activeTab === 'WEIGHT' && (
                      <g>
                        <rect x={cx - 24} y={cyWeight - 24} width="48" height="18" rx="4" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
                        <text x={cx} y={cyWeight - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0284c7">
                          {item.weight}kg
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {(activeTab === 'ALL' || activeTab === 'MUSCLE') && item.muscleMass != null && (
                  <g>
                    <circle
                      cx={cx}
                      cy={cyMuscle}
                      r={isSelected ? 6 : isHovered ? 5 : 4}
                      fill={isSelected ? '#15803d' : '#ffffff'}
                      stroke="#15803d"
                      strokeWidth={2}
                    />
                    {activeTab === 'MUSCLE' && (
                      <g>
                        <rect x={cx - 28} y={cyMuscle - 24} width="56" height="18" rx="4" fill="#ffffff" stroke="#15803d" strokeWidth="1" />
                        <text x={cx} y={cyMuscle - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d">
                          {item.muscleMass}kg
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {(activeTab === 'ALL' || activeTab === 'FAT') && item.bodyFatPercentage != null && (
                  <g>
                    <circle
                      cx={cx}
                      cy={cyFat}
                      r={isSelected ? 6 : isHovered ? 5 : 4}
                      fill={isSelected ? '#e11d48' : '#ffffff'}
                      stroke="#e11d48"
                      strokeWidth={2}
                    />
                    {activeTab === 'FAT' && (
                      <g>
                        <rect x={cx - 24} y={cyFat - 24} width="48" height="18" rx="4" fill="#ffffff" stroke="#e11d48" strokeWidth="1" />
                        <text x={cx} y={cyFat - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#e11d48">
                          {item.bodyFatPercentage}%
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {activeTab === 'SCORE' && item.inbodyScore != null && (
                  <g>
                    <circle
                      cx={cx}
                      cy={cyScore}
                      r={isSelected ? 6.5 : isHovered ? 5.5 : 4.5}
                      fill={isSelected ? '#7c3aed' : '#ffffff'}
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                    />
                    <g>
                      <rect x={cx - 28} y={cyScore - 24} width="56" height="18" rx="4" fill="#ffffff" stroke="#7c3aed" strokeWidth="1" />
                      <text x={cx} y={cyScore - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#7c3aed">
                        {item.inbodyScore} đ
                      </text>
                    </g>
                  </g>
                )}

                {/* Floating summary pin when hovered in ALL tab */}
                {activeTab === 'ALL' && (isHovered || isSelected) && (
                  <g transform={`translate(${cx}, ${Math.max(14, Math.min(cyWeight, cyMuscle, cyFat) - 34)})`} pointerEvents="none">
                    <rect x="-48" y="0" width="96" height="22" rx="6" fill="#0f172a" opacity="0.92" />
                    <text x="0" y="14" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#ffffff">
                      {item.weight}kg · {item.bodyFatPercentage ?? '—'}% mỡ
                    </text>
                    <polygon points="-4,22 4,22 0,26" fill="#0f172a" opacity="0.92" />
                  </g>
                )}

                {/* X Axis Date Label */}
                <text
                  x={cx}
                  y={height - 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isSelected ? '800' : isHovered ? '700' : '600'}
                  fill={isSelected ? '#003b70' : isHovered ? '#0f172a' : '#64748b'}
                >
                  {dateStr}
                </text>
                <text
                  x={cx}
                  y={height - 7}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isSelected ? '700' : '500'}
                  fill={isSelected ? '#0284c7' : '#94a3b8'}
                >
                  Lần {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Prominent Inspection Card for Active / Selected Point */}
      {activeRecord && (
        <div
          style={{
            marginTop: '16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="#0284c7" />
            <div>
              <strong style={{ color: '#003b70', display: 'block', fontSize: '0.88rem' }}>
                Lần đo {activeIdx + 1} ({new Date(activeRecord.measurementDate).toLocaleDateString('vi-VN')})
                {activeIdx === sorted.length - 1 && (
                  <span style={{ marginLeft: '6px', fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    Mới nhất
                  </span>
                )}
              </strong>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                💡 Click vào bất kỳ lần đo nào trên biểu đồ để xem chi tiết
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
              ⚖️ Cân nặng: <strong style={{ color: '#003b70' }}>{activeRecord.weight} kg</strong>
            </span>
            {activeRecord.muscleMass != null && (
              <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                💪 Cơ: <strong style={{ color: '#15803d' }}>{activeRecord.muscleMass} kg</strong>
              </span>
            )}
            {activeRecord.bodyFatPercentage != null && (
              <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                🔥 % Mỡ: <strong style={{ color: '#e11d48' }}>{activeRecord.bodyFatPercentage}%</strong>
              </span>
            )}
            {activeRecord.visceralFatLevel != null && (
              <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                Mỡ nội tạng: <strong>Lv {activeRecord.visceralFatLevel}</strong>
              </span>
            )}
            {activeRecord.inbodyScore != null && (
              <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                ⭐ Điểm: <strong style={{ color: '#7c3aed' }}>{activeRecord.inbodyScore}/100</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
