import {afterEach,describe,it,expect,vi} from 'vitest';
const provider=vi.hoisted(()=>vi.fn());vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
import {ASSISTANT_OPERATIONS,defaultWorkflow,operationById} from './catalog';
import {discoverCapabilities,capabilitySearchPool,verifyActionFit,relevantCapabilityOutputs} from './capability-routing';
import {newInterpretationBudget,interpretationPromptBytes,INTERPRETATION_LIMITS} from './interpretation-budget';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan} from './semantic-request';
import {interpretRequest} from './semantic-interpreter';
import {readFileSync} from 'node:fs';
const frame=(text:string)=>parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:text,concept:text,operator:'lookup',value:null,dimension:'none'}]});
afterEach(()=>{provider.mockReset();vi.unstubAllEnvs();});
it('keeps a globally relevant direct source when discovery guesses only a related function',async()=>{
 const request=frame('Học viên nào chưa đóng học phí lớp QA Anh văn 01');
 const workflows=ASSISTANT_OPERATIONS.filter(o=>!o.unavailableReason).map(defaultWorkflow);
 provider.mockResolvedValueOnce({text:JSON.stringify({featureKeys:['student:batch'],decision:'search',question:'',unavailableModule:null})});
 const result=await discoverCapabilities(request,workflows,newInterpretationBudget());
 expect('workflows' in result).toBe(true);
 if('workflows' in result)expect(result.workflows.map(w=>w.actionId)).toContain('student.tuition.balance.list');
});
it('repairs truncated reviewer JSON once without accepting partial approvals or exceeding the existing budget',async()=>{
 const request=frame('Xem học viên'),operation=operationById('student.list')!,source={operation,workflow:defaultWorkflow(operation),values:{}};
 provider.mockImplementationOnce(async input=>{expect(input.maxTokens).toBe(4096);return {text:'{"approvedActionIds":["student.list"],"resolutions":['};})
 .mockResolvedValueOnce({text:JSON.stringify({approvedActionIds:['student.list'],question:'',resolutions:[]})});
 const budget=newInterpretationBudget();expect((await verifyActionFit(request,[source],[source.workflow],budget)).approvedActionIds).toEqual(['student.list']);
 expect(budget.calls).toBe(2);expect(provider).toHaveBeenCalledTimes(2);
 provider.mockReset();provider.mockResolvedValue({text:'{"approvedActionIds":['});
 const exhausted={...newInterpretationBudget(),calls:5};
 await expect(verifyActionFit(frame('Xem học viên'),[source],[source.workflow],exhausted)).rejects.toMatchObject({diagnostic:{code:'ACTION_FIT_INVALID_JSON'}});
 expect(provider).toHaveBeenCalledTimes(1);expect(exhausted.calls).toBe(6);
});
it('retains requested outputs outside the first catalog columns in compact alternatives',async()=>{
 const request=frame('Đơn bán lẻ nào còn phải trả trên 1 triệu? Chỉ lấy mã đơn và số tiền còn phải trả.'),op=operationById('retail.order.list')!,workflow=defaultWorkflow(op);
 expect(op.resultFields.indexOf('dueAmount')).toBeGreaterThan(5);
 expect(relevantCapabilityOutputs(workflow,request,2)).toContain('dueAmount');
 provider.mockImplementationOnce(async input=>{
   const body=JSON.parse(input.messages.at(-1).content),candidate=body.alternatives.find((a:any)=>a.actionId===op.id);
   expect(candidate.outputs).toContain('dueAmount');expect(candidate.readFields).toContain('dueAmount');
   return {text:JSON.stringify({approvedActionIds:[op.id],question:'',resolutions:[]})};
 });
 expect((await verifyActionFit(request,[],[workflow],newInterpretationBudget())).approvedActionIds).toEqual([op.id]);
});
it('keeps read capability recovery within the byte budget with the full authorized registry',async()=>{
 const fixture=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-read-filters.json',import.meta.url),'utf8')).find((f:any)=>f.id==='STUDENT-NUMERIC-AND');
 const request=parseSemanticRequest(fixture.text,fixture.meaning),op=operationById(fixture.plan.actionId)!,source={operation:op,workflow:defaultWorkflow(op),values:fixture.plan.values};
 const {bindings}=bindSemanticRequest(request,fixture.plan.meaningBindings,[]);
 let measuredBytes=0;provider.mockImplementationOnce(async input=>{measuredBytes=interpretationPromptBytes(input);const payload=JSON.parse(input.messages.at(-1).content);expect(payload.alternatives.every((a:any)=>typeof a.readQuery!=='object')).toBe(true);return {text:JSON.stringify({approvedActionIds:[op.id],question:'',resolutions:[]})};});
 expect((await verifyActionFit(request,[source],ASSISTANT_OPERATIONS.filter(o=>!o.unavailableReason).map(defaultWorkflow),newInterpretationBudget(),[],bindings)).approvedActionIds).toEqual([op.id]);expect(measuredBytes).toBeLessThanOrEqual(56000);
});
it('rechecks a false unavailable result even when the requested module is enabled',async()=>{
 const request=frame('Tìm sản phẩm QA Đèn bàn'),workflow=defaultWorkflow(operationById('product.list')!);
 provider.mockResolvedValueOnce({text:JSON.stringify({featureKeys:[],decision:'unavailable',question:'',unavailableModule:'inventory'})})
  .mockResolvedValueOnce({text:JSON.stringify({approvedActionIds:[workflow.actionId],question:'',resolutions:[]})});
 const result=await discoverCapabilities(request,[workflow],newInterpretationBudget());
 expect('workflows' in result&&result.workflows.map(w=>w.actionId)).toEqual([workflow.actionId]);expect(provider).toHaveBeenCalledTimes(2);
});
it('includes relevant editable inputs in alternatives instead of only the first schema fields',async()=>{
 const request=frame('Sửa lương nhân sự QA thành 12 triệu'),wrong=operationById('payroll.period.input.update')!,right=operationById('employee.update')!;
 provider.mockImplementation(async input=>{
  const body=JSON.parse(input.messages[1].content),alternative=body.alternatives.find((w:any)=>w.actionId===right.id);
  expect(alternative.inputs).toContain('Lương tháng');
  expect(alternative.entityKey).toBe('employee');expect(body.selected[0].missingIdentityInputs).toContain('Kỳ lương (YYYY-MM)');
  return {text:JSON.stringify({approvedActionIds:[right.id],question:'',resolutions:[]})};
 });
 expect((await verifyActionFit(request,[{operation:wrong,workflow:defaultWorkflow(wrong),values:{}}],[defaultWorkflow(wrong),defaultWorkflow(right)],newInterpretationBudget())).approvedActionIds).toEqual([right.id]);
});
it.each(['resource.google-drive.move','recruitment.applicant.transition','student.learning-roadmap.promote','payroll.payment.confirm'])('classifies a business command independently of POST creation: %s',id=>expect(operationById(id)?.assistantMetadata?.intent).toBe('process'));
it('keeps cross-module alternatives even when discovery preferred the wrong function',()=>{
 const request=frame('Xem học viên do đối tác tuyển sinh giới thiệu');
 const pool=capabilitySearchPool(request,ASSISTANT_OPERATIONS.map(defaultWorkflow),['student:students']);
 expect(pool.some(w=>w.actionId==='partner.referrals')).toBe(true);expect(pool.length).toBeLessThanOrEqual(120);
});
it('requires semantic action approval at the runtime gate, not just matching read types',async()=>{
 const request=frame('Xem danh sách nhân sự công ty');request.actionFitRequired=true;
 const op=operationById('student.list')!,source={operation:op,workflow:defaultWorkflow(op),values:{}};
 const bindings=bindSemanticRequest(request,[{unitId:'u1',targets:['action']}],[]).bindings;
 expect(validateSemanticPlan(request,bindings,[source])).toMatchObject({ok:false});
 provider.mockResolvedValueOnce({text:JSON.stringify({approvedActionIds:[],question:'Bạn cần nhân sự công ty, nguồn học viên không đáp ứng.'})});
 const fit=await verifyActionFit(request,[source],[source.workflow],newInterpretationBudget());
 expect(fit.approvedActionIds).toEqual([]);expect(validateSemanticPlan(request,bindings,[source])).toMatchObject({ok:false});
});
it('cannot approve an action outside the authorized registry',async()=>{
 const request=frame('Xem học viên'),op=operationById('student.list')!,source={operation:op,workflow:defaultWorkflow(op),values:{}};
 provider.mockResolvedValueOnce({text:JSON.stringify({approvedActionIds:['not.authorized'],question:''})});
 await expect(verifyActionFit(request,[source],[source.workflow],newInterpretationBudget())).rejects.toThrow();
});
it('rejects an unauthorized selected source before requesting any AI verdict',async()=>{
 const request=frame('Xem học viên'),op=operationById('student.list')!;
 await expect(verifyActionFit(request,[{operation:op,workflow:defaultWorkflow(op),values:{}}],[],newInterpretationBudget())).rejects.toThrow();
 expect(provider).not.toHaveBeenCalled();
});
it.each(['invented','',null])('rejects malformed capability decisions instead of silently broadening: %s',async decision=>{
 const request=frame('Xem học viên');provider.mockResolvedValue({text:JSON.stringify({featureKeys:[],decision,question:'',unavailableModule:null})});
 await expect(discoverCapabilities(request,[defaultWorkflow(operationById('student.list')!)],newInterpretationBudget())).rejects.toThrow();
});
it('searches all authorized functions and keeps the full-catalog discovery prompt bounded',async()=>{
 const request=frame('Xem học viên của đối tác QA Partner');let bytes=0;
 provider.mockImplementation(async input=>{bytes=interpretationPromptBytes(input);return {text:JSON.stringify({featureKeys:['student-partner:partner-records'],decision:'search',question:'',unavailableModule:null})};});
 const result=await discoverCapabilities(request,ASSISTANT_OPERATIONS.map(defaultWorkflow),newInterpretationBudget());
 expect('workflows' in result).toBe(true);expect(bytes).toBeLessThan(INTERPRETATION_LIMITS.promptBytes);
 if('workflows' in result)expect(result.workflows.some(w=>w.actionId==='partner.referrals')).toBe(true);
});
it('bounds the independent fit prompt over the full catalog and rejects write alternatives for a read registry',async()=>{
 const request=frame('Xem học viên do đối tác giới thiệu'),op=operationById('partner.referrals')!;
 const registry=ASSISTANT_OPERATIONS.filter(o=>o.method==='GET'||o.readOnly).map(defaultWorkflow);let bytes=0;
 provider.mockImplementation(async input=>{bytes=interpretationPromptBytes(input);expect(JSON.stringify(input.responseSchema)).not.toContain('student.create');return {text:JSON.stringify({approvedActionIds:[op.id],question:''})};});
 expect((await verifyActionFit(request,[{operation:op,workflow:defaultWorkflow(op),values:{}}],registry,newInterpretationBudget())).approvedActionIds).toEqual([op.id]);
 expect(bytes).toBeLessThan(INTERPRETATION_LIMITS.promptBytes);
});
it('recovers from a wrong source using independently approved alternatives, without dispatching the wrong one',async()=>{
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');const text='Xem học viên do đối tác tuyển sinh giới thiệu',request=frame(text);let plans=0,fits=0;
 provider.mockImplementation(async input=>{
  const p=input.responseSchema?.properties||{};
  if(p.units)return {text:JSON.stringify(request)};
  if(p.decision)return {text:JSON.stringify({featureKeys:['student:students'],decision:'search',question:'',unavailableModule:null})};
  if(p.approvedActionIds){fits++;return {text:JSON.stringify({approvedActionIds:['partner.referrals'],question:''})};}
  plans++;return {text:JSON.stringify({intentType:'workflow',actionId:plans===1?'student.list':'partner.referrals',actionIntent:'lookup',values:{},meaningBindings:[{unitId:'u1',targets:['action']}]})};
 });
 const workflows=['student.list','partner.referrals'].map(id=>defaultWorkflow(operationById(id)!));
 const result=await interpretRequest(text,workflows,null,[]);
 expect(result.actionId).toBe('partner.referrals');expect(plans).toBe(2);expect(fits).toBe(2);expect(provider.mock.calls.length).toBeLessThanOrEqual(6);
});

