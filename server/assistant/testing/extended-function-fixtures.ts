// Synthetic reference records for offline assistant integration tests only.
export function extendedFunctionFixture(op: any, url: URL, row: any, envelope: any) {
  const p=url.pathname, id=row.id, branchId=row.branchId;
  const variant={id,_id:id,sku:'QA-SKU',name:'QA',status:'active',price:1000,unitCost:1000,trackingMode:'quantity',productId:id};
  Object.assign(row,{productId:id,variantId:id,sku:'QA-SKU',productCode:'QA',workerId:id,workerName:'QA',partnerId:id,partnerName:'QA',employeeName:'QA',amount:1000,quantity:1,version:1,sourceType:'manual',occurredOn:'2026-11-01',date:'2026-11-01'});
  if(p.includes('/inventory/')) {
    row.variants=[variant];envelope.product=row;
    envelope.products=[row];
    if(p.includes('/catalog/products')) {row.status='active';row.productType='physical';}
    if(p.includes('/serial')) row.status='in_stock';
    if(p.includes('/counts/')) row.items=[{...variant,productName:'QA',systemQty:10,countedQty:10}];
  }
  if(p.includes('/stock-logs')) Object.assign(row,{type:'xuất',status:'Hoàn thành',purpose:'nội bộ'});
  if(p.endsWith('/resources')) Object.assign(row,{type:'file',mimeType:'image/png'});
  if(p.includes('/worker-management/')) {
    envelope.workers=[row];
    row.workerIds=[id];
    if(p.includes('/workers')) row.status='active';
    if(p.includes('/referrals')) row.status='pending';
    if(p.includes('/payouts')) Object.assign(row,{status:'paid',paidAt:'2026-11-01T00:00:00Z',method:'cash'});
    if(p.includes('/settlements/')) row.payouts=[{_id:id,amount:1000,method:'cash',paidAt:'2026-11-01T00:00:00Z'}];
    if(p.includes('/kpi')) envelope.data={items:[{partner:{name:'QA',code:'QA'},status:'achieved',targetReferrals:1,actualReferrals:1,remainingReferrals:0,completionRate:100}],total:1};
    if(p.includes('/standard-fields')) envelope.data=[{...row,key:'fullName',label:'Họ tên',isRequired:true,isVisible:true,isArchived:false}];
  }
  if(p.includes('/retail/')) {
    if(p.includes('/shifts')) Object.assign(row,{status:'open',cashierId:'507f1f77bcf86cd799439011',terminalId:'fixture-pos',shiftCode:'QA-SHIFT'});
    if(p.includes('/partners')) Object.assign(row,{role:'collaborator',roles:['collaborator'],isActive:true});
    if(p.includes('/pos-sessions/current') || p.includes('/shifts/current')) envelope.data={...row,status:'open',cashierId:'507f1f77bcf86cd799439011',terminalId:op.id==='retail.shift.resume'?'old-device':'fixture-pos',shiftCode:'QA-SHIFT'};
    if(p.endsWith('/quote')) envelope.data={...row,grandTotal:0,items:[variant]};
    if(p.includes('/orders/') && !p.endsWith('/quote')) Object.assign(row,{orderCode:'QA-ORDER',status:'draft',items:[{...variant,quantity:1}],paidTotal:0,grandTotal:0,customerId:id,dueDate:'2026-12-01'});
    if(op.id==='retail.after-sale.create' && p.includes('/orders')) Object.assign(row,{status:'completed',paymentStatus:'paid',paidTotal:1000,grandTotal:1000,subtotal:1000,items:[{...variant,quantity:1,unitPrice:1000,lineTotal:1000}]});
    if(p.includes('/debt-reminders/runs') || p.includes('/after-sale')) {envelope.data={items:[row],total:1}; if(p.endsWith(id)) envelope.data=row;}
    if(p.includes('/points/policy')) envelope.data={...row,version:1};
    if(p.includes('/invoices')) row.status='issued';
    if(p.includes('/finance/commission')) envelope.data={items:[row],levels:[],total:1};
  }
  if(p.includes('/finance/')) {
    if(p.includes('/breakeven')) envelope.data={plan:{version:1,revenue:1000,cost:100}};
    if(p.endsWith('/treasury')) {row.kind='bank';envelope.data={accounts:[row],vouchers:[row],bankLines:[row],periods:[{...row,month:'2026-11',status:'open'}],version:1};}
    if(p.includes('/receivables/')) envelope.data={receivable:{...row,status:'open',balance:1000},entries:[{...row,type:'payment'}]};
    if(p.includes('/management/debts')) envelope.data={receivables:[{...row,receivableCode:'QA',customerName:'QA',originalAmount:1000,balance:1000}],payables:[],unregisteredReceipts:[{...row,receiptCode:'QA',supplierName:'QA',subtotal:1000}]};
  }
  if(op.analysis && ['partner.analysis','api.get.78da159ec226e07e'].includes(op.id)) {
    for(const [key,field] of Object.entries(op.analysis.fields) as [string,any][]) row[key]=field.type==='number'?1:'QA';
    if(op.id==='partner.analysis') envelope.partners=[row];else envelope.data=[row];
  }
  return envelope;
}
