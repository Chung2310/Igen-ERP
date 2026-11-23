import {expect,it} from 'vitest';
import {READ_RELATIONS,collectRelationRows,renderReadRelation,relationEvidenceSupported,validateReadRelations} from './read-relations';
import {defaultWorkflow,operationById} from './catalog';
import {moduleFixture} from './testing/worker-live-preview-v2/module-scenarios';
import {validateRequestCoverage,findUncoveredRequestTerms} from './request-coverage';
import {validateCompositeQueryPlan,validateCompositeRequestCoverage} from './composite-query';
import {parseAssistantResultTable} from '../../src/shared/assistant-result-table';
const relation=READ_RELATIONS.find(item=>item.kind==='tuition-balance')!;
const workflows=[relation.left.actionId,relation.right.actionId].map(id=>defaultWorkflow(operationById(id)!));
const queries=workflows.map((workflow,index)=>({actionId:workflow.actionId,purpose:'Đối chiếu học phí',values:{},resultFields:[index?'amount':'fullName'],...(index?{}:{relation:relation.id})}));
it('ignores conversational filler in a follow-up without dropping universal or payment conditions',()=>{
  const text='vậy là tất cả học viên đều đã đóng học phí rồi hả';
  expect(findUncoveredRequestTerms(text,[{evidence:'tất cả học viên đều đã đóng học phí'}])).toEqual([]);
  expect(findUncoveredRequestTerms(text,[{evidence:'học viên đóng học phí'}])).toEqual(expect.arrayContaining(['tất','cả','đều','đã']));
  expect(findUncoveredRequestTerms('vậy xem học viên tại Hà Nội hả',[{evidence:'xem học viên'}])).toEqual(expect.arrayContaining(['Hà','Nội']));
});
it('normalizes one registered relation annotated on both sources without accepting an extra source or filter',()=>{
  const duplicated=queries.map(query=>({...query,relation:relation.id}));
  const plan=validateCompositeQueryPlan(duplicated,workflows);
  expect(plan).toMatchObject({ok:true});
  if(!plan.ok) throw new Error('Invalid test plan');
  expect(plan.queries.filter(query=>query.relation)).toHaveLength(1);
  const text='học viên nào còn nợ học phí';
  expect(validateCompositeRequestCoverage(text,[{evidence:text,requirement:'Dư nợ',mappedTo:['query:student.list:relation','query:student.payment.list:relation']}],plan.queries,workflows)).toEqual({ok:true});
  expect(validateCompositeRequestCoverage(text,[{evidence:text,requirement:'Dư nợ',mappedTo:['query:student.payment.list:relation']}],plan.queries,workflows)).toEqual({ok:true});
  expect(validateCompositeQueryPlan([...duplicated,duplicated[0]],workflows)).toMatchObject({ok:false});
  expect(validateCompositeQueryPlan([duplicated[0],{...duplicated[1],values:{query_startDate:'2026-11-01'}}],workflows)).toMatchObject({ok:false});
});
it('never substitutes a student profile status for computed debt, including unsupported periods',()=>{
  const op=operationById('student.list')!;
  for(const text of ['học viên nào còn nợ học phí','học viên còn nợ học phí tháng 11']) {
    expect(validateRequestCoverage(text,[{evidence:text,requirement:'Học phí',mappedTo:['values.status']}],defaultWorkflow(op),op,{status:'Nợ học phí'})).toMatchObject({ok:false});
  }
});
async function sources() {
  const result=new Map<string,Record<string,unknown>[]>();
  for(const source of [relation.left,relation.right]) {
    const op=operationById(source.actionId)!;
    const read=(values:Record<string,unknown>)=>{
      const url=new URL('http://fixture/api/v1'+op.path);
      for(const field of op.fields) if(field.apiKey&&values[field.key]!==undefined) url.searchParams.set(field.apiKey,String(values[field.key]));
      return moduleFixture(url);
    };
    result.set(source.actionId,await collectRelationRows(source,op,read({}),{},async values=>read(values)));
  }
  return result;
}
it('reproduces the false-empty status lookup, then computes debt from all student and payment pages',async()=>{
  expect((moduleFixture(new URL('http://fixture/api/v1/students?status=Nợ học phí')) as any).students).toHaveLength(0);
  const data=await sources();
  expect(data.get('student.list')).toHaveLength(5);
  expect(data.get('student.payment.list')).toHaveLength(3);
  const reply=renderReadRelation(relation.id,data);
  for(const suffix of ['A','C','E']) expect(reply).toContain('HOC-VIEN-NO-QA-'+suffix);
  for(const suffix of ['B','D']) expect(reply).not.toContain('HOC-VIEN-NO-QA-'+suffix);
  expect(reply).toContain('2.000.000');expect(reply).toContain('3.000.000');
  expect(parseAssistantResultTable(reply)?.rows.map(row=>row.values)).toEqual([
    {'Học viên':'HOC-VIEN-NO-QA-A','Tổng học phí':'5.000.000 ₫','Đã đóng':'3.000.000 ₫','Còn nợ':'2.000.000 ₫'},
    {'Học viên':'HOC-VIEN-NO-QA-C','Tổng học phí':'3.000.000 ₫','Đã đóng':'1.000.000 ₫','Còn nợ':'2.000.000 ₫'},
    {'Học viên':'HOC-VIEN-NO-QA-E','Tổng học phí':'3.000.000 ₫','Đã đóng':'0 ₫','Còn nợ':'3.000.000 ₫'},
  ]);
  expect(reply).not.toContain('000000000000000000000a28');
  expect(renderReadRelation(relation.id,data,'vậy là tất cả học viên đều đã đóng học phí rồi hả')).toContain('Chưa phải tất cả');
});
it('stops incomplete financial paging before making a twenty-fifth request',async()=>{
  const operation=operationById('student.list')!;
  const pageField=operation.fields.find(field=>field.apiKey==='page')!;
  const requested:number[]=[];
  const page=(n:number)=>({students:[{_id:`student-${n}`}],total:25,page:n,limit:1});
  await expect(collectRelationRows(relation.left,operation,page(1),{},async values=>{
    const next=Number(values[pageField.key]); requested.push(next); return page(next);
  })).rejects.toThrow('giới hạn số trang');
  expect(requested).toEqual(Array.from({length:23},(_,index)=>index+2));
});
it('requires complete same-scope sources, rejects date/status subsets and unsupported negative intent',()=>{
  expect(validateReadRelations(queries,workflows)).toBe(true);
  expect(validateReadRelations(queries,[workflows[0]])).toBe(false);
  expect(validateReadRelations([{...queries[0],values:{status:'Nợ học phí'}},queries[1]],workflows)).toBe(false);
  expect(validateReadRelations([queries[0],{...queries[1],values:{query_startDate:'2026-11-01'}}],workflows)).toBe(false);
  expect(relationEvidenceSupported('học viên nào còn nợ học phí?',relation.id)).toBe(true);
  expect(relationEvidenceSupported('học viên nào không còn nợ học phí?',relation.id)).toBe(false);
  expect(relationEvidenceSupported('học viên còn nợ học phí tháng 11',relation.id)).toBe(false);
});
it('does not turn missing or malformed financial data into a no-debt conclusion',async()=>{
  const data=await sources();
  const bad=new Map(data); bad.set('student.payment.list',[{_id:'p1',studentId:'s1'}]);
  expect(()=>renderReadRelation(relation.id,bad)).toThrow('thiếu số tiền');
  bad.set('student.payment.list',[{_id:'p1',studentId:'s1',amount:-1}]);
  expect(()=>renderReadRelation(relation.id,bad)).toThrow('Số tiền');
  bad.set('student.payment.list',[]); bad.set('student.list',[{_id:'s1',fullName:'QA'}]);
  expect(()=>renderReadRelation(relation.id,bad)).toThrow('thiếu học phí');
  bad.set('student.list',[{_id:'s1',fullName:'QA-MIEN-PHI',fee:'0',paidAmount:0}]);
  expect(renderReadRelation(relation.id,bad,'tất cả đã đóng học phí')).toContain('không đồng nghĩa');
  await expect(collectRelationRows(relation.left,operationById('student.list')!,{students:[],page:1,limit:2},{},async()=>({}))).rejects.toThrow();
});
