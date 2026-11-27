import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {defaultWorkflow,operationById} from './catalog';
import {normalizeAssistantFieldContract} from './field-contract';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan,normalizeSemanticInputBindings,normalizeSemanticAnalysisBindings,normalizeSemanticReadProjection} from './semantic-request';
import {compileSemanticResolutions,omitInferredRuntimeDefaults} from './semantic-compilation';
import {normalizeAssistantInputValues} from './input-contract';
import {collectPublicReadData} from './public-read-query';
import {projectRecords} from './executor';
import {analyzeList} from './list-analysis';
import {validateField} from './policy';
const captures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-sheet-failures.json',import.meta.url),'utf8'));
const frame=(text:string,units:any[])=>parseSemanticRequest(text,{version:1,units});
const unit=(kind:string,quote:string,operator='none',value:any=null)=>({id:'u1',kind,quote,concept:quote,operator,value,dimension:'none'});

describe('real captured sheet plans, replayed without a provider/database',()=>{
 it.each(captures)('$id: keeps the original evidence, fields and reviewed meaning',row=>{
  const plan=structuredClone(row.plans[0]),request=parseSemanticRequest(row.text,row.meaning);
  const bindings=bindSemanticRequest(request,plan.meaningBindings,plan.remainingRequests||[]).bindings;
  const op=operationById(plan.actionId)!,workflow=defaultWorkflow(op);
  const sources=[{operation:op,workflow,values:normalizeAssistantInputValues(workflow,plan.values).values}];
  normalizeSemanticInputBindings(bindings,sources);normalizeSemanticReadProjection(request,bindings,sources);normalizeSemanticAnalysisBindings(bindings,sources);omitInferredRuntimeDefaults(sources,bindings);
  const fit=row.fit[0];request.actionFitRequired=true;request.approvedActionIds=fit.approvedActionIds;
  compileSemanticResolutions(request,sources,bindings,fit.resolutions);
  expect(validateSemanticPlan(request,bindings,sources,plan.remainingRequests||[])).toEqual({ok:true});
 });
 it('uses the server count, not the number of summary rows',async()=>{
  const op=operationById('employee.count')!,workflow=defaultWorkflow(op),request=frame('Tổng số nhân sự',[unit('aggregate','Tổng số nhân sự','count')]);
  const bindings=bindSemanticRequest(request,[{unitId:'u1',targets:['analysis.aggregate.count']}],[]).bindings;
  const source={operation:op,workflow,values:{analysis:{aggregate:{operation:'count'}}} as Record<string,any>};
  normalizeSemanticReadProjection(request,bindings,[source]);
  expect(validateSemanticPlan(request,bindings,[source])).toEqual({ok:true});
  const data=await collectPublicReadData(op,{},async()=>({data:{count:7,scope:'company'}}),r=>projectRecords(op,r,{} as any));
  const result=analyzeList(op.analysis!,data.data,source.values.analysis,true);
  expect(result.records).toEqual([{'Số nhân sự':'7'}]);
 });
 it.each([{}, {data:{scope:'company'}}, {data:{count:-1}}, {data:{count:1.5}}])('does not turn a missing or invalid summary into a zero count: %j',async response=>{
  const op=operationById('employee.count')!;
  await expect(collectPublicReadData(op,{},async()=>response,r=>projectRecords(op,r,{} as any))).rejects.toThrow(/chưa trả đủ/);
 });
 it('never changes names/codes to date fields, or invents a clock',()=>{
  expect(normalizeAssistantFieldContract({key:'query_date',apiKey:'date',label:'Ngày (YYYY-MM-DD)',type:'text'}).type).toBe('date');
  for(const key of ['name','productCode','title'])expect(normalizeAssistantFieldContract({key,label:'Ví dụ YYYY-MM-DD',type:'text'}).type).toBe('text');
  expect(()=>validateField({key:'dueAt',label:'Hạn nộp',type:'datetime'},'2026-11-28')).toThrow(/bổ sung giờ/);
  expect(()=>validateField({key:'date',label:'Ngày',type:'date'},'2026-02-30')).toThrow();
 });
 it('accepts an exact literal entity in a declared input but rejects an invented name',()=>{
  const op=operationById('department.lookup')!,workflow=defaultWorkflow(op),request=frame('Phòng Tài chính QA',[unit('entity','Phòng Tài chính QA')]);
  const bindings=bindSemanticRequest(request,[{unitId:'u1',targets:['values.query_department']}],[]).bindings;
  expect(validateSemanticPlan(request,bindings,[{operation:op,workflow,values:{query_department:'Phòng Tài chính QA'}}]).ok).toBe(true);
  expect(validateSemanticPlan(request,bindings,[{operation:op,workflow,values:{query_department:'Phòng khác'}}]).ok).toBe(false);
 });
 it('keeps an explicitly supplied default while hiding an unbound model default',()=>{
  const op=operationById('hr.contract.create')!,workflow=defaultWorkflow(op),status=workflow.fields.find(f=>f.key==='status')!;
  expect(status.defaultValue).toBeDefined();
  const source={operation:op,workflow,values:{status:status.defaultValue} as Record<string,unknown>};
  omitInferredRuntimeDefaults([source],new Map());expect(source.values.status).toBeUndefined();
  source.values.status=status.defaultValue;omitInferredRuntimeDefaults([source],new Map([['u1',['values.status']]]));expect(source.values.status).toBe(status.defaultValue);
 });
 it('cannot waive concrete numbers or reuse an ordering approval after plan mutation',()=>{
  const op=operationById('partner.analysis')!,source={operation:op,workflow:defaultWorkflow(op),values:{analysis:{extreme:{field:'totalReferredTuition',direction:'max'}}}};
  const request=frame('gần nhất',[{...unit('ordering','gần nhất','desc'),dimension:'numeric'}]),bindings=bindSemanticRequest(request,[{unitId:'u1',targets:['analysis.extreme.totalReferredTuition']}],[]).bindings;
  compileSemanticResolutions(request,[source],bindings,[{unitId:'u1',actionId:op.id,role:'ordering',target:'analysis.extreme.totalReferredTuition',predicates:[]}]);
  expect(validateSemanticPlan(request,bindings,[source]).ok).toBe(true);
  source.values.analysis.extreme.direction='min';expect(validateSemanticPlan(request,bindings,[source]).ok).toBe(false);
  const numeric=frame('trên 300000',[unit('condition','trên 300000','gt',300000)]),bound=new Map([['u1',['action']]]);
  compileSemanticResolutions(numeric,[source],bound,[{unitId:'u1',actionId:op.id,role:'builtin_condition',target:'action',predicates:[]}]);expect(validateSemanticPlan(numeric,bound,[source]).ok).toBe(false);
 });
 it('requires reviewed enum selectors and rejects stale values, references and free text',()=>{
  const op=operationById('hr.leave.applications.list')!,source={operation:op,workflow:defaultWorkflow(op),values:{requestKind:'leave'}};
  const request=frame('nghỉ phép',[unit('entity','nghỉ phép')]),bindings=new Map([['u1',['values.requestKind']]]);
  expect(validateSemanticPlan(request,bindings,[source]).ok).toBe(false);
  compileSemanticResolutions(request,[source],bindings,[{unitId:'u1',actionId:op.id,role:'enum_input',target:'values.requestKind',predicates:[]}]);
  expect(validateSemanticPlan(request,bindings,[source]).ok).toBe(true);
  source.values.requestKind='wfh';expect(validateSemanticPlan(request,bindings,[source]).ok).toBe(false);
  for(const target of ['values.employeeName','values.employeeId']){
   const fresh=frame('nghỉ phép',[unit('entity','nghỉ phép')]);compileSemanticResolutions(fresh,[source],new Map([['u1',[target]]]),[{unitId:'u1',actionId:op.id,role:'enum_input',target,predicates:[]}]);
   expect(fresh.compiledRoles?.u1).toBeUndefined();
  }
 });
 it('accepts a reviewed literal text assignment containing a number but never invents a replacement',()=>{
  const op=operationById('course.update')!,source={operation:op,workflow:defaultWorkflow(op),values:{duration:'24 buổi'}};
  const request=frame('giảm xuống 24 buổi',[unit('input','giảm xuống 24 buổi','eq',24)]),bindings=new Map([['u1',['values.duration']]]);
  compileSemanticResolutions(request,[source],bindings,[{unitId:'u1',actionId:op.id,role:'input_assignment',target:'values.duration',predicates:[]}]);
  expect(request.compiledRoles?.u1?.value).toBe('24 buổi');
  source.values.duration='25 buổi';expect(validateSemanticPlan(request,bindings,[source]).ok).toBe(false);
 });
});
