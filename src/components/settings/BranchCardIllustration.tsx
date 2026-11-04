export type BranchIllustrationKind = "student" | "retail" | "worker" | "general";

const branchBusinessModules = ["student", "retail", "worker"] as const;

export function getBranchIllustrationKind(enabledModules: readonly string[] | undefined): BranchIllustrationKind {
  const selected = branchBusinessModules.filter((key) => enabledModules?.includes(key));
  return selected.length === 1 ? selected[0] : "general";
}

export function BranchCardIllustration({ kind }: { kind: BranchIllustrationKind }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 80 96" fill="none" className="h-20 w-16 max-w-full text-white">
    {kind === "student" && <>
      <path d="M40 45c-10-7-20-8-31-5v35c12-3 22-2 31 5 9-7 19-8 31-5V40c-11-3-21-2-31 5Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 45v35M16 51c7-1 13 0 18 3m-18 8c7-1 13 0 18 3m12-11c6-3 12-4 18-3m-18 14c6-3 12-4 18-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m17 26 23-11 23 11-23 11-23-11Z" fill="currentColor" fillOpacity="0.9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 31v9c8 6 20 6 28 0v-9M63 26v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="63" cy="45" r="2" fill="currentColor" />
    </>}
    {kind === "retail" && <>
      <path d="M14 78V32a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v46" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M19 27v-5a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v5" fill="currentColor" fillOpacity="0.88" />
      <path d="M17 43h46l-4-11H21l-4 11Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 43c0 4 4 6 7 3 3 3 7 3 10 0 3 3 9 3 12 0 3 3 7 3 10 0 3 3 7 1 7-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 53h13v15H23zM44 53h13v25H44z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 79h58M31 22h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="52" cy="66" r="1.5" fill="currentColor" />
    </>}
    {kind === "worker" && <>
      <path d="M15 79c1-15 10-24 25-24s24 9 25 24H15Z" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m31 59 9 12 9-12M40 71v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 36v8c0 8 5 14 12 14s12-6 12-14v-8" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" />
      <path d="M25 34c0-11 6-18 15-18s15 7 15 18M39 17v11M22 34h36" fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 80h52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 67v10m36-10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>}
    {kind === "general" && <>
      <path d="M20 79V23a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v56" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M17 79h46M27 29h8v9h-8zm18 0h8v9h-8zM27 46h8v9h-8zm18 0h8v9h-8zM34 79V65h12v14" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 79V52h8m40-11h8v38M16 59h4m-4 8h4m40-18h4m-4 8h4m-4 8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 18v-6h20v6" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </>}
  </svg>;
}
