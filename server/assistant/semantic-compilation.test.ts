import {describe,it,expect} from 'vitest';
import {assistantModuleContext} from './module-context';
import {readFileSync} from 'node:fs';
import {compileSemanticResolutions,type SemanticResolution} from './semantic-compilation';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan,semanticModelRequest,inputProof,normalizeSemanticInputBindings,normalizeSemanticAnalysisBindings} from './semantic-request';
import {defaultWorkflow,operationById,ASSISTANT_OPERATIONS} from './catalog';
const captured=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-web-labor.json',import.meta.url),'utf8'));
const source=(id:string,values:Record<string,unknown>)=>({operation:operationById(id)!,workflow:defaultWorkflow(operationById(id)!),values:structuredClone(values)});
const resolution=(unitId:string,actionId:string,role:SemanticResolution['role'],target:string,predicates:SemanticResolution['predicates']=[])=>({unitId,actionId,role,target,predicates});
describe('shared semantic lowering against actual failed web frames',()=>{
 it('lowers a reviewed native enum predicate while refusing a changed or negated value',()=>{
  const operation=ASSISTANT_OPERATIONS.find(o=>o.id==='student.resource.list')!;
  const field=operation.fields.find(f=>f.apiKey==='status'||f.key==='status')!;
  const make=(value:string,operator='eq')=>{
   const request=parseSemanticRequest('Thiết bị sẵn sàng sử dụng',{version:1,units:[{id:'u1',kind:'condition',quote:'sẵn sàng sử dụng',concept:'Trạng thái',operator,value:'sẵn sàng sử dụng'}]});
   const s=source(operation.id,{[field.key]:value}),{bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:[`values.${field.key}`]}],[]);
   compileSemanticResolutions(request,[s],bindings,[resolution('u1',operation.id,'read_predicate','',[{field:'status',operator:'eq',value:'AVAILABLE'}])]);
   return request.compiledRoles?.u1;
  };
  expect(make('AVAILABLE')?.role).toBe('enum_input');
  expect(make('MAINTENANCE')).toBeUndefined();
  expect(make('AVAILABLE','ne')).toBeUndefined();
 });
 const broad=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-flexible-core.json',import.meta.url),'utf8'));
 it.each(broad)('grounds the actual broad live frame against declared execution targets: $id',fixture=>{
  const request=parseSemanticRequest(fixture.text,fixture.meaning),plan=fixture.plan;
  const sources=plan.queryPlan?plan.queryPlan.map((q:any)=>({...source(q.actionId,q.values),resultFields:q.resultFields})):[source(plan.actionId,plan.values)];
  const {bindings}=bindSemanticRequest(request,plan.meaningBindings,[]);
  normalizeSemanticInputBindings(bindings,sources);normalizeSemanticAnalysisBindings(bindings,sources);
  const proposals=fixture.id==='CREATE-WORKER'?[resolution('u3','worker.create','input_literal','values.fullName',[{field:'fullName',operator:'eq',value:'QA Nhân công A'}])]
   :fixture.id==='GROUP-PARTNERS'?[resolution('u5','partner.analysis','public_output','analysis.aggregate.count')]
   :[resolution('u1','student.list','action_binding','action'),resolution('u2','student.list','action_binding','action'),resolution('u3','student.list','public_output','result.fullName'),resolution('u4','worker.list','action_binding','action'),resolution('u5','worker.list','action_binding','action'),resolution('u6','worker.list','execution_context','context.scope'),resolution('u7','worker.list','public_output','result.fullName')];
  compileSemanticResolutions(request,sources,bindings,proposals);
  expect(validateSemanticPlan(request,bindings,sources),JSON.stringify(bindings)).toEqual({ok:true});
  if(fixture.id==='CREATE-WORKER'){
   expect(sources[0].values.fullName).toBe('QA Nhân công A');
   const bad=structuredClone(sources);bad[0].values.fullName='QB Nhân công A';expect(validateSemanticPlan(request,bindings,bad)).toMatchObject({ok:false});
  }
 });
 it('does not use an assignment review to flip a boolean, fabricate a number or approve a whole structured object',()=>{
  const s=source('employee.update',{enabled:true,amount:12000001,configuration:'{"hidden":true}'});
  s.workflow.fields=[{key:'enabled',label:'Bật',type:'boolean'},{key:'amount',label:'Số tiền',type:'number'},{key:'configuration',label:'Cấu hình',type:'json',structure:{type:'object',keys:{hidden:{type:'boolean'}}}}];
  const request=parseSemanticRequest('không bật, 12000000',{version:1,units:[{id:'u1',kind:'condition',quote:'không bật',concept:'Bật',operator:'eq',value:false},{id:'u2',kind:'condition',quote:'12000000',concept:'Số tiền',operator:'eq',value:12000000}]});
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['values.enabled']},{unitId:'u2',targets:['values.amount']}],[]);
  compileSemanticResolutions(request,[s],bindings,[resolution('u1',s.operation.id,'input_assignment','values.enabled'),resolution('u2',s.operation.id,'input_assignment','values.amount')]);
  expect(request.compiledRoles).toEqual({});
  bindings.set('u1',['values.configuration']);compileSemanticResolutions(request,[s],bindings,[resolution('u1',s.operation.id,'input_assignment','values.configuration')]);
  expect(request.compiledRoles).toEqual({});
 });
 it('supports a category group containing several enum members without accepting a partial group',()=>{
  const text='Đếm theo nhóm A và B',request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'aggregate',quote:'Đếm',concept:'Đếm',operator:'count',value:null,dimension:'numeric'},{id:'u2',kind:'group',quote:'nhóm A và B',concept:'Nhóm',operator:'none',value:'A, B',dimension:'none'}]});
  const s=source('partner.analysis',{analysis:{groupBy:'isActive',aggregate:{operation:'count'}}});
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['analysis.aggregate.count']},{unitId:'u2',targets:['analysis.groupBy.isActive']}],[]);
  const p=resolution('u2',s.operation.id,'group_category','analysis.groupBy.isActive',[{field:'isActive',operator:'eq',value:'active'},{field:'isActive',operator:'eq',value:'inactive'}]);
  compileSemanticResolutions(request,[s],bindings,[p]);expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  request.compiledRoles!.u2.value=['active'];expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
 });
 it('allows independently reviewed present-state context while retaining explicit date and write checks',()=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  const text='Xem hiện trạng',request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:'Xem',concept:'Xem',operator:'lookup',value:null,dimension:'none'},{id:'u2',kind:'time',quote:'hiện trạng',concept:'Hiện trạng',operator:'eq',value:today,dimension:'temporal'}]});
  const s=source('partner.list',{}),{bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['action']}],[]);
  expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
  compileSemanticResolutions(request,[s],bindings,[resolution('u2',s.operation.id,'snapshot_context','context.scope')]);
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  const explicit=structuredClone(request);explicit.units[1].quote=today;
  expect(validateSemanticPlan(explicit,bindings,[s])).toMatchObject({ok:false});
  const past=structuredClone(request);past.units[1].value='2020-01-01';
  expect(validateSemanticPlan(past,bindings,[s])).toMatchObject({ok:false});
  expect(validateSemanticPlan(request,bindings,[{...s,operation:{...s.operation,method:'POST',readOnly:false}}])).toMatchObject({ok:false});
 });
 it('accepts an independently reviewed expansion of a current-time marker, never a past period',()=>{
  const s=source('student.resource.list',{}),r=parseSemanticRequest('Hiện có thiết bị nào đang bảo trì không',{version:1,units:[{id:'u1',kind:'time',quote:'Hiện',concept:'Hiện tại',operator:'eq',value:'hiện tại',dimension:'temporal'}]});
  const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['context.discourse']}],[]);
  compileSemanticResolutions(r,[s],bindings,[resolution('u1',s.operation.id,'snapshot_context','context.scope')]);
  expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
  const past=structuredClone(r);past.units[0].quote='Tháng trước';expect(validateSemanticPlan(past,bindings,[s])).toMatchObject({ok:false});
 });
 it('accepts the real grouped-count plan while preserving category coverage and rejecting altered plans',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-status-breakdown.json',import.meta.url),'utf8'));
  const request=parseSemanticRequest(fixture.text,fixture.meaning),s=source(fixture.plan.actionId,fixture.plan.values);
  const {bindings}=bindSemanticRequest(request,fixture.plan.meaningBindings,[]);
  expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
  const proposals=[resolution('u3',s.operation.id,'group_category','analysis.groupBy.isActive',[{field:'isActive',operator:'eq',value:'active'}]),resolution('u5',s.operation.id,'group_category','analysis.groupBy.isActive',[{field:'isActive',operator:'eq',value:'inactive'}])];
  compileSemanticResolutions(request,[s],bindings,proposals);
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  const r2=parseSemanticRequest(fixture.text,fixture.meaning),b2=bindSemanticRequest(r2,fixture.plan.meaningBindings,[]).bindings;
  compileSemanticResolutions(r2,[s],b2,proposals.slice(0,1));
  expect(validateSemanticPlan(r2,b2,[s])).toMatchObject({ok:false});
  const r3=structuredClone(request);r3.compiledRoles!.u5.value='active';
  expect(validateSemanticPlan(r3,bindings,[s])).toMatchObject({ok:false});
  expect(validateSemanticPlan(request,bindings,[{...s,operation:{...s.operation,analysis:{...s.operation.analysis!,fields:{...s.operation.analysis!.fields,isActive:{...s.operation.analysis!.fields.isActive,values:{active:'Đang hoạt động',inactive:'Tạm dừng',archived:'Đã lưu trữ'}}}}}}])).toMatchObject({ok:false});
  const filtered=source(s.operation.id,{analysis:{groupBy:'isActive',aggregate:{operation:'count'},filters:[{field:'isActive',operator:'eq',value:'active'}]}});
  expect(validateSemanticPlan(request,bindings,[filtered])).toMatchObject({ok:false});
  const r4=structuredClone(request);r4.units.find(u=>u.id==='u3')!.operator='ne';
  expect(validateSemanticPlan(r4,bindings,[s])).toMatchObject({ok:false});
 });
 it('lowers a lifecycle start date without changing its value or accepting a wrong date',()=>{
  const fixture=captured.find((f:any)=>f.id==='L02'),plan=fixture.plans[0],s=source(plan.actionId,plan.values);
  const request=parseSemanticRequest('Thêm 1 chính sách hoa hồng mới - QA Chính sách lao động cuối năm, áp dụng từ 1/12/2026',fixture.meaning);
  const {bindings}=bindSemanticRequest(request,plan.meaningBindings,[]);
  expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
  compileSemanticResolutions(request,[s],bindings,[resolution('u4',s.operation.id,'temporal_input','values.effectiveFrom')]);
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  expect(validateSemanticPlan(request,bindings,[{...s,values:{...s.values,effectiveFrom:'2026-12-02'}}])).toMatchObject({ok:false});
  expect(semanticModelRequest(request)).not.toHaveProperty('compiledRoles');
 });
 it('does not waive strict dates or named organizations as domain context',()=>{
  const s=source('api.post.e57ae0da3cdf14f8',{name:'QA',effectiveFrom:'2026-12-01'});
  const r=parseSemanticRequest('Sau 01/12/2026, chi nhánh Quản lý lao động',{version:1,units:[{id:'u1',kind:'time',quote:'Sau 01/12/2026',concept:'Sau ngày',operator:'gt',value:'2026-12-01',dimension:'temporal'},{id:'u2',kind:'scope',quote:'chi nhánh Quản lý lao động',concept:'Chi nhánh có tên',operator:'eq',value:'Quản lý lao động',dimension:'none'}]});
  const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['values.effectiveFrom']},{unitId:'u2',targets:['context.module']}],[]);
  compileSemanticResolutions(r,[s],bindings,[resolution('u1',s.operation.id,'temporal_input','values.effectiveFrom'),resolution('u2',s.operation.id,'module_context','context.module')]);
  expect(Object.keys(r.compiledRoles||{})).toHaveLength(0);expect(validateSemanticPlan(r,bindings,[s])).toMatchObject({ok:false});
 });
 it('compiles source-provided row measures/dimensions and canonical public outputs, preserving extrema',()=>{
  const fixture=captured.find((f:any)=>f.id==='L06'),plan=fixture.plans.at(-1),s=source(plan.actionId,plan.values);
  const request=parseSemanticRequest('Trong quản lí lao động, Đối tác nào giới thiệu được ít lao động nhất trong tháng?',fixture.meaning);
  const {bindings}=bindSemanticRequest(request,plan.meaningBindings,[]);
  compileSemanticResolutions(request,[s],bindings,[resolution('u2',s.operation.id,'module_context','context.module'),resolution('u4',s.operation.id,'row_measure','result.actualReferrals'),resolution('u5',s.operation.id,'row_dimension','result.partnerName'),resolution('u8',s.operation.id,'public_output','result.partnerName')]);
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
  expect(s.values.analysis).not.toHaveProperty('groupBy');expect(s.values.analysis).toMatchObject({extreme:{field:'actualReferrals',direction:'min'}});
  expect(validateSemanticPlan(request,bindings,[{...s,values:{...s.values,analysis:{extreme:{field:'actualReferrals',direction:'max'}}}}])).toMatchObject({ok:false});
 });
 it.each(ASSISTANT_OPERATIONS.filter(op=>op.assistantMetadata?.intent==='create'&&op.fields.some(f=>f.type==='date'&&/From|start|from/i.test(f.apiKey||f.key))).slice(0,15))('uses the same boundary mechanism for $id',op=>{
  const f=op.fields.find(f=>f.type==='date'&&/From|start|from/i.test(f.apiKey||f.key))!,s=source(op.id,{[f.key]:'2026-12-01'});
  const request=parseSemanticRequest('Tạo hồ sơ từ 01/12/2026',{version:1,units:[{id:'u1',kind:'goal',quote:'Tạo hồ sơ',concept:'Tạo hồ sơ',operator:'create',value:null,dimension:'none'},{id:'u2',kind:'time',quote:'từ 01/12/2026',concept:'Mốc bắt đầu',operator:'gte',value:'2026-12-01',dimension:'temporal'}]});
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:[`values.${f.key}`]}],[]);
  compileSemanticResolutions(request,[s],bindings,[resolution('u2',op.id,'temporal_input',`values.${f.key}`)]);
  expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
 });
});

