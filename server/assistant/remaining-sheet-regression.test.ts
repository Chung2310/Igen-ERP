import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {operationById,defaultWorkflow} from './catalog';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan,normalizeSemanticInputBindings,normalizeSemanticReadProjection,normalizeSemanticAnalysisBindings} from './semantic-request';
import {compileSemanticResolutions,omitInferredRuntimeDefaults,declaredDomainModules,isSnapshotContext} from './semantic-compilation';
import {analyzeList} from './list-analysis';
import {hasExactFilterConjunction} from './filter-expression';
import {normalizeAssistantFieldContract} from './field-contract';
import {assistantDefaultedPresentationLabels} from './completion';
import {projectAssistantResultContract} from './result-field-policy';
import {compositeReportEnvelope,projectCompositeSourceData,validateCompositeQueryPlan} from './composite-query';

const captured=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-remaining-sheet.json',import.meta.url),'utf8'));
const retries=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-remaining25-retry.json',import.meta.url),'utf8'));
function capturedRetry(id:string){
 const row=structuredClone(retries.find((r:any)=>r.id===id)),plan=row.plan;
 const request=parseSemanticRequest(row.text,row.meaning),bindings=bindSemanticRequest(request,plan.meaningBindings,plan.remainingRequests||[]).bindings;
 const operation=operationById(plan.actionId)!,source={operation,workflow:defaultWorkflow(operation),values:plan.values};
 normalizeSemanticInputBindings(bindings,[source]);normalizeSemanticReadProjection(request,bindings,[source]);normalizeSemanticAnalysisBindings(bindings,[source]);
 request.actionFitRequired=true;request.approvedActionIds=row.fit.approvedActionIds;
 return {row,request,bindings,source};
}
const fixture=(id:string)=>captured.find((r:any)=>r.id===id);
function prepare(id:string,adjust?:(plan:any,row:any)=>void){
 const row=fixture(id),plan=structuredClone(row.plans.at(-1));adjust?.(plan,row);
 const request=parseSemanticRequest(row.text,row.meaning),bindings=bindSemanticRequest(request,plan.meaningBindings,plan.remainingRequests||[]).bindings;
 const sources=(plan.queryPlan||[plan]).map((p:any)=>{const operation=operationById(p.actionId)!;return {operation,workflow:defaultWorkflow(operation),values:p.values||{},...(p.resultFields?{resultFields:p.resultFields}:{})};});
 normalizeSemanticInputBindings(bindings,sources);normalizeSemanticReadProjection(request,bindings,sources);normalizeSemanticAnalysisBindings(bindings,sources);omitInferredRuntimeDefaults(sources,bindings);
 return {row,plan,request,bindings,sources};
}
const review=(state:ReturnType<typeof prepare>,extra:any[]=[])=>{
 const fit=state.row.fit.at(-1);state.request.actionFitRequired=true;state.request.approvedActionIds=fit?.approvedActionIds||state.sources.map((s:any)=>s.operation.id);
 compileSemanticResolutions(state.request,state.sources,state.bindings,[...(fit?.resolutions||[]),...extra]);
 return validateSemanticPlan(state.request,state.bindings,state.sources,state.plan.remainingRequests||[]);
};

