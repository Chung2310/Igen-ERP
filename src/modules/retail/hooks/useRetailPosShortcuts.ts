import { useEffect } from "react";
export interface RetailPosShortcutActions { focusSearch(): void; openPayment(): void; holdDraft(): void; openScanner(): void; openHelp(): void }
const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
export function useRetailPosShortcuts(actions: RetailPosShortcutActions) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (editable(event.target)) return; const action = ({ F1: actions.openHelp, F2: actions.focusSearch, F4: actions.openPayment, F6: actions.holdDraft, F8: actions.openScanner } as Record<string, (() => void) | undefined>)[event.key]; if (action) { event.preventDefault(); action(); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [actions]);
}
