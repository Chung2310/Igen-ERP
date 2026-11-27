import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

const state=vi.hoisted(()=>({session:null as any,turns:[] as any[],provider:vi.fn(),interpret:vi.fn(),allowed:[] as string[]}));
vi.mock('../service/openrouter.service',()=>({openrouterChat:state.provider}));
vi.mock('./models',()=>{
 const apply=(record:any,update:any)=>{for(const [key,value] of Object.entries(update.$set||{})){const path=key.split('.');let at=record;for(const part of path.slice(0,-1))at=at[part]??={};at[path.at(-1)!]=structuredClone(value);}};
 const chain=(get:()=>any):any=>({sort:()=>chain(get),select:()=>chain(get),lean:async()=>structuredClone(get())});
 return {ensureAssistantIndexes:vi.fn(),AssistantDocumentModel:{create:vi.fn()},
 AssistantSessionModel:{findOne:vi.fn(()=>chain(()=>state.session)),findOneAndUpdate:vi.fn(async()=>{state.session.busy=true;return structuredClone(state.session);}),updateOne:vi.fn(async(_f,u)=>{state.session??={messages:[],pending:null,busy:false,messageCount:0};apply(state.session,u);})},
 AssistantTurnModel:{create:vi.fn(async input=>{const turn={...input,_id:String(state.turns.length+1),createdAt:new Date(),updatedAt:new Date(),status:'processing'};state.turns.push(turn);return turn;}),updateOne:vi.fn(async(f,u)=>apply(state.turns.find(t=>t._id===f._id),u)),findOne:vi.fn(f=>chain(()=>[...state.turns].reverse().find(t=>f.requestId?t.requestId===f.requestId:t.actionId&&t.result?.status==='completed')))}};
});
vi.mock('./workflows',async()=>{
 const {ASSISTANT_OPERATIONS,operationById,defaultWorkflow}=await import('./catalog');
 const {AssistantError}=await import('./policy');
 return {actorScope:()=>({userId:'actor',companyCode:'TEST'}),
 assertOperation:vi.fn(async(_r,id)=>{const op=operationById(id);if(!op||state.allowed.length&&!state.allowed.includes(id))throw new AssistantError('Không có quyền.',403);return op;}),
 currentWorkflow:vi.fn(async(_r,id)=>defaultWorkflow(operationById(id)!)),
 listWorkflows:vi.fn(async()=>ASSISTANT_OPERATIONS.filter(o=>!o.unavailableReason&&(!state.allowed.length||state.allowed.includes(o.id))).map(defaultWorkflow))};
});
vi.mock('./settings',async()=>{const {defaultAssistantSettings}=await import('../../src/shared/assistant-workflow');return {getSettings:vi.fn(async()=>({...defaultAssistantSettings,alwaysConfirm:true,memoryEnabled:false,autoMemoryEnabled:false,responseRules:''}))};});
vi.mock('./semantic-interpreter',async original=>{const actual=await original<typeof import('./semantic-interpreter')>();return {...actual,interpretRequest:(...args:any[])=>state.interpret.getMockImplementation()?state.interpret(...args):(actual.interpretRequest as any)(...args)};});
vi.mock('./reply-rules',()=>({applyAssistantResponseRules:async(reply:any)=>reply}));
vi.mock('./documents',()=>({answerAssistantConversation:vi.fn()}));
vi.mock('./session-memory',()=>({SESSION_MEMORY_LIMIT:2400,summarizeAssistantSession:async()=>null}));

import {processTurn,conversationState} from './service';
import {AssistantDocumentModel} from './models';
import {operationById,defaultWorkflow,ASSISTANT_OPERATIONS} from './catalog';
import {PlanStoppedError} from './execution-budget';
import {AssistantInterpretationError} from './interpretation-error';
import {assistantFunctionKey} from './function-context';
import {parseAssistantResultTable} from '../../src/shared/assistant-result-table';
import {parseSemanticRequest,bindSemanticRequest} from './semantic-request';
const captures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-remaining25-retry.json',import.meta.url),'utf8'));

