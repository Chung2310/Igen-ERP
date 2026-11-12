type FileKind = "spreadsheet" | "pdf" | "document" | "presentation" | "image" | "audio" | "video" | "text";

const fileKinds: Record<FileKind, { paper: string; accent: string; fold: string }> = {
  spreadsheet: { paper: "#e7f4e9", accent: "#16864a", fold: "#0d6535" },
  pdf: { paper: "#fdeceb", accent: "#d83b36", fold: "#a82220" },
  document: { paper: "#e9f1fd", accent: "#2b67c8", fold: "#174b9b" },
  presentation: { paper: "#fff1e6", accent: "#e87524", fold: "#b84b12" },
  image: { paper: "#f1ebff", accent: "#8154ce", fold: "#5d36a7" },
  audio: { paper: "#fff4df", accent: "#d98a13", fold: "#ad6500" },
  video: { paper: "#fdebed", accent: "#d7434b", fold: "#aa2834" },
  text: { paper: "#edf0f4", accent: "#657080", fold: "#46505e" },
};

function getFileKind(fileName: string): FileKind {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!extension) return "document";
  if (["xlsx", "xls", "csv"].includes(extension)) return "spreadsheet";
  if (extension === "pdf") return "pdf";
  if (["doc", "docx", "rtf"].includes(extension)) return "document";
  if (["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(extension)) return "image";
  if (["mp3", "wav", "m4a", "ogg", "flac", "webm"].includes(extension)) return "audio";
  if (["mp4", "mov", "avi", "mkv"].includes(extension)) return "video";
  return "text";
}

function FileArtwork({ kind, accent }: { kind: FileKind; accent: string }) {
  if (kind === "spreadsheet") return <>
    <rect x="10" y="19" width="14" height="16" rx="1.5" fill="#fff" />
    <rect x="10" y="23.5" width="14" height="1.5" fill={accent} />
    <rect x="10" y="29" width="14" height="1.5" fill={accent} />
    <rect x="14.2" y="19" width="1.5" height="16" fill={accent} />
    <rect x="19" y="19" width="1.5" height="16" fill={accent} />
  </>;
  if (kind === "pdf") return <>
    <rect x="10" y="20" width="13" height="2.5" rx="1.25" fill="#fff" />
    <rect x="10" y="24" width="9" height="2.5" rx="1.25" fill="#fff" />
    <rect x="10" y="28" width="14" height="2.5" rx="1.25" fill="#fff" />
    <rect x="10" y="32" width="10" height="2.5" rx="1.25" fill="#fff" />
    <circle cx="23" cy="21" r="2" fill="#fff" />
  </>;
  if (kind === "document" || kind === "text") return <>
    <rect x="10" y="20" width="15" height="2.5" rx="1.25" fill="#fff" />
    <rect x="10" y="25" width="13" height="2.5" rx="1.25" fill="#fff" />
    <rect x="10" y="30" width="15" height="2.5" rx="1.25" fill="#fff" />
  </>;
  if (kind === "presentation") return <>
    <rect x="10" y="20" width="15" height="12" rx="1.5" fill="#fff" />
    <rect x="12" y="27" width="2.5" height="3" rx=".5" fill={accent} />
    <rect x="16" y="24" width="2.5" height="6" rx=".5" fill={accent} />
    <rect x="20" y="22" width="2.5" height="8" rx=".5" fill={accent} />
    <rect x="15" y="33" width="6" height="2" rx="1" fill="#fff" />
  </>;
  if (kind === "image") return <>
    <rect x="9" y="20" width="17" height="13" rx="2" fill="#fff" />
    <circle cx="21" cy="23" r="1.5" fill={accent} />
    <path d="m10 31 5-5 3 3 2-2 5 5v1H10z" fill={accent} />
  </>;
  if (kind === "audio") return <>
    {[6, 11, 8, 14, 9, 12].map((height, index) => <rect key={index} x={10 + index * 2.7} y={27 - height / 2} width="1.8" height={height} rx=".9" fill="#fff" />)}
  </>;
  if (kind === "video") return <>
    <rect x="9" y="21" width="17" height="12" rx="2" fill="#fff" />
    <path d="m16 23.5 6 3.5-6 3.5z" fill={accent} />
  </>;
  return null;
}

export function AssistantFileTypeIcon({ fileName, className = "size-8 shrink-0" }: { fileName: string; className?: string }) {
  const kind = getFileKind(fileName);
  const colors = fileKinds[kind];

  return <svg className={className} viewBox="0 0 36 42" fill="none" aria-hidden="true" focusable="false">
    <path d="M8 1.5h14l9 9v27a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-33a3 3 0 0 1 3-3Z" fill={colors.paper} />
    <path d="M22 1.5v7a2 2 0 0 0 2 2h7" fill={colors.fold} />
    <rect x="5" y="16" width="25" height="22" rx="3" fill={colors.accent} />
    <FileArtwork kind={kind} accent={colors.accent} />
  </svg>;
}
