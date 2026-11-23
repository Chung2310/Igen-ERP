import type { AssistantWorkflow, AssistantValue } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import type { AssistantCompositeQuery } from "./composite-query";
import { AssistantError } from "./policy";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";

interface RelationSource { actionId: string; array: string; identity: string; pagination: "all" | "total"; }
export interface ReadRelationDefinition {
  kind?: 'absence' | 'tuition-balance';
  id: string; title: string; left: RelationSource; right: RelationSource;
  foreignKey: string; conditionAliases: string[]; entityAliases: string[];
  columns: Record<string, string>;
}
// Reviewed reference bindings, kept server-side. New modules register bindings
// here; models never choose join keys, ID fields, or arbitrary expressions.
export const READ_RELATIONS: ReadRelationDefinition[] = [{
  id: "workers-without-contracts", title: "Danh sách lao động chưa có hợp đồng",
  left: { actionId: "worker.list", array: "workers", identity: "_id", pagination: "all" },
  right: { actionId: "worker.labor.contract.list", array: "data", identity: "_id", pagination: "total" },
  foreignKey: "workerId", conditionAliases: ["chưa có hợp đồng", "không có hợp đồng"],
  entityAliases: ["quản lý lao động", "quản lí lao động", "người lao động", "lao động"], columns: { fullName: "Họ và tên", status: "Trạng thái", laborType: "Loại lao động" },
}, {
  id:'students-with-tuition-debt',kind:'tuition-balance',title:'Học viên còn nợ học phí',
  left:{actionId:'student.list',array:'students',identity:'_id',pagination:'total'},
  right:{actionId:'student.payment.list',array:'payments',identity:'_id',pagination:'total'},
  foreignKey:'studentId', conditionAliases:['còn nợ học phí','nợ học phí','chưa đóng đủ học phí','đều đã đóng học phí','tất cả đã đóng học phí','đóng hết học phí'],
  entityAliases:['quản lý học viên','quản lí học viên','học viên'],columns:{fullName:'Học viên',fee:'Tổng học phí',paidAmount:'Đã đóng'},
}];
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const availableReadRelations = (workflows: AssistantWorkflow[]) => READ_RELATIONS
  .filter(relation => [relation.left.actionId, relation.right.actionId].every(id => workflows.some(workflow => workflow.enabled && workflow.actionId === id)))
  .map(relation => ({ id: relation.id, title: relation.title, leftActionId: relation.left.actionId, rightActionId: relation.right.actionId }));
export const requestedReadRelations = (text:string) => READ_RELATIONS.filter(relation=>relationEvidenceSupported(text,relation.id));
export function normalizeReadRelationAnnotations(queries:any[]) {
  if(queries.length!==2 || queries.some(query=>!query || typeof query!=='object' || Array.isArray(query))) return queries;
  const ids=[...new Set(queries.map(query=>query.relation).filter(Boolean))];
  const relation=ids.length===1 && READ_RELATIONS.find(item=>item.id===ids[0]);
  if(!relation || ![relation.left.actionId,relation.right.actionId].every(id=>queries.some(query=>query.actionId===id))) return queries;
  return queries.map(query=>({...query,relation:query.actionId===relation.left.actionId?relation.id:undefined}));
}
export function selectedRelationForQuery(queries:AssistantCompositeQuery[],actionId:string) {
  return READ_RELATIONS.find(relation=>queries.some(query=>query.relation===relation.id) && [relation.left.actionId,relation.right.actionId].includes(actionId));
}

export function validateReadRelations(queries: AssistantCompositeQuery[], workflows: AssistantWorkflow[]) {
  if (queries.some(query => query.relation) && (queries.length !== 2 || queries.filter(query => query.relation).length !== 1)) return false;
  for (const query of queries) {
    if (!query.relation) continue;
    const relation = READ_RELATIONS.find(item => item.id === query.relation);
    if (!relation || relation.left.actionId !== query.actionId || !availableReadRelations(workflows).some(item => item.id === relation.id)
      || !queries.some(item => item.actionId === relation.right.actionId)) return false;
    const scopes: string[] = [];
    for (const source of [relation.left, relation.right]) {
      const values = queries.find(item => item.actionId === source.actionId)!.values;
      const workflow = workflows.find(item => item.actionId === source.actionId)!;
      const scope: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        const field = workflow.fields.find(item => item.key === key);
        const apiKey = field?.apiKey || key;
        // Absence requires the complete, same-scope sources, not filtered pages.
        if (!['branchId', 'companyCode'].includes(apiKey)) return false;
        scope[apiKey] = value;
      }
      scopes.push(JSON.stringify(Object.fromEntries(Object.entries(scope).sort())));
    }
    if (scopes[0] !== scopes[1]) return false;
  }
  return true;
}