it.each(['true','false'])('restores an unanswered proposal after session reload and keeps form/confirmation (semantic rollout %s)',async semanticFlag=>{
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT',semanticFlag);
 state.allowed=['student.exam.create','batch.list'];
 const text='Tạo kỳ thi QA Cuối môn ngày 27/11/2026 lúc 14h tại phòng P102';
 const question='Mình chưa lưu được giờ 14h. Bạn muốn tiếp tục tạo kỳ thi chỉ với ngày và phòng không?';
 state.interpret.mockResolvedValueOnce({intentType:'ambiguous',actionId:null,values:{},clarification:question});
 const first=await turn({text});
 expect(first.status).toBe('collecting');expect(state.session.pending).toBeNull();
 expect(state.session.clarificationContext).toMatchObject({text,question:first.reply});
 // Persistence, not component memory: restore a JSON round trip with no pending action.
 state.session=JSON.parse(JSON.stringify(state.session));
 expect(state.session.messages.map((m:any)=>m.content)).toEqual([text,first.reply]);
 const restored=await conversationState(req,'remaining-twelve');
 expect(restored.messages.map((m:any)=>m.content)).toEqual([text,first.reply]);
 expect(restored.lastReply?.reply).toBe(first.reply);
 state.interpret.mockReset();
 const units=[
  {id:'u1',kind:'goal',quote:'Tạo kỳ thi',concept:'Tạo kỳ thi',operator:'create',value:null,dimension:'none'},
  ...[['u2','QA Cuối môn','QA Cuối môn'],['u3','27/11/2026','2026-11-27'],['u4','P102','P102']].map(([id,quote,value])=>({id,kind:'input',quote,concept:quote,operator:'eq',value,dimension:'none'})),
 ];
 const plan={intentType:'workflow',actionId:'student.exam.create',actionIntent:'create',values:{name:'QA Cuối môn',tentativeDate:'2026-11-27',location:'P102'},meaningBindings:[
  {unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.name']},{unitId:'u3',targets:['values.tentativeDate']},{unitId:'u4',targets:['values.location']},
 ]};
 model({meaning:{version:1,dialogue:{act:'continue',evidence:'ok'},units},plan});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const path=new URL(String(raw)).pathname;
  if(path.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  if(path==='/api/v1/batches')return json({batches:[{_id:'64b000000000000000000091',name:'QA Lớp 01',code:'QA-LOP-01',status:'Đang học'}],total:1,page:1});
  throw Error('UNEXPECTED_CLARIFICATION_ROUTE:'+path);
 });
 let reply=await turn({text:'ok'});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');
 expect(state.session.pending.provided).toMatchObject(plan.values);
 expect(state.session.pending.intent).toContain(text);
 expect(reply.inputForm).toBeDefined();
 expect(reply.reply).not.toContain('Bạn cần mình hỗ trợ việc gì');
 const batch=reply.referenceSelections?.find((s:any)=>s.key==='batchId');
 expect(batch?.options.some((o:any)=>o.label.includes('QA Lớp 01'))).toBe(true);
 const status=reply.referenceSelections?.find(s=>s.key==='status')?.options.find(o=>o.label==='Sắp diễn ra');
 expect(status).toBeDefined();
 reply=await turn({formValues:{id:reply.inputForm!.id,values:{},referenceSelections:{batchId:[batch!.options[0].value],status:[status!.value]},skipReferenceKeys:reply.referenceSelections?.filter(s=>!s.required).map(s=>s.key)||[]}});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');
 expect(JSON.stringify(reply.action)).toContain('P102');expect(JSON.stringify(reply.action)).toContain('27/11/2026');
 expect(state.session.pending.provided).toMatchObject(plan.values);
 expect(state.session.clarificationContext).toBeNull();
 expect(fetcher.mock.calls.every(([,init]:any)=>!init?.method||init.method==='GET')).toBe(true);
});

it('keeps the original clarification across an unsuccessful acknowledgement repair and cancels it explicitly',async()=>{
 const text='Thêm lao động QA Mới',question='Bạn cho mình số điện thoại của lao động QA Mới nhé.';
 state.interpret.mockResolvedValueOnce({intentType:'ambiguous',actionId:null,values:{},clarification:question});
 const first=await turn({text});expect(first.status).toBe('collecting');
 state.session=JSON.parse(JSON.stringify(state.session));state.interpret.mockReset();
 state.provider.mockResolvedValue({text:JSON.stringify({version:1,dialogue:{act:'continue',evidence:'ok'},units:[{id:'u1',kind:'framing',quote:'ok',concept:'Đồng ý câu hỏi trước',operator:'none',value:null,dimension:'none'}]})});
 const reply=await turn({text:'ok'});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');expect(reply.reply).toContain('số điện thoại');
 expect(state.session.clarificationContext.text).toBe(text);expect(state.session.messages).toHaveLength(4);
 expect(state.session.pending).toBeNull();expect(state.provider).toHaveBeenCalledTimes(2);
 state.provider.mockResolvedValue({text:JSON.stringify({version:1,dialogue:{act:'cancel',evidence:'Thôi bỏ đi'},units:[{id:'u1',kind:'framing',quote:'Thôi bỏ đi',concept:'Hủy việc đang hỏi',operator:'none',value:null,dimension:'none'}]})});
 const cancelled=await turn({text:'Thôi bỏ đi'});
 expect(cancelled.status).toBe('cancelled');expect(cancelled.reply).toContain('đã dừng yêu cầu');expect(state.session.clarificationContext).toBeNull();
});

it('does not pass a clarification from a different conversation scope to the next turn',async()=>{
 state.interpret.mockResolvedValueOnce({intentType:'ambiguous',actionId:null,values:{},clarification:'Bạn cho biết tên lớp nhé.'});
 await turn({text:'Tạo kỳ thi QA Ngày mới'});
 state.session.clarificationContext.scope='different-branch-or-project';
 state.interpret.mockResolvedValueOnce({intentType:'ambiguous',actionId:null,values:{},clarification:'Bạn muốn tra cứu thông tin nào?'});
 await turn({text:'ok'});
 expect(state.interpret.mock.calls.at(-1)![2]).toBeNull();expect(state.session.pending).toBeNull();
});

it('does not save a technical processing stop as a business question awaiting consent',async()=>{
 state.interpret.mockRejectedValueOnce(new PlanStoppedError('Đã hết thời gian xử lý. Bạn thử lại nhé.'));
 const reply=await turn({text:'Tra cứu học viên QA'});
 expect(reply.status).toBe('collecting');expect(state.session.clarificationContext).toBeNull();
});
const originals=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-remaining-sheet.json',import.meta.url),'utf8'));
const req:any={user:{id:'actor',uid:'actor',email:'qa@example.test',companyCode:'TEST',branchId:'507f1f77bcf86cd799439012',role:'admin'},headers:{authorization:'Bearer fixture'},socket:{localPort:4050,localAddress:'127.0.0.1'}};
const turn=(input:any)=>processTurn(req,{conversationId:'remaining-twelve',requestId:randomUUID(),...input});
const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 state.session=null;state.turns=[];state.provider.mockReset();state.interpret.mockReset();state.allowed=[];
 vi.stubEnv('ASSISTANT_SAFE_EXECUTION','false');vi.stubEnv('ASSISTANT_GOAL_ORCHESTRATION','true');vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
 fetcher=vi.fn(async(url:any,init:any)=>{expect(init?.method||'GET').toBe('GET');if(new URL(String(url)).pathname==='/api/v1/auth/branches')return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});throw Error('UNEXPECTED_OFFLINE_ROUTE:'+new URL(String(url)).pathname);});
 vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>{expect(fetcher.mock.calls.every(([,init]:any)=>!init?.method||init.method==='GET')).toBe(true);vi.unstubAllGlobals();vi.unstubAllEnvs();});

