import {readFileSync} from 'node:fs';
import {describe,it,expect,vi,afterEach} from 'vitest';
const provider=vi.hoisted(()=>vi.fn());
vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
vi.mock('./workflows',async importOriginal=>({...await importOriginal<any>(),assertOperation:async (_req:any,id:string)=>operationById(id)}));
import {operationById,defaultWorkflow} from './catalog';
import {analyzeList,reconcileRequestedRanking,reconcileRequestedValueFilters,validateListAnalysis} from './list-analysis';
import {missingReportConstraint} from './report-constraints';
import {validateRequestCoverage,shouldRepairRequestCoverage} from './request-coverage';
import {preferAnalysisViews} from './function-context';
import {createModuleChoice,resolveModuleChoice} from './collection-form';
import {assistantModuleContext} from './module-context';
import {scopeAssistantWorkflows} from './module-scope';
import {partnerReadPeriod,referredStudentInPeriod} from '../modules/student-management/services/partner-read-period';
import {PartnerService} from '../modules/student-management/services/partner.service';
import {Partner} from '../modules/student-management/models/partner.model';
import {Student} from '../modules/student-management/models/student.model';
import {CommissionLevel} from '../modules/student-management/models/commission-level.model';
import {callOperation} from './executor';
import {interpretRequest} from './semantic-interpreter';
import {formatFriendlyAssistantResult} from './result-format';
import {stripRequestFraming,isCompletionQuestionParticle} from './request-framing';

