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
import { InventoryLedgerEntryModel } from '../model/inventory-ledger-entry.model';
import { GoodsReceiptModel } from '../model/goods-receipt.model';
import { DomainEventModel } from '../integrations/shared/domain-event.model';
import { RetailOrderModel } from '../modules/retail/models/retail-order.model';
import { CustomerModel } from '../modules/customer-management/models/customer.model';
import { RetailInvoiceModel } from '../modules/retail/models/retail-invoice.model';
import { CashierShiftModel } from '../modules/retail/models/cashier-shift.model';
import { CashierShiftService, businessDateInVietnam } from '../modules/retail/services/cashier-shift.service';
import { RetailSettingsModel } from '../modules/retail/models/retail-settings.model';
import { RetailOrderService, serializeRetailOrder } from '../modules/retail/services/retail-order.service';
import { RetailProductService } from '../modules/retail/services/retail-product.service';
import { ProductCatalogService } from '../modules/inventory/product-catalog/product-catalog.service';
import { listWarehouses } from '../modules/inventory/warehouse/warehouse.service';
import { createTransfer, listTransfers, getTransfer, acceptTransfer, cancelTransfer } from '../modules/inventory/transfers/transfer.service';
import { InventoryTransferModel } from '../modules/inventory/transfers/transfer.model';
const id=()=>new mongoose.Types.ObjectId().toString();
const branchId=id(), targetBranchId=id(), warehouseId=id(), targetWarehouseId=id(), productId=id(), variantId=id();
const scope={companyCode:'TEST',branchId};
const actor={id:'actor',name:'Người kiểm tra',displayName:'Người kiểm tra',role:'admin'};
const req={user:{...actor,uid:'actor',...scope},headers:{},socket:{localPort:4050,localAddress:'127.0.0.1'}} as any;
const audit=conversationAudit('retail-inventory-real-db', 'Real business services and isolated temporary MongoDB. AI interpretation, assistant sessions, permissions, rewriting and HTTP transport are mocked. Domain events are persisted but background delivery is not exercised. No production data writes.');
const turn=(input:any)=>audit.turn(input,()=>processTurn(req,{conversationId:'retail-inventory-real-db',requestId:randomUUID(),...input}));
let mongo:MongoMemoryReplSet;
let calls:any[]=[];
let before:any;
const snapshot=async()=>({orders:await RetailOrderModel.find({}).lean(),invoices:await RetailInvoiceModel.find({}).lean(),shifts:await CashierShiftModel.find({}).lean(),transfers:await InventoryTransferModel.find({}).lean(),warehouses:await WarehouseModel.find({}).lean(),balances:await InventoryBalanceModel.find({}).lean(),stockLedger:await InventoryLedgerEntryModel.find({}).lean(),receipts:await GoodsReceiptModel.find({}).lean(),events:await DomainEventModel.find({}).lean()});
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
      else if(path==='/customers'&&method==='GET')data={items:await CustomerModel.find({companyCode:'TEST'}).lean(),total:await CustomerModel.countDocuments({companyCode:'TEST'})};
      else if(path==='/retail/shifts/current')data=await CashierShiftService.current(activeScope,actor);
      else if(path==='/retail/orders/quote'&&method==='POST')data=await RetailOrderService.quote(activeScope,body);
      else if(/^\/retail\/orders\/[^/]+\/confirm$/.test(path)&&method==='POST'){
        const attempt=await RetailOrderService.idempotency(activeScope,body.idempotencyKey);
        const shift=attempt.status==='not_found'?await CashierShiftService.operational(activeScope,actor,new Date(),body.terminalId||'default',body.posSessionId):undefined;
        const result=await RetailOrderService.confirm(activeScope,path.split('/').at(-2)!,body,actor,shift,true);
        data={...result,order:serializeRetailOrder(result.order,true)};
      }
      else if(/^\/retail\/orders\/[^/]+\/payments$/.test(path)&&method==='POST')data=await RetailOrderService.collect(activeScope,path.split('/').at(-2)!,body,actor,body.cashSessionId?{_id:body.cashSessionId}:undefined);
      else if(/^\/retail\/orders\/[^/]+\/cancel$/.test(path)&&method==='POST')data=await RetailOrderService.cancel(activeScope,path.split('/').at(-2)!,body,actor,body.cashSessionId?{_id:body.cashSessionId}:undefined,true);
      else if(path==='/retail/orders/products')data=await RetailProductService.search(activeScope,Object.fromEntries(u.searchParams));
      else if(path==='/retail/orders'&&method==='POST')data=serializeRetailOrder(await RetailOrderService.createDraft(activeScope,body,actor),true);
      else if(path==='/retail/orders'&&method==='GET')data=await RetailOrderService.list(activeScope,Object.fromEntries(u.searchParams));
      else if(/^\/retail\/orders\/[^/]+$/.test(path)&&method==='GET')data=serializeRetailOrder(await RetailOrderService.detail(activeScope,path.split('/').at(-1)!,actor,true),true);
      else if(/^\/retail\/orders\/[^/]+$/.test(path)&&method==='PATCH')data=serializeRetailOrder(await RetailOrderService.updateDraft(activeScope,path.split('/').at(-1)!,body,actor,true),true);
      else if(path==='/inventory/warehouses')data=await listWarehouses('TEST',activeScope.branchId);
      else if(path==='/inventory/catalog/products')data=await ProductCatalogService.list('TEST',Object.fromEntries(u.searchParams));
      else if(path.startsWith('/inventory/catalog/products/'))data=await ProductCatalogService.get('TEST',path.split('/').at(-1)!);
      else if(path==='/inventory/transfers'&&method==='POST')data=await createTransfer(activeScope,body,actor);
      else if(path==='/inventory/transfers')data=await listTransfers(activeScope);
      else if(path.endsWith('/accept'))data=await acceptTransfer(activeScope,path.split('/').at(-2)!,actor);
      else if(path.endsWith('/cancel'))data=await cancelTransfer(activeScope,path.split('/').at(-2)!,body.reason,actor);
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
async function prepare(kind:'retail'|'inventory',quantity=1,extra:Record<string,unknown>={}){
  const actionId=kind==='retail'?'retail.order.draft.create':'inventory.transfer.create';
  const values=kind==='retail'?{targetBranch:branchId,items:[{productId:variantId,quantity}],...extra}:{targetBranch:branchId,toBranch:targetBranchId,fromWarehouseId:warehouseId,reason:'Bổ sung hàng',items:[{productId,variantId,quantity}]};
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

async function prepareCancellation() {
  const preview=await prepare('inventory',2);
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  const document=(await InventoryTransferModel.findOne({}))!;
  state.interpret.mockResolvedValue({actionId:'inventory.transfer.cancel',newRequest:true,values:{targetBranch:branchId,path_id:String(document._id),reason:'Chi nhánh không còn cần hàng'}});
  const cancellation:any=await turn({text:'Hủy phiếu vừa chuyển vì chi nhánh không còn cần hàng'});
  expect(cancellation.status,JSON.stringify(cancellation)).toBe('confirmation');
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(3);
  return {document,cancellation};
}

it.each([true,false])('keeps the same retail draft when handling optional follow-up (supplement: %s)',async supplement=>{
  const preview=await prepare('retail',2,{items:[{productId:variantId,quantity:2,discount:{type:'amount',value:10000}}],manualOrderDiscount:{type:'amount',value:5000},taxRate:10,shippingFee:3000,dueDate:'2026-12-01'});
  const created=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(created.status).toBe('completed');
  expect(created.reply).toMatch(/Bạn có muốn bổ sung(?: [^?\n]+)? không\?/);
  const original=(await RetailOrderModel.findOne({}).lean())!;
  const followUp=await turn({text:supplement?'có':'bỏ qua'});
  if(supplement){
    expect(followUp.status,JSON.stringify(followUp)).toBe('collecting');
    expect(state.session.pending?.provided?.path_id).toBe(String(original._id));
    state.interpret.mockResolvedValueOnce({actionId:'retail.order.draft.update',newRequest:false,values:{note:'Giao vào buổi sáng'}});
    const update:any=await turn({text:'Bổ sung ghi chú giao vào buổi sáng'});
    expect(update.status,JSON.stringify(update)).toBe('confirmation');
    expect((await RetailOrderModel.findById(original._id))!.note).not.toBe('Giao vào buổi sáng');
    const saved=await turn({decision:{id:update.action.id,confirmed:true}});
    expect(saved.status,JSON.stringify(saved)).toBe('completed');
    expect(parseAssistantResultTable(saved.reply)).toBeTruthy();
    expect((await RetailOrderModel.findById(original._id))!.note).toBe('Giao vào buổi sáng');
  }else expect(followUp.status).toBe('completed');
  const final=(await RetailOrderModel.findById(original._id).lean())!;
  expect(final.items).toEqual(original.items);
  expect(final.grandTotal).toBe(original.grandTotal);
  expect(final.taxRate).toBe(10);
  expect(final.shippingFee).toBe(3000);
  expect(final.manualOrderDiscount).toBe(5000);
  expect(final.dueDate).toEqual(original.dueDate);
  expect(await RetailOrderModel.countDocuments()).toBe(1);
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(5);
});

it('cancels dispatched goods and restores source stock exactly once',async()=>{
  const {document,cancellation}=await prepareCancellation();
  const input={requestId:randomUUID(),decision:{id:cancellation.action.id,confirmed:true}};
  const result=await turn(input);
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(parseAssistantResultTable(result.reply)).toBeTruthy();
  expect((await InventoryTransferModel.findById(document._id))!.status).toBe('cancelled');
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(5);
  const saved=await snapshot();await turn(input);expect(await snapshot()).toEqual(saved);
});

it('rejects a note update if another cashier changed the draft after preview',async()=>{
  const preview=await prepare('retail',2);
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  const original=(await RetailOrderModel.findOne({}))!;
  await turn({text:'có'});
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.draft.update',newRequest:false,values:{note:'Giao buổi sáng'}});
  const update:any=await turn({text:'Bổ sung ghi chú giao buổi sáng'});
  expect(update.status,JSON.stringify(update)).toBe('confirmation');
  await RetailOrderService.updateDraft(scope,String(original._id),{version:0,idempotencyKey:randomUUID(),items:[{productId:variantId,quantity:3}],note:'Thu ngân đã sửa'},actor,true);
  const changed=await snapshot();
  calls.push({externalEvent:'cashier updated the draft after assistant preview',state:changed});
  const result=await turn({decision:{id:update.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('đã thay đổi');
  expect(await snapshot()).toEqual(changed);
});

it('applies an explicit order discount instead of silently keeping the old manual discount',async()=>{
  const preview=await prepare('retail',2,{manualOrderDiscount:{type:'amount',value:5000}});
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  const original=(await RetailOrderModel.findOne({}))!;
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.draft.update',newRequest:true,values:{targetBranch:branchId,path_id:String(original._id),orderDiscount:{type:'amount',value:10000}}});
  const update:any=await turn({text:'Đổi giảm giá đơn vừa tạo thành 10.000 đồng'});
  expect(update.status,JSON.stringify(update)).toBe('confirmation');
  const result=await turn({decision:{id:update.action.id,confirmed:true}});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  const saved=(await RetailOrderModel.findById(original._id))!;
  expect(saved.manualOrderDiscount).toBe(10000);
  expect(saved.grandTotal).toBe(190000);
  expect(saved.items).toHaveLength(1);
  expect(saved.items[0].quantity).toBe(2);
  expect(await RetailOrderModel.countDocuments()).toBe(1);
});

it('rejects stale cancellation when destination received goods after the preview',async()=>{
  const {document,cancellation}=await prepareCancellation();
  await acceptTransfer({companyCode:'TEST',branchId:targetBranchId},String(document._id),actor);
  const received=await snapshot();
  calls.push({externalEvent:'destination received transfer after assistant preview',state:received});
  const result=await turn({decision:{id:cancellation.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toMatch(/nhận|vận chuyển|hủy/i);
  expect(await snapshot()).toEqual(received);
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(3);
  expect((await InventoryBalanceModel.findOne({warehouseId:targetWarehouseId}))!.quantity).toBe(2);
});

it('rechecks stock at retail confirmation when inventory changed after preview',async()=>{
  const preview=await prepare('retail',4);
  await createTransfer(scope,{fromWarehouseId:warehouseId,toBranchId:targetBranchId,reason:'Yêu cầu khác',idempotencyKey:randomUUID(),items:[{productId,variantId,quantity:3}]},actor);
  const changed=await snapshot();
  calls.push({externalEvent:'another operation shipped stock after retail preview',state:changed});
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('không đủ');
  expect(await snapshot()).toEqual(changed);
  expect(await RetailOrderModel.countDocuments()).toBe(0);
});

async function prepareSale(options:{openShift?:boolean;amount?:number;lineDiscount?:number;credit?:boolean}={}){
  const customer=options.credit?await CustomerModel.create({companyCode:'TEST',customerCode:'KH-TEST',name:'Khách thử nghiệm',phone:'0900000000',normalizedPhone:'0900000000',status:'active',source:'pos',createdBy:actor.id,createdByName:actor.displayName,version:0}):null;
  const draft=await prepare('retail',2,{
    ...(options.lineDiscount?{items:[{productId:variantId,quantity:2,discount:{type:'amount',value:options.lineDiscount}}]}:{}),
    ...(customer?{customerId:String(customer._id),dueDate:'2026-12-01'}:{}),
  });
  expect((await turn({decision:{id:draft.action.id,confirmed:true}})).status).toBe('completed');
  const order=(await RetailOrderModel.findOne({}))!;
  if(options.openShift!==false)await CashierShiftModel.collection.insertOne({
    _id:new mongoose.Types.ObjectId(),...scope,shiftCode:'CA-TEST',cashierId:actor.id,cashierName:actor.displayName,
    status:'open',terminalId:'default',openingFloat:0,openedBy:actor.id,openedAt:new Date(),
    operationalEndsAt:new Date(Date.now()+3600000),businessDate:businessDateInVietnam(new Date()),activityVersion:0,
  });
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.confirm',newRequest:true,values:{targetBranch:branchId,path_id:String(order._id),payments:[{method:'cash',amount:options.amount??200000}]}});
  const sale:any=await turn({text:`Xác nhận đơn vừa tạo, thu tiền mặt ${options.amount??200000} đồng`});
  return {order,sale};
}

it('confirms a retail cash sale once with one invoice and one stock deduction',async()=>{
  const {order,sale}=await prepareSale();
  expect(sale.status,JSON.stringify(sale)).toBe('confirmation');
  const input={requestId:randomUUID(),decision:{id:sale.action.id,confirmed:true}};
  const result=await turn(input);
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(parseAssistantResultTable(result.reply),result.reply).toBeTruthy();
  const saved=await snapshot();await turn(input);expect(await snapshot()).toEqual(saved);
  expect(await RetailInvoiceModel.countDocuments()).toBe(1);
  await turn({...input,requestId:randomUUID()});expect(await snapshot()).toEqual(saved);
  expect((await RetailOrderModel.findById(order._id))!.paidAmount).toBe(200000);
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(3);
});

it.each([{openShift:false},{amount:100000}])('refuses a retail sale without an open shift or enough payment: %j',async options=>{
  const {sale}=await prepareSale(options);
  expect(sale.status).not.toBe('confirmation');
  expect(sale.status).not.toBe('completed');
  expect(sale.reply).toMatch(options.openShift===false?/mở ca POS/:/còn nợ|thanh toán đủ/);
  expect(await RetailInvoiceModel.countDocuments()).toBe(0);
  expect((await RetailOrderModel.findOne({}))!.status).toBe('draft');
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(5);
});

it('rejects sale confirmation if the draft changed after preview even with the same total',async()=>{
  const {order,sale}=await prepareSale();
  expect(sale.status,JSON.stringify(sale)).toBe('confirmation');
  await RetailOrderService.updateDraft(scope,String(order._id),{version:0,idempotencyKey:randomUUID(),items:[{productId:variantId,quantity:2}],note:'Thu ngân đã sửa'},actor,true);
  const changed=await snapshot();calls.push({externalEvent:'cashier edited draft after sale preview',state:changed});
  const result=await turn({decision:{id:sale.action.id,confirmed:true}});
  expect(result.status,JSON.stringify(result)).not.toBe('completed');
  expect(await snapshot()).toEqual(changed);
});

it('cancels the sale preview without issuing an invoice or deducting stock',async()=>{
  const {sale}=await prepareSale();
  expect(sale.status,JSON.stringify(sale)).toBe('confirmation');
  const unchanged=await snapshot();
  expect((await turn({decision:{id:sale.action.id,confirmed:false}})).status).toBe('cancelled');
  expect(await snapshot()).toEqual(unchanged);
});

it('refuses confirmation after the cashier shift closes',async()=>{
  const {sale}=await prepareSale();
  expect(sale.status).toBe('confirmation');
  await CashierShiftModel.updateMany({},{$set:{status:'closed'}});
  const unchanged=await snapshot();
  const result=await turn({decision:{id:sale.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('mở ca POS');
  expect(await snapshot()).toEqual(unchanged);
});

it('rolls back the sale when issuing the invoice fails and shows the API reason',async()=>{
  const {sale}=await prepareSale();
  expect(sale.status).toBe('confirmation');
  const unchanged=await snapshot();
  const failure=vi.spyOn(RetailInvoiceModel,'create').mockRejectedValueOnce(new Error('Không thể lưu hóa đơn thử nghiệm'));
  try{
    const result=await turn({decision:{id:sale.action.id,confirmed:true}});
    expect(result.status).not.toBe('completed');
    expect(result.reply).toContain('Không thể lưu hóa đơn thử nghiệm');
    expect(await snapshot()).toEqual(unchanged);
  }finally{failure.mockRestore();}
});

it('preserves the saved line discount when quoting and confirming the sale',async()=>{
  const {order,sale}=await prepareSale({lineDiscount:10000,amount:190000});
  expect(sale.status,JSON.stringify(sale)).toBe('confirmation');
  const result=await turn({decision:{id:sale.action.id,confirmed:true}});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  const saved=(await RetailOrderModel.findById(order._id))!;
  expect(saved.grandTotal).toBe(190000);
  expect(saved.paidAmount).toBe(190000);
  expect(saved.items[0].discountAmount).toBe(10000);
  expect(await RetailInvoiceModel.countDocuments()).toBe(1);
});

it('requires a new preview when the selling price changes',async()=>{
  const {sale}=await prepareSale();
  expect(sale.status).toBe('confirmation');
  await ProductPriceModel.updateOne({variantId},{$set:{sellingPrice:90000}});
  const unchanged=await snapshot();
  const result=await turn({decision:{id:sale.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('đã thay đổi');
  expect(await snapshot()).toEqual(unchanged);
});

it('does not switch the approved sale to a new cashier shift automatically',async()=>{
  const {sale}=await prepareSale();
  expect(sale.status).toBe('confirmation');
  const old=(await CashierShiftModel.findOne({}).lean())!;
  await CashierShiftModel.updateOne({_id:old._id},{$set:{status:'closed'}});
  await CashierShiftModel.collection.insertOne({...old,_id:new mongoose.Types.ObjectId(),shiftCode:'CA-NEW',status:'open'});
  const unchanged=await snapshot();
  const result=await turn({decision:{id:sale.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('đã thay đổi');
  expect(await snapshot()).toEqual(unchanged);
});

async function completedSale(credit=false){
  const {order,sale}=await prepareSale(credit?{credit:true,amount:100000}:{});
  expect(sale.status,JSON.stringify(sale)).toBe('confirmation');
  const result=await turn({decision:{id:sale.action.id,confirmed:true}});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  return (await RetailOrderModel.findById(order._id))!;
}
async function afterSalePreview(orderId:string,kind:'collect'|'cancel',amount:number){
  const values=kind==='collect'?{payments:[{method:'cash',amount}]}:{reason:'Khách đổi ý',refunds:amount===0?[]:[{method:'cash',amount}]};
  state.interpret.mockResolvedValueOnce({actionId:`retail.order.${kind}`,newRequest:true,values:{targetBranch:branchId,path_id:orderId,...values}});
  return turn({text:kind==='collect'?`Thu thêm ${amount} đồng tiền mặt cho đơn vừa bán`:`Hủy đơn vừa bán vì khách đổi ý, hoàn ${amount} đồng tiền mặt`});
}

it('collects the remaining debt once without issuing another invoice or changing stock',async()=>{
  const order=await completedSale(true);
  expect(order.dueAmount).toBe(100000);
  const preview:any=await afterSalePreview(String(order._id),'collect',100000);
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const input={requestId:randomUUID(),decision:{id:preview.action.id,confirmed:true}};
  const result=await turn(input);
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(parseAssistantResultTable(result.reply)).toBeTruthy();
  const saved=(await RetailOrderModel.findById(order._id))!;
  expect(saved.dueAmount).toBe(0);expect(saved.paidAmount).toBe(200000);expect(saved.payments).toHaveLength(2);
  expect(saved.status).toBe('completed');
  const unchanged=await snapshot();await turn(input);expect(await snapshot()).toEqual(unchanged);
  expect(await RetailInvoiceModel.countDocuments()).toBe(1);
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(3);
});

it('shows the API overcollection reason without changing debt or payments',async()=>{
  const order=await completedSale(true);
  const preview:any=await afterSalePreview(String(order._id),'collect',150000);
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const unchanged=await snapshot();
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('vượt công nợ');
  expect(await snapshot()).toEqual(unchanged);
});

it('cancels a paid order, refunds once and restores stock once',async()=>{
  const order=await completedSale();
  const preview:any=await afterSalePreview(String(order._id),'cancel',200000);
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const input={requestId:randomUUID(),decision:{id:preview.action.id,confirmed:true}};
  const result=await turn(input);
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(parseAssistantResultTable(result.reply)).toBeTruthy();
  const saved=(await RetailOrderModel.findById(order._id))!;
  expect(saved.status).toBe('cancelled');expect(saved.refundedAmount).toBe(200000);expect(saved.refunds).toHaveLength(1);
  expect((await RetailInvoiceModel.findOne({orderId:String(order._id)}))!.status).toBe('void');
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(5);
  const unchanged=await snapshot();await turn(input);expect(await snapshot()).toEqual(unchanged);
});

it('asks for the exact refund instead of cancelling with an incomplete refund',async()=>{
  const order=await completedSale();
  const unchanged=await snapshot();
  const result=await afterSalePreview(String(order._id),'cancel',100000);
  expect(result.status).not.toBe('confirmation');expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('200.000');
  expect(await snapshot()).toEqual(unchanged);
});

it.each(['collect','cancel'] as const)('declining the %s preview leaves all sale data unchanged',async kind=>{
  const order=await completedSale(kind==='collect');
  const preview:any=await afterSalePreview(String(order._id),kind,kind==='collect'?100000:200000);
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const unchanged=await snapshot();
  expect((await turn({decision:{id:preview.action.id,confirmed:false}})).status).toBe('cancelled');
  expect(await snapshot()).toEqual(unchanged);
});

it('rolls back refund, stock receipt and order cancellation if invoice voiding fails',async()=>{
  const order=await completedSale();
  const preview:any=await afterSalePreview(String(order._id),'cancel',200000);
  expect(preview.status).toBe('confirmation');
  const unchanged=await snapshot();
  const failure=vi.spyOn(RetailInvoiceModel,'updateOne').mockRejectedValueOnce(new Error('Không thể hủy hóa đơn thử nghiệm'));
  try{
    const result=await turn({decision:{id:preview.action.id,confirmed:true}});
    expect(result.status).not.toBe('completed');
    expect(result.reply).toContain('Không thể hủy hóa đơn thử nghiệm');
    expect(await snapshot()).toEqual(unchanged);
  }finally{failure.mockRestore();}
});

it('requires a new collection preview after another payment changes the debt',async()=>{
  const order=await completedSale(true);
  const preview:any=await afterSalePreview(String(order._id),'collect',50000);
  expect(preview.status).toBe('confirmation');
  await RetailOrderService.collect(scope,String(order._id),{expectedVersion:order.version,idempotencyKey:randomUUID(),payments:[{method:'transfer',amount:20000}]},actor);
  const changed=await snapshot();calls.push({externalEvent:'another payment reduced the outstanding debt',state:changed});
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('đã thay đổi');
  expect(await snapshot()).toEqual(changed);
});

it.each(['collect','cancel'] as const)('refuses cash %s if the POS shift closes after preview',async kind=>{
  const order=await completedSale(kind==='collect');
  const preview:any=await afterSalePreview(String(order._id),kind,kind==='collect'?100000:200000);
  expect(preview.status).toBe('confirmation');
  await CashierShiftModel.updateMany({},{$set:{status:'closed'}});
  const unchanged=await snapshot();
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('ca POS đang mở');
  expect(await snapshot()).toEqual(unchanged);
});

it('cancels the just-created unpaid draft without a refund or any stock movement',async()=>{
  const draft=await prepare('retail',2);
  expect((await turn({decision:{id:draft.action.id,confirmed:true}})).status).toBe('completed');
  const order=(await RetailOrderModel.findOne({}))!;
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.cancel',newRequest:true,values:{targetBranch:branchId,path_id:String(order._id),reason:'Không mua nữa',refunds:[]}});
  const preview:any=await turn({text:'Hủy đơn nháp vừa tạo vì khách không mua nữa, chưa thu tiền nên không hoàn tiền'});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status,JSON.stringify(result)).toBe('completed');
  expect(await RetailOrderModel.countDocuments()).toBe(0);
  expect(await RetailInvoiceModel.countDocuments()).toBe(0);
  expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(5);
});

it('asks which draft to cancel when two unpaid drafts have identical totals',async()=>{
  const orders=await Promise.all([1,2].map(()=>RetailOrderService.createDraft(scope,{items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()},actor)));
  const unchanged=await snapshot();
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.cancel',newRequest:true,values:{targetBranch:branchId,reason:'Không mua nữa',refunds:[]}});
  const result:any=await turn({text:'Hủy đơn nháp 200 nghìn vì khách không mua nữa'});
  expect(result.status,JSON.stringify(result)).toBe('collecting');
  const choices=result.referenceSelections?.find((group:any)=>group.key==='path_id');
  expect(choices,JSON.stringify(result)).toBeTruthy();
  expect(choices.options).toHaveLength(2);
  expect(new Set(choices.options.map((option:any)=>option.value)).size).toBe(2);
  for(const order of orders)expect(choices.options.some((option:any)=>option.label.includes(`ô giữ đơn: ${order.heldSlot}`))).toBe(true);
  expect(await snapshot()).toEqual(unchanged);
  const selected=orders[0];
  const option=choices.options.find((item:any)=>item.label.includes(`ô giữ đơn: ${selected.heldSlot}`));
  const preview:any=await turn({referenceSelections:{path_id:[option.value]}});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  expect(await RetailOrderModel.findById(selected._id)).toBeNull();
  expect(await RetailOrderModel.findById(orders[1]._id)).not.toBeNull();
  expect((await InventoryBalanceModel.findOne({warehouseId}))!.quantity).toBe(5);
});

it('does not cancel a draft from another branch when the requested branch differs',async()=>{
  const order=await RetailOrderService.createDraft(scope,{items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()},actor);
  const unchanged=await snapshot();
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.cancel',newRequest:true,values:{targetBranch:targetBranchId,path_id:String(order._id),reason:'Không mua nữa',refunds:[]}});
  const result=await turn({text:'Hủy đơn này ở chi nhánh nhận'});
  expect(result.status,JSON.stringify(result)).not.toBe('confirmation');
  expect(result.status).not.toBe('completed');
  expect(await snapshot()).toEqual(unchanged);
  expect(calls.some(call=>call.method==='POST'&&call.path.endsWith('/cancel'))).toBe(false);
});

it('does not repeat a draft cancellation when its confirmation request is replayed',async()=>{
  const order=await RetailOrderService.createDraft(scope,{items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()},actor);
  const preview:any=await afterSalePreview(String(order._id),'cancel',0);
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  const input={requestId:randomUUID(),decision:{id:preview.action.id,confirmed:true}};
  const first=await turn(input);
  expect(first.status,JSON.stringify(first)).toBe('completed');
  const saved=await snapshot();
  const count=calls.filter(call=>call.method==='POST'&&call.path.endsWith('/cancel')).length;
  const replay=await turn(input);
  expect(replay.reply).toBe(first.reply);
  expect(await snapshot()).toEqual(saved);
  expect(calls.filter(call=>call.method==='POST'&&call.path.endsWith('/cancel'))).toHaveLength(count);
});

it('refuses stale cancellation after another cashier already cancelled the draft',async()=>{
  const order=await RetailOrderService.createDraft(scope,{items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()},actor);
  const preview:any=await afterSalePreview(String(order._id),'cancel',0);
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  await RetailOrderService.cancel(scope,String(order._id),{expectedVersion:order.version,idempotencyKey:randomUUID(),reason:'Thu ngân đã hủy',refunds:[]},actor,undefined,true);
  const saved=await snapshot();
  calls.push({externalEvent:'cashier cancelled draft after preview',state:saved});
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(await snapshot()).toEqual(saved);
});

it('distinguishes equal drafts in the same held slot belonging to different cashiers',async()=>{
  const cashiers=[{...actor,id:'cashier-a',name:'Thu ngân An',displayName:'Thu ngân An'},{...actor,id:'cashier-b',name:'Thu ngân Bình',displayName:'Thu ngân Bình'}];
  const orders=[];
  for(const cashier of cashiers)orders.push(await RetailOrderService.createDraft(scope,{items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()},cashier));
  expect(orders[0].heldSlot).toBe(orders[1].heldSlot);
  const unchanged=await snapshot();
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.cancel',newRequest:true,values:{targetBranch:branchId,reason:'Khách đổi ý',refunds:[]}});
  const result:any=await turn({text:'Hủy một đơn nháp 200 nghìn'});
  expect(result.status).toBe('collecting');
  const choices=result.referenceSelections?.find((group:any)=>group.key==='path_id');
  expect(choices?.options,JSON.stringify(result)).toHaveLength(2);
  expect(await snapshot()).toEqual(unchanged);
  const option=choices.options.find((item:any)=>item.label.includes('Thu ngân Bình'));
  expect(option).toBeTruthy();
  const preview:any=await turn({referenceSelections:{path_id:[option.value]}});
  expect(preview.status,JSON.stringify(preview)).toBe('confirmation');
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  expect(await RetailOrderModel.findById(orders[0]._id)).not.toBeNull();
  expect(await RetailOrderModel.findById(orders[1]._id)).toBeNull();
});

it('does not guess when cashier names, held slots and draft totals are identical',async()=>{
  for(const id of ['cashier-a','cashier-b'])await RetailOrderService.createDraft(scope,{items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()},{...actor,id});
  const unchanged=await snapshot();
  state.interpret.mockResolvedValueOnce({actionId:'retail.order.cancel',newRequest:true,values:{targetBranch:branchId,reason:'Khách đổi ý',refunds:[]}});
  const result:any=await turn({text:'Hủy một đơn nháp 200 nghìn'});
  expect(result.status).toBe('collecting');
  const choices=result.referenceSelections?.find((group:any)=>group.key==='path_id');
  expect(choices?.options).toHaveLength(1);
  const selected=await turn({referenceSelections:{path_id:[choices.options[0].value]}});
  expect(selected.status).not.toBe('confirmation');
  expect(selected.status).not.toBe('completed');
  expect(await snapshot()).toEqual(unchanged);
});

it('does not cancel a replacement draft that reuses the cancelled draft held slot',async()=>{
  const input={items:[{productId:variantId,quantity:2}],idempotencyKey:randomUUID()};
  const original=await RetailOrderService.createDraft(scope,input,actor);
  const preview:any=await afterSalePreview(String(original._id),'cancel',0);
  expect(preview.status).toBe('confirmation');
  await RetailOrderService.cancel(scope,String(original._id),{expectedVersion:original.version,idempotencyKey:randomUUID(),reason:'Thu ngân đã hủy',refunds:[]},actor,undefined,true);
  const replacement=await RetailOrderService.createDraft(scope,{...input,idempotencyKey:randomUUID()},actor);
  expect(replacement.heldSlot).toBe(original.heldSlot);
  const unchanged=await snapshot();
  calls.push({externalEvent:'cashier replaced draft in the same held slot',state:unchanged});
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(await snapshot()).toEqual(unchanged);
  expect(await RetailOrderModel.findById(replacement._id)).not.toBeNull();
});

async function sentTransfer(){
  const preview=await prepare('inventory',2);
  expect((await turn({decision:{id:preview.action.id,confirmed:true}})).status).toBe('completed');
  return (await InventoryTransferModel.findOne({}))!;
}
async function transferAction(id:string,action:'accept'|'cancel',branch:string){
  req.user.branchId=branch;
  state.interpret.mockResolvedValueOnce({actionId:`inventory.transfer.${action}`,newRequest:true,values:{targetBranch:branch,path_id:id,...(action==='cancel'?{reason:'Không còn cần hàng'}:{})}});
  return turn({text:action==='accept'?'Nhận phiếu chuyển kho này':'Hủy phiếu chuyển kho này vì không còn cần hàng'});
}

it.each(['accept','cancel'] as const)('refuses transfer %s from the wrong endpoint branch',async action=>{
  const document=await sentTransfer();
  const unchanged=await snapshot();
  let result:any=await transferAction(String(document._id),action,action==='accept'?branchId:targetBranchId);
  if(result.status==='confirmation')result=await turn({decision:{id:result.action.id,confirmed:true}});
  expect(result.status,JSON.stringify(result)).not.toBe('completed');
  expect(result.reply).toMatch(/phạm vi|chi nhánh|không tìm thấy/i);
  expect(await snapshot()).toEqual(unchanged);
});

it('refuses receipt when the source cancelled the transfer after preview',async()=>{
  const document=await sentTransfer();
  const preview:any=await transferAction(String(document._id),'accept',targetBranchId);
  expect(preview.status).toBe('confirmation');
  await cancelTransfer(scope,String(document._id),'Nguồn đã hủy',actor);
  const unchanged=await snapshot();
  calls.push({externalEvent:'source cancelled transfer after receipt preview',state:unchanged});
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toMatch(/nhận|hủy|vận chuyển/i);
  expect(await snapshot()).toEqual(unchanged);
});

it('does not add stock again for a new request to receive an already received transfer',async()=>{
  const document=await sentTransfer();
  await acceptTransfer({companyCode:'TEST',branchId:targetBranchId},String(document._id),actor);
  const unchanged=await snapshot();
  let result:any=await transferAction(String(document._id),'accept',targetBranchId);
  if(result.status==='confirmation')result=await turn({decision:{id:result.action.id,confirmed:true}});
  expect(result.reply).toMatch(/nhận|vận chuyển/i);
  expect(await snapshot()).toEqual(unchanged);
  expect((await InventoryBalanceModel.findOne({warehouseId:targetWarehouseId}))!.quantity).toBe(2);
});

it.each(['accept','cancel'] as const)('refuses transfer %s when transit stock no longer matches the document',async action=>{
  const document=await sentTransfer();
  const preview:any=await transferAction(String(document._id),action,action==='accept'?targetBranchId:branchId);
  expect(preview.status).toBe('confirmation');
  await InventoryBalanceModel.updateOne({warehouseId:document.transitWarehouseId},{$set:{quantity:1}});
  const unchanged=await snapshot();
  calls.push({externalEvent:'transit stock differs from transfer document',state:unchanged});
  const result=await turn({decision:{id:preview.action.id,confirmed:true}});
  expect(result.status).not.toBe('completed');
  expect(result.reply).toContain('đối soát');
  expect(await snapshot()).toEqual(unchanged);
});

it('rolls back receipt stock and document status when closing the transit warehouse fails',async()=>{
  const document=await sentTransfer();
  const preview:any=await transferAction(String(document._id),'accept',targetBranchId);
  expect(preview.status).toBe('confirmation');
  const unchanged=await snapshot();
  const failure=vi.spyOn(WarehouseModel,'updateOne').mockRejectedValueOnce(new Error('Không thể đóng kho vận chuyển thử nghiệm'));
  try{
    const result=await turn({decision:{id:preview.action.id,confirmed:true}});
    expect(result.status).not.toBe('completed');
    expect(result.reply).toContain('Không thể đóng kho vận chuyển thử nghiệm');
    expect(await snapshot()).toEqual(unchanged);
  }finally{failure.mockRestore();}
});