/** Stub model contracts, not the interpreter or business dispatcher. This is
 * offline integration evidence; it does not measure real-model accuracy. */
function model(row:any,plan=structuredClone(row.plan),resolutions=row.fit?.resolutions||[]){
 const ids=(plan.queryPlan||[plan]).map((p:any)=>p.actionId).filter(Boolean);
 state.provider.mockImplementation(async(input:any)=>{
   const properties=input.responseSchema?.properties||{};
   if(properties.units)return {text:JSON.stringify(row.meaning)};
   if(properties.featureKeys)return {text:JSON.stringify({featureKeys:[...new Set(ids.map((id:string)=>assistantFunctionKey(defaultWorkflow(operationById(id)!))))],decision:'search',question:'',unavailableModule:null})};
   if(properties.approvedActionIds)return {text:JSON.stringify({approvedActionIds:ids,question:'',resolutions})};
   return {text:JSON.stringify(plan)};
 });
}

it('exports a filtered authorized read through dispatch instead of consuming the request as a chat analysis',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'partner.analysis',values:{analysis:{where:{field:'name',operator:'eq',value:'QA Đối tác A'},select:['name']}}});
 vi.mocked(AssistantDocumentModel.create).mockClear();
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const url=new URL(String(raw));
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(url.pathname).toBe('/api/v1/partners');
  return json({partners:['QA Đối tác A','Khác'].map((name,index)=>({_id:`64b00000000000000000000${index}`,name,referredStudentsCount:0,totalReferredTuition:0,totalCommission:0,totalPaid:0,unpaidBalance:0})),total:2,page:1});
 });
 const reply=await turn({text:'Xuất Excel danh sách đối tác tuyển sinh tên QA Đối tác A'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.files).toHaveLength(1);
 const document=vi.mocked(AssistantDocumentModel.create).mock.calls.at(-1)![0] as any;
 expect(document.content.sheets[0].rows.flat()).toContain('QA Đối tác A');
 expect(document.content.sheets[0].rows.flat()).not.toContain('Khác');
 expect(document.files[0].bytes.length).toBeGreaterThan(0);
});

it.each([
 {id:'retail.report.payment-methods',analysis:{where:{any:[{field:'method',operator:'eq',value:'cash'},{field:'method',operator:'eq',value:'transfer'}]},select:['method','amount']},section:'paymentMix',rows:[{method:'cash',amount:700000},{method:'transfer',amount:300000},{method:'card',amount:9000000}],expected:['700.000','300.000'],excluded:['9.000.000']},
 {id:'retail.report.products',analysis:{sort:{field:'netQuantity',direction:'desc'},limit:1,select:['productName','netQuantity']},section:'products',rows:[{sku:'QA-1',productName:'QA Ít',netQuantity:1,netSales:9000000},{sku:'QA-2',productName:'QA Nhiều',netQuantity:12,netSales:3000000}],expected:['QA Nhiều','12'],excluded:['QA Ít']},
])('dispatches typed report rows through the shared analysis engine: $id',async row=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:row.id,values:{from:'2026-11-01',to:'2026-11-30',analysis:row.analysis}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const url=new URL(String(raw));
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(url.pathname).toBe('/api/v1/retail/reports/summary');
  return json({success:true,data:{[row.section]:row.rows}});
 });
 const reply=await turn({text:'Xem báo cáo bán lẻ tháng này'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');
 for(const value of row.expected)expect(reply.reply).toContain(value);
 for(const value of row.excluded)expect(reply.reply).not.toContain(value);
});

it('reads the authorized coupon administration list across pages and combines active and expiry filters',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'retail.coupon.list',values:{analysis:{where:{all:[{field:'active',operator:'eq',value:true},{field:'endsAt',operator:'gte',value:'2026-11-27'}]},select:['code','endsAt']}}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const url=new URL(String(raw));
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(url.pathname).toBe('/api/v1/retail/coupons');const page=Number(url.searchParams.get('page'));
  return json({success:true,data:{items:page===1?[{code:'QA-EXPIRED',active:true,endsAt:'2026-11-01'},{code:'QA-DISABLED',active:false,endsAt:'2026-12-30'}]:[{code:'QA-VALID',active:true,endsAt:'2026-12-01'}],total:3,page,limit:20}});
 });
 const reply=await turn({text:'Xem mã giảm giá đang bật và chưa hết hạn ngày 27/11/2026'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('QA-VALID');expect(reply.reply).not.toContain('QA-EXPIRED');expect(reply.reply).not.toContain('QA-DISABLED');
});

it('shows zero cash and transfers when the complete report has no payments, rather than claiming missing data',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'retail.report.payment-methods',values:{analysis:{where:{field:'method',operator:'in',value:['cash','transfer']},select:['method','amount']}}});
 fetcher.mockImplementation(async(raw:any)=>new URL(String(raw)).pathname.endsWith('/auth/branches')?json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]}):json({success:true,data:{paymentMix:[]}}));
 const reply=await turn({text:'Hôm nay thu tiền mặt bao nhiêu, chuyển khoản về bao nhiêu?'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');
 const table=parseAssistantResultTable(reply.reply)!;expect(table.rows).toHaveLength(2);expect(reply.reply).toContain('Tiền mặt');expect(reply.reply).toContain('Chuyển khoản');
 expect(table.rows.every(row=>Object.values(row.values).includes('0'))).toBe(true);
});

