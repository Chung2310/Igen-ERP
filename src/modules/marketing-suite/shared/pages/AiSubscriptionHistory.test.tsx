// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { AiSubscriptionHistory as HistoryData } from '../../../../services/aiSubscriptionService';
const history = vi.hoisted(() => vi.fn());
vi.mock('../../../../services/aiSubscriptionService', async () => ({ ...await vi.importActual('../../../../../shared/marketing-suite/subscription'), getAiSubscriptionHistory: history }));
import AiSubscriptionHistory from './AiSubscriptionHistory';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const data = (name: string, page = 1): HistoryData => ({ items: [{ id: name, type: 'purchase', occurredAt: '2026-01-01T00:00:00Z', planName: name, aiUnits: 1000, priceVnd: 99000 }], page, totalPages: 2 });
test('history supports retry and page navigation using actual response data', async () => {
  history.mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValueOnce(data('Gói trang đầu')).mockResolvedValueOnce(data('Gói trang sau', 2));
  const user = userEvent.setup(); render(<AiSubscriptionHistory enabled refreshKey="QA" />);
  expect((await screen.findByRole('alert')).textContent).toContain('Mất kết nối');
  await user.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }));
  await screen.findAllByText('Gói trang đầu');
  await user.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect((await screen.findAllByText('Gói trang sau')).length).toBeGreaterThan(0);
  expect(history).toHaveBeenLastCalledWith(2, expect.any(AbortSignal));
});
test('a late history response from an old company or period cannot overwrite the new view', async () => {
  let resolve!: (value: HistoryData) => void;
  history.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce(data('Gói mới'));
  const view = render(<AiSubscriptionHistory enabled refreshKey="company-a" />);
  const signal = history.mock.calls[0][1] as AbortSignal;
  view.rerender(<AiSubscriptionHistory enabled refreshKey="company-b" />);
  await screen.findAllByText('Gói mới');
  await act(async () => resolve(data('Gói doanh nghiệp cũ')));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByText('Gói doanh nghiệp cũ')).toBeNull();
});