const op=operationById('partner.analysis')!,contract=op.analysis!;
const patches:Array<()=>void>=[];
function stub(object:any,key:string,implementation:any){
  const previous=Object.getOwnPropertyDescriptor(object,key),fn=vi.fn(implementation);
  Object.defineProperty(object,key,{value:fn,configurable:true,writable:true});
  patches.push(()=>previous?Object.defineProperty(object,key,previous):delete object[key]);return fn;
}
afterEach(()=>{for(const restore of patches.splice(0).reverse())restore();provider.mockReset();});
describe('real partner failures: safe replay without provider/DB/network',()=>{
  const fullyPaidQuestion='Có đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng chưa';
  it.each([
    [fullyPaidQuestion,'Có đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng'],
    ['Học viên QA đã đóng học phí chưa?','Học viên QA đã đóng học phí'],
    ['Nhân sự QA đã chấm công hay chưa ạ?','Nhân sự QA đã chấm công'],
    ['Hôm nay có đơn nghỉ phép mới chưa?','Hôm nay có đơn nghỉ phép mới'],
  ])('recognizes a terminal completion question without treating it as a negative filter: %s',(text,expected)=>{
    expect(stripRequestFraming(text)).toBe(expected);
    expect(isCompletionQuestionParticle(text,'chưa')).toBe(true);
  });
  it.each(['Đối tác nào chưa thanh toán hoa hồng','Có đối tác nào chưa thanh toán hoa hồng chưa?','Có dự án nào đã đặt tên Chưa','Có dự án nào đã đặt tên "Chưa"'])('preserves substantive negation and record names: %s',text=>{
    expect(stripRequestFraming(text)).toContain('chưa'===text.slice(-4).toLowerCase()?text.slice(-4):text.includes('"Chưa"')?'"Chưa"':'chưa thanh toán');
    expect(isCompletionQuestionParticle(text,'chưa')).toBe(false);
  });
  it('excludes zero-commission and partially paid records from paid-in-full results',()=>{
    const reconciliation=reconcileRequestedValueFilters(fullyPaidQuestion,contract,{});
    expect(reconciliation.kind).toBe('resolved');
    if(reconciliation.kind!=='resolved')throw Error('Missing full-payment predicates');
    const records=analyzeList(contract,[
      {name:'QA Đã đủ',totalCommission:500,totalPaid:500,unpaidBalance:0},
      {name:'QA Còn thiếu',totalCommission:500,totalPaid:100,unpaidBalance:400},
      {name:'QA Chưa phát sinh',totalCommission:0,totalPaid:0,unpaidBalance:0},
      {name:'QA Trả dư',totalCommission:500,totalPaid:600,unpaidBalance:-100},
    ],{...reconciliation.analysis,select:['name','totalCommission','totalPaid','unpaidBalance']},true).records;
    expect(records.map(row=>row['Đối tác'])).toEqual(['QA Đã đủ','QA Trả dư']);
    const coverage=[{evidence:'đối tác tuyển sinh',requirement:'Đối tác',mappedTo:['context.module']},{evidence:'đã được thanh toán đủ 100% hoa hồng',requirement:'Có phát sinh hoa hồng và đã trả hết',mappedTo:['analysis.filters.totalCommission','analysis.filters.unpaidBalance']}];
    expect(validateRequestCoverage(fullyPaidQuestion,coverage,defaultWorkflow(op),op,{analysis:reconciliation.analysis})).toEqual({ok:true});
    expect(validateRequestCoverage(fullyPaidQuestion,[...coverage,{evidence:'chưa',requirement:'Đuôi hỏi',mappedTo:[],unresolved:true}],defaultWorkflow(op),op,{analysis:reconciliation.analysis})).toEqual({ok:true});
    expect(validateRequestCoverage(fullyPaidQuestion+' ở Hà Nội',coverage,defaultWorkflow(op),op,{analysis:reconciliation.analysis})).toMatchObject({ok:false});
  });
  it('routes the screenshot question with no coverage repair and no model-generated execution',async()=>{
    provider.mockResolvedValue({text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'report',values:{analysis:{filters:[{field:'unpaidBalance',operator:'eq',value:0}]}},requestCoverage:[
      {evidence:'đối tác tuyển sinh',requirement:'Chọn phân hệ',mappedTo:['context.module']},
      {evidence:'đã được thanh toán đủ 100% hoa hồng',requirement:'Đã thanh toán đủ',mappedTo:['analysis.filters.unpaidBalance']},
    ]})});
    const result=await interpretRequest(fullyPaidQuestion,[defaultWorkflow(op)],null,[]);
    expect(result).toMatchObject({actionId:op.id});
    const values=validateListAnalysis(result.values.analysis,contract);
    expect(values.filters).toEqual(expect.arrayContaining([{field:'totalCommission',operator:'gt',value:0},{field:'unpaidBalance',operator:'lte',value:0}]));
    expect(provider).toHaveBeenCalledOnce();
  });
  const captured=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-partner-read.json',import.meta.url),'utf8'));
  it.each(captured)('checks the captured plan and coverage: $id',({text,output,rejected})=>{
    const selected=operationById(output.actionId)!;
    const result=validateRequestCoverage(text,output.requestCoverage,defaultWorkflow(selected),selected,output.values);
    if(rejected){expect(result).toMatchObject({ok:false});if(result.ok===false)expect(shouldRepairRequestCoverage(text,output.requestCoverage,result.clarification)).toBe(true);}
    else expect(result).toEqual({ok:true});
  });
  it('uses the equivalent analytic view only when enabled and leaves basic references registered',()=>{
    const base=defaultWorkflow(operationById('partner.list')!),view=defaultWorkflow(op);
    expect(preferAnalysisViews([base,view]).map(w=>w.actionId)).toEqual(['partner.analysis']);
    expect(preferAnalysisViews([base,{...view,enabled:false}]).map(w=>w.actionId)).toContain('partner.list');
    expect(operationById('partner.list')).toBeDefined();
  });
  it('maps a declared text filter without expanding the catalog or calling the model',async()=>{
    const text='Tìm đối tác tuyển sinh có ghi chú cộng đồng phụ huynh';
    const result=await interpretRequest(text,[defaultWorkflow(op)],null,[]);
    expect(result).toMatchObject({actionId:op.id});
    expect(JSON.parse(String(result.values.analysis))).toMatchObject({filters:[{field:'notes',operator:'contains',value:'cộng đồng phụ huynh'}]});
    expect(provider).not.toHaveBeenCalled();
  });
  it.each([
    ['doanh số học phí cao nhất','totalReferredTuition'],
    ['hoa hồng còn nợ cao nhất','unpaidBalance'],
  ])('binds the longest declared metric alias: %s',(text,field)=>{
    expect(reconcileRequestedRanking(text,contract,{})).toMatchObject({kind:'resolved',analysis:{extreme:{field,direction:'max'}}});
  });
  it('does not turn an omitted time/negative restriction into an output question',()=>{
    const output=captured.find((x:any)=>x.id==='P26').output;
    for(const extra of [' ở Hà Nội',' trong tháng trước',' chưa có hợp đồng']){
      expect(validateRequestCoverage(captured.find((x:any)=>x.id==='P26').text+extra,output.requestCoverage,defaultWorkflow(op),op,output.values)).toMatchObject({ok:false});
    }
    expect(reconcileRequestedRanking('đối tác cao nhất',contract,{}).kind).toBe('clarify');
  });
  it('keeps an extra condition inside a grouped/output evidence span fail-closed',()=>{
    for(const id of ['P03-fix-replay','P05-fix-replay']){
      const fixture=captured.find((c:any)=>c.id===id),selected=operationById(fixture.output.actionId)!;
      for(const extra of [' và có hợp đồng',' trong tháng trước']){
        const output=structuredClone(fixture.output),item=output.requestCoverage.at(-1);
        item.evidence+=extra;
        expect(validateRequestCoverage(fixture.text+extra,output.requestCoverage,defaultWorkflow(selected),selected,output.values)).toMatchObject({ok:false});
      }
    }
  });
  it('answers a single-record boolean state question even when the model names only action',()=>{
    const fixture=captured.find((c:any)=>c.id==='P05-fix-replay'),output=structuredClone(fixture.output),selected=operationById(output.actionId)!;
    output.requestCoverage.at(-1).mappedTo=['action'];
    expect(validateRequestCoverage(fixture.text,output.requestCoverage,defaultWorkflow(selected),selected,output.values)).toEqual({ok:true});
    output.requestCoverage.at(-1).evidence+=' và có hợp đồng';
    expect(validateRequestCoverage(fixture.text+' và có hợp đồng',output.requestCoverage,defaultWorkflow(selected),selected,output.values)).toMatchObject({ok:false});
  });
  it('keeps requested partner status visible on a fully populated compact profile',()=>{
    const detail=operationById('api.get.74c43c3c00197209')!;
    const reply=formatFriendlyAssistantResult(detail,{name:'QA',isActive:true,bankAccountStatus:'Đã cập nhật',phone:'0900000001',email:'qa@example.test',bankName:'QA Bank',bankAccountName:'QA',bankAccountNo:'1234567890',commissionType:'percentage',commissionValue:5});
    expect(reply).toContain('Đang hoạt động: Có');expect(reply).toContain('•••• 7890');expect(reply).not.toContain('1234567890');
  });
  it('computes grouped states, multiple financial totals and text filters on a complete population',()=>{
    const rows=[{name:'A',isActive:'active',notes:'Cộng đồng phụ huynh',totalCommission:500,totalPaid:150,unpaidBalance:350},
      {name:'B',isActive:'inactive',notes:'khác',totalCommission:100,totalPaid:50,unpaidBalance:50}];
    expect(analyzeList(contract,rows,{groupBy:'isActive',aggregate:{operation:'count'}},true).records).toEqual([
      {'Trạng thái':'Đang hoạt động','Số lượng':'1'},{'Trạng thái':'Tạm dừng','Số lượng':'1'}]);
    const totals=analyzeList(contract,rows,{aggregates:['totalCommission','totalPaid','unpaidBalance'].map(field=>({operation:'sum',field}))},true).records[0];
    expect(Object.values(totals)).toEqual(['Tất cả','600','200','400']);
    expect(analyzeList(contract,rows,{filters:[{field:'notes',operator:'contains',value:'cộng đồng phụ huynh'}],select:['name']},true).records).toEqual([{'Đối tác':'A'}]);
    expect(()=>validateListAnalysis({filters:[{field:'email',operator:'contains',value:'x'}]},contract)).toThrow();
    expect(()=>validateListAnalysis({aggregates:[{operation:'sum',field:'password'}]},contract)).toThrow();
    expect(()=>analyzeList(contract,rows,{aggregate:{operation:'count'}},false)).toThrow();
    const bank=analyzeList(contract,[{name:'A',bankAccountNo:'1234567890'}],{select:['name','bankAccountNo']},true);
    expect(JSON.stringify(bank)).toContain('•••• 7890');expect(JSON.stringify(bank)).not.toContain('1234567890');
  });
  it('does not turn a grouped state question into contradictory filters or require an unrelated date range',()=>{
    const plan={groupBy:'isActive',aggregate:{operation:'count' as const}};
    expect(reconcileRequestedValueFilters('bao nhiêu đang hoạt động và bao nhiêu đang tạm dừng',contract,plan)).toEqual({kind:'none'});
    expect(missingReportConstraint('học viên giới thiệu trong tháng 11/2026',op,{referralFrom:'2026-11-01',referralTo:'2026-11-30'})).toBeUndefined();
    expect(missingReportConstraint('học viên giới thiệu trong tháng 11/2026',op,{referralFrom:'2026-11-01'})).toBeDefined();
    expect(missingReportConstraint('học viên giới thiệu trong tháng 11/2026',op,{referralFrom:'2026-10-01',referralTo:'2026-10-31'})).toBeDefined();
    expect(reconcileRequestedValueFilters('không phải chưa có tài khoản ngân hàng',contract,{}).kind).toBe('clarify');
  });
  it('offers the owning partner module and scopes its resumed intent to the same resource',()=>{
    const workflows=[op,operationById('student.list')!,operationById('worker.partner.list')!].map(defaultWorkflow);
    const choice=createModuleChoice(workflows,['student','labor-partner'],'Số điện thoại đối tác QA là gì',null)!;
    const option=choice.selection.options.find(o=>o.label==='Đối tác tuyển sinh')!;
    expect(option).toBeDefined();
    const selected=resolveModuleChoice(choice.state,{id:choice.selection.id,value:option.value},null);
    expect(selected.module).toBe('student-partner');
    const text=`Trong phân hệ ${assistantModuleContext(selected.module).label}, ${selected.intent}`;
    expect(scopeAssistantWorkflows(text,workflows).workflows.map(w=>w.actionId)).toContain('partner.analysis');
    expect(scopeAssistantWorkflows(text,workflows).workflows.map(w=>w.actionId)).not.toContain('student.list');
  });
});

