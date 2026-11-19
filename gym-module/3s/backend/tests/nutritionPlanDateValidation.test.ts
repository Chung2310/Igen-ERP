import { describe, expect, it } from 'vitest';
import { nutritionPlanSchemas } from '../validators/contentValidator.js';

describe('nutritionPlanSchemas date range validation', () => {
  const validBase = {
    customerId: '507f1f77bcf86cd799439011',
    title: 'Thực đơn 7 ngày',
    targetCalories: 2000,
    macros: { protein: 150, carbs: 200, fat: 60 },
  };

  it('accepts a valid 7-day date range', () => {
    const payload = {
      ...validBase,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-07T00:00:00.000Z',
      durationDays: 7,
    };
    const { error } = nutritionPlanSchemas.create.body.validate(payload);
    expect(error).toBeUndefined();
  });

  it('accepts a maximum 31-day date range', () => {
    const payload = {
      ...validBase,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-10-01T00:00:00.000Z',
      durationDays: 31,
    };
    const { error } = nutritionPlanSchemas.create.body.validate(payload);
    expect(error).toBeUndefined();
  });

  it('rejects when endDate is earlier than startDate', () => {
    const payload = {
      ...validBase,
      startDate: '2026-09-10T00:00:00.000Z',
      endDate: '2026-09-05T00:00:00.000Z',
    };
    const { error } = nutritionPlanSchemas.create.body.validate(payload);
    expect(error).toBeDefined();
    expect(error?.message).toContain('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
  });

  it('rejects when date range exceeds 31 days', () => {
    const payload = {
      ...validBase,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-10-15T00:00:00.000Z', // 45 days
    };
    const { error } = nutritionPlanSchemas.create.body.validate(payload);
    expect(error).toBeDefined();
    expect(error?.message).toContain('Khoảng thời gian áp dụng thực đơn tối đa là 1 tháng (31 ngày)');
  });

  it('validates date range in update schema', () => {
    const invalidUpdate = {
      startDate: '2026-09-15T00:00:00.000Z',
      endDate: '2026-09-01T00:00:00.000Z',
    };
    const { error } = nutritionPlanSchemas.update.body.validate(invalidUpdate);
    expect(error).toBeDefined();
    expect(error?.message).toContain('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
  });
});
