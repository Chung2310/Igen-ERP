import React from "react";
import { Eye, ImagePlus, Pencil, Bold, Italic, Underline, List, ListOrdered, Eraser } from "lucide-react";
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

const rawToHtmlEditorHtml = (raw: string, variables: TemplateVariableConfig[]) => {
  const labelsByKey = new Map(variables.map((variable) => [variable.key, variable.label]));
  return String(raw || "").replace(/{{\s*([a-zA-Z]+)\s*}}/g, (match, key: string) => {
    const label = labelsByKey.get(key) || key;
    return `<span data-token="${escapeHtml(key)}" contenteditable="false" class="mx-0.5 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">[${escapeHtml(label)}]</span>`;
  });
};

const serializeHtmlNode = (node: ChildNode): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || "");
  }
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.token) {
    return `{{${node.dataset.token}}}`;
  }

  const tagName = node.tagName.toLowerCase();
  const childrenHtml = Array.from(node.childNodes).map(serializeHtmlNode).join("");

  if (tagName === "br") {
    return "<br />";
  }

  if (["p", "div", "span", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
    if (tagName === "a") {
      const href = node.getAttribute("href") || "";
      return `<a href="${escapeHtml(href)}">${childrenHtml}</a>`;
    }
    return `<${tagName}>${childrenHtml}</${tagName}>`;
  }

  return childrenHtml;
};

const serializeEditor = (element: HTMLElement | null, isSubject: boolean) => {
  if (!element) return "";
  if (isSubject) {
    const serializeSubjectNode = (node: ChildNode): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (!(node instanceof HTMLElement)) return "";
      if (node.dataset.token) return `{{${node.dataset.token}}}`;
      if (node.tagName === "BR") return "\n";
      const text = Array.from(node.childNodes).map(serializeSubjectNode).join("");
      return /^(DIV|P)$/.test(node.tagName) ? `${text}\n` : text;
    };
    return String(Array.from(element.childNodes).map(serializeSubjectNode).join("")).replace(/\n+$/, "");
  } else {
    return String(Array.from(element.childNodes).map(serializeHtmlNode).join("")).trim();
  }
};

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
      htmlRef.current.innerHTML = rawToHtmlEditorHtml(html, variables);
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
    const raw = serializeEditor(element, name === "subject");
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

    editor.focus();
    const label = variables.find(v => v.key === key)?.label || key;
    const tokenHtml = `<span data-token="${escapeHtml(key)}" contenteditable="false" class="mx-0.5 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">[${escapeHtml(label)}]</span>`;

    const selection = window.getSelection();
    let inserted = false;

    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const isAtStart = range.startOffset === 0 && (
        range.startContainer === editor ||
        (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.previousSibling === null)
      );

      if (!isAtStart || editor.textContent?.trim() === "") {
        range.deleteContents();
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = tokenHtml;
        const node = tempDiv.firstChild;
        if (node) {
          range.insertNode(node);
          range.setStartAfter(node);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          inserted = true;
        }
      }
    }

    if (!inserted) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = tokenHtml;
      const node = tempDiv.firstChild;
      if (node) {
        editor.appendChild(node);
        moveCaretToEnd(editor);
      }
    }

    emit(name, editor);
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

  const handlePaste = (name: "subject" | "html", event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    const editor = name === "subject" ? subjectRef.current : htmlRef.current;
    if (!editor) return;

    if (name === "subject") {
      const cleanText = text.replace(/[\r\n]+/g, " ");
      document.execCommand("insertText", false, cleanText);
    } else {
      const cleanHtml = escapeHtml(text).replace(/\r?\n/g, "<br />");
      document.execCommand("insertHTML", false, cleanHtml);
    }
  };

  const execFormat = (command: string, value: string = "") => {
    if (disabled || !htmlRef.current) return;
    htmlRef.current.focus();
    document.execCommand(command, false, value);
    emit("html", htmlRef.current);
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
              onPaste={(event) => handlePaste("subject", event)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal bg-white"
            />
          </label>

          <div className="mt-2">
            <span className="block text-xs font-semibold text-slate-600 mb-1">{bodyLabel}</span>
            <div className="flex flex-col rounded-lg border border-slate-200 overflow-hidden bg-white">
              <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 p-1.5">
                <button
                  type="button"
                  onClick={() => execFormat("bold")}
                  disabled={disabled}
                  title="Đậm"
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat("italic")}
                  disabled={disabled}
                  title="Nghiêng"
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat("underline")}
                  disabled={disabled}
                  title="Gạch chân"
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>
                <div className="mx-1 h-4 w-[1px] bg-slate-200" />
                <button
                  type="button"
                  onClick={() => execFormat("insertUnorderedList")}
                  disabled={disabled}
                  title="Danh sách dấu đầu dòng"
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat("insertOrderedList")}
                  disabled={disabled}
                  title="Danh sách số"
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <div className="mx-1 h-4 w-[1px] bg-slate-200" />
                <button
                  type="button"
                  onClick={() => execFormat("removeFormat")}
                  disabled={disabled}
                  title="Xoá định dạng"
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>
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
                onPaste={(event) => handlePaste("html", event)}
                className="min-h-[140px] w-full px-3 py-2 text-sm font-normal focus:outline-none bg-white prose-sm"
              />
            </div>
          </div>

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
