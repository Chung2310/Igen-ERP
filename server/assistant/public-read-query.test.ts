import {describe,it,expect,vi} from 'vitest';
import {ASSISTANT_OPERATIONS,operationById,defaultWorkflow,type AssistantOperation} from './catalog';
import {analyzeList,validateListAnalysis,renderPartialListAnalysis,canPresentPartialList,type AnalysisContract} from './list-analysis';
import {validateFilterExpression,matchesFilter} from './filter-expression';
import {collectPublicReadData,publicReadAnalysis} from './public-read-query';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan} from './semantic-request';
import {compileSemanticResolutions} from './semantic-compilation';
import {readFileSync} from 'node:fs';
import {collectValues} from './policy';
import {matchesNativeNumericPredicate} from './query-predicate';

const contract:AnalysisContract={fields:{name:{label:'Tên',type:'text',contains:true},score:{label:'Điểm',type:'number'},state:{label:'Trạng thái',type:'text',values:{active:'Hoạt động',paused:'Tạm dừng'}},date:{label:'Ngày',type:'text',format:'date'},email:{label:'Email',type:'text',contains:true}}};
const rows=[{name:'Đặng Ánh',score:10,state:'active',date:'2026-11-01',email:''},{name:'Anh Bình',score:5,state:'paused',date:'2026-11-30',email:'qa@example.test'},{name:'Châu',score:2,state:'active',date:'2026-12-01'},{name:'Thiếu',state:'active'}];
it('recognizes the unpaginated scoped interview API and refuses a conflicting total',async()=>{
 const op=operationById('recruitment.interview.list')!;
 expect(await collectPublicReadData(op,{},async()=>({data:[]}),()=>[])).toMatchObject({analysisComplete:true});
 await expect(collectPublicReadData(op,{},async()=>({data:[],total:2}),()=>[])).rejects.toThrow();
});
it('recognizes the full scoped by-customer aggregate array, without accepting arbitrary bare pages',async()=>{
 const op=operationById('finance.receivable.by-customer')!,rows=[{customerName:'QA A',balance:500}];
 expect(await collectPublicReadData(op,{},async()=>({success:true,data:rows}),r=>r.data)).toMatchObject({analysisComplete:true,data:rows});
 await expect(collectPublicReadData(op,{},async()=>({success:true,data:rows,total:20}),r=>r.data)).rejects.toThrow();
 await expect(collectPublicReadData({...op,path:'/unreviewed/customer-list'}, {},async()=>({data:rows}),r=>r.data)).rejects.toThrow();
});
it('uses the reviewed schedule completeness only inside its bounded 400-day expansion window',async()=>{
 const op=operationById('student.schedule.list')!,from=op.fields.find(f=>f.apiKey==='from')!,to=op.fields.find(f=>f.apiKey==='to')!;
 const dispatch=vi.fn(async()=>({success:true,events:[]})),project=()=>[];
 expect(await collectPublicReadData(op,{[from.key]:'2026-11-27',[to.key]:'2026-11-27'},dispatch,project)).toMatchObject({analysisComplete:true,data:[]});
 await expect(collectPublicReadData(op,{},dispatch,project)).rejects.toThrow();
 await expect(collectPublicReadData(op,{[from.key]:'2025-01-01',[to.key]:'2026-11-27'},dispatch,project)).rejects.toThrow();
});
describe('shared read filter expression',()=>{
  it('keeps AND/OR/nested NOT, accents and empty cells distinct',()=>{
    const where={all:[{any:[{field:'name',operator:'contains',value:'DANG ANH'},{field:'score',operator:'gte',value:5}]},{not:{field:'state',operator:'eq',value:'paused'}}]};
    expect(analyzeList(contract,rows,{where},true).records.map(r=>r.Tên)).toEqual(['Đặng Ánh']);
    expect(analyzeList(contract,rows,{where:{not:{field:'score',operator:'gt',value:5}}},true).records.map(r=>r.Tên)).toEqual(['Anh Bình','Châu']);
    expect(analyzeList(contract,rows,{where:{field:'email',operator:'is_empty'}},true).records.map(r=>r.Tên)).toEqual(['Đặng Ánh','Châu','Thiếu']);
  });
  it.each(['between','in','nin','startsWith','endsWith'])('supports %s without model-generated code',operator=>{
    const p=operator==='between'?{field:'score',operator,value:[5,10]}:operator==='in'||operator==='nin'?{field:'state',operator,value:['active']}:{field:'name',operator,value:operator==='startsWith'?'dang':'binh'};
    expect(analyzeList(contract,rows,{where:p},true).records.length).toBe(operator==='between'?2:operator==='in'?3:1);
  });
  it('compares declared dates, inclusive bounds and equivalent instants',()=>{
    expect(analyzeList(contract,rows,{where:{field:'date',operator:'between',value:['2026-11-01','2026-11-30']}},true).records.length).toBe(2);
    expect(()=>validateListAnalysis({where:{field:'date',operator:'gte',value:'2026-02-30'}},contract)).toThrow();
    expect(()=>validateListAnalysis({where:{field:'date',operator:'between',value:['2026-12-01','2026-11-01']}},contract)).toThrow();
    expect(analyzeList(contract,[{date:'2026-11-30T16:59:59Z'},{date:'2026-11-30T17:00:00Z'}],{where:{field:'date',operator:'between',value:['2026-11-01','2026-11-30']}},true).matched).toBe(1);
  });
  it.each([{field:'password',operator:'eq',value:'x'},{any:[]},{field:'state',operator:'eq',value:'invented'},{field:'score',operator:'eq',value:'10'},{field:'name',operator:'contains',value:'.*',extra:true},{field:'email',operator:'is_empty',value:''}])('rejects invalid or unapproved filters %j',where=>expect(()=>validateListAnalysis({where},contract)).toThrow());
  it('bounds tree complexity and does not accept an ambiguous combination of grammars',()=>{
    let node:any={field:'score',operator:'gt',value:0};for(let i=0;i<8;i++)node={not:node};
    expect(()=>validateListAnalysis({where:node},contract)).toThrow();
    expect(()=>validateListAnalysis({where:{field:'score',operator:'gt',value:0},filters:[]},contract)).toThrow();
  });
  it('refuses incomplete data and mixed numeric cells rather than producing a false zero',()=>{
    expect(()=>analyzeList(contract,rows,{where:{field:'score',operator:'gt',value:0}},false)).toThrow();
    const generic={fields:{amount:{label:'Tiền',type:'scalar' as const,contains:true}}};
    expect(()=>analyzeList(generic,[{amount:'100'}],{aggregate:{operation:'sum',field:'amount'}},true)).toThrow();
    expect(()=>matchesFilter({score:'10'},validateFilterExpression({field:'score',operator:'gt',value:1},contract.fields),contract.fields)).toThrow();
    expect(()=>analyzeList(generic,[{amount:'100'}],{where:{field:'amount',operator:'ne',value:100}},true)).toThrow();
    expect(()=>analyzeList(generic,[{amount:'100'}],{extreme:{field:'amount',direction:'max'}},true)).toThrow();
  });
  it('can display exact matches in a partial list, but never a global no-match, total or ranking',()=>{
    const plan={where:{field:'score',operator:'gt',value:5}};
    const reply=renderPartialListAnalysis(contract,rows,plan,'Kết quả');
    expect(reply).toContain('Đặng Ánh');expect(reply).not.toContain('Anh Bình');expect(reply).toContain('chưa bao gồm toàn bộ');
    expect(renderPartialListAnalysis(contract,rows,{where:{field:'score',operator:'gt',value:100}},'Kết quả')).toContain('chưa thể kết luận cho toàn bộ');
    for(const plan of [{aggregate:{operation:'count'}},{sort:{field:'score',direction:'desc'}},{extreme:{field:'score',direction:'max'}},{limit:1}]){expect(canPresentPartialList(plan as any)).toBe(false);expect(()=>renderPartialListAnalysis(contract,rows,plan,'Kết quả')).toThrow();}
  });
});
const operation=(extra:Partial<AssistantOperation>={}):AssistantOperation=>({...operationById('employee.list')!,path:'/fixture/paged',fields:[{key:'p',apiKey:'page',source:'query',type:'number',label:'Trang'},{key:'n',apiKey:'limit',source:'query',type:'number',label:'Số dòng',max:2}],...extra});
describe('public read collection through the caller dispatch',()=>{
  it('loads every page, preserves scope/native filters and projects approved fields only',async()=>{
    const op=operation(),dispatch=vi.fn(async(input:any)=>({data:[{id:String(input.p),displayName:`QA ${input.p}`,password:'secret'}],total:2,page:input.p}));
    const result=await collectPublicReadData(op,{branch:'scoped',search:'QA'},dispatch,r=>r.data);
    expect(result).toEqual({data:[{displayName:'QA 1'},{displayName:'QA 2'}],analysisComplete:true});
    expect(dispatch.mock.calls.map(([v])=>v)).toEqual([{branch:'scoped',search:'QA',p:1,n:2},{branch:'scoped',search:'QA',p:2,n:2}]);
  });
  it.each(['missing-total','duplicate','changed-total','wrong-page','projection-changed','empty-page'])('refuses incomplete/unstable %s',async kind=>{
    const dispatch=vi.fn(async(input:any)=>({data:kind==='empty-page'?[]:[{id:kind==='duplicate'?'same':String(input.p),displayName:'QA'}],...(kind==='missing-total'?{}:{total:kind==='changed-total'&&input.p===2?3:2}),page:kind==='wrong-page'?2:input.p}));
    await expect(collectPublicReadData(operation(),{},dispatch,r=>kind==='projection-changed'?[]:r.data)).rejects.toThrow();
  });
  it('does not mistake one page without a declared next-page input for a full result',async()=>{
    await expect(collectPublicReadData(operation({fields:[]}),{},async()=>({data:[{displayName:'QA'}],total:25}),r=>r.data)).rejects.toThrow();
  });
  it('keeps missing totals, summaries and binary outputs out of complete-result claims',async()=>{
    for(const r of [[{displayName:'QA'}],{data:{count:2}},{data:[],hasMore:false}])await expect(collectPublicReadData(operation(),{},async()=>r,r=>r.data||r)).rejects.toThrow();
    expect(publicReadAnalysis({...operation(),analysis:undefined,rawResponse:true,resultFields:['filename']})).toBeUndefined();
  });
  it('registers shared grammar for public reads in all modules, without granting fields or write capabilities',()=>{
    for(const op of ASSISTANT_OPERATIONS){
      if(op.analysis?.publicRead){expect(op.method==='GET'||op.readOnly).toBeTruthy();expect(op.assistantOnlyFields).toContain('analysis');const approved=op.analysis.publicRowsField?op.resultChildFields![op.analysis.publicRowsField] as string[]:op.resultFields;expect(Object.keys(op.analysis.fields).every(k=>approved.includes(k))).toBe(true);expect(defaultWorkflow(op).fields.some(f=>f.key==='analysis')).toBe(true);}
      if(op.method!=='GET'&&!op.readOnly)expect(op.analysis).toBeUndefined();
    }
    for(const id of ['employee.list','worker.list','student.list','product.list','customer.list'])expect(operationById(id)?.analysis?.publicRead).toBe(true);
  });
  it('accepts only reviewed array shapes and refuses contradictory totals',async()=>{
    const op={...operationById('employee.list')!};
    expect(await collectPublicReadData(op,{},async()=>({data:[{displayName:'QA'}]}),r=>r.data)).toEqual({data:[{displayName:'QA'}],analysisComplete:true});
    await expect(collectPublicReadData(op,{},async()=>({data:[{displayName:'QA'}],total:9}),r=>r.data)).rejects.toThrow();
  });
  it('returns explicitly partial known rows for filtering without inventing completeness',async()=>{
    const result=await collectPublicReadData(operation(),{},async()=>({data:[{displayName:'QA'}]}),r=>r.data,{allowPartialRows:true});
    expect(result).toEqual({data:[{displayName:'QA'}],analysisComplete:false});
    const dispatch=vi.fn(async(input:any)=>({data:[{id:'p2',displayName:'QA Trang hai'}],page:input.p,total:6}));
    const page=await collectPublicReadData(operation(),{p:2,n:1},dispatch,r=>r.data,{allowPartialRows:true});
    expect(page.analysisComplete).toBe(false);expect(dispatch).toHaveBeenCalledTimes(1);expect(dispatch.mock.calls[0][0]).toMatchObject({p:2,n:1});
  });
  it('never relaxes inconsistent totals or duplicate pages in partial mode',async()=>{
    await expect(collectPublicReadData(operation(),{},async()=>({data:[{displayName:'A'},{displayName:'B'}],total:1}),r=>r.data,{allowPartialRows:true})).rejects.toThrow();
  });
  it('preserves equal anonymous rows on one page but rejects overlap across pages',async()=>{
    const op=operation(),row={displayName:'Chưa cập nhật tên'};
    expect(await collectPublicReadData(op,{},async()=>({data:[row,row],total:2,page:1}),r=>r.data)).toEqual({data:[row,row],analysisComplete:true});
    await expect(collectPublicReadData(op,{},async input=>({data:[row],total:2,page:input.p}),r=>r.data)).rejects.toThrow(/trùng/);
    await expect(collectPublicReadData(op,{},async()=>({data:[{id:'same',...row},{id:'same',...row}],total:2,page:1}),r=>r.data)).rejects.toThrow(/trùng/);
  });
  it('does not advertise collection post-filtering on a single record or an obligatory limited keyword lookup',()=>{
    expect(operationById('api.get.fe5907605a3c317a')?.analysis).toBeUndefined();
    expect(operationById('api.get.51885b828100e376')?.analysis).toBeUndefined();
    expect(operationById('customer.list')?.analysis?.publicRead).toBe(true);
    expect(operationById('customer.list')?.analysis?.fields.status.values).not.toHaveProperty('all');
    expect(operationById('customer.list')?.fields.find(f=>f.apiKey==='status')?.options).toContain('all');
  });
});
describe('independent meaning retains boolean relationships',()=>{
  const text='Hoạt động hoặc tạm dừng', units=[{id:'u1',kind:'condition',quote:'Hoạt động',concept:'trạng thái',operator:'eq',value:'active'},{id:'u2',kind:'condition',quote:'tạm dừng',concept:'trạng thái',operator:'eq',value:'paused'}];
  const op={...operation(),analysis:contract};
  const bindings=[{unitId:'u1',targets:['analysis.filters.state']},{unitId:'u2',targets:['analysis.filters.state']}];
  const validate=(where:unknown,logic:unknown={any:['u1','u2']})=>{const request=parseSemanticRequest(text,{version:1,units,conditionLogic:logic}),bound=bindSemanticRequest(request,bindings,[]);return validateSemanticPlan(request,bound.bindings,[{workflow:defaultWorkflow(op),operation:op,values:{analysis:{where}}}]);};
  const a={field:'state',operator:'eq',value:'active'},b={field:'state',operator:'eq',value:'paused'};
  it('accepts reordered equivalent OR and rejects flattened AND or hidden negation',()=>{
    expect(validate({any:[b,a]})).toEqual({ok:true});
    expect(validate({all:[a,b]})).toMatchObject({ok:false});
    expect(validate({not:{any:[a,b]}})).toMatchObject({ok:false});
    expect(validate({any:[a,b]},{all:['u1','u2']})).toMatchObject({ok:false});
  });
  it('rejects unknown/repeated meaning references and extra unrequested clauses',()=>{
    expect(()=>parseSemanticRequest(text,{version:1,units,conditionLogic:{any:['u1','u3']}})).toThrow();
    expect(()=>parseSemanticRequest(text,{version:1,units,conditionLogic:{any:['u1','u1']}})).toThrow();
    expect(validate({any:[a,b,{field:'score',operator:'gt',value:0}]})).toMatchObject({ok:false});
  });
  it('reviews enum meaning per leaf without flattening OR or allowing a hidden sibling',()=>{
    const request=parseSemanticRequest(text,{version:1,units:units.map(u=>({...u,value:u.id==='u1'?'đang hoạt động':'tạm dừng'})),conditionLogic:{any:['u1','u2']}});
    const bound=bindSemanticRequest(request,bindings,[]),source={workflow:defaultWorkflow(op),operation:op,values:{analysis:{where:{any:[a,b]}}}};
    compileSemanticResolutions(request,[source],bound.bindings,units.map((u,i)=>({unitId:u.id,actionId:op.id,role:'read_predicate' as const,target:'',predicates:[i===0?a:b]})));
    expect(validateSemanticPlan(request,bound.bindings,[source])).toEqual({ok:true});
    source.values.analysis.where={any:[a,{...b,value:'active'}]};
    expect(validateSemanticPlan(request,bound.bindings,[source])).toMatchObject({ok:false});
  });
});
describe('actual live read plans as deterministic regressions',()=>{
  const captured=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-read-filters.json',import.meta.url),'utf8'));
  it.each(captured)('accepts the correct live plan and intake: $id',fixture=>{
    const request=parseSemanticRequest(fixture.text,fixture.meaning),op=operationById(fixture.plan.actionId)!;
    const source={operation:op,workflow:defaultWorkflow(op),values:fixture.plan.values};
    const bound=bindSemanticRequest(request,fixture.plan.meaningBindings,[]);
    expect(validateSemanticPlan(request,bound.bindings,[source])).toEqual({ok:true});
    expect(collectValues(source.workflow,source.values).errors).toEqual([]);
  });
  it.each([[30,'gt',31,true],[30,'gt',30,false],[30.5,'gt',31,true],[30.5,'gte',31,true],[30,'gte',31,false],[30,'lt',29,false]])('converts only reviewed exact native bounds %j %s %j',(value,operator,actual,expected)=>{
    const op=operationById('finance.receivable.list')!,field=op.fields.find(f=>f.apiKey==='minOverdueDays')!;
    expect(matchesNativeNumericPredicate(op,field,operator as string,value,actual)).toBe(expected);
    expect(matchesNativeNumericPredicate({...op,queryPredicates:undefined},field,operator as string,value,actual)).toBe(false);
    expect(matchesNativeNumericPredicate({...op,method:'PATCH',readOnly:false},field,operator as string,value,actual)).toBe(false);
  });
});
