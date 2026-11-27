import {it,expect} from 'vitest';
import {operationById,defaultWorkflow} from './catalog';
import {buildRetailReportModel} from '../modules/retail/services/retail-report-metrics';
import {summarizeCompletedReturns} from '../modules/retail/services/retail-return-report';
import {buildTuitionBalances} from '../modules/student-management/services/tuition-balance.service';
import {validateListAnalysis} from './list-analysis';
import {readFileSync} from 'node:fs';
import {parseSemanticRequest,bindSemanticRequest,normalizeSemanticInputBindings,normalizeSemanticAnalysisBindings,normalizeSemanticReadProjection,validateSemanticPlan} from './semantic-request';
import {compileSemanticResolutions} from './semantic-compilation';
import {canonicalFilterEnums} from './filter-expression';
import {projectRecords} from './executor';
import {hydratePartialUpdate} from './partial-update';
import {formatAssistantResult} from './result-format';

const captures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-old30-confirmed.json',import.meta.url),'utf8'));
const round2=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-old30-round2.json',import.meta.url),'utf8'));
const finalFrames=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-old30-final.json',import.meta.url),'utf8'));
for(const id of ['S8-R011','S8-R071'])it(`compiles the final real failed plan ${id} through declared contracts`,()=>{
 const c=finalFrames.find((c:any)=>c.id===id),r=parseSemanticRequest(c.text,c.meaning),operation=operationById(c.plan.actionId)!;
 const source={operation,workflow:defaultWorkflow(operation),values:structuredClone(c.plan.values)};
 r.actionFitRequired=true;r.approvedActionIds=[operation.id];
 const {bindings}=bindSemanticRequest(r,c.plan.meaningBindings,[]);
 normalizeSemanticInputBindings(bindings,[source],r);normalizeSemanticReadProjection(r,bindings,[source]);normalizeSemanticAnalysisBindings(bindings,[source],r.evaluatedAt,r);
 compileSemanticResolutions(r,[source],bindings,[...c.reviews[0].resolutions,...(id==='S8-R011'?[{unitId:'u10',actionId:operation.id,role:'public_output',target:'analysis.aggregate.availableQuantity',predicates:[]}]:[])]);
 expect(validateSemanticPlan(r,bindings,[source]),JSON.stringify(validateSemanticPlan(r,bindings,[source]))).toEqual({ok:true});
 if(id==='S8-R071')expect(validateSemanticPlan(r,bindings,[{...source,operation:{...operation,predicateInputFields:[]}}]).ok).toBe(false);
});
it('does not infer an aggregate from a per-record output alone',()=>{
 const r=parseSemanticRequest('Xem giá trị hàng',{version:1,units:[{id:'u1',kind:'goal',quote:'Xem',concept:'Xem',operator:'lookup',value:null},{id:'u2',kind:'output',quote:'giá trị hàng',concept:'Giá trị',operator:'none',value:null}]});
 const operation=operationById('inventory.balance.list')!,source={operation,workflow:defaultWorkflow(operation),values:{analysis:{aggregate:{operation:'sum',field:'stockValue'}}}};
 const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['result.stockValue']}],[]);
 normalizeSemanticAnalysisBindings(bindings,[source],r.evaluatedAt,r);
 expect(bindings.get('u2')).toEqual(['result.stockValue']);expect(validateSemanticPlan(r,bindings,[source]).ok).toBe(false);
});
for(const id of ['S4-R050','S8-R045','S6-R043'])it(`compiles the second-round real rejected frame ${id}`,()=>{
 const c=round2.find((c:any)=>c.id===id),r=parseSemanticRequest(c.text,c.meaning),operation=operationById(c.plan.actionId)!;
 const source={operation,workflow:defaultWorkflow(operation),values:structuredClone(c.plan.values)};
 const {bindings}=bindSemanticRequest(r,c.plan.meaningBindings,[]);
 normalizeSemanticInputBindings(bindings,[source],r);normalizeSemanticAnalysisBindings(bindings,[source],r.evaluatedAt);normalizeSemanticReadProjection(r,bindings,[source]);
 compileSemanticResolutions(r,[source],bindings,c.reviews[0].resolutions);
 expect(validateSemanticPlan(r,bindings,[source]),JSON.stringify({id,checked:validateSemanticPlan(r,bindings,[source])})).toEqual({ok:true});
 expect(Object.keys(source.values).some(key=>key.startsWith('items.'))).toBe(false);
});
it('keeps all new catalog references registered',()=>{
 for(const id of ['student.tuition.balance.list','student.tuition.reminder.send','student.tuition.reminder.preview','inventory.ledger.list','inventory.transfer.serial.create']){
  for(const field of operationById(id)!.fields)if(field.reference)expect(operationById(field.reference),`${id}:${field.reference}`).toBeTruthy();
 }
});
it('anchors relative dates once in Vietnam time without rewriting ordinary text or calendar literals',()=>{
 const clock='2026-11-27T18:30:00.000Z',fields={endsAt:{type:'text' as const,format:'date'},name:{type:'text' as const,contains:true}};
 expect(canonicalFilterEnums({field:'endsAt',operator:'gte',value:'today'},fields,clock)).toMatchObject({value:'2026-11-28'});
 expect(canonicalFilterEnums({field:'endsAt',operator:'gte',value:'now'},fields,clock)).toMatchObject({value:clock});
 expect(canonicalFilterEnums({field:'name',operator:'eq',value:'now'},fields,clock)).toMatchObject({value:'now'});
 expect(canonicalFilterEnums({field:'endsAt',operator:'gte',value:'2026-10-01'},fields,clock)).toMatchObject({value:'2026-10-01'});
 expect(canonicalFilterEnums({field:'endsAt',operator:'not_empty'},fields,clock)).toEqual({field:'endsAt',operator:'not_empty'});
});
for(const id of ['S6-R003','S6-R009','S6-R023','S2-R005','S2-R002','S3-R083','S4-R050'])it(`compiles the real rejected frame ${id} without another provider call`,()=>{
 const c=captures.find((c:any)=>c.id===id),r=parseSemanticRequest(c.text,c.meaning),operation=operationById(c.plan.actionId)!;
 const source={operation,workflow:defaultWorkflow(operation),values:structuredClone(c.plan.values)};
 const {bindings}=bindSemanticRequest(r,c.plan.meaningBindings,[]);
 normalizeSemanticInputBindings(bindings,[source],r);normalizeSemanticAnalysisBindings(bindings,[source]);normalizeSemanticReadProjection(r,bindings,[source]);
 const review=c.reviews.find((v:any)=>v.approvedActionIds.includes(operation.id));
 compileSemanticResolutions(r,[source],bindings,review?.resolutions);
 expect(validateSemanticPlan(r,bindings,[source]),JSON.stringify({id,diagnostic:validateSemanticPlan(r,bindings,[source])})).toEqual({ok:true});
 if(id==='S6-R009'){
  const changed=structuredClone(r);changed.units.find(u=>u.id==='u4')!.value='khác';expect(validateSemanticPlan(changed,bindings,[source]).ok).toBe(false);
  const missing=new Map(bindings);missing.set('u8',['result.orderStateSummary.completedCount']);expect(validateSemanticPlan(r,missing,[source]).ok).toBe(false);
 }
});
it('canonicalizes only unique declared labels and preserves nested negation',()=>{
 const fields={state:{type:'text' as const,values:{active:'Hoạt động',inactive:'Tạm dừng'}}};
 expect(canonicalFilterEnums({not:{any:[{field:'state',operator:'eq',value:'Tạm dừng'}]}},fields)).toEqual({not:{any:[{field:'state',operator:'eq',value:'inactive'}]}});
 expect(canonicalFilterEnums({field:'state',operator:'eq',value:'gần hoạt động'},fields)).toEqual({field:'state',operator:'eq',value:'gần hoạt động'});
});
it('retains an unquantified condition for clarification and refuses executing it as a missing filter',()=>{
 const r=parseSemanticRequest('Tìm hồ sơ có mức độ cao',{version:1,units:[{id:'u1',kind:'goal',quote:'Tìm',concept:'Tra cứu',operator:'lookup',value:null},{id:'u2',kind:'condition',quote:'mức độ cao',concept:'Chưa có ngưỡng',operator:'none',value:null}]});
 const operation=operationById('student.list')!,source={operation,workflow:defaultWorkflow(operation),values:{}};
 const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['action']}],[]);
 expect(validateSemanticPlan(r,bindings,[source]).ok).toBe(false);
});
it('projects declared scalar report outputs without inventing a record ID',()=>{
 const records=projectRecords(operationById('retail.partner.summary')!,{success:true,data:{totalCount:3,activeCount:2,inactiveCount:1,collaboratorCount:1,dealerCount:1,supplierCount:1,secret:'hidden'}},{user:{companyCode:'TEST'}} as any);
 expect(records).toHaveLength(1);expect(records[0]).toMatchObject({totalCount:3,activeCount:2,inactiveCount:1});expect(records[0]).not.toHaveProperty('secret');
});
it('retains the requested role when a legacy partner belongs to multiple roles',()=>{
 const records=projectRecords(operationById('retail.partner.list')!,{data:[{name:'QA A',roles:['dealer','collaborator']}]},{user:{companyCode:'TEST'}} as any,{role:'collaborator'});
 expect(records[0].role).toBe('collaborator');
});
it('renders named report measures through the shared table rather than opaque envelope text',()=>{
 const reply=formatAssistantResult(operationById('retail.report.order-states')!,[{orderStateSummary:{completedCount:1,cancelledCount:2,pendingCount:3}}]);
 expect(reply).toContain('Đơn hoàn tất');expect(reply).toContain('Đơn đã hủy');expect(reply).toContain('Đơn chưa xong');expect(reply).not.toContain('Thông tin:');
});
it('grounds a reviewed literal assignment in the unique original user value when NLU quoted only its field label',()=>{
 const operation=operationById('worker.project.update')!,source={operation,workflow:defaultWorkflow(operation),values:{location:'140 Đường QA'}};
 const r=parseSemanticRequest('Cập nhật địa điểm thành 140 Đường QA',{version:1,units:[{id:'u1',kind:'goal',quote:'Cập nhật',concept:'Sửa',operator:'update',value:null},{id:'u2',kind:'input',quote:'địa điểm',concept:'Địa điểm',operator:'eq',value:'140 Đường QA'}]});
 const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.location']}],[]);
 expect(validateSemanticPlan(r,bindings,[source]).ok).toBe(false);
 r.approvedActionIds=[operation.id];expect(validateSemanticPlan(r,bindings,[source])).toEqual({ok:true});
 const invented=structuredClone(r);invented.text='Cập nhật địa điểm';expect(validateSemanticPlan(invented,bindings,[source]).ok).toBe(false);
});
it('retains numeric API weekdays in their declared editable representation during a location-only update',()=>{
 const op=operationById('worker.project.update')!;
 const hydrated=hydratePartialUpdate(op,{daysOfWeek:[1,2,3,4,5,6],location:'Cũ'},{location:'QA mới'});
 expect(hydrated.values.daysOfWeek).toBe(JSON.stringify(['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7']));
});

