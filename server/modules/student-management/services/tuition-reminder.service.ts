import {createHash,randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {Schema,model} from 'mongoose';
import {getJwtAccessSecret} from '../../../config/env';
import {companyEmailService} from '../../../service/company-email.service';
import {EmailService} from './email.service';
import {listTuitionBalances} from './tuition-balance.service';
const schema=new Schema({nonce:{type:String,required:true,unique:true},companyCode:String,userId:String,branchId:String,status:String,result:Schema.Types.Mixed},{timestamps:true});
const Dispatch=model('TuitionReminderDispatch',schema);
let dispatchIndex:Promise<unknown>|undefined;
export const tuitionMailContentDigest=(input:Record<string,unknown>)=>createHash('sha256').update(JSON.stringify([input.templateName||'',input.subject||'',input.content||''])).digest('hex');
const fail=(message:string,status=422):never=>{throw Object.assign(new Error(message),{status});};
export function tuitionRecipients(rows:Record<string,any>[]){
 const seen=new Set<string>();let skipped=0;
 const recipients=rows.flatMap(row=>{
  const email=String(row.email||'').trim().toLowerCase();
  if(!/^[^\s@,;<>]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)){skipped++;return [];}
  // One email per mailbox; do not disclose the other recipients in To/CC.
  if(seen.has(email))fail('Nhiều học viên dùng chung email. Chọn từng học viên để tránh ghép sai nội dung nhắc phí.');
  seen.add(email);return [{id:String(row._id),email,fullName:row.fullName,remainingAmount:row.remainingAmount}];
 });
 if(recipients.length>200)fail('Mỗi lượt chỉ gửi tối đa 200 email; thu hẹp theo lớp.');
 recipients.sort((a,b)=>a.email.localeCompare(b.email));return {recipients,skipped};
}
const digest=(rows:unknown)=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const audience='igen-tuition-reminder-confirmation';
type Scope={companyCode:string;userId:string;branchId?:string;owners:string|string[]};
export async function previewTuitionReminder(scope:Scope,batchId:string|undefined,contentDigest:string){
 if(!/^[a-f\d]{64}$/.test(contentDigest))fail('Nội dung email chưa hợp lệ.');
 const {recipients,skipped}=tuitionRecipients(await listTuitionBalances(scope.owners,scope.branchId,batchId));
 const snapshotToken=jwt.sign({purpose:audience,userId:scope.userId,companyCode:scope.companyCode,branchId:scope.branchId||'',batchId:batchId||'',recipientsDigest:digest(recipients),contentDigest,nonce:randomUUID()},getJwtAccessSecret(),{audience,expiresIn:'10m',algorithm:'HS256'});
 return {recipientCount:recipients.length,skippedCount:skipped,snapshotToken};
}
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function sendTuitionReminder(scope:Scope,input:Record<string,unknown>){
 const subject=String(input.subject||'').trim(),content=String(input.content||'').trim(),batchId=String(input.batchId||'')||undefined;
 if(!subject||subject.length>200||/[\r\n]/.test(subject)||!content||content.length>10000)fail('Cần tiêu đề từ 1–200 ký tự và nội dung từ 1–10.000 ký tự.');
 let token:any;try{token=jwt.verify(String(input.snapshotToken||''),getJwtAccessSecret(),{audience,algorithms:['HS256']});}catch{fail('Bản xác nhận email đã hết hiệu lực; cần xem trước lại.',409);}
 if(token.purpose!==audience||token.userId!==scope.userId||token.companyCode!==scope.companyCode||token.branchId!==(scope.branchId||'')||token.batchId!==(batchId||'')||token.contentDigest!==tuitionMailContentDigest(input))fail('Phạm vi hoặc nội dung đã đổi; cần xác nhận lại.',409);
 const {recipients}=tuitionRecipients(await listTuitionBalances(scope.owners,scope.branchId,batchId));
 if(digest(recipients)!==token.recipientsDigest)fail('Danh sách người nhận hoặc số nợ đã đổi; cần xem trước và xác nhận lại.',409);
 if(!recipients.length)return {sentCount:0,recipientCount:0};
 dispatchIndex??=Dispatch.collection.createIndex({nonce:1},{unique:true});await dispatchIndex;
 try{await Dispatch.create({nonce:token.nonce,companyCode:scope.companyCode,userId:scope.userId,branchId:scope.branchId,status:'sending'});}catch(error:any){
  if(error?.code!==11000)throw error;
  const existing=await Dispatch.findOne({nonce:token.nonce,companyCode:scope.companyCode,userId:scope.userId}).lean();
  if(existing?.status==='sent')return existing.result;
  fail('Lượt gửi đã bắt đầu nhưng chưa xác định đầy đủ kết quả. Không gửi lại để tránh trùng thư.',409);
 }
 let sentCount=0;
 try{
  const settings=await companyEmailService.resolveLegacySettings(scope.companyCode);
  for(const row of recipients){
   const render=(value:string)=>value.replaceAll('{fullName}',String(row.fullName)).replaceAll('{remainingAmount}',Number(row.remainingAmount).toLocaleString('vi-VN'));
   const result=await EmailService.sendMail({to:row.email,subject:render(subject).replace(/[\r\n]/g,' '),html:escape(render(content)).replace(/\r?\n/g,'<br>')},settings);
   if(!result.success)throw new Error('Không xác định được đầy đủ kết quả gửi thư.');
   sentCount++;
  }
  const result={sentCount,recipientCount:recipients.length};await Dispatch.updateOne({nonce:token.nonce},{$set:{status:'sent',result}});return result;
 }catch(error){await Dispatch.updateOne({nonce:token.nonce},{$set:{status:'uncertain',result:{sentCount,recipientCount:recipients.length}}});fail(`Đã xác nhận gửi ${sentCount}/${recipients.length} thư; phần còn lại cần kiểm tra trước khi gửi tiếp. Không tự gửi lại.`,502);}
}
