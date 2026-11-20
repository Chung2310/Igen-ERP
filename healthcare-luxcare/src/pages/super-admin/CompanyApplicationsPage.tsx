import { useEffect, useRef, useState } from "react";
import { superAdminRequest } from "../../services/superAdminRequest";
import { useStepUp } from "../../hooks/useStepUp";
import type { CompanyApplication } from "../../../shared/onboarding";
const statuses: Record<string, string> = {
  pending: "Chờ duyệt",
  needs_information: "Cần bổ sung",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};
const modules = [
  { key: "hr", label: "Nhân sự" },
  { key: "chat", label: "Trò chuyện" },
  { key: "resource", label: "Tài nguyên" },
  { key: "equipment", label: "Thiết bị" },
  { key: "supply", label: "Vật tư" },
];
export default function CompanyApplicationsPage() {
  const [items, setItems] = useState<CompanyApplication[]>([]);
  const [deletions, setDeletions] = useState<any[]>([]);
  const [selected, setSelected] = useState<CompanyApplication | null>(null);
  const [filter, setFilter] = useState("pending");
  const [companyCode, setCompanyCode] = useState("");
  const [enabledModules, setEnabledModules] = useState(["hr", "resource", "supply"]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { requestStepUp, stepUpDialog } = useStepUp();
  const keys = useRef(new Map<string, string>());
  async function load() {
    const [applications, requests] = await Promise.all([
      superAdminRequest("/api/v1/super-admin/company-applications" + (filter ? "?status=" + filter : "")),
      superAdminRequest("/api/v1/super-admin/account-deletion-requests"),
    ]);
    setItems(applications.data);
    setDeletions(requests.data);
    keys.current.clear();
    setSelected((current) =>
      current ? applications.data.find((item: CompanyApplication) => item._id === current._id) || null : null,
    );
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [filter]);
  async function mutate(path: string, body: unknown) {
    const identity = path + JSON.stringify(body);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    const result = await superAdminRequest(path, {
      method: "POST",
      headers: { "idempotency-key": keys.current.get(identity)! },
      body: JSON.stringify(body),
    });
    keys.current.delete(identity);
    return result;
  }
  async function review(decision: string) {
    if (!selected || note.trim().length < 5) {
      setError("Nhập phản hồi xét duyệt (tối thiểu 5 ký tự).");
      return;
    }
    if (decision === "approved" && (!/^[A-Z][A-Z0-9_-]{2,31}$/.test(companyCode) || !enabledModules.length)) {
      setError("Nhập mã công ty hợp lệ và chọn ít nhất một chức năng.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("/api/v1/super-admin/company-applications/" + selected._id + "/review", {
        decision,
        revision: selected.revision,
        note: note.trim(),
        reason: note.trim(),
        ...(decision === "approved" ? { companyCode, enabledModules } : {}),
      });
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function completeDeletion(row: any) {
    if (
      !window.confirm(
        "Xóa tài khoản " +
          row.email +
          "? Nếu không có admin thay thế, công ty sẽ bị tạm ngừng. Dữ liệu đồng nghiệp được giữ lại.",
      )
    )
      return;
    const step = await requestStepUp();
    if (!step) return;
    setBusy(true);
    setError("");
    try {
      await mutate("/api/v1/super-admin/account-deletion-requests/" + row._id + "/complete", {
        reason: "Hoàn tất yêu cầu xóa tài khoản do chính người dùng gửi",
        ...step,
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 p-4 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Xét duyệt doanh nghiệp</h1>
        <select className="rounded-lg border p-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(statuses).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          className="rounded-lg border p-2"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Tải lại
        </button>
      </header>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!items.length && <p>Chưa có đơn ở trạng thái này.</p>}
      <div className="space-y-3">
        {items.map((v) => (
          <article key={v._id} className="rounded-xl border bg-white p-4">
            <strong>{v.companyName}</strong>
            <p>
              {v.applicantEmail} · {statuses[v.status]}
            </p>
            <button
              disabled={busy}
              className="mt-2 rounded-lg border p-2"
              onClick={() => {
                setSelected(v);
                setCompanyCode(v.workspaceCode || v.companyCode || "");
                setNote("");
              }}
            >
              Xem hồ sơ
            </button>
          </article>
        ))}
      </div>
      {selected && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">{selected.companyName}</h2>
          <dl className="space-y-2">
            <div>
              <dt>Email</dt>
              <dd>{selected.applicantEmail}</dd>
            </div>
            <div>
              <dt>Mã số thuế</dt>
              <dd>{selected.taxCode || "Không cung cấp"}</dd>
            </div>
            <div>
              <dt>Địa chỉ</dt>
              <dd>{selected.address}</dd>
            </div>
            <div>
              <dt>Điện thoại</dt>
              <dd>{selected.phone}</dd>
            </div>
            <div>
              <dt>Nhu cầu</dt>
              <dd className="whitespace-pre-wrap">{selected.purpose}</dd>
            </div>
          </dl>
          <ol className="space-y-1 text-sm">
            {selected.history.map((v, i) => (
              <li key={i}>
                {new Date(v.at).toLocaleString("vi-VN")} · {statuses[v.status]} · {v.note}
              </li>
            ))}
          </ol>
          {selected.status === "pending" && (
            <>
              <label className="block">
                {selected.workspaceCode ? "Mã workspace sẽ được giữ nguyên" : "Mã công ty"}
                <input
                  className="mt-1 block rounded-lg border p-3"
                  maxLength={32}
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  readOnly={Boolean(selected.workspaceCode)}
                />
                {selected.workspaceCode && <span className="mt-1 block text-sm text-slate-500">Giữ mã này để tiếp tục sử dụng dữ liệu đã tạo trong thời gian trải nghiệm.</span>}
              </label>
              <fieldset>
                <legend className="mb-2">Chức năng được cấp</legend>
                <div className="flex flex-wrap gap-4">
                  {modules.map((v) => (
                    <label key={v.key} className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={enabledModules.includes(v.key)}
                        onChange={(e) =>
                          setEnabledModules((keys) =>
                            e.target.checked ? [...keys, v.key] : keys.filter((key) => key !== v.key),
                          )
                        }
                      />
                      {v.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                Phản hồi cho người đăng ký
                <textarea
                  className="mt-1 w-full rounded-lg border p-3"
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  className="rounded-lg bg-emerald-700 p-3 text-white"
                  onClick={() => void review("approved")}
                >
                  {selected.workspaceCode ? "Duyệt và nâng cấp workspace" : "Duyệt và tạo doanh nghiệp"}
                </button>
                <button
                  disabled={busy}
                  className="rounded-lg border p-3"
                  onClick={() => void review("needs_information")}
                >
                  Yêu cầu bổ sung
                </button>
                <button
                  disabled={busy}
                  className="rounded-lg border p-3 text-red-700"
                  onClick={() => void review("rejected")}
                >
                  Từ chối
                </button>
              </div>
            </>
          )}
          <button className="underline" onClick={() => setSelected(null)}>
            Đóng hồ sơ
          </button>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Yêu cầu xóa tài khoản quản trị</h2>
        <p>
          Được tiếp nhận trực tiếp trong ứng dụng. Xử lý trong 7 ngày; bàn giao quyền trước khi xóa nếu doanh nghiệp
          tiếp tục hoạt động.
        </p>
        {deletions.map((v) => (
          <article key={v._id} className="rounded-xl border bg-white p-4">
            <p>
              {v.email} · {v.companyCode}
            </p>
            <p>Hạn xử lý: {new Date(v.dueAt).toLocaleDateString("vi-VN")}</p>
            <button
              disabled={busy}
              className="mt-2 rounded-lg border p-2 text-red-700"
              onClick={() => void completeDeletion(v)}
            >
              Hoàn tất xóa tài khoản
            </button>
          </article>
        ))}
      </section>
      {stepUpDialog}
    </div>
  );
}
