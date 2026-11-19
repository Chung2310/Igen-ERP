import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Utensils,
  Zap,
} from 'lucide-react';
import type { Roadmap } from './RoadmapForm';

export default function RoadmapTimeline({ roadmap }: { roadmap: Roadmap }) {
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  const strategy = roadmap.strategy;

  const togglePhase = (order: number) => {
    setExpandedPhases((prev) => ({ ...prev, [order]: !prev[order] }));
  };

  return (
    <div style={{ display: 'grid', gap: '8px', marginTop: '6px', width: '100%', minWidth: 0, boxBoxSizing: 'border-box' } as any}>
      {/* Strategy Summary Pills */}
      {strategy && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            display: 'grid',
            gap: '6px',
            fontSize: '0.78rem',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Training split & Calories */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', minWidth: 0 }}>
            <span
              style={{
                fontWeight: 700,
                color: 'var(--primary-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                wordBreak: 'break-word',
                lineHeight: 1.3,
                flex: '1 1 auto',
                minWidth: 0,
              }}
            >
              <Zap size={13} color="#eab308" style={{ flexShrink: 0 }} />
              <span>{strategy.trainingSplit || `${strategy.sessionsPerWeek || 3} buổi/tuần`}</span>
            </span>

            {strategy.nutrition && (
              <span
                style={{
                  fontWeight: 700,
                  color: '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: '#f0fdf4',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #bbf7d0',
                }}
              >
                <Utensils size={11} />
                <span>{strategy.nutrition.targetCalories} kcal{strategy.nutrition.proteinGrams ? ` (P: ${strategy.nutrition.proteinGrams}g)` : ''}</span>
              </span>
            )}
          </div>

          {/* Cardio Protocol */}
          {strategy.cardioProtocol && (
            <div
              style={{
                color: '#475569',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '0.74rem',
                lineHeight: 1.4,
                wordBreak: 'break-word',
                minWidth: 0,
              }}
            >
              <HeartPulse size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ minWidth: 0 }}>{strategy.cardioProtocol}</span>
            </div>
          )}

          {/* Checkpoints */}
          {strategy.checkpoints && strategy.checkpoints.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px', minWidth: 0 }}>
              {strategy.checkpoints.map((cp, idx) => (
                <span
                  key={idx}
                  style={{
                    background: '#ede9fe',
                    color: '#5b21b6',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    wordBreak: 'break-word',
                    lineHeight: 1.2,
                  }}
                >
                  <CheckCircle2 size={10} style={{ flexShrink: 0 }} />
                  <span>T{cp.week}: {cp.title.split(':')[0]}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase Timeline Accordion */}
      <ol
        aria-label={`Timeline ${roadmap.title}`}
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: '6px',
          width: '100%',
          minWidth: 0,
        }}
      >
        {[...roadmap.phases]
          .sort((left, right) => left.order - right.order)
          .map((phase) => {
            const isExpanded = Boolean(expandedPhases[phase.order]);
            const cleanPhaseName = phase.name.replace(
              new RegExp(`^Phase\\s*${phase.order}\\s*[:\\-]\\s*`, 'i'),
              ''
            );

            return (
              <li
                key={phase.order}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isExpanded ? '#f1f5f9' : '#f8fafc',
                    userSelect: 'none',
                    gap: '8px',
                    minWidth: 0,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onClick={() => togglePhase(phase.order)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        background: 'var(--secondary-color)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      P{phase.order}
                    </span>
                    <strong
                      style={{
                        fontSize: '0.8rem',
                        color: '#0f172a',
                        wordBreak: 'break-word',
                        lineHeight: 1.3,
                        minWidth: 0,
                      }}
                    >
                      {cleanPhaseName}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#64748b',
                        background: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {phase.durationWeeks} tuần
                    </span>
                    {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                  </div>
                </div>

                {isExpanded && phase.weeks && phase.weeks.length > 0 && (
                  <div
                    style={{
                      padding: '8px 10px',
                      display: 'grid',
                      gap: '6px',
                      borderTop: '1px solid #e2e8f0',
                      background: '#fafbfc',
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    {phase.weeks.map((w, wIdx) => (
                      <div
                        key={wIdx}
                        style={{
                          fontSize: '0.75rem',
                          background: '#ffffff',
                          padding: '6px 8px',
                          borderRadius: '5px',
                          border: '1px solid #e2e8f0',
                          width: '100%',
                          minWidth: 0,
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', minWidth: 0 }}>
                          <strong style={{ color: '#0284c7' }}>Tuần {w.week}:</strong>
                          <span style={{ color: '#64748b', fontSize: '0.7rem', flexShrink: 0 }}>{w.sessionTargets || 3} buổi</span>
                        </div>
                        <div style={{ color: '#334155', lineHeight: 1.4, wordBreak: 'break-word' }}>{w.focus}</div>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
      </ol>
    </div>
  );
}


