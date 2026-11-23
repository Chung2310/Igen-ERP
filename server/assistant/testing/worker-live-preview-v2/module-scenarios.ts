import { ASSISTANT_OPERATIONS } from '../../catalog';
import { parseAssistantResultTable } from '../../../../src/shared/assistant-result-table';
const id = (n:number)=>n.toString(16).padStart(24,'0');
const action=(method:string,path:string)=>{
  const op=ASSISTANT_OPERATIONS.find(op=>op.method===method&&op.path===path&&!op.unavailableReason);
  if(!op) throw new Error(`Missing reviewed module fixture operation: ${method} ${path}`);
  return op.id;
};
const read=(id:string,text:string,actionId:string,visible:string[],values:Record<string,unknown>={})=>({id,text,actions:[actionId],kind:'read',row:null,visible,scriptValues:values});
const write=(id:string,text:string,actionId:string,values:Record<string,unknown>,extra={})=>({id,text,actions:[actionId],kind:'write',row:null,scriptValues:values,expected:values,...extra});
export const moduleCustomer={_id:id(2101),id:id(2101),version:1,customerCode:'KH-QA-2101',name:'KHACH-HANG-QA-01',phone:'0900000211',email:'khqa@example.test',address:'Địa chỉ QA cũ',status:'active',branchId:'64b000000000000000000001',companyCode:'QA'};
const category={_id:id(2102),id:id(2102),code:'DM-QA-01',name:'DANH-MUC-QA-01',description:'Danh mục giả kiểm thử',companyCode:'QA'};
export const MODULE_PRIVATE_IDS=[moduleCustomer.id,category.id,...Array.from({length:20},(_,i)=>id(2200+i)),...Array.from({length:12},(_,i)=>id(2600+i))];
export const MODULE_CASES=[
  write('N01','Trong Kho, tạo danh mục tên DANH-MUC-QA-MOI, mã DM-QA-MOI','category.create',{name:'DANH-MUC-QA-MOI',code:'DM-QA-MOI'}),
  read('N02','Trong Kho, xem danh sách sản phẩm','product.list',['SAN-PHAM-QA-01']),
  write('N03','Trong Khách hàng, tạo khách hàng KHACH-HANG-QA-MOI, số điện thoại 0900000212','customer.create',{name:'KHACH-HANG-QA-MOI',phone:'0900000212'}),
  write('N04','Trong Khách hàng, sửa địa chỉ KHACH-HANG-QA-01 thành 25 Đường Kiểm Thử','customer.update',{path_id:moduleCustomer.id,address:'25 Đường Kiểm Thử'},{scriptValues:{path_id:moduleCustomer.name,address:'25 Đường Kiểm Thử'},referenceTarget:moduleCustomer.name}),
  write('N05','Trong Quản lý tài nguyên, tạo thư mục TAI-LIEU-QA-MOI',action('POST','/resources/folder'),{name:'TAI-LIEU-QA-MOI'}),
  read('N06','Trong Trò chuyện, xem danh sách phòng chat','chat.rooms.list',['PHONG-CHAT-QA-01']),
  write('N07','Trong Đối tác tuyển sinh, thêm cộng tác viên DOI-TAC-TUYEN-SINH-QA, số điện thoại 0900000213',action('POST','/partners'),{name:'DOI-TAC-TUYEN-SINH-QA',phone:'0900000213'}),
  read('N08','Trong Bán lẻ, xem ca POS hiện tại','retail.shift.current',['CA-QA-01','THU-NGAN-QA']),
  read('N09','Trong Đối tác bán lẻ, xem các chính sách hoa hồng hiện có','retail.partner.commission.policy.list',['DOI-TAC-BAN-LE-QA']),
  read('N10','Trong Sửa chữa, xem danh sách phiếu sửa chữa','repair.list',['SC-QA-01','KHACH-HANG-QA-01']),
  read('N11','Trong Tài chính, xem các quỹ tiền mặt và tài khoản ngân hàng','finance.treasury.accounts.list',['QUY-TIEN-MAT-QA']),
  read('N12','Trong Marketing tự động, xem danh sách chiến dịch email lễ tết','marketing.holiday-campaign.list',['EMAIL-LE-TET-QA']),
  read('N13','Trong Chiến dịch nội dung, xem danh sách chiến dịch marketing','marketing.campaign.list',['CHIEN-DICH-NOI-DUNG-QA']),
  write('N14','Trong Hộp thư đa kênh, tạo khách tiềm năng LEAD-QA-MOI, email leadqa@example.test','omni-inbox.leads.create',{customerName:'LEAD-QA-MOI',email:'leadqa@example.test'}),
  read('N15','Trong Kho tri thức công ty, xem danh sách tài liệu','company-knowledge.documents.list',['TAI-LIEU-TRI-THUC-QA']),
  read('N16','Trong Tra cứu pháp lý, xem tình trạng kho văn bản','legal.repository.status',['12','36']),
  write('N17','Trong Báo giá, thêm sản phẩm vào bảng giá: mã BG-QA-01, tên DICH-VU-QA, đơn vị gói, giá 250000','quotation.catalog.create',{sku:'BG-QA-01',name:'DICH-VU-QA',unit:'gói',price:250000}),
  write('N18','Trong Y tế, tạo bệnh nhân BENH-NHAN-QA-MOI','healthcare.patient.create',{name:'BENH-NHAN-QA-MOI'}),
  write('N19','Trong Trợ lý kiến trúc, tạo dự án KIENTRUC-QA-MOI, diện tích 150 m2, 2 tầng, phong cách hiện đại','architect.project.create',{name:'KIENTRUC-QA-MOI',areaM2:150,floors:2,style:'hiện đại'}),
  write('N20','Trong Kho, xóa danh mục DANH-MUC-QA-01','category.delete',{id:category.id},{scriptValues:{id:category.name},referenceTarget:category.name}),
  {...read('N21','học viên nào còn nợ học phí?','student.list',['HOC-VIEN-NO-QA-A','HOC-VIEN-NO-QA-C','HOC-VIEN-NO-QA-E']),actions:['student.list','student.payment.list'],validationFollowup:'vậy là tất cả học viên đều đã đóng học phí rồi hả'},
];
export function moduleScript(item:any) {
  if(item.id==='N21') return {actionId:null,intentType:'workflow',actionIntent:'report',values:{},queryPlan:[
    {actionId:'student.list',purpose:'Học phí học viên',values:{},resultFields:['fullName','fee','paidAmount'],relation:'students-with-tuition-debt'},
    {actionId:'student.payment.list',purpose:'Các phiếu thu',values:{},resultFields:['amount']},
  ],requestCoverage:[{evidence:item.validationFollowupActive?item.validationFollowup:item.text,requirement:'Đối chiếu dư nợ thực tế',mappedTo:['query:student.list:relation']}]};
  return {actionId:item.actions[0],intentType:'workflow',values:item.scriptValues||{}};
}
export function moduleFixture(url:URL) {
  const path=url.pathname.replace(/^\/api\/v1/,'');
  const debtStudents=[
    {_id:id(2600),fullName:'HOC-VIEN-NO-QA-A',fee:'5.000.000',paidAmount:5000000,status:['Đang học']},
    {_id:id(2601),fullName:'HOC-VIEN-NO-QA-B',fee:'5.000.000',paidAmount:5000000,status:['Đang học']},
    {_id:id(2602),fullName:'HOC-VIEN-NO-QA-C',fee:'3.000.000',paidAmount:1000000,status:['Đã nộp HS']},
    {_id:id(2603),fullName:'HOC-VIEN-NO-QA-D',fee:'0',paidAmount:0,status:['Đang học'],tuitionWaived:true},
    {_id:id(2604),fullName:'HOC-VIEN-NO-QA-E',fee:'3.000.000',paidAmount:0,status:['Đang học']},
  ];
  const payments=[{_id:id(2605),studentId:id(2600),amount:2000000},{_id:id(2606),studentId:id(2600),amount:1000000},{_id:id(2607),studentId:id(2601),amount:5000000}];
  if(path==='/students'||path==='/payments') {
    const rows=path==='/students'?(url.searchParams.get('status')?[]:debtStudents):payments;
    const page=Number(url.searchParams.get('page')||1),limit=2;
    return {success:true,[path==='/students'?'students':'payments']:rows.slice((page-1)*limit,page*limit),total:rows.length,page,limit,totalPages:Math.ceil(rows.length/limit)};
  }
  if(path==='/crud/categories') return {status:'success',data:[category],total:1};
  if(path===`/crud/categories/${category.id}`) return {status:'success',data:category};
  if(path==='/inventory/catalog/products') return {success:true,data:{items:[{_id:id(2200),id:id(2200),productCode:'SP-QA-01',name:'SAN-PHAM-QA-01',productType:'physical',status:'active',variants:[{_id:id(2201),sku:'SKU-QA-01',name:'Mẫu QA',status:'active'}]}],total:1,page:1,limit:100}};
  if(path==='/customers') return {success:true,data:{items:[moduleCustomer],total:1,page:1,limit:100}};
  if(path===`/customers/${moduleCustomer.id}`) return {success:true,data:moduleCustomer};
  if(path==='/resources') return {success:true,data:[{_id:id(2202),id:id(2202),name:'THU-MUC-QA',type:'folder',section:'shared'}]};
  if(path==='/chat/rooms') return {status:'success',data:[{_id:id(2203),id:id(2203),name:'PHONG-CHAT-QA-01',isGroup:true,updatedAt:'2026-11-23T02:00:00.000Z'}]};
  if(path==='/partners/commission-levels') return {success:true,data:[]};
  if(path==='/partners') return {success:true,data:[],total:0};
  if(path==='/retail/shifts/current') return {success:true,data:{_id:id(2204),shiftCode:'CA-QA-01',cashierName:'THU-NGAN-QA',status:'open',businessDate:'2026-11-23',openingFloat:500000,grossSales:1200000,expectedCash:1700000}};
  if(path==='/retail/partners/commission-policies') return {success:true,data:{items:[{_id:id(2205),id:id(2205),partnerName:'DOI-TAC-BAN-LE-QA',effectiveAt:'2026-11-01T00:00:00.000Z',config:{phoneAmount:250000,accessoryBps:1000,repairBps:1100}}],legacy:[]}};
  if(path==='/repair/tickets') return {success:true,data:{items:[{_id:id(2206),id:id(2206),ticketCode:'SC-QA-01',customerName:moduleCustomer.name,status:'received',paymentStatus:'unpaid',totalAmount:300000,paidAmount:0,dueAmount:300000}],total:1,page:1,limit:100}};
  if(path==='/finance/reporting/treasury') return {success:true,data:{accounts:[{_id:id(2207),id:id(2207),name:'QUY-TIEN-MAT-QA',kind:'cash',openingOn:'2026-11-01',openingBalance:1000000,balance:1500000}],vouchers:[],bankLines:[],periods:[]}};
  if(path==='/marketing/campaigns') return {success:true,data:[{_id:id(2208),name:'EMAIL-LE-TET-QA',runDate:'2026-12-01',channels:['email'],subject:'CHUC-MUNG-QA',enabled:false}]};
  if(path==='/marketing-campaigns/assistant/summaries') return {items:[{_id:id(2209),id:id(2209),title:'CHIEN-DICH-NOI-DUNG-QA',campaignType:'content',status:'draft',startDate:'2026-11-01',endDate:'2026-11-30',postsPerDay:1}],total:1,page:1,limit:10};
  if(path==='/omni-inbox/leads') return {leads:[],total:0};
  if(path==='/company-knowledge/documents') return {items:[{_id:id(2210),title:'TAI-LIEU-TRI-THUC-QA',sourceType:'manual',status:'ready',documentType:'faq',chunksCount:3}],total:1};
  if(path==='/legal-reference/health') return {documents:12,chunks:36,pendingReviews:0,latestDownloadAt:'2026-11-22T02:00:00.000Z',syncConfigured:false};
  if(path==='/quotation/catalog') return {items:[],total:0};
  if(path==='/healthcare/catalog') return [];
}
export function moduleChecks(item:any,row:any,reply:any,pending:any):string[] {
  if(!item.id.startsWith('N')) return [];
  const issues:string[]=[];
  if(item.kind==='read') {
    if(!parseAssistantResultTable(reply.reply)) issues.push('STRUCTURED_RESULT_TABLE_MISSING');
    for(const text of item.visible||[]) if(!reply.reply.includes(text)) issues.push('EXPECTED_PUBLIC_VALUE_MISSING:'+text);
    const op=ASSISTANT_OPERATIONS.find(op=>op.id===item.actions[0])!;
    if(!row.readCalls.some((call:any)=>call.path.replace(/^\/api\/v1/,'')===op.path)) issues.push('EXPECTED_READ_ENDPOINT_NOT_REACHED');
  }
  if(item.kind==='write' && reply.status==='confirmation' && !pending) issues.push('NO_PRIVATE_PENDING');
  if(item.id==='N21') {
    if(['HOC-VIEN-NO-QA-B','HOC-VIEN-NO-QA-D'].some(name=>reply.reply.includes(name))) issues.push('PAID_OR_FREE_STUDENT_INCLUDED');
    if(!reply.reply.includes('7.000.000') && !['2.000.000','3.000.000'].every(amount=>reply.reply.includes(amount))) issues.push('DEBT_AMOUNTS_WRONG');
    if(!row.turns.some((turn:any)=>turn.supplied?.validationFollowup && turn.reply.includes('Chưa phải tất cả'))) issues.push('FALSE_ALL_PAID_FOLLOWUP_NOT_CORRECTED');
    if(!row.readCalls.some((call:any)=>call.path.endsWith('/students')&&call.query.page==='3') || !row.readCalls.some((call:any)=>call.path.endsWith('/payments')&&call.query.page==='2')) issues.push('DEBT_SOURCES_NOT_FULLY_PAGED');
  }
  if(MODULE_PRIVATE_IDS.some(key=>JSON.stringify({reply:reply.reply,preview:reply.action?.values}).includes(key))) issues.push('PRIVATE_MODULE_ID_VISIBLE');
  return issues;
}
