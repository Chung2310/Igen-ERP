type Kind = "supplies" | "equipment" | "transactions" | "warehouse" | "supplier" | "category" | "balance" | "documents" | "search";

export function LogisticsEmptyIllustration({ kind }: { kind: Kind }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 160 96" fill="none" className="mx-auto h-24 w-40 max-w-full text-on-surface-variant">
    <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.12">
      <path d="M16 77h28m-19 10h20m72-10h27m-17 10h18" />
    </g>
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.72">
      {(kind === "supplies" || kind === "balance") && <>
        <path d="m45 37 35-16 35 16-35 16-35-16Zm0 0v32l35 16 35-16V37M80 53v32M57 31l35 16" />
        <path d="M71 63h18m-9-9v18" stroke="var(--color-primary)" strokeWidth="3" />
        {kind === "balance" && <path d="M110 72h20m-15-8v8m10-13v13" stroke="var(--color-tertiary)" />}
      </>}
      {kind === "equipment" && <>
        <rect x="43" y="20" width="74" height="53" rx="6" />
        <rect x="50" y="27" width="60" height="39" rx="3" />
        <path d="M69 82h22m-11-9v9M80 35v23m-11-12h22" stroke="var(--color-primary)" strokeWidth="3" />
        <circle cx="110" cy="72" r="8" stroke="var(--color-tertiary)" />
      </>}
      {(kind === "transactions" || kind === "documents") && <>
        <path d="M54 18h38l14 14v47H54a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z" />
        <path d="M92 18v14h14M61 44h33M61 53h25M61 62h19" />
        {kind === "transactions" ? <path d="m91 63 7 7 12-13" stroke="var(--color-primary)" strokeWidth="3" />
          : <path d="M91 68h16m-8-8v16" stroke="var(--color-primary)" strokeWidth="3" />}
      </>}
      {kind === "warehouse" && <>
        <path d="m41 38 39-19 39 19v40H41V38Zm-6 40h90M51 42h58M67 78V54h26v24" />
        <path d="M74 64h12" stroke="var(--color-primary)" strokeWidth="3" />
      </>}
      {kind === "supplier" && <>
        <rect x="43" y="27" width="74" height="51" rx="5" />
        <path d="M56 27v-8h48v8M43 42h74M54 54h20M54 63h14" />
        <circle cx="96" cy="59" r="9" stroke="var(--color-primary)" />
        <path d="M83 76c1-6 5-9 13-9s12 3 13 9" stroke="var(--color-primary)" />
      </>}
      {kind === "category" && <>
        <path d="M48 25h45l22 22-39 39-39-39 11-22Z" />
        <circle cx="57" cy="41" r="4" stroke="var(--color-primary)" />
        <path d="M72 51h28M67 60h24" />
      </>}
      {kind === "search" && <>
        <path d="M50 24h49l11 11v39H50a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5Zm49 0v11h11M57 44h28M57 53h20" />
        <circle cx="95" cy="66" r="11" stroke="var(--color-primary)" />
        <path d="m103 74 9 9" stroke="var(--color-primary)" />
      </>}
    </g>
    <path d="m125 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5ZM34 31l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" fill="var(--color-primary)" opacity="0.45" />
  </svg>;
}
