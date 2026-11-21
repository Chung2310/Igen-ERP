import { expect, it } from 'vitest';
import { operationById } from './catalog';
import { projectRecords } from './executor';
import { formatFriendlyAssistantResult } from './result-format';

it('preserves only a matching transfer endpoint for branch-parent selection', () => {
  const operation = operationById('inventory.transfer.list')!;
  const record = { _id:'507f1f77bcf86cd799439021', fromBranchId:'source', toBranchId:'destination', code:'CK-1', status:'in_transit' };
  for (const branch of ['source','destination','unrelated']) {
    const rows = projectRecords(operation,{data:{items:[record]}},{user:{companyCode:'TEST',branchId:branch}} as any,{targetBranch:branch});
    expect(rows[0].branchId).toBe(branch === 'unrelated' ? undefined : branch);
  }
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
