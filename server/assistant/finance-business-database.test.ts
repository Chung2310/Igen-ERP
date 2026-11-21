import { randomUUID } from "node:crypto";
import { conversationAudit } from "./testing/conversation-audit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as any, turns: [] as any[], interpret: vi.fn(), provider: vi.fn(), assertOperation: vi.fn() }));
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
    ensureAssistantIndexes: vi.fn(), AssistantDocumentModel: { create: vi.fn() },
    AssistantSessionModel: {
      updateOne: vi.fn(async (_filter, update) => {
        state.session ??= { messages: [], pending: null, busy: false, messageCount: 0 };
        apply(state.session, update);
      }),
      findOneAndUpdate: vi.fn(async () => { if (state.session.busy) return null; state.session.busy = true; return structuredClone(state.session); }),
      findOne: vi.fn(() => chain(() => state.session)),
    },
    AssistantTurnModel: {
      create: vi.fn(async input => {
        if (state.turns.some(turn => turn.requestId === input.requestId)) throw { code: 11000 };
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
  return {
    actorScope: () => ({ userId: "actor", companyCode: "TEST" }),
    assertOperation: state.assertOperation,
    currentWorkflow: vi.fn(async (_req, id) => defaultWorkflow(operationById(id)!)),
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => op.module === "finance").map(defaultWorkflow)),
  };
});
vi.mock("./settings", async () => {
  const { defaultAssistantSettings } = await import("../../src/shared/assistant-workflow");
  return { getSettings: vi.fn(async () => ({ ...defaultAssistantSettings, memoryEnabled: false, autoMemoryEnabled: false, responseRules: "" })) };
});
vi.mock("./interpreter", () => ({ interpretRequest: state.interpret, isEmployeeDetailsIntent: () => false }));
vi.mock("./semantic-interpreter", () => ({ interpretRequest: state.interpret }));
vi.mock("./reply-rules", () => ({ applyAssistantResponseRules: async (reply: unknown) => reply }));
vi.mock("./documents", () => ({ answerAssistantConversation: vi.fn() }));
vi.mock("./session-memory", () => ({ SESSION_MEMORY_LIMIT: 2400, summarizeAssistantSession: async () => null }));

import { processTurn } from "./service";
import { operationById } from "./catalog";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { financeTreasuryService as treasury } from '../modules/finance/services/finance-treasury.service';
import { FinanceCashAccountModel as Account, FinanceCashVoucherModel as Voucher } from '../modules/finance/models/finance-treasury.model';

