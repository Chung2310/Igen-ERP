import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const provider=vi.hoisted(()=>vi.fn());
vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
// These tests isolate meaning compilation. The real global broker and rejection /
// recovery path are exercised in capability-routing.test.ts and conversation tests.
const broker=vi.hoisted(()=>({discover:vi.fn(),fit:vi.fn()}));
vi.mock('./capability-routing',async original=>({...await original<typeof import('./capability-routing')>(),discoverCapabilities:broker.discover,verifyActionFit:broker.fit}));
import {ASSISTANT_OPERATIONS,defaultWorkflow,operationById} from './catalog';
import {bindSemanticRequest,parseSemanticRequest,validateSemanticPlan,understandSemanticRequest,semanticContextEnabled,attachSemanticProof,revalidateSemanticProof,buildDialogueState,reviewAbstractReadPredicates,semanticModelRequest,normalizeSemanticReadProjection,type MeaningUnit,type SemanticRequest} from './semantic-request';
import {AssistantPlanningError} from './interpretation-error';
import {newInterpretationBudget,interpretationPromptBytes,INTERPRETATION_LIMITS} from './interpretation-budget';
import {interpretRequest} from './semantic-interpreter';
import {collectValues,isAssistantFieldApplicable} from './policy';
import {formatAssistantResultTable} from '../../src/shared/assistant-result-table';
import {separateAssistantGoalSteps} from './goal-plan';

const unit=(id:string,kind:MeaningUnit['kind'],quote:string,operator:MeaningUnit['operator']='none',value:MeaningUnit['value']=null,dimension:MeaningUnit['dimension']='none'):MeaningUnit=>({id,kind,quote,concept:quote,operator,value,dimension});
const frame=(text:string,units:MeaningUnit[])=>parseSemanticRequest(text,{version:1,units});
const source=(id:string,values:Record<string,unknown>={})=>({workflow:defaultWorkflow(operationById(id)!),operation:operationById(id)!,values});
const bind=(request:SemanticRequest,targets:string[][],remaining:string[]=[])=>bindSemanticRequest(request,request.units.map((u,i)=>({unitId:u.id,targets:targets[i]})),remaining);
const payout=source('partner.payouts.analysis');
afterEach(()=>{vi.unstubAllEnvs();provider.mockReset();});
beforeEach(()=>{
  broker.discover.mockReset().mockImplementation(async(_request,workflows)=>({workflows:workflows.slice(0,12)}));
  broker.fit.mockReset().mockImplementation(async(_request,sources)=>({approvedActionIds:sources.map((s:any)=>s.operation.id)}));
});

