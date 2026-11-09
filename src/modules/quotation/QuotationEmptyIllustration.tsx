import { cn } from "../student-management/lib/utils";
import "./quotation-empty-illustration.css";

export type QuotationEmptyKind = "estimate" | "customer" | "budget" | "contract" | "acceptance" | "template" | "product" | "search";

function Subject({ kind }: { kind: QuotationEmptyKind }) {
  switch (kind) {
    case "estimate":
      return <>
        <path d="M54 19h45l10 10v43a5 5 0 0 1-5 5H54a5 5 0 0 1-5-5V24a5 5 0 0 1 5-5Z" />
        <path d="M99 19v10h10M60 38h24M60 47h18M60 59h15M60 67h15" />
        <path d="M87 56h13v13H87zM87 62.5h13M93.5 56v13" />
      </>;
    case "customer":
      return <>
        <rect x="46" y="22" width="67" height="53" rx="5" />
        <circle cx="67" cy="42" r="7" />
        <path d="M55 62c1-8 5-12 12-12s11 4 12 12M87 37h16M87 45h14M87 53h10" />
        <path d="M103 65h15l-4 5h-8l-3-5Z" />
      </>;
    case "budget":
      return <>
        <rect x="46" y="25" width="68" height="50" rx="5" />
        <path d="M56 62V49m13 13V39m13 23v-8m13 8V33M55 66h49" />
        <circle cx="103" cy="38" r="12" />
        <path d="M103 31v14m4-10c-2-3-9-3-9 1 0 4 9 2 9 6 0 4-7 5-10 1" />
      </>;
    case "contract":
      return <>
        <path d="M53 18h40l12 12v41a5 5 0 0 1-5 5H53a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z" />
        <path d="M93 18v12h12M59 42h30M59 51h23M59 60h17m8 6 22-22 6 6-22 22-9 2 3-8Z" />
      </>;
    case "acceptance":
      return <>
        <rect x="51" y="23" width="58" height="53" rx="5" />
        <path d="M68 23v-5h24v5M62 39h20M62 49h16M62 59h11" />
        <circle cx="101" cy="60" r="13" />
        <path d="m94 60 5 5 9-11" />
      </>;
    case "template":
      return <>
        <path d="M63 22h43a5 5 0 0 1 5 5v44H68a5 5 0 0 1-5-5V22Z" />
        <path d="M54 29h-3a5 5 0 0 0-5 5v40a5 5 0 0 0 5 5h43a5 5 0 0 0 5-5v-2M75 36h24M75 45h24M75 54h15M54 41v26" />
      </>;
    case "product":
      return <>
        <path d="m80 20 34 18v35L80 91 46 73V38l34-18Z" />
        <path d="M46 38 80 56l34-18M80 56v35M62 29l34 18M58 62l8 4" />
      </>;
    case "search":
      return <>
        <path d="M46 25h53v44H46zM56 37h33M56 47h25M56 57h17" />
        <circle cx="103" cy="60" r="15" />
        <path d="m114 71 11 11" />
      </>;
  }
}

export default function QuotationEmptyIllustration({ kind, className }: { kind: QuotationEmptyKind; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 160 96" fill="none" className={cn("quotation-empty-art", className)}>
    <g stroke="currentColor" strokeLinecap="round" opacity="0.12" strokeWidth="8">
      <path d="M20 70h35M32 82h27M105 73h35M109 84h19" />
    </g>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" opacity="0.65">
      <Subject kind={kind} />
      <path d="m119 18 1.5 4.5 4.5 1.5-4.5 1.5L119 30l-1.5-4.5-4.5-1.5 4.5-1.5L119 18ZM41 29l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
    </g>
  </svg>;
}
