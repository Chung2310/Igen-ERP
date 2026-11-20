import { AI_CREDITS_ENABLED } from "../../shared/features";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { companyWalletService } from "../services/companyWalletService";
import type { CompanyWalletState } from "../../shared/ai-access";
function CompanyWalletPageContent() {
  const { userProfile } = useAuth();
  const [state, setState] = useState<CompanyWalletState | null>(null);
  const [amount, setAmount] = useState("100000");
  const [deposit, setDeposit] = useState<{ orderCode: number; checkoutUrl: string; bankTransfer?: { qrUrl?: string; transferContent?: string; amountVND: number } } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => companyWalletService.status().then(setState).catch((e) => setError(e.message));
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, []);
  if (userProfile?.role !== "admin" || !userProfile.companyCode) return <main className="p-6">Bạn không có quyền xem ví công ty.</main>;
  async function createDeposit() {
    if (busy) return;
    setBusy(true); setError("");
    try { setDeposit(await companyWalletService.deposit(Number(amount))); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-dvh bg-slate-50 p-5 text-slate-900"><div className="mx-auto max-w-3xl space-y-5">
    <a href="/" className="underline">Quay lại doanh nghiệp</a>
    <h1 className="text-2xl font-semibold">Ví Credit công ty {userProfile.companyCode}</h1>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="rounded-xl border bg-white p-5"><p>Số dư: <strong>{state?.balance.toLocaleString("vi-VN") ?? "..."} Credit</strong></p>
      <p className="mt-2 text-sm text-slate-600">AI của nhân viên trong công ty trừ Credit tại ví này. Số dư cũ ở ví cá nhân vẫn được lưu riêng.</p>
      <label className="mt-4 block">Số tiền nạp (VND)<input type="number" min={2000} max={100000000} value={amount}
        onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label>
      <button disabled={busy} onClick={() => void createDeposit()} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Tạo yêu cầu nạp</button>
      {deposit && <div className="mt-4 space-y-2 rounded-lg border p-4">
        <p>Mã giao dịch: {deposit.orderCode}</p>
        {deposit.bankTransfer ? <><p>Chuyển đúng số tiền {deposit.bankTransfer.amountVND.toLocaleString("vi-VN")} VND, nội dung: {deposit.bankTransfer.transferContent}</p>
          {deposit.bankTransfer.qrUrl && <img src={deposit.bankTransfer.qrUrl} alt="Mã QR chuyển khoản công ty" className="max-w-52" />}</>
          : <a href={deposit.checkoutUrl} className="underline" rel="noopener noreferrer">Mở trang thanh toán</a>}
        <button onClick={() => void load()} className="block rounded-lg border p-2">Kiểm tra số dư</button>
      </div>}
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Giao dịch gần đây</h2>
      {state?.transactions.map((row) => <p key={row._id} className="border-b py-2 text-sm">
        {new Date(row.createdAt).toLocaleString("vi-VN")} · {row.type} · {row.amount.toLocaleString("vi-VN")} Credit · {row.status} · {row.description}
      </p>)}</section>
  </div></main>;
}

export default function CompanyWalletPage() {
  return AI_CREDITS_ENABLED ? <CompanyWalletPageContent /> : <main className="p-6">Tính năng này đang tạm ngừng.</main>;
}