describe('catalog-independent semantic request and compiled plan',()=>{
 it('keeps original requested measures when the current turn answers a scoped clarification',async()=>{
  const original='Báo cáo tổng giá trị và số lượng tồn',answer='Tính toàn bộ hàng';
  provider.mockResolvedValueOnce({text:JSON.stringify({version:1,units:[unit('u1','goal','Báo cáo','report'),unit('u2','aggregate','tổng giá trị','sum'),unit('u3','aggregate','số lượng tồn','sum'),unit('u4','entity','toàn bộ hàng')],dialogue:{act:'continue',evidence:answer}})});
  const request=await understandSemanticRequest(answer,{clarification:{text:original,question:'Nhóm hàng nào?'}},[],'',newInterpretationBudget());
  expect(request.text).toBe(original+'\n'+answer);expect(provider).toHaveBeenCalledTimes(1);
  const s=source('inventory.balance.list',{analysis:{aggregates:[{operation:'sum',field:'stockValue'},{operation:'sum',field:'quantity'}]}});
  expect(validateSemanticPlan(request,bind(request,[['action'],['analysis.aggregate.stockValue'],['analysis.aggregate.quantity'],['action']]).bindings,[s])).toEqual({ok:true});
 });
 it('does not inherit an earlier goal when the user starts a new request',async()=>{
  provider.mockResolvedValueOnce({text:JSON.stringify({version:1,units:[unit('u1','goal','Xem học viên','lookup')],dialogue:{act:'request',evidence:'Xem học viên'}})});
  const request=await understandSemanticRequest('Xem học viên',{clarification:{text:'Tính tổng tiền tồn kho',question:'Kho nào?'}},[],'',newInterpretationBudget());
  expect(request.text).toBe('Xem học viên');expect(request.units.some(u=>u.kind==='aggregate')).toBe(false);
 });
 it('accepts a canonical public enum label without a second model opinion, preserving negation and code choice',()=>{
  const text='Thiết bị đang bảo trì',request=frame(text,[unit('u1','condition','đang bảo trì','eq','đang bảo trì')]);
  const s=source('student.resource.list',{query_status:'MAINTENANCE'}),{bindings}=bind(request,[['values.query_status']]);
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  expect(validateSemanticPlan(request,bindings,[source(s.operation.id,{query_status:'AVAILABLE'})])).toMatchObject({ok:false});
  const negated=structuredClone(request);negated.units[0].operator='ne';expect(validateSemanticPlan(negated,bindings,[s])).toMatchObject({ok:false});
 });
 it('binds only a workbook format quote to the shared read exporter, retaining data conditions',()=>{
  const text='Xuất danh sách đối tác ra file Excel',r=frame(text,[unit('u1','goal','Xuất','export'),unit('u2','output','file Excel')]),s=source('partner.analysis');
  const {bindings}=bind(r,[['action'],['action']]);normalizeSemanticReadProjection(r,bindings,[s]);
  expect(bindings.get('u2')).toEqual(['context.output_format']);
  expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
  r.units[1].value='Excel';expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
  r.units[1].quote='danh sách đối tác ra file Excel';
  expect(validateSemanticPlan(r,bindings,[s])).toMatchObject({ok:false});
  const noFile=frame('Xuất danh sách đối tác',[unit('u1','goal','Xuất','export')]);
  expect(validateSemanticPlan(noFile,bind(noFile,[['action']]).bindings,[s])).toMatchObject({ok:false});
 });
  it.each(['Bên mình đã chi tổng cộng bao nhiêu cho bên tuyển sinh?', 'Cộng lại các khoản đã chuyển cho đối tác tuyển sinh giúp mình', 'Cho mình xem tổng tiền thực trả đối tác tuyển sinh nhé'])('supports different expressions without action-phrase aliases: %s',text=>{
    const f=frame(text,[unit('u1','aggregate',text,'sum')]),b=bind(f,[['analysis.aggregate.amount']]);
    expect(validateSemanticPlan(f,b.bindings,[{...payout,values:{analysis:{aggregate:{operation:'sum',field:'amount'}}}}])).toEqual({ok:true});
    expect(validateSemanticPlan(f,b.bindings,[{...payout,values:{analysis:{aggregate:{operation:'avg',field:'amount'}}}}])).toMatchObject({ok:false});
  });
  it('validates the requested date extremum and visible recipient columns',()=>{
    const f=frame('Gần nhất trả cho ai và ngày nào',[unit('u1','ordering','Gần nhất','max',null,'temporal'),unit('u2','goal','trả','report'),unit('u3','output','cho ai'),unit('u4','output','ngày nào')]);
    const b=bind(f,[['analysis.extreme.paidOn'],['action'],['result.partnerName'],['result.paidOn']]);
    const values={analysis:{extreme:{field:'paidOn',direction:'max'},select:['partnerName','paidOn']}};
    expect(validateSemanticPlan(f,b.bindings,[{...payout,values}])).toEqual({ok:true});
    expect(validateSemanticPlan(f,b.bindings,[{...payout,values:{analysis:{...values.analysis,select:['partnerName']}}}])).toMatchObject({ok:false});
    expect(validateSemanticPlan(f,b.bindings,[{...payout,values:{analysis:{...values.analysis,extreme:{field:'amount',direction:'max'}}}}])).toMatchObject({ok:false});
    expect(validateSemanticPlan(f,bind(f,[['analysis.extreme.amount'],['action'],['result.partnerName'],['result.paidOn']]).bindings,[{...payout,values:{analysis:{...values.analysis,extreme:{field:'amount',direction:'max'}}}}])).toMatchObject({ok:false});
  });
  it('requires both dates in order and does not permit a hidden period or filter',()=>{
    const f=frame('Tổng chi tháng này',[unit('u1','aggregate','Tổng chi','sum'),unit('u2','time','tháng này','range',{from:'2026-11-01',to:'2026-11-30'})]);
    const b=bind(f,[['analysis.aggregate.amount'],['values.from','values.to']]);
    const values={from:'2026-11-01',to:'2026-11-30',analysis:{aggregate:{operation:'sum',field:'amount'}}};
    expect(validateSemanticPlan(f,b.bindings,[{...payout,values}])).toEqual({ok:true});
    for(const patch of [{to:undefined},{from:values.to,to:values.from},{search:'unasked'}, {analysis:{aggregate:{operation:'sum',field:'amount'},filters:[{field:'amount',operator:'gt',value:100}]}}])expect(validateSemanticPlan(f,b.bindings,[{...payout,values:{...values,...patch}}])).toMatchObject({ok:false});
  });
  it('accepts repeated source quotes and conversational filler without requiring literal coverage of every word',()=>{
    expect(frame('Thêm An rồi An',[unit('u1','reference','An','eq','An')]).units[0].value).toBe('An');
    expect(frame('Này bạn ơi, xem học viên giúp mình cái nha',[unit('u1','goal','xem học viên','lookup')]).units).toHaveLength(1);
    expect(frame('À ừm, mình nói lại nhé',[unit('u1','framing','À ừm')]).units[0].kind).toBe('framing');
  });
  it('keeps source evidence and typed operator validation even with flexible speech',()=>{
    expect(frame('Thêm tên An'.normalize('NFD'),[unit('u1','goal','Thêm tên An','create')]).text).toBe('Thêm tên An');
    expect(()=>frame('Thêm An',[unit('u1','goal','Thêm Bình','create')])).toThrow();
    expect(frame('chưa có hợp đồng',[unit('u1','condition','chưa có hợp đồng')]).units[0]).toMatchObject({kind:'condition',operator:'none',value:null});
    expect(()=>frame('chưa có hợp đồng',[unit('u1','condition','chưa có hợp đồng','none','invented')])).toThrow();
    expect(()=>frame('này bạn',[unit('u1','framing','này bạn','eq','invented')])).toThrow();
  });
  it('represents negative conditions independently of the grammatical question ending',()=>{
    const f=frame('Có ai không nghỉ phép không?',[unit('u1','goal','Có ai','lookup'),unit('u2','condition','không nghỉ phép','ne','nghỉ phép')]);
    expect(f.units[1].operator).toBe('ne');
    expect(validateSemanticPlan(f,bind(f,[['action'],['action']]).bindings,[source('student.list')])).toMatchObject({ok:false});
  });
  it('preserves a date-like name without treating it as a reporting period',()=>{
    const f=frame('Thêm tên "tháng này 2026"',[unit('u1','goal','Thêm tên','create'),unit('u2','input','"tháng này 2026"','eq','tháng này 2026')]);
    expect(f.units[1].kind).toBe('input');
  });
  it('compares enum meaning and every individual filter, including extra filters on the same field',()=>{
    const f=frame('Đối tác tạm dừng',[unit('u1','goal','Đối tác','lookup'),unit('u2','condition','tạm dừng','eq','Tạm dừng')]);
    const b=bind(f,[['action'],['analysis.filters.isActive']]),s=source('partner.analysis',{analysis:{filters:[{field:'isActive',operator:'eq',value:'inactive'}]}});
    expect(validateSemanticPlan(f,b.bindings,[s])).toEqual({ok:true});
    expect(validateSemanticPlan(f,b.bindings,[{...s,values:{analysis:{filters:[{field:'isActive',operator:'eq',value:'inactive'},{field:'isActive',operator:'ne',value:'active'}]}}}])).toMatchObject({ok:false});
  });
  it('preserves case-sensitive literal filters instead of returning an incorrect empty result',()=>{
    const f=frame('Tìm tên QA Ctx',[unit('u1','goal','Tìm','lookup'),unit('u2','condition','tên QA Ctx','eq','QA Ctx')]),b=bind(f,[['action'],['analysis.filters.name']]);
    expect(validateSemanticPlan(f,b.bindings,[source('partner.analysis',{analysis:{filters:[{field:'name',operator:'eq',value:'qa ctx'}]}})])).toMatchObject({ok:false});
  });
  const creates=[...new Set(ASSISTANT_OPERATIONS.map(op=>op.module))].flatMap(module=>{
    const op=ASSISTANT_OPERATIONS.find(op=>op.module===module&&op.assistantMetadata?.intent==='create'&&op.fields.some(f=>f.type==='text'&&!f.reference&&!f.key.toLowerCase().includes('id')));
    return op?[op]:[];
  });
  it.each(creates)('uses the same semantics and missing-input policy in module $module',op=>{
    const fields=op.fields.filter(f=>f.type==='text'&&!f.reference&&!f.key.toLowerCase().includes('id')&&isAssistantFieldApplicable(defaultWorkflow(op),f));
    const field=fields.find(f=>/^(name|fullName|title)$/i.test(f.apiKey||f.key))||fields[0];
    const value=field.options?.[0]||'QA Ctx';
    const f=frame(`Thêm hồ sơ ${value}`,[unit('u1','goal','Thêm hồ sơ','create'),unit('u2','input',value,'eq',value)]),b=bind(f,[['action'],[`values.${field.key}`]]);
    const workflow=defaultWorkflow(op),values={[field.key]:value};
    expect(validateSemanticPlan(f,b.bindings,[{workflow,operation:op,values}])).toEqual({ok:true});
    const collected=collectValues(workflow,values);
    expect(collected.values[field.key],JSON.stringify({field,values,collected})).toBe(value);
    expect(workflow.requireConfirmation).toBe(defaultWorkflow(op).requireConfirmation);
  });
  it('cannot compile a read request into a write, skip an input or invent an input',()=>{
    const f=frame('Xem hồ sơ QA Ctx',[unit('u1','goal','Xem hồ sơ','lookup'),unit('u2','reference','QA Ctx','eq','QA Ctx')]),b=bind(f,[['action'],['values.fullName']]);
    expect(validateSemanticPlan(f,b.bindings,[source('employee.create',{fullName:'QA Ctx'})])).toMatchObject({ok:false});
    expect(()=>bindSemanticRequest(f,[{unitId:'u1',targets:['action']}],[])).toThrow();
    const invented=frame('Thêm hồ sơ',[unit('u1','goal','Thêm hồ sơ','create'),unit('u2','input','Thêm hồ sơ','eq','QA Invented')]);
    expect(validateSemanticPlan(invented,bind(invented,[['action'],['values.fullName']]).bindings,[source('worker.create',{fullName:'QA Invented'})])).toMatchObject({ok:false});
  });
  it('never compiles a write precondition as a value to write',()=>{
    const s=source('worker.update'),ref=s.workflow.fields.find(f=>f.reference)!;
    const f=frame('Sửa QA Ctx nếu đang hoạt động',[unit('u1','goal','Sửa','update'),unit('u2','reference','QA Ctx','eq','QA Ctx'),unit('u3','condition','nếu đang hoạt động','eq','active')]);
    const b=bind(f,[['action'],[`values.${ref.key}`],['values.status']]);
    expect(validateSemanticPlan(f,b.bindings,[{...s,values:{[ref.key]:'QA Ctx',status:'active'}}])).toMatchObject({ok:false});
  });
  it('binds structured edits by declared leaf paths and rejects extra JSON changes',()=>{
    const s=source('api.patch.2971d5a8a97f8be8',{path_policyId:'QA Policy',official:JSON.stringify({maxMonths:2})});
    const ref=s.workflow.fields.find(f=>f.reference&&f.source==='path')!;
    s.values={[ref.key]:'QA Policy',official:JSON.stringify({maxMonths:2})};
    const f=frame('Sửa QA Policy thành 2 mốc',[unit('u1','goal','Sửa','update'),unit('u2','reference','QA Policy','eq','QA Policy'),unit('u3','input','thành 2 mốc','eq',2)]);
    const b=bind(f,[['action'],[`values.${ref.key}`],['values.official.maxMonths']]);
    expect(validateSemanticPlan(f,b.bindings,[s])).toEqual({ok:true});
    expect(validateSemanticPlan(f,b.bindings,[{...s,values:{...s.values,official:JSON.stringify({maxMonths:2,enabled:false})}}])).toMatchObject({ok:false});
    expect(validateSemanticPlan(f,bind(f,[['action'],[`values.${ref.key}`],['values.official.__proto__.maxMonths']]).bindings,[s])).toMatchObject({ok:false});
  });
  it('keeps unresolved references absent for the server form, rather than selecting a record',()=>{
    const s=source('employee.update'),field=s.workflow.fields.find(f=>f.reference&&f.reference!=='branch.list')!;
    const f=frame('Đổi cho người đó',[unit('u1','goal','Đổi','update'),unit('u2','reference','cho người đó','eq')]),b=bind(f,[['action'],[`values.${field.key}`]]);
    expect(validateSemanticPlan(f,b.bindings,[s])).toEqual({ok:true});
    expect(collectValues(s.workflow,{}).missing).toContain(field.label);
    expect(validateSemanticPlan(f,b.bindings,[{...s,values:{[field.key]:'64b000000000000000000001'}}])).toMatchObject({ok:false});
  });
  it('retains future actions with original quotes while validating the first step separately',()=>{
    const text='Xem đối tác rồi thêm QA Ctx',remaining=['thêm QA Ctx'];
    const f=frame(text,[unit('u1','goal','Xem đối tác','lookup'),unit('u2','framing','rồi'),unit('u3','goal','thêm','create'),unit('u4','input','QA Ctx','eq','QA Ctx')]);
    const b=bind(f,[['action'],['context.discourse'],['remainingRequests.0'],['remainingRequests.0']],remaining);
    expect(separateAssistantGoalSteps(text,b.coverage,remaining)).toMatchObject({ok:true,currentText:'Xem đối tác'});
    expect(validateSemanticPlan(f,b.bindings,[source('partner.list')],remaining)).toEqual({ok:true});
  });
  it('requires the declared relationship predicate and both authorized sources',()=>{
    const f=frame('Lao động chưa có hợp đồng',[unit('u1','goal','Lao động','lookup'),unit('u2','condition','chưa có hợp đồng','not_exists')]);
    const b=bind(f,[['query:worker.list:action'],['query:worker.list:relation']]);
    const left={...source('worker.list'),relation:'workers-without-contracts'},right=source('worker.labor.contract.list');
    expect(validateSemanticPlan(f,b.bindings,[left,right])).toEqual({ok:true});
    expect(validateSemanticPlan(f,b.bindings,[left])).toMatchObject({ok:false});
    expect(validateSemanticPlan({...f,units:[f.units[0],{...f.units[1],operator:'exists'}]},b.bindings,[left,right])).toMatchObject({ok:false});
  });
});

