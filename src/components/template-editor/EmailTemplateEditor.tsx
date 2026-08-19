import React from "react";
import { Eye, ImagePlus, Pencil } from "lucide-react";
import type { TemplateVariableConfig } from "./templateEditorTypes";
import { fillSampleValues } from "./templateTokenCodec";
import TemplateVariablePalette, { TEMPLATE_VARIABLE_MIME } from "./TemplateVariablePalette";

type Props = {
  subject: string;
  html: string;
  variables: TemplateVariableConfig[];
  disabled: boolean;
  onChange: (values: { subject?: string; html?: string }) => void;
  onUploadImage?: () => Promise<{ url: string; uploadToken?: string } | null>;
  uploadImageLabel?: string;
  bodyLabel?: string;
  previewCopy?: string;
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const rawToEditorHtml = (raw: string, variables: TemplateVariableConfig[]) => {
  const labelsByKey = new Map(variables.map((variable) => [variable.key, variable.label]));
  const pieces: string[] = [];
  let lastIndex = 0;

  String(raw).replace(/{{\s*([a-zA-Z]+)\s*}}/g, (match, key: string, index: number) => {
    const text = raw.slice(lastIndex, index);
    if (text) pieces.push(escapeHtml(text).replaceAll("\n", "<br />"));
    const label = labelsByKey.get(key);
    pieces.push(label
      ? `<span data-token="${escapeHtml(key)}" contenteditable="false" class="mx-0.5 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">[${escapeHtml(label)}]</span>`
      : escapeHtml(match));
    lastIndex = index + match.length;
    return match;
  });

  const tail = raw.slice(lastIndex);
  if (tail) pieces.push(escapeHtml(tail).replaceAll("\n", "<br />"));
  return pieces.join("");
};

const serializeNode = (node: ChildNode): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.token) return `{{${node.dataset.token}}}`;
  if (node.tagName === "BR") return "\n";
  const text = Array.from(node.childNodes).map(serializeNode).join("");
  return /^(DIV|P)$/.test(node.tagName) ? `${text}\n` : text;
};

const serializeEditor = (element: HTMLElement | null) =>
  String(element ? Array.from(element.childNodes).map(serializeNode).join("") : "").replace(/\n+$/, "");

export default function EmailTemplateEditor({
  subject,
  html,
  variables,
  disabled,
  onChange,
  onUploadImage,
  uploadImageLabel = "Tải ảnh",
  bodyLabel = "Nội dung",
  previewCopy = "Đây là bản xem thử với dữ liệu mẫu. Khi gửi thật, hệ thống điền thông tin của từng người nhận.",
}: Props) {
  const [preview, setPreview] = React.useState(false);
  const [target, setTarget] = React.useState<"subject" | "html">("html");
  const [uploading, setUploading] = React.useState(false);
  const subjectRef = React.useRef<HTMLDivElement>(null);
  const htmlRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (subjectRef.current && document.activeElement !== subjectRef.current) {
      subjectRef.current.innerHTML = rawToEditorHtml(subject, variables);
    }
  }, [subject, variables]);

  React.useEffect(() => {
    if (htmlRef.current && document.activeElement !== htmlRef.current) {
      htmlRef.current.innerHTML = rawToEditorHtml(html, variables);
    }
  }, [html, variables]);

  const moveCaretToEnd = (element: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const emit = (name: "subject" | "html", element: HTMLDivElement | null) => {
    const raw = serializeEditor(element);
    onChange(name === "subject" ? { subject: raw } : { html: raw });
  };

  const insertTextAtCaret = (editor: HTMLElement, value: string) => {
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      editor.innerHTML = `${editor.innerHTML}${escapeHtml(value)}`;
      moveCaretToEnd(editor);
      return;
    }

    selection.deleteFromDocument();
    const range = selection.getRangeAt(0);
    range.insertNode(document.createTextNode(value));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const insertToken = (name: "subject" | "html", key: string) => {
    if (disabled) return;
    const editor = name === "subject" ? subjectRef.current : htmlRef.current;
    if (!editor) return;
    const currentRaw = serializeEditor(editor);
    const nextRaw = `${currentRaw}{{${key}}}`;
    editor.innerHTML = rawToEditorHtml(nextRaw, variables);
    moveCaretToEnd(editor);
    onChange(name === "subject" ? { subject: nextRaw } : { html: nextRaw });
  };

  const handleDrop = (name: "subject" | "html", event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const key = event.dataTransfer.getData(TEMPLATE_VARIABLE_MIME);
    if (!key) return;
    setTarget(name);
    insertToken(name, key);
  };

  const handleUploadImage = async () => {
    if (!onUploadImage || disabled || uploading || !htmlRef.current) return;

    setTarget("html");
    try {
      setUploading(true);
      const result = await onUploadImage();
      if (!result) return;
      insertTextAtCaret(htmlRef.current, result.url);
      emit("html", htmlRef.current);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">Nội dung tin nhắn</p>
        <button
          type="button"
          onClick={() => setPreview((current) => !current)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? "Quay lại soạn" : "Xem trước"}
        </button>
      </div>

      {preview ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] uppercase text-slate-400">Tiêu đề</p>
          <p className="font-semibold text-slate-800">{fillSampleValues(subject, variables)}</p>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="text-[11px] uppercase text-slate-400">{bodyLabel}</p>
            <div className="prose-sm mt-1 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: fillSampleValues(html, variables) }} />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">{previewCopy}</p>
        </div>
      ) : (
        <>
          <label className="mt-2 block text-xs font-semibold text-slate-600">
            Tiêu đề
            <div
              ref={subjectRef}
              role="textbox"
              aria-label="Tiêu đề"
              aria-multiline="false"
              contentEditable={!disabled}
              suppressContentEditableWarning
              onFocus={() => {
                setTarget("subject");
                if (subjectRef.current) moveCaretToEnd(subjectRef.current);
              }}
              onInput={() => emit("subject", subjectRef.current)}
              onDrop={(event) => handleDrop("subject", event)}
              onDragOver={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="mt-2 block text-xs font-semibold text-slate-600">
            {bodyLabel}
            <div
              ref={htmlRef}
              role="textbox"
              aria-label={bodyLabel}
              aria-multiline="true"
              contentEditable={!disabled}
              suppressContentEditableWarning
              onFocus={() => {
                setTarget("html");
                if (htmlRef.current) moveCaretToEnd(htmlRef.current);
              }}
              onInput={() => emit("html", htmlRef.current)}
              onDrop={(event) => handleDrop("html", event)}
              onDragOver={(event) => event.preventDefault()}
              className="mt-1 min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            />
          </label>

          {onUploadImage ? (
            <button
              type="button"
              onClick={handleUploadImage}
              disabled={disabled || uploading}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {uploading ? "Đang tải..." : uploadImageLabel}
            </button>
          ) : null}

          <TemplateVariablePalette
            variables={variables}
            disabled={disabled}
            activeTarget={target}
            onInsert={(key) => insertToken(target, key)}
          />
        </>
      )}
    </div>
  );
}
