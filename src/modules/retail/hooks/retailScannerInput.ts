export function createHidScannerBuffer(options: { timeoutMs: number; minLength: number; onScan(code: string): void }) {
  let buffer = "", lastAt: number | null = null;
  const reset = () => { buffer = ""; lastAt = null; };
  return { reset, keydown(event: KeyboardEvent) { const now = Number(event.timeStamp); if (lastAt !== null && now - lastAt > options.timeoutMs) reset(); if (event.key === "Enter") { if (buffer.length >= options.minLength) options.onScan(buffer); reset(); return; } if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) { buffer += event.key; lastAt = now; } } };
}