describe('interpreter meaning-contract integration with capability selection isolated',()=>{
  const breakdowns=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-status-bindings.json',import.meta.url),'utf8'));
  it.each(breakdowns)('accepts equivalent real AI breakdown bindings without changing the requested calculation: $text',async fixture=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const {compileSemanticResolutions}=await import('./semantic-compilation');
    broker.fit.mockImplementation(async(request,sources,_authorized,_budget,_remaining,bindings)=>{
      compileSemanticResolutions(request,sources,bindings,fixture.resolutions);
      return {approvedActionIds:sources.map((s:any)=>s.operation.id)};
    });
    provider.mockResolvedValueOnce({text:JSON.stringify(fixture.meaning)})
      .mockResolvedValueOnce({text:JSON.stringify(fixture.plan)})
      .mockResolvedValueOnce({text:JSON.stringify({equivalent:true,canRepresent:true,coveredUnits:['u8'],builtinUnits:[],scopeUnits:[],constraints:[],reason:'Đếm theo trạng thái',question:''})});
    const result=await interpretRequest(fixture.text,[defaultWorkflow(operationById('partner.analysis')!)],null,[]);
    expect(result.actionId).toBe('partner.analysis');
    expect(JSON.parse(String(result.values.analysis))).toMatchObject({groupBy:'isActive',aggregate:{operation:'count'}});
    expect(provider.mock.calls.length).toBeLessThanOrEqual(3);
  });
  it.each(['unknown-field','derived-count-column'])('repairs invalid grouped analysis internally once: %s',async defect=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Đếm đối tác theo trạng thái',op=operationById('partner.analysis')!;
    const f=frame(text,[unit('u1','aggregate','Đếm đối tác','count'),unit('u2','group','theo trạng thái')]);
    const base={intentType:'workflow',actionId:op.id,actionIntent:'report',meaningBindings:[{unitId:'u1',targets:['analysis.aggregate.count']},{unitId:'u2',targets:['analysis.groupBy.isActive']}]};
    const analysis={groupBy:'isActive',aggregate:{operation:'count'}};
    const bad=defect==='unknown-field'?{...analysis,groupBy:'status'}:{...analysis,select:['isActive','count']};
    provider.mockResolvedValueOnce({text:JSON.stringify(f)})
      .mockResolvedValueOnce({text:JSON.stringify({...base,values:{analysis:bad}})})
      .mockResolvedValueOnce({text:JSON.stringify({...base,values:{analysis}})});
    const result=await interpretRequest(text,[defaultWorkflow(op),defaultWorkflow(operationById('partner.payouts.analysis')!),defaultWorkflow(operationById('student.list')!)],null,[]);
    expect(result.actionId).toBe(op.id);
    expect(JSON.parse(String(result.values.analysis))).toEqual(analysis);
    expect(provider).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(provider.mock.calls[2][0])).toContain('ANALYSIS_PLAN_INVALID');
    expect(provider.mock.calls[2][0].responseSchema.properties.actionId.enum).toEqual([op.id,null]);
    expect(provider.mock.calls.filter(([input])=>input.responseSchema?.properties.units)).toHaveLength(1);
  });
  it('stops repeated invalid analysis as a planning error without leaking a false permission diagnosis',async()=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Đếm đối tác',op=operationById('partner.analysis')!;
    provider.mockResolvedValueOnce({text:JSON.stringify(frame(text,[unit('u1','aggregate',text,'count')]))})
      .mockResolvedValue({text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'report',values:{analysis:{aggregate:{operation:'count',field:'password'}}},meaningBindings:[{unitId:'u1',targets:['analysis.aggregate.count']}]})});
    await expect(interpretRequest(text,[defaultWorkflow(op)],null,[])).rejects.toBeInstanceOf(AssistantPlanningError);
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it.each(['actionIntent','actionId','workflow.actionId','operation.actionId','action:student.list','query:student.list:actionId'])('normalizes an equivalent action binding instead of asking what a clear list request means: %s',async target=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Đưa ra danh sách học viên',op=operationById('student.list')!;
    const f=frame(text,[unit('u1','goal',text,'lookup')]);
    provider.mockResolvedValueOnce({text:JSON.stringify(f)}).mockResolvedValueOnce({text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{},meaningBindings:[{unitId:'u1',targets:[target,'context.module']}]})});
    const result=await interpretRequest(text,[defaultWorkflow(op)],null,[]);
    expect(result.actionId,JSON.stringify(result)).toBe(op.id);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('repairs the plan once using the original cached meaning and the same routed catalog',async()=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Đưa ra danh sách học viên',op=operationById('student.list')!,f=frame(text,[unit('u1','goal',text,'lookup')]);
    const plan={intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{}};
    provider.mockResolvedValueOnce({text:JSON.stringify(f)})
      .mockResolvedValueOnce({text:JSON.stringify({...plan,meaningBindings:[{unitId:'u1',targets:['result.fullName']}]})})
      .mockResolvedValueOnce({text:JSON.stringify({...plan,meaningBindings:[{unitId:'u1',targets:['action']}]})});
    const result=await interpretRequest(text,[defaultWorkflow(op)],null,[]);
    expect(result.actionId).toBe(op.id);expect(provider).toHaveBeenCalledTimes(3);
    expect(provider.mock.calls.filter(([input])=>input.responseSchema?.properties.units)).toHaveLength(1);
    expect(JSON.stringify(provider.mock.calls[2][0])).toContain('SỬA KẾ HOẠCH NỘI BỘ DUY NHẤT');
  });
  it('revalidates opaque semantic proof across the service boundary and rejects forged or changed plans',()=>{
    const f=frame('Tổng chi',[unit('u1','aggregate','Tổng chi','sum')]),b=bind(f,[['analysis.aggregate.amount']]);
    const result=attachSemanticProof({actionId:payout.operation.id},f,b.bindings);
    expect(revalidateSemanticProof(result,[{...payout,values:{analysis:{aggregate:{operation:'sum',field:'amount'}}}}])).toEqual({ok:true});
    expect(revalidateSemanticProof(result,[{...payout,values:{analysis:{aggregate:{operation:'avg',field:'amount'}}}}])).toMatchObject({ok:false});
    expect(revalidateSemanticProof(JSON.parse(JSON.stringify(result)),[payout])).toBeUndefined();
    expect(revalidateSemanticProof({semanticProof:true},[payout])).toBeUndefined();
  });
  const captured=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-semantic-context.json',import.meta.url),'utf8'));
  it.each(captured)('replays the real AI semantic frame and plan without provider calls: $id',async fixture=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    if(fixture.kind!=='plan')broker.discover.mockResolvedValue({clarification:'Chưa có thao tác phù hợp trong Quản lý lao động.',unavailable:'worker'});
    provider.mockImplementation(async input=>{
      const props=input.responseSchema?.properties||{};
      const output=props.units?fixture.meaning:props.modules&&fixture.kind==='plan'?{modules:[operationById(fixture.output.actionId)!.module]}:props.featureKeys?fixture.featureSelection||{featureKeys:props.featureKeys.items.enum,ambiguous:false,clarification:''}:fixture.output;
      return {text:JSON.stringify(output)};
    });
    const workflows=fixture.kind==='plan'?[defaultWorkflow(operationById(fixture.output.actionId)!)]:ASSISTANT_OPERATIONS.filter(op=>['hr','labor-partner'].includes(op.module)&&op.assistantMetadata?.intent==='create').map(defaultWorkflow);
    const result=await interpretRequest(fixture.text,workflows,null,fixture.messages||[]);
    if(fixture.kind==='plan')expect(result.actionId,JSON.stringify(result)).toBe(fixture.output.actionId);
    else expect(result).toMatchObject({actionId:null,clarificationReason:'unavailable_capability'});
    expect(provider.mock.calls.filter(([input])=>input.responseSchema?.properties.units)).toHaveLength(1);
    expect(provider.mock.calls.length).toBeLessThanOrEqual(6);
  });
  it.each([['hr','labor-partner'],['labor-partner']])('recognizes a known but unavailable module instead of routing to a similar available module: %j',async(...modules)=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Lập hồ sơ lao động QA Ctx',f=frame(text,[unit('u1','goal','Lập hồ sơ lao động','create'),unit('u2','input','QA Ctx','eq','QA Ctx'),unit('u3','entity','hồ sơ lao động')]);
    provider.mockResolvedValueOnce({text:JSON.stringify(f)});
    broker.discover.mockResolvedValue({clarification:'Chưa có thao tác phù hợp trong Quản lý lao động.',unavailable:'worker'});
    const workflows=ASSISTANT_OPERATIONS.filter(op=>modules.includes(op.module)&&op.assistantMetadata?.intent==='create').map(defaultWorkflow);
    const result=await interpretRequest(text,workflows,null,[]);
    expect(result).toMatchObject({actionId:null,intentType:'ambiguous',clarificationReason:'unavailable_capability'});
    expect(provider).toHaveBeenCalledTimes(1);
    expect(broker.discover).toHaveBeenCalledOnce();
    expect(broker.discover.mock.calls[0][0].text).toBe(text);
  });
  it('keeps production opt-in and enables local by default',()=>{
    vi.stubEnv('NODE_ENV','production');expect(semanticContextEnabled()).toBe(false);
    vi.stubEnv('NODE_ENV','development');expect(semanticContextEnabled()).toBe(true);
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','false');expect(semanticContextEnabled()).toBe(false);
  });
  it('extracts before tool planning and uses semantic requirements rather than legacy word coverage',async()=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Cộng lại các khoản thực trả giúp mình',f=frame(text,[unit('u1','aggregate',text,'sum')]);
    provider.mockResolvedValueOnce({text:JSON.stringify(f)}).mockResolvedValueOnce({text:JSON.stringify({intentType:'workflow',actionId:payout.operation.id,actionIntent:'report',values:{analysis:{aggregate:{operation:'sum',field:'amount'}}},meaningBindings:[{unitId:'u1',targets:['analysis.aggregate.amount']}]})});
    const result=await interpretRequest(text,[payout.workflow],null,[]);
    expect(result.actionId,JSON.stringify(result)).toBe(payout.operation.id);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(provider.mock.calls[0][0])).not.toContain('partner.payouts.analysis');
    expect(JSON.stringify(provider.mock.calls[1][0])).toContain('HỢP ĐỒNG Ý NGHĨA');
    expect(result).not.toHaveProperty('meaningBindings');
  });
  it('never falls back to lexical validation if semantic bindings are absent or wrong',async()=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='Tổng chi',f=frame(text,[unit('u1','aggregate',text,'sum')]);
    provider.mockResolvedValueOnce({text:JSON.stringify(f)}).mockResolvedValue({text:JSON.stringify({intentType:'workflow',actionId:payout.operation.id,actionIntent:'report',values:{analysis:{aggregate:{operation:'avg',field:'amount'}}},requestCoverage:[{evidence:text,requirement:'Sum',mappedTo:['action']}]})});
    await expect(interpretRequest(text,[payout.workflow],null,[])).rejects.toBeInstanceOf(AssistantPlanningError);
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it('caches extraction only within the current request budget',async()=>{
    const text='Xem đối tác',f=frame(text,[unit('u1','goal',text,'lookup')]),budget=newInterpretationBudget();
    provider.mockResolvedValue({text:JSON.stringify(f)});
    await understandSemanticRequest(text,null,[],'',budget);await understandSemanticRequest(text,null,[],'',budget);
    expect(provider).toHaveBeenCalledOnce();
    await understandSemanticRequest(text,null,[],'',newInterpretationBudget());expect(provider).toHaveBeenCalledTimes(2);
  });
  it('uses only a unique public result for a contextual reference and leaves lists for selection',async()=>{
    const text='Đổi cho người đó',f=frame(text,[unit('u1','goal','Đổi','update'),unit('u2','reference','cho người đó','eq','QA Ctx')]);
    provider.mockResolvedValue({text:JSON.stringify(f)});
    const single=await understandSemanticRequest(text,null,[{role:'assistant',content:formatAssistantResultTable('Kết quả',[{Tên:'QA Ctx'}])}],'',newInterpretationBudget());
    expect(single.units[1].value).toBe('QA Ctx');
    const multiple=await understandSemanticRequest(text,null,[{role:'assistant',content:formatAssistantResultTable('Kết quả',[{Tên:'QA Ctx'},{Tên:'QA Other'}])}],'',newInterpretationBudget());
    expect(multiple.units[1].value).toBe(null);
  });
  it('retains an explicitly named record when the user rephrases after a planning failure, without picking from multiple records',async()=>{
    const text='Đưa danh sách học viên của người đó',f=frame(text,[unit('u1','goal','Đưa danh sách học viên','lookup'),unit('u2','reference','của người đó','eq','QA Partner')]);
    provider.mockResolvedValue({text:JSON.stringify(f)});
    const history=(request:string)=>[{role:'user',content:request},{role:'assistant',content:new AssistantPlanningError().message}];
    const result=await understandSemanticRequest(text,null,history('Xem học viên do đối tác QA Partner giới thiệu'),'',newInterpretationBudget());
    expect(result.units[1].value).toBe('QA Partner');
    const ambiguous=await understandSemanticRequest(text,null,history('Xem đối tác QA Partner và QA Other'),'',newInterpretationBudget());
    expect(ambiguous.units[1].value).toBeNull();
    const invented=await understandSemanticRequest(text,null,history('Xem đối tác QA Different'),'',newInterpretationBudget());
    expect(invented.units[1].value).toBeNull();
  });
  it('keeps the named parent in a follow-up read of multiple child rows, without selecting a child or authorizing a write',async()=>{
    const text='Xem học viên của đối tác vừa hỏi',f=frame(text,[unit('u1','goal','Xem học viên','lookup'),unit('u2','reference','của đối tác vừa hỏi','eq','QA Partner')]);
    const history=[{role:'user',content:'Xem học viên do đối tác QA Partner giới thiệu'},{role:'assistant',content:formatAssistantResultTable('Kết quả',[{'Đối tác':'QA Partner','Học viên':'QA A'},{'Đối tác':'QA Partner','Học viên':'QA B'}])}];
    provider.mockResolvedValue({text:JSON.stringify(f)});
    expect((await understandSemanticRequest(text,null,history,'',newInterpretationBudget())).units[1].value).toBe('QA Partner');
    const edit='Sửa thông tin của đối tác vừa hỏi',editFrame=frame(edit,[unit('u1','goal','Sửa thông tin','update'),unit('u2','reference','của đối tác vừa hỏi','eq','QA Partner')]);
    provider.mockResolvedValue({text:JSON.stringify(editFrame)});
    expect((await understandSemanticRequest(edit,null,history,'',newInterpretationBudget())).units[1].value).toBeNull();
  });
});


