// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { StockLog } from '../../types';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { role: 'admin', companyCode: 'QA' }, hasPermission: () => true }) }));
vi.mock('../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: 'branch-a' }) }));
import { StockLogReversalControl } from './StockLogReversalControl';

const log: StockLog = { id: 'log-a', type: 'xuất', purpose: 'nội bộ', status: 'Hoàn thành', sku: 'MATERIAL', productName: 'Vật tư', quantity: 1, operatorName: 'Kho', createdAt: '2026-10-01T00:00:00Z', notes: '' };
afterEach(cleanup);

it('chỉ cho đảo phiếu thủ công; không hiện nút trên log sinh từ chứng từ khác dù thiếu refType', () => {
  const { rerender } = render(<StockLogReversalControl log={log} />);
  expect(screen.getByRole('button', { name: 'Đảo phiếu' })).toBeTruthy();
  const generated = { ...log, refId: 'source-document' };
  rerender(<StockLogReversalControl log={generated} />);
  expect(screen.queryByRole('button', { name: 'Đảo phiếu' })).toBeNull();
});
