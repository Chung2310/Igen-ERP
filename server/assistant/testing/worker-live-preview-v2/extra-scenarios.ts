import { ASSISTANT_OPERATIONS } from '../../catalog';
import { parseAssistantResultTable } from '../../../../src/shared/assistant-result-table';
const action = (method: string, path: string) => ASSISTANT_OPERATIONS.find(op => op.method === method && op.path === path)!.id;
const id = (n: number) => n.toString(16).padStart(24, '0');
export const extraStudent = { _id: id(1101), id: id(1101), fullName: 'HOC-VIEN-QA-THU-PHI', phone: '0900000091', email: 'qa91@example.test', fee: 10000000, paidAmount: 2000000, registrationDate: '2026-11-01', status: 'Đang học' };
export const extraPolicy = { _id: id(1102), id: id(1102), name: 'CHINH-SACH-QA-HIEN-HANH', effectiveFrom: '2026-11-01', version: 1, status: 'active', settlementCycle: { type: 'calendar_month', cutoffDay: null }, official: { enabled: true, maxMonths: 3, milestones: [1,2,3].map(month => ({ month, amount: month * 100000, eligibilityRule: 'contract_active' })) }, seasonal: { enabled: false, tiers: [] } };
const kpi = action('GET', '/worker-management/partners/kpi');
const createPolicy = action('POST', '/worker-management/partners/policies');
const updatePolicy = action('PATCH', '/worker-management/partners/policies/:policyId');
const read = (id: string, text: string, actions: string[], extra = {}) => ({ id, text, actions, kind: 'read', row: null, ...extra });
export const EXTRA_CASES = [
  read('X01', 'báo cáo tiến độ QA-KY-NANG-SO', ['hr.training.progress'], { clarificationText:'Đó là khóa đào tạo nội bộ QA-KY-NANG-SO trong phân hệ Nhân sự. Báo cáo tiến độ khóa này.' }),
  read('X02', 'Khóa học QA-TIENG-ANH hôm nay đi đủ không', ['student.batch.attendance.summary'], { referenceTarget: 'QA-TIENG-ANH' }),
  read('X03', 'Lịch học của khóa QA-KY-NANG-SO', ['student.batch.detail', 'student.schedule.list'], { referenceTarget: 'QA-KY-NANG-SO' }),
  { id:'X04', text: `Học viên ${extraStudent.fullName} đã nộp thêm 3 triệu học phí`, actions:['student.payment.create'], kind:'write', row:null, referenceTarget:extraStudent.fullName, fill: { method:'Tiền mặt', date:'2026-11-23' }, expected:{amount:3000000, studentId:extraStudent.id} },
  { id:'X05', text:'TRONG QUẢN LÝ LAO ĐỘNG, chỉnh sửa chính sách phần Số mốc tháng thành 2 tháng', actions:[updatePolicy], kind:'write', row:null, referenceTarget:extraPolicy.name },
  { id:'X06', text:'Thêm 1 chính sách hoa hồng mới - CHINH-SACH-QA-CUOI-NAM, áp dụng từ 1/12/2026', actions:[createPolicy], kind:'write', row:null,
    followup:'Áp dụng lao động chính thức 1 tháng, hoa hồng 300000 khi hợp đồng còn hiệu lực, đối soát tháng dương lịch. Không áp dụng thời vụ.', expected:{name:'CHINH-SACH-QA-CUOI-NAM',effectiveFrom:'2026-12-01'} },
  read('X07', 'Trong quản lí lao động, đối tác nào giới thiệu được nhiều lao động nhất trong tháng', [kpi]),
  read('X08', 'Trong quản lí lao động, đối tác nào đang thiếu KPI tháng', [kpi]),
  read('X09', 'Trong quản lí lao động, các đối tác nào đã đạt đủ KPI', [kpi]),
];
export function extraScript(item: any, followed: boolean, today: string) {
  const values: Record<string, any> = {
    X01:{courseName:'QA-KY-NANG-SO'}, X02:{path_id:'QA-TIENG-ANH',date:today}, X03:{path_id:'QA-KY-NANG-SO'},
    X04:{studentId:extraStudent.fullName,amount:3000000}, X05:{official:{maxMonths:2}},
    X06:followed ? {settlementCycle:{type:'calendar_month'},official:{enabled:true,maxMonths:1,milestones:[{month:1,amount:300000,eligibilityRule:'contract_active'}]},seasonal:{enabled:false,tiers:[]}} : {name:'CHINH-SACH-QA-CUOI-NAM',effectiveFrom:'2026-12-01'},
    X07:{query_periodAnchor:today.slice(0,7)+'-01',analysis:{extreme:{field:'actualReferrals',direction:'max'}}},
    X08:{query_periodAnchor:today.slice(0,7)+'-01',analysis:{filters:[{field:'status',operator:'eq',value:'incomplete'}]}},
    X09:{query_periodAnchor:today.slice(0,7)+'-01',analysis:{filters:[{field:'status',operator:'eq',value:'achieved'}]}},
  };
  return {actionId:item.actions[0],values:values[item.id],intentType:'workflow'};
}
export function extraFixture(url: URL, today: string) {
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const batch = (name: string, n: number) => ({_id:id(n),id:id(n),name,code:name,courseTitle:name,courseId:id(n+100),status:'Đang học',startDate:'2026-11-01',endDate:'2026-12-31',daysOfWeek:[0,1,2,3,4,5,6],startTime:'19:00',endTime:'21:00',location:'PHONG-QA-01',learnerIds:[1,2,3,4].map(n=>id(n+1200)),attendanceSessions:[{date:today,records:[{studentId:id(1201),status:'present'},{studentId:id(1202),status:'late'},{studentId:id(1203),status:'absent'}]}]});
  const batches = [batch('QA-TIENG-ANH',1110),batch('QA-KY-NANG-SO',1111)];
  if(path==='/students') return {students:[extraStudent],total:1,page:1,limit:100};
  if(path===`/students/${extraStudent.id}`) return {student:extraStudent};
  if(path==='/batches') return {success:true,data:batches,total:2,page:1,limit:100};
  if(batches.some(b=>path===`/batches/${b.id}`)) return {success:true,data:batches.find(b=>path===`/batches/${b.id}`)};
  if(path==='/courses') return {success:true,data:batches.map(b=>({_id:b.courseId,id:b.courseId,code:b.code,name:b.name,title:b.name})),total:2};
  if(path==='/schedule') return {success:true,data:batches.map((b,i)=>({id:id(1400+i),title:b.name,type:'class',date:today,time:'19:00 - 21:00',details:b.location}))};
  if(path==='/crud/training-courses') return {status:'success',data:[{_id:id(1403),title:'QA-KY-NANG-SO',category:'Kỹ năng',duration:'2 giờ'}],total:1};
  if(path==='/crud/training-enrollments') return {status:'success',data:[0,50,100].map((progress,i)=>({_id:id(1500+i),userName:`NHAN-SU-QA-${i+1}`,courseTitle:'QA-KY-NANG-SO',progress,status:progress===100?'completed':progress?'in_progress':'not_started'})).concat([{_id:id(1504),userName:'NHAN-SU-QA-KHAC',courseTitle:'QA-KHOA-KHAC',progress:100,status:'completed'}]),total:4};
  if(path==='/worker-management/partners/policies') return {success:true,data:[extraPolicy]};
  if(path===`/worker-management/partners/policies/${extraPolicy.id}`) return {success:true,data:extraPolicy};
  if(path==='/worker-management/partners/kpi') return {success:true,data:{periodStart:today.slice(0,7)+'-01T00:00:00.000Z',periodEnd:'2026-12-01T00:00:00.000Z',items:[
    {partner:{name:'DOI-TAC-QA-A',code:'QA-A'},actualReferrals:10,targetReferrals:5,remainingReferrals:0,completionRate:200,status:'achieved'},
    {partner:{name:'DOI-TAC-QA-B',code:'QA-B'},actualReferrals:10,targetReferrals:10,remainingReferrals:0,completionRate:100,status:'achieved'},
    {partner:{name:'DOI-TAC-QA-C',code:'QA-C'},actualReferrals:3,targetReferrals:5,remainingReferrals:2,completionRate:60,status:'incomplete'},
    {partner:{name:'DOI-TAC-QA-D',code:'QA-D'},actualReferrals:0,targetReferrals:0,remainingReferrals:null,completionRate:null,status:'not_set'},
  ]}};
}
export function extraChecks(item: any, row: any, reply: any, pending: any, today: string): string[] {
  if(!item.id.startsWith('X')) return [];
  const issues:string[]=[];
  const table = parseAssistantResultTable(reply.reply), rendered=JSON.stringify(table?.rows || []);
  const value=(key:string)=>{const v=pending?.resolved?.[key];return typeof v==='string'&&v.startsWith('{')?JSON.parse(v):v;};
  if(item.id==='X01' && (![1,2,3].every(n=>rendered.includes(`NHAN-SU-QA-${n}`)) || rendered.includes('NHAN-SU-QA-KHAC') || ![0,50,100].every(n=>reply.reply.includes(`Tiến độ: ${n}`)))) issues.push('TRAINING_PROGRESS_SCOPE_OR_COMPLETED_MISSING');
  if(item.id==='X02' && (!row.readCalls.some((c:any)=>c.path.endsWith('/batches/'+id(1110))) || !reply.reply.includes('QA-TIENG-ANH') || !reply.reply.includes('chưa ghi nhận không đồng nghĩa vắng') || !['Tổng học viên: 4','Có mặt: 1','Đi muộn: 1','Vắng: 1','Chưa ghi nhận: 1'].every(value=>reply.reply.includes(value)))) issues.push('ATTENDANCE_COUNTS_OR_CLASS_NOT_PROVEN');
  if(item.id==='X03' && (!reply.reply.includes('QA-KY-NANG-SO') || !reply.reply.includes('19:00') || reply.reply.includes('QA-TIENG-ANH'))) issues.push('SCHEDULE_SCOPE_OR_TIMES_MISSING');
  if(item.id==='X05' && (value('official')?.maxMonths!==2 || pending?.resolved?.path_policyId!==extraPolicy.id || value('official')?.milestones?.length!==2 || value('official')?.milestones?.[0]?.amount!==100000)) issues.push('NESTED_POLICY_EDIT_NOT_PRESERVED');
  if(item.id==='X04' && !row.turns.some((t:any)=>t.status==='collecting' && t.referenceSelections?.some((s:any)=>s.key==='method'))) issues.push('PAYMENT_METHOD_NOT_ASKED');
  if(item.id==='X06' && (row.firstStatus!=='collecting' || value('official')?.milestones?.[0]?.amount!==300000)) issues.push('POLICY_REQUIRED_RULES_NOT_COLLECTED');
  if(['X07','X08','X09'].includes(item.id)) {
    const expected=item.id==='X08'?['DOI-TAC-QA-C']:['DOI-TAC-QA-A','DOI-TAC-QA-B'];
    const actual=['A','B','C','D'].map(n=>'DOI-TAC-QA-'+n).filter(name=>rendered.includes(name));
    if(JSON.stringify(expected)!==JSON.stringify(actual)) issues.push('KPI_FILTER_OR_TIES_WRONG');
    if(!row.readCalls.some((c:any)=>c.path.endsWith('/partners/kpi')&& /^\d{4}-\d{2}-\d{2}$/.test(c.query.periodAnchor || '') && c.query.periodAnchor.slice(0,7)===today.slice(0,7))) issues.push('KPI_MONTH_NOT_APPLIED');
  }
  if(item.kind==='read'&&!table) issues.push('STRUCTURED_TABLE_MISSING');
  return issues;
}
