import { parseBusinessDate } from '../../../../shared/business-calendar';
import { parsePaymentDate } from '../utils/payment-date.util';
import { ValidationError } from '../../../errors/app-error';

/** Inclusive calendar dates; query dates are never parsed in the host timezone. */
export function partnerReadPeriod(from: unknown, to: unknown) {
  if ((from === undefined || from === '') && (to === undefined || to === '')) return undefined;
  const first = typeof from === 'string' ? parseBusinessDate(from) : null;
  const last = typeof to === 'string' ? parseBusinessDate(to) : null;
  if (!first || !last || first > last) throw new ValidationError('PARTNER_PERIOD_INVALID', 'Cần khoảng ngày từ/đến hợp lệ theo định dạng YYYY-MM-DD.');
  return {from: from as string, to: to as string, start: first, end: new Date(last.getTime() + 86400000 - 1)};
}

export function referredStudentInPeriod(registrationDate: unknown, period: ReturnType<typeof partnerReadPeriod>) {
  if (!period) return true;
  const parsed = parsePaymentDate(registrationDate);
  if (!parsed) throw new ValidationError('PARTNER_REFERRAL_DATE_MISSING', 'Có học viên giới thiệu thiếu ngày đăng ký hợp lệ; chưa thể kết luận đầy đủ theo kỳ.');
  const day = parsed.toISOString().slice(0,10);
  return day >= period.from && day <= period.to;
}
