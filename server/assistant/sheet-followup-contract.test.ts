import {describe,expect,it} from 'vitest';
import {defaultWorkflow,operationById} from './catalog';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan,type SemanticSource} from './semantic-request';
import {analyzeList} from './list-analysis';
import {collectValues} from './policy';
import {normalizeAssistantFieldContract} from './field-contract';
import {laborPartnerReportSchema,listSettlementSchema} from '../modules/worker-management/labor-partners/validations/labor-partner.validation';

function countRequest(id:string,prefixed=false){
 const operation=operationById(id)!;
 const request=parseSemanticRequest('Cho mình biết có bao nhiêu hồ sơ',{version:1,units:[
  {id:'u1',kind:'goal',quote:'Cho mình biết',concept:'Thống kê',operator:'report',value:null},
  {id:'u2',kind:'aggregate',quote:'có bao nhiêu hồ sơ',concept:'Đếm hồ sơ',operator:'count',value:null},
  {id:'u3',kind:'output',quote:'bao nhiêu',concept:'Số lượng',operator:'none',value:null,dimension:'numeric'},
 ]});
 const prefix=prefixed?`query:${id}:`:'';
 const bindings=bindSemanticRequest(request,[{unitId:'u1',targets:[prefix+'action']},{unitId:'u2',targets:[prefix+'analysis.aggregate.count']},{unitId:'u3',targets:[prefix+'analysis.aggregate.count']}],[]).bindings;
 const source:SemanticSource={operation,workflow:defaultWorkflow(operation),values:{analysis:{aggregate:{operation:'count'}}}};
 return {request,bindings,source};
}

describe('follow-up Sheet contract checks, without provider or business writes',()=>{
 it.each(['partner.analysis','employee.list','student.list','product.list','worker.list','batch.list','retail.order.list'])('accepts a repeated count output in %s without a second model approval',id=>{
  const s=countRequest(id,true);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  expect(analyzeList(s.source.operation.analysis!,[{name:'QA A'},{name:'QA B'}],s.source.values.analysis,true).records[0]['Số lượng']).toBe('2');
 });
 it.each(['missing-calculation','wrong-operator','unrelated-output','non-numeric-output','extra-filter','write','wrong-source'])('keeps %s invalid despite the repeated output',kind=>{
  const s=countRequest('partner.analysis');
  if(kind==='missing-calculation')s.request.units=s.request.units.filter(u=>u.id!=='u2');
  if(kind==='wrong-operator')s.request.units[1].operator='sum';
  if(kind==='non-numeric-output'){
   s.request.units[2].quote='hồ sơ';s.request.units[2].concept='Tên hồ sơ';s.request.units[2].dimension='none';
  }
  if(kind==='unrelated-output'){
   s.request.text+=' và ngày tạo';s.request.units[2].quote='ngày tạo';s.request.units[2].concept='Ngày tạo';
  }
  if(kind==='extra-filter')s.source.values.analysis={aggregate:{operation:'count'},filters:[{field:'unpaidBalance',operator:'gt',value:300000}]};
  if(kind==='write')s.source={...s.source,operation:{...s.source.operation,method:'POST',readOnly:false}};
  if(kind==='wrong-source')s.bindings.set('u2',['query:employee.list:analysis.aggregate.count']);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);
 });
 it('retains the exact requested calendar range in Sheet S4-R007',()=>{
  const s=countRequest('partner.analysis'),quote='Tháng này';
  s.request.text=quote+' '+s.request.text;
  s.request.units.push({id:'u4',kind:'time',quote,concept:'Ngày tạo đối tác',operator:'range',value:{from:'2026-11-01',to:'2026-11-30'}});
  s.bindings.set('u4',['values.createdFrom','values.createdTo']);
  s.source.values={...s.source.values,createdFrom:'2026-11-01',createdTo:'2026-11-30'};
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  s.source.values.createdTo='2026-12-01';
  expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);
 });
 it.each([
  ['/worker-management/partners/dashboard','periodFrom','periodTo',laborPartnerReportSchema],
  ['/worker-management/partners/reports/commission','periodFrom','periodTo',laborPartnerReportSchema],
  ['/worker-management/partners/settlements','periodStart','periodEnd',listSettlementSchema],
 ] as const)('matches the real calendar API contract at %s',async(path,from,to,schema)=>{
  const {ASSISTANT_OPERATIONS}=await import('./catalog');
  const operation=ASSISTANT_OPERATIONS.find(o=>o.method==='GET'&&o.path===path)!;
  const workflow=defaultWorkflow(operation),first=workflow.fields.find(f=>f.apiKey===from)!,last=workflow.fields.find(f=>f.apiKey===to)!;
  expect([first.type,last.type]).toEqual(['date','date']);
  expect(schema.validate({[from]:'2026-11-01',[to]:'2026-11-30'}).error).toBeUndefined();
  expect(schema.validate({[from]:'2026-11'}).error).toBeDefined();
  expect(collectValues(workflow,{[first.key]:'2026-11-01',[last.key]:'2026-11-30'}).errors).toEqual([]);
  const request=parseSemanticRequest('Báo cáo tháng này',{version:1,units:[{id:'u1',kind:'goal',quote:'Báo cáo',concept:'Báo cáo',operator:'report',value:null},{id:'u2',kind:'time',quote:'tháng này',concept:'Kỳ',operator:'range',value:{from:'2026-11-01',to:'2026-11-30'}}]});
  const bindings=bindSemanticRequest(request,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:[`values.${first.key}`,`values.${last.key}`]}],[]).bindings;
  const source={operation,workflow,values:{[first.key]:'2026-11-01',[last.key]:'2026-11-30'}};
  expect(validateSemanticPlan(request,bindings,[source])).toEqual({ok:true});
  expect(validateSemanticPlan(request,bindings,[{...source,values:{[first.key]:'2026-11-30',[last.key]:'2026-11-01'}}]).ok).toBe(false);
 });
 it('does not infer calendar dates from arbitrary period labels or month-only inputs',()=>{
  for(const field of [{key:'period',label:'Kỳ YYYY-MM',pattern:'^\\d{4}-\\d{2}$'},{key:'query_periodFrom',apiKey:'periodFrom',label:'Từ đầu kỳ'},{key:'name',label:'Tên kỳ'}])
   expect(normalizeAssistantFieldContract({...field,type:'text',source:'query'}).type).toBe('text');
 });
});
