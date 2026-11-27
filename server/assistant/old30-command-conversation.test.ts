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

import {processTurn} from './service';
import {AssistantDocumentModel} from './models';
import {operationById,defaultWorkflow,ASSISTANT_OPERATIONS} from './catalog';
import {PlanStoppedError} from './execution-budget';
import {suggestReferenceOptions} from './executor';
import {AssistantInterpretationError} from './interpretation-error';
import {assistantFunctionKey} from './function-context';
import {parseAssistantResultTable} from '../../src/shared/assistant-result-table';
import {parseSemanticRequest,bindSemanticRequest} from './semantic-request';
const captures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-remaining25-retry.json',import.meta.url),'utf8'));
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
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

it('collects the missing named-template content in the existing form and confirms a scoped server recipient snapshot',async()=>{
 const write='student.tuition.reminder.send';
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:write,values:{templateName:'Nhắc phí'}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  const url=new URL(String(raw));expect(init?.method||'GET').toBe('GET');
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(url.pathname).toBe('/api/v1/payments/tuition-reminders/preview');
  expect(url.searchParams.get('contentDigest')).toMatch(/^[a-f\d]{64}$/);expect(url.searchParams.has('content')).toBe(false);
  return json({success:true,data:{recipientCount:2,skippedCount:1,snapshotToken:'server-only-snapshot'}});
 });
 const ask=await turn({text:'Gửi email nhắc đóng học phí hàng loạt theo mẫu Nhắc phí cho các học viên còn nợ học phí'});
 expect(ask.status,JSON.stringify(ask)).toBe('collecting');expect(ask.inputForm?.fields.map(f=>f.key)).toEqual(expect.arrayContaining(['subject','content']));expect(fetcher.mock.calls.some(([url])=>String(url).includes('/tuition-reminders/'))).toBe(false);
 const ready=await turn({formValues:{id:ask.inputForm!.id,values:{subject:'Nhắc học phí QA',content:'Chào {fullName}, học phí còn lại: {remainingAmount}.'}}});
 expect(ready.status,JSON.stringify({ready,calls:fetcher.mock.calls.map(([url])=>String(url))})).toBe('confirmation');expect(ready.action!.values).toContainEqual({label:'Số email sẽ gửi',value:'2',defaulted:false});
 expect(JSON.stringify(ready)).not.toContain('server-only-snapshot');expect(state.session.pending.resolved.snapshotToken).toBe('server-only-snapshot');
 expect(fetcher.mock.calls.filter(([url])=>String(url).includes('/tuition-reminders/preview'))).toHaveLength(1);
});