it('independently rechecks a false unsupported claim and recovers a tool outside the shortlisted function',async()=>{
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');const text='Xem học viên do đối tác giới thiệu',request=frame(text);let plans=0;
 provider.mockImplementation(async input=>{
  const p=input.responseSchema?.properties||{};
  if(p.units)return {text:JSON.stringify(request)};
  if(p.decision)return {text:JSON.stringify({featureKeys:['student:students'],decision:'search',question:'',unavailableModule:null})};
  if(p.approvedActionIds)return {text:JSON.stringify({approvedActionIds:['partner.referrals'],question:''})};
  plans++;return {text:JSON.stringify(plans===1?{intentType:'unsupported',actionId:null,actionIntent:'lookup',values:{},meaningBindings:[]}:{intentType:'workflow',actionId:'partner.referrals',actionIntent:'lookup',values:{},meaningBindings:[{unitId:'u1',targets:['action']}]})};
 });
 const result=await interpretRequest(text,['student.list','partner.referrals'].map(id=>defaultWorkflow(operationById(id)!)),null,[]);
 expect(result.actionId).toBe('partner.referrals');expect(plans).toBe(2);expect(provider.mock.calls.length).toBeLessThanOrEqual(6);
});

it('balances full contracts across selected capabilities instead of filling them with one large function',async()=>{
 const request=frame('Bên QA Bình Minh đã đưa những bạn học viên nào sang trung tâm mình vậy?');
 provider.mockResolvedValue({text:JSON.stringify({featureKeys:['student:students','student-partner:partner-analysis','student-partner:partner-records'],decision:'search',question:'',unavailableModule:null})});
 const result=await discoverCapabilities(request,ASSISTANT_OPERATIONS.filter(o=>o.method==='GET'||o.readOnly).map(defaultWorkflow),newInterpretationBudget());
 expect('workflows' in result).toBe(true);if('workflows' in result){expect(result.workflows.some(w=>w.actionId==='partner.referrals')).toBe(true);expect(result.workflows.length).toBeLessThanOrEqual(12);}
});

