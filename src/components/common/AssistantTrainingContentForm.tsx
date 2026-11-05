import { useId, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AssistantTrainingContentForm as TrainingContent, AssistantTrainingLessonAnswer, AssistantTrainingQuizAnswer } from "../../shared/assistant-workflow";
import { cn } from "../../modules/student-management/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const inputClass = cn("min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface placeholder:text-on-surface/50", focusClass);
const actionClass = cn("inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm font-medium hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass);

const blankLesson = (): AssistantTrainingLessonAnswer => ({ title: "", type: "text", url: "", content: "" });
const blankQuiz = (): AssistantTrainingQuizAnswer => ({ question: "", options: ["", ""], correctOptionIndex: -1 });

function initialLessons(value: TrainingContent["lessons"]): AssistantTrainingLessonAnswer[] {
  return value.length ? value.map(lesson => ({ ...lesson })) : [blankLesson()];
}
function initialQuizzes(value: TrainingContent["quizzes"]): AssistantTrainingQuizAnswer[] {
  return value.length ? value.map(quiz => ({ ...quiz, options: [...quiz.options] })) : [blankQuiz()];
}

export function AssistantTrainingContentForm({
  value,
  readOnly,
  submitting,
  canSubmit,
  onSubmit,
}: {
  value: TrainingContent;
  readOnly: boolean;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (content: TrainingContent) => void;
}) {
  const formId = useId();
  const [lessons, setLessons] = useState(() => initialLessons(value.lessons));
  const [quizzes, setQuizzes] = useState(() => initialQuizzes(value.quizzes));
  const [skipLessons, setSkipLessons] = useState(false);
  const [skipQuizzes, setSkipQuizzes] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateLesson = (index: number, patch: Partial<AssistantTrainingLessonAnswer>) => {
    setLessons(current => current.map((lesson, itemIndex) => itemIndex === index ? { ...lesson, ...patch } : lesson));
    setErrors([]);
  };
  const updateQuiz = (index: number, patch: Partial<AssistantTrainingQuizAnswer>) => {
    setQuizzes(current => current.map((quiz, itemIndex) => itemIndex === index ? { ...quiz, ...patch } : quiz));
    setErrors([]);
  };
  const updateOption = (quizIndex: number, optionIndex: number, text: string) => {
    setQuizzes(current => current.map((quiz, itemIndex) => itemIndex === quizIndex
      ? { ...quiz, options: quiz.options.map((option, index) => index === optionIndex ? text : option) }
      : quiz));
    setErrors([]);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    const includedLessons = skipLessons ? [] : lessons;
    const includedQuizzes = skipQuizzes ? [] : quizzes;
    if (!skipLessons && !lessons.length) nextErrors.push("Thêm ít nhất một bài giảng hoặc chọn bỏ qua mục này.");
    includedLessons.forEach((lesson, index) => {
      if (!lesson.title.trim()) nextErrors.push(`Bài giảng ${index + 1}: vui lòng nhập tên.`);
      if (![lesson.url, lesson.content].some(item => item?.trim())) nextErrors.push(`Bài giảng ${index + 1}: nhập đường dẫn hoặc nội dung.`);
    });
    if (!skipQuizzes && !quizzes.length) nextErrors.push("Thêm ít nhất một câu hỏi hoặc chọn bỏ qua mục này.");
    includedQuizzes.forEach((quiz, index) => {
      if (!quiz.question.trim()) nextErrors.push(`Câu hỏi ${index + 1}: vui lòng nhập nội dung.`);
      if (quiz.options.length < 2 || quiz.options.length > 6) nextErrors.push(`Câu hỏi ${index + 1}: cần từ 2 đến 6 phương án.`);
      if (quiz.options.some(option => !option.trim())) nextErrors.push(`Câu hỏi ${index + 1}: vui lòng điền đủ phương án.`);
      if (quiz.correctOptionIndex < 0 || quiz.correctOptionIndex >= quiz.options.length) nextErrors.push(`Câu hỏi ${index + 1}: vui lòng chọn đáp án đúng.`);
    });
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);
    onSubmit({
      lessons: includedLessons.map(lesson => ({ ...lesson, title: lesson.title.trim(), url: lesson.url?.trim() || "", content: lesson.content?.trim() || "" })),
      quizzes: includedQuizzes.map(quiz => ({ ...quiz, question: quiz.question.trim(), options: quiz.options.map(option => option.trim()) })),
    });
  };

  return <form onSubmit={submit} noValidate aria-labelledby={`${formId}-title`} aria-busy={submitting} className="max-w-4xl space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm sm:p-4">
    <header>
      <h3 id={`${formId}-title`} className="text-balance font-semibold">Bổ sung bài giảng và câu hỏi</h3>
      <p className="mt-1 text-pretty text-xs text-on-surface/70">Điền trực tiếp tại đây. Mỗi danh sách có thể bỏ qua riêng; bạn sẽ xem lại nội dung trước khi xác nhận tạo khóa đào tạo.</p>
    </header>

    <fieldset disabled={readOnly || skipLessons} className="space-y-2 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 font-semibold">Bài giảng</legend>
      {lessons.map((lesson, index) => {
        const itemId = `${formId}-lesson-${index}`;
        return <div key={itemId} className="space-y-2 rounded-lg border border-outline-variant bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium">Bài giảng {index + 1}</h4>
            <button type="button" aria-label={`Xóa bài giảng ${index + 1}`} onClick={() => { setLessons(current => current.filter((_, itemIndex) => itemIndex !== index)); setErrors([]); }} className={cn(actionClass, "size-10 shrink-0 p-0")}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${itemId}-title`} className="font-medium">Tên bài giảng</label>
              <input id={`${itemId}-title`} value={lesson.title} maxLength={300} onChange={event => updateLesson(index, { title: event.target.value })} className={inputClass} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${itemId}-type`} className="font-medium">Loại bài giảng</label>
              <select id={`${itemId}-type`} value={lesson.type} onChange={event => updateLesson(index, { type: event.target.value as AssistantTrainingLessonAnswer["type"] })} className={inputClass}>
                <option value="text">Văn bản / tài liệu</option>
                <option value="video">Video</option>
                <option value="youtube">YouTube</option>
                <option value="document">Tài liệu</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${itemId}-url`} className="font-medium">Đường dẫn (nếu có)</label>
            <input id={`${itemId}-url`} type="url" value={lesson.url || ""} maxLength={2048} onChange={event => updateLesson(index, { url: event.target.value })} className={inputClass} placeholder="https://…" inputMode="url" autoComplete="url" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${itemId}-content`} className="font-medium">Nội dung bài giảng</label>
            <textarea id={`${itemId}-content`} value={lesson.content || ""} maxLength={10000} rows={3} onChange={event => updateLesson(index, { content: event.target.value })} className={cn(inputClass, "min-h-24 resize-y")} />
          </div>
          {lesson.fileName && <p className="break-words text-xs text-on-surface/70">Tệp đã gắn: {lesson.fileName}</p>}
        </div>;
      })}
      <button type="button" disabled={lessons.length >= 50} onClick={() => { setLessons(current => [...current, blankLesson()]); setErrors([]); }} className={actionClass}>
        <Plus className="size-4" aria-hidden="true" /> Thêm bài giảng
      </button>
    </fieldset>
    <label className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface px-2.5 py-2 hover:bg-surface-container-low", focusClass, readOnly && "cursor-not-allowed opacity-50")}>
      <input type="checkbox" checked={skipLessons} disabled={readOnly} onChange={event => { setSkipLessons(event.target.checked); setErrors([]); }} className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" />
      <span>Chưa có bài giảng, bỏ qua mục này</span>
    </label>

    <fieldset disabled={readOnly || skipQuizzes} className="space-y-2 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 font-semibold">Câu hỏi trắc nghiệm</legend>
      {quizzes.map((quiz, quizIndex) => {
        const itemId = `${formId}-quiz-${quizIndex}`;
        return <div key={itemId} className="space-y-2 rounded-lg border border-outline-variant bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium">Câu hỏi {quizIndex + 1}</h4>
            <button type="button" aria-label={`Xóa câu hỏi ${quizIndex + 1}`} onClick={() => { setQuizzes(current => current.filter((_, index) => index !== quizIndex)); setErrors([]); }} className={cn(actionClass, "size-10 shrink-0 p-0")}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${itemId}-question`} className="font-medium">Nội dung câu hỏi</label>
            <textarea id={`${itemId}-question`} value={quiz.question} maxLength={1000} rows={2} onChange={event => updateQuiz(quizIndex, { question: event.target.value })} className={cn(inputClass, "min-h-20 resize-y")} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Các phương án · chọn đáp án đúng</legend>
            {quiz.options.map((option, optionIndex) => {
              const optionId = `${itemId}-option-${optionIndex}`;
              return <div key={optionId} className="flex items-center gap-2">
                <input id={`${optionId}-correct`} type="radio" name={`${itemId}-correct`} aria-label={`Đáp án đúng: phương án ${optionIndex + 1}`} checked={quiz.correctOptionIndex === optionIndex} onChange={() => updateQuiz(quizIndex, { correctOptionIndex: optionIndex })} className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" />
                <label htmlFor={`${optionId}-text`} className="sr-only">Phương án {optionIndex + 1}</label>
                <input id={`${optionId}-text`} value={option} maxLength={500} onChange={event => updateOption(quizIndex, optionIndex, event.target.value)} className={cn(inputClass, "min-w-0 flex-1")} placeholder={`Phương án ${optionIndex + 1}`} />
                <button type="button" aria-label={`Xóa phương án ${optionIndex + 1} của câu hỏi ${quizIndex + 1}`} disabled={quiz.options.length <= 2} onClick={() => {
                  const options = quiz.options.filter((_, index) => index !== optionIndex);
                  const correctOptionIndex = quiz.correctOptionIndex === optionIndex ? 0 : quiz.correctOptionIndex > optionIndex ? quiz.correctOptionIndex - 1 : quiz.correctOptionIndex;
                  updateQuiz(quizIndex, { options, correctOptionIndex });
                }} className={cn(actionClass, "size-10 shrink-0 p-0")}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>;
            })}
            <button type="button" disabled={quiz.options.length >= 6} onClick={() => updateQuiz(quizIndex, { options: [...quiz.options, ""] })} className={actionClass}>
              <Plus className="size-4" aria-hidden="true" /> Thêm phương án
            </button>
          </fieldset>
        </div>;
      })}
      <button type="button" disabled={quizzes.length >= 50} onClick={() => { setQuizzes(current => [...current, blankQuiz()]); setErrors([]); }} className={actionClass}>
        <Plus className="size-4" aria-hidden="true" /> Thêm câu hỏi
      </button>
    </fieldset>
    <label className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface px-2.5 py-2 hover:bg-surface-container-low", focusClass, readOnly && "cursor-not-allowed opacity-50")}>
      <input type="checkbox" checked={skipQuizzes} disabled={readOnly} onChange={event => { setSkipQuizzes(event.target.checked); setErrors([]); }} className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" />
      <span>Chưa có câu hỏi, bỏ qua mục này</span>
    </label>

    {errors.length > 0 && <div role="alert" aria-live="assertive" className="space-y-1 rounded-lg border border-error/30 bg-error/5 p-3 text-error">
      {errors.map(error => <p key={error}>{error}</p>)}
    </div>}
    <button type="submit" disabled={readOnly || submitting || !canSubmit} className={cn("min-h-10 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
      {submitting ? "Đang gửi…" : !canSubmit ? "Đang đồng bộ phiên…" : "Gửi nội dung"}
    </button>
  </form>;
}
