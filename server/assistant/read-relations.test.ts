import { expect, it, vi } from 'vitest';
import { READ_RELATIONS, collectRelationRows, relationEvidenceSupported, renderReadRelation, validateReadRelations } from './read-relations';
import { defaultWorkflow, operationById } from './catalog';
import { validateCompositeQueryPlan, validateCompositeRequestCoverage } from './composite-query';
import { publicAssistantResultFields } from './result-field-policy';
const relation = READ_RELATIONS[0];
it('registers output columns only from each source public field allowlist', () => {
  for (const binding of READ_RELATIONS) {
    const approved = publicAssistantResultFields(operationById(binding.left.actionId)!);
    expect(Object.keys(binding.columns).filter(key => !approved.includes(key))).toEqual([]);
  }
});
const workflows = [relation.left.actionId, relation.right.actionId].map(id => defaultWorkflow(operationById(id)!));
const queries = [
  { actionId: relation.left.actionId, purpose: 'Lao động', values: {}, resultFields: ['fullName'], relation: relation.id },
  { actionId: relation.right.actionId, purpose: 'Hợp đồng', values: {}, resultFields: ['workerName'] },
];
it('validates the declared absence operator and rejects missing/foreign/filtered sources', () => {
  expect(validateCompositeQueryPlan(queries, workflows)).toMatchObject({ ok: true });
  expect(validateCompositeQueryPlan([{ ...queries[0], relation: 'arbitrary-SQL' }, queries[1]], workflows)).toMatchObject({ ok: false });
  expect(validateCompositeQueryPlan(queries, [workflows[0]])).toMatchObject({ ok: false });
  expect(validateReadRelations([queries[0], { ...queries[1], values: { status: 'active' } }], workflows)).toBe(false);
  expect(validateReadRelations([queries[0], queries[1], queries[1]], workflows)).toBe(false);
});
it('requires the operator mapping and keeps extra conditions and opposite predicates blocked', () => {
  const text = 'Danh sách lao động chưa có hợp đồng';
  const coverage = [{ evidence: text, requirement: 'Không có hồ sơ liên quan', mappedTo: [`query:${relation.left.actionId}:relation`] }];
  expect(validateCompositeRequestCoverage(text, coverage, queries, workflows)).toEqual({ ok: true });
  expect(validateCompositeRequestCoverage(text, [{ ...coverage[0], mappedTo: [`query:${relation.left.actionId}:source`] }], queries, workflows)).toMatchObject({ ok: false });
  for (const evidence of ['lao động đã có hợp đồng', 'lao động chưa có hợp đồng còn hiệu lực', 'lao động chưa có hợp đồng hôm nay', 'lao động chưa có hợp đồng ở Hà Nội']) {
    expect(relationEvidenceSupported(evidence, relation.id)).toBe(false);
  }
});
it('joins by private identity, handles same-name people, and renders approved public fields only', () => {
  const sources = new Map([
    [relation.left.actionId, [{ _id: 'private-worker-1', fullName: 'QA Trùng Tên', laborType: 'official' }, { _id: 'private-worker-2', fullName: 'QA Trùng Tên', laborType: 'seasonal', code: 'PRIVATE-CODE', phone: 'PRIVATE-PHONE', password: 'secret' }]],
    [relation.right.actionId, [{ _id: 'contract-1', workerId: { _id: 'private-worker-1' } }, { _id: 'contract-2', workerId: 'private-worker-1' }]],
  ]);
  const reply = renderReadRelation(relation.id, sources);
  expect(reply).toContain('seasonal'); expect(reply).not.toContain('official');
  expect(reply).not.toContain('PRIVATE-');
  expect(reply).not.toContain('private-'); expect(reply).not.toContain('secret');
  expect(() => renderReadRelation(relation.id, new Map([[relation.left.actionId, []]]))).toThrow();
  expect(() => renderReadRelation(relation.id, new Map([[relation.left.actionId, []], [relation.right.actionId, [{ _id: 'contract-1' }]]]))).toThrow('định danh');
});
it('collects all scoped pages and refuses duplicates, changing totals and missing pages', async () => {
  const op = operationById(relation.right.actionId)!;
  const page = op.fields.find(field => field.apiKey === 'page')!;
  expect(page).toBeDefined();
  const first = { data: [{ _id: 'c1', workerId: 'w1' }, { _id: 'c2', workerId: 'w2' }], total: 3, page: 1, limit: 2 };
  const next = vi.fn(async values => { expect(values[page.key]).toBe(2); return { data: [{ _id: 'c3', workerId: 'w3' }], total: 3, page: 2, limit: 2 }; });
  expect(await collectRelationRows(relation.right, op, first, {}, next)).toHaveLength(3);
  expect(next).toHaveBeenCalledTimes(1);
  await expect(collectRelationRows(relation.right, op, first, {}, async () => ({ data: [{ _id: 'c2' }], total: 3, page: 2, limit: 2 }))).rejects.toThrow('trùng');
  await expect(collectRelationRows(relation.right, op, first, {}, async () => ({ data: [{ _id: 'c3' }], total: 4, page: 2, limit: 2 }))).rejects.toThrow('thay đổi');
  await expect(collectRelationRows(relation.right, op, { ...first, data: first.data.slice(0, 1) }, {}, next)).rejects.toThrow('thiếu');
  await expect(collectRelationRows(relation.right, op, { data: [] }, {}, next)).rejects.toThrow();
});
