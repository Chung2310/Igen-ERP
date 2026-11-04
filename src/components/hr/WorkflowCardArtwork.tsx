import { getCardArtworkTone } from "./cardArtworkTones";

export function WorkflowCardArtwork({ id, stepCount }: { id: string; stepCount: number }) {
  const tone = getCardArtworkTone(id);

  return (
    <div
      className="flex w-14 shrink-0 self-stretch items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${tone.from}, ${tone.to})` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 96 112" className="size-14" fill="none" focusable="false">
        <rect x="17" y="11" width="62" height="90" rx="12" fill="white" fillOpacity="0.18" />
        {stepCount <= 1 ? <>
          <rect x="27" y="25" width="42" height="62" rx="8" fill="white" />
          <rect x="35" y="36" width="26" height="5" rx="2.5" fill={tone.ink} fillOpacity="0.35" />
          <rect x="35" y="46" width="18" height="4" rx="2" fill={tone.ink} fillOpacity="0.2" />
          <path d="m35 66 8 8 18-20" stroke={tone.ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </> : stepCount <= 3 ? <>
          <path d="M48 27v59" stroke="white" strokeWidth="3" strokeLinecap="round" />
          {[22, 48, 74].map((y, index) => <g key={y}>
            <rect x="26" y={y} width="44" height="23" rx="6" fill="white" />
            <circle cx="37" cy={y + 11.5} r="5" fill={tone.ink} fillOpacity={index === 2 ? "0.45" : "0.8"} />
            <path d={`M48 ${y + 11.5}h13`} stroke={tone.ink} strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
          </g>)}
        </> : <>
          <path d="M48 43v16M26 59h44M26 59v12m44-12v12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="32" y="21" width="32" height="24" rx="6" fill="white" />
          <circle cx="43" cy="33" r="5" fill={tone.ink} fillOpacity="0.8" />
          <path d="M53 33h4" stroke={tone.ink} strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
          {[11, 55].map((x) => <g key={x}>
            <rect x={x} y="70" width="30" height="23" rx="6" fill="white" />
            <circle cx={x + 11} cy="81.5" r="4" fill={tone.ink} fillOpacity="0.8" />
            <path d={`M${x + 20} 81.5h4`} stroke={tone.ink} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
          </g>)}
        </>}
      </svg>
    </div>
  );
}