it('inherits only unchanged server-owned JSON leaves while editing a draft',()=>{
 const s=source('api.post.e57ae0da3cdf14f8',{official:JSON.stringify({enabled:true,maxMonths:2})});
 const request=parseSemanticRequest('Số tháng 2',{version:1,units:[{id:'u1',kind:'input',quote:'2',concept:'Số tháng',operator:'eq',value:2,dimension:'numeric'}]});
 request.continuingActionId=s.operation.id;request.continuingValues={official:JSON.stringify({enabled:true})};
 const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['values.official.maxMonths']}],[]);
 expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
 expect(validateSemanticPlan(request,bindings,[{...s,values:{official:JSON.stringify({enabled:false,maxMonths:2})}}])).toMatchObject({ok:false});
 expect(validateSemanticPlan(request,bindings,[{...s,values:{official:JSON.stringify({enabled:true,maxMonths:2,milestones:[]})}}])).toMatchObject({ok:false});
});
it.each(['index','key'])('grounds enum assignments in nested arrays by %s only after independent review, preserving every numeric leaf',mode=>{
 const s=source('api.patch.2971d5a8a97f8be8',{official:{milestones:[{month:1,amount:500000,eligibilityRule:'contract_active'},{month:2,amount:500000,eligibilityRule:'contract_active'}]}});
 const units:any[]=[{id:'u1',kind:'goal',quote:'Sửa mốc',concept:'Sửa mốc',operator:'update',value:null}];
 const raw:any[]=[{unitId:'u1',targets:['action']}];
 for(let index=0;index<2;index++)for(const [key,value] of Object.entries({month:index+1,amount:500000})){
  if(mode==='key'&&key==='month')continue;
  const id=`u${units.length+1}`;units.push({id,kind:'input',quote:mode==='key'?`mốc ${index+1} nhận ${value}`:String(value),concept:key,operator:'eq',value});raw.push({unitId:id,targets:[`values.official.milestones[${mode==='key'?'month='+(index+1):index}].${key}`]});
 }
 const id=`u${units.length+1}`;units.push({id,kind:'condition',quote:'khi hợp đồng còn hiệu lực',concept:'Điều kiện của mốc',operator:'eq',value:'còn hiệu lực'});
 raw.push({unitId:id,targets:mode==='key'?['values.official.milestones[month=1].eligibilityRule','values.official.milestones[month=2].eligibilityRule']:['values.official.milestones[0].eligibilityRule','values.official.milestones[1].eligibilityRule']});
 const r=parseSemanticRequest('Sửa mốc 1 nhận 500000, mốc 2 nhận 500000 khi hợp đồng còn hiệu lực',{version:1,units});
 const {bindings}=bindSemanticRequest(r,raw,[]);
 expect(validateSemanticPlan(r,bindings,[s])).toMatchObject({ok:false});
 compileSemanticResolutions(r,[s],bindings,[resolution(id,s.operation.id,'enum_input',mode==='key'?'values.official.milestones[month=1].eligibilityRule':'values.official.milestones.0.eligibilityRule')]);
 expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 const changed=structuredClone(s);(changed.values.official as any).milestones[1].eligibilityRule='worked_days';
 expect(validateSemanticPlan(r,bindings,[changed])).toMatchObject({ok:false});
 (changed.values.official as any).milestones[1].amount=900000;
 expect(validateSemanticPlan(r,bindings,[changed])).toMatchObject({ok:false});
 if(mode==='key'){
  const duplicate=structuredClone(s);(duplicate.values.official as any).milestones.push({...((duplicate.values.official as any).milestones[0])});
  expect(validateSemanticPlan(r,bindings,[duplicate])).toMatchObject({ok:false});
  const unquoted=structuredClone(r);unquoted.units=unquoted.units.map(u=>u.kind==='input'?{...u,quote:'500000'}:u);
  expect(validateSemanticPlan(unquoted,bindings,[s])).toMatchObject({ok:false});
 }
});
it('allows omitted indices only in singleton schema arrays and never picks a first record',()=>{
 const s=source('api.post.e57ae0da3cdf14f8',{official:{milestones:[{month:1,amount:500000,eligibilityRule:'contract_active'}]}});
 expect(inputProof(s,'official.milestones.amount')).toMatchObject({field:{key:'official.milestones.0.amount'},value:500000});
 (s.values.official as any).milestones.push({month:2,amount:600000});
 expect(inputProof(s,'official.milestones.amount')).toBeUndefined();
 expect(inputProof(s,'official.milestones[month=99].amount')).toBeUndefined();
 expect(inputProof(s,'official.milestones[constructor=1].amount')).toBeUndefined();
});
it.each(['còn hiệu lực',true])('lowers a reviewed enum from a natural or boolean condition: %s',value=>{
 const s=source('api.post.e57ae0da3cdf14f8',{official:{enabled:true,milestones:[{eligibilityRule:'contract_active'}]}});
 const r=parseSemanticRequest('Chính thức, khi hợp đồng còn hiệu lực',{version:1,units:[{id:'u1',kind:'input',quote:'Chính thức',concept:'Loại áp dụng',operator:'eq',value:'Chính thức'},{id:'u2',kind:'condition',quote:'hợp đồng còn hiệu lực',concept:'Điều kiện áp dụng',operator:'eq',value}]});
 r.continuingActionId=s.operation.id;r.continuingValues={};
 const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['values.official.enabled']},{unitId:'u2',targets:['values.official.milestones.eligibilityRule']}],[]);
 compileSemanticResolutions(r,[s],bindings,[resolution('u1',s.operation.id,'enum_input','values.official.enabled'),resolution('u2',s.operation.id,'enum_input','values.official.milestones.eligibilityRule')]);
 expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 const changed=structuredClone(s);(changed.values.official as any).enabled=false;expect(validateSemanticPlan(r,bindings,[changed])).toMatchObject({ok:false});
});
it('recovers unique case-only evidence from the original input without inventing quotes',()=>{
 const unit={id:'u1',kind:'input',quote:'Mốc tháng 2 nhận 500000 đồng',concept:'Mức nhận',operator:'eq',value:500000};
 const text='mốc tháng 2 nhận 500000 đồng';
 expect(parseSemanticRequest(text,{version:1,units:[unit]}).units[0].quote).toBe(text);
 expect(()=>parseSemanticRequest('mốc tháng 2 nhận 600000 đồng',{version:1,units:[unit]})).toThrow();
 expect(()=>parseSemanticRequest(text+', '+text,{version:1,units:[unit]})).toThrow();
 expect(()=>parseSemanticRequest('không trả',{version:1,units:[{...unit,quote:'được trả'}]})).toThrow();
});
it('grounds a second numeric leaf of a compound input only by reviewed schema and quote',()=>{
 const s=source('api.post.e57ae0da3cdf14f8',{official:{milestones:[{month:1,amount:500000}]}});
 const r=parseSemanticRequest('Tạo mốc tháng 1 nhận 500000 đồng',{version:1,units:[{id:'u1',kind:'goal',quote:'Tạo',concept:'Tạo mốc',operator:'create',value:null},{id:'u2',kind:'input',quote:'mốc tháng 1 nhận 500000 đồng',concept:'Khoản nhận ở mốc đầu',operator:'eq',value:500000}]});
 const {bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.official.milestones.0.amount']}],[]);
 expect(validateSemanticPlan(r,bindings,[s])).toMatchObject({ok:false});
 compileSemanticResolutions(r,[s],bindings,[resolution('u2',s.operation.id,'input_fragment','values.official.milestones.0.month')]);
 expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
 const changed=structuredClone(s);(changed.values.official as any).milestones[0].month=2;
 expect(validateSemanticPlan(r,bindings,[changed])).toMatchObject({ok:false});
 const missing=structuredClone(r);missing.units[1].quote='nhận 500000 đồng';
 expect(validateSemanticPlan(missing,bindings,[s])).toMatchObject({ok:false});
});
it.each([...new Set(ASSISTANT_OPERATIONS.map(o=>o.module))].flatMap(module=>{
 const op=ASSISTANT_OPERATIONS.find(o=>o.module===module&&(o.method==='GET'||o.readOnly));return op?[op]:[];
}))('uses catalog domain metadata across module $module without phrase aliases',op=>{
 const label=assistantModuleContext(op.module).label,text=`Trong ${label}, xem dữ liệu`;
 const r=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:'xem dữ liệu',concept:'Tra cứu',operator:'lookup',value:null,dimension:'none'},{id:'u2',kind:'scope',quote:`Trong ${label}`,concept:'Phân hệ',operator:'eq',value:label,dimension:'none'}]});
 const s=source(op.id,{}),{bindings}=bindSemanticRequest(r,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['context.module']}],[]);
 compileSemanticResolutions(r,[s],bindings,[resolution('u2',op.id,'module_context','context.module')]);
 expect(validateSemanticPlan(r,bindings,[s])).toEqual({ok:true});
});
