import { useState } from "react";
import { api, hasQuotationCapability } from "./api";
import type { Quote } from "./types";
import type { ConfirmOptions } from "./Feedback";

export default function EstimateRegeneration({ quote, answers, hasOtherChanges, busy, confirm, onBusy, onUpdated }: {
  quote: Quote; answers: Record<string, string>; hasOtherChanges: boolean; busy: boolean;
  confirm: (options: ConfirmOptions) => Promise<boolean>; onBusy: (busy: boolean) => void; onUpdated: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const canUseAi = hasQuotationCapability("quotation-ai:manage");
  const hasAnswers = Object.values(answers).some(answer => answer.trim());
  const regenerate = async () => {
    if (busy || !canUseAi || !hasAnswers || hasOtherChanges) return;
    if (!await confirm({ title: "Tạo lại dự toán từ câu trả lời?", message: "AI sẽ dùng câu trả lời để điều chỉnh hạng mục và số lượng trên bản nháp này. Sản phẩm không đổi quy cách giữ đơn giá đã lưu; sản phẩm mới hoặc đổi quy cách cần bổ sung giá. VAT và phí vận chuyển được giữ nguyên. Thao tác sử dụng lượt AI.", confirmLabel: "Tạo lại dự toán" })) return;
    setError(""); onBusy(true);
    try {
      await api(`/api/quotes/${quote._id}/recalculate`, { method: "POST", headers: { "If-Unmodified-Since": quote.updatedAt }, body: JSON.stringify({ additionalInformation: answers }) });
      await onUpdated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa tạo lại được dự toán. Câu trả lời đang nhập được giữ nguyên."); }
    finally { onBusy(false); }
  };
  const hint = !canUseAi ? "Bạn cần quyền sử dụng AI để tạo lại dự toán." : hasOtherChanges ? "Hãy lưu các thay đổi ở sản phẩm và điều khoản trước khi tạo lại. Câu trả lời đang nhập sẽ được gửi cùng yêu cầu." : !hasAnswers ? "Trả lời ít nhất một câu hỏi bổ sung để AI điều chỉnh dự toán." : "AI dùng câu trả lời đang nhập để điều chỉnh dự toán. Kiểm tra lại kết quả trước khi gửi duyệt.";
  return <div className="page-stack" aria-busy={busy}>
    <div><button type="button" className="button button-soft" disabled={busy || !canUseAi || !hasAnswers || hasOtherChanges} aria-describedby={`regenerate-hint-${quote._id}`} onClick={() => void regenerate()}>{busy ? "Đang tạo lại dự toán…" : "Tạo lại dự toán từ câu trả lời"}</button></div>
    <p id={`regenerate-hint-${quote._id}`} className="field-hint">{hint}</p>
    {error && <p className="estimate-from-quote-error" role="alert">{error}</p>}
  </div>;
}