describe('shared dialogue understanding',()=>{
  const text='Tạo tên QA Cũ, à nhầm QA Mới';
  const correction=()=>parseSemanticRequest(text,{version:1,dialogue:{act:'correct',evidence:'à nhầm'},units:[unit('u1','goal','Tạo','create'),{...unit('u2','input','QA Cũ','eq','QA Cũ'),supersededBy:'u3'},unit('u3','input','QA Mới','eq','QA Mới')]});
  it('uses the final corrected value, rejecting both the old payload and attempts to discard a condition',()=>{
    const op=operationById('worker.create')!,workflow=defaultWorkflow(op),request=correction();
    const binding=bind(request,[['action'],['context.superseded'],['values.fullName']]).bindings;
    expect(validateSemanticPlan(request,binding,[{operation:op,workflow,values:{fullName:'QA Mới'}}])).toEqual({ok:true});
    expect(validateSemanticPlan(request,binding,[{operation:op,workflow,values:{fullName:'QA Cũ'}}])).toMatchObject({ok:false});
    const invalid={version:1,dialogue:{act:'correct',evidence:'à nhầm'},units:[{...request.units[1],kind:'condition'},request.units[2]]};
    expect(()=>parseSemanticRequest(text,invalid)).toThrow();
  });
  it('builds explicit public conversation state without credentials or resolved identifiers',()=>{
    const context=buildDialogueState({actionId:'worker.create',values:{fullName:'QA Tên',password:'secret',token:'secret',path_id:'64b000000000000000000001'},paused:{actionId:'partner.list',values:{name:'QA Partner'}}},[]);
    expect(context.waiting).toEqual({actionId:'worker.create',provided:{fullName:'QA Tên'}});
    expect(context.paused?.provided).toEqual({name:'QA Partner'});
    expect(JSON.stringify(context)).not.toContain('secret');
  });
  it.each(['worker.create','department.create','student.create'])('corrects the same pending action across modules without routing to a DB update: %s',async id=>{
    const op=operationById(id);if(!op)throw Error('Missing fixture operation '+id);
    const workflow=defaultWorkflow(op),field=workflow.fields.find(f=>/^(name|fullName|title)$/.test(f.apiKey||f.key))!;
    expect(field).toBeDefined();vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    const text='À nhầm, QA Mới mới đúng';
    provider.mockResolvedValueOnce({text:JSON.stringify({version:1,dialogue:{act:'correct',evidence:'À nhầm'},units:[unit('u1','input','QA Mới','eq','QA Mới')]})})
      .mockResolvedValueOnce({text:JSON.stringify({intentType:'workflow',actionId:id,actionIntent:'create',newRequest:true,values:{[field.key]:'QA Mới'},meaningBindings:[{unitId:'u1',targets:[`values.${field.key}`]}]})});
    const result=await interpretRequest(text,[workflow],{actionId:id,values:{[field.key]:'QA Cũ'}},[]);
    expect(result).toMatchObject({actionId:id,newRequest:false,values:{[field.key]:'QA Mới'}});expect(provider).toHaveBeenCalledTimes(2);
  });
  it.each(['framing','goal'] as const)('cancels a pending conversation without dispatching a business cancellation (%s)',async kind=>{
    vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
    provider.mockResolvedValueOnce({text:JSON.stringify({version:1,dialogue:{act:'cancel',evidence:'khỏi làm nữa'},units:[unit('u1',kind,'khỏi làm nữa',kind==='goal'?'cancel':'none')]})});
    expect(await interpretRequest('Thôi khỏi làm nữa',[defaultWorkflow(operationById('worker.create')!)],{actionId:'worker.create'},[])).toMatchObject({cancel:true,actionId:null});
    expect(provider).toHaveBeenCalledOnce();
  });
});


