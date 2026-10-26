import { Keyboard, X } from "lucide-react";

export default function PosShortcutHelp({ onClose }: { onClose(): void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pos-shortcuts-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="pos-shortcuts-title" className="flex items-center gap-2.5 font-bold text-slate-900"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><Keyboard className="h-4 w-4" /></span>Phím tắt POS</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng phím tắt POS"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ul className="space-y-1 px-5 py-4 text-sm text-slate-700">
          <li>F1 · Trợ giúp</li>
          <li>F2 · Tìm sản phẩm</li>
          <li>F4 · Thanh toán</li>
          <li>F8 · Quét camera</li>
        </ul>
      </div>
    </div>
  );
}
