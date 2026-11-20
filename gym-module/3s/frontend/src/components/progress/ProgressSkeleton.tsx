export default function ProgressSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải dữ liệu tiến độ"
      aria-live="polite"
      aria-busy="true"
      className="space-y-5"
    >
      <span className="sr-only">Đang tải dữ liệu tiến độ</span>
      <div className="animate-pulse space-y-3 motion-reduce:animate-none">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="h-8 w-64 max-w-full rounded bg-slate-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="min-h-40 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 motion-reduce:animate-none"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-12 h-9 w-32 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-40 max-w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />
    </div>
  );
}
