import type { CSSProperties } from "react";

export default function ArchitectAssistantIcon({ name, className = "", fill = false }: { name: string; className?: string; fill?: boolean }) {
  const style: CSSProperties = { fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` };
  return <span className={`material-symbols-outlined ${className}`} style={style} aria-hidden="true">{name}</span>;
}
