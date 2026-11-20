import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCreditWallet } from '../../contexts/CreditWalletContext';
import { erpWallet, type ErpTransaction } from '../../services/erpWallet';

export default function ErpWalletPage() {
  const { wallet, refresh } = useCreditWallet();
  const [transactions, setTransactions] = useState<ErpTransaction[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const reload = async () => {
    await refresh();
    setTransactions(await erpWallet.transactions());
  };

  useEffect(() => {
    let active = true;
    const orderCode = Number(searchParams.get('orderCode'));
    const isMock = searchParams.get('mock') === '1';
    const settle = async () => {
      if (orderCode && isMock) await erpWallet.confirmMock(orderCode);
      if (orderCode) await erpWallet.check(orderCode);
      if (active) await reload();
      if (active && orderCode) setSearchParams({}, { replace: true });
    };
    void settle().catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Không tải được ví Credit ERP.'));
    return () => { active = false; };
  }, []);

  const deposit = async () => {
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 2000) { setError('Số tiền nạp tối thiểu là 2.000đ.'); return; }
    setLoading(true);
    setError('');
    try {
      const payment = await erpWallet.deposit(value);
      (window.top || window).location.assign(payment.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được yêu cầu nạp Credit.');
      setLoading(false);
    }
  };

  return <section className="mx-auto max-w-4xl space-y-5 p-4 text-on-surface">
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
      <h1 className="text-balance text-lg font-semibold">Ví Credit ERP</h1>
      <p className="mt-2 text-pretty text-sm text-on-surface-variant">Số dư này dùng chung cho tác vụ AI của ERP và Quản lý phòng Gym.</p>
      <p className="mt-4 text-3xl font-semibold tabular-nums" aria-live="polite">{wallet?.availableCredits.toLocaleString('vi-VN') ?? '—'} Credit</p>
      <button type="button" className="mt-3 text-sm text-primary underline" onClick={() => void reload().catch((cause) => setError(cause instanceof Error ? cause.message : 'Không tải được ví.'))}>Làm mới số dư</button>
    </div>
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
      <h2 className="text-balance text-base font-semibold">Nạp Credit</h2>
      <label className="mt-4 block text-sm" htmlFor="gym-credit-amount">Số tiền (đồng)</label>
      <div className="mt-2 flex flex-wrap gap-3">
        <input id="gym-credit-amount" type="number" min="2000" step="100" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'gym-credit-error' : undefined} className="min-w-48 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 focus:border-primary focus:outline-none" />
        <button type="button" disabled={loading} onClick={() => void deposit()} className="rounded-lg bg-primary px-5 py-2 font-medium text-on-primary disabled:opacity-50">{loading ? 'Đang tạo thanh toán...' : 'Nạp qua ví ERP'}</button>
      </div>
      {error && <p id="gym-credit-error" role="alert" className="mt-3 text-pretty text-sm text-red-600">{error}</p>}
    </div>
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
      <h2 className="text-balance text-base font-semibold">Lịch sử ví ERP</h2>
      {transactions.length === 0 ? <p className="mt-3 text-pretty text-sm text-on-surface-variant">Chưa có giao dịch.</p> : <ul className="mt-3 divide-y divide-outline-variant">
        {transactions.map((item) => <li key={item._id} className="flex justify-between gap-4 py-3 text-sm">
          <span><span className="block font-medium">{item.description || (item.type === 'deposit' ? 'Nạp Credit' : 'Sử dụng Credit')}</span><span className="text-on-surface-variant">{new Date(item.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}{item.status === 'pending' ? ' · Chờ thanh toán' : item.status === 'failed' ? ' · Thất bại' : ''}</span></span>
          <span className="whitespace-nowrap font-semibold tabular-nums">{item.status === 'success' ? item.type === 'deposit' ? '+' : '-' : ''}{item.amount.toLocaleString('vi-VN')} Credit</span>
        </li>)}
      </ul>}
    </div>
  </section>;
}
