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
    listWorkflows: vi.fn(async () => ASSISTANT_OPERATIONS.filter(op => ["retail", "inventory"].includes(op.module)).map(defaultWorkflow)),
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
import { lookupRecords } from './executor';
import { operationById } from "./catalog";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

import { beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { BranchModel } from '../model/branch.model';
import { CompanyModel } from '../model/company.model';
import { WarehouseModel } from '../model/warehouse.model';
import { ProductCatalogModel } from '../model/product-catalog.model';
import { ProductVariantModel } from '../model/product-variant.model';
import { ProductPriceModel } from '../model/product-price.model';
import { InventoryBalanceModel } from '../model/inventory-balance.model';
import { RetailOrderModel } from '../modules/retail/models/retail-order.model';
import { RetailSettingsModel } from '../modules/retail/models/retail-settings.model';
import { RetailOrderService, serializeRetailOrder } from '../modules/retail/services/retail-order.service';
import { RetailProductService } from '../modules/retail/services/retail-product.service';
import { ProductCatalogService } from '../modules/inventory/product-catalog/product-catalog.service';
import { listWarehouses } from '../modules/inventory/warehouse/warehouse.service';
import { createTransfer, listTransfers, getTransfer, acceptTransfer } from '../modules/inventory/transfers/transfer.service';
import { InventoryTransferModel } from '../modules/inventory/transfers/transfer.model';
const id=()=>new mongoose.Types.ObjectId().toString();
const branchId=id(), targetBranchId=id(), warehouseId=id(), targetWarehouseId=id(), productId=id(), variantId=id();
const scope={companyCode:'TEST',branchId};
const actor={id:'actor',name:'Người kiểm tra',displayName:'Người kiểm tra',role:'admin'};
const req={user:{...actor,uid:'actor',...scope},headers:{},socket:{localPort:4050,localAddress:'127.0.0.1'}} as any;
const audit=conversationAudit('retail-inventory-real-db', 'Real business services and isolated temporary MongoDB. AI interpretation, assistant sessions, permissions, rewriting and HTTP transport are mocked. No production data writes.');
const turn=(input:any)=>audit.turn(input,()=>processTurn(req,{conversationId:'retail-inventory-real-db',requestId:randomUUID(),...input}));
let mongo:MongoMemoryReplSet;
let calls:any[]=[];
let before:any;
const snapshot=async()=>({orders:await RetailOrderModel.find({}).lean(),transfers:await InventoryTransferModel.find({}).lean(),balances:await InventoryBalanceModel.find({}).lean()});
beforeAll(async()=>{
  mongo=await MongoMemoryReplSet.create({replSet:{count:1,dbName:'assistant_retail_inventory'}});
  if(!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(mongo.getUri()))throw new Error('Only loopback DB allowed');
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
},120000);
afterAll(async()=>{await mongoose.disconnect();await mongo?.stop();});
beforeEach(async()=>{
  audit.reset();calls=[];state.session=null;state.turns=[];state.interpret.mockReset();state.provider.mockReset();req.user.branchId=branchId;
  state.assertOperation.mockReset().mockImplementation(async(_req:unknown,id:string)=>operationById(id));
  await Promise.all(Object.values(mongoose.models).map(m=>m.deleteMany({})));
  await CompanyModel.collection.insertOne({code:'TEST',name:'Test'});
  await BranchModel.create([{_id:branchId,companyCode:'TEST',code:'MAIN',name:'Trụ sở',isActive:true},{_id:targetBranchId,companyCode:'TEST',code:'TARGET',name:'Chi nhánh nhận',isActive:true}]);
  await WarehouseModel.create([{_id:warehouseId,...scope,code:'MAIN',name:'Kho gửi',isDefault:true,isActive:true},{_id:targetWarehouseId,companyCode:'TEST',branchId:targetBranchId,code:'TARGET',name:'Kho nhận',isDefault:true,isActive:true}]);
  await ProductCatalogModel.create({_id:productId,companyCode:'TEST',productCode:'PHONE',name:'Điện thoại',normalizedName:'dien thoai',productType:'physical',categoryCode:'PHONE',baseUnitCode:'PCS',status:'active',createdBy:'actor',updatedBy:'actor'});
  await ProductVariantModel.create({_id:variantId,companyCode:'TEST',productId,sku:'PHONE',unitCode:'PCS',trackingMode:'quantity',status:'active',createdBy:'actor',updatedBy:'actor'});
  await ProductPriceModel.collection.insertOne({...scope,variantId,sellingPrice:100000,costPrice:50000,status:'active'});
  await InventoryBalanceModel.create({...scope,warehouseId,productId,variantId,sku:'PHONE',quantity:5,reservedQuantity:0,averageCost:50000,version:0});
  await RetailSettingsModel.collection.insertOne({...scope,maxDiscountPercent:100});
  before=await snapshot();
  vi.stubGlobal('fetch',vi.fn(async(url:URL,init?:RequestInit)=>{
    const u=new URL(String(url));if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('External HTTP forbidden');
    const path=u.pathname.replace(/^\/api\/v1/,''),method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):{};
    const activeScope={companyCode:'TEST',branchId:u.searchParams.get('branchId')||req.user.branchId};
    const call:any={path,method,body,scope:activeScope};calls.push(call);
    try{
      let data:unknown;
      if(path.endsWith('/branches'))data=await BranchModel.find({companyCode:'TEST'}).lean();
      else if(path==='/retail/orders/products')data=await RetailProductService.search(activeScope,Object.fromEntries(u.searchParams));
      else if(path==='/retail/orders'&&method==='POST')data=serializeRetailOrder(await RetailOrderService.createDraft(activeScope,body,actor),true);
      else if(path==='/inventory/warehouses')data=await listWarehouses('TEST',activeScope.branchId);
      else if(path==='/inventory/catalog/products')data=await ProductCatalogService.list('TEST',Object.fromEntries(u.searchParams));
      else if(path.startsWith('/inventory/catalog/products/'))data=await ProductCatalogService.get('TEST',path.split('/').at(-1)!);
      else if(path==='/inventory/transfers'&&method==='POST')data=await createTransfer(activeScope,body,actor);
      else if(path==='/inventory/transfers')data=await listTransfers(activeScope);
      else if(path.endsWith('/accept'))data=await acceptTransfer(activeScope,path.split('/').at(-2)!,actor);
      else if(path.startsWith('/inventory/transfers/'))data=await getTransfer(activeScope,path.split('/').at(-1)!);
      else throw new Error('Unimplemented test transport: '+method+' '+path);
      call.status=200;call.response=data;
      return new Response(JSON.stringify(path.startsWith('/retail/')?{success:true,data}:{status:'success',data}),{headers:{'Content-Type':'application/json'}});
    }catch(error){call.status=Number((error as any).statusCode||(error as any).status)||400;call.error=(error as Error).message;
      const payload=path.startsWith('/retail/')?{success:false,error:call.error}:{status:'error',message:call.error};
      return new Response(JSON.stringify(payload),{status:call.status,headers:{'Content-Type':'application/json'}});}
  }));
});
afterEach(async ctx=>{await audit.write(ctx,state,{persistence:'isolated real MongoDB',transport:'mock AI/session/permissions and HTTP bridge to real services',before,calls,after:await snapshot()});vi.unstubAllGlobals();});
async function prepare(kind:'retail'|'inventory',quantity=1){
  const actionId=kind==='retail'?'retail.order.draft.create':'inventory.transfer.create';
  const values=kind==='retail'?{targetBranch:branchId,items:[{productId:variantId,quantity}]}:{targetBranch:branchId,toBranch:targetBranchId,fromWarehouseId:warehouseId,reason:'Bổ sung hàng',items:[{productId,variantId,quantity}]};
  state.interpret.mockResolvedValue({actionId,newRequest:true,values});
  let reply:any=await turn({text:kind==='retail'?'Tạo đơn nháp bán '+quantity+' điện thoại':'Chuyển '+quantity+' điện thoại từ kho gửi sang chi nhánh nhận để bổ sung hàng'});
  for(let i=0;i<5&&reply.status==='collecting'&&reply.referenceSelections?.length;i++){
    const groups=reply.referenceSelections;
    reply=await turn({referenceSelections:Object.fromEntries(groups.filter((g:any)=>g.required&&g.options.length).map((g:any)=>[g.key,[g.options[0].value]])),skipReferenceKeys:groups.filter((g:any)=>!g.required).map((g:any)=>g.key)});
  }
  expect(reply.status,JSON.stringify(reply)).toBe('confirmation');
  expect(await RetailOrderModel.countDocuments()).toBe(0);expect(await InventoryTransferModel.countDocuments()).toBe(0);
  return reply;
}
for(const kind of ['retail','inventory'] as const){
  it(kind+' cancels preview without business writes',async()=>{
    const preview=await prepare(kind);
    expect((await turn({decision:{id:preview.action.id,confirmed:false}})).status).toBe('cancelled');
    expect(await snapshot()).toEqual(before);
  });
  it(kind+' confirms once and replay does not duplicate the record or stock movement',async()=>{
    const preview=await prepare(kind);
    const input={requestId:randomUUID(),decision:{id:preview.action.id,confirmed:true}};
    const result=await turn(input);expect(result.status,JSON.stringify(result)).toBe('completed');
    expect(parseAssistantResultTable(result.reply),result.reply).toBeTruthy();
    const saved=await snapshot();await turn(input);expect(await snapshot()).toEqual(saved);
    expect(await (kind==='retail'?RetailOrderModel:InventoryTransferModel).countDocuments()).toBe(1);
    expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(kind==='retail'?5:4);
    if(kind==='retail')expect((await RetailOrderModel.findOne({}))!.grandTotal).toBe(100000);
  });
  it(kind+' exposes insufficient-stock rejection without partial writes',async()=>{
    const preview=await prepare(kind,6);
    const result=await turn({decision:{id:preview.action.id,confirmed:true}});
    expect(result.status).not.toBe('completed');expect(result.reply).toMatch(/không đủ|khong du/i);
    expect(await snapshot()).toEqual(before);
    expect(calls.some(c=>c.method==='POST'&&c.status>=400)).toBe(true);
  });
}

