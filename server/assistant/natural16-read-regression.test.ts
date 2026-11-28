import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const provider=vi.hoisted(()=>vi.fn());
vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
import {operationById,defaultWorkflow} from './catalog';
import {parseSemanticRequest,bindSemanticRequest,understandSemanticRequest,validateSemanticPlan,normalizeSemanticInputBindings,normalizeSemanticReadProjection,normalizeSemanticAnalysisBindings,type SemanticRequest} from './semantic-request';
import {compileSemanticResolutions,declaredDomainModules} from './semantic-compilation';
import {inheritReadConstraints,normalizeReadReferenceBindings,normalizeOverlappingEntityBindings,readContextQuestion,readLifecycleQuestion,readPlanningValues} from './read-dialogue';
import {newInterpretationBudget} from './interpretation-budget';
import {formatAssistantResultTable} from '../../src/shared/assistant-result-table';
import {matchesReference,projectRecords} from './executor';
import {collectPublicReadData} from './public-read-query';
import {renderListAnalysis,analyzeList} from './list-analysis';
import {projectAssistantResultContract} from './result-field-policy';

const captures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-natural16.json',import.meta.url),'utf8'));
const captured=(id:string)=>captures.find((r:any)=>r.id===id);
const meaning=(id:string,index=0)=>captured(id).turns.filter((r:any)=>r.kind==='meaning')[index];
const plan=(id:string,index=0)=>structuredClone(captured(id).turns.filter((r:any)=>r.kind==='plan')[index].output);
const source=(id:string,values:Record<string,unknown>)=>({operation:operationById(id)!,workflow:defaultWorkflow(operationById(id)!),values});
const normalize=(request:SemanticRequest,s:ReturnType<typeof source>,raw:any)=>{
 const {bindings}=bindSemanticRequest(request,raw.meaningBindings,[]);
 inheritReadConstraints(request,[s]);normalizeOverlappingEntityBindings(request,bindings,[s]);normalizeReadReferenceBindings(request,bindings,[s]);
 normalizeSemanticInputBindings(bindings,[s],request);normalizeSemanticReadProjection(request,bindings,[s]);normalizeSemanticAnalysisBindings(bindings,[s],request.evaluatedAt,request);
 return bindings;
};
beforeEach(()=>{provider.mockReset();});afterEach(()=>{vi.unstubAllEnvs();});