it('S4-R007: completes the repeated count output through real interpretation and dispatch without an extra predicate review',async()=>{
 const id='partner.analysis',text='Tháng này có thêm bao nhiêu đối tác tuyển sinh mới';
 const row={text,meaning:{version:1,units:[
  {id:'u1',kind:'goal',quote:'có thêm bao nhiêu đối tác tuyển sinh mới',concept:'Thống kê đối tác tuyển sinh mới',operator:'report',value:null},
  {id:'u2',kind:'entity',quote:'đối tác tuyển sinh',concept:'Đối tác tuyển sinh',operator:'none',value:null},
  {id:'u3',kind:'time',quote:'Tháng này',concept:'Ngày tạo đối tác',operator:'range',value:{from:'2026-11-01',to:'2026-11-30'},dimension:'temporal'},
  {id:'u4',kind:'aggregate',quote:'bao nhiêu đối tác tuyển sinh mới',concept:'Số lượng đối tác mới',operator:'count',value:null,dimension:'numeric'},
  {id:'u5',kind:'output',quote:'bao nhiêu',concept:'Số lượng',operator:'none',value:null,dimension:'numeric'},
 ],conditionLogic:'u3'},plan:{intentType:'workflow',actionId:id,values:{createdFrom:'2026-11-01',createdTo:'2026-11-30',analysis:{aggregate:{operation:'count'}}},meaningBindings:[
  {unitId:'u1',targets:['action']},{unitId:'u2',targets:['action','context.module']},{unitId:'u3',targets:['values.createdFrom','values.createdTo']},
  {unitId:'u4',targets:['analysis.aggregate.count']},{unitId:'u5',targets:['analysis.aggregate.count']},
 ]}};
 state.allowed=[id];model(row);
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const u=new URL(String(raw));
  if(u.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(u.pathname).toBe('/api/v1/partners');expect(init.headers['x-assistant-read-only']).toBe('true');
  expect(u.searchParams.get('createdFrom')).toBe('2026-11-01');expect(u.searchParams.get('createdTo')).toBe('2026-11-30');
  return json({partners:[{_id:'64b000000000000000000001',name:'QA A',isActive:true,referredStudentsCount:0,totalReferredTuition:0,totalCommission:0,totalPaid:0,unpaidBalance:0},{_id:'64b000000000000000000002',name:'QA B',isActive:false,referredStudentsCount:0,totalReferredTuition:0,totalCommission:0,totalPaid:0,unpaidBalance:0}],total:2,page:1});
 });
 const result=await turn({text});expect(result.status,JSON.stringify(result)).toBe('completed');
 expect(result.reply).toContain('Số lượng: 2');
 expect(state.provider.mock.calls.some(([input]:any)=>input.responseSchema?.properties?.equivalent)).toBe(false);
 expect(state.provider.mock.calls.filter(([input]:any)=>input.responseSchema?.properties?.approvedActionIds)).toHaveLength(1);
});

it('S6-R004: uses the real interpretation path and renders the exact nested net profit with calendar bounds',async()=>{
 const row=structuredClone(captures.find((r:any)=>r.id==='S6-R004'));model(row);
 fetcher.mockImplementation(async(raw:any,init:any)=>{expect(init?.method||'GET').toBe('GET');const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/finance/management/report');expect(u.searchParams.get('from')).toBe('2026-11-01');expect(u.searchParams.get('to')).toBe('2026-11-30');return json({success:true,data:{range:{from:'2026-11-01',to:'2026-11-30'},summary:{revenue:10000000,cost:6000000,expense:1000000,netProfit:3000000}}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('3.000.000');expect(result.reply).not.toContain('10.000.000');
});

it('S6-R027: combines a customer list and debt total through the shared read path',async()=>{
 const row=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-read-relaxation.json',import.meta.url),'utf8')).find((r:any)=>r.id==='S6-R027');
 state.allowed=['finance.receivable.by-customer','customer.list'];model(row);
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');expect(init.headers['x-assistant-read-only']).toBe('true');const u=new URL(String(raw));
  if(u.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(u.pathname).toBe('/api/v1/finance/receivables/by-customer');
  return json({success:true,data:[{_id:'QA-1',customerName:'QA A',balance:500},{_id:'QA-2',customerName:'QA B',balance:100},{_id:'QA-3',customerName:'QA C',balance:0}]});
 });
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');
 const table=parseAssistantResultTable(result.reply)!;expect(table.rows).toHaveLength(2);expect(result.reply).toContain('QA A');expect(result.reply).toContain('QA B');expect(result.reply).not.toContain('QA C');expect(table.after.join(' ')).toContain('600');
});

it('keeps an incomplete read error distinct from unavailable modules or permissions',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'finance.receivable.by-customer',values:{analysis:{aggregate:{operation:'sum',field:'balance'}}}});
 fetcher.mockImplementation(async raw=>new URL(String(raw)).pathname.endsWith('/auth/branches')?json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]}):json({success:true,data:[{customerName:'QA A',balance:500}],total:99}));
 const result=await turn({text:'Tổng công nợ khách hàng là bao nhiêu?'});expect(result.status).toBe('failed');expect(result.reply).toContain('phân trang');expect(result.reply).not.toContain('menu');expect(result.reply).not.toContain('quyền');expect(result.reply).not.toContain('Mở tab');
});

