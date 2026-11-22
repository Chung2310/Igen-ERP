import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), documents: vi.fn(), provider: vi.fn(), selectedId: "" }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: state.provider }));
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
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: state.documents },
    AssistantSessionModel: {
      updateOne: vi.fn(async (_filter, update) => { state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 }; apply(state.session, update); }),
      findOneAndUpdate: vi.fn(async () => { state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => {
        if(state.turns.some(turn=>turn.requestId===input.requestId && turn.userId===input.userId && turn.companyCode===input.companyCode)) throw Object.assign(new Error('Duplicate request'),{code:11000});
        const turn = { ...input, _id: String(state.turns.length + 1), createdAt: new Date(), updatedAt: new Date(), status: "processing" }; state.turns.push(turn); return turn;
      }),
      updateOne: vi.fn(async (filter, update) => { apply(state.turns.find(turn => turn._id === filter._id), update); }),
      findOne: vi.fn(filter => chain(() => [...state.turns].reverse().find(turn => filter.requestId ? turn.requestId === filter.requestId : turn.actionId && turn.result?.status === "completed"))),
    },
  };
});
vi.mock("./workflows", async () => {
  const { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } = await import("./catalog");
  return { actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: vi.fn(async (_req, id) => operationById(id)),
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.id === state.selectedId).map(defaultWorkflow)) };
});
vi.mock("./settings", async () => { const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow"); return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) }; });
vi.mock("./interpreter", async importOriginal => ({ ...await importOriginal<typeof import('./interpreter')>(), interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));

vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async reply => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from "./service";
import { ASSISTANT_OPERATIONS } from "./catalog";
import type { AssistantField, AssistantDataShape } from "../../src/shared/assistant-workflow";
import { functionMatrixModules } from './testing/function-matrix-scope';
import { extendedFunctionFixture } from './testing/extended-function-fixtures';
const operations = ASSISTANT_OPERATIONS.filter(op => functionMatrixModules.includes(op.module));
const evidence: any[] = [];
let calls: any[] = [];
let responseStatus = 422;
let referenceFixtures = false;
let savedRecords: any[] = [];
let fixtureVersion = 1;
const req: any = { user: { id: '507f1f77bcf86cd799439011', companyCode: 'TEST', role: 'admin', branchId: '507f1f77bcf86cd799439012' }, headers: {'x-device-id':'fixture-pos'}, socket: { localPort: 3000, localAddress: '127.0.0.1' } };
beforeEach(() => {
  state.session = null; state.turns = []; state.provider.mockReset(); state.interpret.mockReset(); state.documents.mockReset(); calls = []; responseStatus = 422; referenceFixtures = false; savedRecords=[];fixtureVersion=1;
  vi.stubGlobal('fetch', vi.fn(async (url: URL, init?: RequestInit) => {
    const parsed = new URL(String(url));
    const selected = operations.find(op=>op.id===state.selectedId)!;
    const actualParts = parsed.pathname.replace(/^\/api\/v1/, '').split('/');
    const targetParts = selected.path.split('/');
    const isTarget = (init?.method || 'GET')===selected.method && actualParts.length===targetParts.length && actualParts.every((part,index)=>targetParts[index].startsWith(':') || part===targetParts[index]);
    const preview = /\/(?:search|quote|bulk-delete-preview|catalog\/(?:bulk|import)\/preview)$/.test(parsed.pathname);
    const lookup = referenceFixtures && !isTarget && ((init?.method || 'GET')==='GET' || preview);
    const call = { path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), method: init?.method || 'GET', body: init?.body instanceof FormData ? {file:'fixture.xlsx'} : init?.body ? JSON.parse(String(init.body)) : undefined, status: lookup ? 200 : responseStatus };
    calls.push(call);
    if(lookup || responseStatus===200){
      const branch = parsed.pathname.endsWith('/branches');
      const id=branch?req.user.branchId:parsed.pathname.includes('/healthcare/')?'11111111-1111-4111-8111-111111111111':'507f1f77bcf86cd799439021';
      const row:any={...Object.fromEntries(selected.fields.filter(f=>f.source==='body').map(f=>[f.apiKey||f.key,fieldValue(f)])),id,_id:id,uid:id,name:'QA',title:'QA',fullName:'QA',displayName:'QA',code:'QA',role:'user',periodKey:'2026-11',source:'manual',status:'draft',active:true,isActive:true,version:1,revision:1,updatedAt:'2026-11-01T00:00:00.000Z',phone:'0900000000',companyCode:'TEST',branchId:req.user.branchId};
      const items=[row];
      row.version=fixtureVersion;
      const detail=actualParts.at(-1)===id;
      Object.assign(row,{employeeId:id,runId:id,studentId:id,source:'admin',calendarSource:'admin',jobId:id,scheduledStart:'2026-11-20T01:00:00.000Z',scheduledEnd:'2026-11-20T02:00:00.000Z',lines:[],template:{id,originalFilename:'QA.pdf'},kind:'estimate',category:parsed.searchParams.get('category')||'estimate',contractNumber:'HD-QA',quoteNumber:'DT-QA',analyzedAt:'2026-11-01T00:00:00Z',analysis:{items:[]},no:1,key:'fullName',fieldKey:'fullName',installmentNo:1});
      if(parsed.pathname.includes('/quotation/')) {
        const context=selected.fields.find(f=>f.referenceContext && (f.reference?.includes('quote.list')||f.reference?.includes('contract.list')))?.referenceContext;
        Object.assign(row,context||{});
        if(parsed.searchParams.has('kind')) row.kind=parsed.searchParams.get('kind');
        if(selected.id==='quotation.export.latest') row.kind='estimate';
      }
      if(parsed.pathname.includes('/recruitment/jobs')) row.status='open';
      if(parsed.pathname.includes('/payroll/runs') && ['payroll.run.payslips.publish','payroll.payment.confirm','payroll.payment.reverse'].includes(selected.id)) row.status='closed';
      if(parsed.pathname.includes('/payments') && selected.id==='payroll.payment.reverse') row.status='confirmed';
      if(parsed.pathname.includes('/payments') && selected.id==='payroll.payment.confirm') row.status='draft';
      const envelope:any={status:'success',success:true,data:detail?row:items,items,records:items,rows:items,users:items,branches:items,quotes:items,contracts:items,templates:items,priceLists:items,requests:items,budgets:items,students:items,batches:items,partners:items,policies:items,quote:row,contract:row,item:row,record:row,total:1,page:1,totalPages:1};
      if(parsed.pathname.endsWith('/role-permissions')) { row.roleName='user';row.name='user';row.id='user';row._id='user'; }
      if(parsed.pathname.endsWith('/reconciliation-schedule')) envelope.data={enabled:true,day:3,hour:8,minute:0,periodOffset:-1,version:1};
      if(parsed.pathname.endsWith('/reconciliation') && parsed.pathname.includes('/runs/')) envelope.data={runStatus:'draft',employeeCount:1,items:[{...row,employeeName:'QA',issues:[{id:'qa-issue',field:'overtime',status:'open'}]}]};
      if(parsed.pathname.includes('/hr-contracts')) {row.status='active';row.employeeName='QA';row.employee={id,displayName:'QA'};row.endDate='2026-10-31';}
      if(parsed.pathname.endsWith('/installments')) envelope.data=items;
      if(parsed.pathname.endsWith('/enrollments')) envelope.data={items:[{...row,student:{_id:id,fullName:'QA'},status:'Đang học'}]};
      if(parsed.pathname.includes('/standard-fields/')) envelope.data=[{...row,key:'fullName',label:'Họ tên',isVisible:true,isRequired:true,isArchived:false}];
      if(parsed.pathname.includes('/student-resources/') && detail) row.bookings=[{_id:id,id,purpose:'QA',startTime:'2026-11-20T08:00:00+07:00',endTime:'2026-11-20T09:00:00+07:00'}];
      if(parsed.pathname.includes('/student-quality/')) envelope.data={...row,miniTests:[{_id:id,id,title:'QA',name:'QA',date:'2026-11-01',score:8,maxScore:10}]};
      if(parsed.pathname.includes('/payroll/periods/') && parsed.pathname.endsWith('/inputs')) envelope.data={editable:true,needsRefresh:false,items};
      if(parsed.pathname.endsWith('/bulk-delete-preview')) Object.assign(envelope,{deletableCount:1,blockedCount:0,items:[{name:'QA',reasons:[]}]});
      if(parsed.pathname.endsWith('/catalog/bulk/preview')) Object.assign(envelope,{previewHash:'fixture-preview',rows:[{...row,before:{price:1},after:{price:2}}]});
      if(parsed.pathname.endsWith('/catalog/import/preview')) Object.assign(envelope,{invalidCount:0,errors:[],rows:call.body.rows});
      if(selected.id==='api.patch.cbf8c2b9d544f837' && !parsed.pathname.endsWith('/branches')) envelope.data={latitude:21.03,longitude:105.85,allowedRadius:100,addressName:'QA',checkInLimit:'08:00',checkOutLimit:'17:00',lunchBreakStart:'12:00',lunchBreakEnd:'13:00',workingDays:[1,2,3,4,5],annualLeaveDays:12};
      if(!['hr','student','quotation'].includes(selected.module)) extendedFunctionFixture(selected,parsed,row,envelope);
      if(isTarget && responseStatus===200 && !selected.readOnly && selected.method!=='GET') {
        Object.assign(row,call.body||{});
        envelope.data=row;envelope.user=row;envelope.project=row;envelope.request=row;envelope.notification=row;envelope.student=row;
        if(selected.id==='payroll.run.payslips.publish') envelope.data=items;
        if(selected.id==='payroll.run.payslips.withdraw') envelope.data={status:'withdrawn'};
        if(selected.id==='payroll.run.payslip.review-request.resolve') row.status='resolved';
        const paymentStatuses:Record<string,string>={'payroll.payment.confirm':'confirmed','payroll.payment.cancel':'cancelled','payroll.payment.reverse':'reversed'};
        if(paymentStatuses[selected.id]) {row.status=paymentStatuses[selected.id];row.amount=100000;envelope.runStatus='closed';}
        if(selected.id==='company-email.smtp.test') envelope.messageId='fixture-smtp-message';
        savedRecords.push({operation:selected.id,method:call.method,path:call.path,body:structuredClone(call.body),record:structuredClone(row)});
      }
      if(parsed.pathname.includes('/quotation/') && (init?.method||'GET')==='GET' && !detail) {
        for(const key of ['item','quote','contract','record','request','settings','job','analysis']) delete envelope[key];
      }
      if(selected.module==='healthcare' && parsed.pathname.includes('/healthcare/')) {
        Object.assign(row,{patientId:id,code:'QA',name:'QA',revision:1,dateOfBirth:'1990-01-01',status:parsed.pathname.includes('/appointments')?'scheduled':parsed.pathname.includes('/visits')?'registered':'open',visitedOn:'2026-11-01',dueOn:'2026-11-01',scheduledOn:'2026-11-01',startsAt:'',endsAt:'',assigneeId:'',doctorId:'',doctorName:'',roomId:'',serviceId:'',visitId:'',appointmentId:'',kind:'service'});
        if(parsed.pathname.includes('/imports')) Object.assign(row,{status:selected.id==='healthcare.import.retry'?'failed':'preview',phase:'check',retryable:true,preview:{valid:1,invalid:0,conflicts:0}});
        if(parsed.pathname.endsWith('/bulk-delete-preview')) envelope.items=[{...row,visits:0,appointments:0,care:0}];
        else if(parsed.pathname.endsWith('/search') || parsed.pathname.endsWith('/imports')) {envelope.items=items;envelope.patientReferences=items;}
        else if(parsed.pathname.endsWith('/catalog') || parsed.pathname.endsWith('/staff')) return new Response(JSON.stringify(items),{status:200});
        else return new Response(JSON.stringify({...row,...(isTarget?call.body||{}:{}),...(selected.id==='healthcare.import.preview'?{status:'queued',filename:'fixture.xlsx'}:{})}),{status:200});
      }
      return new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({ message: 'Dữ liệu mock bị từ chối: bản ghi không hợp lệ.' }), {status: responseStatus, headers:{'content-type':'application/json'}});
  }));
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => { const output=process.env.ASSISTANT_FUNCTION_CONVERSATION_OUTPUT;if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2));} });
function matchingText(pattern?: string): string {
  if (!pattern) return 'QA';
  const candidates = ['QA', '507f1f77bcf86cd799439021', '2026-11-01', '2026-11', '08:00', 'qa@example.test', '0900000000', '1', '#336699', 'https://res.cloudinary.com/fixture/video/upload/qa.mp4'];
  return candidates.find(value => new RegExp(pattern).test(value)) || 'QA';
}
function shapeValue(shape: AssistantDataShape | undefined): any {
  if (!shape) return {};
  if (shape.options?.length) return shape.options[0];
  if (shape.reference) return '507f1f77bcf86cd799439021';
  if (shape.type==='array') return Array.from({length: shape.minItems===0?0:Math.max(1,shape.minItems||1)},()=>shapeValue(shape.items));
  if (shape.type==='object') {
    const keys=Object.entries(shape.keys||{});
    const value=Object.fromEntries(keys.filter(([,s])=>s.required).map(([k,s])=>[k,shapeValue(s)]));
    for(const [key,s] of keys) if(s.requiredWhen && (s.requiredWhen.present && value[s.requiredWhen.field]!==undefined || s.requiredWhen.equals===value[s.requiredWhen.field])) value[key]??=shapeValue(s);
    if(shape.minProperties && Object.keys(value).length<shape.minProperties) for(const [key,s] of keys.slice(0,shape.minProperties)) value[key]??=shapeValue(s);
    return value;
  }
  if (shape.type==='number') return Math.max(shape.min||0,1);
  if (shape.type==='boolean') return true;
  if (shape.type==='date') return '2026-11-01';
  return matchingText(shape.pattern);
}
function fieldValue(field: AssistantField): unknown {
  if (field.referenceValueKey==='version') return '1';
  if(field.apiKey==='branchId' || field.reference==='branch.list') return req.user.branchId;
  if(field.reference?.startsWith('healthcare.') || state.selectedId.startsWith('healthcare.') && field.source==='path' && field.apiKey==='id') return '11111111-1111-4111-8111-111111111111';
  if(field.options?.length) return field.options[0];
  if(field.type==='json') return shapeValue(field.structure);
  if(field.type==='number') return Math.max(field.min||0,1);
  if(field.type==='boolean') return true;
  if(field.type==='email') return 'qa@example.test';
  if(field.type==='phone') return '0900000000';
  if(field.type==='date') return '2026-11-01';
  if(field.type==='datetime') return '2026-11-01T08:00:00+07:00';
  if(field.pattern) return matchingText(field.pattern);
  if(field.apiKey==='no') return '1';
  if(field.referenceValueKey==='role') return 'user';
  if(field.reference || field.source==='path') return '507f1f77bcf86cd799439021';
  return matchingText(field.pattern);
}
for(const op of operations) describe(op.id,()=>{
  for(const scenario of op.unavailableReason?['unavailable-operation']:['missing-data','unknown-condition','cancel','invalid-data','api-rejection-probe','success-probe',...(!op.readOnly && op.method!=='GET'?['cancel-preview']:[]),...(['payroll.period.inputs.bulk','payroll.period.line-overrides.bulk'].includes(op.id)?['stale-version']:[])]) it(scenario,async()=>{
    state.selectedId=op.id;
    const probe=['api-rejection-probe','success-probe','cancel-preview','stale-version'].includes(scenario);
    referenceFixtures=probe;
    responseStatus=scenario==='success-probe'?200:422;
    let values:Record<string,unknown>={};
    if(scenario==='unknown-condition') values={matrixUnsupportedFilter:'must-preserve'};
    if(scenario==='invalid-data') values=Object.fromEntries(op.fields.map(f=>[f.key,{invalid:true}]));
    if(probe) values=Object.fromEntries(op.fields.filter(f=>f.required||f.systemRequired||f.source==='path').map(f=>[f.key,fieldValue(f)]));
    if(probe && ['PATCH','PUT'].includes(op.method)) {
      const editable = op.fields.find(f=>(f.source==='body' || !f.source) && !f.reference && !f.required && !f.systemRequired && f.type!=='json') || op.fields.find(f=>f.source==='body' && !f.required);
      if(editable) values[editable.key]=fieldValue(editable);
    }
    if(probe) {
      if(op.id==='training.create') values.lessons=[{title:'QA',type:'text',content:'Nội dung bài học giả lập'}];
      if(op.id==='api.patch.6bc968347283a069') Object.assign(values,{useCustom:true,checkInLimit:'08:00',checkOutLimit:'17:00',lunchBreakStart:'12:00',lunchBreakEnd:'13:00'});
      if(op.id==='payroll.reconciliation.schedule.update') Object.assign(values,{recurrence:'monthly',enabled:true});
      if(op.id==='hr.calendar.event.create') Object.assign(values,{startDate:'2026-11-20T08:00:00+07:00',endDate:'2026-11-20T09:00:00+07:00'});
      if(['recruitment.interview.create','recruitment.interview.update'].includes(op.id)) Object.assign(values,{scheduledStart:'2026-11-20T08:00:00+07:00',scheduledEnd:'2026-11-20T09:00:00+07:00'});
      if(op.id==='student.batch.update') values.location='Phòng QA';
      if(op.id==='student.standard-fields.update') values.selectedField='fullName';
      if(op.id==='payroll.run.reconciliation.action') values.field='overtime';
      if(op.id==='payroll.formula.update') Object.assign(values,{conditions:{combinator:'and',items:[]},expression:{type:'constant',value:100},rounding:{mode:'none',unit:1}});
      if(op.id==='payroll.period.inputs.bulk') values.rows=[{employeeId:'507f1f77bcf86cd799439021',agreedSalary:10000000,reason:'QA'}];
      if(op.id==='payroll.period.line-overrides.bulk') values.rows=[{employeeId:'507f1f77bcf86cd799439021',values:{overtime:100000},reason:'QA'}];
      if(op.id==='quotation.catalog.bulk') Object.assign(values,{action:'price',adjustment:{mode:'amount',value:1000}});
      if(op.id==='quotation.export.latest') Object.assign(values,{kind:'estimate',sourceId:'507f1f77bcf86cd799439021'});
      if(op.id==='inventory.serial.create') {delete values.serialNumbers;values.serialNumber='QA-SERIAL-001';}
      if(op.module==='healthcare' && values.patientIds) values.patientIds=['11111111-1111-4111-8111-111111111111'];
      if(op.id==='worker.standard-fields.update') values.selectedField='fullName';
      if(op.id==='retail.order.cancel') values.refunds=[];
      if(op.id==='marketing.elevenlabs.voice-settings.update') values.stability=0.5;
      if(op.id==='retail.partner.product.commissions.update') values.rule={kind:'phone',amount:1000};
      if(['api.post.e57ae0da3cdf14f8','api.patch.2971d5a8a97f8be8'].includes(op.id)) {
        values.official={enabled:true,maxMonths:1,milestones:[{month:1,amount:1000,eligibilityRule:'contract_active'}]};
        values.seasonal={enabled:true,aggregationScope:'partner_period',tierMode:'flat',hourRounding:{unitMinutes:1,mode:'floor'},moneyRounding:{unitVnd:1,mode:'floor'},tiers:[{minHours:0,hourlyRate:1000}]};
      }
      if(['api.post.5905a76c5b33f482','api.post.435334a57fb9c949'].includes(op.id)) for(const v of values.variants as any[]) v.mediaIds=[];
      for(const f of op.fields) if(f.requiredWhen && values[f.requiredWhen.field]!==undefined && (f.requiredWhen.present || f.requiredWhen.equals===values[f.requiredWhen.field])) values[f.key]??=fieldValue(f);
    }
    const input={conversationId:'matrix-'+op.id,requestId:randomUUID(),text:scenario==='cancel'?'Hủy yêu cầu này':op.title+(probe && op.fields.some(f=>f.type==='datetime')?' bắt đầu 8h ngày 20/11/2026, kết thúc 9h cùng ngày':'')};
    if(probe && op.id==='student.batch.update') { values.location='QA Room'; input.text+=' location QA Room'; }
    if(probe && op.id==='payroll.reconciliation.schedule.update') input.text+=' monthly schedule enabled';
    const coverageTargets = [
      'action',
      ...Object.keys(values)
        .filter(key => op.fields.some(field => field.key === key) && values[key] !== undefined)
        .map(key => `values.${key}`),
    ];
    const ai=scenario==='cancel'
      ? {intentType:'workflow',actionId:null,actionIntent:'other',values:{},requestCoverage:[],cancel:true}
      : {
          intentType:'workflow',
          actionId:op.id,
          actionIntent:op.assistantMetadata?.intent || 'unknown',
          values,
          requestCoverage:[{evidence:input.text,requirement:op.title,mappedTo:coverageTargets}],
        };
    // The service uses semantic-interpreter. Supply its required contract so this
    // matrix exercises collection, confirmation, API handling, and replay rather
    // than failing every case on an obsolete minimal model response.
    state.provider.mockResolvedValue({text:JSON.stringify(ai)});
    const record:any={operation:op.id,module:op.module,scenario,input,ai,stage:'service conversation',fixture:`Offline mock API: target HTTP ${responseStatus}. Saved records are in-memory test evidence, not database persistence.`};
    try {
      record.reply=await processTurn(req,input);
      record.calls=structuredClone(calls);record.pending=structuredClone(state.session?.pending);
      record.reachedApi=calls.length>0;
      if(scenario!=='success-probe') expect(record.reply.status).not.toBe('completed');
      const previewPaths = new Set(['/api/v1/students/bulk-delete-preview', '/api/v1/quotation/catalog/bulk/preview', '/api/v1/quotation/catalog/import/preview']);
      const expectedParts = (`/api/v1${op.path}`).split('/');
      expect(calls.every(c=>c.method==='GET' || c.method==='POST' && (previewPaths.has(c.path) || /^\/api\/v1\/healthcare\/.*\/(search|bulk-delete-preview)$/.test(c.path) || c.path==='/api/v1/retail/orders/quote') || op.readOnly && c.method===op.method && c.path.split('/').length===expectedParts.length && c.path.split('/').every((part:string,i:number)=>expectedParts[i].startsWith(':') || part===expectedParts[i]))).toBe(true);
      if(op.unavailableReason) expect(calls).toHaveLength(0);
      if(['cancel','unknown-condition'].includes(scenario)) expect(calls).toHaveLength(0);
      if(probe) {
        let reply=record.reply;
        let lastInput:any=input;
        record.followups=[];
        for(let i=0;i<8 && reply.status==='collecting' && reply.referenceSelections?.length;i++) {
          const groups=reply.referenceSelections;
          const selections=Object.fromEntries(groups.filter((g:any)=>g.required && g.options.length).map((g:any)=>[g.key,[g.options[0].value]]));
          const skipReferenceKeys=groups.filter((g:any)=>!g.required).map((g:any)=>g.key);
          if(!Object.keys(selections).length && !skipReferenceKeys.length) break;
          const next={conversationId:input.conversationId,requestId:randomUUID(),referenceSelections:selections,skipReferenceKeys};
          reply=await processTurn(req,next);lastInput=next;
          record.followups.push({input:next,reply});
        }
        if(op.id==='student.batch.update' && reply.status==='collecting' && !reply.referenceSelections?.length) {
          const followupText='Update location to QA Room';
          state.provider.mockResolvedValueOnce({text:JSON.stringify({intentType:'workflow',actionId:op.id,actionIntent:'update',values:{location:'QA Room'},requestCoverage:[{evidence:followupText,requirement:'Update the learning location',mappedTo:['action','values.location']}]})});
          const next={conversationId:input.conversationId,requestId:randomUUID(),text:followupText};
          reply=await processTurn(req,next);lastInput=next;record.followups.push({input:next,reply});
        }
        if(scenario==='stale-version') {
          // Change only the server's version after preview; no user values change.
          fixtureVersion=2;
        }
        record.confirmations=[];
        for(let attempt=0;attempt<3 && reply.status==='confirmation';attempt++) {
        lastInput={conversationId:input.conversationId,requestId:randomUUID(),decision:{id:reply.action.id,confirmed:scenario!=='cancel-preview',...(reply.action.requiresPassword?{password:'fixture-only-password'}:{})}};
        record.confirmation=await processTurn(req,lastInput);
        record.confirmations.push({input:lastInput,reply:record.confirmation});
        record.calls=structuredClone(calls);record.reachedApi=calls.length>0;
        if(scenario!=='success-probe') expect(record.confirmation.status).not.toBe('completed');
        reply=record.confirmation;
        }
        record.lastReply=record.confirmation||reply;
        const parts=(`/api/v1${op.path}`).split('/');
        const targetCalls=calls.filter(c=>c.method===op.method && c.path.split('/').length===parts.length && c.path.split('/').every((p:string,i:number)=>parts[i].startsWith(':')||parts[i]===p));
        if(scenario==='cancel-preview' || scenario==='stale-version') {
          expect(targetCalls).toHaveLength(0);
          expect(savedRecords).toHaveLength(0);
          expect(record.lastReply.status).toBe(scenario==='cancel-preview'?'cancelled':'failed');
          if(scenario==='stale-version') expect(record.lastReply.reply).toContain('thay đổi');
        } else expect(targetCalls.length,JSON.stringify(record.lastReply)).toBeGreaterThan(0);
        if(scenario==='success-probe') {
          expect(record.lastReply.status,JSON.stringify(record.lastReply)).toBe('completed');
          if(!op.readOnly && op.method!=='GET') {
            expect(savedRecords).toHaveLength(1);
            expect(savedRecords[0].body).toEqual(targetCalls[0].body);
            // Retrying the same HTTP request must return its saved result, not execute again.
            const before=calls.length;
            record.replay={input:lastInput,reply:await processTurn(req,lastInput)};
            expect(record.replay.reply.status).toBe('completed');
            expect(calls).toHaveLength(before);
            expect(savedRecords).toHaveLength(1);
          }
        }
      }
      record.status='passed';
    } catch(error){record.status='failed';record.error=String(error);throw error;}
    finally {record.calls=structuredClone(calls);record.savedRecords=structuredClone(savedRecords);evidence.push(record);}
  });
});