it('allows only unchanged server-held draft values during correction, never unrequested new values',()=>{
  const s=source('worker.create'),text='Tên QA Mới nhé';
  const request=frame(text,[unit('u1','input','QA Mới','eq','QA Mới')]);
  request.continuingActionId=s.operation.id;request.continuingValues={phone:'0900090998'};
  const bindings=bind(request,[['values.fullName']]).bindings;
  expect(validateSemanticPlan(request,bindings,[{...s,values:{fullName:'QA Mới',phone:'0900090998'}}])).toEqual({ok:true});
  expect(validateSemanticPlan(request,bindings,[{...s,values:{fullName:'QA Mới',phone:'0900090997'}}])).toMatchObject({ok:false});
});


it('keeps an acknowledgement on the current draft, rather than resuming an unrelated queued goal',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const text='Ừ thông tin thế được rồi';
  provider.mockResolvedValueOnce({text:JSON.stringify({version:1,dialogue:{act:'continue',evidence:text},units:[unit('u1','goal',text,'create')]})})
    .mockResolvedValueOnce({text:JSON.stringify({intentType:'ambiguous',actionId:null,values:{},resumeGoal:true,actionIntent:'create',meaningBindings:[{unitId:'u1',targets:['action']}]})});
  const result=await interpretRequest(text,[defaultWorkflow(operationById('worker.create')!)],{actionId:'worker.create',values:{fullName:'QA Mới'}},[]);
  expect(result).toMatchObject({intentType:'workflow',actionId:'worker.create',values:{},newRequest:false});expect(result).not.toHaveProperty('resumeGoal');expect(provider).toHaveBeenCalledTimes(2);
});


