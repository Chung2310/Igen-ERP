import {readFileSync} from 'node:fs';
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], includeHr: false, includeStudents: false, requireWorkerPhone:false, alwaysConfirm:true, interpret: vi.fn(), provider: vi.fn(), fit:vi.fn() }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: async (...args: any[]) => {
  // Legacy conversation fixtures provide planning/meaning answers. Supply the
  // new broker contracts explicitly; dedicated tests below override the fit.
  if(args[0]?.responseSchema?.properties.approvedActionIds){
    const payload=JSON.parse(args[0].messages.at(-1).content);
    if(state.fit.getMockImplementation())return state.fit(payload);
    return {text:JSON.stringify({approvedActionIds:payload.selected.map((s:any)=>s.actionId),question:''})};
  }
  const response = await state.provider(...args);
  if (typeof response?.text !== "string") return response;
  try {
    const parsed = JSON.parse(response.text);
    if(args[0]?.responseSchema?.properties.decision&&parsed.featureKeys)return {text:JSON.stringify({featureKeys:parsed.featureKeys,decision:'search',question:'',unavailableModule:null})};
    if (typeof parsed.actionId === "string" && parsed.intentType === undefined) parsed.intentType = "workflow";
    if (typeof parsed.actionId === "string" && parsed.requestCoverage === undefined) {
      const [{ defaultWorkflow, operationById }, { reconcileRequestedRanking }] = await Promise.all([
        import("./catalog"), import("./list-analysis"),
      ]);
      const requestText = args[0]?.messages?.at(-1)?.content;
      const operation = operationById(parsed.actionId);
      const workflow = operation && defaultWorkflow(operation);
      if (typeof requestText === "string" && operation && workflow) {
        const targets = ["action"];
        const values = parsed.values && typeof parsed.values === "object" ? parsed.values : {};
        for (const [key, value] of Object.entries(values)) {
          if (value == null) continue;
          const field = workflow.fields.find(candidate => candidate.key === key || candidate.apiKey === key
            || Boolean(candidate.source && candidate.apiKey && `${candidate.source}_${candidate.apiKey}` === key));
          if (field) targets.push(`values.${field.key}`);
        }
        if (workflow.fields.some(field => field.apiKey === "periodAnchor") && /\btháng\b|\bthang\b/iu.test(requestText)) {
          targets.push(`values.${workflow.fields.find(field => field.apiKey === "periodAnchor")!.key}`);
        }
        let analysis: any = values.analysis;
        try { if (typeof analysis === "string") analysis = JSON.parse(analysis); } catch { analysis = undefined; }
        if (operation.analysis && (!analysis || typeof analysis !== "object")) {
          const inferred = reconcileRequestedRanking(requestText, operation.analysis, analysis);
          if (inferred.kind === "resolved") analysis = inferred.analysis;
        }
        if (analysis && typeof analysis === "object") {
          if (analysis.extreme?.field) targets.push(`analysis.extreme.${analysis.extreme.field}`);
          if (analysis.sort?.field) targets.push(`analysis.sort.${analysis.sort.field}`);
          for (const filter of analysis.filters || []) if (filter?.field) targets.push(`analysis.filters.${filter.field}`);
          if (analysis.limit) targets.push("analysis.limit");
        }
        parsed.requestCoverage = [{ evidence: requestText, requirement: "Yêu cầu thao tác", mappedTo: [...new Set(targets)] }];
      }
    }
    return { ...response, text: JSON.stringify(parsed) };
  } catch { return response; }
} }));
vi.mock("./models", () => {
  const apply = (record: any, updates: any) => {
    for (const [key, value] of Object.entries(updates.$set || {})) {
      const path = key.split("."); let target = record;
      for (const part of path.slice(0, -1)) target = target[part] ??= {};
      target[path.at(-1)!] = structuredClone(value);
    }
  };
  const chain = (getter: () => any): any => ({ sort: () => chain(getter), select: () => chain(getter), lean: async () => structuredClone(getter()) });
  return {
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: vi.fn() },
    AssistantSessionModel: {
      updateOne: vi.fn(async (_filter, update) => {
        state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 };
        apply(state.session, update);
      }),
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => {
        const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" };
        state.turns.push(turn); return turn;
      }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId
        ? turn.requestId === filter.requestId
        : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  const configured=(op:any)=>{const workflow=defaultWorkflow(op);if(state.requireWorkerPhone&&op.id==='worker.create')workflow.fields=workflow.fields.map(field=>field.key==='phone'?{...field,required:true}:field);return workflow;};
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => configured(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => state.includeHr && op.module === 'hr' || state.includeStudents && op.module === 'student' || ["worker", "labor-partner", "student-partner", "retail-partner"].includes(op.module) || op.path === "/retail/finance/commission/kpi").map(configured)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, alwaysConfirm:state.alwaysConfirm, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from "./service";
import { ASSISTANT_OPERATIONS, operationById } from "./catalog";
import { callOperation } from "./executor";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const projectId = "64b000000000000000000021";
const workerId = "64b000000000000000000022";
const contractId = "64b000000000000000000023";
const req = { user: { id: "actor", uid: "actor", email: "actor@example.com", companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", role: "admin" }, headers: { authorization: "Bearer scoped" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const turn = (input: any) => processTurn(req, { conversationId: "worker-conversation", requestId: randomUUID(), ...input });
it.each([true,false])('presents a partial read honestly through the common service (match=%s)',async matched=>{
  state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'worker.project.list',values:{analysis:{where:{field:'name',operator:'contains',value:matched?'QA':'Absent'},select:['name']}}});
  fetcher.mockImplementation(async(url:any,init:any)=>{
    expect(init?.method||'GET').toBe('GET');
    if(new URL(String(url)).pathname.endsWith('/worker-management/projects'))return json({data:[{_id:workerId,name:'QA Dự án'},{_id:contractId,name:'Dự án khác'}]});
    throw Error('UNEXPECTED_PARTIAL_READ');
  });
  const result=await turn({text:'Lọc dự án lao động có tên phù hợp'});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(result.reply).toContain(matched?'chưa bao gồm toàn bộ':'chưa thể kết luận cho toàn bộ');
  if(matched){expect(result.reply).toContain('QA Dự án');expect(result.reply).not.toContain('Dự án khác');}
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('executes a shared OR filter through read dispatch and renders only selected public columns',async()=>{
  state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'worker.list',values:{analysis:{where:{any:[{field:'status',operator:'eq',value:'active'},{field:'laborType',operator:'eq',value:'seasonal'}]},select:['fullName','status']}}});
  fetcher.mockImplementation(async(url:any,init:any)=>{
    const path=new URL(String(url)).pathname;
    if(path.endsWith('/workers')){
      expect(init?.method||'GET').toBe('GET');expect(new URL(String(url)).searchParams.has('analysis')).toBe(false);
      return json({workers:[{_id:workerId,fullName:'QA A',status:'active',laborType:'official',phone:'PRIVATE'},{_id:projectId,fullName:'QA B',status:'inactive',laborType:'seasonal',phone:'PRIVATE'},{_id:contractId,fullName:'QA C',status:'inactive',laborType:'official',phone:'PRIVATE'}]});
    }
    throw Error('UNEXPECTED_FILTER_REQUEST');
  });
  const result=await turn({text:'Lọc lao động đang làm hoặc thuộc nhóm thời vụ giúp mình'});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(result.reply).toContain('QA A');expect(result.reply).toContain('QA B');expect(result.reply).not.toContain('QA C');expect(result.reply).not.toContain('PRIVATE');expect(result.reply).not.toContain(workerId);
  expect(parseAssistantResultTable(result.reply)?.rows).toHaveLength(2);expect(fetcher).toHaveBeenCalledTimes(1);
});
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
let savedWorker: Record<string, unknown> | undefined;

async function useSemanticModel(actionId: string, values: Record<string, unknown>) {
  const actual = await vi.importActual<typeof import("./semantic-interpreter")>("./semantic-interpreter");
  state.interpret.mockImplementation(actual.interpretRequest);
  const [{ operationById, defaultWorkflow }, { assistantFunctionKey }] = await Promise.all([import('./catalog'), import('./function-context')]);
  const operation = operationById(actionId)!;
  state.provider.mockImplementation(async input => {
    const properties = input.responseSchema?.properties || {};
    if (properties.modules) return { text: JSON.stringify({ modules: [operation.module] }) };
    if (properties.featureKeys) return { text: JSON.stringify({ featureKeys: [assistantFunctionKey(defaultWorkflow(operation))], ambiguous: false, clarification: "" }) };
    if (properties.actionIds) return { text: JSON.stringify({ actionIds: [actionId] }) };
    return { text: JSON.stringify({ actionId, values, intentType: "workflow" }) };
  });
}
it('performs an ID-based absence comparison through audited read dispatch, including all contract pages', async () => {
  const otherId = '64b000000000000000000099';
  state.interpret.mockResolvedValueOnce({ intentType: 'workflow', actionId: null, values: {}, actionIntent: 'report', queryPlan: [
    { actionId: 'worker.list', purpose: 'Lao động', values: {}, resultFields: ['fullName'], relation: 'workers-without-contracts' },
    { actionId: 'worker.labor.contract.list', purpose: 'Hợp đồng', values: {}, resultFields: ['workerName'] },
  ], requestCoverage: [{ evidence: 'Danh sách lao động chưa có hợp đồng', requirement: 'Không có hợp đồng liên quan', mappedTo: ['query:worker.list:relation'] }] });
  fetcher.mockImplementation(async (input: any) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/workers')) return json({ workers: [{ _id: workerId, fullName: 'QA Trùng Tên', laborType: 'official' }, { _id: otherId, fullName: 'QA Trùng Tên', laborType: 'seasonal' }] });
    if (url.pathname.endsWith('/labor-contracts')) return json({ success: true, data: [{ _id: url.searchParams.get('page') === '2' ? '64b000000000000000000042' : contractId, workerId, workerName: 'QA Trùng Tên' }], total: 2, page: Number(url.searchParams.get('page') || 1), limit: 1 });
    if (url.pathname.endsWith('/auth/branches')) return json({ branches: [{ _id: req.user.branchId, name: 'QA Branch' }] });
    throw new Error('UNEXPECTED_READ_RELATION_ROUTE:' + url.pathname);
  });
  const result = await turn({ text: 'Danh sách lao động chưa có hợp đồng' });
  expect(result.status, JSON.stringify(result)).toBe('completed');
  expect(result.reply).toContain('seasonal'); expect(result.reply).not.toContain('official');
  expect(result.reply).not.toContain(workerId); expect(result.reply).not.toContain(otherId);
  expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).searchParams.get('page') === '2')).toBe(true);
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

