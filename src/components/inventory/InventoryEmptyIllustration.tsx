import { cn } from "../../modules/student-management/lib/utils";

export function InventoryEmptyIllustration({ kind, className }: { kind: "product" | "search" | "warehouse" | "receipt" | "serial" | "transfer" | "transaction" | "forecast"; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 160 96" fill="none" className={cn("mx-auto block h-24 w-40 max-w-full text-on-surface-variant", className)}>
    <g stroke="currentColor" strokeLinecap="round" opacity="0.12" strokeWidth="8"><path d="M20 70h35M32 82h27M105 73h35M109 84h19" /></g>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" opacity="0.65">
      {kind === "search" ? <><path d="M52 24h40l12 12v38a5 5 0 0 1-5 5H52a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5ZM92 24v12h12M59 44h26M59 53h18" /><circle cx="95" cy="63" r="10" /><path d="m102 70 10 10" /></> : null}
      {kind === "product" || kind === "warehouse" ? <><path d="m80 24 29 15v33L80 87 51 72V39l29-15ZM51 39l29 16 29-16M80 55v32M66 31l29 16" /></> : null}
      {kind === "receipt" || kind === "transaction" ? <><path d="M53 22h54v54l-9-5-9 5-9-5-9 5-9-5-9 5V22ZM63 36h34M63 45h25M63 57h14" /></> : null}
      {kind === "serial" ? <><rect x="48" y="25" width="64" height="50" rx="5" /><path d="M60 39v22M66 35v30M73 39v22M80 35v30M88 39v22M95 35v30M101 39v22" /></> : null}
      {kind === "transfer" ? <><path d="M38 37h36v29H38zM86 37h36v29H86zM74 46h12m-6-6 6 6-6 6M86 58H74m6-6-6 6 6 6" /></> : null}
      {kind === "forecast" ? <><path d="M44 74V28M44 74h75M55 62l18-16 17 7 20-25" /><circle cx="55" cy="62" r="2" /><circle cx="73" cy="46" r="2" /><circle cx="90" cy="53" r="2" /></> : null}
      <path d="m120 19 1.5 4.5L126 25l-4.5 1.5L120 31l-1.5-4.5L114 25l4.5-1.5L120 19ZM42 28l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
    </g>
  </svg>;
}