it('rechecks a false unavailable parent against authorized child capabilities',async()=>{
 const text='Trong quản lý lao động, sửa chính sách QA',request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:'sửa chính sách',concept:'Sửa chính sách',operator:'update',value:null,dimension:'none'},{id:'u2',kind:'scope',quote:'Trong quản lý lao động',concept:'Phân hệ',operator:'eq',value:'quản lý lao động',dimension:'none'}]});
 const patch=ASSISTANT_OPERATIONS.find(o=>o.method==='PATCH'&&o.path==='/worker-management/partners/policies/:policyId')!;
 const wrong=operationById('employee.create')!;
 provider.mockImplementation(async input=>{
  if(input.responseSchema.properties.decision)return {text:JSON.stringify({featureKeys:[],decision:'unavailable',question:'',unavailableModule:'worker'})};
  expect(JSON.stringify(input.responseSchema)).not.toContain(wrong.id);
  return {text:JSON.stringify({approvedActionIds:[patch.id],question:'',resolutions:[]})};
 });
 const result=await discoverCapabilities(request,[patch,wrong].map(defaultWorkflow),newInterpretationBudget());
 expect('workflows' in result&&result.workflows.map(w=>w.actionId)).toEqual([patch.id]);expect(provider).toHaveBeenCalledTimes(2);
});
it('does not substitute another domain when the explicit requested domain has no authorized tools',async()=>{
 const text='Trong quản lý lao động, tạo dự án',request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:'tạo dự án',concept:'Tạo dự án',operator:'create',value:null,dimension:'none'},{id:'u2',kind:'scope',quote:'Trong quản lý lao động',concept:'Phân hệ',operator:'eq',value:'quản lý lao động',dimension:'none'}]});
 provider.mockResolvedValue({text:JSON.stringify({featureKeys:[],decision:'unavailable',question:'',unavailableModule:'worker'})});
 const result=await discoverCapabilities(request,[defaultWorkflow(operationById('employee.create')!)],newInterpretationBudget());
 expect(result).toMatchObject({unavailable:'worker'});expect(provider).toHaveBeenCalledOnce();
});
it('rechecks enum bindings after a repaired path and reuses only an identical reviewed plan',async()=>{
 const op=operationById('api.post.e57ae0da3cdf14f8')!,workflow=defaultWorkflow(op),budget=newInterpretationBudget();
 const request=parseSemanticRequest('khi hợp đồng còn hiệu lực',{version:1,units:[{id:'u1',kind:'condition',quote:'khi hợp đồng còn hiệu lực',concept:'Điều kiện áp dụng',operator:'eq',value:'còn hiệu lực'}]});
 const sources=[{operation:op,workflow,values:{official:{milestones:[{eligibilityRule:'contract_active'}]}}}];
 const bindings=new Map([['u1',['values.official.milestones.eligibilityRule']]]);
 provider.mockImplementation(async input=>({text:JSON.stringify({approvedActionIds:[op.id],question:'',resolutions:[{unitId:'u1',actionId:op.id,role:'enum_input',target:JSON.parse(input.messages[1].content).bindings.u1[0],predicates:[]}]})}));
 await verifyActionFit(request,sources,[workflow],budget,[],bindings);
 await verifyActionFit(request,sources,[workflow],budget,[],bindings);expect(provider).toHaveBeenCalledTimes(1);
 bindings.set('u1',['values.official.milestones.0.eligibilityRule']);
 await verifyActionFit(request,sources,[workflow],budget,[],bindings);expect(provider).toHaveBeenCalledTimes(2);
 expect(request.compiledRoles?.u1.targets).toEqual(['values.official.milestones.0.eligibilityRule']);
});
