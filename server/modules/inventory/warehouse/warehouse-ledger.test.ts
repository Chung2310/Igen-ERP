import {beforeEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({queries:[] as any[],selection:'',exists:true}));
vi.mock('../../../model/inventory-ledger-entry.model',()=>({InventoryLedgerEntryModel:{
 find:vi.fn((query:any)=>{state.queries.push(query);const chain:any={select:(s:string)=>{state.selection=s;return chain;},sort:()=>chain,skip:()=>chain,limit:()=>chain,maxTimeMS:()=>chain,lean:async()=>[{sku:'QA',quantity:2}]};return chain;}),
 countDocuments:vi.fn((query:any)=>{state.queries.push(query);return {maxTimeMS:async()=>2};}),
}}));
vi.mock('../../../model/warehouse.model',()=>({WarehouseModel:{exists:vi.fn(async query=>{state.queries.push(query);return state.exists;})}}));
import {warehouseController} from './warehouse.controller';
const branch='64b000000000000000000001',warehouse='64b000000000000000000002';
const call=async(query:any={},user:any={companyCode:'QA',branchId:branch,role:'member'})=>{
 const result:any={statusCode:200};const res:any={status:(s:number)=>{result.statusCode=s;return res;},json:(data:any)=>{result.body=data;return res;}};
 await warehouseController.ledger({user,query} as any,res);return result;
};
beforeEach(()=>{state.queries=[];state.selection='';state.exists=true;});
it('scopes every page and count by the authenticated company/branch and selects public ledger fields',async()=>{
 const r=await call({page:2,limit:1});expect(r.statusCode).toBe(200);expect(r.body.data).toMatchObject({total:2,page:2,limit:1});
 expect(state.queries).toEqual([{companyCode:'QA',branchId:branch},{companyCode:'QA',branchId:branch}]);expect(state.selection).toContain('-_id');expect(state.selection).not.toContain('sourceId');
});
it('refuses a foreign warehouse and malformed pagination before reading any ledger rows',async()=>{
 state.exists=false;expect((await call({warehouseId:warehouse})).statusCode).toBe(404);expect(state.queries).toEqual([{companyCode:'QA',branchId:branch,_id:warehouse}]);
 state.queries=[];expect((await call({page:0})).statusCode).toBe(400);expect(state.queries).toHaveLength(0);
});
it('does not trust a request to read another branch for a member',async()=>{
 expect((await call({branchId:'64b000000000000000000003'})).statusCode).toBe(403);expect(state.queries).toHaveLength(0);
});
