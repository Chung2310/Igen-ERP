import React from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";

type StepUpDialogProps = {
  isOpen: boolean;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (password: string, token: string) => void;
};

export function StepUpDialog({ isOpen, submitting, error, onCancel, onConfirm }: StepUpDialogProps) {
  const [password, setPassword] = React.useState("");
  const [token, setToken] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) { setPassword(""); setToken(""); }
  }, [isOpen]);

  if (!isOpen) return null;

  const canSubmit = password.length > 0 && /^\d{6}$/.test(token) && !submitting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="step-up-dialog-title" className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h3 id="step-up-dialog-title" className="text-base font-bold">Xác thực lại để tiếp tục</h3>
          </div>
          <button type="button" aria-label="Đóng" onClick={onCancel} disabled={submitting} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </header>

        <p className="mt-3 text-xs text-slate-400">
          Đây là thao tác nhạy cảm. Vui lòng nhập lại mật khẩu và mã xác thực 2 lớp hiện tại để xác nhận.
        </p>

        {error && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}

        <label className="mt-3 block text-xs font-semibold text-slate-400">
          Mật khẩu
          <input
            type="password"
            aria-label="Mật khẩu xác thực lại"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            autoFocus
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-40"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-slate-400">
          Mã xác thực 2 lớp (6 số)
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            aria-label="Mã xác thực 2 lớp"
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={submitting}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm tracking-widest text-white outline-none focus:border-cyan-400 disabled:opacity-40"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={submitting} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold disabled:opacity-40">
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onConfirm(password, token)}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Xác nhận
          </button>
        </div>
      </section>
    </div>
  );
}
