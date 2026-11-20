import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { onboardingService } from "../services/onboardingService";
import { branchService } from "../services/branchService";
import type { CompanyInvitation } from "../../shared/onboarding";
export default function CompanyInvitationsPage() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<CompanyInvitation[]>([]);
  const [branches, setBranches] = useState<Array<{ _id: string; name: string }>>([]);
  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setItems(await onboardingService.invitations());
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    branchService
      .list()
      .then((v) => {
        setBranches(v.filter((row) => row.isActive));
        setBranchId(v.find((row) => row.isActive)?._id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  async function act(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (userProfile?.role !== "admin") return <p>Bạn không có quyền quản lý lời mời.</p>;
  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-9">
      <div className="mx-auto max-w-3xl space-y-5 text-slate-900">
        <a className="underline" href="/">
          Quay lại doanh nghiệp
        </a>
        <h1 className="text-2xl font-semibold">Mời nhân viên vào doanh nghiệp</h1>
        <p>
          Lời mời chỉ dành cho tài khoản đã tồn tại và chưa thuộc doanh nghiệp khác. Để cấp tài khoản nhân viên mới,
          dùng Quản lý người dùng. Người nhận đăng nhập và xác nhận lời mời; lời mời không tạo tài khoản mới.
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <form
          className="space-y-3 rounded-xl border bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await onboardingService.invite(email.trim(), branchId);
              setEmail("");
            });
          }}
        >
          <label className="block">
            Email
            <input
              type="email"
              required
              maxLength={254}
              className="mt-1 w-full rounded-lg border p-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            Chi nhánh
            <select
              required
              className="mt-1 w-full rounded-lg border p-3"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((v) => (
                <option value={v._id} key={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !branchId} className="rounded-lg bg-emerald-700 p-3 text-white">
            Gửi lời mời
          </button>
        </form>
        {items.map((v) => (
          <article key={v._id} className="space-y-2 rounded-xl border bg-white p-5">
            <strong>{v.email}</strong>
            <p>
              {
                {
                  pending: "Chờ xác nhận",
                  accepted: "Đã tham gia",
                  declined: "Đã từ chối",
                  revoked: "Đã thu hồi",
                  expired: "Hết hạn",
                }[v.status]
              }{" "}
              · {new Date(v.expiresAt).toLocaleString("vi-VN")}
            </p>
            {v.status === "pending" && (
              <button
                disabled={busy}
                className="rounded-lg border p-2"
                onClick={() => {
                  if (window.confirm("Thu hồi lời mời?")) void act(() => onboardingService.revoke(v._id));
                }}
              >
                Thu hồi
              </button>
            )}
            {v.status === "pending" && (
              <button
                disabled={busy}
                className="ml-2 rounded-lg border p-2"
                onClick={() => void act(() => onboardingService.resendInvitation(v._id))}
              >
                Gửi lại email
              </button>
            )}
            {["expired", "revoked", "declined"].includes(v.status) && (
              <button
                disabled={busy}
                className="rounded-lg border p-2"
                onClick={() => void act(() => onboardingService.invite(v.email, v.branchId))}
              >
                Mời lại
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
