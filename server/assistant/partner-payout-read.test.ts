import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const provider=vi.hoisted(()=>vi.fn());
vi.mock('../service/openrouter.service',()=>({openrouterChat:provider}));
vi.mock('./workflows',async original=>({...await original<any>(),assertOperation:async (_req:any,id:string)=>operationById(id)}));
import {operationById,defaultWorkflow} from './catalog';
import {analyzeList,reconcileRequestedRanking,renderListAnalysis,validateListAnalysis} from './list-analysis';
import {validateRequestCoverage} from './request-coverage';
import {groundAssistantClarification,interpretRequest} from './semantic-interpreter';
import {callOperation} from './executor';
import {collectPartnerPayoutHistory,partnerPayoutDay} from '../modules/student-management/services/partner-payout-read';
import {PartnerService} from '../modules/student-management/services/partner.service';
import {Partner} from '../modules/student-management/models/partner.model';
import {assistantFunctionContextCatalog,isExplicitReadOnlyRequest} from './function-context';

const op=operationById('partner.payouts.analysis')!,contract=op.analysis!;
const question='Lần gần nhất trung tâm chi trả hoa hồng cho đối tác tuyển sinh là khi nào và cho ai';
async function* source(rows:any[]){yield* rows;}
const fixtures=[{name:'QA A',payoutHistory:[{amount:1000000,date:'01/10/2026',method:'Tiền mặt',id:'private'},{amount:300000,date:'24/11/2026'}]},
  {name:'QA B',payoutHistory:[{amount:150000,date:'24/11/2026',method:'Chuyển khoản'}]},
  {name:'QA C',payoutHistory:[]}];
const coverage=[
  {evidence:'Lần gần nhất',requirement:'Lần chi gần nhất',mappedTo:['analysis.extreme.paidOn']},
  {evidence:'trung tâm',requirement:'Phạm vi hiện tại',mappedTo:['context.scope']},
  {evidence:'chi trả hoa hồng',requirement:'Lịch sử tiền thực chi',mappedTo:['action']},
  {evidence:'đối tác tuyển sinh',requirement:'Phân hệ',mappedTo:['context.module']},
  {evidence:'khi nào',requirement:'Ngày chi',mappedTo:['result.paidOn']},
  {evidence:'cho ai',requirement:'Người nhận',mappedTo:['result.partnerName']},
];
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();provider.mockReset();});

