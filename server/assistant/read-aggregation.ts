import type { AnalysisContract, ListAnalysis } from './list-analysis';
import { AssistantError } from './policy';

export type ReadAggregate = NonNullable<ListAnalysis['aggregate']>;
export const readAggregates = (plan: ListAnalysis): ReadAggregate[] => Array.isArray(plan.aggregates) ? plan.aggregates : plan.aggregate ? [plan.aggregate] : [];
/** Stable, server-defined output addresses. Never execute model expressions. */
export const aggregateOutputKey = (measure: ReadAggregate) => measure.field ? `${measure.operation}_${measure.field}` : 'count';

export function aggregateOutputContract(contract: AnalysisContract, plan: ListAnalysis): AnalysisContract {
  const fields: AnalysisContract['fields'] = {};
  if (plan.groupBy && Object.hasOwn(contract.fields, plan.groupBy)) fields[plan.groupBy] = contract.fields[plan.groupBy];
  const measures = readAggregates(plan);
  for (const measure of measures) {
    const key = aggregateOutputKey(measure);
    if (Object.hasOwn(fields, key)) throw new AssistantError('Tên nhóm trùng với tên chỉ tiêu tổng hợp. Bạn chọn cách tổng hợp khác nhé.');
    const label = measure.operation === 'count'
      ? `Số lượng${measure.field && measures.length > 1 ? ` ${contract.fields[measure.field]?.label.toLowerCase()}` : ''}`
      : `${measure.operation === 'sum' ? 'Tổng' : 'Trung bình'} ${contract.fields[measure.field!]?.label.toLowerCase()}`;
    fields[key] = { label, type: 'number' };
  }
  return { fields };
}

/** A source address is unambiguous only when exactly one selected measure uses it. */
export function aggregateOrderField(contract: AnalysisContract, plan: ListAnalysis, field: string): string {
  const output = aggregateOutputContract(contract, plan);
  if (Object.hasOwn(output.fields, field)) return field;
  const matching = readAggregates(plan).filter(measure => measure.field === field);
  return matching.length === 1 ? aggregateOutputKey(matching[0]) : field;
}

export function aggregateGroups(contract: AnalysisContract, rows: Record<string, unknown>[], plan: ListAnalysis) {
  const groups = new Map<string, { value: unknown; members: Record<string, unknown>[] }>();
  if (!plan.groupBy) groups.set('all', { value: 'Tất cả', members: rows });
  else for (const row of rows) {
    const value = row[plan.groupBy];
    if (value != null && !['string', 'number', 'boolean'].includes(typeof value)) throw new AssistantError('Cột phân nhóm chưa phải dữ liệu đơn.');
    // Group by typed values, not translated labels (two states may share a label).
    const key = JSON.stringify([typeof value, value ?? null]);
    const group = groups.get(key) || { value, members: [] };
    group.members.push(row); groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const row: Record<string, unknown> = plan.groupBy ? { [plan.groupBy]: group.value } : {};
    for (const measure of readAggregates(plan)) {
      const cells = group.members.map(member => member[measure.field!]);
      if (measure.operation !== 'count' && cells.some(value => value != null && (typeof value !== 'number' || !Number.isFinite(value)))) throw new AssistantError('Cột cần tính có giá trị không phải số. Mình chưa tính tổng hoặc trung bình.');
      const numbers = cells.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const total = numbers.reduce((sum, value) => sum + value, 0);
      const value = measure.operation === 'count' ? measure.field ? cells.filter(value => value != null && value !== '').length : group.members.length
        : numbers.length ? measure.operation === 'sum' ? total : total / numbers.length : null;
      if (typeof value === 'number' && !Number.isFinite(value)) throw new AssistantError('Kết quả tính vượt giới hạn số. Mình chưa kết luận.');
      row[aggregateOutputKey(measure)] = value;
    }
    return { row, members: group.members };
  });
}