it('asks a missing business criterion once instead of spending the routing deadline on repeated repairs',async()=>{
 const id='student.quality.list',row={text:'Lọc học viên thường xuyên vắng',meaning:{version:1,units:[{id:'u1',kind:'goal',quote:'Lọc',concept:'Tra cứu',operator:'lookup',value:null},{id:'u2',kind:'condition',quote:'thường xuyên vắng',concept:'Tiêu chí vắng thường xuyên',operator:'contains',value:'thường xuyên vắng'}]},plan:{intentType:'workflow',actionId:id,values:{analysis:{filters:[{field:'missingAttendanceSessions',operator:'gte',value:1}]}},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['analysis.filters.missingAttendanceSessions']}]}};
 state.allowed=[id];model(row);const base=state.provider.getMockImplementation()!;
 state.provider.mockImplementation(input=>input.responseSchema?.properties?.approvedActionIds?{text:JSON.stringify({approvedActionIds:[id],question:'Bạn muốn tính thường xuyên vắng từ bao nhiêu buổi?',resolutions:[]})}:base(input));
 const result=await turn({text:row.text});expect(result.status).toBe('collecting');expect(result.reply).toContain('bao nhiêu buổi');expect(fetcher).not.toHaveBeenCalled();expect(state.provider).toHaveBeenCalledTimes(4);
});

it('S8-R032: preserves the public receipt code through dispatch, default hiding and shared table presentation',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'inventory.receipt.list',values:{analysis:{extreme:{field:'subtotal',direction:'max'},select:['receiptCode','subtotal']}}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{expect(init?.method||'GET').toBe('GET');const u=new URL(String(raw));if(u.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});expect(u.pathname).toBe('/api/v1/inventory/receiving/receipts');return json({data:{items:[{_id:'64b000000000000000000001',receiptCode:'QA-PNK-001',subtotal:1000000},{_id:'64b000000000000000000002',receiptCode:'QA-PNK-002',subtotal:560000000}],total:2,page:1}});});
 const result=await turn({text:'Đợt nhập hàng lớn nhất là đợt nào, hết bao nhiêu tiền'});
 expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA-PNK-002');expect(result.reply).toContain('560.000.000');expect(result.reply).not.toContain('QA-PNK-001');expect(parseAssistantResultTable(result.reply)?.headers).toHaveLength(2);
});

it('S6-R052: retains a timed-out, undispatched request and resumes the same goal without writing',async()=>{
 const text='Tóm tắt kinh doanh tháng 11: doanh thu, lãi gộp, đơn hủy/trả hàng, khách còn nợ và tiền hoa hồng CTV';
 state.interpret.mockRejectedValueOnce(new PlanStoppedError('Đã hết thời gian chờ yêu cầu.'));
 const stopped=await turn({text});expect(stopped.status).toBe('collecting');expect(stopped.reply).toContain('tiếp tục');expect(state.session.remainingRequests).toEqual([text]);expect(fetcher).not.toHaveBeenCalled();
 state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'inventory.receipt.list',values:{},currentRequest:text,remainingRequests:[]});
 fetcher.mockImplementation(async(raw:any)=>new URL(String(raw)).pathname.endsWith('/auth/branches')?json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]}):json({data:{items:[],total:0,page:1}}));
 const resumed=await turn({text:'tiếp tục'});expect(resumed.status,JSON.stringify(resumed)).toBe('completed');expect(state.interpret.mock.calls[1][0]).toBe(text);expect(state.session.remainingRequests).toEqual([]);
});
it('retains a provider timeout before dispatch and resumes only when the user asks',async()=>{
 const text='Tìm các phiếu nhập kho mới nhất';state.interpret.mockRejectedValueOnce(new AssistantInterpretationError(undefined,true));
 const stopped=await turn({text});expect(stopped.status).toBe('collecting');expect(stopped.reply).toContain('tiếp tục');expect(state.session.remainingRequests).toEqual([text]);expect(fetcher).not.toHaveBeenCalled();
 state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'inventory.receipt.list',values:{},currentRequest:text,remainingRequests:[]});
 fetcher.mockImplementation(async raw=>new URL(String(raw)).pathname.endsWith('/auth/branches')?json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]}):json({data:{items:[],total:0,page:1}}));
 expect((await turn({text:'tiếp tục'})).status).toBe('completed');expect(state.interpret.mock.calls[1][0]).toBe(text);expect(fetcher.mock.calls.every(([,init]:any)=>!init?.method||init.method==='GET')).toBe(true);
});

it('S6-R011: reads all open cashier shifts, displays book cash honestly and excludes closed shifts',async()=>{
 const row=structuredClone(captures.find((r:any)=>r.id==='S6-R011')),id='retail.shift.list';
 const plan={intentType:'workflow',actionIntent:'lookup',actionId:id,values:{analysis:{where:{field:'status',operator:'eq',value:'open'},select:['cashierName','expectedCash']}},meaningBindings:row.meaning.units.map((u:any)=>({unitId:u.id,targets:u.id==='u4'?['analysis.filters.status']:u.id==='u5'?['context.scope']:u.id==='u6'?['result.cashierName']:u.id==='u9'?['result.expectedCash']:['action']}))};
 model(row,plan,[{unitId:'u4',actionId:id,role:'read_predicate',target:'',predicates:[{field:'status',operator:'eq',value:'open'}]},{unitId:'u5',actionId:id,role:'snapshot_context',target:'context.scope',predicates:[]}]);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/retail/shifts');return json({data:{items:[{id:'s1',cashierName:'QA Thu ngân A',status:'open',expectedCash:1200000},{id:'s2',cashierName:'QA Thu ngân B',status:'closed',expectedCash:9900000}],total:2,page:1}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Thu ngân A');expect(result.reply).toContain('theo sổ');expect(result.reply).toContain('1.200.000');expect(result.reply).not.toContain('QA Thu ngân B');
});