/** Only the declared absence predicate is justified by this operator. Extra
 * periods, statuses or thresholds cannot hide inside a relational mapping. */
export function relationEvidenceSupported(evidence: string, id: string) {
  const relation = READ_RELATIONS.find(item => item.id === id);
  if (!relation) return false;
  let phrase = ` ${normalize(evidence)} `;
  const condition = relation.conditionAliases.map(normalize).find(alias => phrase.includes(` ${alias} `));
  if (!condition) return false;
  if (phrase.includes(` khong ${condition} `)) return false;
  phrase = phrase.replace(` ${condition} `, ' ');
  for (const alias of relation.entityAliases.map(normalize)) phrase = phrase.replaceAll(alias, ' ');
  const allowed = new Set('bao cao tong hop danh sach liet ke tim tra cuu xem cac nhung nguoi trong phan he module quan ly li nao ai vay la tat ca roi a ha co khong'.split(' '));
  return phrase.trim().split(/\s+/).filter(Boolean).every(word => allowed.has(word));
}

function identifier(value: unknown): string {
  if (value && typeof value === 'object') return identifier((value as any)._id ?? (value as any).id);
  if (typeof value !== 'string' || !value.trim() || value.length > 128) throw new AssistantError('Nguồn đối chiếu thiếu khóa định danh; chưa thể kết luận bản ghi không tồn tại.', 502);
  return /^[a-f\d]{24}$/i.test(value) ? value.toLowerCase() : value;
}
export function relationSourceFor(queries: AssistantCompositeQuery[], actionId: string) {
  return queries.flatMap(query => query.relation ? READ_RELATIONS.filter(item => item.id === query.relation).flatMap(item => [item.left, item.right]) : [])
    .find(source => source.actionId === actionId);
}