it('continues a module option through normal interpretation and confirmation without writing', async () => {
  state.includeHr = true;
  state.interpret.mockResolvedValueOnce({ actionId: null, intentType: 'ambiguous', values: {}, clarificationModules: ['hr', 'worker'], clarification: 'Nhân sự hay dự án lao động?' });
  const choice = await turn({ text: 'Cập nhật địa điểm dự án QA thành Địa điểm QA' });
  expect(choice.workflowSelection?.kind).toBe('module');
  const workerOption = choice.workflowSelection!.options.find(option => option.label === 'Quản lý lao động')!;
  state.interpret.mockResolvedValueOnce({ actionId: 'worker.project.update', intentType: 'workflow', values: { path_id: projectId, location: 'Địa điểm QA' } });
  const preview = await turn({ workflowSelection: { id: choice.workflowSelection!.id, value: workerOption.value } });
  expect(preview.status, JSON.stringify(preview)).toBe('confirmation');
  expect(state.interpret.mock.calls[1][0]).toContain('Trong phân hệ Quản lý lao động');
  expect(state.interpret.mock.calls[1][1].every((workflow: any) => workflow.module === 'worker')).toBe(true);
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

it('rechecks module access after an option was issued', async () => {
  state.includeHr = true;
  state.interpret.mockResolvedValueOnce({ actionId: null, intentType: 'ambiguous', values: {}, clarificationModules: ['hr', 'worker'] });
  const choice = await turn({ text: 'Tạo dự án QA' });
  state.includeHr = false; state.includeStudents = false; state.requireWorkerPhone=false;
  const option = choice.workflowSelection!.options.find(item => item.label === 'Nhân sự')!;
  const reply = await turn({ workflowSelection: { id: choice.workflowSelection!.id, value: option.value } });
  expect(reply.status).toBe('failed');
  expect(state.interpret).toHaveBeenCalledTimes(1);
});
it('renews an expired module list without accepting its old option or calling the model again',async()=>{
 state.includeHr=true;
 state.interpret.mockResolvedValueOnce({actionId:null,intentType:'ambiguous',values:{},clarificationModules:['hr','worker']});
 const first=await turn({text:'Tạo dự án QA'}),old=first.workflowSelection!;
 state.session.workflowChoice.expiresAt=Date.now()-1;
 state.includeHr=false;
 const reply=await turn({workflowSelection:{id:old.id,value:old.options[0].value}});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');expect(reply.workflowSelection?.id).not.toBe(old.id);
 expect(reply.workflowSelection?.options.every(option=>option.label!=='Nhân sự')).toBe(true);
 expect(reply.workflowSelection?.options.every(option=>!old.options.some(prior=>prior.value===option.value))).toBe(true);
 expect(state.interpret).toHaveBeenCalledOnce();expect(fetcher).not.toHaveBeenCalled();
});
const kpiOperation = ASSISTANT_OPERATIONS.find(op => op.path === "/worker-management/partners/kpi")!;
it("does not write a legacy student commission value that cannot change the calculated commission", async () => {
  const op = ASSISTANT_OPERATIONS.find(op => op.id === "partner.commission.update")!;
  await expect(callOperation(req, op, { path_id: workerId, commissionType: "percentage", commissionValue: 7 })).rejects.toThrow("không thay đổi kết quả tính");
  expect(fetcher).not.toHaveBeenCalled();
});
it('reads a partner bank account without asking for commission update inputs',async()=>{
  const op=ASSISTANT_OPERATIONS.find(op=>op.path==='/partners/:id' && op.method==='GET')!;
  state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:op.id,values:{path_id:'QA Partner'}});
  fetcher.mockImplementation(async (input:any,init:any)=>{
    expect(init?.method).toBe('GET');
    const path=new URL(String(input)).pathname;
    const record={_id:workerId,name:'QA Partner',phone:'0900000001',isActive:true,bankName:'',bankAccountNo:'',bankAccountName:'',referredStudents:[],totalReferredTuition:0};
    if(path.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'QA Branch'}]});
    if(path.endsWith('/partners'))return json({partners:[record],total:1,page:1});
    if(path.endsWith('/partners/'+workerId))return json({success:true,data:record});
    throw Error('UNEXPECTED_PARTNER_READ:'+path);
  });
  const result=await turn({text:'Đối tác QA Partner đang dùng tài khoản ngân hàng nào để nhận hoa hồng'});
  expect(result.status,result.reply).toBe('completed');
  expect(result.reply).toContain('Chưa cập nhật');
  expect(result.reply).not.toContain('Để cập nhật hoa hồng');
  expect(parseAssistantResultTable(result.reply)).not.toBeNull();
  expect(state.turns.at(-1)?.actionId).toBe(op.id);
  expect(result.reply).not.toContain(workerId);
});
it("does not silently discard a monthly constraint on cumulative student partner data", async () => {
  await useSemanticModel("partner.analysis", { from: "2026-11-01", to: "2026-11-30", analysis: { extreme: { field: "referredStudentsCount", direction: "max" } } });
  const result = await turn({ text: "Đối tác học viên giới thiệu nhiều nhất tháng 11/2026" });
  expect(result.reply).toContain("lũy kế");
  expect(fetcher).not.toHaveBeenCalled();
  expect(result.reply).not.toContain("kết quả:");
});
it("routes a labor partner monthly ranking from QA through the authorized read workflow", async () => {
  const periodField = kpiOperation.fields.find(field => field.apiKey === "periodAnchor")!;
  state.interpret.mockResolvedValueOnce({
    actionId: kpiOperation.id,
    values: { [periodField.key]: "2026-11-01", analysis: { extreme: { field: "actualReferrals", direction: "max" } } },
    intentType: "workflow",
  });
  fetcher.mockImplementationOnce(async (url, init) => {
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/worker-management/partners/kpi");
    expect(parsed.searchParams.get("periodAnchor")).toBe("2026-11-01");
    expect(init?.method).toBe("GET");
    return json({ success: true, data: {
      periodStart: "2026-11-01T00:00:00.000Z", periodEnd: "2026-12-01T00:00:00.000Z",
      items: [
        { partner: { name: "Công ty An", code: "AN" }, targetReferrals: 4, actualReferrals: 7, remainingReferrals: 0, completionRate: 175, status: "achieved" },
        { partner: { name: "Công ty Bình", code: "BI" }, targetReferrals: 5, actualReferrals: 3, remainingReferrals: 2, completionRate: 60, status: "incomplete" },
      ],
    } });
  });

  const result = await turn({ mode: "qa", text: "Trong quản lý lao động, đối tác nào giới thiệu được nhiều lao động nhất trong tháng 11/2026?" });

  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(result.reply).toContain("Công ty An");
  expect(result.reply).toContain("7");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]?.method).toBe("GET");
  expect(state.interpret).toHaveBeenCalledTimes(1);
});