it('S8-R046: treats sent but not received as a real state filter, retaining receipt/public transfer codes',async()=>{
 const row=structuredClone(captures.find((r:any)=>r.id==='S8-R046'));row.plan.values.analysis={select:['code','status']};model(row);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/inventory/transfers');expect(u.searchParams.get('status')).toBe('in_transit');return json({data:{items:[{_id:'64b000000000000000000011',code:'QA-DC-01',status:'in_transit'},{_id:'64b000000000000000000012',code:'QA-DC-02',status:'received'}],total:2,page:1}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA-DC-01');expect(result.reply).not.toContain('QA-DC-02');
});

it('S8-R064: resolves the reviewed native enum alias to the existing predicate and finds matching serials across pages',async()=>{
 const row=structuredClone(captures.find((r:any)=>r.id==='S8-R064'));model(row);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/inventory/serials');const page=Number(u.searchParams.get('page'));return json({data:{items:page===1?[{_id:'64b000000000000000000013',serialNumber:'QA-SERIAL-SOLD',productName:'Bộ sạc QA',status:'sold',warehouseName:'Trụ sở chính'}]:[{_id:'64b000000000000000000014',serialNumber:'QA-SERIAL-READY',productName:'Bộ sạc QA',status:'in_stock',warehouseName:'Trụ sở chính'}],total:2,page,limit:1}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA-SERIAL-READY');expect(result.reply).not.toContain('QA-SERIAL-SOLD');expect(fetcher).toHaveBeenCalledTimes(2);
});

it('S1-R058: preserves monthly bounds and the built-in negative KPI selector through formatting',async()=>{
 const row=structuredClone(captures.find((r:any)=>r.id==='S1-R058'));model(row);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/kanban/kpi/monthly');expect(u.searchParams.get('period')).toBe('2026-11');expect(u.searchParams.has('completionFilter')).toBe(false);return json({data:{periodKey:'2026-11',periodStatus:'open',rows:[{employeeName:'QA Chưa đạt',percent:50,totalTasks:2,completedTasks:1},{employeeName:'QA Đã đạt',percent:100,totalTasks:2,completedTasks:2}]}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Chưa đạt');expect(result.reply).not.toContain('QA Đã đạt');
});

it('S1-R084: returns a complete scoped interview list, including a positive candidate rather than a partial-data warning',async()=>{
 const raw=structuredClone(originals.find((r:any)=>r.id==='S1-R084')),row={...raw,plan:raw.plans.at(-1),fit:raw.fit.at(-1)};model(row);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/recruitment/interviews');expect(u.searchParams.get('from')).toBe('2026-11-27');return json({data:[{_id:'64b000000000000000000015',applicantName:'QA Ứng viên A',scheduledStart:'2026-11-27T02:00:00Z'}]});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Ứng viên A');expect(result.reply).not.toContain('chưa thể kết luận');
});

it('S3-R055: filters a structured room field even when another event mentions the room only in prose',async()=>{
 const raw=structuredClone(originals.find((r:any)=>r.id==='S3-R055')),row={...raw,plan:raw.plans.at(-1),fit:raw.fit.at(-1)};
 row.plan.values.analysis={where:{field:'location',operator:'eq',value:'QA P02'}};row.plan.meaningBindings.find((b:any)=>b.unitId==='u3').targets=['analysis.filters.location'];model(row);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/schedule');return json({success:true,events:[{id:'event1',title:'QA Lớp A',type:'class',date:'2026-11-27',time:'09:00',location:'QA P02',details:'QA GV'},{id:'event2',title:'QA Lớp B',type:'class',date:'2026-11-27',time:'10:00',location:'QA P03',details:'Chuyển từ QA P02'}]});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Lớp A');expect(result.reply).not.toContain('QA Lớp B');expect(result.reply).not.toContain('chưa thể kết luận');
});

it('S3-R115: preserves eligibility reasons, filters actual booleans and sends no forbidden implicit scope query',async()=>{
 const raw=structuredClone(originals.find((r:any)=>r.id==='S3-R115')),row={...raw,plan:raw.plans.at(-1),fit:raw.fit.at(-1)},id=row.plan.actionId;
 model(row,row.plan,[{unitId:'u4',actionId:id,role:'read_predicate',target:'',predicates:[{field:'eligible',operator:'ne',value:true}]}]);
 fetcher.mockImplementation(async(raw:any,init:any)=>{const u=new URL(String(raw));if(u.pathname==='/api/v1/batches')return json({success:true,batches:[{_id:'64b000000000000000000016',code:'QA Anh văn 01',courseTitle:'QA Anh văn'}],total:1,page:1});expect(u.pathname).toBe('/api/v1/learning-roadmaps/batches/64b000000000000000000016/progression');expect(u.searchParams.has('branchId')).toBe(false);expect(u.searchParams.has('companyCode')).toBe(false);expect(new Headers(init.headers).get('x-branch-id')).toBe(req.user.branchId);return json({success:true,data:{selectedRoadmapId:'64b000000000000000000019',rows:[{studentId:'64b000000000000000000017',studentName:'QA Cần bổ sung',eligible:false,eligibilityReasonSummary:'Thiếu 20% chuyên cần'},{studentId:'64b000000000000000000018',studentName:'QA Đủ điều kiện',eligible:true,eligibilityReasonSummary:''}]}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Cần bổ sung');expect(result.reply).toContain('Thiếu 20% chuyên cần');expect(result.reply).not.toContain('QA Đủ điều kiện');
});

it('S6-R036: uses the complete order-line collection for customer warranty, including non-serialized goods and Vietnam date boundaries',async()=>{
 const raw=structuredClone(originals.find((r:any)=>r.id==='S6-R036')),op=ASSISTANT_OPERATIONS.find(o=>o.path==='/retail/warranty/orders')!;
 const range=raw.meaning.units.find((u:any)=>u.kind==='time').value;
 const row={...raw,plan:{intentType:'workflow',actionIntent:'lookup',actionId:op.id,values:{status:'all',analysis:{where:{field:'warrantyEndAt',operator:'between',value:[range.from,range.to]},select:['productName','customerName','orderCode','warrantyEndAt']}},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['action']},{unitId:'u3',targets:['analysis.filters.warrantyEndAt']},{unitId:'u4',targets:['result.productName']},{unitId:'u5',targets:['context.reason']}]},fit:{resolutions:[]}};
 // status=all is the source's unfiltered state, not an extra user condition.
 delete (row.plan.values as any).status;model(row);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));expect(u.pathname).toBe('/api/v1/retail/warranty/orders');const page=Number(u.searchParams.get('page'));return json({success:true,data:{items:page===1?[{id:'order:0',productName:'QA Hàng số lượng',customerName:'QA Khách A',orderCode:'QA-DH01',warrantyEndAt:'2026-12-27T16:59:59Z'}]:[{id:'order:1',productName:'QA Ngoài khoảng',customerName:'QA Khách B',orderCode:'QA-DH02',warrantyEndAt:'2026-12-27T17:00:00Z'}],total:2,page,limit:1}});});
 const result=await turn({text:row.text});expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Hàng số lượng');expect(result.reply).toContain('QA Khách A');expect(result.reply).not.toContain('QA Ngoài khoảng');expect(fetcher).toHaveBeenCalledTimes(2);
});

