import {beforeEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({queries:[] as any[],exists:true}));
const ids={branch:'64b000000000000000000001',warehouse:'64b000000000000000000002',product:'64b000000000000000000003'};
vi.mock('../../../model/inventory-balance.model',()=>({InventoryBalanceModel:{find:vi.fn(query=>{state.queries.push(['balances',query]);return{sort:()=>({lean:async()=>[]})};})}}));
vi.mock('../../../model/product-catalog.model',()=>({ProductCatalogModel:{exists:vi.fn(async query=>{state.queries.push(['product',query]);return state.exists;}),find:vi.fn(query=>{state.queries.push(['catalog',query]);return{select:()=>({lean:async()=>[]})};})}}));
vi.mock('../../../model/product-variant.model',()=>({ProductVariantModel:{find:vi.fn(()=>({select:()=>({sort:()=>({lean:async()=>[]}),lean:async()=>[]})}))}}));
vi.mock('../../../model/inventory-ledger-entry.model',()=>({InventoryLedgerEntryModel:{aggregate:vi.fn(async()=>[])}}));
vi.mock('./warehouse.service',()=>({listWarehouses:vi.fn(async()=>[{_id:'64b000000000000000000002',name:'QA Kho'}])}));
vi.mock('../../../model/branch.model',()=>({BranchModel:{find:vi.fn(()=>({select:()=>({lean:async()=>[]})}))}}));
import {warehouseController} from './warehouse.controller';
const call=async(query:any)=>{
 const result:any={statusCode:200},res:any={status:(code:number)=>{result.statusCode=code;return res;},json:(body:any)=>{result.body=body;return res;}};
 await warehouseController.balances({user:{companyCode:'QA',branchId:ids.branch,role:'member'},query} as any,res);return result;
};
beforeEach(()=>{state.queries=[];state.exists=true;});
it('filters product identity without weakening the company/branch/warehouse scope',async()=>{
 const result=await call({productId:ids.product,warehouseId:ids.warehouse});expect(result.statusCode,JSON.stringify(result)).toBe(200);
 expect(state.queries).toContainEqual(['product',{_id:ids.product,companyCode:'QA'}]);
 expect(state.queries).toContainEqual(['balances',{companyCode:'QA',branchId:ids.branch,warehouseId:{$in:[ids.warehouse]},productId:ids.product}]);
 expect(state.queries.find(([kind])=>kind==='catalog')?.[1]).toMatchObject({_id:ids.product,companyCode:'QA'});
});
it('rejects a foreign product before querying stock',async()=>{
 state.exists=false;expect((await call({productId:ids.product})).statusCode).toBe(404);
 expect(state.queries).toEqual([['product',{_id:ids.product,companyCode:'QA'}]]);
});
it('cannot change a member branch through query input',async()=>{
 expect((await call({productId:ids.product,branchId:'64b000000000000000000009'})).statusCode).toBe(403);expect(state.queries).toEqual([]);
});
