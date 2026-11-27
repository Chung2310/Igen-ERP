import {Types} from 'mongoose';
import {Student} from '../models/student.model';
import {Payment} from '../models/payment.model';
import {Batch} from '../models/batch.model';
const invalid=(message:string):never=>{throw Object.assign(new Error(message),{status:422});};
function amount(value:unknown){
 if(value==null||value==='')return 0;
 const result=typeof value==='number'?value:typeof value==='string'&&/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(value.trim())?Number(value.trim().replace(/[.,]/g,'')):NaN;
 if(!Number.isSafeInteger(result)||result<0)invalid('Số tiền học phí chưa hợp lệ; cần đối chiếu dữ liệu trước khi kết luận.');
 return result;
}
export function buildTuitionBalances(students:Record<string,any>[],receipts:Record<string,any>[]){
 const paid=new Map<string,number>();
 for(const row of receipts){if(typeof row.studentId!=='string'||row.amount==null)invalid('Phiếu thu thiếu học viên hoặc số tiền.');const total=(paid.get(row.studentId)||0)+amount(row.amount);if(!Number.isSafeInteger(total))invalid('Tổng phiếu thu vượt phạm vi số tiền an toàn.');paid.set(row.studentId,total);}
 return students.flatMap(student=>{
  if(student.fee==null)invalid('Hồ sơ học viên thiếu tổng học phí; chưa thể kết luận dư nợ.');
  const fee=amount(student.fee),id=String(student._id),paidAmount=paid.has(id)?paid.get(id)!:amount(student.paidAmount),remainingAmount=Math.max(0,fee-paidAmount);
  if(remainingAmount>0&&!String(student.fullName||'').trim())invalid('Hồ sơ còn nợ thiếu tên học viên để đối chiếu.');
  return remainingAmount>0?[{_id:id,fullName:String(student.fullName||''),email:String(student.email||''),fee,paidAmount,remainingAmount}]:[];
 });
}
export async function listTuitionBalances(owners:string|string[],branchId?:string,batchId?:string){
 if(!branchId)invalid('Chọn chi nhánh trước khi đối chiếu học phí.');
 const scope={...(owners==='ALL'?{}:{ownerId:Array.isArray(owners)?{$in:owners}:owners}),...(branchId?{branchId}:{})};
 let ids:string[]|undefined;
 if(batchId){
  if(!Types.ObjectId.isValid(batchId))invalid('Mã lớp không hợp lệ.');
  const batch=await Batch.findOne({_id:batchId,...scope}).select('learnerIds').lean();
  if(!batch)throw Object.assign(new Error('Không tìm thấy lớp trong phạm vi được phép.'),{status:404});
  ids=[...new Set(batch.learnerIds.map(String))];
 }
 const students=await Student.find({...scope,...(ids?{_id:{$in:ids}}:{})}).select('fullName email fee paidAmount').limit(10001).maxTimeMS(15000).lean();
 if(students.length>10000)invalid('Phạm vi đối chiếu vượt 10.000 học viên; chọn một lớp để thu hẹp.');
 if(!students.length)return [];
 const receipts=await Payment.find({...scope,studentId:{$in:students.map(s=>String(s._id))}}).select('studentId amount').limit(100001).maxTimeMS(15000).lean();
 if(receipts.length>100000)invalid('Phạm vi đối chiếu vượt giới hạn phiếu thu; chọn một lớp để thu hẹp.');
 return buildTuitionBalances(students,receipts);
}