it("reads two authorized workflows and synthesizes only their selected public fields", async () => {
  state.interpret.mockResolvedValueOnce({
    actionId: null,
    values: {},
    intentType: "workflow",
    actionIntent: "report",
    requestCoverage: [
      { evidence: "Trong quản lý lao động", requirement: "Phân hệ quản lý lao động", mappedTo: ["context.module"] },
      { evidence: "liệt kê hồ sơ lao động", requirement: "Liệt kê hồ sơ lao động", mappedTo: ["query:worker.list:result.fullName", "query:worker.list:result.status"] },
      { evidence: "đối tác giới thiệu nhiều lao động nhất tháng 11/2026", requirement: "Xếp hạng đối tác theo số lao động giới thiệu trong tháng 11/2026", mappedTo: [`query:${kpiOperation.id}:values.query_periodAnchor`, `query:${kpiOperation.id}:analysis.extreme.actualReferrals`, `query:${kpiOperation.id}:result.partnerName`, `query:${kpiOperation.id}:result.actualReferrals`] },
    ],
    queryPlan: [
      { actionId: "worker.list", purpose: "Số lượng và trạng thái hồ sơ lao động", values: {}, resultFields: ["fullName", "status"] },
      { actionId: kpiOperation.id, purpose: "Đối tác có số lao động được giới thiệu cao nhất tháng 11/2026", values: { query_periodAnchor: "2026-11-01", analysis: { extreme: { field: "actualReferrals", direction: "max" } } }, resultFields: ["partnerName", "actualReferrals"] },
    ],
  });
  fetcher.mockImplementation(async url => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/worker-management/workers")) {
      return json({ success: true, data: { workers: [{ _id: workerId, fullName: "Nguyễn An", status: "active", phone: "PRIVATE" }] } });
    }
    if (path.endsWith("/worker-management/partners/kpi")) {
      return json({ success: true, data: { periodStart: "2026-11-01T00:00:00.000Z", periodEnd: "2026-12-01T00:00:00.000Z", items: [
        { partner: { name: "Đối tác An", code: "AN" }, targetReferrals: 5, actualReferrals: 8, remainingReferrals: 0, completionRate: 160, status: "achieved" },
        { partner: { name: "QA Đối tác thấp hơn", code: "LOW" }, targetReferrals: 5, actualReferrals: 1, remainingReferrals: 4, completionRate: 20, status: "incomplete" },
      ] } });
    }
    throw new Error(`Unexpected API path ${path}`);
  });
  state.provider.mockResolvedValueOnce({ text: JSON.stringify({
    summary: "Đã tổng hợp hồ sơ lao động và đối tác giới thiệu nhiều nhất.",
    columns: ["Nguồn", "Kết quả"],
    rows: [{ cells: ["Đối tác An", "8 lao động"] }],
    limitations: [],
  }) });

  const result = await turn({ text: "Trong quản lý lao động, liệt kê hồ sơ lao động và đối tác giới thiệu nhiều lao động nhất tháng 11/2026" });

  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
    "/api/v1/worker-management/workers",
    "/api/v1/worker-management/partners/kpi",
  ]);
  expect(result.reply).toContain("Đối tác An");
  expect(result.reply).not.toContain("PRIVATE");
  expect(state.provider.mock.calls.map(([args])=>args.messages?.at(-1)?.content).join('\n')).not.toContain('QA Đối tác thấp hơn');
  expect(result.reply).toContain('Nguyễn An');
  expect(parseAssistantResultTable(result.reply)?.rows).toHaveLength(4);
  expect(state.provider).not.toHaveBeenCalled();
  expect(state.turns.at(-1).steps.every((step: any) => step.status === "completed")).toBe(true);
});

it("ranks all student partner pages, including a winner on the next page, with an explicit cumulative scope", async () => {
  await useSemanticModel("partner.analysis", { analysis: { extreme: { field: "referredStudentsCount", direction: "max" } } });
  const partner = (id: string, name: string, count: number) => ({ _id: id, name, levelName: "Bạc", referredStudentsCount: count, totalReferredTuition: count * 1000000, totalCommission: count * 10000, totalPaid: 0, unpaidBalance: count * 10000, bankAccountNo: "PRIVATE" });
  fetcher.mockImplementation(async (url, init) => {
    expect(init?.method).toBe("GET");
    const query = new URL(String(url)).searchParams;
    expect(query.has("analysis")).toBe(false);
    expect(query.has("query_periodAnchor")).toBe(false);
    const page = Number(query.get("page"));
    return json({ success: true, page, total: 3, partners: page === 1 ? [partner("a", "An", 2), partner("b", "Bình", 0)] : [partner("c", "Chi", 9)] });
  });
  const result = await turn({ text: "Đối tác học viên nào giới thiệu nhiều học viên nhất từ trước đến nay?" });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Đối tác"])).toEqual(["Chi"]);
  expect(result.reply).toContain("lũy kế");
  expect(result.reply).not.toContain("PRIVATE");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("analyzes retail net commission by date range without treating entries as orders or KPI targets", async () => {
  const op = ASSISTANT_OPERATIONS.find(op => op.path === "/retail/finance/commission/kpi")!;
  await useSemanticModel(op.id, { from: "2026-11-01", to: "2026-11-30", analysis: { filters: [{ field: "commission", operator: "gte", value: 500000 }], sort: { field: "commission", direction: "desc" } } });
  fetcher.mockImplementation(async (url, init) => {
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/retail/finance/commission/kpi");
    expect(parsed.searchParams.get("from")).toBe("2026-11-01");
    expect(parsed.searchParams.get("to")).toBe("2026-11-30");
    expect(init?.method).toBe("GET");
    return json({ success: true, data: [{ partnerName: "An", partnerCode: "A", commission: 700000, sources: 3 }, { partnerName: "Bình", partnerCode: "B", commission: 0, sources: 0 }] });
  });
  const result = await turn({ text: "Đối tác bán lẻ có hoa hồng tháng 11/2026 ít nhất 500 nghìn, sắp giảm dần" });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(result.reply).toContain("01/11/2026");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Đối tác"])).toEqual(["An"]);
  expect(result.reply).toContain("Số bút toán hoa hồng");
  expect(result.reply).not.toContain("Số đơn hàng");
});

it.each([
  ["/partners/commission-levels/:id", "partner.commission.levels.list", { name: "Bạc", minTuition: 10000000, commissionRate: 5 }, { commissionRate: 7 }, "Sửa tỷ lệ hoa hồng cấp Bạc thành 7%", { commissionRate: 7, minTuition: 10000000, name: "Bạc" }],
  ["/retail/partners/commission-policies/:id", "retail.partner.commission.policy.list", { effectiveAt: "2026-12-01T00:00:00.000Z", config: { phoneAmount: 250000, accessoryBps: 1000, repairBps: 1100 }, partnerId: "" }, { config: { accessoryBps: 1200 } }, "Sửa hoa hồng phụ kiện thành 12%", { config: { phoneAmount: 250000, accessoryBps: 1200, repairBps: 1100 } }],
])("partially updates partner commission configuration at %s", async (path, _listId, existing, change, text, expected) => {
  const op = ASSISTANT_OPERATIONS.find(op => op.path === path && op.method === "PATCH")!;
  const id = "64b000000000000000000096";
  let record = { id, _id: id, ...existing };
  let writes = 0;
  fetcher.mockImplementation(async (url, init) => {
    const pathname = new URL(String(url)).pathname;
    if (init?.method === "PATCH") { writes++; record = { ...record, ...JSON.parse(String(init.body)) }; return json({ success: true, data: record }); }
    return json({ success: true, data: pathname.includes("retail") ? { items: [record], legacy: [] } : [record] });
  });
  await useSemanticModel(op.id, change);
  const selection = await turn({ text });
  expect(selection.status, JSON.stringify(selection)).toBe("collecting");
  const choice = selection.referenceSelections?.find(group => group.key === "path_id")?.options[0];
  expect(choice, JSON.stringify(selection)).toBeDefined();
  if (path.includes("retail")) expect(choice!.label).toContain("Chính sách chung");
  const preview = await turn({ referenceSelections: { path_id: [choice!.value] } });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(writes).toBe(0);
  const saved = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(saved.status, JSON.stringify(saved)).toBe("completed");
  expect(record).toMatchObject(expected);
  expect(writes).toBe(1);
  expect(parseAssistantResultTable(saved.reply)).not.toBeNull();
});
it.each([
  ["Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", { extreme: { field: "actualReferrals", direction: "max" } }, ["An", "Bình"]],
  ["Đối tác nào giới thiệu được ít lao động nhất trong tháng", { extreme: { field: "actualReferrals", direction: "min" } }, ["Dung"]],
  ["Đối tác nào đang thiếu KPI tháng", { filters: [{ field: "status", operator: "eq", value: "incomplete" }] }, ["Chi"]],
  ["Các đối tác nào đã đạt đủ KPI", { filters: [{ field: "status", operator: "eq", value: "achieved" }] }, ["An", "Bình"]],
  ["Đối tác chưa đạt KPI nhưng đã giới thiệu ít nhất 3 lao động, xếp giảm dần", { filters: [{ field: "status", operator: "eq", value: "incomplete" }, { field: "actualReferrals", operator: "gte", value: 3 }], sort: { field: "actualReferrals", direction: "desc" } }, ["Chi"]],
])("executes declared analysis through the shared conversation: %s", async (question, analysis, names) => {
  await useSemanticModel(kpiOperation.id, { query_periodAnchor: "2026-11-01", analysis });
  fetcher.mockImplementation(async (url, init) => {
    expect(init?.method).toBe("GET");
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/worker-management/partners/kpi");
    expect(parsed.searchParams.get("periodAnchor")).toBe("2026-11-01");
    expect(parsed.searchParams.has("analysis")).toBe(false);
    return json({ success: true, data: { periodStart: "2026-11-01", periodEnd: "2026-12-01", items: [
      { partner: { name: "An", code: "A" }, actualReferrals: 10, targetReferrals: 5, remainingReferrals: 0, completionRate: 200, status: "achieved" },
      { partner: { name: "Bình", code: "B" }, actualReferrals: 10, targetReferrals: 10, remainingReferrals: 0, completionRate: 100, status: "achieved" },
      { partner: { name: "Chi", code: "C" }, actualReferrals: 3, targetReferrals: 5, remainingReferrals: 2, completionRate: 60, status: "incomplete" },
      { partner: { name: "Dung", code: "D" }, actualReferrals: 0, targetReferrals: 0, remainingReferrals: null, completionRate: null, status: "not_set" },
    ] } });
  });
  const result = await turn({ text: `Trong quản lí lao động, ${question}` });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  const table = parseAssistantResultTable(result.reply)!;
  expect(table.rows.map(row => row.values["Đối tác"])).toEqual(names);
  expect(result.reply).toContain("11/2026");
  expect(state.turns.at(-1).steps.at(-1).status).toBe("completed");
});

it("ranks worker referrals from the user's wording when the model omits the analysis plan", async () => {
  await useSemanticModel(kpiOperation.id, { query_periodAnchor: "2026-11-01" });
  fetcher.mockImplementation(async (url, init) => {
    expect(init?.method).toBe("GET");
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/worker-management/partners/kpi");
    return json({ success: true, data: { periodStart: "2026-11-01", periodEnd: "2026-12-01", items: [
      { partner: { name: "An", code: "A" }, actualReferrals: 10, targetReferrals: 5, remainingReferrals: 0, completionRate: 200, status: "achieved" },
      { partner: { name: "Bình", code: "B" }, actualReferrals: 4, targetReferrals: 10, remainingReferrals: 6, completionRate: 40, status: "incomplete" },
    ] } });
  });
  const result = await turn({ text: "Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng" });
  expect(result.status, JSON.stringify(result)).toBe("completed");
  expect(parseAssistantResultTable(result.reply)?.rows.map(row => row.values["Đối tác"])).toEqual(["An"]);
  expect(parseAssistantResultTable(result.reply)?.rows[0]?.values["Đã giới thiệu"]).toBe("10");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("asks which metric to compare instead of returning an unranked KPI report", async () => {
  await useSemanticModel(kpiOperation.id, { query_periodAnchor: "2026-11-01" });
  const result = await turn({ text: "Đối tác nào nhiều nhất trong tháng?" });
  expect(result.status, JSON.stringify(result)).toBe("collecting");
  expect(result.reply).toContain("Bạn muốn so sánh theo chỉ tiêu nào?");
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([false, true])("merges a nested policy edit and checks the confirmation snapshot (concurrent change=%s)", async concurrentChange => {
  const op = ASSISTANT_OPERATIONS.find(op => op.partialUpdate && op.module === "labor-partner")!;
  const policyId = "64b000000000000000000099";
  let policy: any = { id: policyId, _id: policyId, name: "Chính sách cuối năm", effectiveFrom: "2026-12-01", version: 1, status: "active", settlementCycle: { type: "calendar_month", cutoffDay: null }, official: { enabled: true, maxMonths: 3, milestones: [1, 2, 3].map(month => ({ month, amount: 100000 * month, eligibilityRule: "contract_active" })) }, seasonal: { enabled: false, tiers: [] } };
  const original = structuredClone(policy);
  let writes = 0;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/policies")) return json({ success: true, data: [policy] });
    if (path.endsWith(`/policies/${policyId}`) && init?.method === "PATCH") {
      writes++; policy = { ...policy, ...JSON.parse(String(init.body)) };
      if (policy.settlementCycle.type === "calendar_month") policy.settlementCycle.cutoffDay = null;
      return json({ success: true, data: policy });
    }
    if (path.endsWith(`/policies/${policyId}`)) return json({ success: true, data: policy });
    throw new Error(`Unexpected ${path}`);
  });
  await useSemanticModel(op.id, { official: { maxMonths: 2 } });
  const selection = await turn({ text: "Trong quản lý lao động, chỉnh sửa chính sách phần Số mốc tháng thành 2 tháng" });
  expect(selection.status, JSON.stringify(selection)).toBe("collecting");
  expect(selection.reply).not.toContain("Trường không được hỗ trợ");
  expect(selection.referenceSelections).toHaveLength(1);
  const policyChoice = selection.referenceSelections?.find(group => group.key === "path_policyId")?.options[0];
  expect(policyChoice, JSON.stringify(selection)).toBeDefined();
  const preview = await turn({ referenceSelections: { path_policyId: [policyChoice!.value] } });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  expect(JSON.parse(String(state.session.pending.provided.official))).toEqual({ maxMonths: 2 });
  expect(writes).toBe(0);
  if (concurrentChange) policy.official.milestones[0].amount = 999999;
  const saved = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  if (concurrentChange) {
    expect(saved.status).toBe("failed");
    expect(saved.reply).toContain("đã thay đổi");
    expect(writes).toBe(0);
    return;
  }
  expect(saved.status, JSON.stringify(saved)).toBe("completed");
  expect(writes).toBe(1);
  expect(policy.official.milestones).toEqual(original.official.milestones.slice(0, 2));
  expect(policy.official.maxMonths).toBe(2);
  expect(policy.seasonal).toEqual(original.seasonal);
  expect(policy.settlementCycle).toEqual(original.settlementCycle);
  expect(parseAssistantResultTable(saved.reply)).not.toBeNull();
});

it("collects missing commission rules instead of inventing them for a named new policy", async () => {
  const op = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/worker-management/partners/policies")!;
  await useSemanticModel(op.id, { name: "Chính sách lao động cuối năm", effectiveFrom: "2026-12-01" });
  const result = await turn({ text: "Thêm 1 chính sách hoa hồng mới - Chính sách lao động cuối năm, áp dụng từ 1/12/2026" });
  expect(result.status, JSON.stringify(result)).toBe("collecting");
  expect(state.session.pending.provided).toMatchObject({ name: "Chính sách lao động cuối năm", effectiveFrom: "2026-12-01" });
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  expect(result.referenceSelections?.some(group => group.key === "laborPolicyTypes")).toBe(true);
  const policyId = "64b000000000000000000098";
  let policy: any;
  let creations = 0;
  fetcher.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/policies") && init?.method === "POST") {
      creations++;
      policy = { id: policyId, _id: policyId, ...JSON.parse(String(init.body)), status: "active", version: 1 };
      return json({ success: true, data: policy });
    }
    if (path.endsWith("/policies")) return json({ success: true, data: [policy] });
    if (path.endsWith(`/policies/${policyId}`) && init?.method === "PATCH") Object.assign(policy, JSON.parse(String(init.body)));
    if (path.endsWith(`/policies/${policyId}`)) return json({ success: true, data: policy });
    throw new Error(`Unexpected ${path}`);
  });
  await useSemanticModel(op.id, { settlementCycle: { type: "calendar_month" }, official: { enabled: true, maxMonths: 1, milestones: [{ month: 1, amount: 300000, eligibilityRule: "contract_active" }] }, seasonal: { enabled: false, tiers: [] } });
  const preview = await turn({ text: "Áp dụng lao động chính thức 1 tháng, hoa hồng 300000 khi hợp đồng còn hiệu lực, đối soát tháng dương lịch. Không áp dụng thời vụ." });
  expect(preview.status, JSON.stringify(preview)).toBe("confirmation");
  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status, JSON.stringify(created)).toBe("completed");
  expect(created.reply).toMatch(/Bạn có muốn bổ sung(?: [^?\n]+)? không\?/);
  expect(parseAssistantResultTable(created.reply)).not.toBeNull();
  expect(policy.name).toBe("Chính sách lao động cuối năm");
  const update = ASSISTANT_OPERATIONS.find(candidate => candidate.partialUpdate && candidate.module === "labor-partner")!;
  await useSemanticModel(update.id, { path_policyId: policyId, effectiveTo: "2026-12-31" });
  const updatePreview = await turn({ text: "Có, bổ sung ngày kết thúc hiệu lực 31/12/2026" });
  expect(updatePreview.status, JSON.stringify(updatePreview)).toBe("confirmation");
  const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
  expect(updated.status, JSON.stringify(updated)).toBe("completed");
  expect(policy.effectiveTo).toBe("2026-12-31");
  expect(creations).toBe(1);
});

