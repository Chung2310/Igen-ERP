// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { AiSubscriptionPlan, AiSubscriptionSummary } from '../../../../services/aiSubscriptionService';
const mocks = vi.hoisted(() => ({ current: vi.fn(), plans: vi.fn(), history: vi.fn(), events: new Map<string, (event: { companyCode: string }) => void>() }));
const media = vi.hoisted(() => ({ desktop: true, listeners: new Set<() => void>() }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: 'staff', companyCode: 'QA', companyName: 'Công ty Minh Anh' } }) }));
vi.mock('../../../../services/aiSubscriptionService', async () => ({ ...await vi.importActual('../../../../../shared/marketing-suite/subscription'), getCurrentAiSubscription: mocks.current, getAvailableAiSubscriptionPlans: mocks.plans, getAiSubscriptionHistory: mocks.history }));
vi.mock('../../../../services/socketService', () => ({ socketService: { on: (name: string, callback: (event: { companyCode: string }) => void) => { mocks.events.set(name, callback); return () => mocks.events.delete(name); }, onStatusChange: () => () => undefined } }));
import AiSubscriptionPage from './AiSubscriptionPage';

const subscription: AiSubscriptionSummary = { _id: 'period-1', companyCode: 'QA', planId: 'basic', planName: 'Khởi đầu', priceVnd: 99000, aiLimit: 1000, used: 200, reserved: 100, remaining: 700, startsAt: '2020-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', status: 'active' };
const plans: AiSubscriptionPlan[] = [{ _id: 'basic', code: 'BASIC', name: 'Khởi đầu', description: 'Cho nhóm nhỏ', aiLimit: 1000, durationDays: 30, priceVnd: 99000, active: true, updatedAt: '2026-01-01' }, { _id: 'growth', code: 'GROWTH', name: 'Tăng trưởng', description: 'Cho nhu cầu thường xuyên', aiLimit: 2000, durationDays: 90, priceVnd: 249000, active: true, updatedAt: '2026-01-01' }];
beforeEach(() => {
  media.desktop = true;
  vi.stubGlobal('matchMedia', () => ({ matches: media.desktop, addEventListener: (_event: string, callback: () => void) => media.listeners.add(callback), removeEventListener: (_event: string, callback: () => void) => media.listeners.delete(callback) }));
  mocks.current.mockResolvedValue(subscription); mocks.plans.mockResolvedValue(plans); mocks.history.mockResolvedValue({ items: [], page: 1, totalPages: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); mocks.events.clear(); media.listeners.clear(); });

async function chooseGrowth() {
  const user = userEvent.setup();
  render(<AiSubscriptionPage />);
  await user.click(screen.getByRole('button', { name: 'Gói nâng cấp' }));
  await user.click(await screen.findByRole('button', { name: 'Chọn Tăng trưởng' }));
  return user;
}
test('shows shared available quota with held calls excluded and an accessible percentage', async () => {
  render(<AiSubscriptionPage />);
  const progress = await screen.findByRole('progressbar');
  expect(progress.getAttribute('aria-valuenow')).toBe('70');
  expect(progress.getAttribute('aria-valuetext')).toContain('700 trên 1.000');
  expect(screen.queryByText('Đang giữ')).toBeNull();
});
test('quota contains only remaining balance and package transactions while upgrades stay in their own tab', async () => {
  mocks.history.mockResolvedValue({ items: [{ id: 'one:purchase', type: 'purchase', occurredAt: '2026-01-01T00:00:00Z', planName: 'Gói cũ', aiUnits: 1000, priceVnd: 99000 }, { id: 'one:expired', type: 'expired', occurredAt: '2026-02-01T00:00:00Z', planName: 'Gói cũ', aiUnits: null, priceVnd: null }], page: 1, totalPages: 1 });
  const user = userEvent.setup(); render(<AiSubscriptionPage />);
  expect((await screen.findAllByText('Mua / nâng cấp gói')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Hết hạn gói').length).toBeGreaterThan(0);
  expect(screen.queryByText('Đã sử dụng')).toBeNull();
  expect(screen.queryByText('Gói đang sử dụng')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Chọn Tăng trưởng' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Gói nâng cấp' }));
  expect(await screen.findByRole('button', { name: 'Chọn Tăng trưởng' })).toBeTruthy();
  expect(screen.queryByRole('table', { name: /Lịch sử mua/ })).toBeNull();
});
test('previews carry-over and shows a payment button without creating a transaction', async () => {
  const user = await chooseGrowth();
  expect(screen.getByText('2.700')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Chọn Tăng trưởng' })).toBe(document.activeElement);
  expect(screen.queryByText('Kiểm tra thông tin gói')).toBeNull();
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const fetch = vi.spyOn(globalThis, 'fetch');
  await user.click(screen.getByRole('button', { name: 'Thanh toán' }));
  expect(screen.getByRole('status').textContent).toContain('Chưa phát sinh giao dịch');
  expect(copy).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox', { name: 'Thông tin yêu cầu nâng cấp gói' })).toBeNull();
  expect(mocks.current).toHaveBeenCalledTimes(1);
  fetch.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Chọn gia hạn Khởi đầu' }));
  expect(screen.getByRole('button', { name: 'Chọn gia hạn Khởi đầu' })).toBe(document.activeElement);
  const summary = screen.getByRole('complementary', { name: 'Tóm tắt thanh toán' });
  expect(within(summary).getByText('1.700')).toBeTruthy();
  expect(within(summary).queryByRole('status')).toBeNull();
});
test('expired quota is not offered as carry-over even if the API status has not changed yet', async () => {
  mocks.current.mockResolvedValue({ ...subscription, expiresAt: '2021-01-01T00:00:00Z' });
  const user = userEvent.setup(); render(<AiSubscriptionPage />);
  expect((await screen.findByRole('progressbar')).getAttribute('aria-valuenow')).toBe('0');
  await user.click(screen.getByRole('button', { name: 'Gói nâng cấp' }));
  await user.click(screen.getByRole('button', { name: 'Chọn Tăng trưởng' }));
  const order = screen.getByRole('complementary', { name: 'Tóm tắt thanh toán' });
  expect(within(order).getByText('2.000', { selector: 'p' })).toBeTruthy();
  expect(within(order).queryByText('2.700')).toBeNull();
});
test('a plan without a price cannot proceed and explains why next to the payment button', async () => {
  mocks.plans.mockResolvedValue(plans.map(plan => ({ ...plan, priceVnd: null })));
  const user = await chooseGrowth();
  const payment = screen.getByRole('button', { name: 'Thanh toán' }) as HTMLButtonElement;
  expect(payment.disabled).toBe(true);
  expect(document.getElementById(payment.getAttribute('aria-describedby') || '')?.textContent).toContain('chưa được thiết lập giá');
  await user.click(payment);
  expect(screen.queryByText(/Chưa phát sinh giao dịch/)).toBeNull();
});
test('catalog failures can retry and an empty list never presents a made-up plan', async () => {
  mocks.plans.mockRejectedValueOnce(new Error('Không kết nối được')).mockResolvedValue([]);
  const user = userEvent.setup(); render(<AiSubscriptionPage />);
  await user.click(screen.getByRole('button', { name: 'Gói nâng cấp' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Không kết nối được');
  await user.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
  expect(await screen.findByText('Chưa có gói khả dụng')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Chọn Tăng trưởng' })).toBeNull();
});
test('does not display an unknown current balance as zero during an upgrade preview', async () => {
  mocks.current.mockImplementation(() => new Promise(() => undefined));
  await chooseGrowth();
  expect(screen.getByText('Chưa xác định')).toBeTruthy();
  expect(screen.queryByText('2.700')).toBeNull();
});
test('refreshes tenant quota when the server announces a successful package change', async () => {
  render(<AiSubscriptionPage />);
  await screen.findByRole('progressbar');
  mocks.current.mockResolvedValue({ ...subscription, aiLimit: 3000, remaining: 2700 });
  mocks.events.get('ai-subscription:updated')?.({ companyCode: 'QA' });
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('90'));
});
test('mobile checkout stays outside the scrolling list and hides when switching to quota', async () => {
  media.desktop = false;
  const user = await chooseGrowth();
  const payment = screen.getByRole('button', { name: 'Thanh toán' });
  expect(document.getElementById('ai_subscription_plans')?.contains(payment)).toBe(false);
  expect(screen.queryByRole('complementary')).toBeNull();
  const summary = screen.getByText('Xem chi tiết').closest('summary');
  expect(summary).toBeTruthy();
  await user.click(summary!);
  expect(screen.getByText('2.700')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Hạn mức' }));
  expect(screen.queryByRole('button', { name: 'Thanh toán' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Gói nâng cấp' }));
  expect(screen.getByRole('button', { name: 'Thanh toán' })).toBeTruthy();
  await act(async () => { media.desktop = true; media.listeners.forEach(callback => callback()); });
  expect(screen.getByRole('complementary', { name: 'Tóm tắt thanh toán' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Thanh toán' })).toHaveLength(1);
});
test('a removed plan cannot leave a stale payment summary after refreshing the catalog', async () => {
  const user = await chooseGrowth();
  mocks.plans.mockResolvedValue([plans[0]]);
  await user.click(screen.getByRole('button', { name: 'Làm mới' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Chọn Tăng trưởng' })).toBeNull());
  expect(screen.getByText('Chưa chọn gói')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Thanh toán' })).toBeNull();
});
