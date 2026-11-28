import {afterEach,describe,expect,it,vi} from 'vitest';
import {ASSISTANT_OPERATIONS,defaultWorkflow,operationById} from './catalog';
import {assistantInputAddress,normalizeAssistantInputValues} from './input-contract';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan,normalizeSemanticInputBindings,attachSemanticProof} from './semantic-request';
import {compileSemanticResolutions} from './semantic-compilation';
import {verifiedSemanticContexts,matchesSemanticExecutionContext} from './semantic-execution-context';
import {needsAssistantReferenceInput} from './collection-form';
import {collectValues} from './policy';

afterEach(()=>vi.unstubAllEnvs());
const source=(id:string,values:Record<string,unknown>={})=>({operation:operationById(id)!,workflow:defaultWorkflow(operationById(id)!),values});
describe('shared flexible planning boundary across the complete registry',()=>{
 it('aligns an abbreviated evidence quote only to a unique span of words actually supplied',()=>{
  const text='Có bao nhiêu đối tác tuyển sinh đang hoạt động và bao nhiêu đối tác đang tạm dừng';
  const request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'output',quote:'bao nhiêu đối tác đang hoạt động và bao nhiêu đối tác đang tạm dừng',concept:'Số lượng theo trạng thái',operator:'none',value:null}]});
  expect(request.units[0].quote).toBe(text.slice(3));
  expect(()=>parseSemanticRequest('Tổng đã trả 12000000',{version:1,units:[{id:'u1',kind:'output',quote:'Tổng đã trả 13000000',concept:'Tiền',operator:'none',value:null}]})).toThrow();
  const ambiguous='xem các hồ sơ của A, xem các hồ sơ của B';
  expect(()=>parseSemanticRequest(ambiguous,{version:1,units:[{id:'u1',kind:'output',quote:'xem hồ sơ',concept:'Hồ sơ',operator:'none',value:null}]})).toThrow();
 });
 it('normalizes multi-source action shorthand without guessing an ambiguous source',()=>{
  const sources=[source('student.list'),source('worker.list')],bindings=new Map([['u1',['query:student.list','context.module']],['u2',['query:worker.list','context.module']],['u3',['context.module']]]);
  normalizeSemanticInputBindings(bindings,sources);
  expect(bindings.get('u1')).toEqual(['query:student.list:action','query:student.list:context.module']);
  expect(bindings.get('u2')).toEqual(['query:worker.list:action','query:worker.list:context.module']);
  expect(bindings.get('u3')).toEqual(['context.module']);
 });
 it('lets every available action reach input collection without inventing missing required values',()=>{
  const operations=ASSISTANT_OPERATIONS.filter(op=>!op.unavailableReason);
  expect(operations.length).toBeGreaterThan(1000);
  for(const op of operations){
   const text=`Thực hiện ${op.title}`,request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:text,concept:op.title,operator:op.method==='GET'||op.readOnly?'lookup':'process',value:null}]});
   request.actionFitRequired=true;request.approvedActionIds=[op.id];
   const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']}],[]);
   expect(validateSemanticPlan(request,bindings,[source(op.id)]),op.id).toEqual({ok:true});
   const workflow=defaultWorkflow(op),result=collectValues(workflow,{});
   for(const field of workflow.fields.filter(f=>!f.required&&!f.systemRequired&&!f.requiredWhen&&!f.defaultValue)){
    expect(result.missing,op.id+':'+field.key).not.toContain(field.label);
    if(field.reference)expect(needsAssistantReferenceInput(false,false,false,true)).toBe(false);
   }
  }
 });
 it('canonicalizes unique API aliases throughout the registry and leaves ambiguous aliases unresolved',()=>{
  for(const op of ASSISTANT_OPERATIONS){
   const workflow=defaultWorkflow(op);
   for(const field of workflow.fields){
    expect(assistantInputAddress(workflow,field.key)?.canonical,op.id+':'+field.key).toBe(field.key);
    if(field.apiKey&&workflow.fields.filter(f=>f.apiKey===field.apiKey).length===1&&!workflow.fields.some(f=>f.key===field.apiKey&&f.key!==field.key)){
     expect(normalizeAssistantInputValues(workflow,{[field.apiKey]:'QA'}).values,op.id+':'+field.apiKey).toEqual({[field.key]:'QA'});
    }
   }
  }
  const workflow=defaultWorkflow(operationById('student.list')!);
  workflow.fields=[{key:'path_id',apiKey:'id',source:'path',label:'Hồ sơ',type:'text'},{key:'query_id',apiKey:'id',source:'query',label:'Bộ lọc',type:'text'}];
  expect(assistantInputAddress(workflow,'id')).toBeUndefined();
  expect(normalizeAssistantInputValues(workflow,{id:'QA'}).values).toEqual({id:'QA'});
  expect(normalizeAssistantInputValues(workflow,{path_id:'A',path_id_unused:'X',id:'B'}).values).toMatchObject({path_id:'A',id:'B'});
  expect(normalizeAssistantInputValues(workflow,{path_id:'A',path_id_alias:'X'}).values).toHaveProperty('path_id_alias');
  const reserved=normalizeAssistantInputValues(workflow,JSON.parse('{"__proto__":{"name":"hacked"}}'));
  expect(reserved.conflicts).toEqual(['__proto__']);expect(Object.getPrototypeOf(reserved.values)).toBeNull();expect(({} as any).name).toBeUndefined();
 });
 it.each(['worker.create','student.create','employee.update','customer.create','worker.delete','resource.google-drive.move'])('accepts a reviewed scalar assignment irrespective of NLU kind: %s',id=>{
  const s=source(id),field=s.workflow.fields.find(f=>f.reference||f.type==='text'&&!f.structure&&!f.options);
  expect(field,id).toBeDefined();if(!field)return;
  s.values[field.key]='QA Hồ sơ';
  const read=s.operation.method==='GET'||s.operation.readOnly,text='Thực hiện với QA Hồ sơ';
  const request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:'Thực hiện',concept:'Thực hiện',operator:read?'lookup':'process',value:null},{id:'u2',kind:'condition',quote:'QA Hồ sơ',concept:'Giá trị người dùng muốn điền',operator:'eq',value:'QA Hồ sơ'}]});
  request.actionFitRequired=true;request.approvedActionIds=[id];
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:[`values.${field.apiKey||field.key}`]}],[]);
  normalizeSemanticInputBindings(bindings,[s]);
  compileSemanticResolutions(request,[s],bindings,[{unitId:'u2',actionId:id,role:'input_assignment',target:`values.${field.key}`,predicates:[]}]);
  expect(validateSemanticPlan(request,bindings,[s]),id).toEqual({ok:true});
  expect(validateSemanticPlan(request,bindings,[{...s,values:{[field.key]:'QA Khác'}}])).toMatchObject({ok:false});
  request.units[1].operator='gt';expect(validateSemanticPlan(request,bindings,[s])).toMatchObject({ok:false});
 });
 it('issues private semantic context only for an intact proof, bound to intent and current contract',()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const s=source('student.list'),text='Xem học viên',request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'goal',quote:text,concept:text,operator:'lookup',value:null}]});
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']}],[]);
  const result=attachSemanticProof({actionId:s.operation.id},request,bindings);
  const [context]=verifiedSemanticContexts(result,[s],text);
  expect(matchesSemanticExecutionContext(context,s.workflow,text)).toBe(true);
  expect(verifiedSemanticContexts(JSON.parse(JSON.stringify(result)),[s],text)).toEqual([]);
  expect(matchesSemanticExecutionContext(context,s.workflow,'Xóa học viên')).toBe(false);
  expect(matchesSemanticExecutionContext(context,{...s.workflow,version:s.workflow.version+1},text)).toBe(false);
  expect(matchesSemanticExecutionContext(context,{...s.workflow,enabled:false},text)).toBe(false);
  expect(()=>verifiedSemanticContexts(result,[{...s,values:{search:'unrequested'}}],text)).toThrow();
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','false');expect(matchesSemanticExecutionContext(context,s.workflow,text)).toBe(false);
 });
 it('keeps required, explicitly requested and unresolved references in the selection flow',()=>{
  expect(needsAssistantReferenceInput(true,false,false,true)).toBe(true);
  expect(needsAssistantReferenceInput(false,true,false,true)).toBe(true);
  expect(needsAssistantReferenceInput(false,false,true,false)).toBe(true);
  expect(needsAssistantReferenceInput(false,false,false,true)).toBe(false);
 });
});
