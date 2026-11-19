import type { CreditLedgerEntry } from '../../types/credits';

const labels: Record<CreditLedgerEntry['type'], { title: string; color: string }> = {
  TOPUP: { title: 'Nạp credit', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RESERVE: { title: 'Sử dụng AI', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  SETTLE: { title: 'Sử dụng AI', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  RELEASE: { title: 'Hoàn credit', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  ADJUSTMENT: { title: 'Điều chỉnh', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function CreditLedgerTable({ entries }: { entries: CreditLedgerEntry[] }) {
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 text-center text-sm font-medium text-slate-500">
        Chưa có lịch sử giao dịch credit nào.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Thời gian</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Loại giao dịch</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Biến động</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Số dư sau</th>
            <th className="px-5 py-3.5">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const isPositive = entry.availableDelta >= 0;
            const badge = labels[entry.type] || { title: entry.type, color: 'bg-slate-100 text-slate-700 border-slate-200' };

            return (
              <tr key={entry._id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-500">
                  {new Date(entry.createdAt).toLocaleString('vi-VN')}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.color}`}>
                    {badge.title}
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap font-bold">
                  <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                    {entry.availableDelta > 0 ? `+${entry.availableDelta}` : entry.availableDelta} credit
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap font-oswald text-base font-bold text-slate-900">
                  {entry.availableAfter.toLocaleString('vi-VN')}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                  {entry.reason || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
