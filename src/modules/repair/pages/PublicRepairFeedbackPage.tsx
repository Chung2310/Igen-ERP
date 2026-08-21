import React from "react";

type RepairFeedbackTicket = {
  ticketCode: string;
  deviceName?: string;
  completedAt?: string;
  technicianName?: string;
};

function feedbackTokenFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/repair\/feedback\/([^/?#]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function responseMessage(payload: any, fallback: string) {
  return String(payload?.message || payload?.error || fallback);
}

export default function PublicRepairFeedbackPage() {
  const token = feedbackTokenFromPath();
  const [ticket, setTicket] = React.useState<RepairFeedbackTicket | null>(null);
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [loading, setLoading] = React.useState(Boolean(token));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(token ? "" : "Liên kết đánh giá không hợp lệ.");
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`/api/v1/repair/feedback/${encodeURIComponent(token)}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(responseMessage(payload, "Không thể tải thông tin phiếu sửa chữa."));
        if (active) setTicket(payload.data);
      } catch (requestError: any) {
        if (active) setError(String(requestError?.message || "Không thể tải thông tin phiếu sửa chữa."));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || rating < 1 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/repair/feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(responseMessage(payload, "Không thể gửi đánh giá."));
      setSubmitted(true);
    } catch (requestError: any) {
      setError(String(requestError?.message || "Không thể gửi đánh giá."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-800">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Phản hồi sửa chữa</p>
        <h1 className="mt-2 text-2xl font-black">Đánh giá dịch vụ</h1>

        {loading ? <p className="mt-5 text-sm text-slate-500">Đang tải thông tin phiếu sửa chữa...</p> : null}
        {!loading && error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
        {!loading && submitted ? <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cảm ơn bạn đã đánh giá!</p> : null}

        {!loading && ticket && !submitted ? (
          <form className="mt-6 space-y-6" onSubmit={submit}>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm">
              <p className="font-bold text-slate-900">{ticket.ticketCode}</p>
              {ticket.deviceName ? <p className="mt-1 text-slate-600">Thiết bị: {ticket.deviceName}</p> : null}
              {ticket.technicianName ? <p className="mt-1 text-slate-600">Kỹ thuật viên: {ticket.technicianName}</p> : null}
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-slate-800">Mức độ hài lòng</legend>
              <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Mức độ hài lòng">
                {[1, 2, 3, 4, 5].map((score) => (
                  <label key={score} className="cursor-pointer">
                    <input className="sr-only" type="radio" name="rating" value={score} checked={rating === score} onChange={() => setRating(score)} />
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black ${rating >= score ? "border-amber-400 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-400"}`} aria-hidden="true">★</span>
                    <span className="sr-only">{score} sao</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-bold text-slate-800">
              Nhận xét (không bắt buộc)
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" placeholder="Chia sẻ trải nghiệm của bạn" />
            </label>

            <button type="submit" disabled={rating < 1 || submitting} className="w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
