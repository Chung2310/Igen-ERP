import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({rows:[] as any[],update:vi.fn(),find:vi.fn(),count:vi.fn()}));
vi.mock('../modules/retail/models/retail-order.model',async original=>({...await original<any>(),RetailOrderModel:{updateMany:state.update,find:state.find,countDocuments:state.count}}));
vi.mock('../modules/retail/services/retail-after-sale-history',()=>({attachAfterSaleHistory:async(_scope:any,rows:any)=>rows}));
vi.mock('../modules/retail/permissions',async original=>({...await original<any>(),hasEffectiveRetailCapability:async()=>true}));
import {RetailOrderService} from '../modules/retail/services/retail-order.service';
import {retailOrderController} from '../modules/retail/controllers/retail-order.controller';
const scope={companyCode:'QA',branchId:'507f1f77bcf86cd799439012'};
beforeEach(()=>{
 state.rows=[{_id:'QA-1',status:'draft',businessDate:'2020-01-01',version:0}];
 state.update.mockReset().mockImplementation(async()=>{state.rows[0].status='cancelled';state.rows[0].version++;return {modifiedCount:1};});
 const chain:any={sort:()=>chain,skip:()=>chain,limit:()=>chain,lean:async()=>structuredClone(state.rows)};
 state.find.mockReset().mockReturnValue(chain);state.count.mockReset().mockResolvedValue(1);
});
afterEach(()=>vi.restoreAllMocks());
it('leaves an expired draft and its version unchanged during an assistant read',async()=>{
 const before=structuredClone(state.rows),result=await RetailOrderService.list(scope,{},{readOnly:true});
 expect(result.items[0].status).toBe('draft');expect(state.rows).toEqual(before);expect(state.update).not.toHaveBeenCalled();
});
it('preserves the existing expiry policy for ordinary POS listing',async()=>{
 await RetailOrderService.list(scope,{});expect(state.update).toHaveBeenCalledTimes(1);expect(state.rows[0]).toMatchObject({status:'cancelled',version:1});
});
it.each([true,false])('honors the common read-only header=%s at the API controller',async readOnly=>{
 const list=vi.spyOn(RetailOrderService,'list').mockResolvedValue({items:[],total:0,page:1,limit:20});
 const req:any={headers:readOnly?{'x-assistant-read-only':'true'}:{},query:{},user:{id:'QA',role:'admin',companyCode:scope.companyCode,branchId:scope.branchId}};
 const res:any={json:vi.fn(),status:vi.fn().mockReturnThis()};
 await retailOrderController.list(req,res);expect(list).toHaveBeenCalledWith(scope,{}, {readOnly});expect(res.status).not.toHaveBeenCalled();
});