describe('captured natural-language failures: shared read contracts',()=>{
 it('N01-01: keeps public identities beside a requested status and reports unknown coverage',()=>{
  const op=operationById('hr.daily.overview')!,projected=projectAssistantResultContract(op,['attendanceStatus']);
  expect(projected.resultFields).toContain('employeeName');expect(projected.resultFields).not.toContain('employeeId');
  const reply=renderListAnalysis(op.analysis!,[{employeeName:'QA An',attendanceStatus:'Chưa ghi nhận'},{employeeName:'QA Bình',attendanceStatus:'Chưa ghi nhận'}],{},true,'Kết quả');
  expect(reply).toContain('QA An');expect(reply).toContain('QA Bình');expect(reply).toContain('0/2');expect(reply).toContain('chưa đủ dữ liệu');
 });
 it('N01-02: reads the declared alert rows and their own total, never unrelated contracts',async()=>{
  const op=operationById('hr.contract.expiring.list')!;
  const response={data:{contracts:[{employeeName:'KHÔNG ĐƯỢC DÙNG'}],total:73,page:1,expiryAlerts:[{employeeName:'QA An',contractType:'Thử việc',endDate:'2026-11-30',daysRemaining:3}],expiryAlertTotal:1}};
  const rows=await collectPublicReadData(op,{},async()=>response,(r,v)=>projectRecords(op,r,{user:{}} as any,v));
  expect(rows.analysisComplete).toBe(true);expect(rows.data).toHaveLength(1);
  const reply=renderListAnalysis(op.analysis!,rows.data,{},true,'Kết quả');expect(reply).toContain('QA An');expect(reply).toContain('30/11/2026');expect(reply).not.toContain('KHÔNG ĐƯỢC DÙNG');
  await expect(collectPublicReadData(op,{},async()=>({data:{...response.data,expiryAlertTotal:2}}),(r,v)=>projectRecords(op,r,{user:{}} as any,v))).rejects.toThrow();
 });
 it('N01-04: a plural reference to complete previous rows is a union, preserving other filters',async()=>{
  const frame=meaning('N01-04'),raw=plan('N01-04');provider.mockResolvedValue({text:JSON.stringify(frame.output)});
  const rows=['QA Quốc Bình','QA Bảo Ngọc','QA Minh An'].map(name=>({'Họ và tên':name}));
  const r=await understandSemanticRequest('Cho mình số liên lạc của mấy bạn đó luôn.',null,[{role:'assistant',content:formatAssistantResultTable('Kết quả',rows)}],'',newInterpretationBudget());
  const s=source(raw.actionId,raw.values),bindings=normalize(r,s,raw);
  expect(r.referenceGroups?.[0]).toHaveLength(3);expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 });
 it('N02-03: exposes a real scoped assignment read, not a timekeeping surrogate',()=>{
  const op=operationById('worker.project.workers.list')!;
  expect(op.method).toBe('GET');expect(op.path).toBe('/worker-management/projects/:id/workers');
  expect(op.fields.find(f=>f.key==='path_id')?.reference).toBe('worker.project.list');expect(op.permissions).toContain('people:read');
  expect(op.resultChildFields?.items).toContain('fullName');expect(op.description).toContain('không phải bằng chứng có mặt');
 });
 it('N03-01: transfers a class identity from a composite display title to the native class selector',()=>{
  const frame=meaning('N03-01',1),raw=plan('N03-01',1),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values);
  const bindings=normalize(r,s,raw);expect(s.values.query_batchId).toBe('Lớp QA Anh văn 01');
  expect(JSON.stringify(s.values.analysis)).not.toContain('Lớp QA Anh văn 01');expect(bindings.get('u3')).toEqual(['values.query_batchId']);
  expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
  const evening=analyzeList(s.operation.analysis!,[{title:'Lớp QA-01 • Tiếng Anh',startAt:'2026-11-27T08:00:00+07:00'},{title:'Lớp QA-01 • Tiếng Anh',startAt:'2026-11-27T19:00:00+07:00'}],{where:{field:'startAt',operator:'between',value:['2026-11-27T18:00:00+07:00','2026-11-27T23:59:59+07:00']}},true);
  expect(evening.matched).toBe(1);
 });
 it.each(['N04-01','N05-02'])('%s: an unknown ranking metric/threshold asks a business question without a schema error',id=>{
  const frame=meaning(id),r=parseSemanticRequest(frame.text,frame.output);expect(readContextQuestion(r)).toMatch(/tiêu chí|ngưỡng/);
 });
 it('N04-03: a noun overlapping the zero-referral condition is not a second predicate',()=>{
  const frame=meaning('N04-03'),raw=plan('N04-03'),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values),bindings=normalize(r,s,raw);
  expect(bindings.get('u3')).toEqual(['action']);expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 });
 it('N05-04: a clarification reply can quote the prior read goal and retain month and threshold',async()=>{
  const a=meaning('N05-04',0),b=meaning('N05-04',1);
  const prior='Cho mình xem những đối tác lao động chưa đạt KPI giới thiệu tháng này.';
  provider.mockResolvedValueOnce({text:JSON.stringify(a.output)});
  const r=await understandSemanticRequest('Bên nào chỉ cần thêm vài người là đủ rồi?',{readContext:{scope:'test',actionId:'api.get.f7d7b097f3b2fca2',version:0,text:prior,values:{}}},[],'',newInterpretationBudget());
  provider.mockResolvedValue({text:JSON.stringify(b.output)});
  const next=await understandSemanticRequest('Chỉ còn thiếu tối đa 3 người để đạt KPI thôi nhé.',{clarification:{text:r.text,question:'Còn thiếu tối đa bao nhiêu người?'}},[],'',newInterpretationBudget());
  expect(next.units.some(u=>u.kind==='time'&&u.operator==='range')).toBe(true);expect(next.units.some(u=>u.operator==='lte'&&u.value===3)).toBe(true);
 });
 it('N06-01: preserves the specific unavailable-source question at the interpretation boundary',async()=>{
  const actual=await import('./semantic-interpreter'),frame=meaning('N06-01'),raw=plan('N06-01');
  provider.mockImplementation(async input=>{const p=input.responseSchema?.properties||{};if(p.units)return{text:JSON.stringify(frame.output)};if(p.featureKeys)return{text:JSON.stringify({featureKeys:['retail:reports'],decision:'search',question:'',unavailableModule:null})};if(p.approvedActionIds)return{text:JSON.stringify({approvedActionIds:[],question:'Bạn muốn xem chỉ số nào, và đang hỏi bán lẻ hay bán buôn?',resolutions:[]})};return{text:JSON.stringify(raw)};});
  // A one-tool catalog avoids discovery; no broader catalog/provider access.
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const result=await actual.interpretRequest(frame.text,[defaultWorkflow(operationById('retail.report.products')!)],null,[],'',[],'',[],true);
  expect(result.intentType).toBe('ambiguous');expect(result.clarification).toContain('bán lẻ hay bán buôn');expect(result.actionId).toBeNull();
 });
 it('N06-03: never silently treats cancelled as ongoing when abstract completion is ambiguous',()=>{
  const frame=meaning('N06-03',1),raw=plan('N06-03',1),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values),bindings=normalize(r,s,raw);
  expect(readLifecycleQuestion(r,bindings,[s])).toContain('đã hủy');
  s.values.analysis={where:{all:[{field:'status',operator:'ne',value:'completed'},{field:'status',operator:'ne',value:'cancelled'}]}};
  expect(readLifecycleQuestion(r,bindings,[s])).toBeUndefined();
 });
 it('N06-04: retains the previous unfinished set when selecting its oldest record',()=>{
  const frame=meaning('N06-04'),raw=plan('N06-04'),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values);
  r.readContinuation={scope:'test',actionId:raw.actionId,version:s.workflow.version,text:'Xem đơn đang xử lý',values:{analysis:{where:{all:[{field:'status',operator:'ne',value:'completed'},{field:'status',operator:'ne',value:'cancelled'}]}}}};
  const bindings=normalize(r,s,raw);expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
  const result=analyzeList(s.operation.analysis!,[{orderCode:'QA-OLD-DONE',status:'completed',createdAt:'2026-01-01'},{orderCode:'QA-CANCEL',status:'cancelled',createdAt:'2026-01-02'},{orderCode:'QA-OPEN',status:'confirmed',createdAt:'2026-11-20'}],s.values.analysis,true);
  expect(JSON.stringify(result.records)).toContain('QA-OPEN');expect(JSON.stringify(result.records)).not.toContain('QA-OLD-DONE');
  s.values.analysis={extreme:{field:'createdAt',direction:'min'}};expect(validateSemanticPlan(r,bindings,[s])).toMatchObject({ok:false});
 });
 it('N07-02: a declared full partner domain excludes an unrelated partner owner',()=>{
  const frame=captured('N07-02').turns.find((t:any)=>t.kind==='meaning'&&t.output.units.some((u:any)=>u.quote==='cộng tác viên bán lẻ'));
  const r=parseSemanticRequest(frame.text,frame.output);expect(declaredDomainModules(r,true)).toEqual(['retail-partner']);
 });
 it('N07-04: phone followup inherits the previous name search without inventing a new reference',()=>{
  const frame=meaning('N07-04'),raw=plan('N07-04'),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values);
  r.readContinuation={scope:'test',actionId:raw.actionId,version:s.workflow.version,text:'Tìm QA Đại lý Đông',values:{search:'QA Đại lý Đông'}};
  const bindings=normalize(r,s,raw);expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 });
 it('N08-01: resolves a spoken product reference through the catalog instead of literal row equality',()=>{
  const frame=meaning('N08-01',1),raw=plan('N08-01',2),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values),bindings=normalize(r,s,raw);
  expect(s.values.productId).toBe('Máy QA Điện thoại Cũ30');expect(JSON.stringify(s.values.analysis)).not.toContain('Máy QA Điện thoại Cũ30');
  expect(matchesReference({name:'QA Điện thoại Cũ 30'},String(s.values.productId))).toBe(true);
  expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 });
 it('N08-02: removes only the redundant label predicate after binding the warehouse identity',()=>{
  const frame=meaning('N08-02',1),raw=plan('N08-02',1),r=parseSemanticRequest(frame.text,frame.output),s=source(raw.actionId,raw.values),bindings=normalize(r,s,raw);
  expect(JSON.stringify(s.values.analysis)).not.toContain('Trụ sở chính');expect(s.values.warehouseId).toBe('Trụ sở chính');
  expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
  const result=analyzeList(s.operation.analysis!,[{productName:'QA Còn ít',warehouseName:'Kho bán hàng - Trụ sở chính',quantity:1},{productName:'QA Còn nhiều',warehouseName:'Kho bán hàng - Trụ sở chính',quantity:10}],s.values.analysis,true);
  expect(JSON.stringify(result.records)).toContain('QA Còn ít');expect(JSON.stringify(result.records)).not.toContain('QA Còn nhiều');
 });
 it('does not turn an explicitly literal row filter into a fuzzy native reference',()=>{
  const r=parseSemanticRequest('Tên kho bằng Trụ sở chính',{version:1,units:[{id:'u1',kind:'condition',quote:'Tên kho bằng Trụ sở chính',concept:'Tên kho',operator:'eq',value:'Trụ sở chính'}]});
  const s=source('inventory.balance.list',{analysis:{filters:[{field:'warehouseName',operator:'eq',value:'Trụ sở chính'}]}}),bindings=new Map([['u1',['analysis.filters.warehouseName']]]);
  normalizeReadReferenceBindings(r,bindings,[s]);expect(s.values.warehouseId).toBeUndefined();expect(JSON.stringify(s.values.analysis)).toContain('Trụ sở chính');
 });
 it('does not silently widen a previous top-N cohort or leak its private native reference',()=>{
  const r=parseSemanticRequest('Cho mình số điện thoại',{version:1,dialogue:{act:'followup',evidence:'Cho mình số điện thoại'},units:[{id:'u1',kind:'goal',quote:'Cho mình số điện thoại',concept:'Xem liên hệ',operator:'lookup',value:null}]});
  const s=source('inventory.balance.list',{}),id='64b000000000000000000091';
  r.readContinuation={scope:'test',actionId:s.operation.id,version:s.workflow.version,text:'Top 5',cohortDigest:'0'.repeat(64),values:{warehouseId:id,analysis:{limit:5}}};
  inheritReadConstraints(r,[s]);expect(s.values.analysis).toMatchObject({within:{limit:5}});
  s.values.warehouseId=id;expect(JSON.stringify(readPlanningValues(r,s))).not.toContain(id);
 });
});
