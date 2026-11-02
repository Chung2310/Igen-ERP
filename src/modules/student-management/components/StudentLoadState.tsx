export function StudentLoadState({ error, onRetry, onCancel, label = 'Đang tải phân khu học viên...' }: {
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  label?: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface">
      <p role={error ? 'alert' : 'status'} className="max-w-lg text-pretty">{error || label}</p>
      {error && onRetry && (
        <button type="button" onClick={onRetry} className="min-h-11 rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Thử lại
        </button>
      )}
      {onCancel && <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-outline-variant px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Đóng</button>}
    </div>
  );
}
