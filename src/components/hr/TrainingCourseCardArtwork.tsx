import { getCardArtworkTone } from "./cardArtworkTones";

type CourseArtworkKind = "business" | "culture" | "technical" | "technology" | "general";

function getArtworkKind(category: string): CourseArtworkKind {
  switch (category.trim().toLocaleLowerCase("vi")) {
    case "kinh doanh": return "business";
    case "văn hóa": return "culture";
    case "kỹ thuật": return "technical";
    case "công nghệ": return "technology";
    default: return "general";
  }
}

export function TrainingCourseCardArtwork({ id, category }: { id: string; category: string }) {
  const kind = getArtworkKind(category);
  const tone = getCardArtworkTone(id);

  return (
    <div className="flex w-14 shrink-0 self-stretch items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${tone.from}, ${tone.to})` }} aria-hidden="true">
      <svg viewBox="0 0 96 112" className="size-14" fill="none" focusable="false">
        <rect x="12" y="11" width="72" height="90" rx="12" fill="white" fillOpacity="0.18" />
        {kind === "business" && <>
          <rect x="23" y="24" width="50" height="65" rx="7" fill="white" />
          <path d="M31 36h20" stroke={tone.ink} strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
          <path d="M33 77V66m12 11V58m12 19V62m12 15V49" stroke={tone.ink} strokeWidth="5" strokeLinecap="round" />
          <path d="m31 55 14-9 11 4 11-10" stroke={tone.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>}
        {kind === "culture" && <>
          <path d="M48 42c-10-6-18-7-28-4v47c11-3 19-2 28 5 9-7 17-8 28-5V38c-10-3-18-2-28 4Z" fill="white" stroke={tone.ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M48 42v48M27 51c6-1 10 0 15 2m-15 9c6-1 10 0 15 2m12-11c5-2 9-3 15-2m-15 13c5-2 9-3 15-2" stroke={tone.ink} strokeOpacity="0.48" strokeWidth="2" strokeLinecap="round" />
          <path d="M30 24h37v20H44l-8 7v-7h-6V24Z" fill="white" stroke={tone.ink} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="41" cy="34" r="2" fill={tone.ink} /><circle cx="49" cy="34" r="2" fill={tone.ink} /><circle cx="57" cy="34" r="2" fill={tone.ink} />
        </>}
        {kind === "technical" && <>
          <rect x="23" y="24" width="50" height="65" rx="7" fill="white" />
          <path d="M31 36h34M33 47h17" stroke={tone.ink} strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
          <circle cx="53" cy="68" r="13" fill={tone.ink} fillOpacity="0.22" stroke={tone.ink} strokeWidth="2.5" />
          <circle cx="53" cy="68" r="5" fill="white" />
          <path d="M53 51v-4m0 42v-4M36 68h-4m42 0h-4M41 56l-3-3m30 30-3-3m0-24 3-3M38 83l3-3" stroke={tone.ink} strokeWidth="2.5" strokeLinecap="round" />
        </>}
        {kind === "technology" && <>
          <rect x="17" y="27" width="62" height="53" rx="6" fill="white" stroke={tone.ink} strokeWidth="2.5" />
          <path d="m41 43-9 10 9 10m14-20 9 10-9 10m-7-23-5 28" stroke={tone.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 82h72l-7 9H19l-7-9Z" fill="white" stroke={tone.ink} strokeWidth="2.5" strokeLinejoin="round" />
        </>}
        {kind === "general" && <>
          <rect x="26" y="34" width="46" height="58" rx="6" fill="white" />
          <path d="M34 53h29m-29 10h22m-22 10h25" stroke={tone.ink} strokeOpacity="0.48" strokeWidth="3" strokeLinecap="round" />
          <path d="m16 32 32-14 32 14-32 14-32-14Z" fill="white" stroke={tone.ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M68 38v15" stroke={tone.ink} strokeWidth="2.5" strokeLinecap="round" />
        </>}
      </svg>
    </div>
  );
}
