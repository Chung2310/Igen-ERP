import type { AssistantWorkflow, AssistantValue } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import type { AssistantCompositeQuery } from "./composite-query";
import { AssistantError } from "./policy";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";

interface RelationSource { actionId: string; array: string; identity: string; pagination: "all" | "total"; }
export interface ReadRelationDefinition {
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
}];
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const availableReadRelations = (workflows: AssistantWorkflow[]) => READ_RELATIONS
  .filter(relation => [relation.left.actionId, relation.right.actionId].every(id => workflows.some(workflow => workflow.enabled && workflow.actionId === id)))
  .map(relation => ({ id: relation.id, title: relation.title, leftActionId: relation.left.actionId, rightActionId: relation.right.actionId }));

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
  phrase = phrase.replace(` ${condition} `, ' ');
  for (const alias of relation.entityAliases.map(normalize)) phrase = phrase.replaceAll(alias, ' ');
  const allowed = new Set('bao cao tong hop danh sach liet ke tim tra cuu xem cac nhung nguoi trong phan he module quan ly li'.split(' '));
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
    response = await nextPage({ ...values, [pageField.key]: page + 1, [limitField.key]: limit });
  }
  throw new AssistantError('Đã tới giới hạn số trang đối chiếu; chưa có kết luận.', 413);
}

export function renderReadRelation(id: string, sources: Map<string, Record<string, unknown>[]>) {
  const relation = READ_RELATIONS.find(item => item.id === id);
  if (!relation || !sources.has(relation.left.actionId) || !sources.has(relation.right.actionId)) throw new AssistantError('Chưa có đủ nguồn đối chiếu được xác minh.', 502);
  const related = new Set(sources.get(relation.right.actionId)!.map(row => identifier(row[relation.foreignKey])));
  const unmatched = sources.get(relation.left.actionId)!.filter(row => !related.has(identifier(row[relation.left.identity] ?? row.id)));
  return formatAssistantResultTable(relation.title, unmatched.map(row => Object.fromEntries(Object.entries(relation.columns)
    .filter(([key]) => row[key] !== undefined && row[key] !== null).map(([key, label]) => [label, String(row[key]).replace(/[\r\n]+/g, '; ')]))));
}
