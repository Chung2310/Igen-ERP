const FALLBACK_TERMINAL_ID = "default";

export function getPosTerminalId(companyCode: string, branchId: string): string {
  const key = `igen.pos.terminal.v1:${encodeURIComponent(companyCode)}:${encodeURIComponent(branchId)}`;
  try {
    const existing = localStorage.getItem(key)?.trim();
    if (existing) return existing;

    const terminalId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, terminalId);
    return terminalId;
  } catch {
    return FALLBACK_TERMINAL_ID;
  }
}
