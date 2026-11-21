import "./logistics.css";
import { useState, type ReactNode, type FormEvent } from "react";
import { ErpModal } from "../../../components/common/ErpModal";
import {
  buttonClass,
  primaryClass,
  Feedback,
  formError,
  type FormError,
} from "../ui";
import type { HealthcareApi } from "../api";

export function LogisticsForm({
  title,
  api,
  path,
  method = "POST",
  submitLabel = "Lưu",
  secondarySubmitLabel,
  maxWidth = "max-w-3xl",
  children,
  payload,
  onClose,
  onSaved,
  afterSaved,
}: {
  title: string;
  api: HealthcareApi;
  path: string | ((data: FormData) => string);
  method?: string;
  submitLabel?: string;
  secondarySubmitLabel?: string;
  maxWidth?: string;
  children: (error?: FormError) => ReactNode;
  payload: (data: FormData) => unknown;
  onClose: () => void;
  onSaved: () => void;
  afterSaved?: (result: unknown) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [error, setError] = useState<FormError>();
  const [requestKey] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || persisted) return;
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) data.set(submitter.name, submitter.value);
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.json(typeof path === "function" ? path(data) : path, {
        method,
        headers: { "Idempotency-Key": requestKey },
        body: JSON.stringify(payload(data)),
      });
      setPersisted(true);
      await afterSaved?.(result);
      onSaved();
    } catch (err) {
      setError(formError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ErpModal
      native
      title={title}
      onClose={persisted ? onSaved : onClose}
      closeDisabled={busy}
      maxWidth={maxWidth}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="healthcare-logistics space-y-4 [&_input]:!bg-surface-container-lowest [&_input]:!text-on-surface"
      >
        <fieldset disabled={busy} className="space-y-4">
          {children(error)}
        </fieldset>
        <Feedback error={error?.message} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={persisted ? onSaved : onClose}
          >
            Đóng
          </button>
          {secondarySubmitLabel && (
            <button type="submit" name="save-mode" value="draft" className={buttonClass} disabled={busy || persisted}>
              {secondarySubmitLabel}
            </button>
          )}
          <button
            type="submit"
            name={secondarySubmitLabel ? "save-mode" : undefined}
            value={secondarySubmitLabel ? "post" : undefined}
            className={primaryClass}
            disabled={busy || persisted}
          >
            {busy ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </form>
    </ErpModal>
  );
}
export const formValues = (data: FormData) =>
  Object.fromEntries(data.entries());