it('fails closed when the pre-confirmation read permission is absent, without sending mail',async()=>{
 state.allowed=['student.tuition.reminder.send','branch.list'];
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'student.tuition.reminder.send',values:{subject:'QA',content:'QA'}});
 const reply=await turn({text:'Gửi email nhắc học phí cho toàn bộ học viên còn nợ'});
 expect(['failed','unsupported']).toContain(reply.status);expect(fetcher.mock.calls.some(([url])=>String(url).includes('/tuition-reminders/'))).toBe(false);
});
it('retains the original request through a plain clarification and clears that scoped context after completion',async()=>{
 const original='Báo cáo tổng giá trị và số lượng hàng tồn kho';
 state.interpret.mockResolvedValueOnce({intentType:'ambiguous',actionId:null,values:{},clarification:'Bạn muốn tính toàn bộ hàng hay một nhóm hàng?'});
 const question=await turn({text:original});expect(question.status).toBe('collecting');expect(state.session.clarificationContext.text).toBe(original);
 state.interpret.mockImplementationOnce(async(_text:any,_workflows:any,pending:any)=>{
  expect(pending.clarification.text).toBe(original);
  return {intentType:'workflow',actionId:'inventory.balance.list',values:{analysis:{aggregates:[{operation:'sum',field:'stockValue'},{operation:'sum',field:'quantity'}]}}};
 });
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');expect(new URL(String(raw)).pathname).toBe('/api/v1/inventory/warehouses/balances');
  return json({data:[{sku:'QA-1',quantity:5,stockValue:500}]});
 });
 const reply=await turn({text:'Toàn bộ hàng trong kho'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('500');expect(reply.reply).toContain('5');expect(state.session.clarificationContext).toBeNull();
});
it('offers scoped choices when a nested reference phrase yields no search results, without auto-selecting one',async()=>{
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const url=new URL(String(raw));
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(url.pathname).toBe('/api/v1/inventory/catalog/products');
  const searched=[...url.searchParams.values()].some(value=>value.includes('máy QA'));
  return json({data:{items:searched?[]:[{_id:'64b000000000000000000002',name:'QA Sản phẩm',productCode:'QA-P',status:'active',productType:'physical'}],total:searched?0:1,page:1}});
 });
 const options=await suggestReferenceOptions(req,operationById('inventory.transfer.create')!,{key:'items[1].productId',label:'Sản phẩm',type:'reference',reference:'product.list'},{'__assistantReferenceSearch_items[1].productId':'máy QA Sản phẩm'});
 expect(options.some(option=>option.includes('QA Sản phẩm'))).toBe(true);
 expect(fetcher.mock.calls.some(([url])=>[...new URL(String(url)).searchParams.values()].some(value=>value.includes('máy QA')))).toBe(true);
});
it('executes mixed search representations through the shared read dispatcher and returns only the matching rows',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'inventory.balance.list',values:{analysis:{
  filters:[{field:'Số lượng tồn',operator:'>=',value:'2'}],
  where:{any:[{field:'SKU',operator:'starts_with',value:'QA-1'},{field:'SKU',operator:'starts_with',value:'QA-2'}]},
  select:['product_name','Số lượng tồn'],
 }}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const url=new URL(String(raw));
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  expect(url.pathname).toBe('/api/v1/inventory/warehouses/balances');
  return json({data:[{productName:'QA Hàng A',sku:'QA-1',quantity:3},{productName:'QA Hàng B',sku:'QA-2',quantity:1},{productName:'QA Hàng C',sku:'QA-3',quantity:4}]});
 });
 const reply=await turn({text:'Tìm hàng có SKU bắt đầu QA-1 hoặc QA-2 và tồn ít nhất 2, cho mình tên và số lượng'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');
 const table=parseAssistantResultTable(reply.reply)!;
 expect(table.rows).toHaveLength(1);expect(JSON.stringify(table.rows)).toContain('QA Hàng A');
 expect(reply.reply).not.toContain('QA Hàng B');expect(reply.reply).not.toContain('QA Hàng C');
 expect(state.session.pending).toBeNull();
});
it('exports all paginated posted stock movements through the common read and workbook path',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'inventory.ledger.list',actionIntent:'export',values:{limit:1}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');const url=new URL(String(raw));
  expect(url.pathname).toBe('/api/v1/inventory/warehouses/ledger');
  const page=Number(url.searchParams.get('page'));
  return json({data:{items:[{productName:'QA Hàng '+page,sku:'QA-'+page,direction:page===1?'in':'out',purpose:'other',quantity:1,quantityDelta:page===1?1:-1,unitCost:100,sourceCode:'QA-LEDGER-'+page,createdAt:'2026-11-27T01:00:00Z'}],total:2,page,limit:1}});
 });
 const reply=await turn({text:'Xuất Excel toàn bộ lịch sử giao dịch kho'});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.files).toHaveLength(1);expect(reply.reply).toContain('2 dòng');
 expect(fetcher.mock.calls.map(([url])=>new URL(String(url)).searchParams.get('page'))).toEqual(['1','2']);
});
it.each(['canonical','declared-alias'])('confirms a project location-only edit using %s without requesting an untouched optional schedule',async representation=>{
 const id='64b000000000000000000004';
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'worker.project.update',values:representation==='canonical'?{path_id:'QA Nhà máy B',location:'140 Đường QA'}:{'PATH.ID':'QA Nhà máy B','body.location':'140 Đường QA'}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  expect(init?.method||'GET').toBe('GET');
  if(String(raw).includes('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  return json({data:{items:[{_id:id,id,name:'QA Nhà máy B',code:'QA-B',companyCode:'TEST',branchId:req.user.branchId,daysOfWeek:[1,2,3,4,5,6]}],total:1,page:1}});
 });
 const reply=await turn({text:'Cập nhật địa điểm dự án QA Nhà máy B thành 140 Đường QA'});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');expect(reply.inputForm).toBeUndefined();expect(reply.referenceSelections).toBeUndefined();
 expect(state.session.pending.resolved).not.toHaveProperty('daysOfWeek');
});

