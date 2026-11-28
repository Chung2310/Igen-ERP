import {afterEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {operationById,defaultWorkflow} from './catalog';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan,normalizeSemanticReadProjection,attachSemanticProof} from './semantic-request';
import {compileSemanticResolutions} from './semantic-compilation';
import {verifiedSemanticContexts} from './semantic-execution-context';
import {collectPublicReadData} from './public-read-query';
import {analyzeList} from './list-analysis';
import {projectRecords} from './executor';
import {withAssistantInterpretationControl,withAssistantRequestControl} from './execution-control';
import {applyAssistantResponseRules} from './reply-rules';
import {PlanStoppedError} from './execution-budget';
import {openrouterChat} from '../service/openrouter.service';
import {InterpretationBudgetExceeded} from './interpretation-budget';

const fixtures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-web-search.json',import.meta.url),'utf8'));
const source=(id:string,values:Record<string,any>)=>{const operation=operationById(id)!;return {operation,workflow:defaultWorkflow(operation),values};};
const req:any={user:{id:'64b000000000000000000001',companyCode:'QA',branchId:'64b000000000000000000002',role:'admin'}};
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});

it('preserves both captured OR leaves when the category reviewer suggests GROUP BY evidence',()=>{
 const f=fixtures.find((f:any)=>f.id==='W05'),request=parseSemanticRequest(f.text,f.meaning),s=source(f.plan.actionId,structuredClone(f.plan.values));
 const {bindings}=bindSemanticRequest(request,f.plan.meaningBindings,[]);
 compileSemanticResolutions(request,[s],bindings,f.resolutions);
 expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
 expect(s.values.analysis.where).toEqual(f.plan.values.analysis.where);
 const rows=[...Array(7)].map(()=>({isActive:'active'})).concat([...Array(3)].map(()=>({isActive:'inactive'})));
 const result=analyzeList(s.operation.analysis!,rows,s.values.analysis,true);
 expect(result.records.map(r=>Object.values(r))).toEqual(expect.arrayContaining([expect.arrayContaining(['7']),expect.arrayContaining(['3'])]));
 const changed=structuredClone(s);changed.values.analysis.where.any[1].value='active';
 expect(validateSemanticPlan(request,bindings,[changed])).toMatchObject({ok:false});
});

it('materializes only the public output columns of a captured simple lookup',()=>{
 const f=fixtures.find((f:any)=>f.id==='W01'),request=parseSemanticRequest(f.text,f.meaning),s=source(f.plan.actionId,structuredClone(f.plan.values));
 const {bindings}=bindSemanticRequest(request,f.plan.meaningBindings,[]);
 normalizeSemanticReadProjection(request,bindings,[s]);
 expect(s.values.analysis.select).toEqual(['name','productCode']);
 compileSemanticResolutions(request,[s],bindings,f.resolutions);
 expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
 const result=attachSemanticProof({},request,bindings);
 expect(verifiedSemanticContexts(result,[s],f.text)[0].requestedOutputs).toEqual(['name','productCode']);
});
it('retains a requested row dimension when projecting the other requested output columns',()=>{
 const text='Tên từng đối tác và học phí giới thiệu';
 const request=parseSemanticRequest(text,{version:1,units:[
  {id:'u1',kind:'group',quote:'từng đối tác',concept:'Tên đối tác',operator:'none',value:null},
  {id:'u2',kind:'output',quote:'học phí giới thiệu',concept:'Học phí',operator:'none',value:null},
 ]});
 const s=source('partner.analysis',{analysis:{select:['name','totalReferredTuition']}});
 const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['result.name']},{unitId:'u2',targets:['result.totalReferredTuition']}],[]);
 normalizeSemanticReadProjection(request,bindings,[s]);
 expect(s.values.analysis.select).toEqual(['name','totalReferredTuition']);
 compileSemanticResolutions(request,[s],bindings,[{unitId:'u1',actionId:s.operation.id,role:'row_dimension',target:'result.name',predicates:[]}]);
 expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
});

it('runs the captured text sort and separate limit through semantic validation and filtering',()=>{
 const f=fixtures.find((f:any)=>f.id==='W10'),request=parseSemanticRequest(f.text,f.meaning);
 const plan={where:{all:[{field:'productCode',operator:'startsWith',value:'QA-SP'},{field:'name',operator:'ne',value:'Bộ sạc QA'}]},sort:{field:'productCode',direction:'asc'},limit:3,select:['name','productCode']};
 const s=source('product.list',{analysis:plan});
 const {bindings}=bindSemanticRequest(request,request.units.map(u=>({unitId:u.id,targets:[u.kind==='goal'||u.kind==='entity'?'action':u.id==='u3'?'analysis.filters.productCode':u.id==='u4'?'analysis.filters.name':u.id==='u5'?'analysis.sort.productCode':u.id==='u6'?'analysis.limit':u.id==='u7'?'analysis.select.name':'analysis.select.productCode']})),[]);
 expect(validateSemanticPlan(request,bindings,[s])).toEqual({ok:true});
 const rows=[{name:'QA 05',productCode:'QA-SP-005'},{name:'Bộ sạc QA',productCode:'QA-SP-001'},{name:'QA 04',productCode:'QA-SP-004'},{name:'QA 03',productCode:'QA-SP-003'},{name:'QA 06',productCode:'QA-SP-006'},{name:'Other',productCode:'X'}];
 expect(analyzeList(s.operation.analysis!,rows,plan,true).records.map(r=>Object.values(r))).toEqual([['QA 03','QA-SP-003'],['QA 04','QA-SP-004'],['QA 05','QA-SP-005']]);
 const invalid=structuredClone(s);invalid.values.analysis.limit=4;
 expect(validateSemanticPlan(request,bindings,[invalid])).toMatchObject({ok:false});
});

