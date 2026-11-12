import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { assistantService } from "../../services/assistantService";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { HrEmptyIllustration } from "../hr/HrEmptyIllustration";
import { cn } from "../../modules/student-management/lib/utils";

type ExplanationLevel = "Đơn giản" | "Trung bình" | "Chuyên sâu";
type ExplanationTurn = { question: string; answer: string; sourceUrls: string[] };

const levels: ExplanationLevel[] = ["Đơn giản", "Trung bình", "Chuyên sâu"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function explanationPrompt(formula: string, dataDescription: string, level: ExplanationLevel): string {
  return [
    "Hãy giải thích công thức Excel sau bằng tiếng Việt, dựa trên thông tin người dùng cung cấp.",
    `Công thức hoặc tên hàm: ${formula}`,
    `Mô tả dữ liệu: ${dataDescription || "Người dùng chưa cung cấp."}`,
    `Mức độ giải thích: ${level}.`,
    "Giải thích từng thành phần, cách công thức hoạt động, ví dụ ngắn phù hợp với dữ liệu đã mô tả và lỗi thường gặp. Nếu chỉ có tên hàm hoặc thiếu ngữ cảnh, hãy nêu giả định rõ ràng và hỏi thêm điều cần thiết. Không bịa giá trị dữ liệu.",
  ].join("\n");
}

export function AssistantExcelExplainer({ branchId, onBack }: { branchId: string; onBack: () => void }) {
  const [formula, setFormula] = useState("");
  const [dataDescription, setDataDescription] = useState("");
  const [level, setLevel] = useState<ExplanationLevel>("Đơn giản");
  const [followUp, setFollowUp] = useState("");
  const [turns, setTurns] = useState<ExplanationTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversationIdRef = useRef(crypto.randomUUID());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const ask = async (question: string, newExplanation: boolean) => {
    if (busy) return;
    const conversationId = newExplanation ? crypto.randomUUID() : conversationIdRef.current;
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    if (newExplanation) {
      conversationIdRef.current = conversationId;
      setTurns([]);
    }
    setBusy(true);
    setError("");
    try {
      let reply = await assistantService.turn({ conversationId, requestId, mode: "qa", text: question }, controller.signal, branchId);
      for (let attempt = 0; reply.status === "processing" && attempt < 100 && !controller.signal.aborted; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (controller.signal.aborted) return;
        reply = await assistantService.turn({ conversationId, requestId, mode: "qa", text: question }, controller.signal, branchId);
      }
      if (controller.signal.aborted) return;
      if (reply.status === "processing") throw new Error("Yêu cầu vẫn đang xử lý. Bạn thử lại sau nhé.");
      if (reply.status === "failed" || reply.status === "unsupported") throw new Error(reply.reply);
      setTurns(current => [...current, { question, answer: reply.reply, sourceUrls: reply.sources?.map(source => source.url) ?? [] }]);
      setFollowUp("");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể giải thích công thức lúc này.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const explain = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = formula.trim();
    if (!value) return;
    void ask(explanationPrompt(value, dataDescription.trim(), level), true);
  };

  const askFollowUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = followUp.trim();
    if (!value) return;
    void ask(value, false);
  };

  return <section aria-labelledby="excel-explainer-title" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex shrink-0 items-center gap-1 border-b border-outline-variant px-4 py-3 sm:px-6">
      <button type="button" onClick={onBack} aria-label="Quay lại danh sách công cụ" className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container-low", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" /></button>
      <h3 id="excel-explainer-title" className="text-balance text-lg font-semibold">Giải thích công thức Excel</h3>
    </header>
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
      <form onSubmit={explain} className="flex min-w-0 flex-col gap-5 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto">
        <label className="block text-sm font-medium">Công thức cần giải thích <span aria-hidden="true" className="text-primary">*</span>
          <textarea required value={formula} onChange={event => setFormula(event.target.value)} disabled={busy} rows={6} placeholder="Nhập tên hàm hoặc công thức cụ thể cần giải thích" className="mt-2 block w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-normal text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none disabled:opacity-60" />
        </label>
        <label className="block text-sm font-medium">Mô tả dữ liệu
          <textarea value={dataDescription} onChange={event => setDataDescription(event.target.value)} disabled={busy} rows={5} placeholder="Ví dụ: cột A là đơn hàng, cột B là giá trị đơn hàng" className="mt-2 block w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-normal text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none disabled:opacity-60" />
        </label>
        <fieldset disabled={busy}>
          <legend className="text-sm font-medium">Mức độ giải thích</legend>
          <div className="mt-2 flex flex-wrap gap-2">{levels.map(item => <label key={item} className={cn("cursor-pointer rounded-full border border-outline-variant px-3 py-1.5 text-sm focus-within:border-primary", level === item && "border-primary bg-primary/10 text-primary")}>
            <input type="radio" name="explanation-level" value={item} checked={level === item} onChange={() => setLevel(item)} className="sr-only" />{item}
          </label>)}</div>
        </fieldset>
        <button type="submit" disabled={busy} className={cn("self-start rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{busy ? "Đang giải thích…" : "Giải thích"}</button>
        {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
      </form>
      <section aria-label="Kết quả giải thích" aria-busy={busy} className="flex min-h-72 min-w-0 flex-col border-t border-outline-variant p-4 sm:p-6 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <h4 className="text-balance text-base font-semibold">Kết quả</h4>
        {turns.length === 0 && !busy && <div className="mt-4 flex min-h-56 flex-1 flex-col items-center justify-center rounded-xl bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
          <HrEmptyIllustration kind="search" />
          <p className="mt-1 text-pretty">Nội dung giải thích sẽ xuất hiện ở đây.</p>
        </div>}
        {busy && <p role="status" className="mt-4 text-sm text-on-surface-variant">Đang hỏi trợ lý AI…</p>}
        {turns.length > 0 && <div className="mt-4 space-y-6 text-sm leading-6">{turns.map((turn, index) => <div key={index} className="space-y-2">
          {index > 0 && <p className="text-pretty font-medium text-on-surface">{turn.question}</p>}
          <AssistantMessageContent content={turn.answer} allowedLinkUrls={turn.sourceUrls} />
        </div>)}</div>}
        {turns.length > 0 && <form onSubmit={askFollowUp} className="mt-6 flex gap-2 border-t border-outline-variant pt-4">
          <label className="min-w-0 flex-1"><span className="sr-only">Hỏi thêm về công thức này</span><input required value={followUp} onChange={event => setFollowUp(event.target.value)} disabled={busy} placeholder="Hỏi thêm về công thức này" className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none disabled:opacity-60" /></label>
          <button type="submit" disabled={busy} aria-label="Gửi câu hỏi tiếp theo" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><SendHorizontal className="size-4" aria-hidden="true" /></button>
        </form>}
      </section>
    </div>
  </section>;
}
