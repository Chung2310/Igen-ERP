import { ValidationError } from '../../../errors/app-error';
import { businessDateKey } from '../../../../shared/business-calendar';
import { parsePaymentDate } from '../utils/payment-date.util';
import { partnerReadPeriod } from './partner-read-period';

export interface PartnerPayoutReadFilters { from?: string; to?: string; search?: string }
interface PartnerPayoutSource { name: string; payoutHistory?: Array<{amount:number;date:string;method?:string}> }

/** Calendar precision is all legacy payouts guarantee. Keep all transactions
 * on the latest day rather than inventing an order within that day. */
export function partnerPayoutDay(value: string) {
  value=value.trim();
  const parsed=parsePaymentDate(value);
  if(!parsed)throw new ValidationError('PARTNER_PAYOUT_HISTORY_INVALID','Lịch sử chi trả có ngày không hợp lệ. Chưa thể kết luận theo thời gian.');
  if(value.includes('T')){
    if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):?[0-5]\d)?$/i.test(value))throw new ValidationError('PARTNER_PAYOUT_HISTORY_INVALID','Lịch sử chi trả có thời gian không hợp lệ.');
    const instant=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?value:value+'+07:00');
    if(!Number.isFinite(instant.getTime()))throw new ValidationError('PARTNER_PAYOUT_HISTORY_INVALID','Lịch sử chi trả có thời gian không hợp lệ.');
    return businessDateKey(instant);
  }
  return parsed.toISOString().slice(0,10);
}

export async function collectPartnerPayoutHistory(partners: AsyncIterable<PartnerPayoutSource>, filters: PartnerPayoutReadFilters) {
  const period=partnerReadPeriod(filters.from,filters.to);
  const rows:Array<{partnerName:string;paidOn:string;amount:number;method:string}>=[];
  let partnersRead=0,entriesRead=0;
  for await(const partner of partners){
    if(++partnersRead>10000)throw new ValidationError('PARTNER_REPORT_TOO_LARGE','Có quá nhiều đối tác để đọc đầy đủ. Bạn chọn một đối tác hoặc thu hẹp phạm vi nhé.');
    if(typeof partner.name!=='string'||!partner.name.trim()||partner.payoutHistory!=null&&!Array.isArray(partner.payoutHistory))throw new ValidationError('PARTNER_PAYOUT_HISTORY_INVALID','Chưa đọc được lịch sử chi trả đầy đủ.');
    for(const payout of partner.payoutHistory || []){
      if(++entriesRead>10000)throw new ValidationError('PARTNER_REPORT_TOO_LARGE','Có quá nhiều khoản chi trả để đọc đầy đủ. Bạn chọn một đối tác nhé.');
      if(!payout||typeof payout.date!=='string'||!Number.isSafeInteger(payout.amount)||payout.amount<=0)throw new ValidationError('PARTNER_PAYOUT_HISTORY_INVALID','Lịch sử chi trả có số tiền hoặc ngày không hợp lệ. Chưa thể tổng hợp.');
      const day=partnerPayoutDay(payout.date);
      if(period && (day<period.from||day>period.to))continue;
      rows.push({partnerName:partner.name,paidOn:day,amount:payout.amount,method:payout.method || ''});
    }
  }
  return {data:rows,analysisComplete:true as const};
}
