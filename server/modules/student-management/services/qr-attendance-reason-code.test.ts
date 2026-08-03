import { describe, expect, it } from 'vitest';
import { QR_ATTENDANCE_ACCEPTED_REASON } from './qr-attendance.service';

describe('QR attendance accepted audit reason', () => {
  it('provides a reason code required by the attendance attempt schema', () => {
    expect(QR_ATTENDANCE_ACCEPTED_REASON).toBe('verified');
  });
});