beforeEach(() => {
  state.includeHr = false; state.includeStudents = false; state.requireWorkerPhone=false;state.alwaysConfirm=true;
  state.session = null; state.turns = []; state.interpret.mockReset(); state.provider.mockReset();state.fit.mockReset();
  savedWorker = undefined;
  fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/worker-management/projects") return json({ success: true, data: [{ _id: projectId, id: projectId, code: "P-10", name: "Dự án lắp đặt", status: "active" }] });
    if (path === "/api/v1/worker-management/workers" && init?.method === "POST") {
      const body = JSON.parse(String(init.body || "{}"));
      savedWorker = { _id: workerId, id: workerId, ...body, status: body.status || "active", laborType: body.laborType || "official" };
      return json({ worker: savedWorker });
    }
    if (path === "/api/v1/worker-management/workers") return json({ workers: [savedWorker || { _id: workerId, id: workerId, fullName: "Lê Minh", status: "active", laborType: "seasonal" }] });
    if (path === `/api/v1/worker-management/workers/${workerId}` && init?.method === "PATCH") {
      Object.assign(savedWorker || {}, JSON.parse(String(init.body || "{}")));
      return json({ worker: savedWorker });
    }
    if (path === "/api/v1/worker-management/labor-contracts") return json({ success: true, data: [{
      _id: contractId, id: contractId, code: "LD-10", clientName: "Công ty Igen", workerId,
      startDate: "2026-01-01", endDate: "2026-12-31", status: "active",
    }] });
    throw new Error(`Unexpected API: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});

it("lets the user choose a contract by its worker and contract code before confirming deletion", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.labor.contract.delete", values: {}, intentType: "workflow", newRequest: true });

  const selectionPrompt = await turn({ text: "Xóa hợp đồng lao động" });
  expect(selectionPrompt.status).toBe("collecting");
  const contractSelection = selectionPrompt.referenceSelections?.find(group => group.key === "path_id");
  expect(contractSelection?.options.map(option => option.label)).toContain("Lê Minh — mã LD-10");
  expect(selectionPrompt.reply).not.toContain(contractId);

  const preview = await turn({ referenceSelections: { path_id: [contractSelection!.options[0].value] } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Xóa hợp đồng lao động");
  expect(JSON.stringify(preview)).toContain("Lê Minh — mã LD-10");
  expect(JSON.stringify(preview)).not.toContain(contractId);
  expect(fetcher.mock.calls.every(([url]) => !new URL(String(url)).pathname.includes("/renew"))).toBe(true);
});

it.each([false, true])("creates a worker, skips optional references, and updates that same worker (form=%s)", async form => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.create", values: { fullName: "Lê Minh", phone: "0900000000" }, intentType: "workflow" });

  const projectLabel=operationById('worker.create')!.fields.find(field=>field.key==='projectId')!.label;
  const optionalProjectPrompt = await turn({ text: `Tạo hồ sơ lao động cho Lê Minh, số điện thoại 0900000000, mình muốn chọn ${projectLabel}` });
  expect(optionalProjectPrompt.status).toBe("collecting");
  expect(optionalProjectPrompt.referenceSelections?.find(group => group.key === "projectId")?.required).toBe(false);
  const preview = await turn(form
    ? { formValues: { id: optionalProjectPrompt.inputForm!.id, values: {}, skipReferenceKeys: ["projectId"] } }
    : { skipReferenceKeys: ["projectId"] });
  expect(preview.status).toBe("confirmation");
  expect(savedWorker).toBeUndefined();

  const created = await turn({ decision: { id: preview.action!.id, confirmed: true } });
  expect(created.status).toBe("completed");
  expect(created.reply).toMatch(/Bạn có muốn bổ sung(?: [^?\n]+)? không\?/);
  expect(savedWorker?.fullName).toBe("Lê Minh");
  expect(parseAssistantResultTable(created.reply)?.rows[0]?.values).toMatchObject({ "Họ và tên": "Lê Minh" });

  const agreed = await turn({ text: "Có" });
  expect(agreed.status).toBe("collecting");
  state.interpret.mockResolvedValueOnce({ actionId: "worker.update", values: { email: "leminh@example.com", address: "Hà Nội" }, intentType: "workflow" });
  const updatePreview = await turn({ text: "Thêm email leminh@example.com, địa chỉ Hà Nội cho lao động vừa tạo" });
  expect(updatePreview.status).toBe("confirmation");
  expect(JSON.stringify(updatePreview)).not.toContain(workerId);

  const updated = await turn({ decision: { id: updatePreview.action!.id, confirmed: true } });
  expect(updated.status).toBe("completed");
  expect(savedWorker).toMatchObject({ fullName: "Lê Minh", email: "leminh@example.com" });
  expect(parseAssistantResultTable(updated.reply)?.rows[0]?.values).toMatchObject({ "Họ và tên": "Lê Minh", Email: "leminh@example.com", "Địa chỉ": "Hà Nội" });
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === "/api/v1/worker-management/workers" && init?.method === "POST")).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === `/api/v1/worker-management/workers/${workerId}` && init?.method === "PATCH")).toHaveLength(1);
});
afterEach(() => { vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});

it('keeps semantic creation in the shared option/form and confirmation flow without writing',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');
  state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units)return {text:JSON.stringify({version:1,units:[
      {id:'u1',kind:'goal',quote:'Thêm lao động',concept:'Tạo hồ sơ lao động',operator:'create',value:null},
      {id:'u2',kind:'input',quote:'QA Ctx',concept:'Họ tên',operator:'eq',value:'QA Ctx'},
      {id:'u3',kind:'input',quote:'0900000000',concept:'Điện thoại',operator:'eq',value:'0900000000'},
    ]})};
    if(properties.modules)return {text:JSON.stringify({modules:['worker']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:[`worker:${ASSISTANT_OPERATIONS.find(op=>op.id==='worker.create')!.assistantMetadata!.featureKey}`],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:['worker.create']})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'worker.create',actionIntent:'create',values:{fullName:'QA Ctx',phone:'0900000000'},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.fullName']},{unitId:'u3',targets:['values.phone']}]})};
  });
  const preview=await turn({text:'Thêm lao động QA Ctx 0900000000'});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  expect(preview.referenceSelections).toBeUndefined();
  expect(savedWorker).toBeUndefined();
  expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});

it('collects only missing required data and preserves verified intent across form and confirmation turns',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');state.includeHr=true;state.requireWorkerPhone=true;state.alwaysConfirm=false;
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');
  state.interpret.mockImplementation(actual.interpretRequest);
  const name='QA trong phân hệ Nhân sự';
  state.provider.mockImplementation(async input=>{
    const p=input.responseSchema?.properties||{};
    if(p.units)return {text:JSON.stringify({version:1,units:[{id:'u1',kind:'goal',quote:'Thêm lao động',concept:'Tạo hồ sơ lao động',operator:'create',value:null},{id:'u2',kind:'input',quote:name,concept:'Họ tên',operator:'eq',value:name}]})};
    if(p.featureKeys)return {text:JSON.stringify({featureKeys:[`worker:${operationById('worker.create')!.assistantMetadata!.featureKey}`],decision:'search',question:'',unavailableModule:null})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'worker.create',actionIntent:'create',values:{fullName:name},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.fullName']}]})};
  });
  const collecting=await turn({text:`Thêm lao động tên ${name}`});
  expect(collecting.status,JSON.stringify(collecting)).toBe('collecting');
  expect(collecting.inputForm?.fields.some(field=>field.key==='phone'&&field.required)).toBe(true);
  expect(collecting.referenceSelections?.some(group=>group.key==='projectId')).not.toBe(true);
  expect(state.session.pending.semanticExecution?.actionId).toBe('worker.create');
  const preview=await turn({formValues:{id:collecting.inputForm!.id,values:{phone:'0900000000'}}});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');expect(savedWorker).toBeUndefined();
  const completed=await turn({decision:{id:preview.action!.id,confirmed:true}});
  expect(completed.status,JSON.stringify(completed)).toBe('completed');expect(savedWorker?.fullName).toBe(name);
  expect(completed.reply).toMatch(/Bạn có muốn bổ sung/);
  expect(fetcher.mock.calls.filter(([url,init])=>new URL(String(url)).pathname.endsWith('/worker-management/workers')&&init?.method==='POST')).toHaveLength(1);
});

it('uses semantic requested inputs to offer an optional reference without matching its field label in the sentence',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const p=input.responseSchema?.properties||{};
    if(p.units)return {text:JSON.stringify({version:1,units:[{id:'u1',kind:'goal',quote:'Thêm lao động',concept:'Tạo hồ sơ',operator:'create',value:null},{id:'u2',kind:'input',quote:'QA Mới',concept:'Tên',operator:'eq',value:'QA Mới'},{id:'u3',kind:'reference',quote:'chọn chỗ làm',concept:'Dự án làm việc',operator:'eq',value:null}]})};
    if(p.featureKeys)return {text:JSON.stringify({featureKeys:[`worker:${operationById('worker.create')!.assistantMetadata!.featureKey}`],decision:'search',question:'',unavailableModule:null})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'worker.create',actionIntent:'create',values:{fullName:'QA Mới'},meaningBindings:[{unitId:'u1',targets:['action']},{unitId:'u2',targets:['values.fullName']},{unitId:'u3',targets:['values.projectId']}]})};
  });
  const collecting=await turn({text:'Thêm lao động QA Mới, chọn chỗ làm giúp mình'});
  expect(collecting.status,JSON.stringify(collecting)).toBe('collecting');
  const group=collecting.referenceSelections?.find(group=>group.key==='projectId');expect(group?.options.length).toBeGreaterThan(0);
  expect(state.session.pending.provided.projectId).toBeUndefined();expect(savedWorker).toBeUndefined();
  const preview=await turn({referenceSelections:{projectId:[group!.options[0].value]}});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');expect(savedWorker).toBeUndefined();
});

it('completes a semantic read through shared dispatch and renders the public result table',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');
  state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units)return {text:JSON.stringify({version:1,units:[
      {id:'u1',kind:'ordering',quote:'Gần nhất',concept:'Ngày chi gần nhất',operator:'max',value:null,dimension:'temporal'},
      {id:'u2',kind:'goal',quote:'chi cho đối tác tuyển sinh',concept:'Tra cứu khoản chi',operator:'report',value:null},
      {id:'u3',kind:'output',quote:'ai nhận',concept:'Người nhận',operator:'none',value:null},
    ]})};
    if(properties.modules)return {text:JSON.stringify({modules:['student-partner']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:['student-partner:partner-payouts'],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:['partner.payouts.analysis']})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'partner.payouts.analysis',actionIntent:'report',values:{analysis:{extreme:{field:'paidOn',direction:'max'},select:['partnerName']}},meaningBindings:[{unitId:'u1',targets:['analysis.extreme.paidOn']},{unitId:'u2',targets:['action']},{unitId:'u3',targets:['result.partnerName']}]})};
  });
  fetcher.mockImplementation(async(input,init)=>{
    expect(init?.method).toBe('GET');
    expect(new URL(String(input)).pathname).toBe('/api/v1/partners/payout-history');
    return json({success:true,analysisComplete:true,data:[{partnerName:'QA Ctx',paidOn:'2026-11-25',amount:1,method:'Tiền mặt'}]});
  });
  const result=await turn({text:'Gần nhất chi cho đối tác tuyển sinh ai nhận'});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(parseAssistantResultTable(result.reply)?.rows[0]?.values).toMatchObject({'Đối tác':'QA Ctx'});
  expect(state.turns.at(-1).steps.every((step:any)=>step.status==='completed')).toBe(true);
  expect(fetcher).toHaveBeenCalledOnce();
});

it('lists students for a clear request using a normal actionId binding instead of asking to clarify presentation',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');state.includeStudents=true;
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  const op=ASSISTANT_OPERATIONS.find(op=>op.id==='student.list')!;
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units)return {text:JSON.stringify({version:1,units:[{id:'u1',kind:'goal',quote:'đưa ra danh sách học viên',concept:'Trình bày danh sách',operator:'lookup',value:null,dimension:'none'}]})};
    if(properties.modules)return {text:JSON.stringify({modules:['student']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:[`${op.module}:${op.assistantMetadata!.featureKey}`],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:[op.id]})};
    return {text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{},meaningBindings:[{unitId:'u1',targets:['actionId','context.module']}]})};
  });
  fetcher.mockImplementation(async(url,init)=>{
    expect(init?.method).toBe('GET');expect(new URL(String(url)).pathname).toBe('/api/v1/students');
    return json({success:true,students:[{_id:'64b000000000000000000051',fullName:'QA Học viên Một',phone:'0900090001'}],total:1,page:1,limit:20});
  });
  const reply=await turn({text:'đưa ra danh sách học viên'});
  expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('QA Học viên Một');
  expect(parseAssistantResultTable(reply.reply)?.rows).toHaveLength(1);
  expect(reply.reply).not.toContain('cần làm rõ');expect(fetcher).toHaveBeenCalledOnce();
});

it('reports an internal planning failure after one repair without blaming the user or dispatching an API',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');state.includeStudents=true;
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  const op=ASSISTANT_OPERATIONS.find(op=>op.id==='student.list')!;let plans=0,meanings=0;
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units){meanings++;return {text:JSON.stringify({version:1,units:[{id:'u1',kind:'goal',quote:'đưa ra danh sách học viên',concept:'Trình bày danh sách',operator:'lookup',value:null,dimension:'none'}]})};}
    if(properties.modules)return {text:JSON.stringify({modules:['student']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:[`${op.module}:${op.assistantMetadata!.featureKey}`],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:[op.id]})};
    plans++;return {text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'lookup',values:{},meaningBindings:[{unitId:'u1',targets:['result.fullName']}]})};
  });
  const reply=await turn({text:'đưa ra danh sách học viên'});
  expect(reply.status,JSON.stringify(reply)).toBe('failed');expect(reply.reply).toContain('lỗi khi lập phương án');
  expect(reply.reply).not.toMatch(/cần làm rõ|cấp quyền|Mở tab|tên màn hình/);expect(fetcher).not.toHaveBeenCalled();
  expect(plans).toBe(2);expect(meanings).toBe(1);
});

it('reads a named partner referral history with equivalent goal bindings and completes the public student table',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units)return {text:JSON.stringify({version:1,units:[
      {id:'u1',kind:'goal',quote:'Xem lịch sử giới thiệu học viên',concept:'Tra cứu lịch sử',operator:'lookup',value:null,dimension:'none'},
      {id:'u2',kind:'reference',quote:'của đối tác QA Partner',concept:'Đối tác tuyển sinh',operator:'eq',value:'QA Partner',dimension:'none'},
    ]})};
    if(properties.modules)return {text:JSON.stringify({modules:['student-partner']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:['student-partner:partner-records'],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:['partner.referrals']})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'partner.referrals',actionIntent:'lookup',values:{path_id:'QA Partner'},meaningBindings:[{unitId:'u1',targets:['actionId','context.module']},{unitId:'u2',targets:['values.path_id']}]})};
  });
  const partnerId='64b000000000000000000061';
  fetcher.mockImplementation(async(url,init)=>{
    expect(init?.method).toBe('GET');const path=new URL(String(url)).pathname;
    if(path==='/api/v1/partners')return json({success:true,partners:[{_id:partnerId,name:'QA Partner',phone:'0900090001'}],total:1,page:1});
    if(path===`/api/v1/partners/${partnerId}`)return json({success:true,data:{name:'QA Partner',referredStudents:[{fullName:'QA Học viên Một',registrationDate:'20/11/2026',fee:1000000},{fullName:'QA Học viên Hai',registrationDate:'21/11/2026',fee:2000000}],totalReferredTuition:3000000}});
    throw Error('Unexpected route '+path);
  });
  const reply=await turn({text:'Xem lịch sử giới thiệu học viên của đối tác QA Partner'});
  expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('QA Học viên Một');expect(reply.reply).toContain('QA Học viên Hai');
  expect(parseAssistantResultTable(reply.reply)?.rows).toHaveLength(2);expect(reply.reply).not.toContain(partnerId);
});

it('rejects a wrong entity source, recovers globally and only dispatches the approved referral read',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');state.includeStudents=true;let plans=0;
  state.fit.mockResolvedValue({text:JSON.stringify({approvedActionIds:['partner.referrals'],question:''})});
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units)return {text:JSON.stringify({version:1,units:[
      {id:'u1',kind:'goal',quote:'Xem lịch sử giới thiệu học viên',concept:'Tra cứu lịch sử',operator:'lookup',value:null,dimension:'none'},
      {id:'u2',kind:'reference',quote:'của đối tác QA Partner',concept:'Đối tác tuyển sinh',operator:'eq',value:'QA Partner',dimension:'none'},
    ]})};
    if(properties.modules)return {text:JSON.stringify({modules:['student-partner']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:['student:students'],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:['partner.referrals']})};
    plans++;return {text:JSON.stringify({intentType:'workflow',actionId:plans===1?'student.list':'partner.referrals',actionIntent:'lookup',values:{path_id:'QA Partner'},meaningBindings:[{unitId:'u1',targets:['actionId','context.module']},{unitId:'u2',targets:['values.path_id']}]})};
  });
  const partnerId='64b000000000000000000061';
  fetcher.mockImplementation(async(url,init)=>{
    expect(init?.method).toBe('GET');const path=new URL(String(url)).pathname;
    if(path==='/api/v1/partners')return json({success:true,partners:[{_id:partnerId,name:'QA Partner',phone:'0900090001'}],total:1,page:1});
    if(path===`/api/v1/partners/${partnerId}`)return json({success:true,data:{name:'QA Partner',referredStudents:[{fullName:'QA Học viên Một',registrationDate:'20/11/2026',fee:1000000},{fullName:'QA Học viên Hai',registrationDate:'21/11/2026',fee:2000000}],totalReferredTuition:3000000}});
    throw Error('Unexpected route '+path);
  });
  const reply=await turn({text:'Xem lịch sử giới thiệu học viên của đối tác QA Partner'});
  expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('QA Học viên Một');expect(reply.reply).toContain('QA Học viên Hai');
  expect(plans).toBe(2);expect(state.fit).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.every(([url])=>!new URL(String(url)).pathname.endsWith('/students'))).toBe(true);
  expect(parseAssistantResultTable(reply.reply)?.rows).toHaveLength(2);expect(reply.reply).not.toContain(partnerId);
});

it('rechecks the server-only semantic proof for a composite read instead of applying legacy word coverage',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const properties=input.responseSchema?.properties||{};
    if(properties.units)return {text:JSON.stringify({version:1,units:[{id:'u1',kind:'goal',quote:'Tra cứu lao động',concept:'Xem hồ sơ',operator:'lookup',value:null,dimension:'none'},{id:'u2',kind:'condition',quote:'chưa có hợp đồng',concept:'Thiếu quan hệ hợp đồng',operator:'not_exists',value:null,dimension:'none'}]})};
    if(properties.modules)return {text:JSON.stringify({modules:['worker']})};
    if(properties.featureKeys)return {text:JSON.stringify({featureKeys:[...new Set(['worker.list','worker.labor.contract.list'].map(id=>`worker:${ASSISTANT_OPERATIONS.find(op=>op.id===id)!.assistantMetadata!.featureKey}`))],ambiguous:false,clarification:''})};
    if(properties.actionIds)return {text:JSON.stringify({actionIds:['worker.list','worker.labor.contract.list']})};
    return {text:JSON.stringify({intentType:'workflow',actionId:null,actionIntent:'report',values:{},queryPlan:[{actionId:'worker.list',purpose:'Lao động',values:{},resultFields:['fullName'],relation:'workers-without-contracts'},{actionId:'worker.labor.contract.list',purpose:'Hợp đồng',values:{},resultFields:['workerName']}],meaningBindings:[{unitId:'u1',targets:['query:worker.list:actionId']},{unitId:'u2',targets:['query:worker.list:relation']}]})};
  });
  fetcher.mockImplementation(async(url,init)=>{
    expect(init?.method).toBe('GET');const path=new URL(String(url)).pathname;
    if(path.endsWith('/workers'))return json({workers:[{_id:workerId,fullName:'QA Có hợp đồng'},{_id:'64b000000000000000000099',fullName:'QA Thiếu hợp đồng'}]});
    if(path.endsWith('/labor-contracts'))return json({success:true,data:[{_id:contractId,workerId,workerName:'QA Có hợp đồng'}],total:1,page:1,limit:100});
    throw Error('Unexpected route '+path);
  });
  const reply=await turn({text:'Tra cứu lao động chưa có hợp đồng'});
  expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('QA Thiếu hợp đồng');expect(reply.reply).not.toContain('QA Có hợp đồng');
});
it.each([
  ["Đổi địa điểm Dự án lắp đặt thành Hà Nội", {location: "Hà Nội"}],
  ["Dời ngày kết thúc Dự án lắp đặt sang 30/12/2026", {endDate: "2026-12-30"}],
])("does not require unrelated workers or weekdays on partial project updates: %s", async (text, values) => {
  state.interpret.mockResolvedValueOnce({actionId:"worker.project.update",values:{path_id:"Dự án lắp đặt",...values},intentType:"workflow"});
  const preview=await turn({text});
  expect(preview.status,preview.reply).toBe("confirmation");
  expect(preview.referenceSelections).toBeUndefined();
  expect(state.session.pending.resolved).not.toHaveProperty("workerIds");
  expect(state.session.pending.resolved).not.toHaveProperty("daysOfWeek");
});

it("lets the user choose a project and a worker in chat before confirming the assignment", async () => {
  state.interpret.mockResolvedValueOnce({ actionId: "worker.project.worker.add", values: {}, intentType: "workflow", newRequest: true });

  const projectPrompt = await turn({ text: "Thêm lao động vào dự án" });
  expect(projectPrompt.status).toBe("collecting");
  const projectSelection = projectPrompt.referenceSelections?.find(group => group.key === "path_id");
  expect(projectSelection?.options.map(option => option.label)).toContain("Dự án lắp đặt — mã P-10");
  const workerSelection = projectPrompt.referenceSelections?.find(group => group.key === "workerId");
  expect(workerSelection?.options.map(option => option.label)).toContain("Lê Minh");
  expect(projectPrompt.reply).not.toContain(projectId);

  const preview = await turn({ referenceSelections: {
    path_id: [projectSelection!.options[0].value],
    workerId: [workerSelection!.options[0].value],
  } });
  expect(preview.status).toBe("confirmation");
  expect(preview.action?.title).toBe("Thêm lao động vào dự án");
  expect(JSON.stringify(preview)).toContain("Dự án lắp đặt");
  expect(JSON.stringify(preview)).toContain("Lê Minh");
  expect(JSON.stringify(preview)).not.toContain(projectId);
  expect(JSON.stringify(preview)).not.toContain(workerId);
  expect(fetcher.mock.calls.every(([url]) => ["/api/v1/worker-management/projects", "/api/v1/worker-management/workers"].includes(new URL(String(url)).pathname))).toBe(true);
});


it('corrects a draft, pauses for an unrelated read, resumes with a fresh preview and cancels without business writes',async()=>{
  vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
  state.interpret.mockResolvedValueOnce({actionId:'worker.create',values:{fullName:'QA Cũ',phone:'0900090998'},intentType:'workflow'});
  let result=await turn({text:'Thêm lao động QA Cũ 0900090998'});
  if(result.status==='collecting')result=await turn({skipReferenceKeys:result.referenceSelections?.filter(s=>!s.required).map(s=>s.key)||[]});
  expect(result.status,JSON.stringify(result)).toBe('confirmation');
  const staleId=result.action!.id;
  const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
  state.provider.mockImplementation(async input=>{
    const props=input.responseSchema?.properties||{};
    if(props.units)return {text:JSON.stringify({version:1,dialogue:{act:'correct',evidence:'À nhầm'},units:[{id:'u1',kind:'input',quote:'QA Mới',concept:'Tên đúng',operator:'eq',value:'QA Mới',dimension:'none'}]})};
    return {text:JSON.stringify({intentType:'workflow',actionId:'worker.create',actionIntent:'create',newRequest:true,values:{fullName:'QA Mới'},meaningBindings:[{unitId:'u1',targets:['values.fullName']}]})};
  });
  result=await turn({text:'À nhầm tên QA Mới mới đúng'});
  expect(result.status,JSON.stringify(result)).toBe('confirmation');
  expect(state.session.pending.provided.fullName).toBe('QA Mới');expect(state.session.pending.provided.phone).toBe('0900090998');
  expect(result.action!.id).not.toBe(staleId);
  state.interpret.mockReset().mockResolvedValueOnce({intentType:'workflow',actionId:'worker.list',values:{},pausePending:true,newRequest:true});
  const paused=await turn({text:'Khoan tạo, xem danh sách lao động trước đã'});
  expect(paused.status,JSON.stringify(paused)).toBe('completed');expect(state.session.pending).toBeNull();expect(state.session.pausedAssistant.pending.provided.fullName).toBe('QA Mới');
  state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'worker.create',values:{fullName:'QA Hoàn Thiện'},resumePending:true});
  const resumed=await turn({text:'Quay lại việc đang tạo, đổi tên QA Hoàn Thiện nhé'});
  expect(resumed.status,JSON.stringify(resumed)).toBe('confirmation');expect(resumed.action!.id).not.toBe(result.action!.id);expect(state.session.pausedAssistant).toBeNull();
  expect(state.session.pending.provided.fullName).toBe('QA Hoàn Thiện');
  expect((await turn({decision:{id:staleId,confirmed:true}})).status).toBe('failed');
  state.interpret.mockResolvedValueOnce({intentType:'ambiguous',actionId:null,values:{},cancel:true});
  expect((await turn({text:'Thôi khỏi làm nữa'})).status).toBe('cancelled');expect(state.session.pending).toBeNull();
  expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});

it('does not resume a paused request after the conversation branch changes',async()=>{
  state.interpret.mockResolvedValueOnce({actionId:'worker.create',values:{fullName:'QA Cũ',phone:'0900090998'},intentType:'workflow'});
  await turn({text:'Thêm lao động QA Cũ 0900090998'});
  state.interpret.mockResolvedValueOnce({actionId:null,values:{},pausePending:true,intentType:'ambiguous'});
  await turn({text:'Tạm gác lại'});
  expect(state.session.pausedAssistant).toBeTruthy();
  state.session.pausedAssistant.scope='different-branch';
  state.interpret.mockResolvedValueOnce({actionId:null,values:{},resumePending:true,intentType:'ambiguous',clarification:'Bạn muốn quay lại việc nào?'});
  const result=await turn({text:'Quay lại đi'});
  expect(result.status).not.toBe('confirmation');expect(state.session.pending).toBeNull();expect(state.session.pausedAssistant).toBeNull();
  expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});

it.each(['continue','followup','request','goal-continue'])('keeps an unchanged draft at confirmation when acknowledgement is labeled %s, without planning or re-approving',async act=>{
 state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'worker.create',values:{fullName:'QA Soạn',phone:'0900090998'}});
 let reply=await turn({text:'Thêm lao động QA Soạn 0900090998'});
 if(reply.status==='collecting')reply=await turn({skipReferenceKeys:reply.referenceSelections?.filter(s=>!s.required).map(s=>s.key)||[]});
 expect(reply.status).toBe('confirmation');
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
 const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
 state.provider.mockImplementation(async input=>{
  if(input.responseSchema?.properties.units)return {text:JSON.stringify({version:1,dialogue:{act:act==='goal-continue'?'continue':act,evidence:'Ừ thông tin thế được rồi'},units:[{id:'u1',kind:act==='goal-continue'?'goal':'framing',quote:'Ừ thông tin thế được rồi',concept:'Thông tin bản soạn đã ổn, chưa xác nhận thực thi',operator:act==='goal-continue'?'create':'none',value:null,dimension:'none'}]})};
  if(act==='goal-continue')return {text:JSON.stringify({intentType:'ambiguous',actionId:null,values:{},meaningBindings:[{unitId:'u1',targets:['context.discourse']}],actionIntent:'create',resumeGoal:true})};
  throw Error('Acknowledgement must not trigger action planning');
 });
 reply=await turn({text:'Ừ thông tin thế được rồi'});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');expect(JSON.stringify(reply.action?.values)).toContain('QA Soạn');
 expect(state.session.pending.provided.phone).toBe('0900090998');expect(state.fit).not.toHaveBeenCalled();
 expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});

it.each([
 ['L03-original','Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng?', ['QA An']],
 ['L04','Trong quản lí lao động, đối tác nào đang thiếu KPI tháng?', ['QA Bình']],
 ['L05','Trong quản lí lao động, các đối tác nào đã đạt đủ KPI?', ['QA An']],
 ['L06','Trong quản lí lao động, Đối tác nào giới thiệu được ít lao động nhất trong tháng?', ['QA Bình']],
])('executes the captured web meaning/plan through real semantic compilation and completion: %s',async(id,text,names)=>{
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
 const fixtures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-web-labor.json',import.meta.url),'utf8'));
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-26T04:00:00Z'));
 const fixture=fixtures.find((f:any)=>f.id===id),plan=fixture.plans.at(-1),actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');
 state.interpret.mockImplementation(actual.interpretRequest);
 state.provider.mockImplementation(async input=>{
  const p=input.responseSchema?.properties||{};
  if(p.units)return {text:JSON.stringify(fixture.meaning)};
  if(p.decision)return {text:JSON.stringify({featureKeys:['labor-partner:partner-referral-analysis'],decision:'search',question:'',unavailableModule:null})};
  return {text:JSON.stringify(plan)};
 });
 state.fit.mockImplementation(async()=>{
  const role=(unitId:string,role:string,target:string,predicates:any[]=[])=>({unitId,actionId:plan.actionId,role,target,predicates});
  const scope=fixture.meaning.units.find((u:any)=>u.kind==='scope');
  const resolutions=[role(scope.id,'module_context','context.module')];
  for(const u of fixture.meaning.units){
   if(u.kind==='aggregate')resolutions.push(role(u.id,'row_measure','result.actualReferrals'));
   if(u.kind==='group')resolutions.push(role(u.id,'row_dimension','result.partnerName'));
   if(u.kind==='output')resolutions.push(role(u.id,'public_output','result.partnerName'));
   if(u.kind==='condition')resolutions.push(role(u.id,'read_predicate','',[{field:'status',operator:'eq',value:id==='L04'?'incomplete':'achieved'}]));
  }
  return {text:JSON.stringify({approvedActionIds:[plan.actionId],question:'',resolutions})};
 });
 fetcher.mockImplementation(async(url,init)=>{
  expect(init?.method).toBe('GET');expect(new URL(String(url)).pathname).toBe('/api/v1/worker-management/partners/kpi');
  return json({success:true,data:{periodStart:'2026-11-01',periodEnd:'2026-12-01',items:[
   {partner:{name:'QA An',code:'A'},actualReferrals:2,targetReferrals:1,remainingReferrals:0,completionRate:200,status:'achieved'},
   {partner:{name:'QA Bình',code:'B'},actualReferrals:1,targetReferrals:10,remainingReferrals:9,completionRate:10,status:'incomplete'},
  ]}});
 });
 const reply=await turn({text});expect(reply.status,JSON.stringify(reply)).toBe('completed');
 expect(parseAssistantResultTable(reply.reply)?.rows.map(r=>r.values['Đối tác'])).toEqual(names);
 expect(state.turns.at(-1).steps.at(-1).status).toBe('completed');expect(fetcher).toHaveBeenCalledOnce();
});

it('opens collection for a captured lifecycle-date create and then preserves user selections until confirmation',async()=>{
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
 const fixtures=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-web-labor.json',import.meta.url),'utf8')),fixture=fixtures.find((f:any)=>f.id==='L02'),plan=fixture.plans[0];
 const actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');state.interpret.mockImplementation(actual.interpretRequest);
 state.provider.mockImplementation(async input=>{
  const p=input.responseSchema?.properties||{};
  if(p.units)return {text:JSON.stringify(fixture.meaning)};
  if(p.decision)return {text:JSON.stringify({featureKeys:['labor-partner:partner-policies'],decision:'search',question:'',unavailableModule:null})};
  return {text:JSON.stringify(plan)};
 });
 state.fit.mockResolvedValue({text:JSON.stringify({approvedActionIds:[plan.actionId],question:'',resolutions:[{unitId:'u4',actionId:plan.actionId,role:'temporal_input',target:'values.effectiveFrom',predicates:[]}]})});
 let reply=await turn({text:'Thêm 1 chính sách hoa hồng mới - QA Chính sách lao động cuối năm, áp dụng từ 1/12/2026'});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');expect(reply.referenceSelections?.length).toBeGreaterThan(0);
 state.interpret.mockReset().mockResolvedValue({intentType:'workflow',actionId:plan.actionId,values:{settlementCycle:{type:'calendar_month'},official:{enabled:true,maxMonths:1,milestones:[{month:1,amount:500000,eligibilityRule:'contract_active'}]},seasonal:{enabled:false}}});
 reply=await turn({text:'Đối soát theo tháng lịch; chính thức 1 tháng, mốc tháng 1 nhận 500000 khi hợp đồng còn hiệu lực; không áp dụng thời vụ.'});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');expect(JSON.stringify(reply.action?.values)).toContain('QA Chính sách lao động cuối năm');
 expect(JSON.stringify(reply.action?.values)).toContain('01/12/2026');expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});
it('reaches confirmation when a reduced limit and explicit replacement milestones are supplied together',async()=>{
 const op=ASSISTANT_OPERATIONS.find(o=>o.partialUpdate&&o.module==='labor-partner')!,id='64b000000000000000000099';
 const existing={id,_id:id,name:'QA Cuối năm',version:1,status:'active',effectiveFrom:'2026-11-25',settlementCycle:{type:'calendar_month'},official:{enabled:true,maxMonths:3,milestones:[{month:3,amount:500000,eligibilityRule:'contract_active'}]},seasonal:{enabled:false,tiers:[]}};
 fetcher.mockImplementation(async(url,init)=>{
  expect(init?.method).toBe('GET');const path=new URL(String(url)).pathname;
  if(path.endsWith('/auth/branches'))return json({branches:[{_id:req.user.branchId,name:'QA Branch'}]});
  if(path.endsWith('/policies'))return json({success:true,data:[existing]});
  if(path.endsWith('/policies/'+id))return json({success:true,data:existing});
  throw Error('UNEXPECTED_POLICY_READ:'+path);
 });
 state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:op.id,values:{path_policyId:'QA Cuối năm',official:{maxMonths:2,milestones:[1,2].map(month=>({month,amount:500000,eligibilityRule:'contract_active'}))}}});
 const reply=await turn({text:'Sửa QA Cuối năm còn 2 tháng, mốc tháng 1 và 2 nhận 500000 khi hợp đồng còn hiệu lực'});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');
 const official=JSON.parse(String(state.session.pending.resolved.official));
 const preview=String(reply.action!.values.find(v=>v.label==='Hoa hồng lao động chính thức')?.value);
 expect(preview).toContain('Số tháng tối đa: 2');expect(preview).not.toMatch(/[{}]|maxMonths|eligibilityRule/);
 expect(official.milestones.map((r:any)=>r.month)).toEqual([1,2]);expect(existing.official.milestones[0].month).toBe(3);
});

it('collects nested policy inputs and enum selections through the real service without dispatching a write',async()=>{
 const op=ASSISTANT_OPERATIONS.find(o=>o.method==='POST'&&o.path==='/worker-management/partners/policies')!;
 state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:op.id,values:{name:'Chính sách QA',effectiveFrom:'2026-12-01',settlementCycle:{type:'calendar_month'},official:{enabled:true},seasonal:{enabled:false}}});
 let reply=await turn({text:'Tạo chính sách QA áp dụng 1/12/2026, đối soát tháng lịch, có lao động chính thức, không áp dụng thời vụ'});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');
 expect(reply.inputForm?.fields.map(f=>f.key)).toContain('official.maxMonths');
 reply=await turn({formValues:{id:reply.inputForm!.id,values:{'official.maxMonths':2}}});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');
 expect(reply.inputForm?.fields.map(f=>f.key)).toContain('official.milestones[2].amount');
 const referenceSelections=Object.fromEntries((reply.referenceSelections||[]).map(group=>[group.key,['contract_active']]));
 expect(Object.keys(referenceSelections)).toEqual(['official.milestones[1].eligibilityRule','official.milestones[2].eligibilityRule']);
 reply=await turn({formValues:{id:reply.inputForm!.id,values:{'official.milestones[1].month':1,'official.milestones[1].amount':100000,'official.milestones[2].month':2,'official.milestones[2].amount':200000},referenceSelections}});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');
 const official=JSON.parse(String(state.session.pending.resolved.official));
 expect(official.milestones).toEqual([{month:1,amount:100000,eligibilityRule:'contract_active'},{month:2,amount:200000,eligibilityRule:'contract_active'}]);
 expect(JSON.stringify(reply.action?.values)).toContain('01/12/2026');
 expect(JSON.stringify(reply.action?.values)).not.toContain('maxMonths');
 expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
 expect(state.interpret).toHaveBeenCalledOnce();
});
it('applies a specialized attendance condition before generic analysis and keeps equal anonymous roster rows',async()=>{
 state.includeHr=true;
 state.interpret.mockResolvedValueOnce({intentType:'workflow',actionId:'timekeeping.records.late',values:{query_date:'2026-11-27',analysis:{select:['employeeName','attendanceStatus']}}});
 fetcher.mockImplementation(async(url,init)=>{
  expect(init?.method||'GET').toBe('GET');expect(new URL(String(url)).pathname).toBe('/api/v1/timekeeping/records');
  return json({data:[{date:'2026-11-27',employeeName:'QA Đi muộn',attendanceStatus:'Đã vào ca, đi muộn'},{date:'2026-11-27',employeeName:'Chưa cập nhật tên',attendanceStatus:'Chưa ghi nhận'},{date:'2026-11-27',employeeName:'Chưa cập nhật tên',attendanceStatus:'Chưa ghi nhận'}]});
 });
 const result=await turn({text:'Nhân sự nào đi muộn ngày 27/11/2026'});
 expect(result.status,JSON.stringify(result)).toBe('completed');expect(result.reply).toContain('QA Đi muộn');expect(result.reply).not.toContain('Chưa cập nhật tên');expect(result.reply).not.toContain('chưa bao gồm toàn bộ');
 const roster=await callOperation(req,operationById('timekeeping.records.overview')!,{query_date:'2026-11-27'});
 expect(roster.data).toHaveLength(3);
});
it('collects an unresolved requested period with the shared date form instead of using the API default',async()=>{
 vi.stubEnv('ASSISTANT_SEMANTIC_CONTEXT','true');
 const fixture=JSON.parse(readFileSync(new URL('./testing/catalog-routing/captured-sheet-failures.json',import.meta.url),'utf8')).find((f:any)=>f.id==='POST-S5-R007');
 const plan=fixture.plans.at(-1),actual=await vi.importActual<typeof import('./semantic-interpreter')>('./semantic-interpreter');
 state.interpret.mockImplementation(actual.interpretRequest);
 state.provider.mockImplementation(async input=>{
  const properties=input.responseSchema?.properties||{};
  if(properties.units)return {text:JSON.stringify(fixture.meaning)};
  if(properties.decision)return {text:JSON.stringify({featureKeys:['labor-partner:partner-referral-analysis'],decision:'search',question:'',unavailableModule:null})};
  return {text:JSON.stringify(plan)};
 });
 state.fit.mockResolvedValue({text:JSON.stringify(fixture.fit[0])});
 let reply=await turn({text:fixture.text});
 expect(reply.status,JSON.stringify(reply)).toBe('collecting');
 expect(reply.inputForm?.fields.find(field=>field.key==='query_periodAnchor')).toMatchObject({type:'date',required:true});
 expect(fetcher).not.toHaveBeenCalled();
 fetcher.mockImplementation(async(url,init)=>{
  expect(init?.method||'GET').toBe('GET');expect(new URL(String(url)).searchParams.get('periodAnchor')).toBe('2026-11-01');
  return json({success:true,data:{periodStart:'2026-11-01',periodEnd:'2026-12-01',items:[{partner:{name:'QA An',code:'A'},actualReferrals:2,targetReferrals:3,remainingReferrals:1,completionRate:66,status:'incomplete'}]}});
 });
 reply=await turn({formValues:{id:reply.inputForm!.id,values:{query_periodAnchor:'2026-11-01'}}});
 expect(reply.status,JSON.stringify(reply)).toBe('confirmation');expect(fetcher).not.toHaveBeenCalled();
 reply=await turn({decision:{id:reply.action!.id,confirmed:true}});
 expect(reply.status,JSON.stringify(reply)).toBe('completed');expect(reply.reply).toContain('QA An');
});