it('receives the transfer in the destination branch once and conserves total stock',async()=>{
  const preview=await prepare('inventory',2);
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  const document=(await InventoryTransferModel.findOne({}))!;
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(3);
  req.user.branchId=targetBranchId;
  expect(await lookupRecords(req,'inventory.transfer.list',String(document._id),{targetBranch:targetBranchId})).toHaveLength(1);
  state.interpret.mockResolvedValue({actionId:'inventory.transfer.accept',newRequest:true,values:{targetBranch:targetBranchId,path_id:String(document._id)}});
  const receipt:any=await turn({text:'Nhận phiếu chuyển hai điện thoại tại chi nhánh nhận'});
  expect(receipt.status,JSON.stringify(receipt)).toBe('confirmation');
  const input={requestId:randomUUID(),decision:{id:receipt.action.id,confirmed:true}};
  const result=await turn(input);
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(parseAssistantResultTable(result.reply),result.reply).toBeTruthy();
  const saved=await snapshot();await turn(input);expect(await snapshot()).toEqual(saved);
  expect((await InventoryTransferModel.findById(document._id))!.status).toBe('received');
  expect((await InventoryBalanceModel.findOne({warehouseId:targetWarehouseId}))!.quantity).toBe(2);
  expect((await InventoryBalanceModel.find({variantId})).reduce((sum,row)=>sum+row.quantity,0)).toBe(5);
});