it('S8-R020: recovers truncated review, asks for the count document and stops at confirmation while retaining the valuation task',async()=>{
 const raw=structuredClone(originals.find((r:any)=>r.id==='S8-R020')),plan=raw.plans[0],row={...raw,plan,fit:{resolutions:[]}};
 const branch=plan.meaningBindings.find((b:any)=>b.unitId==='u4');branch.targets=['values.targetBranch'];plan.values.targetBranch='Trụ sở chính';
 model(row);const originalProvider=state.provider.getMockImplementation()!;let reviews=0;
 state.provider.mockImplementation(async(input:any)=>{if(input.responseSchema?.properties.approvedActionIds&&reviews++===0)return {text:'{"approvedActionIds":['};return originalProvider(input);});
 const count='64b000000000000000000021',item='64b000000000000000000022';
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));if(u.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});if(u.pathname==='/api/v1/inventory/counts')return json({data:{items:[{_id:count,countCode:'QA-KK01',status:'counting',version:1},{_id:'64b000000000000000000023',countCode:'QA-KK02',status:'counting',version:1}],total:2,page:1}});if(u.pathname===`/api/v1/inventory/counts/${count}`)return json({success:true,data:{_id:count,countCode:'QA-KK01',status:'counting',version:1,items:[{_id:item,id:item,productName:'QA Sản phẩm 04',sku:'QA-SP04',trackingMode:'quantity',systemQuantity:15,countedQuantity:15,quantityDelta:0}]}});throw Error('UNEXPECTED_COUNT_ROUTE:'+u.pathname);});
 const collecting=await turn({text:row.text});expect(collecting.status,JSON.stringify(collecting)).toBe('collecting');const select=collecting.referenceSelections?.find(s=>s.key==='path_id');expect(select?.options).toHaveLength(2);
 const selected=await turn({referenceSelections:{path_id:[select!.options.find(o=>o.label.includes('QA-KK01'))!.value]}});
 const itemSelection=selected.referenceSelections?.find(s=>s.key==='path_itemId');
 const preview=itemSelection?await turn({referenceSelections:{path_itemId:[itemSelection.options[0].value]}}):selected;
 expect(preview.status,JSON.stringify(preview)).toBe('confirmation');expect(JSON.stringify(preview)).toContain('12');expect(state.session.remainingRequests).toEqual(['tính giá trị chênh lệch']);expect(reviews).toBe(2);
});

it('missing evaluation policy opens the shared roadmap selector instead of reporting an empty eligibility result',async()=>{
 const batch='64b000000000000000000031',roadmapA='64b000000000000000000032',roadmapB='64b000000000000000000033';
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'student.learning-roadmap.progression.list',values:{path_batchId:'QA Anh văn 01',analysis:{where:{field:'eligible',operator:'eq',value:false},select:['studentName','eligibilityReasonSummary']}}});
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));
  if(u.pathname==='/api/v1/batches')return json({batches:[{_id:batch,code:'QA Anh văn 01'}],total:1,page:1});
  if(u.pathname==='/api/v1/learning-roadmaps')return json({success:true,data:[{_id:roadmapA,code:'QA-LT1',name:'QA Lộ trình 1',status:'active'},{_id:roadmapB,code:'QA-LT2',name:'QA Lộ trình 2',status:'active'}]});
  expect(u.pathname).toBe(`/api/v1/learning-roadmaps/batches/${batch}/progression`);
  return json({success:true,data:u.searchParams.get('roadmapId')?{selectedRoadmapId:roadmapA,rows:[{studentId:'64b000000000000000000034',studentName:'QA Cần học thêm',eligible:false,eligibilityReasonSummary:'Chưa đạt bài kiểm tra'}]}:{selectedRoadmapId:'',rows:[]}});
 });
 const first=await turn({text:'Kiểm tra học viên lớp QA Anh văn 01 chưa đủ điều kiện lên lớp'});
 expect(first.status,JSON.stringify(first)).toBe('collecting');expect(first.reply).toContain('chọn lộ trình');
 const selection=first.referenceSelections?.find(s=>s.key==='query_roadmapId');expect(selection?.options).toHaveLength(2);
 const result=await turn({referenceSelections:{query_roadmapId:[selection!.options[0].value]}});
 expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Cần học thêm');expect(result.reply).toContain('Chưa đạt bài kiểm tra');
});