export async function collectRelationRows(source: RelationSource, operation: AssistantOperation, initial: any,
  values: Record<string, AssistantValue>, nextPage: (values: Record<string, AssistantValue>) => Promise<any>) {
  const rows: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  let response = initial;
  let expectedTotal: number | undefined;
  for (let index = 1; index <= 24; index++) {
    const batch = response?.[source.array];
    if (!Array.isArray(batch) || batch.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new AssistantError('Nguồn đối chiếu trả dữ liệu không đúng cấu trúc.', 502);
    for (const row of batch) {
      const key = identifier(row[source.identity] ?? row.id);
      if (ids.has(key)) throw new AssistantError('Dữ liệu thay đổi hoặc trùng giữa các trang; chưa thể kết luận thiếu bản ghi.', 409);
      ids.add(key); rows.push(row);
    }
    if (rows.length > 500) throw new AssistantError('Nguồn đối chiếu vượt 500 bản ghi. Bạn thu hẹp phạm vi để mình đối chiếu đầy đủ nhé.', 413);
    if (source.pagination === 'all') {
      if (response.total !== undefined && response.total !== rows.length || response.page !== undefined || response.limit !== undefined) throw new AssistantError('Chưa xác nhận được dữ liệu đối chiếu đã đầy đủ.', 502);
      return rows;
    }
    const { total, page, limit } = response;
    if (!Number.isSafeInteger(total) || total < 0 || total > 500 || !Number.isSafeInteger(page) || page !== index
      || !Number.isSafeInteger(limit) || limit < 1 || rows.length > total || expectedTotal !== undefined && total !== expectedTotal) throw new AssistantError('Phân trang đối chiếu chưa đầy đủ hoặc đã thay đổi; chưa có kết luận.', 409);
    expectedTotal = total;
    if (rows.length === total) return rows;
    if (batch.length !== limit) throw new AssistantError('Một trang đối chiếu bị thiếu dữ liệu; chưa có kết luận.', 502);
    const pageField = operation.fields.find(field => field.apiKey === 'page');
    const limitField = operation.fields.find(field => field.apiKey === 'limit');
    if (!pageField || !limitField) throw new AssistantError('Nguồn đối chiếu chưa hỗ trợ đọc đủ các trang.', 502);
    if(index===24) throw new AssistantError('Đã tới giới hạn số trang đối chiếu; chưa có kết luận.',413);
    response = await nextPage({ ...values, [pageField.key]: page + 1, [limitField.key]: limit });
  }
  throw new AssistantError('Đã tới giới hạn số trang đối chiếu; chưa có kết luận.', 413);
}

function tuitionAmount(value:unknown) {
  if(value===undefined || value===null || value==='') return 0;
  const amount=typeof value==='number'?value:typeof value==='string'&&/^\d+(?:[.,]\d{3})*$/.test(value.trim())?Number(value.replace(/[.,]/g,'')):NaN;
  if(!Number.isSafeInteger(amount)||amount<0) throw new AssistantError('Số tiền học phí chưa hợp lệ; chưa thể kết luận học viên đã đóng đủ.',502);
  return amount;
}
function tuitionDebtReply(relation:ReadRelationDefinition,sources:Map<string,Record<string,unknown>[]>,intent:string) {
  const paidByStudent=new Map<string,number>();
  for(const payment of sources.get(relation.right.actionId)!) {
    if(payment.amount===undefined || payment.amount===null) throw new AssistantError('Nguồn thanh toán thiếu số tiền; chưa thể kết luận học phí.',502);
    const key=identifier(payment[relation.foreignKey]);
    const total=(paidByStudent.get(key)||0)+tuitionAmount(payment.amount);
    if(!Number.isSafeInteger(total)) throw new AssistantError('Tổng tiền thanh toán vượt phạm vi đối chiếu an toàn.',502);
    paidByStudent.set(key,total);
  }
  const students=sources.get(relation.left.actionId)!;
  const rows=students.flatMap(student=>{
    if(student.fee===undefined || student.fee===null) throw new AssistantError('Nguồn học viên thiếu học phí; chưa thể kết luận đã đóng đủ.',502);
    const total=tuitionAmount(student.fee), key=identifier(student[relation.left.identity]??student.id);
    // Same rule as FeesPage: Payment totals take priority. Profiles imported
    // before Payment documents retain their stored paidAmount fallback.
    const paid=paidByStudent.has(key)?paidByStudent.get(key)!:tuitionAmount(student.paidAmount);
    const debt=total-paid;
    if(debt<=0) return [];
    if(typeof student.fullName!=='string'||!student.fullName.trim()) throw new AssistantError('Nguồn học viên thiếu tên để trình bày kết quả.',502);
    const money=(value:number)=>new Intl.NumberFormat('vi-VN').format(value)+' ₫';
    return [{'Học viên':student.fullName.replace(/[\r\n]+/g,' '),'Tổng học phí':money(total),'Đã đóng':money(paid),'Còn nợ':money(debt)}];
  });
  const asksAllPaid=/tat ca|deu da dong|dong het/.test(normalize(intent));
  const summary=asksAllPaid?(rows.length?`Chưa phải tất cả học viên đã đóng đủ. Có ${rows.length} học viên còn nợ học phí.`:'Không có dư nợ học phí trong phạm vi đã đối chiếu. Điều này không đồng nghĩa mọi học viên đã phát sinh thanh toán.'):relation.title;
  return formatAssistantResultTable(summary,rows,[`Đã đối chiếu đầy đủ ${students.length} học viên trong phạm vi được cấp quyền; xác định nợ theo số tiền, không theo trạng thái hồ sơ.`]);
}
export function renderReadRelation(id: string, sources: Map<string, Record<string, unknown>[]>, intent='') {
  const relation = READ_RELATIONS.find(item => item.id === id);
  if (!relation || !sources.has(relation.left.actionId) || !sources.has(relation.right.actionId)) throw new AssistantError('Chưa có đủ nguồn đối chiếu được xác minh.', 502);
  if(relation.kind==='tuition-balance') return tuitionDebtReply(relation,sources,intent);
  const related = new Set(sources.get(relation.right.actionId)!.map(row => identifier(row[relation.foreignKey])));
  const unmatched = sources.get(relation.left.actionId)!.filter(row => !related.has(identifier(row[relation.left.identity] ?? row.id)));
  return formatAssistantResultTable(relation.title, unmatched.map(row => Object.fromEntries(Object.entries(relation.columns)
    .filter(([key]) => row[key] !== undefined && row[key] !== null).map(([key, label]) => [label, String(row[key]).replace(/[\r\n]+/g, '; ')]))));
}
