import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { onboardingService } from "../services/onboardingService";
import { needsOnboarding, type OnboardingState } from "../../shared/onboarding";

export default function OnboardingPage() {
  const { userProfile, refreshProfile, logout, deleteAccount } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const load = useCallback(async () => {
    setState(await onboardingService.state());
    await refreshProfile();
  }, [refreshProfile]);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      onboardingService
        .state()
        .then((value) => {
          if (alive) setState(value);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void poll();
    const timer = setInterval(() => void poll(), 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userProfile?.uid]);
  async function act(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await load();
      setMessage("Đã cập nhật.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const organizationRequired = needsOnboarding(userProfile);
  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-9 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Tài khoản & tổ chức</h1>
            <p>{userProfile?.email}</p>
          </div>
          <button disabled={busy} onClick={() => void logout()} className="rounded-lg border px-4 py-2">
            Đăng xuất
          </button>
        </header>
        {organizationRequired ? (
          <section className="rounded-xl border bg-white p-5 space-y-2">
            <h2 className="font-semibold">Tham gia tổ chức để sử dụng LuxCare</h2>
            <p>
              Tài khoản nhân viên do quản trị viên doanh nghiệp cung cấp. Liên hệ quản trị viên để được cấp tài khoản
              hoặc hỗ trợ tài khoản hiện có.
            </p>
            {userProfile?.role === "trial_user" && (
              <p>
                Quyền dùng workspace cá nhân đã kết thúc. Dữ liệu cũ được giữ lại và không tự chuyển vào tổ chức bạn
                tham gia. Bạn vẫn có thể quản lý hoặc yêu cầu xóa tài khoản.
              </p>
            )}
          </section>
        ) : (
          <a className="block underline" href="/">
            Vào doanh nghiệp
          </a>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {!state ? (
          <button disabled={busy} onClick={() => void act(async () => {})}>
            Tải lại
          </button>
        ) : (
          <>
            {!state.emailVerified && organizationRequired && (
              <section className="rounded-xl border bg-white p-5 space-y-3">
                <h2 className="font-semibold">Xác minh email</h2>
                <label className="block">
                  Mã xác minh
                  <input
                    className="block border rounded p-3"
                    inputMode="numeric"
                    value={code}
                    maxLength={6}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <button
                  disabled={busy || code.length !== 6}
                  onClick={() => void act(() => onboardingService.verifyEmail(code))}
                >
                  Xác minh
                </button>{" "}
                <button disabled={busy} onClick={() => void act(() => onboardingService.resendCode())}>
                  Gửi lại mã
                </button>
              </section>
            )}
            {state.emailVerified && organizationRequired && (
              <section className="rounded-xl border bg-white p-5 space-y-3">
                <h2 className="font-semibold">Lời mời vào tổ chức</h2>
                {!state.invitations.length && <p>Chưa có lời mời còn hiệu lực.</p>}
                {state.invitations.map((invite) => (
                  <article key={invite._id} className="rounded-lg border p-4 space-y-2">
                    <strong>{invite.companyName}</strong>
                    <p>Hết hạn: {new Date(invite.expiresAt).toLocaleString("vi-VN")}</p>
                    <button
                      className="mr-4 text-emerald-700"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Tham gia " + invite.companyName + "? Dữ liệu cá nhân cũ không tự chuyển vào tổ chức.",
                          )
                        )
                          void act(() => onboardingService.answerInvite(invite._id, true));
                      }}
                    >
                      Xác nhận tham gia
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void act(() => onboardingService.answerInvite(invite._id, false))}
                    >
                      Từ chối
                    </button>
                  </article>
                ))}
              </section>
            )}
            {state.deletionRequest && (
              <section className="rounded-xl border bg-white p-5 space-y-3">
                <h2 className="font-semibold">Yêu cầu xóa tài khoản</h2>
                <p>Hạn xử lý: {new Date(state.deletionRequest.dueAt).toLocaleDateString("vi-VN")}.</p>
                <button disabled={busy} onClick={() => void act(() => onboardingService.cancelDeletion())}>
                  Hủy yêu cầu xóa
                </button>
              </section>
            )}
            <details className="rounded-xl border bg-white p-5">
              <summary className="cursor-pointer font-semibold">Bảo mật tài khoản</summary>
              <label className="mt-3 block">
                Mật khẩu xác nhận
                <input
                  type="password"
                  autoComplete="current-password"
                  className="block border rounded p-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                className="mt-3 text-red-700"
                disabled={busy || !password}
                onClick={() => {
                  if (window.confirm("Xóa hoặc gửi yêu cầu xóa tài khoản này?"))
                    void act(() => deleteAccount(password));
                }}
              >
                Xóa tài khoản
              </button>
            </details>
          </>
        )}
        <footer className="space-x-4 text-sm">
          <a href="/privacy-policy" className="underline">
            Chính sách bảo mật
          </a>
          <a href="/terms-of-service" className="underline">
            Điều khoản
          </a>
        </footer>
      </div>
    </main>
  );
}
