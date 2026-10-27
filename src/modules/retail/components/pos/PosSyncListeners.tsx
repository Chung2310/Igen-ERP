import React from "react";
import { createHidScannerBuffer } from "../../hooks/retailScannerInput";
import type { OfflineScope } from "../../offline/retailOfflineQueue";

export function HidScannerListener({ onScan }: { onScan(value: string): void }) {
  const callback = React.useRef(onScan);
  callback.current = onScan;
  React.useEffect(() => {
    const scanner = createHidScannerBuffer({
      timeoutMs: 50,
      minLength: 3,
      onScan: (value) => callback.current(value),
    });
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !target ||
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        scanner.keydown(event);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
}

export function OnlineRetailSync({
  scope,
  sync,
}: {
  scope: OfflineScope;
  sync(scope: OfflineScope, options?: { automatic?: boolean }): Promise<unknown>;
}) {
  const callback = React.useRef(sync);
  callback.current = sync;
  const inFlight = React.useRef(false);
  React.useEffect(() => {
    const run = () => {
      if (inFlight.current) return;
      inFlight.current = true;
      void Promise.resolve(callback.current(scope, { automatic: true }))
        .catch(() => undefined)
        .finally(() => { inFlight.current = false; });
    };
    window.addEventListener("online", run);
    if (navigator.onLine) run();
    return () => window.removeEventListener("online", run);
  }, [scope.companyCode, scope.branchId, scope.userId]);
  return null;
}

export function PosNotice() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-amber-800 p-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-xs">
        Vui lòng chọn chi nhánh để tiếp tục sử dụng POS.
      </div>
    </div>
  );
}
