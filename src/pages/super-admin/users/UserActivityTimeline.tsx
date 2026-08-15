import React from "react";
import { Activity } from "lucide-react";
import { superAdminUserAccessService, type UserActivityCategory, type UserActivityEvent } from "../../../services/superAdminUserAccessService";
import { getApiErrorMessage } from "../../../utils/errorMessage";

type Props = { tenantId: string; userId: string; loadActivity?: typeof superAdminUserAccessService.activity };

const categories: Array<{ value: UserActivityCategory | ""; label: string }> = [
  { value: "", label: "Tất cả" },
  { value: "authentication", label: "Đăng nhập" },
  { value: "view", label: "Xem dữ liệu" },
  { value: "search", label: "Tìm kiếm" },
  { value: "data", label: "Dữ liệu" },
  { value: "communication", label: "Trao đổi" },
  { value: "configuration", label: "Cấu hình" },
  { value: "security", label: "Bảo mật" },
  { value: "business", label: "Nghiệp vụ" },
];

const dateInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export function UserActivityTimeline({ tenantId, userId, loadActivity = superAdminUserAccessService.activity }: Props) {
  const today = React.useMemo(() => new Date(), []);
  const [from, setFrom] = React.useState(() => dateInputValue(new Date(today.getTime() - 6 * 86_400_000)));
  const [to, setTo] = React.useState(() => dateInputValue(today));
  const [category, setCategory] = React.useState<UserActivityCategory | "">("");
  const [result, setResult] = React.useState<"success" | "failure" | "">("");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [events, setEvents] = React.useState<UserActivityEvent[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const limit = 20;

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadActivity(tenantId, userId, { from, to, category, result, search: debouncedSearch, page, limit })
      .then((result) => { if (active) { setEvents(result.data); setTotal(result.total); } })
      .catch((cause) => { if (active) setError(getApiErrorMessage(cause, "Không thể tải lịch sử hoạt động.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, userId, from, to, category, result, debouncedSearch, page, loadActivity]);

  const grouped = events.reduce<Record<string, UserActivityEvent[]>>((result, event) => {
    const key = new Date(event.occurredAt).toLocaleDateString("vi-VN");
    (result[key] ||= []).push(event);
    return result;
  }, {});

  const changeFilter = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPage(1);
    setter(event.target.value);
  };

  return (
    <section className="rounded-xl border border-white/10 p-4">
      <h4 className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-cyan-300" />Hoạt động theo ngày</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold text-slate-400">Từ ngày<input aria-label="Từ ngày" type="date" value={from} max={to} onChange={changeFilter(setFrom)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs font-semibold text-slate-400">Đến ngày<input aria-label="Đến ngày" type="date" value={to} min={from} onChange={changeFilter(setTo)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs font-semibold text-slate-400">Loại hoạt động<select aria-label="Loại hoạt động" value={category} onChange={changeFilter((value) => setCategory(value as UserActivityCategory | ""))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white">{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-400">Kết quả<select aria-label="Kết quả" value={result} onChange={changeFilter((value) => setResult(value as typeof result))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"><option value="">Tất cả</option><option value="success">Thành công</option><option value="failure">Thất bại</option></select></label>
        <label className="text-xs font-semibold text-slate-400">Tìm kiếm<input aria-label="Tìm kiếm hoạt động" value={search} onChange={changeFilter(setSearch)} placeholder="Nhập nội dung thao tác" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white" /></label>
      </div>
      {loading ? <p className="py-6 text-center text-sm text-slate-400">Đang tải hoạt động…</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
      {!loading && !error && events.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Chưa có hoạt động nào được ghi nhận từ khi tính năng nhật ký được bật.</p> : null}
      <div className="mt-4 space-y-4">
        {Object.entries(grouped).map(([day, dayEvents]) => <section key={day}>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{day}</h5>
          <div className="space-y-2">{dayEvents.map((event) => <article key={event.eventId} className="flex gap-3 rounded-lg bg-slate-950/60 p-3 text-sm">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${event.result === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
            <div className="min-w-0 flex-1"><p className="font-medium text-slate-200">{event.description}</p><p className="mt-1 text-xs text-slate-500" title={new Date(event.occurredAt).toLocaleString("vi-VN")}>{new Date(event.occurredAt).toLocaleString("vi-VN")} · {event.result === "success" ? "Thành công" : "Thất bại"}</p>{event.sourceIp || event.deviceSummary ? <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">Thông tin truy cập</summary><p>{event.sourceIp ? `IP: ${event.sourceIp}` : ""}{event.sourceIp && event.deviceSummary ? " · " : ""}{event.deviceSummary || ""}</p></details> : null}</div>
          </article>)}</div>
        </section>)}
      </div>
      {total > limit ? <div className="mt-4 flex items-center justify-between text-xs text-slate-400"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border border-white/10 px-3 py-1.5 disabled:opacity-40">Trang trước</button><span>Trang {page} / {Math.ceil(total / limit)}</span><button type="button" disabled={page * limit >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded border border-white/10 px-3 py-1.5 disabled:opacity-40">Trang sau</button></div> : null}
    </section>
  );
}