describe('bounded semantic comparison of abstract READ predicates',()=>{
  it('bridges an abstract existence requirement to numeric debt only after independent comparison, pinning the exact query',async()=>{
    const request=frame('Còn nợ',[unit('u1','condition','Còn nợ','exists')]);
    const bindings=bind(request,[['analysis.filters.unpaidBalance']]).bindings;
    const s=source('partner.analysis',{analysis:{filters:[{field:'unpaidBalance',operator:'gt',value:0}]}}),budget=newInterpretationBudget();
    expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
    provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,coveredUnits:['u1'],reason:'Đại lượng còn nợ lớn hơn 0'})});
    const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],budget);
    expect(reviewed).toBeDefined();expect(validateSemanticPlan(reviewed!,bindings,[s])).toEqual({ok:true});
    expect(validateSemanticPlan(reviewed!,bindings,[{...s,values:{analysis:{filters:[{field:'unpaidBalance',operator:'gte',value:0}]}}}])).toMatchObject({ok:false});
    expect(semanticModelRequest(reviewed!)).not.toHaveProperty('readPredicateProofs');
    expect(await reviewAbstractReadPredicates(request,bindings,[s],budget)).toBeUndefined();expect(provider).toHaveBeenCalledOnce();
  });
  it('rejects semantic disagreement and cannot waive a missing concrete amount or authorize a write',async()=>{
    const request=frame('Còn nợ trên 200',[unit('u1','condition','Còn nợ','exists'),unit('u2','condition','trên 200','gt',200)]);
    const bindings=bind(request,[['analysis.filters.unpaidBalance'],['analysis.filters.totalCommission']]).bindings;
    const s=source('partner.analysis',{analysis:{filters:[{field:'unpaidBalance',operator:'gt',value:0},{field:'totalCommission',operator:'gt',value:200}]}});
    provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,coveredUnits:['u1'],reason:'Có nợ'})});
    const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget());
    expect(reviewed).toBeDefined();expect(validateSemanticPlan(reviewed!,bindings,[{...s,values:{analysis:{filters:[{field:'unpaidBalance',operator:'gt',value:0},{field:'totalCommission',operator:'gt',value:100}]}}}])).toMatchObject({ok:false});
    provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:false,coveredUnits:[],reason:'Không tương đương'})});
    expect(await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget())).toBeUndefined();
    provider.mockClear();expect(await reviewAbstractReadPredicates(request,bindings,[source('worker.update')],newInterpretationBudget())).toBeUndefined();expect(provider).not.toHaveBeenCalled();
  });
});


it('accepts a source-qualified module alias only for its actual module',()=>{
  const request=frame('Học viên',[unit('u1','entity','Học viên')]),s=source('student.list');
  expect(validateSemanticPlan(request,bind(request,[['action:student.list','context.module:student']]).bindings,[s])).toEqual({ok:true});
  expect(validateSemanticPlan(request,bind(request,[['context.module:worker']]).bindings,[s])).toMatchObject({ok:false});
});

it.each(['hoa hồng chưa trả','đã thanh toán hết','còn nợ'])('compares a descriptive abstract condition without weakening text literals: %s',async value=>{
  const request=frame('Các đối tác còn nợ',[unit('u1','condition','còn nợ','eq',value)]),bindings=bind(request,[['analysis.filters.unpaidBalance']]).bindings;
  provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,coveredUnits:['u1'],reason:'Tương đương'})});
  expect(await reviewAbstractReadPredicates(request,bindings,[source('partner.analysis',{analysis:{filters:[{field:'unpaidBalance',operator:'gt',value:0}]}})],newInterpretationBudget())).toBeDefined();
  provider.mockClear();
  const textBindings=bind(request,[['analysis.filters.name']]).bindings;
  expect(await reviewAbstractReadPredicates(request,textBindings,[source('partner.analysis',{analysis:{filters:[{field:'name',operator:'eq',value:'QA Khác'}]}})],newInterpretationBudget())).toBeUndefined();expect(provider).not.toHaveBeenCalled();
});

it('includes cross-resource capabilities in global discovery, before narrowing to a similarly named entity module',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  broker.discover.mockImplementation((await vi.importActual<typeof import('./capability-routing')>('./capability-routing')).discoverCapabilities);
  const text='Học viên của đối tác QA Partner',op=operationById('partner.referrals')!,workflows=[op,operationById('student.list')!].map(defaultWorkflow);
  provider.mockImplementation(async input=>{
    const props=input.responseSchema?.properties||{};
    if(props.units)return {text:JSON.stringify({version:1,dialogue:{act:'followup',evidence:text},units:[unit('u1','goal',text,'lookup'),unit('u2','reference','QA Partner','eq','QA Partner')]})};
    if(props.decision){expect(JSON.stringify(input.messages)).toContain('Xem học viên do đối tác tuyển sinh giới thiệu');expect(JSON.stringify(input.messages)).toContain('partnerName');return {text:JSON.stringify({featureKeys:props.featureKeys.items.enum,decision:'search',question:'',unavailableModule:null})};}
    if(props.featureKeys)return {text:JSON.stringify({featureKeys:props.featureKeys.items.enum,ambiguous:false,clarification:''})};
    return {text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{path_id:'QA Partner'},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.path_id']}]})};
  });
  expect((await interpretRequest(text,workflows,null,[])).actionId).toBe(op.id);
});


it('resumes a paused draft and compiles a correction in the same utterance, without dropping the new value',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');const text='Quay lại bản đang tạo, tên QA Hoàn Thiện nhé';
  provider.mockResolvedValueOnce({text:JSON.stringify({version:1,dialogue:{act:'resume',evidence:'Quay lại bản đang tạo'},units:[unit('u1','input','QA Hoàn Thiện','eq','QA Hoàn Thiện')]})})
    .mockResolvedValueOnce({text:JSON.stringify({intentType:'workflow',actionId:'worker.create',actionIntent:'create',values:{fullName:'QA Hoàn Thiện'},meaningBindings:[{unitId:'u1',targets:['values.fullName']}]})});
  const result=await interpretRequest(text,[defaultWorkflow(operationById('worker.create')!)],{paused:{actionId:'worker.create',values:{fullName:'QA Cũ',phone:'0900090998'}}},[]);
  expect(result).toMatchObject({resumePending:true,actionId:'worker.create',values:{fullName:'QA Hoàn Thiện'},newRequest:false});expect(provider).toHaveBeenCalledTimes(2);
});


it('accepts self-correction inside a new request independently of its overall dialogue label',()=>{
  const text='Thêm QA Cũ, à nhầm QA Mới',request=parseSemanticRequest(text,{version:1,dialogue:{act:'request',evidence:'Thêm'},units:[unit('u1','goal','Thêm','create'),{...unit('u2','input','QA Cũ','eq','QA Cũ'),supersededBy:'u3'},unit('u3','input','QA Mới','eq','QA Mới')]});
  const s=source('worker.create',{fullName:'QA Mới'});
  expect(validateSemanticPlan(request,bind(request,[['action'],['context.superseded'],['values.fullName']]).bindings,[s])).toEqual({ok:true});
});


