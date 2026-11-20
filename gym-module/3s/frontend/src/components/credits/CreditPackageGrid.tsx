import { Check, Sparkles } from 'lucide-react';
import type { CreditPackage } from '../../types/credits';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

interface CreditPackageGridProps {
  packages: CreditPackage[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function CreditPackageGrid({
  packages,
  selectedId,
  onSelect,
}: CreditPackageGridProps) {
  if (!packages.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center text-sm font-medium text-slate-500">
        Chưa có gói credit nào được cấu hình sẵn. Bạn vẫn có thể nạp số tiền tùy chọn bên dưới.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((item, index) => {
        const isSelected = selectedId === item.id;
        const isPopular = item.bonusCredits > 0 && index === 1;

        return (
          <label
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-all duration-150 select-none ${
              isSelected
                ? 'border-sky-500 bg-sky-50/50 shadow-sm ring-2 ring-sky-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
            }`}
          >
            <input
              type="radio"
              name="credit-package"
              value={item.id}
              checked={isSelected}
              onChange={() => onSelect(item.id)}
              className="sr-only"
            />

            {/* Top row: Badge & Check indicator */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {item.name}
                </span>
                {isPopular && (
                  <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-extrabold text-slate-900 shadow-2xs">
                    Phổ biến
                  </span>
                )}
                {item.bonusCredits > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <Sparkles size={10} />
                    +{item.bonusCredits} bonus
                  </span>
                )}
              </div>

              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-slate-300 bg-white group-hover:border-slate-400'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>
            </div>

            {/* Middle: Price */}
            <div className="mt-3">
              <div className="text-lg font-bold text-slate-900">
                {money.format(item.amountVnd)}
              </div>
            </div>

            {/* Bottom: Credits received */}
            <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2.5">
              <span className="text-xs font-medium text-slate-500">Nhận được:</span>
              <div className="flex items-baseline gap-1">
                <span className="font-oswald text-xl font-black text-[#003b70]">
                  {item.grantCredits.toLocaleString('vi-VN')}
                </span>
                <span className="text-xs font-semibold text-slate-500">credit</span>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
