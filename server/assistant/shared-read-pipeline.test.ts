import { describe, expect, it } from 'vitest';
import { analyzeList, assertAnalysisCohort, listAnalysisPlanSchema, selectAnalysisCohortRows, validateListAnalysis, type AnalysisContract } from './list-analysis';
import { operationById, defaultWorkflow } from './catalog';
import { bindSemanticRequest, parseSemanticRequest, validateSemanticPlan, type SemanticSource } from './semantic-request';
import { inheritReadConstraints, validInheritedReadCohort } from './read-dialogue';
import { validateCompositeQueryPlan } from './composite-query';
import {readCohortDigest,bindReadRowIdentity} from './read-cohort';
import {canonicalAnalysisTarget} from './analysis-normalization';
import {compileSemanticResolutions} from './semantic-compilation';

const contract: AnalysisContract = { fields: {
  person: { label: 'Tên', type: 'text', contains: true },
  team: { label: 'Nhóm', type: 'text', contains: true },
  amount: { label: 'Giá trị', type: 'number' },
  day: { label: 'Ngày', type: 'text', format: 'date' },
} };
const rows = [
  { person: 'QA An', team: 'A', amount: 8, day: '2026-11-01' },
  { person: 'QA An', team: 'A', amount: 7, day: '2026-11-02' },
  { person: 'QA Bình', team: 'B', amount: 10, day: '2026-11-01' },
  { person: 'QA Chi', team: 'C', amount: 15, day: '2026-11-01' },
];
const grouped = { groupBy: 'person', aggregate: { operation: 'sum', field: 'amount' } };
const source = (analysis:unknown):SemanticSource => {
  const operation={...operationById('partner.analysis')!,analysis:contract,resultFields:Object.keys(contract.fields)};
  return {operation,workflow:defaultWorkflow(operation),values:{analysis}};
};

describe('shared source -> aggregation -> having -> ranking pipeline', () => {
  it.each(['employee.list','student.list','retail.order.list','worker.list'])('runs count/having/ranking on the real %s contract', id => {
    const operation=operationById(id)!,c=operation.analysis!;
    expect(c).toBeDefined();
    const [dimension,definition]=Object.entries(c.fields).find(([,field])=>['text','scalar'].includes(field.type)&&field.format!=='date'&&(!field.values||Object.keys(field.values).length>=2))!;
    const [a,b]=definition.values?Object.keys(definition.values):['QA A','QA B'];
    const result=analyzeList(c,[{[dimension]:a},{[dimension]:b},{[dimension]:a}],{groupBy:dimension,aggregate:{operation:'count'},having:{field:'count',operator:'gte',value:2},sort:{field:'count',direction:'desc'},limit:1},true);
    expect(result.matched).toBe(1);expect(result.records).toHaveLength(1);expect(result.records[0]['Số lượng']).toBe('2');
  });
  it('sums before applying top-N instead of taking the largest source row', () => {
    const result=analyzeList(contract,rows,{...grouped,sort:{field:'sum_amount',direction:'desc'},limit:1},true);
    expect(result.matched).toBe(3);expect(result.records).toEqual([{'Tên':'QA An','Tổng giá trị':'15'}]);
  });
  it('keeps all groups tied at the maximum, even if limit=1', () => {
    expect(analyzeList(contract,rows,{...grouped,extreme:{field:'sum_amount',direction:'max'},limit:1},true).records.map(row=>row['Tên'])).toEqual(['QA An','QA Chi']);
  });
  it('filters source rows before grouping and preserves OR/NOT in having', () => {
    const result=analyzeList(contract,rows,{...grouped,where:{field:'day',operator:'gte',value:'2026-11-02'},having:{any:[{field:'sum_amount',operator:'gte',value:7},{not:{field:'sum_amount',operator:'gt',value:0}}]}},true);
    expect(result.records).toEqual([{'Tên':'QA An','Tổng giá trị':'7'}]);
  });
  it('supports several typed measures without sorting localized numeric strings', () => {
    const result=analyzeList(contract,[...rows,{person:'QA Lớn',team:'D',amount:1000}],{groupBy:'team',aggregates:[{operation:'count'},{operation:'sum',field:'amount'},{operation:'avg',field:'amount'}],sort:{field:'sum_amount',direction:'desc'},limit:1},true);
    expect(result.records[0]).toEqual({'Nhóm':'D','Số lượng':'1','Tổng giá trị':'1.000','Trung bình giá trị':'1.000'});
  });
  it('normalizes an unambiguous source metric for aggregate ordering', () => {
    expect(validateListAnalysis({...grouped,sort:{field:'Giá trị',direction:'descending'}},contract).sort).toEqual({field:'sum_amount',direction:'desc'});
  });
  it('normalizes declared aggregate labels and source metric spellings in both plans and semantic targets',()=>{
    const plan=validateListAnalysis({...grouped,having:{field:'Giá trị',operator:'>=',value:'10'},sort:{field:'amount',direction:'desc'}},contract);
    expect(plan.having).toEqual({field:'sum_amount',operator:'gte',value:10});
    expect(canonicalAnalysisTarget(contract,'analysis.having.Tổng giá trị',plan)).toBe('analysis.having.sum_amount');
    expect(canonicalAnalysisTarget(contract,'analysis.sort.Giá trị',plan)).toBe('analysis.sort.sum_amount');
  });
  it('rejects ambiguous ordering when sum and average share a source field', () => {
    expect(()=>validateListAnalysis({groupBy:'team',aggregates:[{operation:'sum',field:'amount'},{operation:'avg',field:'amount'}],sort:{field:'amount',direction:'desc'}},contract)).toThrow();
  });
  it('keeps typed grouping values separate when their public labels coincide', () => {
    const c:AnalysisContract={fields:{state:{label:'Trạng thái',type:'text',values:{a:'Đã xử lý',b:'Đã xử lý'}}}};
    expect(analyzeList(c,[{state:'a'},{state:'b'}],{groupBy:'state',aggregate:{operation:'count'}},true).records).toHaveLength(2);
  });
  it.each([
    {...grouped,having:{field:'password',operator:'eq',value:'x'}},
    {...grouped,having:{field:'avg_amount',operator:'gt',value:0}},
    {...grouped,sort:{field:'secret',direction:'desc'}},
    {...grouped,having:{field:'sum_amount',operator:'gt',value:'abc'}},
    {having:{field:'count',operator:'gt',value:1}},
    {...grouped,includeRows:true,select:['person']},
  ])('rejects undeclared/missing aggregate outputs or invalid combinations %#', plan => {
    expect(()=>analyzeList(contract,rows,plan,true)).toThrow();
  });
  it('does not conclude from a partial source or overflow', () => {
    expect(()=>analyzeList(contract,rows,{...grouped,limit:1},false)).toThrow('Chưa lấy đủ');
    expect(()=>analyzeList(contract,[{person:'QA',amount:1e308},{person:'QA',amount:1e308}],grouped,true)).toThrow('giới hạn số');
  });
  it('keeps an empty global count distinct from a missing numeric measure', () => {
    expect(analyzeList(contract,[],{aggregates:[{operation:'count'},{operation:'sum',field:'amount'}]},true).records).toEqual([{'Phạm vi':'Tất cả','Số lượng':'0','Tổng giá trị':'Không có dữ liệu'}]);
  });
  it('publishes having/ranking grammar but keeps within out of model inputs', () => {
    const schema=listAnalysisPlanSchema(contract);
    expect(schema.properties.having).toBeDefined();expect(schema.properties.sort.properties.field.enum).toContain('sum_amount');expect(schema.properties).not.toHaveProperty('within');
  });
});

