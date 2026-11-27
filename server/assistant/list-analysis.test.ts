import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { analyzeList, collectAnalysisPages, reconcileRequestedRanking, reconcileRequestedValueFilters, validateListAnalysis, renderListAnalysis, listAnalysisPlanSchema, type AnalysisContract } from "./list-analysis";
import {buildAssistantCapabilityContext} from './capability-context';
import {defaultWorkflow} from './catalog';

it('ignores missing optional dates for extrema while rejecting malformed calendar values',()=>{
 const contract:AnalysisContract={fields:{code:{label:'Mã',type:'text'},receivedAt:{label:'Ngày nhập',type:'text',format:'date'}}};
 const plan={extreme:{field:'receivedAt',direction:'max'},select:['code','receivedAt']};
 const result=analyzeList(contract,[{code:'QA-NHAP',receivedAt:'2026-11-26T05:00:00Z'},{code:'QA-NHAP-CU',receivedAt:'2026-11-20'},{code:'QA-NHAP-NHAP',receivedAt:null}],plan,true);
 expect(result.records).toHaveLength(1);expect(result.records[0]['Mã']).toBe('QA-NHAP');
 expect(()=>analyzeList(contract,[{code:'QA-SAI',receivedAt:'2026-02-30'}],plan,true)).toThrow('ngày không hợp lệ');
});

it('publishes the executable public analysis grammar for every analysis tool',()=>{
  for(const operation of ASSISTANT_OPERATIONS.filter(op=>op.analysis)){
    const schema=listAnalysisPlanSchema(operation.analysis!);
    expect(schema.properties.groupBy.enum).toEqual(Object.keys(operation.analysis!.fields));
    expect(schema.properties.aggregate.anyOf[0].required).toEqual(['operation']);
    const context=buildAssistantCapabilityContext([defaultWorkflow(operation)])[0];
    expect(context.analysis?.planSchema).toEqual(schema);
  }
});
it('counts complete authorized rows by declared categories across independent contracts',()=>{
  for(const dimension of ['isActive','department','orderState']){
    const contract:AnalysisContract={fields:{[dimension]:{label:'Nhóm',type:'text',values:{a:'Nhóm A',b:'Nhóm B'}},name:{label:'Tên',type:'text'}}};
    const rows=[{[dimension]:'a',name:'QA 1'},{[dimension]:'b',name:'QA 2'},{[dimension]:'a',name:'QA 3'}];
    expect(analyzeList(contract,rows,{groupBy:dimension,aggregate:{operation:'count'}},true).records).toEqual([{'Nhóm':'Nhóm A','Số lượng':'2'},{'Nhóm':'Nhóm B','Số lượng':'1'}]);
    expect(()=>analyzeList(contract,rows,{groupBy:dimension,aggregate:{operation:'count'},select:['count']},true)).toThrow();
    expect(()=>analyzeList(contract,rows,{groupBy:dimension,aggregate:{operation:'count'}},false)).toThrow();
  }
});

