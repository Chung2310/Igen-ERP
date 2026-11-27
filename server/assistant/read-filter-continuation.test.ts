import {describe,it,expect} from 'vitest';
import {operationById,defaultWorkflow} from './catalog';
import {projectRecords} from './executor';
import {collectPublicReadData} from './public-read-query';
import {analyzeList,type AnalysisContract} from './list-analysis';
import {formatAssistantResultTable,parseAssistantResultTable} from '../../src/shared/assistant-result-table';
import {readFileSync} from 'node:fs';
import {parseSemanticRequest,bindSemanticRequest,validateSemanticPlan} from './semantic-request';
import {compileSemanticResolutions} from './semantic-compilation';

const req:any={user:{id:'64b000000000000000000001',companyCode:'QA',branchId:'64b000000000000000000002',role:'admin'}};
describe('cross-module read source regressions',()=>{
  it('reads the declared Drive files envelope using its approved child fields',async()=>{
    const op=operationById('api.get.8d100f7d89820c43')!;
    const response={data:{files:[{id:'fake-drive-id',name:'QA.pdf',mimeType:'application/pdf',size:'1200',password:'PRIVATE',appProperties:{token:'PRIVATE'}}]}};
    const result=await collectPublicReadData(op,{},async()=>response,r=>projectRecords(op,r,req),{allowPartialRows:true});
    expect(result).toEqual({analysisComplete:false,data:[{name:'QA.pdf',mimeType:'application/pdf',size:1200}]});
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(analyzeList(op.analysis!,result.data,{where:{field:'size',operator:'gt',value:1000}},true).matched).toBe(1);
  });
  it.each(['1.5','NaN','9007199254740992'])('does not coerce malformed or imprecise declared numeric text: %s',async size=>{
    const op=operationById('api.get.8d100f7d89820c43')!;
    await expect(collectPublicReadData(op,{},async()=>({files:[{name:'QA',size}]}),r=>projectRecords(op,r,req),{allowPartialRows:true})).rejects.toThrow();
  });
  it('does not read another collection when the declared source is missing or ambiguous',async()=>{
    const op=operationById('api.get.8d100f7d89820c43')!;
    for(const response of [{data:{items:[{name:'Wrong'}]}},{files:[{name:'A'}],data:{files:[{name:'B'}]}}]){
      await expect(collectPublicReadData(op,{},async()=>response,r=>projectRecords(op,r,req),{allowPartialRows:true})).rejects.toThrow();
    }
    const response={data:{items:[{name:'Wrong'}],files:[{name:'Correct'}]}};
    const result=await collectPublicReadData(op,{},async()=>response,r=>projectRecords(op,r,req),{allowPartialRows:true});
    expect(result.data).toEqual([{name:'Correct'}]);
  });
  it('keeps every selected repair value when legacy input labels are generic',()=>{
    const op=operationById('repair.list')!;
    const result=analyzeList(op.analysis!,[{ticketCode:'QA-R1',technicianName:'QA Kỹ thuật',receivedAt:'2026-11-26T02:00:00Z'}],{select:['ticketCode','technicianName','receivedAt']},true);
    expect(Object.keys(result.records[0])).toHaveLength(3);
    expect(Object.values(result.records[0])).toContain('QA Kỹ thuật');
    expect(Object.values(result.records[0])).toContain('09:00, 26/11/2026');
  });
  it('uses the same normalized text comparisons in old and new filter grammars',()=>{
    const c:AnalysisContract={fields:{name:{label:'Tên',type:'text',contains:true}}};
    const rows=[{name:'Đặng  Ánh'},{name:'Khác'}],p={field:'name',operator:'eq',value:'DANG ANH'};
    expect(analyzeList(c,rows,{filters:[p]},true)).toEqual(analyzeList(c,rows,{where:p},true));
  });
  it('does not overwrite independent count aggregates',()=>{
    const c:AnalysisContract={fields:{name:{label:'Tên',type:'text'},email:{label:'Email',type:'text'}}};
    const result=analyzeList(c,[{name:'QA A',email:'qa@example.test'},{name:'QA B',email:''}],{aggregates:[{operation:'count',field:'name'},{operation:'count',field:'email'}]},true);
    expect(Object.keys(result.records[0])).toHaveLength(3);
    expect(Object.values(result.records[0])).toContain('2');
    expect(Object.values(result.records[0])).toContain('1');
  });
  it('keeps colliding labels distinct after the shared table parser trims headers',()=>{
    const c:AnalysisContract={fields:{a:{label:'X (c)',type:'text'},b:{label:'X',type:'text'},c:{label:'X',type:'text'}}};
    const result=analyzeList(c,[{a:'A',b:'B',c:'C'}],{},true);
    const table=parseAssistantResultTable(formatAssistantResultTable('Kết quả',result.records))!;
    expect(Object.values(table.rows[0].values)).toEqual(['A','B','C']);
  });
  it('keeps boolean comparisons consistent in both accepted plan shapes',()=>{
    const c:AnalysisContract={fields:{name:{label:'Tên',type:'text'},enabled:{label:'Bật',type:'boolean'}}};
    const rows=[{name:'QA A',enabled:true},{name:'QA B',enabled:false}],f={field:'enabled',operator:'eq',value:true};
    expect(analyzeList(c,rows,{filters:[f]},true)).toEqual(analyzeList(c,rows,{where:f},true));
  });
});
describe('live abstract predicate compilation regressions',()=>{
  const fixtures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-filter-continuation.json',import.meta.url),'utf8'));
  it.each(fixtures)('accepts the semantically correct captured plan: $id',fixture=>{
    const request=parseSemanticRequest(fixture.text,fixture.meaning),op=operationById(fixture.plan.actionId)!;
    const source={operation:op,workflow:defaultWorkflow(op),values:structuredClone(fixture.plan.values)},bound=bindSemanticRequest(request,fixture.plan.meaningBindings,[]);
    compileSemanticResolutions(request,[source],bound.bindings,fixture.resolutions);
    expect(validateSemanticPlan(request,bound.bindings,[source])).toEqual({ok:true});
  });
  it('never flips a literal boolean or changes an OR tree through predicate approval',()=>{
    const op=operationById('quotation.catalog.list')!,text='đang áp dụng hoặc giá trên 10';
    const request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'condition',quote:'đang áp dụng',concept:'Bật',operator:'eq',value:true},{id:'u2',kind:'condition',quote:'giá trên 10',concept:'Giá',operator:'gt',value:10}],conditionLogic:{any:['u1','u2']}});
    const source={operation:op,workflow:defaultWorkflow(op),values:{analysis:{where:{any:[{field:'active',operator:'eq',value:false},{field:'price',operator:'gt',value:10}]}}}};
    const bound=bindSemanticRequest(request,[{unitId:'u1',targets:['analysis.filters.active']},{unitId:'u2',targets:['analysis.filters.price']}],[]);
    compileSemanticResolutions(request,[source],bound.bindings,[{unitId:'u1',actionId:op.id,role:'read_predicate',target:'',predicates:[{field:'active',operator:'eq',value:false}]}]);
    expect(validateSemanticPlan(request,bound.bindings,[source])).toMatchObject({ok:false});
  });
  it('does not waive a genuine global sum as a displayed per-record measure',()=>{
    const op=operationById('partner.analysis')!,text='Cộng tổng hoa hồng tất cả đối tác';
    const request=parseSemanticRequest(text,{version:1,units:[{id:'u1',kind:'aggregate',quote:'tổng hoa hồng',concept:'Tổng',operator:'sum',value:null}]});
    const source={operation:op,workflow:defaultWorkflow(op),values:{analysis:{select:['name','totalCommission']}}};
    const bound=bindSemanticRequest(request,[{unitId:'u1',targets:['result.totalCommission']}],[]);
    compileSemanticResolutions(request,[source],bound.bindings,[{unitId:'u1',actionId:op.id,role:'row_measure',target:'result.totalCommission',predicates:[]}]);
    expect(validateSemanticPlan(request,bound.bindings,[source])).toMatchObject({ok:false});
  });
});
