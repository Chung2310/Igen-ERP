import {describe,it,expect} from 'vitest';
import {ASSISTANT_OPERATIONS,defaultWorkflow,operationById} from './catalog';
import {collectValues} from './policy';
import {normalizeAssistantInputValues,assistantInputAddress} from './input-contract';
import {analysisFieldAddress,normalizeAnalysisPlan} from './analysis-normalization';
import {analyzeList,validateListAnalysis,type AnalysisContract} from './list-analysis';
import {parseSemanticRequest,bindSemanticRequest,normalizeSemanticInputBindings,normalizeSemanticAnalysisBindings,normalizeSemanticReadProjection,validateSemanticPlan} from './semantic-request';

const contract:AnalysisContract={fields:{
 name:{label:'Họ tên',type:'text',contains:true},
 amount:{label:'Số dư',type:'number'},
 active:{label:'Đang hoạt động',type:'boolean'},
 status:{label:'Trạng thái',type:'text',values:{active:'Đang làm',inactive:'Tạm dừng'}},
 date:{label:'Ngày tạo',type:'text',format:'date'},
},displayFields:['name','amount']};
const rows=[
 {name:'QA An',amount:12,active:true,status:'active',date:'2026-11-27'},
 {name:'QA Bình',amount:20,active:true,status:'active',date:'2026-11-27'},
 {name:'QA Chi',amount:30,active:false,status:'inactive',date:'2026-11-27'},
];

