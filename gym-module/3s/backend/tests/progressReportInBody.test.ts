import { describe, expect, it } from 'vitest';
import { analyzeProgress } from '../services/progressAnalyticsService.js';
import { generateProgressReport } from '../services/progressReportGenerator.js';

describe('InBody progress integration', () => {
  it('calculates body deltas accurately from InBody measurements', () => {
    const measurements = [
      {
        measuredAt: '2026-08-01T08:00:00.000Z',
        weight: 75.5,
        bodyFatPercentage: 24.2,
        muscleMass: 31.0,
        measurements: {
          bodyFatMass: 18.2,
          visceralFatLevel: 8,
          inbodyScore: 72,
        },
      },
      {
        measuredAt: '2026-08-30T08:00:00.000Z',
        weight: 73.0,
        bodyFatPercentage: 21.5,
        muscleMass: 32.2,
        measurements: {
          bodyFatMass: 15.7,
          visceralFatLevel: 6,
          inbodyScore: 78,
        },
      },
    ];

    const analytics = analyzeProgress({
      sessions: [
        {
          performedAt: '2026-08-05T10:00:00.000Z',
          attendance: 'PRESENT',
          exerciseLogs: [
            {
              name: 'Barbell Squat',
              trackingType: 'STRENGTH',
              sets: [{ weight: 80, reps: 10, completed: true, rpe: 8 }],
            },
          ],
        },
      ],
      measurements,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });

    expect(analytics.bodyDeltas).toMatchObject({
      weight: -2.5,
      bodyFatPercentage: -2.7,
      bodyFatMass: -2.5,
      muscleMass: 1.2,
      visceralFatLevel: -2,
      inbodyScore: 6,
    });
    expect(analytics.dataQuality.level).toBe('COMPLETE');

    const report = generateProgressReport(analytics, {
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });

    expect(report.summary).toContain('cân nặng giảm 2,5 kg');
    expect(report.summary).toContain('tỷ lệ mỡ giảm 2,7%');
    expect(report.summary).toContain('khối lượng mỡ giảm 2,5 kg');
    expect(report.summary).toContain('khối lượng cơ tăng 1,2 kg');
    expect(report.summary).toContain('mỡ nội tạng giảm 2 cấp');
    expect(report.summary).toContain('điểm InBody tăng 6 điểm');

    expect(report.metrics).toMatchObject({
      weightDelta: -2.5,
      bodyFatDelta: -2.7,
      bodyFatMassDelta: -2.5,
      muscleDelta: 1.2,
      visceralFatDelta: -2,
      inbodyScoreDelta: 6,
    });
  });
});