describe('semantic grounding of post-aggregation conditions', () => {
  const text='Đếm theo nhóm, chỉ nhóm có ít nhất 2 người, lấy nhóm đông nhất';
  const request=()=>parseSemanticRequest(text,{version:1,units:[
    {id:'u1',kind:'aggregate',quote:'Đếm',concept:'Số người',operator:'count',value:null},
    {id:'u2',kind:'group',quote:'theo nhóm',concept:'Nhóm',operator:'none',value:null},
    {id:'u3',kind:'condition',quote:'ít nhất 2 người',concept:'Số người',operator:'gte',value:2},
    {id:'u4',kind:'ordering',quote:'đông nhất',concept:'Số người',operator:'max',dimension:'numeric',value:null},
  ]});
  const bindings=()=>bindSemanticRequest(request(),[
    {unitId:'u1',targets:['analysis.aggregate.count']},{unitId:'u2',targets:['analysis.groupBy.team']},
    {unitId:'u3',targets:['analysis.having.count']},{unitId:'u4',targets:['analysis.extreme.count']},
  ],[]).bindings;
  it('accepts a grounded group threshold and aggregate maximum', () => {
    expect(validateSemanticPlan(request(),bindings(),[source({groupBy:'team',aggregate:{operation:'count'},having:{field:'count',operator:'gte',value:2},extreme:{field:'count',direction:'max'}})])).toEqual({ok:true});
  });
  it('accepts reviewed natural top ordering on aggregate outputs without weakening threshold checks',()=>{
    const r=request(),s=source({groupBy:'team',aggregate:{operation:'count'},having:{field:'count',operator:'gte',value:2},sort:{field:'count',direction:'desc'}}),b=bindings();
    b.set('u4',['analysis.sort.count']);
    compileSemanticResolutions(r,[s],b,[{unitId:'u4',actionId:s.operation.id,role:'ordering',target:'analysis.sort.count',predicates:[]}]);
    expect(validateSemanticPlan(r,b,[s])).toEqual({ok:true});
  });
  it('rejects a changed threshold and an unrequested hidden having condition', () => {
    for(const having of [{field:'count',operator:'gte',value:3},{all:[{field:'count',operator:'gte',value:2},{field:'count',operator:'lt',value:10}]}]){
      expect(validateSemanticPlan(request(),bindings(),[source({groupBy:'team',aggregate:{operation:'count'},having,extreme:{field:'count',direction:'max'}})])).toMatchObject({ok:false});
    }
  });
});