const branchId = '507f1f77bcf86cd799439012';
const scope = { companyCode: 'TEST', branchId };
const req = { user: { id:'actor',uid:'actor',companyCode:'TEST',branchId,role:'admin' }, headers:{},socket:{localPort:4050,localAddress:'127.0.0.1'} } as any;
const audit = conversationAudit('finance-real-db', 'Real business services and isolated temporary MongoDB. AI interpretation, assistant sessions, permissions, rewriting and HTTP transport are mocked. No production data writes.');
const turn = (input:any) => audit.turn(input, () => processTurn(req, {conversationId:'finance-real-db',requestId:randomUUID(),...input}));
let mongo: MongoMemoryReplSet;
let calls: any[] = [];
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet:{count:1,dbName:'assistant_finance_acceptance'} });
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(mongo.getUri())) throw new Error('Only isolated loopback DB allowed');
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
},120000);
afterAll(async()=>{ await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async()=>{
  audit.reset(); calls=[]; state.session=null; state.turns=[]; state.interpret.mockReset(); state.provider.mockReset();
  state.assertOperation.mockReset().mockImplementation(async(_req:unknown,id:string)=>operationById(id));
  await Promise.all(Object.values(mongoose.models).map(model=>model.deleteMany({})));
  vi.stubGlobal('fetch',vi.fn(async(url:URL,init?:RequestInit)=>{
    const u=new URL(String(url));
    if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)) throw new Error('External HTTP forbidden');
    const path=u.pathname.replace(/^\/api\/v1/,''),method=init?.method||'GET';
    const body=init?.body?JSON.parse(String(init.body)):{};
    const call:any={path,method,body};calls.push(call);
    try {
      let data:unknown;
      if(path.endsWith('/branches')) data=[{_id:branchId,name:'Trụ sở chính',code:'HQ'}];
      else if(path==='/finance/reporting/treasury'&&method==='GET') data=await treasury.overview(scope);
      else if(path==='/finance/reporting/treasury/vouchers'&&method==='POST') data=await treasury.createVoucher(scope,body,'actor');
      else if(/^\/finance\/reporting\/treasury\/vouchers\/[^/]+\/decision$/.test(path)&&method==='POST') data=await treasury.decide(scope,path.split('/').at(-2)!,body,'actor');
      else throw new Error(`Unimplemented test transport: ${method} ${path}`);
      call.status=200;call.response=data;
      return new Response(JSON.stringify({status:'success',data}),{headers:{'Content-Type':'application/json'}});
    } catch(error) {
      call.status=Number((error as any).statusCode)||422;call.error=(error as Error).message;
      return new Response(JSON.stringify({status:'error',message:call.error}),{status:call.status,headers:{'Content-Type':'application/json'}});
    }
  }));
});
afterEach(async ctx=>{
  await audit.write(ctx,state,{persistence:'isolated real MongoDB',transport:'simulated HTTP to real treasury service, mocked AI/session/permissions',calls,accounts:await Account.find({}).lean(),vouchers:await Voucher.find({}).lean()});
  vi.unstubAllGlobals();
});
async function preparePayment(amount=300) {
  const account=await treasury.createAccount(scope,{name:'Quỹ tiền mặt',kind:'cash',openingOn:'2026-01-01',openingBalance:1000},'actor');
  state.interpret.mockResolvedValue({actionId:'finance.treasury.vouchers.create',newRequest:true,values:{targetBranch:branchId,accountId:String(account._id),kind:'payment',amount,occurredOn:'2026-11-19',description:'Mua vật tư'}});
  let reply:any=await turn({text:`Lập phiếu chi ${amount} từ quỹ tiền mặt để mua vật tư ngày 19/11/2026`});
  for(let i=0;i<5&&reply.status==='collecting'&&reply.referenceSelections?.length;i++) {
    const groups=reply.referenceSelections;
    reply=await turn({referenceSelections:Object.fromEntries(groups.filter((g:any)=>g.required&&g.options.length).map((g:any)=>[g.key,[g.options[0].value]])),skipReferenceKeys:groups.filter((g:any)=>!g.required).map((g:any)=>g.key)});
  }
  expect(reply.status,JSON.stringify(reply)).toBe('confirmation');
  expect(await Voucher.countDocuments()).toBe(0);
  return {account,reply};
}
it('creates a pending payment then approves once through assistant confirmation and reads actual balance',async()=>{
  const {account,reply}=await preparePayment();
  const created=await turn({decision:{id:reply.action.id,confirmed:true}});
  expect(created.status,JSON.stringify(created)).toBe('completed');
  expect(parseAssistantResultTable(created.reply)).toBeTruthy();
  expect((await Account.findById(account._id))!.balance).toBe(1000);
  const voucher=(await Voucher.findOne({}))!;
  expect(voucher.status).toBe('pending');
  state.interpret.mockResolvedValue({actionId:'finance.treasury.vouchers.decision',newRequest:true,values:{targetBranch:branchId,path_id:String(voucher._id),action:'approve'}});
  const preview:any=await turn({text:'Duyệt phiếu chi mua vật tư vừa tạo'});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const confirmation={requestId:randomUUID(),decision:{id:preview.action.id,confirmed:true}};
  const approved=await turn(confirmation);
  expect(approved.status,JSON.stringify(approved)).toBe('completed');
  await turn(confirmation);
  expect((await Account.findById(account._id))!.balance).toBe(700);
  expect((await Voucher.findById(voucher._id))!.status).toBe('posted');
  expect(await Voucher.countDocuments()).toBe(1);
});
it('cancels a payment preview without creating a voucher or reducing the balance',async()=>{
  const {account,reply}=await preparePayment();
  expect((await turn({decision:{id:reply.action.id,confirmed:false}})).status).toBe('cancelled');
  expect(await Voucher.countDocuments()).toBe(0);
  expect((await Account.findById(account._id))!.balance).toBe(1000);
});
it('shows insufficient-funds rejection from the service without changing cash or posting the voucher',async()=>{
  const {account,reply}=await preparePayment(1100);
  expect((await turn({decision:{id:reply.action.id,confirmed:true}})).status).toBe('completed');
  const voucher=(await Voucher.findOne({}))!;
  state.interpret.mockResolvedValue({actionId:'finance.treasury.vouchers.decision',newRequest:true,values:{targetBranch:branchId,path_id:String(voucher._id),action:'approve'}});
  const preview:any=await turn({text:'Duyệt phiếu chi vừa tạo'});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const rejected=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(rejected.status).not.toBe('completed');
  expect(rejected.reply).toContain('không đủ tiền');
  expect((await Account.findById(account._id))!.balance).toBe(1000);
  expect((await Voucher.findById(voucher._id))!.status).toBe('pending');
});
