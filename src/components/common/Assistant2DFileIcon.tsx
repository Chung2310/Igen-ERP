type AssistantFileAction = "upload" | "download";
type AssistantFileKind = "document" | "spreadsheet" | "pdf" | "presentation" | "image" | "audio" | "video" | "generic";

const formatAliases: Record<string, string> = {
  jpeg: "JPG",
  markdown: "MD",
  powerpoint: "PPT",
  word: "DOC",
};

const accentClasses: Record<AssistantFileKind, string> = {
  document: "fill-primary",
  spreadsheet: "fill-tertiary",
  pdf: "fill-error",
  presentation: "fill-secondary",
  image: "fill-tertiary",
  audio: "fill-primary",
  video: "fill-error",
  generic: "fill-primary",
};

const contrastClasses: Record<AssistantFileKind, string> = {
  document: "fill-on-primary",
  spreadsheet: "fill-on-tertiary",
  pdf: "fill-on-error",
  presentation: "fill-on-secondary",
  image: "fill-on-tertiary",
  audio: "fill-on-primary",
  video: "fill-on-error",
  generic: "fill-on-primary",
};

function fileExtension(fileName: string): string {
  const cleanName = fileName.split(/[?#]/, 1)[0].split(/[\\/]/).pop() ?? "";
  const match = cleanName.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

function fileKind(extension: string): AssistantFileKind {
  if (extension === "pdf") return "pdf";
  if (["doc", "docx", "rtf", "txt", "md"].includes(extension)) return "document";
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff"].includes(extension)) return "image";
  if (["mp3", "wav", "m4a", "ogg", "flac", "aac", "webm"].includes(extension)) return "audio";
  if (["mp4", "mov", "avi", "mkv"].includes(extension)) return "video";
  return "generic";
}

function FileArtwork({ kind, accentClass }: { kind: AssistantFileKind; accentClass: string }) {
  if (kind === "spreadsheet") return <g aria-hidden="true">
    <rect x="13" y="21" width="22" height="17" rx="2" className="fill-surface-container-lowest" />
    <path d="M20.3 21v17M27.7 21v17M13 26.7h22M13 32.3h22" fill="none" stroke="var(--color-tertiary)" strokeWidth="1.8" />
  </g>;

  if (kind === "image") return <g aria-hidden="true">
    <rect x="13" y="21" width="22" height="17" rx="2.5" className="fill-surface-container-lowest" />
    <circle cx="29.5" cy="25.5" r="2" className={accentClass} />
    <path d="m14.5 35 6.2-6.5 4.1 4 3-2.9 6 5.4Z" className={accentClass} />
  </g>;

  if (kind === "audio") return <g aria-hidden="true" className={accentClass}>
    {[7, 12, 17, 12, 8, 14, 10].map((height, index) => <rect key={index} x={15 + index * 3} y={29 - height / 2} width="1.8" height={height} rx=".9" />)}
  </g>;

  if (kind === "video") return <g aria-hidden="true">
    <rect x="13" y="21" width="22" height="17" rx="2.5" className={accentClass} />
    <path d="m22 24.5 8 5-8 5Z" className="fill-surface-container-lowest" />
  </g>;

  if (kind === "presentation") return <g aria-hidden="true">
    <rect x="13" y="21" width="22" height="15" rx="2" className="fill-surface-container-lowest" />
    <path d="M24 36v3m-5 0h10" className="stroke-outline" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16 32v-3h3v3Zm6 0v-6h3v6Zm6 0v-8h3v8Z" className={accentClass} />
  </g>;

  if (kind === "pdf") return <g aria-hidden="true">
    <path d="M14 22h16m-16 5h12m-12 5h16m-16 5h10" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" />
  </g>;

  return <g aria-hidden="true">
    <path d="M14 23h16m-16 5h12m-12 5h16" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
  </g>;
}

export function Assistant2DFileIcon({
  fileName,
  format: fallbackFormat,
  action,
  className = "size-10 shrink-0",
}: {
  fileName: string;
  format?: string;
  action?: AssistantFileAction;
  className?: string;
}) {
  const extension = fileExtension(fileName) || fallbackFormat?.replace(/^\./, "").toLowerCase() || "";
  const format = (formatAliases[extension] ?? extension.toUpperCase()).slice(0, 5) || "FILE";
  const kind = fileKind(extension);
  const accentClass = accentClasses[kind];
  const contrastClass = contrastClasses[kind];

  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" data-action={action ?? "file"}>
    <path d="M9 3h20l12 12v40a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z" className="fill-surface-container-lowest stroke-outline-variant" strokeWidth="1.5" />
    <path d="M29 3v9a3 3 0 0 0 3 3h9" className="fill-surface-container-low stroke-outline-variant" strokeWidth="1.5" />
    <FileArtwork kind={kind} accentClass={accentClass} />
    <rect x="9" y="44" width="29" height="11" rx="3" className={accentClass} />
    <text x="23.5" y="49.6" textAnchor="middle" dominantBaseline="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="8.5" fontWeight="700" className={contrastClass}>{format}</text>
    {action === "download" && <g aria-hidden="true">
      <circle cx="51" cy="49" r="10.5" className="fill-primary stroke-surface-container-lowest" strokeWidth="2" />
      <path d="M51 44v10m-4-4 4 4 4-4M47 57h8" className="stroke-on-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>}
  </svg>;
}