describe('shared action contract compiler',()=>{
 it('normalizes declared key/label spellings without guessing ambiguous fields',()=>{
  const workflow={...defaultWorkflow(operationById('worker.project.update')!),fields:[
   {key:'body_fullName',apiKey:'fullName',source:'body' as const,type:'text' as const,label:'Họ và tên'},
   {key:'query_status',apiKey:'status',source:'query' as const,type:'text' as const,label:'Trạng thái'},
   {key:'body_status',apiKey:'status',source:'body' as const,type:'text' as const,label:'Trạng thái'},
  ]};
  expect(normalizeAssistantInputValues(workflow,{'body.full_name':'QA An','ho va ten':'QA An'})).toEqual({values:{body_fullName:'QA An'},conflicts:[]});
  expect(assistantInputAddress(workflow,'status')).toBeUndefined();
  expect(assistantInputAddress(workflow,'TRẠNG THÁI')).toBeUndefined();
  expect(normalizeAssistantInputValues(workflow,{fullName:'QA An',body_fullName:'QA Bình'}).conflicts).toEqual(['body_fullName']);
 });
 it('keeps required input questions and optional omissions while normalizing scalar wire formats',()=>{
  const workflow={...defaultWorkflow(operationById('worker.project.update')!),fields:[
   {key:'title',label:'Tên',type:'text' as const,required:true},
   {key:'quantity',label:'Số lượng',type:'number' as const,min:1,integer:true},
   {key:'active',label:'Bật',type:'boolean' as const},
   {key:'day',label:'Ngày',type:'date' as const},
   {key:'state',label:'Trạng thái',type:'text' as const,options:['active','inactive']},
   {key:'notes',label:'Ghi chú',type:'text' as const},
  ]};
  const result=collectValues(workflow,{'Số lượng':'12','Bật':'FALSE','Ngày':'27/11/2026','Trạng thái':'ACTIVE'});
  expect(result.errors).toEqual([]);expect(result.missing).toEqual(['Tên']);
  expect(result.values).toEqual({quantity:12,active:false,day:'2026-11-27',state:'active'});
  expect(normalizeAssistantInputValues(workflow,{quantity:12,'Số lượng':'12',day:'2026-11-27','Ngày':'27/11/2026'}).conflicts).toEqual([]);
  expect(result.values).not.toHaveProperty('notes');
  for(const bad of [{quantity:'12 triệu'},{quantity:'1.000'},{quantity:'1,5'},{quantity:'9007199254740993'},{quantity:'0'},{active:'có lẽ'},{day:'31/02/2026'}])expect(collectValues(workflow,bad).errors.length).toBeGreaterThan(0);
 });
 it('does not normalize a free-text code or resolve a record reference',()=>{
  const workflow={...defaultWorkflow(operationById('worker.project.update')!),fields:[{key:'code',label:'Mã',type:'text' as const},{key:'person',label:'Nhân sự',type:'reference' as const,reference:'employee.list'}]};
  expect(normalizeAssistantInputValues(workflow,{code:'000123',person:'QA An'}).values).toEqual({code:'000123',person:'QA An'});
 });
 it('normalizes declared nested item inputs, preserving required questions and reference selection',()=>{
  const workflow={...defaultWorkflow(operationById('inventory.transfer.create')!),fields:[{key:'items',label:'Hàng',type:'json' as const,structure:{type:'array',minItems:1,items:{type:'object',keys:{
   productId:{type:'string',label:'Sản phẩm',reference:'product.list',required:true},quantity:{type:'number',label:'Số lượng',integer:true,min:1,required:true},note:{type:'string',label:'Ghi chú'},
  }}}}]};
  const collected=collectValues(workflow,{items:[{'Sản phẩm':'QA Máy','Số lượng':'2'}]});
  expect(collected.errors).toEqual([]);expect(JSON.parse(String(collected.values.items))).toEqual([{productId:'QA Máy',quantity:2}]);
  expect(JSON.parse(String(collected.values.items))[0]).not.toHaveProperty('note');
  expect(collectValues(workflow,{items:[{'Sản phẩm':'QA Máy'}]}).missing.some(label=>label.endsWith('Mục 1 · Số lượng'))).toBe(true);
  expect(collectValues(workflow,{items:[{productId:'QA Máy',quantity:'2',companyCode:'OTHER'}]}).errors.length).toBeGreaterThan(0);
  expect(normalizeAssistantInputValues(workflow,{items:[{quantity:2,'Số lượng':'3'}]}).conflicts).toEqual(['items']);
 });
 it('combines a legacy AND list with the entire OR/NOT tree, retaining the population',()=>{
  const raw={filters:[{field:'Số dư',operator:'>=',value:'20'}],where:{any:[{field:'Họ tên',operator:'starts_with',value:'QA Bình'},{not:{field:'Trạng thái',operator:'$eq',value:'Đang làm'}}]}};
  expect(analyzeList(contract,rows,raw,true).records.map(r=>r['Họ tên'])).toEqual(['QA Bình','QA Chi']);
  const reverse={...raw,filters:[{field:'amount',operator:'<',value:20}]};
  expect(analyzeList(contract,rows,reverse,true).records).toEqual([]);
  expect(()=>analyzeList(contract,rows,raw,false)).toThrow('Chưa lấy đủ');
 });
 it.each([
  ['startsWith','name','QA A',['QA An']],
  ['endsWith','name','Bình',['QA Bình']],
  ['in','status',['Tạm dừng'],['QA Chi']],
  ['nin','status',['Đang làm'],['QA Chi']],
  ['between','amount',['12','20'],['QA An','QA Bình']],
  ['is_empty','missing',undefined,[]],
 ] as const)('accepts the same %s predicate in a flat filter list', (operator,field,value,expected)=>{
  if(field==='missing'){expect(()=>validateListAnalysis({filters:[{field,operator}]},contract)).toThrow();return;}
  const plan={filters:[{field,operator,...(value!==undefined?{value}: {})}]};
  expect(analyzeList(contract,rows,plan,true).records.map(r=>r['Họ tên'])).toEqual(expected);
 });
 it('handles emptiness and boolean literals without turning unknown cells into false',()=>{
  expect(analyzeList(contract,[...rows,{name:'QA Thiếu'}],{filters:[{field:'active',operator:'is_empty'}]},true).records).toEqual([{'Họ tên':'QA Thiếu','Số dư':'Chưa thiết lập'}]);
  expect(analyzeList(contract,[...rows,{name:'QA Thiếu'}],{filters:[{field:'active',operator:'eq',value:'FALSE'}]},true).records.map(r=>r['Họ tên'])).toEqual(['QA Chi']);
  const labelled={...contract,fields:{...contract.fields,active:{...contract.fields.active,values:{true:'Đang bật',false:'Đã tắt'}}}};
  expect(analyzeList(labelled,rows,{filters:[{field:'active',operator:'eq',value:'Đã tắt'}]},true).records.map(r=>r['Họ tên'])).toEqual(['QA Chi']);
  expect(analyzeList(contract,rows,{filters:[{field:'Ngày tạo',operator:'between',value:['27/11/2026','28/11/2026']}]},true).records).toHaveLength(3);
 });
 it.each([
  {filters:[{field:'password',operator:'eq',value:'x'}]},
  {where:{any:[{field:'name',operator:'contains',value:'QA'},{field:'secret',operator:'eq',value:'x'}]},filters:[{field:'amount',operator:'gt',value:1}]},
  {filters:[{field:'amount',operator:'between',value:[20,12]}]},
  {filters:Array.from({length:21},()=>({field:'name',operator:'startsWith',value:'QA'}))},
  {select:Array.from({length:21},()=> 'name')},
  {where:{field:'name',operator:'eq',value:'QA An'},filters:[{field:'amount',operator:'gt',value:1,ignored:true}]},
 ])('does not discard an invalid or unknown condition: %j',raw=>expect(()=>validateListAnalysis(raw,contract)).toThrow());
 it('refuses ambiguous display names and arbitrary nested wrapper paths',()=>{
  const collision:AnalysisContract={fields:{a:{label:'Trạng thái',type:'text'},b:{label:'Trạng thái',type:'text'}}};
  expect(analysisFieldAddress(collision,'TRẠNG THÁI')).toBeUndefined();
  expect(analysisFieldAddress(contract,'credentials.name')).toBeUndefined();
  expect(analysisFieldAddress(contract,'data.name')).toBe('name');
  expect(()=>validateListAnalysis({filters:[{field:'TRẠNG THÁI',operator:'eq',value:'a'}]},collision)).toThrow();
 });
 it('normalizes projections, sort direction, limits and declared aggregate fields consistently',()=>{
  const raw={select:['Họ tên','name'],sort:{field:'Số dư',direction:'DESCENDING'},limit:'2'};
  expect(analyzeList(contract,rows,raw,true).records).toEqual([{'Họ tên':'QA Chi'},{'Họ tên':'QA Bình'}]);
  expect(analyzeList(contract,rows,{aggregate:{operation:'SUM',field:'Số dư'}},true).records).toEqual([{'Phạm vi':'Tất cả','Tổng số dư':'62'}]);
  expect(normalizeAnalysisPlan(raw,contract)).toEqual(normalizeAnalysisPlan(JSON.stringify(raw),contract));
 });
 it('validates semantic evidence after normalizing both the plan and its bindings',()=>{
  const base=operationById('finance.receivable.by-customer')!;
  const op={...base,analysis:contract},source={operation:op,workflow:defaultWorkflow(op),values:{analysis:{filters:[{field:'Số dư',operator:'>',value:'12'}],select:['Họ tên']}}};
  const request=parseSemanticRequest('Xem họ tên có số dư trên 12',{version:1,units:[{id:'u1',kind:'goal',quote:'Xem',concept:'Tra cứu',operator:'lookup',value:null},{id:'u2',kind:'condition',quote:'số dư trên 12',concept:'Số dư',operator:'gt',value:12,dimension:'numeric'},{id:'u3',kind:'output',quote:'họ tên',concept:'Tên',operator:'none',value:null}]});
  request.actionFitRequired=true;request.approvedActionIds=[op.id];
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['analysis.filters.Số dư']},{unitId:'u3',targets:['result.Họ tên']}],[]);
  normalizeSemanticInputBindings(bindings,[source],request);normalizeSemanticReadProjection(request,bindings,[source]);normalizeSemanticAnalysisBindings(bindings,[source],request.evaluatedAt,request);
  expect(validateSemanticPlan(request,bindings,[source])).toEqual({ok:true});
  expect(analyzeList(contract,rows,source.values.analysis,true).records).toEqual([{'Họ tên':'QA Bình'},{'Họ tên':'QA Chi'}]);
  const changed=structuredClone(request);changed.units[1].operator='lt';expect(validateSemanticPlan(changed,bindings,[source]).ok).toBe(false);
 });
 it('retains evidence for typed nested write inputs while keeping confirmation policy intact',()=>{
  const op={...operationById('inventory.transfer.create')!,fields:[{key:'items',apiKey:'items',source:'body' as const,label:'Hàng',type:'json' as const,structure:{type:'array',items:{type:'object',keys:{quantity:{type:'number',label:'Số lượng',required:true}}}}}]};
  const workflow=defaultWorkflow(op),source={operation:op,workflow,values:normalizeAssistantInputValues(workflow,{items:[{'Số lượng':'2'}]}).values};
  const request=parseSemanticRequest('Tạo phiếu với số lượng 2',{version:1,units:[{id:'u1',kind:'goal',quote:'Tạo',concept:'Tạo phiếu',operator:'create',value:null},{id:'u2',kind:'input',quote:'số lượng 2',concept:'Số lượng',operator:'eq',value:'2',dimension:'numeric'}]});
  request.actionFitRequired=true;request.approvedActionIds=[op.id];
  const {bindings}=bindSemanticRequest(request,[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.body.items.0.Số lượng']}],[]);
  normalizeSemanticInputBindings(bindings,[source],request);
  expect(bindings.get('u2')).toEqual(['values.items.0.quantity']);
  expect(validateSemanticPlan(request,bindings,[source])).toEqual({ok:true});
  expect(workflow.requireConfirmation).toBe(true);
  const changed=structuredClone(request);changed.units[1].value='3';expect(validateSemanticPlan(changed,bindings,[source]).ok).toBe(false);
 });
 it('applies the same schema normalization to the actual catalog across modules',()=>{
  const modules=new Set<string>();let checked=0;
  for(const operation of ASSISTANT_OPERATIONS){
   const workflow=defaultWorkflow(operation);modules.add(operation.module);
   for(const field of workflow.fields){
    if(field.reference||!['number','boolean'].includes(field.type))continue;
    const raw=field.type==='number'?'12':'false',expected=field.type==='number'?12:false;
    const normalized=normalizeAssistantInputValues(workflow,{[field.key]:raw});
    expect(normalized.values[field.key],operation.id+':'+field.key).toBe(expected);checked++;
   }
   if(operation.analysis)for(const key of Object.keys(operation.analysis.fields))expect(analysisFieldAddress(operation.analysis,key)).toBe(key);
  }
  expect(modules.size).toBeGreaterThan(15);expect(checked).toBeGreaterThan(100);
 });
});