describe('complete authorized partner payout history',()=>{
  const captured=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-payout-read.json',import.meta.url),'utf8'));
  it.each(captured)('accepts the real captured plan once without dropping dates/recipients',async({text,output})=>{
    provider.mockResolvedValue({text:JSON.stringify(output)});
    const result=await interpretRequest(text,[defaultWorkflow(op)],null,[]);
    expect(result.actionId,JSON.stringify(result)).toBe(op.id);
    expect(provider).toHaveBeenCalledOnce();
    for(const extra of [' trước ngày 01/11/2026',' và chưa có hợp đồng']){
      expect(validateRequestCoverage(text+extra,output.requestCoverage,defaultWorkflow(op),op,result.values)).toMatchObject({ok:false});
    }
  });
  it('recognizes natural read questions without including mutation workflows',()=>{
    expect(isExplicitReadOnlyRequest(question)).toBe(true);
    expect(isExplicitReadOnlyRequest('Tháng này trung tâm đã chi trả tổng cộng bao nhiêu tiền hoa hồng')).toBe(true);
    expect(isExplicitReadOnlyRequest('Tạo khoản chi đã trả cho ai')).toBe(false);
    expect(isExplicitReadOnlyRequest('Xem lần gần nhất và chuyển tiền cho đối tác')).toBe(false);
  });
  it('does not use an unselected date output or an omitted name as coverage',()=>{
    const plan={extreme:{field:'paidOn',direction:'max'},select:['partnerName']};
    expect(validateRequestCoverage(question,coverage,defaultWorkflow(op),op,{analysis:plan})).toMatchObject({ok:false});
    expect(validateRequestCoverage('Tìm đối tác tên Trung Tâm',[{evidence:'Tìm đối tác',requirement:'Tìm',mappedTo:['action']}],defaultWorkflow(op),op,{})).toMatchObject({ok:false});
  });
  it('does not substitute an average for an explicitly requested total',()=>{
    const fixture=captured.find((item:any)=>item.text.startsWith('Tháng này'));
    expect(validateRequestCoverage(fixture.text,fixture.output.requestCoverage,defaultWorkflow(op),op,{...fixture.output.values,analysis:{aggregate:{operation:'avg',field:'amount'}}})).toMatchObject({ok:false});
  });
  it('reads actual events and keeps every recipient on the latest day, not the highest amount',async()=>{
    const result=await collectPartnerPayoutHistory(source(fixtures),{});
    expect(result.analysisComplete).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private');
    const plan=reconcileRequestedRanking(question,contract,{});
    expect(plan).toMatchObject({kind:'resolved',analysis:{extreme:{field:'paidOn',direction:'max'}}});
    if(plan.kind!=='resolved')throw Error('missing date ranking');
    expect(analyzeList(contract,result.data,{...plan.analysis,limit:1},true).records).toEqual([
      {'Đối tác':'QA A','Ngày chi trả':'24/11/2026','Số tiền chi trả (VND)':'300.000','Phương thức':''},
      {'Đối tác':'QA B','Ngày chi trả':'24/11/2026','Số tiền chi trả (VND)':'150.000','Phương thức':'Chuyển khoản'},
    ]);
    expect(validateRequestCoverage(question,coverage,defaultWorkflow(op),op,{analysis:plan.analysis})).toEqual({ok:true});
    expect(renderListAnalysis(contract,result.data,plan.analysis,true,'Lịch sử chi trả')).toContain('24/11/2026');
  });
  it('sums only actual payouts in the inclusive requested calendar period',async()=>{
    const data=await collectPartnerPayoutHistory(source(fixtures),{from:'2026-11-01',to:'2026-11-30'});
    expect(analyzeList(contract,data.data,{aggregate:{operation:'sum',field:'amount'}},true).records[0]).toMatchObject({'Tổng số tiền chi trả (vnd)':'450.000'});
    expect((await collectPartnerPayoutHistory(source(fixtures),{from:'2026-12-01',to:'2026-12-31'})).data).toEqual([]);
  });
  it.each([
    ['24/11/2026','2026-11-24'],['2026-11-24','2026-11-24'],
    ['2026-11-23T18:00:00Z','2026-11-24'],['2026-11-24T00:00:00','2026-11-24'],
  ])('normalizes legacy and timestamp dates to Vietnam calendar: %s',(value,day)=>expect(partnerPayoutDay(value)).toBe(day));
  it.each(['31/02/2026','unknown','2026-11-24Tinvalid'])('fails closed on invalid history: %s',async date=>{
    await expect(collectPartnerPayoutHistory(source([{name:'QA',payoutHistory:[{amount:1,date}]}]),{})).rejects.toThrow();
  });
  it('rejects incomplete windows and invalid money instead of computing a partial report',async()=>{
    await expect(collectPartnerPayoutHistory(source(fixtures),{from:'2026-11-01'})).rejects.toThrow();
    await expect(collectPartnerPayoutHistory(source([{name:'QA',payoutHistory:[{amount:NaN,date:'24/11/2026'}]}]),{})).rejects.toThrow();
    await expect(collectPartnerPayoutHistory(source(Array.from({length:10001},()=>({name:'QA'}))),{})).rejects.toThrow('quá nhiều');
    expect(()=>analyzeList(contract,[],{extreme:{field:'paidOn',direction:'max'}},false)).toThrow();
  });
  it('keeps trusted owner/branch scope, escapes names and closes the cursor',async()=>{
    const cursor=Object.assign(source(fixtures),{close:vi.fn()});
    const find=vi.spyOn(Partner,'find').mockReturnValue({select:vi.fn().mockReturnValue({lean:()=>({cursor:()=>cursor})})} as any);
    await PartnerService.getPayoutHistory(['owner-A'],{search:'QA.*'},'branch-A');
    expect(find).toHaveBeenCalledWith({ownerId:{$in:['owner-A']},branchId:'branch-A',name:{$regex:'QA\\.\\*',$options:'i'}});
    expect(cursor.close).toHaveBeenCalledOnce();
  });
  it('registers a read in the payout group and projects only public declared data',async()=>{
    const groups=assistantFunctionContextCatalog([defaultWorkflow(op)]);
    expect(JSON.stringify(groups)).toContain('partner-payouts');
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true,analysisComplete:true,data:[{partnerName:'QA',paidOn:'2026-11-24',amount:1,method:'Tiền mặt',ownerId:'private',note:'private'}]})});
    vi.stubGlobal('fetch',fetch);
    const result=await callOperation({socket:{localAddress:'127.0.0.1',localPort:3000},user:{id:'u1',role:'admin',companyCode:'QA',branchId:'branch-A',permissions:['relationship:read']},headers:{authorization:'Bearer fixture'}} as any,op,{analysis:JSON.stringify({extreme:{field:'paidOn',direction:'max'}})});
    expect(result).toEqual({analysisComplete:true,data:[{partnerName:'QA',paidOn:'2026-11-24',amount:1,method:'Tiền mặt'}]});
    expect(fetch.mock.calls[0][1].method).toBe('GET');
  });
  it('routes the natural question once and preserves its date and recipient requirements',async()=>{
    provider.mockResolvedValue({text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'report',values:{analysis:{select:['partnerName','paidOn','amount','method']}},requestCoverage:coverage})});
    const result=await interpretRequest(question,[defaultWorkflow(op)],null,[]);
    expect(result).toMatchObject({actionId:op.id});
    expect(validateListAnalysis(result.values.analysis,contract).extreme).toEqual({field:'paidOn',direction:'max'});
    expect(provider).toHaveBeenCalledOnce();
  });
  it('does not invent an authorization cause from model catalog selection',()=>{
    expect(groundAssistantClarification('Bạn có thể cấp quyền nhóm chi trả để xem.')).toBe('Mình chưa tìm được nguồn dữ liệu phù hợp để trả lời đầy đủ yêu cầu này.');
    expect(groundAssistantClarification('Bạn muốn xem tháng nào?')).toBe('Bạn muốn xem tháng nào?');
  });
  it('supports earliest dates but keeps ordinary text and date sums invalid',()=>{
    expect(reconcileRequestedRanking('Lần đầu tiên chi trả là ngày nào',contract,{})).toMatchObject({kind:'resolved',analysis:{extreme:{field:'paidOn',direction:'min'}}});
    expect(()=>validateListAnalysis({extreme:{field:'partnerName',direction:'max'}},contract)).toThrow();
    expect(()=>validateListAnalysis({aggregate:{operation:'sum',field:'paidOn'}},contract)).toThrow();
    expect(reconcileRequestedRanking('Tổng tiền trong tháng gần nhất',contract,{})).toEqual({kind:'none'});
    expect(reconcileRequestedRanking('Lần gần nhất có số tiền cao nhất',contract,{}).kind).toBe('clarify');
  });
});