describe('remaining original sheet failures: source contracts and semantic compilation',()=>{
 it('does not confuse query defaults with returned record fields, while still hiding actual defaulted write fields',()=>{
  const read=operationById('inventory.transfer.list')!,base={operation:read,workflow:defaultWorkflow(read),values:{},result:{},defaultedKeys:['query_status']};
  expect(assistantDefaultedPresentationLabels(base)).toEqual([]);
  const write=operationById('worker.create')!;
  expect(assistantDefaultedPresentationLabels({...base,operation:write,workflow:defaultWorkflow(write),defaultedKeys:['status']})).toContain('Trạng thái');
  expect(assistantDefaultedPresentationLabels({...base,operation:write,workflow:defaultWorkflow(write),defaultedKeys:[]})).toEqual([]);
 });
 it('projects the exact approved report leaf, preserves null as unknown and rejects missing/ambiguous report envelopes',()=>{
  const op=operationById('api.get.65204362fe283948')!,projected=projectAssistantResultContract(op,['summary.netProfit','summary.token','privateUnknown']);
  expect(projected.resultFields).toEqual(['summary']);expect(projected.resultChildFields?.summary).toEqual(['netProfit']);
  const data={summary:{netProfit:null,revenue:999999,token:'PRIVATE'}};
  expect(projectCompositeSourceData(compositeReportEnvelope(op,{data},['summary.netProfit'])!,['summary'],projected)).toEqual([{summary:{netProfit:null}}]);
  expect(()=>compositeReportEnvelope(op,{data:{summary:{}}},['summary.netProfit'])).toThrow('chưa trả đủ');
  expect(()=>compositeReportEnvelope(op,{...data,data},['summary.netProfit'])).toThrow();
 });
 it('normalizes composite analysis idempotently across planning and execution replay',()=>{
  const ids=['employee.list','hr.calendar.events.list'],workflows=ids.map(id=>defaultWorkflow(operationById(id)!));
  const first=validateCompositeQueryPlan([{actionId:ids[0],purpose:'Nhân sự',values:{analysis:JSON.stringify({select:['displayName']})},resultFields:['displayName']},{actionId:ids[1],purpose:'Lịch',values:{},resultFields:['title']}],workflows);
  expect(first.ok).toBe(true);if(!first.ok)return;
  const second=validateCompositeQueryPlan(first.queries,workflows);expect(second).toEqual(first);
  expect(first.queries[0].values.analysis).toEqual({select:['displayName']});
 });
 it('retains a deferred output from exact unique evidence without treating it as executed or dropping ambiguous matches',()=>{
  const text='Tổng hợp báo cáo, rồi xem đơn hủy',request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:'Tổng hợp',concept:'Báo cáo',operator:'report',value:null},{id:'u2',kind:'output',quote:'đơn hủy',concept:'Đơn hủy',operator:'none',value:null}]});
  const raw=[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['context.discourse']}];
  expect(bindSemanticRequest(request,raw,['xem đơn hủy']).bindings.get('u2')).toEqual(['remainingRequests.0']);
  expect(()=>bindSemanticRequest(request,raw,['xem đơn hủy','xem lại đơn hủy'])).toThrow();
  const {bindings}=bindSemanticRequest(request,raw,[]),op=operationById('retail.report.summary')!;
  expect(validateSemanticPlan(request,bindings,[{operation:op,workflow:defaultWorkflow(op),values:{}}]).ok).toBe(false);
 });
 it('binds a management report net-profit request to the reviewed nested precomputed measure',()=>{
  const s=capturedRetry('S6-R004');compileSemanticResolutions(s.request,[s.source],s.bindings,s.row.fit.resolutions);
  expect(s.bindings.get('u4')).toEqual(['result.summary.netProfit']);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  s.bindings.set('u4',['result.warnings']);expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);
 });
 it('compiles a reviewed negative enum selector and an exact calendar month without inventing a date',()=>{
  const s=capturedRetry('S1-R058');compileSemanticResolutions(s.request,[s.source],s.bindings,s.row.fit.resolutions);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  s.source.values.period='2026-12';expect(validateSemanticPlan(s.request,s.bindings,[s.source]).ok).toBe(false);
 });
 it('accepts an already validated native enum duplicated in an AND filter, but rejects an extra narrowing of OR',()=>{
  const s=capturedRetry('S8-R046');compileSemanticResolutions(s.request,[s.source],s.bindings,s.row.fit.resolutions);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  const t=capturedRetry('S8-R046');t.source.values.query_status='received';compileSemanticResolutions(t.request,[t.source],t.bindings,t.row.fit.resolutions);
  expect(validateSemanticPlan(t.request,t.bindings,[t.source]).ok).toBe(false);
  const d=capturedRetry('S8-R046');d.source.values.analysis={where:{any:[{field:'status',operator:'eq',value:'in_transit'},{field:'status',operator:'eq',value:'received'}]}};
  const unit=d.request.units.find(u=>u.id==='u4')!;unit.value='received';unit.operator='eq';d.request.conditionLogic={any:['u3','u4']};
  compileSemanticResolutions(d.request,[d.source],d.bindings,[{unitId:'u3',actionId:d.source.operation.id,role:'read_predicate',target:'',predicates:[{field:'status',operator:'eq',value:'in_transit'}]},{unitId:'u4',actionId:d.source.operation.id,role:'read_predicate',target:'',predicates:[{field:'status',operator:'eq',value:'received'}]}]);
  expect(validateSemanticPlan(d.request,d.bindings,[d.source]).ok).toBe(false);
 });
 it('lowers a reviewer enum assertion on the existing analysis leaf without guessing a missing query input',()=>{
  const s=capturedRetry('S8-R064');s.row.fit.resolutions[1].target='analysis.filters.status';
  compileSemanticResolutions(s.request,[s.source],s.bindings,s.row.fit.resolutions);
  expect(validateSemanticPlan(s.request,s.bindings,[s.source])).toEqual({ok:true});
  const native=capturedRetry('S8-R064');compileSemanticResolutions(native.request,[native.source],native.bindings,native.row.fit.resolutions);
  expect(validateSemanticPlan(native.request,native.bindings,[native.source])).toEqual({ok:true});
  const wrong=capturedRetry('S8-R064');wrong.row.fit.resolutions[1].target='values.nonexistent_status';compileSemanticResolutions(wrong.request,[wrong.source],wrong.bindings,wrong.row.fit.resolutions);
  expect(validateSemanticPlan(wrong.request,wrong.bindings,[wrong.source]).ok).toBe(false);
 });
 it('handles case-folded current-state evidence only for reviewed reads, preserving concrete dates and writes',()=>{
  const s=capturedRetry('S6-R011'),unit=s.request.units.find(u=>u.kind==='time')!;
  expect(isSnapshotContext(unit,s.source)).toBe(true);
  expect(isSnapshotContext({...unit,quote:'ngày 26/11/2026',value:'2026-11-26'},s.source)).toBe(false);
  expect(isSnapshotContext(unit,{...s.source,operation:{...s.source.operation,method:'POST',readOnly:false}})).toBe(false);
 });
 it('normalizes declared calendar query boundaries without converting names, codes or clock fields',()=>{
  expect(normalizeAssistantFieldContract({key:'query_from',apiKey:'from',source:'query',label:'Từ ngày',type:'text'}).type).toBe('date');
  for(const field of [{key:'code',apiKey:'code',label:'Từ ngày',source:'query',type:'text'},{key:'from',apiKey:'from',label:'Từ ngày và giờ HH:mm',source:'query',type:'text'}] as const)expect(normalizeAssistantFieldContract(field).type).toBe('text');
 });
 it('keeps the entire original 25-case set in the regression inventory',()=>{
  expect(captured).toHaveLength(25);expect(new Set(captured.map((r:any)=>r.id)).size).toBe(25);
  expect(captured.every((r:any)=>r.meaning&&r.plans.length)).toBe(true);
 });
 it('does not route an explicit worker entity to HR merely because worker tools are unavailable',()=>{
  const r=fixture('S2-R003'),request=parseSemanticRequest(r.text,r.meaning);
  expect(declaredDomainModules(request)).toContain('worker');expect(declaredDomainModules(request)).not.toContain('hr');
 });
 it('allows the captured missing-KPI condition to lower to a declared status without confusing it with an empty cell',()=>{
  const s=prepare('S5-R005');expect(review(s)).toEqual({ok:true});
  const result=analyzeList(s.sources[0].operation.analysis!,[{partnerName:'QA Thiếu',status:'incomplete'},{partnerName:'QA Chưa đặt',status:'not_set'},{partnerName:'QA Đạt',status:'achieved'}],s.sources[0].values.analysis,true);
  expect(result.records.map(r=>r['Đối tác'])).toEqual(['QA Thiếu']);
 });
 it('binds order count and revenue to exact precomputed summary members, not to envelope rows',()=>{
  const s=prepare('S6-R002',p=>{p.meaningBindings.find((b:any)=>b.unitId==='u4').targets=['result.summary.orderCount'];p.meaningBindings.find((b:any)=>b.unitId==='u5').targets=['result.summary.netSales'];});
  expect(review(s)).toEqual({ok:true});
  const wrong=prepare('S6-R002');expect(review(wrong).ok).toBe(false);
 });
 it('lowers a redundant sum of a precomputed P&L measure and preserves date boundaries',()=>{
  const s=prepare('S6-R004');expect(review(s)).toEqual({ok:true});
  expect(s.sources[0].values.analysis).toBeUndefined();expect(s.bindings.get('u3')).toEqual(['result.operatingResult']);
  s.sources[0].values.query_to='2026-12-01';expect(validateSemanticPlan(s.request,s.bindings,s.sources).ok).toBe(false);
 });
 it('uses a reviewed max/descending equivalence without changing the metric',()=>{
  const s=prepare('S5-R004');expect(review(s,[{unitId:'u6',actionId:s.sources[0].operation.id,role:'ordering',target:'analysis.extreme.actualReferrals',predicates:[]}])).toEqual({ok:true});
 });
 it('allows a complete reviewed 100% payment conjunction, excludes 0/0 and retains other boolean branches',()=>{
  const s=prepare('S4-R035');expect(review(s)).toEqual({ok:true});
  const result=analyzeList(s.sources[0].operation.analysis!,[
   {name:'QA Chưa phát sinh',totalCommission:0,unpaidBalance:0},{name:'QA Trả đủ',totalCommission:100,unpaidBalance:0},{name:'QA Còn nợ',totalCommission:100,unpaidBalance:1},
  ],s.sources[0].values.analysis,true);
  expect(result.records.map(r=>r['Đối tác'])).toEqual(['QA Trả đủ']);
  const invalid=prepare('S4-R035');invalid.request.units.find(u=>u.id==='u3')!.value=99;expect(review(invalid).ok).toBe(false);
  const disjunction=prepare('S4-R035');disjunction.sources[0].values.analysis.where={any:disjunction.sources[0].values.analysis.where.all};expect(review(disjunction).ok).toBe(false);
 });
 it('never claims that predicates scattered across OR or NOT are one AND condition',()=>{
  const a:any={field:'totalCommission',operator:'gt',value:0},b:any={field:'unpaidBalance',operator:'lte',value:0};
  expect(hasExactFilterConjunction({all:[a,b]},[a,b])).toBe(true);
  expect(hasExactFilterConjunction({any:[a,b]},[a,b])).toBe(false);
  expect(hasExactFilterConjunction({all:[a,{not:b}]},[a,b])).toBe(false);
 });
 it.each(['S1-R013','S1-R024','S1-R032'])('accepts an independently reviewed intrinsic read condition without dropping requested output: %s',id=>{
  const s=prepare(id),unit=s.request.units.find(u=>u.kind==='condition'&&(s.bindings.get(u.id)||[]).includes('action'))!;
  expect(review(s,[{unitId:unit.id,actionId:s.sources[0].operation.id,role:'builtin_condition',target:'action',predicates:[]}])).toEqual({ok:true});
 });
 it('normalizes an unambiguous declared child output and never guesses private or ambiguous children',()=>{
  const s=prepare('S1-R058');expect(s.bindings.get('u3')).toEqual(['result.rows.employeeName']);
  const op=operationById('hr.leave.applications.list')!,bindings=new Map([['u1',['result.employeeName']],['u2',['result.uid']]]);
  normalizeSemanticInputBindings(bindings,[{operation:op,workflow:defaultWorkflow(op),values:{}}]);
  expect(bindings.get('u1')).toEqual(['result.employeeName']);expect(bindings.get('u2')).toEqual(['result.uid']);
 });
 it('retains available serials as a real status predicate',()=>{
  const s=prepare('S8-R064');expect(review(s)).toEqual({ok:true});
 });
 it('keeps a genuinely missing period in collection rather than assuming a business date',()=>{
  const op=operationById('inventory.receipt.list')!;expect(op.unboundedTimeRead).toBe(true);
  const s=prepare('S8-R032');expect(review(s)).toEqual({ok:true});
  s.sources[0].values.query_from='2026-01-01';expect(validateSemanticPlan(s.request,s.bindings,s.sources).ok).toBe(false);
 });
 it('does not classify a planned interview existence check as an unsupported condition',()=>{
  const s=prepare('S1-R084');expect(review(s)).toEqual({ok:true});
 });
 it('types progression eligibility as boolean and retains reasons, not as an unconstrained scalar',()=>{
  const s=prepare('S3-R115');expect(s.sources[0].operation.analysis!.fields.eligible.type).toBe('boolean');
  const unit=s.request.units.find(u=>u.kind==='condition')!;
  expect(review(s,[{unitId:unit.id,actionId:s.sources[0].operation.id,role:'read_predicate',target:'',predicates:[{field:'eligible',operator:'ne',value:true}]}])).toEqual({ok:true});
 });
});