it('compiles a complete abstract read predicate without letting a repair remove its prerequisite',async()=>{
  const request=frame('Đã hoàn tất nghĩa vụ',[unit('u1','condition','Đã hoàn tất nghĩa vụ','eq',true)]),bindings=bind(request,[['analysis.filters.unpaidBalance']]).bindings;
  const s=source('partner.analysis',{analysis:{filters:[{field:'unpaidBalance',operator:'lte',value:0}]}});
  provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:false,canRepresent:true,coveredUnits:['u1'],constraints:[{unitId:'u1',predicates:[{field:'totalCommission',operator:'gt',value:0},{field:'unpaidBalance',operator:'lte',value:0}]}],reason:'Phải có nghĩa vụ thực sự'})});
  const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget());
  expect(reviewed).toBeDefined();expect(s.values.analysis).toMatchObject({filters:[{field:'totalCommission',operator:'gt',value:0},{field:'unpaidBalance',operator:'lte',value:0}]});expect(validateSemanticPlan(reviewed!,bindings,[s])).toEqual({ok:true});
});

it('rejects a compiler proposal that changes a concrete requirement or invents a text filter',async()=>{
  const request=frame('Còn nợ trên 200',[unit('u1','condition','Còn nợ','exists'),unit('u2','condition','trên 200','gt',200)]),bindings=bind(request,[['analysis.filters.unpaidBalance'],['analysis.filters.totalCommission']]).bindings;
  const s=source('partner.analysis',{analysis:{filters:[{field:'unpaidBalance',operator:'gt',value:0},{field:'totalCommission',operator:'gt',value:200}]}}),before=JSON.stringify(s.values);
  provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,canRepresent:true,coveredUnits:['u1'],constraints:[{unitId:'u1',predicates:[{field:'name',operator:'eq',value:'QA Khác'}]}],reason:'Wrong'})});
  expect(await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget())).toBeUndefined();expect(JSON.stringify(s.values)).toBe(before);
});


it('grounds inherent read conditions and implicit scope against declared tool meaning without ignoring named scopes or writes',async()=>{
  const text='Những học viên đã được QA Partner giới thiệu vào trung tâm mình',request=frame(text,[unit('u1','condition','đã được QA Partner giới thiệu','eq'),unit('u2','scope','trung tâm mình','eq'),unit('u3','reference','QA Partner','eq','QA Partner')]);
  const bindings=bind(request,[['action'],['context.scope'],['values.path_id']]).bindings,s=source('partner.referrals',{path_id:'QA Partner'});
  provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,canRepresent:true,coveredUnits:['u1','u2'],builtinUnits:['u1'],scopeUnits:['u2'],constraints:[],reason:'Đúng nguồn quan hệ và phạm vi hiện tại'})});
  const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget());
  expect(reviewed).toBeDefined();expect(validateSemanticPlan(reviewed!,bindings,[s])).toEqual({ok:true});
  expect(validateSemanticPlan(reviewed!,bindings,[{...s,values:{path_id:'QA Khác'}}])).toMatchObject({ok:false});
  expect(semanticModelRequest(reviewed!)).not.toHaveProperty('readContextProofs');
});


it('keeps global capability discovery within the prompt budget across the full catalog, without sending full tool schemas',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');const text='Xem học viên của QA Partner';let discoveryBytes=0;
  broker.discover.mockImplementation((await vi.importActual<typeof import('./capability-routing')>('./capability-routing')).discoverCapabilities);
  provider.mockImplementation(async input=>{
    const props=input.responseSchema?.properties||{};
    if(props.units)return {text:JSON.stringify({version:1,units:[unit('u1','goal','Xem học viên','lookup'),unit('u2','reference','QA Partner','eq','QA Partner')]})};
    if(props.decision){discoveryBytes=interpretationPromptBytes(input);return {text:JSON.stringify({featureKeys:['student-partner:partner-records'],decision:'search',question:'',unavailableModule:null})};}
    if(props.featureKeys)return {text:JSON.stringify({featureKeys:['student-partner:partner-records'],ambiguous:false,clarification:''})};
    if(props.actionIds)return {text:JSON.stringify({actionIds:['partner.referrals']})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'partner.referrals',actionIntent:'lookup',values:{path_id:'QA Partner'},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.path_id']}]})};
  });
  const result=await interpretRequest(text,ASSISTANT_OPERATIONS.map(defaultWorkflow),null,[]);
  expect(discoveryBytes).toBeGreaterThan(0);expect(discoveryBytes).toBeLessThan(INTERPRETATION_LIMITS.promptBytes);expect(result.actionId,JSON.stringify(result)).toBe('partner.referrals');
});


it('canonicalizes non-executable entity operators instead of rejecting a correctly understood request',()=>{
  const text='Thêm đối tác QA Mới',request=frame(text,[unit('u1','goal','Thêm','create'),unit('u2','entity','đối tác','eq','đối tác'),unit('u3','input','QA Mới','eq','QA Mới')]);
  expect(request.units[1].operator).toBe('none');
});

it('repairs malformed meaning once independently, then caches it without asking the user for internal terms',async()=>{
  const text='Xem học viên',budget=newInterpretationBudget();
  provider.mockResolvedValueOnce({text:JSON.stringify({version:1,units:[unit('u1','goal','fabricated','lookup')]})})
    .mockResolvedValueOnce({text:JSON.stringify({version:1,units:[unit('u1','goal',text,'lookup')]})});
  expect((await understandSemanticRequest(text,null,[],'',budget)).units[0].quote).toBe(text);
  await understandSemanticRequest(text,null,[],'',budget);expect(provider).toHaveBeenCalledTimes(2);expect(budget.semanticSourceRepairAttempted).toBe(true);
});


it('separates editing a pending draft from issuing a new database update, without waiving write preconditions',()=>{
  const request=frame('Sửa tên QA Mới',[unit('u1','goal','Sửa','update'),unit('u2','input','QA Mới','eq','QA Mới')]),bindings=bind(request,[['action'],['values.fullName']]).bindings,s=source('worker.create',{fullName:'QA Mới'});
  expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
  request.continuingActionId=s.operation.id;request.dialogue={act:'correct',evidence:'Sửa'};
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  request.units.push(unit('u3','condition','Sửa','eq',true));bindings.set('u3',['action']);
  expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
});


it('rechecks a spurious unsupported-scope clarification once, while preserving the actual source inputs',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');const text='Xem học viên của QA Partner tại đơn vị mình',op=operationById('partner.referrals')!,f=frame(text,[unit('u1','goal','Xem học viên','lookup'),unit('u2','reference','QA Partner','eq','QA Partner'),unit('u3','scope','đơn vị mình')]);let plans=0;
  provider.mockImplementation(async input=>{
    const props=input.responseSchema?.properties||{};
    if(props.units)return {text:JSON.stringify(f)};
    if(props.modules)return {text:JSON.stringify({modules:[op.module]})};
    if(props.featureKeys)return {text:JSON.stringify({featureKeys:props.featureKeys.items.enum,ambiguous:false,clarification:''})};
    if(++plans===1)return {text:JSON.stringify({intentType:'ambiguous',actionId:null,values:{},clarificationReason:'unapplied_condition',clarification:'Không có bộ lọc đơn vị'})};
    return {text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.path_id']},{unitId:'u3',targets:['context.scope']}]})};
  });
  const result=await interpretRequest(text,[defaultWorkflow(op)],null,[]);expect(result).toMatchObject({actionId:op.id,values:{path_id:'QA Partner'}});expect(plans).toBe(2);
});


