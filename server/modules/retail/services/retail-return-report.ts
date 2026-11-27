import {RetailAfterSaleModel} from '../models/retail-after-sale.model';
import {parseRetailReportRange} from './retail-report-range';
import type {RetailScope} from '../contracts';
export function summarizeCompletedReturns(rows:Array<{customerId?:string|null;totalAmount:number}>){
 const ids=new Set<string>();let refundTotal=0,unidentifiedCount=0;
 for(const row of rows){if(!Number.isSafeInteger(row.totalAmount)||row.totalAmount<0)throw Object.assign(new Error('Số tiền hoàn không hợp lệ; cần đối chiếu chứng từ.'),{status:422});
  refundTotal+=row.totalAmount;if(!Number.isSafeInteger(refundTotal))throw Object.assign(new Error('Tổng tiền hoàn vượt phạm vi an toàn.'),{status:422});
  if(row.customerId?.trim())ids.add(row.customerId);else unidentifiedCount++;
 }
 return {customerCount:unidentifiedCount?null:ids.size,refundTotal,documentCount:rows.length,unidentifiedCount};
}
export async function retailReturnReport(scope:RetailScope,query:Record<string,unknown>){
 const range=parseRetailReportRange(query);
 const rows=await RetailAfterSaleModel.find({...scope,type:'return',status:'completed',businessDate:{$gte:range.from,$lte:range.to}}).select('customerId totalAmount').limit(10001).maxTimeMS(15000).lean();
 if(rows.length>10000)throw Object.assign(new Error('Báo cáo đổi trả vượt 10.000 phiếu; thu hẹp kỳ báo cáo.'),{status:422});
 return {...summarizeCompletedReturns(rows),from:range.from,to:range.to};
}
