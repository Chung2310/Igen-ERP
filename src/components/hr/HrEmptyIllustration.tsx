import { cn } from "../../modules/student-management/lib/utils";

export type HrEmptyIllustrationKind =
  | "organization"
  | "department"
  | "branch"
  | "training"
  | "workflow"
  | "task"
  | "calendar"
  | "contract"
  | "payroll"
  | "leave"
  | "recruitment"
  | "search";

function Subject({ kind }: { kind: HrEmptyIllustrationKind }) {
  switch (kind) {
    case "organization":
      return <><circle cx="80" cy="29" r="8" /><circle cx="53" cy="60" r="7" /><circle cx="107" cy="60" r="7" /><path d="M69 46c1-8 5-12 11-12s10 4 11 12M43 74c1-6 4-9 10-9s9 3 10 9M97 74c1-6 4-9 10-9s9 3 10 9M80 47v8M53 53v-7h54v7" /></>;
    case "department":
      return <><path d="M51 75V33a4 4 0 0 1 4-4h50a4 4 0 0 1 4 4v42M44 75h72M62 40h10v9H62zM88 40h10v9H88zM62 56h10v9H62zM88 56h10v9H88zM76 75V61h8v14" /></>;
    case "branch":
      return <><path d="M46 75V38l34-17 34 17v37M40 75h80M58 45h13v12H58zM89 45h13v12H89zM73 75V60h14v15" /><circle cx="80" cy="31" r="2" /></>;
    case "training":
      return <><path d="M80 27c-10-7-23-8-37-4v45c14-4 27-3 37 4 10-7 23-8 37-4V23c-14-4-27-3-37 4Zm0 0v45M51 38c8-1 14 0 21 3M51 47c8-1 14 0 21 3M88 41c7-3 13-4 21-3M88 50c7-3 13-4 21-3" /></>;
    case "workflow":
      return <><rect x="45" y="27" width="27" height="19" rx="4" /><rect x="88" y="27" width="27" height="19" rx="4" /><rect x="66" y="60" width="28" height="19" rx="4" /><path d="M72 36h16M58 46v8h22v6M102 46v8H80" /></>;
    case "task":
      return <><rect x="54" y="22" width="52" height="55" rx="5" /><path d="M68 22v-5h24v5M65 38h5m7 0h19M65 49h5m7 0h19M65 60h5m7 0h14" /><path d="m65 38 2 2 4-5m-6 14 2 2 4-5" /></>;
    case "calendar":
      return <><rect x="48" y="25" width="64" height="51" rx="5" /><path d="M48 39h64M63 20v10M97 20v10M62 52h9M80 52h9M98 52h2M62 64h9M80 64h9" /></>;
    case "contract":
      return <><path d="M61 21h29l13 13v39a5 5 0 0 1-5 5H61a5 5 0 0 1-5-5V26a5 5 0 0 1 5-5Z" /><path d="M90 21v13h13M66 48h22M66 55h16m-15 13 5-6 4 3 6-7" /></>;
    case "payroll":
      return <><path d="M52 21h56v53l-9-5-9 5-10-5-10 5-9-5-9 5V21Z" /><path d="M63 34h24M63 43h15M63 56h12" /><circle cx="94" cy="54" r="11" /><path d="M94 47v14m5-10c-2-4-10-4-10 0 0 4 10 2 10 7 0 4-8 5-11 1" /></>;
    case "leave":
      return <><path d="M57 21h35l12 12v41H57a5 5 0 0 1-5-5V26a5 5 0 0 1 5-5Z" /><path d="M92 21v12h12M65 47h23M65 56h16m3 12 5 5 10-12" /></>;
    case "recruitment":
      return <><rect x="48" y="25" width="64" height="48" rx="5" /><path d="M69 25v-6h22v6M48 39h64" /><circle cx="70" cy="51" r="6" /><path d="M59 66c1-6 5-9 11-9s10 3 11 9M91 50h13M91 58h10" /></>;
    case "search":
      return <><path d="M55 22h34l12 12v39a5 5 0 0 1-5 5H55a5 5 0 0 1-5-5V27a5 5 0 0 1 5-5Z" /><path d="M89 22v12h12M61 43h24M61 52h17" /><circle cx="93" cy="63" r="10" /><path d="m100 70 9 9" /></>;
  }
}

export function HrEmptyIllustration({ kind, className }: { kind: HrEmptyIllustrationKind; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 160 96" fill="none" className={cn("h-24 w-40 max-w-full text-on-surface-variant", className)}>
    <g stroke="currentColor" strokeLinecap="round" opacity="0.12" strokeWidth="8"><path d="M20 70h35M32 82h27M105 73h35M109 84h19" /></g>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" opacity="0.65">
      <Subject kind={kind} />
      <path d="m118 19 1.5 4.5L124 25l-4.5 1.5L118 31l-1.5-4.5L112 25l4.5-1.5L118 19ZM44 30l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
    </g>
  </svg>;
}