it('normalizes reviewed API monetary text before filtering, keeping names and codes untouched',async()=>{
 const op=operationById('course.list')!;
 const response={courses:[{_id:'qa1',title:'3.000.000',code:'5.000.000',fee:'3.000.000'},{_id:'qa2',title:'Kỹ năng số QA',code:'QA-KH-02',fee:'5.000.000'}],total:2,page:1};
 const result=await collectPublicReadData(op,{},async()=>response,r=>projectRecords(op,r,req));
 expect(result.data[0]).toMatchObject({title:'3.000.000',code:'5.000.000',fee:3000000});
 expect(analyzeList(op.analysis!,result.data,{where:{field:'fee',operator:'gte',value:4000000},select:['title','fee']},true).matched).toBe(1);
});
it.each(['1.23.000','5,000,000','5 triệu','9007199254740992'])('rejects malformed or imprecise monetary text: %s',async fee=>{
 const op=operationById('course.list')!;
 await expect(collectPublicReadData(op,{},async()=>({courses:[{_id:'qa',title:'QA',fee}],total:1,page:1}),r=>projectRecords(op,r,req))).rejects.toThrow();
});

it('aborts a stalled provider at the whole interpretation deadline with the business flag off',async()=>{
 vi.useFakeTimers();vi.stubEnv('ASSISTANT_SAFE_EXECUTION','false');
 let signal:AbortSignal|undefined;
 const transport=vi.fn((s?:AbortSignal)=>{signal=s;return new Promise<never>((_resolve,reject)=>s!.addEventListener('abort',()=>reject(s!.reason),{once:true}));});
 const result=withAssistantInterpretationControl(async()=>{
  await withAssistantRequestControl(1000,transport);
  await withAssistantRequestControl(1000,transport);
 },50);
 const checked=expect(result).rejects.toBeInstanceOf(PlanStoppedError);
 await vi.advanceTimersByTimeAsync(50);await checked;
 expect(signal?.aborted).toBe(true);expect(transport).toHaveBeenCalledTimes(1);
});
it('aborts the actual provider transport and prevents a fallback after the interpretation deadline',async()=>{
 vi.useFakeTimers();vi.stubEnv('ASSISTANT_SAFE_EXECUTION','false');vi.stubEnv('OPENROUTER_API_KEY','fixture-only');
 let signal:AbortSignal|undefined;
 const transport=vi.fn((_url:unknown,init:any)=>{signal=init.signal;return new Promise<never>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));});
 vi.stubGlobal('fetch',transport);
 const result=withAssistantInterpretationControl(()=>openrouterChat({model:'openai/gpt-6-luna',messages:[{role:'user',content:'QA'}],maxRetries:1,timeoutMs:1000}),50);
 const checked=expect(result).rejects.toBeInstanceOf(PlanStoppedError);
 await vi.advanceTimersByTimeAsync(50);await checked;
 expect(signal?.aborted).toBe(true);expect(transport).toHaveBeenCalledTimes(1);
});
it('does not describe an internal routing limit as missing module information',()=>{
 expect(new InterpretationBudgetExceeded().message).not.toMatch(/quá rộng|cho biết phân hệ/);
});
it('aborts optional response wording, preserves the completed reply, and leaves the parent usable',async()=>{
 vi.useFakeTimers();vi.stubEnv('ASSISTANT_SAFE_EXECUTION','false');vi.stubEnv('OPENROUTER_API_KEY','fixture-only');
 let signal:AbortSignal|undefined;
 const transport=vi.fn((_url:unknown,init:any)=>{signal=init.signal;return new Promise<never>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));});
 vi.stubGlobal('fetch',transport);
 const original={status:'completed' as const,reply:'Mình đã tìm được dữ liệu bạn cần.'};
 const result=withAssistantInterpretationControl(async()=>{
  expect(await applyAssistantResponseRules(original,'',{enabled:true})).toEqual(original);
  return withAssistantRequestControl(1000,async()=> 'parent still active');
 },9000);
 const checked=expect(result).resolves.toBe('parent still active');
 await vi.advanceTimersByTimeAsync(8000);await checked;
 expect(signal?.aborted).toBe(true);expect(transport).toHaveBeenCalledTimes(1);
});
it('rejects a field label masquerading as an ordering value before the NLU is cached',()=>{
 const f=fixtures.find((f:any)=>f.id==='W10'),meaning=structuredClone(f.meaning);
 meaning.units.find((u:any)=>u.id==='u5').value='mã';
 expect(()=>parseSemanticRequest(f.text,meaning)).toThrow();
 meaning.units.find((u:any)=>u.id==='u5').value=null;
 expect(()=>parseSemanticRequest(f.text,meaning)).not.toThrow();
});