describe('partner periods and authorized business reads',()=>{
  it('uses VN day boundaries and rejects missing/invalid referral dates instead of guessing',()=>{
    const range=partnerReadPeriod('2026-11-01','2026-11-30')!;
    expect(range.start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-30T16:59:59.999Z');
    expect(referredStudentInPeriod('01/11/2026',range)).toBe(true);
    expect(referredStudentInPeriod('2026-10-31',range)).toBe(false);
    expect(()=>referredStudentInPeriod('',range)).toThrow();
    expect(()=>partnerReadPeriod('2026-02-30','2026-03-01')).toThrow();
    expect(()=>partnerReadPeriod('2026-11-01',undefined)).toThrow();
  });
  it('retains branch/owner scope and lifetime commission when counting selected referral dates',async()=>{
    const partner:any={_id:'p1',ownerId:'o1',branchId:'b1',payoutHistory:[{amount:20}],toObject(){return {name:'QA',isActive:true,ownerId:'o1'};}};
    const count=stub(Partner,'countDocuments',async()=>1);
    stub(Partner,'find',()=>({sort:()=>({skip:()=>({limit:async()=>[partner]})})}));
    stub(Student,'find',()=>({select:async()=>[
      {partnerId:'p1',fee:'1000',registrationDate:'31/10/2026'},
      {partnerId:'p1',fee:'2000',registrationDate:'01/11/2026'}]}));
    stub(CommissionLevel,'find',()=>({sort:async()=>[]}));
    const result=await PartnerService.getPartners('o1',{createdFrom:'2026-11-01',createdTo:'2026-11-30',referralFrom:'2026-11-01',referralTo:'2026-11-30'},'b1');
    expect(count.mock.calls[0][0]).toMatchObject({ownerId:'o1',branchId:'b1',createdAt:{$gte:new Date('2026-10-31T17:00:00Z')}});
    expect(result.partners[0]).toMatchObject({referredStudentsCount:1,totalReferredTuition:2000,totalCommission:150,totalPaid:20,unpaidBalance:130});
  });
  it('projects referral detail through the real executor and drops internal/student-private fields',async()=>{
    const fetchMock=stub(globalThis,'fetch',async()=>new Response(JSON.stringify({success:true,data:{
      _id:'private-partner',name:'QA',totalReferredTuition:3000,referredStudents:[{_id:'private-student',fullName:'QA Học viên',registrationDate:'2026-11-01',fee:'3000',phone:'private-phone'}],
    }}),{status:200,headers:{'Content-Type':'application/json'}}));
    const result=await callOperation({socket:{localAddress:'127.0.0.1',localPort:3000},user:{id:'u1',role:'admin',companyCode:'QA',branchId:'b1',permissions:['relationship:read']},headers:{authorization:'Bearer fixture'}} as any,operationById('partner.referrals')!,{path_id:'aaaaaaaaaaaaaaaaaaaaaaaa'});
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).toContain('QA Học viên');
    expect(JSON.stringify(result)).not.toMatch(/private-student|private-phone|private-partner/);
  });
});
