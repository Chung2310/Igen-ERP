import React from "react";
import { Star } from "lucide-react";
import { assistantService } from "../../services/assistantService";
import { cn } from "../../modules/student-management/lib/utils";
import type { AssistantChatMessage } from "../../shared/assistant-document";
import { ErpModal } from "../../modules/student-management/components/Erp/ErpUI";

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function AssistantAnswerFeedback({
  conversationId,
  answerAt,
  branchId,
  initialFeedback,
}: {
  conversationId: string;
  answerAt: string;
  branchId: string;
  initialFeedback?: AssistantChatMessage["feedback"];
}) {
  const inputId = React.useId();
  const labelId = `${inputId}-label`;
  const commentId = `${inputId}-comment`;
  const commentHelpId = `${inputId}-comment-help`;
  const errorId = `${inputId}-error`;
  const [rating, setRating] = React.useState(initialFeedback?.rating || 0);
  const [comment, setComment] = React.useState(initialFeedback?.comment || "");
  const [savedRating, setSavedRating] = React.useState(initialFeedback?.rating || 0);
  const [savedComment, setSavedComment] = React.useState(initialFeedback?.comment || "");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const chooseRating = (value: number) => {
    setRating(value);
    setComment(savedComment);
    setError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setRating(savedRating);
    setComment(savedComment);
    setError("");
    setDialogOpen(false);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating || saving) return;
    if (!comment.trim()) {
      setError("Vui lòng ghi lý do đánh giá.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await assistantService.submitAnswerFeedback(conversationId, answerAt, rating, comment.trim(), branchId);
      setSavedRating(rating);
      setSavedComment(comment.trim());
      setComment(comment.trim());
      setDialogOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu đánh giá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return <section aria-label="Đánh giá câu trả lời" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-on-surface-variant">
    <span id={labelId} className="font-medium">Câu trả lời hữu ích?</span>
    <div role="group" aria-labelledby={labelId} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(value => <button
        key={value}
        type="button"
        aria-label={`Đánh giá ${value} trên 5 sao`}
        aria-pressed={rating === value}
        disabled={saving}
        onClick={() => chooseRating(value)}
        className={cn("grid size-8 place-items-center rounded-md hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-50", focusClass)}
      ><Star aria-hidden="true" className={cn("size-4", rating >= value ? "fill-primary text-primary" : "text-on-surface-variant")} /></button>)}
    </div>
    {savedRating > 0 && <>
      <span role="status" className="text-on-surface-variant">Đã lưu đánh giá {savedRating}/5 sao.</span>
      <button type="button" onClick={() => chooseRating(savedRating)} className={cn("rounded px-1 py-1 text-primary underline underline-offset-2", focusClass)}>Sửa đánh giá</button>
    </>}
    <ErpModal isOpen={dialogOpen} native title="Gửi đánh giá câu trả lời" onClose={closeDialog} closeDisabled={saving} maxWidth="max-w-md">
      <form onSubmit={event => void save(event)} className="space-y-4">
        <p className="text-pretty text-sm text-on-surface-variant">Bạn đã chọn {rating}/5 sao. Hãy ghi lý do để gửi đánh giá.</p>
        <div className="space-y-1.5">
          <label htmlFor={commentId} className="block text-sm font-medium text-on-surface">Lý do đánh giá <span className="text-error">(bắt buộc)</span></label>
          <textarea
            id={commentId}
            value={comment}
            onChange={event => setComment(event.target.value)}
            maxLength={1000}
            rows={4}
            required
            aria-describedby={`${commentHelpId}${error ? ` ${errorId}` : ""}`}
            aria-invalid={Boolean(error)}
            disabled={saving}
            placeholder="Cho biết điều gì khiến bạn chọn số sao này"
            className="w-full resize-y rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:opacity-60"
          />
          <p id={commentHelpId} className="text-xs text-on-surface-variant">Tối đa 1.000 ký tự.</p>
          {error && <p id={errorId} role="alert" className="text-pretty text-sm text-error">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" disabled={saving} onClick={closeDialog} className={cn("min-h-9 rounded-md border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50", focusClass)}>Hủy</button>
          <button type="submit" disabled={saving} className={cn("min-h-9 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60", focusClass)}>{saving ? "Đang gửi…" : "Gửi đánh giá"}</button>
        </div>
      </form>
    </ErpModal>
  </section>;
}
