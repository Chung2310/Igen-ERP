import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const state=vi.hoisted(()=>({rows:[] as any[],records:new Map<string,any>(),send:vi.fn(),balances:vi.fn()}));
vi.mock('./tuition-balance.service',()=>({listTuitionBalances:state.balances}));
vi.mock('./email.service',()=>({EmailService:{sendMail:state.send}}));
vi.mock('../../../service/company-email.service',()=>({companyEmailService:{resolveLegacySettings:async()=>({smtpHost:'fixture'})}}));
vi.mock('mongoose',async original=>{
 const actual=await original<typeof import('mongoose')>();
 return {...actual,model:(name:string,...args:any[])=>name==='TuitionReminderDispatch'?{
  collection:{createIndex:async()=>{}},create:async(input:any)=>{if(state.records.has(input.nonce))throw {code:11000};state.records.set(input.nonce,{...input});},
  findOne:(filter:any)=>({lean:async()=>state.records.get(filter.nonce)}),
  updateOne:async(filter:any,update:any)=>Object.assign(state.records.get(filter.nonce),update.$set),
 }:(actual.model as any)(name,...args)};
});
import {previewTuitionReminder,sendTuitionReminder,tuitionMailContentDigest,tuitionRecipients} from './tuition-reminder.service';
const scope={companyCode:'QA',userId:'actor',branchId:'branch',owners:['actor']};
const content={templateName:'Nhắc phí',subject:'QA {fullName}',content:'Xin chào {fullName}, còn {remainingAmount}.'};
beforeEach(()=>{vi.stubEnv('JWT_ACCESS_SECRET','synthetic-offline-secret-32-characters-only');state.rows=[{_id:'s1',fullName:'QA A',email:'a@example.test',remainingAmount:100},{_id:'s2',fullName:'QA B',email:'b@example.test',remainingAmount:200}];state.records.clear();state.send.mockReset().mockResolvedValue({success:true});state.balances.mockReset().mockImplementation(async()=>state.rows);});
afterEach(()=>vi.unstubAllEnvs());
it('pins scope, content and recipient debt before sending, deduplicates a replay and isolates each mailbox',async()=>{
 const preview=await previewTuitionReminder(scope,undefined,tuitionMailContentDigest(content));
 expect(preview.recipientCount).toBe(2);expect(preview.snapshotToken).not.toContain('a@example.test');
 const input={...content,snapshotToken:preview.snapshotToken};
 expect(await sendTuitionReminder(scope,input)).toEqual({sentCount:2,recipientCount:2});
 expect(state.send.mock.calls.map(([v])=>v.to)).toEqual(['a@example.test','b@example.test']);
 expect(await sendTuitionReminder(scope,input)).toEqual({sentCount:2,recipientCount:2});expect(state.send).toHaveBeenCalledTimes(2);
});
it('rejects changed content, another actor and changed debt without sending',async()=>{
 const preview=await previewTuitionReminder(scope,undefined,tuitionMailContentDigest(content)),input={...content,snapshotToken:preview.snapshotToken};
 await expect(sendTuitionReminder(scope,{...input,content:'Khác'})).rejects.toThrow('nội dung');
 await expect(sendTuitionReminder({...scope,userId:'another'},input)).rejects.toThrow('Phạm vi');
 state.rows[0].remainingAmount=101;await expect(sendTuitionReminder(scope,input)).rejects.toThrow('số nợ');expect(state.send).not.toHaveBeenCalled();
});
it('does not resend any mailbox after a partial or uncertain send',async()=>{
 const preview=await previewTuitionReminder(scope,undefined,tuitionMailContentDigest(content)),input={...content,snapshotToken:preview.snapshotToken};
 state.send.mockResolvedValueOnce({success:true}).mockResolvedValueOnce({success:false});
 await expect(sendTuitionReminder(scope,input)).rejects.toThrow('1/2');
 await expect(sendTuitionReminder(scope,input)).rejects.toThrow('Không gửi lại');expect(state.send).toHaveBeenCalledTimes(2);
});
it('skips missing email, refuses ambiguous shared mailboxes and accepts a stable recipient order',()=>{
 expect(tuitionRecipients([...state.rows,{_id:'s3',email:'',remainingAmount:1}]).skipped).toBe(1);
 expect(()=>tuitionRecipients([...state.rows,{_id:'s3',email:'a@example.test'}])).toThrow('dùng chung email');
 expect(tuitionRecipients([...state.rows].reverse()).recipients).toEqual(tuitionRecipients(state.rows).recipients);
});