describe('private same-source read cohorts', () => {
  const request=()=>parseSemanticRequest('Trong nhóm đó ai có giá trị trên 9?',{version:1,dialogue:{act:'followup',evidence:'Trong nhóm đó'},units:[{id:'u1',kind:'condition',quote:'giá trị trên 9',concept:'Giá trị',operator:'gt',value:9}]});
  const previous={sort:{field:'amount',direction:'desc'},limit:2} as const;
  const setup=()=>{const r=request(),s=source({filters:[{field:'amount',operator:'gt',value:9}]});r.readContinuation={scope:'private',actionId:s.operation.id,version:s.workflow.version,text:'Top 2',values:{analysis:previous},cohortDigest:readCohortDigest(selectAnalysisCohortRows(contract,rows,previous,true))};return {r,s};};
  it('reconstructs the previous top set before adding a new filter', () => {
    const {r,s}=setup();inheritReadConstraints(r,[s]);
    expect(validInheritedReadCohort(r,s,validateListAnalysis(s.values.analysis,contract))).toBe(true);
    expect(analyzeList(contract,rows,s.values.analysis,true).records.map(row=>row['Tên'])).toEqual(['QA Chi','QA Bình']);
    expect(validateSemanticPlan(r,new Map([['u1',['analysis.filters.amount']]]),[s])).toEqual({ok:true});
  });
  it('retains members of selected aggregate groups for a detail followup', () => {
    const plan={...grouped,sort:{field:'sum_amount',direction:'desc'},limit:1};
    expect(selectAnalysisCohortRows(contract,rows,plan,true)).toEqual(rows.slice(0,2));
    expect(analyzeList(contract,rows,{within:plan,select:['person','day']},true).records).toHaveLength(2);
  });
  it('rejects fabricated cohorts without server conversation state', () => {
    const s=source({within:previous});expect(validateSemanticPlan(request(),new Map([['u1',['analysis.filters.amount']]]),[s])).toMatchObject({ok:false});
  });
  it('rejects changed source/version and bounds chained selections', () => {
    const {r,s}=setup();inheritReadConstraints(r,[s]);
    r.readContinuation!.version++;expect(validInheritedReadCohort(r,s,validateListAnalysis(s.values.analysis,contract))).toBe(false);
    expect(()=>validateListAnalysis({within:{within:{within:{within:{}}}}},contract)).toThrow('quá dài');
  });
  it('detects membership changes, not a simple reorder or updated public value of the same identified records',()=>{
    const first=[{name:'QA A',amount:10},{name:'QA B',amount:20}];first.forEach((row,i)=>bindReadRowIdentity(row,'private-'+i));
    const next=[{name:'QA B',amount:25},{name:'QA A',amount:11}];next.forEach((row,i)=>bindReadRowIdentity(row,'private-'+(1-i)));
    expect(readCohortDigest(first)).toBe(readCohortDigest(next));
    expect(readCohortDigest(first)).not.toBe(readCohortDigest(next.slice(0,1)));
    expect(JSON.stringify(first)).not.toContain('private-');
  });
  it('stops a changed top cohort rather than silently answering about different members',()=>{
    const digest=readCohortDigest(selectAnalysisCohortRows(contract,rows,previous,true));
    expect(()=>assertAnalysisCohort(contract,[...rows,{person:'QA Mới',amount:100}],{within:previous},true,digest)).toThrow('đã thay đổi');
    expect(()=>assertAnalysisCohort(contract,rows,{within:previous},false,digest)).toThrow('Chưa lấy đủ');
  });
});

it('accepts only measures grounded in the selected authorized composite source',()=>{
  const op=operationById('partner.analysis')!,workflow=defaultWorkflow(op);
  const query={actionId:op.id,purpose:'Tổng hợp',values:{analysis:{groupBy:'name',aggregate:{operation:'sum',field:'totalCommission'},sort:{field:'sum_totalCommission',direction:'desc'},limit:5}},resultFields:['name','sum_totalCommission']};
  expect(validateCompositeQueryPlan([query],[workflow])).toMatchObject({ok:true});
  expect(validateCompositeQueryPlan([query],[{...workflow,enabled:false}])).toMatchObject({ok:false});
  expect(validateCompositeQueryPlan([{...query,resultFields:['sum_password']}],[workflow])).toMatchObject({ok:false});
});
