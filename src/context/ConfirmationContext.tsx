import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/inventory/InventoryConfirmDialog";

export type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
};

type PendingConfirmation = ConfirmationOptions & { resolve: (confirmed: boolean) => void };
type ConfirmationContextValue = { confirm: (options: ConfirmationOptions) => Promise<boolean> };

const ConfirmationContext = createContext<ConfirmationContextValue>({ confirm: async () => false });

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<PendingConfirmation | null>(null);
  const activeRef = useRef<PendingConfirmation | null>(null);
  const queued = useRef<PendingConfirmation[]>([]);
  activeRef.current = active;

  const confirm = useCallback((options: ConfirmationOptions) => new Promise<boolean>((resolve) => {
    const request = { ...options, resolve };
    if (activeRef.current) queued.current.push(request);
    else {
      activeRef.current = request;
      setActive(request);
    }
  }), []);

  const settle = useCallback((confirmed: boolean) => {
    const current = activeRef.current;
    if (!current) return;
    current.resolve(confirmed);
    const next = queued.current.shift() || null;
    activeRef.current = next;
    setActive(next);
  }, []);

  useEffect(() => () => {
    activeRef.current?.resolve(false);
    queued.current.forEach((request) => request.resolve(false));
    queued.current = [];
    activeRef.current = null;
  }, []);

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        isOpen={Boolean(active)}
        title={active?.title || "Xác nhận thao tác"}
        description={active?.description || ""}
        confirmLabel={active?.confirmLabel || "Xác nhận"}
        cancelLabel={active?.cancelLabel || "Hủy"}
        tone={active?.tone || "warning"}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  return useContext(ConfirmationContext).confirm;
}
