import { describe, expect, it } from 'vitest';
import { businessCalendarRange, businessDateKey, parseBusinessDate } from './business-calendar';

describe('Vietnam business calendar', () => {
  it('rejects normalized, invalid and missing dates while accepting a leap day', () => {
    for (const value of ['', '2026-02-30', '2026-02-29', '2026-13-01', '2026-10-00', '2026-1-01']) expect(parseBusinessDate(value)).toBeNull();
    expect(parseBusinessDate('2028-02-29')).toEqual(new Date('2028-02-28T17:00:00Z'));
    expect(businessCalendarRange('custom', '2026-02-30', '2026-03-05')).toBeNull();
  });
  it('uses Vietnam dates across UTC midnight, month, quarter and year boundaries', () => {
    const now = new Date('2026-12-31T17:01:00Z');
    expect(businessDateKey(now)).toBe('2027-01-01');
    for (const period of ['day', 'month', 'quarter', 'year']) {
      const range = businessCalendarRange(period, '', '', now)!;
      expect(range.start).toEqual(new Date('2026-12-31T17:00:00Z')); expect(range.end).toEqual(now);
    }
    expect(businessCalendarRange('week', '', '', now)?.start).toEqual(new Date('2026-12-27T17:00:00Z'));
  });
  it('keeps custom dates inclusive and does not depend on the clock', () => {
    const range = businessCalendarRange('custom', '2026-10-01', '2026-10-02')!;
    expect(range.start).toEqual(new Date('2026-09-30T17:00:00Z'));
    expect(range.end).toEqual(new Date('2026-10-02T16:59:59.999Z'));
    expect(businessCalendarRange('custom', '2026-10-03', '2026-10-02')).toBeNull();
  });
});
