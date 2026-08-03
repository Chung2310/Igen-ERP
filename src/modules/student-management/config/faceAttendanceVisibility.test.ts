import { describe, expect, it } from 'vitest';
import { isFaceAttendanceVisible } from './faceAttendanceVisibility';

describe('face attendance visibility by module', () => {
  it('hides face attendance for student and labor business types', () => {
    expect(isFaceAttendanceVisible({ businessType: 'education' }, 'student')).toBe(false);
    expect(isFaceAttendanceVisible({ businessType: 'labor' }, 'worker')).toBe(false);
  });

  it('keeps QR, location, and face attendance available for other business types', () => {
    expect(isFaceAttendanceVisible({ businessType: 'service' }, 'student')).toBe(true);
    expect(isFaceAttendanceVisible({ businessType: 'education' }, 'worker')).toBe(true);
  });
});