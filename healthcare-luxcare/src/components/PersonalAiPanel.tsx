import { errorDetails } from "../../shared/error-details";
import { AiSharingNotice } from "./AiSharingNotice";
import { useAiSharing } from "../hooks/useAiSharing";
import { useAuth } from "../context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { aiAccessService } from "../services/aiAccessService";
import type { PersonalAiMessage, PersonalAiStatus } from "../../shared/ai-access";
const when = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";
export default function PersonalAiPanel() {
  const { userProfile } = useAuth();
  const sharing = useAiSharing("personal", userProfile?.uid || "");
  const [quota, setQuota] = useState<PersonalAiStatus | null>(null);
  const [history, setHistory] = useState<PersonalAiMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const key = useRef<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all([aiAccessService.status(), aiAccessService.history()])
      .then(([status, rows]) => {
        if (live) {
          setQuota(status);
          setHistory(rows);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function send() {
    if (!sharing.accepted || busy || question.trim().length < 2) return;
    setBusy(true);
    setError("");
    if (!key.current) key.current = crypto.randomUUID();
    try {
      const submitted = question.trim();
      const result = await aiAccessService.ask(submitted, key.current);
      setQuota(result.status);
      setHistory((previous) =>
        [
          { id: key.current!, question: submitted, answer: result.answer, createdAt: new Date().toISOString() },
          ...previous,
        ].slice(0, 30),
      );
      setQuestion("");
      key.current = null;
      setBlockedUntil(null);
    } catch (error: unknown) {
      const failure = errorDetails(error);
      if (failure.code === "AI_CONSENT_REQUIRED") sharing.refresh();
      setError(failure.message || "Không thể hoàn tất yêu cầu AI.");
      setBlockedUntil(failure.resetAt || null);
      if (failure.status) key.current = null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Trợ lý AI cá nhân</h2>
      <p className="text-sm text-slate-600">
        Bạn có thể hỏi về kiến thức chung và công việc sau khi xác minh email. Trợ lý không truy cập dữ liệu doanh
        nghiệp.
      </p>
      {quota && (
        <p className="text-sm">
          Lượt còn lại: {quota.remaining.hour}/{quota.limits.hour} trong 60 phút · {quota.remaining.day}/
          {quota.limits.day} hôm nay · {quota.remaining.month}/{quota.limits.month} tháng này.
        </p>
      )}
      {quota?.resetAt && new Date(quota.resetAt).getTime() > clock && (
        <p className="text-sm text-amber-800">Đã hết lượt. Sử dụng lại sau {when(quota.resetAt)}.</p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-800">
          {error}
          {blockedUntil ? ` Sử dụng lại sau ${when(blockedUntil)}.` : ""}
        </p>
      )}
      <AiSharingNotice sharing={sharing} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="space-y-2"
      >
        <label htmlFor="personal-ai-question" className="block font-medium">
          Câu hỏi của bạn
        </label>
        <textarea
          id="personal-ai-question"
          className="min-h-24 w-full rounded-lg border p-3"
          maxLength={1200}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            key.current = null;
          }}
          placeholder="Nhập câu hỏi..."
        />
        <button
          disabled={
            !sharing.accepted ||
            busy ||
            question.trim().length < 2 ||
            Boolean(
              (quota?.resetAt && new Date(quota.resetAt).getTime() > clock) ||
              (blockedUntil && new Date(blockedUntil).getTime() > clock),
            )
          }
          className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "Đang trả lời…" : "Gửi câu hỏi"}
        </button>
      </form>
      {history.map((row) => (
        <article key={row.id} className="rounded-lg border p-3">
          <p className="text-xs text-slate-500">{when(row.createdAt)}</p>
          <p className="mt-1 font-semibold whitespace-pre-wrap">{row.question}</p>
          <p className="mt-2 whitespace-pre-wrap">{row.answer}</p>
        </article>
      ))}
    </section>
  );
}
