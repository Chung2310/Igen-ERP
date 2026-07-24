import React from "react";
import { StepUpDialog } from "../components/super-admin/StepUpDialog";

export type StepUpResult = { password: string; token: string; step: number };

/**
 * Cấp lại xác thực (mật khẩu + mã 2FA hiện tại) trước khi gọi các thao tác
 * super-admin nguy hiểm yêu cầu requiresStepUp ở backend.
 */
export function useStepUp() {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const resolverRef = React.useRef<((value: StepUpResult | null) => void) | null>(null);

  const requestStepUp = React.useCallback((): Promise<StepUpResult | null> => {
    setError("");
    setOpen(true);
    return new Promise((resolve) => { resolverRef.current = resolve; });
  }, []);

  const onCancel = React.useCallback(() => {
    setOpen(false);
    setSubmitting(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  }, []);

  const onConfirm = React.useCallback((password: string, token: string) => {
    setSubmitting(true);
    const step = Math.floor(Date.now() / 30000);
    setOpen(false);
    setSubmitting(false);
    resolverRef.current?.({ password, token, step });
    resolverRef.current = null;
  }, []);

  const stepUpDialog = React.createElement(StepUpDialog, { isOpen: open, submitting, error, onCancel, onConfirm });

  return { requestStepUp, stepUpDialog };
}
