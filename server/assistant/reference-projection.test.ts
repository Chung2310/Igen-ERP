import { expect, it, vi } from 'vitest';
import { operationById } from './catalog';
import { callOperation, projectRecords, resolveReferences } from './executor';
import { formatFriendlyAssistantResult } from './result-format';

vi.mock('./workflows', async () => {
  const { operationById } = await import('./catalog');
  return {
    actorScope: () => ({ userId: 'approver', companyCode: 'TEST' }),
    assertOperation: async (_req: unknown, id: string) => operationById(id),
  };
});

it('preserves only a matching transfer endpoint for branch-parent selection', () => {
  const operation = operationById('inventory.transfer.list')!;
  const record = { _id:'507f1f77bcf86cd799439021', fromBranchId:'source', toBranchId:'destination', code:'CK-1', status:'in_transit' };
  for (const branch of ['source','destination','unrelated']) {
    const rows = projectRecords(operation,{data:{items:[record]}},{user:{companyCode:'TEST',branchId:branch}} as any,{targetBranch:branch});
    expect(rows[0].branchId).toBe(branch === 'unrelated' ? undefined : branch);
  }
});

it('keeps warehouse names pending until the source and destination branches are selected', async () => {
  const transfer = operationById('inventory.transfer.create')!;
  const values = { fromWarehouseId: 'Trụ sở chính', toWarehouseId: 'KHO2A' };
  const result = await resolveReferences({
    user: { id: 'admin', companyCode: 'TEST', role: 'admin' },
    headers: {}, socket: { localAddress: '127.0.0.1', localPort: 4050 },
  } as any, transfer, values as any);

  expect(result.errors.join('\n')).toContain('Chi nhánh điều chuyển');
  expect(result.values).toMatchObject(values);
});

it('preserves the Mongo reference alias privately after projecting job records', () => {
  const operation = operationById('marketing.campaign.bulk-import.jobs.list')!;
  const id = '507f1f77bcf86cd799439021';
  const records = projectRecords(operation, { data: [{ _id: id, status: 'completed', createdAt: '2026-11-01T00:00:00Z', secret: 'private-token' }] }, { user: { companyCode: 'TEST' } } as any);
  expect(records).toHaveLength(1);
  expect(records[0].id).toBe(id);
  expect(records[0]._id).toBe(id);
  expect(Object.keys(records[0])).not.toContain('_id');
  expect(JSON.stringify(records)).not.toContain('secret');
  const reply = formatFriendlyAssistantResult(operation, records);
  expect(reply).not.toContain(id);
  expect(reply).not.toContain('private-token');
});

it('keeps inventory count versions private and configures safe versions for assistant edits', () => {
  const operation = operationById('inventory.count.list')!;
  const update = operationById('inventory.count.item.update')!;
  const approve = operationById('inventory.count.approve')!;
  const id = '507f1f77bcf86cd799439022';
  const records = projectRecords(operation, { data: [{ _id:id, countCode:'KK-1', status:'counting', version:7 }] }, { user:{ companyCode:'TEST', branchId:'branch' } } as any);
  expect(update.systemBodyFields).toContain('expectedVersion');
  expect(approve.systemBodyFields).toContain('expectedVersion');
  expect(approve.fields.map(field => field.apiKey)).toEqual(expect.arrayContaining(['discrepancyConfirmed','reason','unexpectedScanResolutions']));
  expect(records[0].__assistantRefVersion).toBe(7);
  expect(Object.keys(records[0])).not.toContain('__assistantRefVersion');
  expect(JSON.stringify(records)).not.toContain('"version"');
});

const countApprovalReq:any={
  user:{id:'approver',uid:'approver',companyCode:'TEST',branchId:'507f1f77bcf86cd799439024',role:'admin'},
  headers:{},socket:{localAddress:'127.0.0.1',localPort:4050},
};
async function invokeCountApproval(count:any, extra:Record<string,unknown>={}){
  const requests:any[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:URL|string,init?:RequestInit)=>{
    const target=new URL(String(url));
    requests.push({path:target.pathname,method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):undefined});
    const data=target.pathname.endsWith('/approve')?{countCode:'KK-1',status:'completed'}:count;
    return new Response(JSON.stringify({status:'success',data}),{status:200,headers:{'content-type':'application/json'}});
  }));
  try{
    const result=await callOperation(countApprovalReq,operationById('inventory.count.approve')!,{
      path_id:'507f1f77bcf86cd799439023',targetBranch:'507f1f77bcf86cd799439024',expectedVersion:7,...extra,
    });
    return {result,requests};
  }finally{vi.unstubAllGlobals();}
}

it('sends the hidden count version when approving a balanced inventory count',async()=>{
  const {requests}=await invokeCountApproval({countCode:'KK-1',items:[],unexpectedScans:[]});
  const approval=requests.find(request=>request.path.endsWith('/approve'));
  expect(approval.body.expectedVersion).toBe(7);
  expect(approval.body).not.toHaveProperty('version');
});

it('requires an explicit discrepancy acknowledgment and reason before inventory adjustment',async()=>{
  await expect(invokeCountApproval({countCode:'KK-1',items:[{sku:'SKU-A',quantityDelta:-2}],unexpectedScans:[]}))
    .rejects.toThrow(/Xác nhận đã kiểm tra và nêu lý do/i);
  const {requests}=await invokeCountApproval({countCode:'KK-1',items:[{sku:'SKU-A',quantityDelta:-2}],unexpectedScans:[]},{discrepancyConfirmed:true,reason:'Đã kiểm tra thực tế'});
  expect(requests.find(request=>request.path.endsWith('/approve')).body).toMatchObject({expectedVersion:7,discrepancyConfirmed:true,reason:'Đã kiểm tra thực tế'});
});

it('requires a reason for every unexpected scanned code before approval',async()=>{
  const count={countCode:'KK-1',items:[],unexpectedScans:[{code:'EXTRA-01',sku:'SKU-A',serialUnitId:'private-id'}]};
  await expect(invokeCountApproval(count)).rejects.toThrow(/EXTRA-01.*SKU-A/i);
  const resolution=[{code:'EXTRA-01',reason:'Máy của khách, không nhập kho'}];
  const {requests}=await invokeCountApproval(count,{unexpectedScanResolutions:JSON.stringify(resolution)});
  const approval=requests.find(request=>request.path.endsWith('/approve'));
  expect(approval.body.unexpectedScanResolutions).toEqual(resolution);
  expect(JSON.stringify(requests)).not.toContain('private-id');
});

it('refuses approval if the count changes after its confirmation preview',async()=>{
  const id='507f1f77bcf86cd799439023';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({status:'success',data:[{
    _id:id,countCode:'KK-1',status:'pending_approval',version:8,companyCode:'TEST',branchId:countApprovalReq.user.branchId,
  }]}),{status:200,headers:{'content-type':'application/json'}})));
  try{
    const result=await resolveReferences(countApprovalReq,operationById('inventory.count.approve')!,{
      path_id:id,expectedVersion:7,__assistantPinnedVersion:true,
    } as any);
    expect(result.errors.join('\n')).toContain('đã thay đổi sau khi bạn xem bản xác nhận');
  }finally{vi.unstubAllGlobals();}
});
