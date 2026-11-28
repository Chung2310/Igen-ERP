import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const provider=vi.hoisted(()=>vi.fn());
vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
import {operationById,defaultWorkflow} from './catalog';
import {parseSemanticRequest,bindSemanticRequest,normalizeSemanticReadProjection,normalizeSemanticInputBindings,normalizeSemanticAnalysisBindings,validateSemanticPlan} from './semantic-request';
import {declaredDomainModules} from './semantic-compilation';
import {verifyActionFit} from './capability-routing';
import {newInterpretationBudget} from './interpretation-budget';
import {analyzeList,renderListAnalysis,validateListAnalysis} from './list-analysis';
import {buildAssistantCapabilityContext} from './capability-context';
import {parseAssistantResultTable} from '../../src/shared/assistant-result-table';
const captures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-read-relaxation.json',import.meta.url),'utf8'));
function captured(id:string){
 const row=structuredClone(captures.find((r:any)=>r.id===id)),request=parseSemanticRequest(row.text,row.meaning),operation=operationById(row.plan.actionId)!,workflow=defaultWorkflow(operation),source={operation,workflow,values:row.plan.values};
 const bindings=bindSemanticRequest(request,row.plan.meaningBindings,[]).bindings;
 normalizeSemanticInputBindings(bindings,[source]);normalizeSemanticReadProjection(request,bindings,[source]);normalizeSemanticAnalysisBindings(bindings,[source]);
 return {request,bindings,source};
}
afterEach(()=>provider.mockReset());
describe('shared read flexibility with grounded outputs and unchanged authorization',()=>{
 it('does not lock a customer debt read into the customer module',async()=>{
  const s=captured('S6-R027'),customer=defaultWorkflow(operationById('customer.list')!);
  expect(declaredDomainModules(s.request)).toContain('customer');expect(declaredDomainModules(s.request,true)).toEqual([]);
  const subset=parseSemanticRequest('Trong số các khách hàng, ai còn nợ?',{version:1,units:[{id:'u1',kind:'entity',quote:'khách hàng',concept:'Khách hàng',operator:'none',value:null}]});
  expect(declaredDomainModules(subset,true)).toEqual([]);
  provider.mockImplementationOnce(async input=>{expect(input.responseSchema.properties.approvedActionIds.items.enum).toContain(s.source.operation.id);return {text:JSON.stringify({approvedActionIds:[s.source.operation.id],question:'',resolutions:[]})};});
  expect((await verifyActionFit(s.request,[s.source],[customer,s.source.workflow],newInterpretationBudget(),[],s.bindings)).approvedActionIds).toEqual([s.source.operation.id]);
 });
 it('retains explicit module restrictions and write ownership',async()=>{
  const request=parseSemanticRequest('Trong quản lý lao động, xem lao động',{version:1,units:[{id:'u1',kind:'goal',quote:'xem',concept:'Tra cứu',operator:'lookup',value:null},{id:'u2',kind:'entity',quote:'quản lý lao động',concept:'Phân hệ lao động',operator:'none',value:null}]});
  expect(declaredDomainModules(request,true)).toContain('worker');
  const op=operationById('employee.list')!,source={operation:op,workflow:defaultWorkflow(op),values:{}};
  expect((await verifyActionFit(request,[source],[source.workflow],newInterpretationBudget())).approvedActionIds).toEqual([]);expect(provider).not.toHaveBeenCalled();
  const s=captured('S6-R027');s.request.units.find(u=>u.kind==='goal')!.operator='update';
  provider.mockImplementationOnce(async input=>{expect(input.responseSchema.properties.approvedActionIds.items.enum).not.toContain(s.source.operation.id);return {text:JSON.stringify({approvedActionIds:[],question:'Chọn thao tác đúng loại hồ sơ',resolutions:[]})};});
  await verifyActionFit(s.request,[s.source],[s.source.workflow,defaultWorkflow(operationById('customer.list')!)],newInterpretationBudget());
 });
 it('returns the requested names and total over the same filtered complete rows',()=>{
  const s=captured('S6-R027');expect(s.source.values.analysis.includeRows).toBe(true);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  const rows=[{customerName:'QA A',balance:500},{customerName:'QA B',balance:100},{customerName:'QA C',balance:0}];
  const result=analyzeList(s.source.operation.analysis!,rows,s.source.values.analysis,true);
  expect(result.detailRecords).toEqual([{'Khách hàng':'QA A','Số dư còn lại':'500'},{'Khách hàng':'QA B','Số dư còn lại':'100'}]);
  const table=parseAssistantResultTable(renderListAnalysis(s.source.operation.analysis!,rows,s.source.values.analysis,true,'Mình tìm thấy các khách hàng còn nợ.'))!;
  expect(table.rows).toHaveLength(2);expect(table.after.join(' ')).toContain('600');
  expect(()=>analyzeList(s.source.operation.analysis!,rows,s.source.values.analysis,false)).toThrow();
 });
 it.each(['unrequested-details','unknown-field','extra-condition','grouped-details'])('does not relax %s',kind=>{
  const s=captured('S6-R027');
  if(kind==='unrequested-details'){s.request.units=s.request.units.filter(u=>u.id!=='u4');expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);}
  if(kind==='unknown-field'){s.source.values.analysis.select.push('password');expect(()=>validateListAnalysis(s.source.values.analysis,s.source.operation.analysis!)).toThrow();}
  if(kind==='extra-condition'){s.source.values.analysis.where={all:[s.source.values.analysis.where,{field:'balance',operator:'lt',value:300}]};expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);}
  if(kind==='grouped-details'){s.source.values.analysis.groupBy='customerName';expect(()=>validateListAnalysis(s.source.values.analysis,s.source.operation.analysis!)).toThrow();}
 });
 it('binds grouped report amounts and dimensions to reviewed leaves instead of rejecting the envelope',()=>{
  const s=captured('S6-R003');expect(s.source.values.analysis).toBeUndefined();
  expect(s.bindings.get('u4')).toEqual(['result.paymentMix.amount']);expect(s.bindings.get('u5')).toEqual(['result.paymentMix.method']);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  const context=buildAssistantCapabilityContext([s.source.workflow])[0];expect(context.outputs).toContain('paymentMix');expect(context.precomputedGroups).toEqual(s.source.operation.precomputedGroups);
  s.bindings.set('u4',['result.paymentMix.method']);expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);
 });
 it.each(['student','inventory','finance'])('uses the same grouped report contract in module %s',module=>{
  const s=captured('S6-R003');s.source.operation={...s.source.operation,module:module as any};
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  s.source.operation={...s.source.operation,method:'POST',readOnly:false};expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);
 });
 it('exposes verified receipt dates for latest/earliest searches without inventing fields',()=>{
  const op=operationById('inventory.receipt.list')!,context=buildAssistantCapabilityContext([defaultWorkflow(op)])[0];
  for(const key of ['createdAt','receivedAt','confirmedAt']){expect(context.outputs).toContain(key);expect(op.analysis!.fields[key].format).toBe('date');}
 });
});
