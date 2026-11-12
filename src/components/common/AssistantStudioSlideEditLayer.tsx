import type { CSSProperties, ElementType, FocusEvent } from "react";
import { cn } from "../../modules/student-management/lib/utils";
import type { AssistantSlideCanvasObject, AssistantSlideTextStyle } from "../../shared/assistant-slide";

function textStyleToCss(style: AssistantSlideTextStyle | undefined): CSSProperties {
  return {
    fontFamily: style?.fontFamily,
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    fontWeight: style?.bold === undefined ? undefined : style.bold ? 700 : 400,
    fontStyle: style?.italic ? "italic" : undefined,
    textDecoration: style?.underline ? "underline" : undefined,
    textAlign: style?.align,
    color: style?.color,
  };
}

export function SlideEditableText({
  as: Tag = "p",
  field,
  label,
  value,
  style,
  styleOverrides,
  className,
  editable = false,
  selected = false,
  onSelect,
  onCommit,
}: {
  as?: ElementType;
  field: string;
  label: string;
  value: string;
  style?: AssistantSlideTextStyle;
  styleOverrides?: CSSProperties;
  className?: string;
  editable?: boolean;
  selected?: boolean;
  onSelect?: (field: string) => void;
  onCommit?: (field: string, value: string) => void;
}) {
  function commit(event: FocusEvent<HTMLElement>) {
    if (!editable || !onCommit) return;
    const nextValue = event.currentTarget.innerText.replace(/\r/g, "").trimEnd();
    if (nextValue !== value) onCommit(field, nextValue);
  }

  return <Tag
    contentEditable={editable}
    suppressContentEditableWarning
    role={editable ? "textbox" : undefined}
    aria-label={editable ? label : undefined}
    aria-multiline={editable ? "true" : undefined}
    spellCheck={editable}
    data-slide-text-field={editable ? field : undefined}
    onFocus={editable ? () => onSelect?.(field) : undefined}
    onClick={editable ? () => onSelect?.(field) : undefined}
    onBlur={commit}
    className={cn(className, editable && "cursor-text", editable && selected && "rounded-sm outline outline-2 outline-primary outline-offset-2")}
    style={{ ...textStyleToCss(style), ...styleOverrides }}
  >{value}</Tag>;
}

export function AssistantStudioSlideEditLayer({
  objects,
  editable = false,
  selectedObjectId,
  onSelectObject,
  onCommitText,
}: {
  objects: AssistantSlideCanvasObject[];
  editable?: boolean;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onCommitText?: (field: string, value: string) => void;
}) {
  return <>
    {objects.map(object => {
      const position: CSSProperties = { left: `${object.x}%`, top: `${object.y}%`, width: `${object.width}%`, height: `${object.height}%` };
      const selected = selectedObjectId === object.id;
      if (object.type === "image" && object.src) {
        const image = <img src={object.src} alt={editable ? "" : object.alt || "Ảnh trong slide"} className="size-full object-contain" />;
        return editable
          ? <button key={object.id} type="button" aria-label={`Chọn ảnh ${object.alt || "trong slide"}`} aria-pressed={selected} onClick={() => onSelectObject?.(object.id)} className={cn("absolute z-10 overflow-hidden rounded-md border-2 bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", selected ? "border-primary" : "border-outline-variant")} style={position}>{image}</button>
          : <div key={object.id} className="absolute z-10 overflow-hidden rounded-md" style={position}>{image}</div>;
      }

      if (object.type === "text") return <SlideEditableText
        key={object.id}
        as="div"
        field={`object.${object.id}`}
        label="Hộp chữ trên slide"
        value={object.text || ""}
        style={object.style}
        styleOverrides={position}
        editable={editable}
        selected={selected}
        onSelect={() => onSelectObject?.(object.id)}
        onCommit={onCommitText}
        className={cn("absolute z-10 overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest p-2 shadow-sm", editable && "cursor-text")}
      />;
      return null;
    })}
    {editable && <span className="sr-only" aria-live="polite">Đang chỉnh sửa trực tiếp trên slide.</span>}
  </>;
}