it('never exposes a failed preflight token or proceeds to the write when its source lacks a snapshot',async()=>{
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'student.tuition.reminder.send',values:{subject:'QA',content:'QA'}});
 fetcher.mockResolvedValue(json({success:true,data:{recipientCount:2,skippedCount:0}}));
 const reply=await turn({text:'Gửi email nhắc học phí'});expect(reply.status).toBe('failed');expect(fetcher.mock.calls.every(([,init]:any)=>init.method==='GET')).toBe(true);
});

it('creates one pending internal stock document, supplements its missing optional title on the same record and renders tables',async()=>{
 const warehouse='64b000000000000000000001',product='64b000000000000000000002',variant='64b000000000000000000003',id='64b000000000000000000004';
 let saved:any;const writes:any[]=[];
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'inventory.stock-log.internal.create',values:{warehouseId:warehouse,customerName:'Bộ phận kế toán QA',notes:'Sử dụng nội bộ QA',items:JSON.stringify([{productId:product,variantId:variant,quantity:1}])}});
 fetcher.mockImplementation(async(raw:any,init:any)=>{
  const url=new URL(String(raw)),method=init?.method||'GET';
  if(method==='POST'&&url.pathname==='/api/v1/crud/stock-logs'){const body=JSON.parse(init.body);writes.push({method,body});expect(body).toMatchObject({type:'xuất',purpose:'nội bộ',status:'Đang chờ',operatorName:'qa@example.test'});saved={_id:id,...body,quantity:1};return json({success:true,data:saved});}
  if(method==='PATCH'&&url.pathname==='/api/v1/crud/stock-logs/'+id){const body=JSON.parse(init.body);writes.push({method,body});saved={...saved,...body};return json({success:true,data:saved});}
  expect(method).toBe('GET');
  if(url.pathname.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'Trụ sở chính'}]});
  if(url.pathname==='/api/v1/inventory/warehouses')return json({data:[{_id:warehouse,name:'Kho QA',branchId:req.user.branchId,companyCode:'TEST'}]});
  if(url.pathname==='/api/v1/inventory/catalog/products')return json({data:{items:[{_id:product,name:'QA SP',productCode:'QA-P'}],total:1,page:1}});
  if(url.pathname==='/api/v1/inventory/catalog/products/'+product)return json({data:{_id:product,name:'QA SP',variants:[{_id:variant,productId:product,sku:'QA-SKU',displayName:'QA SKU',trackingMode:'quantity'}]}});
  if(url.pathname==='/api/v1/crud/stock-logs')return json({data:saved?[saved]:[],total:saved?1:0,page:1});
  throw Error('Unexpected fixture URL '+url.pathname);
 });
 const preview=await turn({text:'Tạo phiếu xuất 1 QA SP từ Kho QA cho Bộ phận kế toán QA, lý do Sử dụng nội bộ QA'});
 expect(preview.status,JSON.stringify(preview)).toBe('confirmation');expect(writes).toHaveLength(0);
 const created=await turn({decision:{id:preview.action!.id,confirmed:true}});
 expect(created.status,JSON.stringify(created)).toBe('completed');expect(parseAssistantResultTable(created.reply)).toBeTruthy();expect(created.reply).toContain('tiêu đề phiếu');
 state.interpret.mockResolvedValue({intentType:'workflow',actionId:'inventory.stock-log.internal.update',values:{path_id:id,title:'Phiếu QA kế toán'}});
 const supplement=await turn({text:'Có, bổ sung tiêu đề Phiếu QA kế toán'});
 expect(supplement.status,JSON.stringify(supplement)).toBe('confirmation');
 const completed=await turn({decision:{id:supplement.action!.id,confirmed:true}});
 expect(completed.status,JSON.stringify(completed)).toBe('completed');expect(parseAssistantResultTable(completed.reply)).toBeTruthy();expect(completed.reply).toContain('Phiếu QA kế toán');
 expect(writes.filter(w=>w.method==='POST')).toHaveLength(1);expect(writes.filter(w=>w.method==='PATCH')).toHaveLength(1);
});