it('counts pending drafts even without an issued order code and preserves the three business states',()=>{
 const order=(status:string,orderCode?:string)=>({status,orderCode,grandTotal:0,totalCost:0,dueAmount:0,items:[]});
 const report=buildRetailReportModel({orders:[order('draft'),order('confirmed','QA-1'),order('completed','QA-2'),order('cancelled','QA-3')],shifts:[],days:['2026-11-27'],today:'2026-11-27',includeProfit:false});
 expect(report.orderStateSummary).toEqual({completedCount:1,cancelledCount:1,pendingCount:2});
 expect(report.summary.totalCost).toBeUndefined();
});
it('counts different return customers by identity, preserving an honest unknown instead of grouping equal names',()=>{
 expect(summarizeCompletedReturns([{customerId:'c1',totalAmount:100},{customerId:'c1',totalAmount:200},{customerId:'c2',totalAmount:50}])).toEqual({customerCount:2,refundTotal:350,documentCount:3,unidentifiedCount:0});
 expect(summarizeCompletedReturns([{totalAmount:100}]).customerCount).toBeNull();
 expect(()=>summarizeCompletedReturns([{customerId:'c1',totalAmount:-1}])).toThrow();
});
it('reconciles tuition by payment history first and retains the imported paid-amount fallback',()=>{
 const students=[{_id:'s1',fullName:'QA A',fee:'5.000.000',paidAmount:0},{_id:'s2',fullName:'QA B',fee:'3.000.000',paidAmount:1000000},{_id:'s3',fullName:'QA C',fee:'2.000.000',paidAmount:0}];
 const rows=buildTuitionBalances(students,[{studentId:'s1',amount:2000000},{studentId:'s3',amount:2000000}]);
 expect(rows.map(r=>[r.fullName,r.remainingAmount])).toEqual([['QA A',3000000],['QA B',2000000]]);
 expect(()=>buildTuitionBalances(students,[{studentId:'s1',amount:'not-money'}])).toThrow();
});
it('publishes source-correct shared filtering contracts and hides the retired serial endpoint',()=>{
 expect(operationById('inventory.serial.transfer.local')!.unavailableReason).toBeTruthy();
 expect(operationById('inventory.transfer.create')!.fields.some(f=>f.key==='toWarehouseId')).toBe(true);
 expect(operationById('student.equipment.list')!.fixedQueryValues).toEqual({excludeType:'Phòng học'});
 for(const id of ['inventory.balance.list','student.tuition.balance.list']){
  const operation=operationById(id)!;expect(operation.method).toBe('GET');expect(defaultWorkflow(operation).enabled).toBe(true);
  expect(validateListAnalysis({aggregate:{operation:'count'}},operation.analysis!)).toBeTruthy();
 }
 expect(operationById('inventory.receipt.list')!.analysis!.fields.effectiveReceivedAt.format).toBe('date');
});
