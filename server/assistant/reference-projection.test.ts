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

it('resolves ambiguous internal issue products through a nested product selector', async () => {
  const operation = operationById('inventory.stock-log.internal.issue.create')!;
  const branchId = '507f1f77bcf86cd799439024';
  const req = {
    user: { id: 'admin', companyCode: 'TEST', branchId, role: 'admin' },
    headers: {}, socket: { localAddress: '127.0.0.1', localPort: 4050 },
  } as any;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    success: true,
    data: [
      { _id: '507f1f77bcf86cd799439025', name: 'Redmi Note 14', productCode: 'REDMI-HN', status: 'active', productType: 'physical' },
      { _id: '507f1f77bcf86cd799439026', name: 'Redmi Note 14', productCode: 'REDMI-HCM', status: 'active', productType: 'physical' },
    ],
  }), { status: 200, headers: { 'content-type': 'application/json' } })));
  try {
    const resolved = await resolveReferences(req, operation, {
      customerName: 'Bộ phận kế toán',
      notes: 'Sử dụng nội bộ',
      operatorName: 'QA Admin',
      items: JSON.stringify([{ productId: 'Redmi Note 14', quantity: 1 }]),
    } as any);
    expect(resolved.unresolvedReferenceKeys).toContain('items[1].productId');
    expect(resolved.errors.join('\n')).toContain('nhiều bản ghi trùng tên');
  } finally {
    vi.unstubAllGlobals();
  }
});

async function resolveTransferItems(trackingMode: 'quantity' | 'serial', identifiers: string[] = []) {
  const operation = operationById('inventory.transfer.create')!;
  const itemsOnly = { ...operation, fields: [
    ...operation.fields.filter(field => field.key === 'items'),
    { key: 'targetBranch', label: 'Chi nhánh', type: 'text' as const, source: 'query' as const, apiKey: 'branchId' },
  ] };
  const branchId = '507f1f77bcf86cd799439024';
  const productId = '507f1f77bcf86cd799439025';
  const variantId = '507f1f77bcf86cd799439026';
  const warehouseId = '507f1f77bcf86cd799439027';
  const req = {
    user: { id: 'admin', companyCode: 'TEST', branchId, role: 'admin' },
    headers: {}, socket: { localAddress: '127.0.0.1', localPort: 4050 },
  } as any;
  const serialRequests: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/inventory/catalog/products') && !url.pathname.endsWith(`/${productId}`)) {
      return new Response(JSON.stringify({ success: true, data: [{ _id: productId, name: 'Test phone', productCode: 'PHONE-1', status: 'active', productType: 'physical' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname.endsWith(`/inventory/catalog/products/${productId}`)) {
      return new Response(JSON.stringify({ success: true, data: { _id: productId, name: 'Test phone', variants: [{ _id: variantId, sku: 'PHONE-1-128', displayName: '128 GB', trackingMode, status: 'active' }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname.endsWith('/inventory/serials')) {
      serialRequests.push(url);
      return new Response(JSON.stringify({ status: 'success', data: { items: [], total: 0, page: 1, limit: 100 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected inventory lookup: ${url.pathname}`);
  }));
  try {
    const resolved = await resolveReferences(req, itemsOnly, {
      targetBranch: branchId,
      fromWarehouseId: warehouseId,
      items: JSON.stringify([{ productId, variantId: 'PHONE-1-128', quantity: 1, ...(identifiers.length ? { unitIdentifiers: identifiers } : {}) }]),
    } as any);
    return { resolved, serialRequests };
  } finally {
    vi.unstubAllGlobals();
  }
}

it('supplies an empty identifier list for quantity tracked transfer SKUs', async () => {
  const { resolved, serialRequests } = await resolveTransferItems('quantity');
  expect(resolved.errors).toEqual([]);
  expect(JSON.parse(String(resolved.values.items))).toEqual([{ productId: '507f1f77bcf86cd799439025', variantId: '507f1f77bcf86cd799439026', quantity: 1, unitIdentifiers: [] }]);
  expect(serialRequests).toHaveLength(0);
});

it('blocks transfer confirmation when a selected serial is not in stock at the source warehouse', async () => {
  const { resolved, serialRequests } = await resolveTransferItems('serial', ['IMEI-REPAIRING']);
  expect(resolved.errors.join('\n')).toContain('không còn trong kho gửi');
  expect(serialRequests.length).toBeGreaterThan(0);
  expect(serialRequests[0].searchParams.get('status')).toBe('in_stock');
  expect(serialRequests[0].searchParams.get('warehouseId')).toBe('507f1f77bcf86cd799439027');
  expect(serialRequests[0].searchParams.get('sku')).toBe('PHONE-1-128');
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