it('only presents a no-match finding after a complete, validated read',()=>{
  const operation=ASSISTANT_OPERATIONS.find(op=>op.id==='partner.analysis')!;
  const plan={filters:[{field:'totalCommission',operator:'gt',value:0},{field:'unpaidBalance',operator:'lte',value:0}]};
  const rows=[{name:'QA Còn nợ',totalCommission:500,totalPaid:100,unpaidBalance:400},{name:'QA Chưa phát sinh',totalCommission:0,totalPaid:0,unpaidBalance:0}];
  const question='Có đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng chưa';
  expect(renderListAnalysis(operation.analysis!,rows,plan,true,operation.title,question)).toBe('Hiện mình chưa thấy đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng trong phạm vi đang xem.');
  expect(()=>renderListAnalysis(operation.analysis!,rows,plan,false,operation.title,question)).toThrow('Chưa lấy đủ');
  expect(()=>renderListAnalysis(operation.analysis!,rows,{filters:[{field:'password',operator:'eq',value:'x'}]},true,operation.title,question)).toThrow();
});
it('reconciles only reviewed enum phrases and preserves independent numeric filters', () => {
  const contract = ASSISTANT_OPERATIONS.find(op=>op.analysis?.fields.status?.valueAliases)?.analysis!;
  const wrong = {filters:[{field:'status',operator:'eq',value:'not_set'},{field:'actualReferrals',operator:'gte',value:3}]};
  expect(reconcileRequestedValueFilters('Đối tác thiếu KPI tháng',contract,wrong)).toMatchObject({kind:'resolved',analysis:{filters:[{field:'actualReferrals',operator:'gte',value:3},{field:'status',operator:'eq',value:'incomplete'}]}});
  expect(reconcileRequestedValueFilters('Đối tác chưa đặt KPI',contract,undefined)).toMatchObject({kind:'resolved',analysis:{filters:[{value:'not_set'}]}});
  expect(reconcileRequestedValueFilters('Đối tác không đạt đủ KPI',contract,undefined)).toMatchObject({kind:'clarify'});
  expect(reconcileRequestedValueFilters('Đối tác đã đạt KPI hoặc thiếu KPI',contract,undefined)).toMatchObject({kind:'clarify'});
  expect(reconcileRequestedValueFilters('Đối tác có dữ liệu khác',contract,wrong)).toEqual({kind:'none'});
});
const contract: AnalysisContract = { fields: { name: { label: "Tên", type: "text" }, score: { label: "Điểm", type: "number" }, status: { label: "Trạng thái", type: "text" } } };
const rows = [
  { name: "A", score: 10, status: "achieved", password: "private" }, { name: "B", score: 10, status: "achieved" },
  { name: "C", score: 3, status: "incomplete" }, { name: "D", score: 0, status: "not_set" },
];
describe("declarative list analysis independent of business modules", () => {
  it.each(["duplicate", "changed-total", "empty-page"])("rejects inconsistent pagination: %s", async kind => {
    let page = 0;
    const paginated = { ...contract, pagination: { pageField: "page", sizeField: "limit" } };
    await expect(collectAnalysisPages(paginated, {}, async () => {
      page++;
      return { data: page === 2 && kind === "empty-page" ? [] : [{ name: "An" }], analysisPage: { page, total: page === 2 && kind === "changed-total" ? 3 : 2, keys: page === 2 && kind === "empty-page" ? [] : ["same"] } };
    })).rejects.toThrow();
  });
  it("keeps ties and zero values", () => {
    expect(analyzeList(contract, rows, { extreme: { field: "score", direction: "max" }, limit: 1 }, true).records.map(r => r.Tên)).toEqual(["A", "B"]);
    expect(analyzeList(contract, rows, { extreme: { field: "score", direction: "min" } }, true).records[0].Tên).toBe("D");
  });
  it("recovers a ranking on the requested metric when the model omitted it", () => {
    const rankingContract: AnalysisContract = { fields: {
      partner: { label: "Đối tác", type: "text" },
      actualReferrals: { label: "Đã giới thiệu", type: "number", aliases: ["lao động", "giới thiệu"] },
      targetReferrals: { label: "Chỉ tiêu", type: "number" },
    } };
    expect(reconcileRequestedRanking("Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", rankingContract, undefined))
      .toEqual({ kind: "resolved", analysis: { extreme: { field: "actualReferrals", direction: "max" } } });
  });
  it.each(["Báo cáo sinh nhật nhân sự tháng tới", "Báo cáo lịch chủ nhật"])("does not mistake calendar words for ranking cues: %s", request => {
    expect(reconcileRequestedRanking(request, {
      fields: { count: { label: "Số lượng", type: "number" } },
    }, undefined)).toEqual({ kind: "none" });
  });
  it("maps labor referral wording onto the declared labor KPI field", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    expect(reconcileRequestedRanking("Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", {
      fields: { actualReferrals: operation.analysis!.fields.actualReferrals },
    }, undefined).kind).toBe("resolved");
    expect(reconcileRequestedRanking("Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", operation.analysis!, undefined))
      .toMatchObject({ kind: "resolved", analysis: { extreme: { field: "actualReferrals", direction: "max" } } });
  });
  it("asks which metric to rank when a multi-metric report request is underspecified", () => {
    const result = reconcileRequestedRanking("Đối tác nào nhiều nhất trong tháng", {
      fields: { actualReferrals: { label: "Đã giới thiệu", type: "number" }, targetReferrals: { label: "Chỉ tiêu", type: "number" } },
    }, undefined);
    expect(result.kind).toBe("clarify");
  });
  it("treats top N as a sorted list with the requested size", () => {
    const result = reconcileRequestedRanking("Top 5 đối tác theo số lao động được giới thiệu", {
      fields: { actualReferrals: { label: "Đã giới thiệu", type: "number", aliases: ["lao động"] } },
    }, undefined);
    expect(result).toEqual({ kind: "resolved", analysis: { sort: { field: "actualReferrals", direction: "desc" }, limit: 5 } });
  });
  it("combines predicates and sorting without exposing other fields", () => {
    const result = analyzeList(contract, rows, { filters: [{ field: "score", operator: "gte", value: 3 }, { field: "status", operator: "ne", value: "achieved" }], sort: { field: "score", direction: "desc" }, limit: 2 }, true);
    expect(result.records).toEqual([{ Tên: "C", Điểm: "3", "Trạng thái": "incomplete" }]);
  });
  it("supports unenumerated combinations of group, count, sum and average", () => {
    expect(analyzeList(contract, rows, { groupBy: "status", aggregate: { operation: "count" } }, true).records[0]["Số lượng"]).toBe("2");
    expect(analyzeList(contract, rows, { aggregate: { operation: "sum", field: "score" } }, true).records[0]["Tổng điểm"]).toBe("23");
    expect(analyzeList(contract, rows, { filters: [{ field: "score", operator: "gt", value: 0 }], aggregate: { operation: "avg", field: "score" } }, true).records[0]["Trung bình điểm"]).toBe((23 / 3).toLocaleString("vi-VN"));
  });
  it("refuses incomplete populations", () => expect(() => analyzeList(contract, rows, {}, false)).toThrow("Chưa lấy đủ"));
  it.each([{ extreme: { field: "password", direction: "max" } }, { filters: [{ field: "score", operator: "gt", value: "2" }] }, { code: "return secrets" }, { limit: 0 }, { groupBy: "unknown", aggregate: { operation: "count" } }])("rejects unsupported or unsafe plans", plan => expect(() => validateListAnalysis(plan, contract)).toThrow());
  it("does not treat missing numbers as zero", () => {
    expect(analyzeList(contract, [{ name: "A", score: null }, { name: "B", score: 0 }], { extreme: { field: "score", direction: "min" } }, true).records.map(r => r.Tên)).toEqual(["B"]);
  });
});
