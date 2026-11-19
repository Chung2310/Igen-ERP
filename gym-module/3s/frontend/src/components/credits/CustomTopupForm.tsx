import { Check, Coins, Sparkles, Zap } from 'lucide-react';

interface CustomTopupFormProps {
  vndPerCredit?: number | null;
  value: string;
  selected: boolean;
  onChange: (value: string) => void;
  onSelect: () => void;
}

const PRESETS = [
  { amount: 50_000, label: '50.000đ' },
  { amount: 100_000, label: '100.000đ', popular: true },
  { amount: 200_000, label: '200.000đ' },
  { amount: 500_000, label: '500.000đ' },
  { amount: 1_000_000, label: '1.000.000đ' },
  { amount: 2_000_000, label: '2.000.000đ' },
];

export default function CustomTopupForm({
  value,
  vndPerCredit,
  selected,
  onChange,
  onSelect,
}: CustomTopupFormProps) {
  const numericVal = Number(value) || 0;
  const rate = vndPerCredit && vndPerCredit > 0 ? vndPerCredit : null;
  const convertedCredits = rate ? Math.floor(numericVal / rate) : null;

  const handlePresetClick = (amount: number) => {
    onSelect();
    onChange(amount.toString());
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border p-4 transition-all duration-150 cursor-pointer ${
        selected
          ? 'border-sky-500 bg-sky-50/40 shadow-sm ring-2 ring-sky-500/20'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="radio"
            name="credit-package"
            checked={selected}
            onChange={onSelect}
            className="sr-only"
          />
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
              selected
                ? 'border-sky-500 bg-sky-500 text-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            {selected && <Check size={12} strokeWidth={3} />}
          </div>
          <div>
            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Coins size={16} className="text-sky-600" />
              Tự nhập số tiền tùy chọn
            </span>
            <span className="text-xs text-slate-500">
              Tối thiểu 10.000đ · {rate ? rate.toLocaleString('vi-VN') + 'đ = 1 credit' : 'Chưa có tỉ giá quy đổi'}
            </span>
          </div>
        </label>

        {selected && convertedCredits !== null && numericVal >= 10_000 && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-semibold text-emerald-800">
            <Zap size={14} className="text-emerald-600" />
            <span>
              Quy đổi:{' '}
              <strong className="font-oswald text-sm font-bold text-emerald-700">
                {convertedCredits?.toLocaleString('vi-VN')}
              </strong>{' '}
              credit
            </span>
          </div>
        )}
      </div>

      {/* Preset Amount Chips */}
      <div className="mt-3.5">
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Mức nạp nhanh:
        </span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRESETS.map((preset) => {
            const isPresetActive = selected && Number(value) === preset.amount;
            return (
              <button
                key={preset.amount}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePresetClick(preset.amount);
                }}
                className={`flex flex-col items-center justify-center rounded-xl border py-2 px-2 text-center transition-all cursor-pointer ${
                  isPresetActive
                    ? 'border-sky-500 bg-[#003b70] text-white font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700 font-semibold'
                }`}
              >
                <span className="text-xs">{preset.label}</span>
                <span
                  className={`text-[10px] ${
                    isPresetActive ? 'text-sky-200' : 'text-slate-400'
                  }`}
                >
                  {rate ? Math.floor(preset.amount / rate).toLocaleString('vi-VN') + ' cr' : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Input */}
      <div className="mt-3">
        <div className="relative">
          <input
            aria-label="Số tiền nạp tùy chọn"
            type="number"
            min={10000}
            max={50000000}
            step={1000}
            value={value}
            onFocus={onSelect}
            onChange={(event) => {
              onSelect();
              onChange(event.target.value);
            }}
            placeholder="Hoặc nhập số tiền khác"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
            VNĐ
          </span>
        </div>

        {numericVal > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Sparkles size={13} className="text-sky-600" />
              Tương đương: {convertedCredits === null ? 'Chưa có tỉ giá' : convertedCredits.toLocaleString('vi-VN') + ' credit'}
            </span>
            {numericVal < 10000 && (
              <span className="text-rose-500 font-medium">Tối thiểu 10.000đ</span>
            )}
            {numericVal > 50000000 && (
              <span className="text-rose-500 font-medium">Tối đa 50.000.000đ</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
