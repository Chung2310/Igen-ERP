import { useState } from "react";
import { Copy, Pencil, Share2 } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";

export function AssistantMessageActions({ content }: { content: string }) {
  const [feedback, setFeedback] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  async function copyReplyToClipboard() {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API không khả dụng.");
    await navigator.clipboard.writeText(content);
  }

  async function copyReply() {
    setFeedback("");
    try {
      await copyReplyToClipboard();
      setFeedbackIsError(false);
      setFeedback("Đã sao chép câu trả lời.");
    } catch {
      setFeedbackIsError(true);
      setFeedback("Không thể sao chép câu trả lời. Vui lòng thử lại.");
    }
  }

  async function shareReply() {
    setFeedback("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: content });
        setFeedbackIsError(false);
        setFeedback("Đã chia sẻ câu trả lời.");
        return;
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
    }

    try {
      await copyReplyToClipboard();
      setFeedbackIsError(false);
      setFeedback("Đã sao chép câu trả lời để bạn dán chia sẻ.");
    } catch {
      setFeedbackIsError(true);
      setFeedback("Không thể chia sẻ hoặc sao chép câu trả lời. Vui lòng thử lại.");
    }
  }

  return <div className="assistant-ai-message-actions mt-1 flex w-full items-center justify-start gap-1 transition-opacity motion-reduce:transition-none">
    <button type="button" aria-label="Sao chép câu trả lời" title="Sao chép" onClick={() => void copyReply()}
      className={cn("grid size-8 place-items-center rounded-md bg-transparent text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface", focusClass)}>
      <Copy className="size-4" aria-hidden="true" />
    </button>
    <button type="button" aria-label="Chia sẻ câu trả lời" title="Chia sẻ" onClick={() => void shareReply()}
      className={cn("grid size-8 place-items-center rounded-md bg-transparent text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface", focusClass)}>
      <Share2 className="size-4" aria-hidden="true" />
    </button>
    {feedback && <span role={feedbackIsError ? "alert" : "status"} className="max-w-48 text-pretty text-xs text-on-surface-variant">{feedback}</span>}
  </div>;
}

export function AssistantUserMessageActions({ content, onEdit, editDisabled = false }: { content: string; onEdit: () => void; editDisabled?: boolean }) {
  const [feedback, setFeedback] = useState("");

  async function copyRequestToClipboard() {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API không khả dụng.");
    await navigator.clipboard.writeText(content);
  }

  async function copyRequest() {
    try {
      await copyRequestToClipboard();
      setFeedback("Đã sao chép yêu cầu.");
    } catch {
      setFeedback("Không thể sao chép yêu cầu. Vui lòng thử lại.");
    }
  }

  async function shareRequest() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: content });
        setFeedback("Đã chia sẻ yêu cầu.");
        return;
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
    }

    try {
      await copyRequestToClipboard();
      setFeedback("Đã sao chép yêu cầu để bạn dán chia sẻ.");
    } catch {
      setFeedback("Không mở được chia sẻ hoặc sao chép yêu cầu. Vui lòng thử lại.");
    }
  }

  return <div className="assistant-user-message-actions mt-1 flex w-full items-center justify-end gap-1 transition-opacity motion-reduce:transition-none">
    <button type="button" aria-label="Sao chép yêu cầu" title="Sao chép" onClick={() => void copyRequest()}
      className={cn("grid size-8 place-items-center rounded-md bg-transparent text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface", focusClass)}>
      <Copy className="size-4" aria-hidden="true" />
    </button>
    <button type="button" aria-label="Sửa yêu cầu" title={editDisabled ? "Không thể sửa yêu cầu khi đang xem phiên cũ hoặc trợ lý đang xử lý" : "Sửa yêu cầu"} disabled={editDisabled} onClick={() => { setFeedback(""); onEdit(); }}
      className={cn("grid size-8 place-items-center rounded-md bg-transparent text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
      <Pencil className="size-4" aria-hidden="true" />
    </button>
    <button type="button" aria-label="Chia sẻ yêu cầu" title="Chia sẻ" onClick={() => void shareRequest()}
      className={cn("grid size-8 place-items-center rounded-md bg-transparent text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface", focusClass)}>
      <Share2 className="size-4" aria-hidden="true" />
    </button>
    {feedback && <span role="status" className="max-w-40 text-right text-xs text-on-surface-variant">{feedback}</span>}
  </div>;
}