it('S6-R052: executes a single five-source read plan and renders all requested sections without a synthesis model call',async()=>{
 const raw=structuredClone(originals.find((r:any)=>r.id==='S6-R052'));
 const summary='retail.report.summary',orders='retail.order.list',returns='retail.after-sale.list',debts='finance.receivable.list',profit=ASSISTANT_OPERATIONS.find(o=>o.path==='/retail/finance/profit')!.id;
 state.allowed=[summary,orders,returns,debts,profit,'branch.list'];
 const queries=[
  {actionId:summary,purpose:'Doanh thu và lãi gộp tháng 11',values:{from:'2026-11-01',to:'2026-11-30'},resultFields:['summary']},
  {actionId:orders,purpose:'Đơn hủy tháng 11',values:{query_from:'2026-11-01',query_to:'2026-11-30',query_status:'cancelled'},resultFields:['orderCode']},
  {actionId:returns,purpose:'Trả hàng tháng 11',values:{query_type:'return',analysis:{where:{field:'businessDate',operator:'between',value:['2026-11-01','2026-11-30']}}},resultFields:['code']},
  {actionId:debts,purpose:'Khách còn nợ trong kỳ',values:{query_from:'2026-11-01',query_to:'2026-11-30',analysis:{where:{field:'balance',operator:'gt',value:0}}},resultFields:['customerName','balance']},
  {actionId:profit,purpose:'Chi phí hoa hồng CTV tháng 11',values:{from:'2026-11-01',to:'2026-11-30'},resultFields:['summary']},
 ];
 const target=(id:string,path:string)=>`query:${id}:${path}`;
 raw.meaning.units.push({id:'u9',kind:'condition',quote:'hủy',concept:'Đơn đã hủy',operator:'eq',value:'hủy',dimension:'none'},{id:'u10',kind:'condition',quote:'trả hàng',concept:'Phiếu trả hàng',operator:'eq',value:'trả hàng',dimension:'none'},{id:'u11',kind:'condition',quote:'còn nợ',concept:'Còn dư nợ',operator:'eq',value:'còn nợ',dimension:'none'});
 raw.meaning.conditionLogic={all:['u3','u9','u10','u11']};
 const bindings=[['u1',[target(summary,'action')]],['u2',[target(summary,'action')]],['u3',[target(summary,'values.from'),target(summary,'values.to'),target(orders,'values.query_from'),target(orders,'values.query_to'),target(returns,'analysis.filters.businessDate'),target(debts,'values.query_from'),target(debts,'values.query_to'),target(profit,'values.from'),target(profit,'values.to')]],['u4',[target(summary,'result.summary.netSales')]],['u5',[target(summary,'result.summary.grossProfit')]],['u6',[target(orders,'result.orderCode'),target(returns,'result.code')]],['u7',[target(debts,'result.customerName'),target(debts,'result.balance')]],['u8',[target(profit,'result.summary.commissionExpense')]],['u9',[target(orders,'values.query_status')]],['u10',[target(returns,'values.query_type')]],['u11',[target(debts,'analysis.filters.balance')]]].map(([unitId,targets])=>({unitId,targets}));
 const plan={intentType:'workflow',actionIntent:'report',actionId:null,values:{},queryPlan:queries,meaningBindings:bindings};
 bindSemanticRequest(parseSemanticRequest(raw.text,raw.meaning),bindings,[]);
 model(raw,plan,[{unitId:'u9',actionId:orders,role:'enum_input',target:'values.query_status',predicates:[]},{unitId:'u10',actionId:returns,role:'enum_input',target:'values.query_type',predicates:[]},{unitId:'u11',actionId:debts,role:'read_predicate',target:'',predicates:[{field:'balance',operator:'gt',value:0}]}]);
 fetcher.mockImplementation(async(raw:any)=>{const u=new URL(String(raw));
  if(u.pathname.endsWith('/reports/summary'))return json({data:{summary:{netSales:10000000,grossProfit:4000000,orderCount:10}}});
  if(u.pathname.endsWith('/orders'))return json({data:{items:[{_id:'64b000000000000000000041',orderCode:'QA-HUY01',status:'cancelled'}],total:1,page:1}});
  if(u.pathname.endsWith('/after-sales'))return json({data:{items:[{_id:'64b000000000000000000042',code:'QA-TRA01',type:'return',businessDate:'2026-11-20'}],total:1,page:1}});
  if(u.pathname==='/api/v1/finance/receivables')return json({data:{items:[{_id:'64b000000000000000000043',customerName:'QA Khách còn nợ',balance:200000}],total:1,page:1}});
  if(u.pathname.endsWith('/finance/profit'))return json({data:{summary:{revenue:10000000,commissionExpense:500000,netProfit:123456}}});
  throw Error('UNEXPECTED_COMPOSITE_ROUTE:'+u.pathname);
 });
 const result=await turn({text:raw.text});
 expect(result.status,JSON.stringify(result)).toBe('completed');
 for(const fact of ['10.000.000','4.000.000','QA-HUY01','QA-TRA01','QA Khách còn nợ','200.000','500.000'])expect(result.reply).toContain(fact);
 expect(result.reply).not.toContain('123.456');expect(state.provider).toHaveBeenCalledTimes(4);expect(fetcher).toHaveBeenCalledTimes(5);
});