it('derives non-executable bindings without forcing the model to repeat fillers or superseded inputs',()=>{
  const text='Ờ thêm QA Cũ, nhầm QA Mới',request=frame(text,[unit('u1','framing','Ờ'),unit('u2','goal','thêm','create'),{...unit('u3','input','QA Cũ','eq','QA Cũ'),supersededBy:'u4'},unit('u4','input','QA Mới','eq','QA Mới')]);
  const bound=bindSemanticRequest(request,[{unitId:'u2',targets:['action']},{unitId:'u4',targets:['values.fullName']}],[]);
  expect(validateSemanticPlan(request,bound.bindings,[source('worker.create',{fullName:'QA Mới'})])).toEqual({ok:true});
  expect(()=>bindSemanticRequest(request,[{unitId:'u2',targets:['action']}],[])).toThrow();
});


it('does not requeue a paused server-owned draft as a fresh task without an active goal in the new request',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');const text='Khoan tạo đối tác đã, xem học viên trước nhé',op=operationById('student.list')!;
  provider.mockImplementation(async input=>{
    const props=input.responseSchema?.properties||{};
    if(props.units)return {text:JSON.stringify({version:1,dialogue:{act:'pause',evidence:'Khoan tạo đối tác đã'},units:[unit('u1','goal','xem học viên','lookup')]})};
    if(props.modules)return {text:JSON.stringify({modules:['student']})};
    if(props.featureKeys)return {text:JSON.stringify({featureKeys:props.featureKeys.items.enum,ambiguous:false,clarification:''})};
    return {text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{},cancel:true,resumeGoal:true,remainingRequests:['tạo đối tác'],meaningBindings:[{unitId:'u1',targets:['action']}]})};
  });
  const result=await interpretRequest(text,[defaultWorkflow(op),defaultWorkflow(operationById('worker.create')!)],{actionId:'worker.create',values:{fullName:'QA Draft'}},[]);
  expect(result).toMatchObject({actionId:op.id,pausePending:true,newRequest:true,remainingRequests:[]});
});


const naturalCaptures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-natural-dialogue.json',import.meta.url),'utf8'));
it.each(naturalCaptures)('replays captured natural dialogue through normalization and bounded semantic compilation: $id',async fixture=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');let meaning=0,plan=0,review=0;
  const expected=operationById(fixture.actionId)!;
  const workflows=ASSISTANT_OPERATIONS.filter(op=>['student.list','partner.referrals','partner.analysis','partner.payouts.analysis',fixture.actionId,fixture.pending?.actionId,fixture.pending?.paused?.actionId].includes(op.id)).map(defaultWorkflow);
  provider.mockImplementation(async input=>{
    const props=input.responseSchema?.properties||{};
    const output=props.units?fixture.meaning[meaning++]:props.modules?{modules:[expected.module]}:props.featureKeys?{featureKeys:props.featureKeys.items.enum,ambiguous:false,clarification:''}:props.actionIds?{actionIds:[fixture.actionId]}:props.equivalent?fixture.reviews[review++]:fixture.plans[plan++];
    if(!output)throw Error('Unexpected extra inference in captured dialogue '+fixture.id);
    return {text:JSON.stringify(output)};
  });
  const result=await interpretRequest(fixture.text,workflows,fixture.pending||null,[]);
  expect(result.actionId,JSON.stringify(result)).toBe(fixture.actionId);expect(provider.mock.calls.length).toBeLessThanOrEqual(6);
  if(fixture.id==='N03-PAUSE-AND-READ')expect(result).toMatchObject({pausePending:true,remainingRequests:[]});
  if(fixture.id==='N05-RESUME')expect(result).toMatchObject({resumePending:true,values:{name:'QA Hoàn Thiện 2611'}});
});

it('verifies whether a computed read can answer the requested output, without relaxing named outputs',async()=>{
 const request=frame('Có hồ sơ phù hợp không',[unit('u1','goal','Có hồ sơ','lookup'),unit('u2','output','phù hợp không')]);
 const bindings=bind(request,[['action'],['analysis.aggregate.count']]).bindings;
 const s=source('partner.analysis',{analysis:{aggregate:{operation:'count'}}});
 expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
 provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,canRepresent:true,coveredUnits:['u2'],builtinUnits:[],scopeUnits:[],constraints:[],reason:'Count answers existence'})});
 const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget());
 expect(reviewed).toBeDefined();expect(validateSemanticPlan(reviewed!,bindings,[s])).toEqual({ok:true});
 expect(semanticModelRequest(reviewed!)).not.toHaveProperty('readOutputProofs');
 expect(validateSemanticPlan(reviewed!,bindings,[source('partner.analysis',{analysis:{aggregate:{operation:'sum',field:'totalCommission'}}})])).toMatchObject({ok:false});
 const names=frame('Tên đối tác nào',[unit('u1','goal','đối tác','lookup'),unit('u2','output','Tên')]);
 provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:false,canRepresent:false,coveredUnits:[],constraints:[],reason:'Count cannot answer names'})});
 expect(await reviewAbstractReadPredicates(names,bindings,[s],newInterpretationBudget())).toBeUndefined();
});

it('grounds a compound relation and its named reference without requiring one fixed NLU segmentation',async()=>{
 const request=frame('Học viên do QA Partner đưa tới',[unit('u1','goal','Học viên','lookup'),unit('u2','condition','do QA Partner đưa tới','eq','được QA Partner giới thiệu')]);
 const bindings=bind(request,[['action'],['action','values.path_id']]).bindings,s=source('partner.referrals',{path_id:'QA Partner'});
 provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,canRepresent:true,coveredUnits:['u2'],builtinUnits:['u2'],scopeUnits:[],constraints:[],reason:'Declared relation with literal reference'})});
 const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget());
 expect(reviewed).toBeDefined();expect(validateSemanticPlan(reviewed!,bindings,[s])).toEqual({ok:true});
 expect(validateSemanticPlan(reviewed!,bindings,[{...s,values:{path_id:'QA Khác'}}])).toMatchObject({ok:false});
 expect(await reviewAbstractReadPredicates(request,bindings,[{...s,values:{path_id:'QA Khác'}}],newInterpretationBudget())).toBeUndefined();
});

it('allows a relation unit to repeat an independently grounded reference without consuming it twice',async()=>{
 const request=frame('QA Partner đưa học viên đến trung tâm mình',[unit('u1','goal','đưa học viên','lookup'),unit('u2','reference','QA Partner','eq','QA Partner'),unit('u3','condition','đưa học viên đến trung tâm mình','eq','trung tâm mình')]);
 const bindings=bind(request,[['action'],['values.path_id'],['action','values.path_id']]).bindings,s=source('partner.referrals',{path_id:'QA Partner'});
 provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true,canRepresent:true,coveredUnits:['u3'],builtinUnits:['u3'],scopeUnits:[],constraints:[],reason:'Relation with independently grounded reference'})});
 const reviewed=await reviewAbstractReadPredicates(request,bindings,[s],newInterpretationBudget());
 expect(reviewed).toBeDefined();expect(validateSemanticPlan(reviewed!,bindings,[s])).toEqual({ok:true});
 expect(validateSemanticPlan(reviewed!,bindings,[{...s,values:{path_id:'QA Khác'}}])).toMatchObject({ok:false});
});

it('preserves a concrete business clarification when semantic equivalence cannot be established',async()=>{
 const request=frame('Tìm hồ sơ phù hợp',[unit('u1','condition','phù hợp','eq',true)]),bindings=bind(request,[['analysis.filters.unpaidBalance']]).bindings,budget=newInterpretationBudget();
 provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:false,canRepresent:false,coveredUnits:[],constraints:[],question:'Bạn muốn lọc theo số dư còn nợ hay trạng thái hồ sơ?',reason:'Two business meanings'})});
 expect(await reviewAbstractReadPredicates(request,bindings,[source('partner.analysis',{analysis:{filters:[{field:'unpaidBalance',operator:'gt',value:0}]}})],budget)).toBeUndefined();
 expect(budget.semanticClarification).toBe('Bạn muốn lọc theo số dư còn nợ hay trạng thái hồ sơ?');
});
