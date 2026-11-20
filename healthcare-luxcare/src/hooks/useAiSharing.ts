import { useCallback, useEffect, useRef, useState } from "react";
import { aiSharingService } from "../services/aiSharingService";
import { errorDetails } from "../../shared/error-details";
import type { AiSharingDisclosure, AiSharingScope } from "../../shared/ai-sharing";

type SharingState = {
  key: string;
  data: AiSharingDisclosure | null;
  busy: boolean;
  error: string;
  declined: boolean;
};

export function useAiSharing(scope: AiSharingScope, identity: string, enabled = true) {
  const request = useRef<{ key: string; active: boolean } | null>(null);
  const [state, setState] = useState<SharingState | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${identity}:${scope}:${enabled}:${revision}`;
  const current = state?.key === key ? state : null;
  const disclosure = current?.data || null;
  const busy = Boolean(enabled && (!current || current.busy));

  useEffect(() => {
    if (!enabled) return;
    const attempt = { key, active: true };
    request.current = attempt;
    aiSharingService
      .status(scope)
      .then((data) => {
        if (attempt.active) setState({ key, data, busy: false, error: "", declined: false });
      })
      .catch((error: unknown) => {
        if (attempt.active)
          setState({
            key,
            data: null,
            busy: false,
            error: errorDetails(error).message || "Không thể tải thông tin xử lý AI.",
            declined: false,
          });
      });
    return () => {
      attempt.active = false;
    };
  }, [key, scope, enabled]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  async function accept() {
    if (!disclosure || busy) return;
    const attempt = request.current;
    setState((value) => (value?.key === key ? { ...value, busy: true, error: "" } : value));
    try {
      const data = await aiSharingService.accept(scope, disclosure.disclosureKey);
      if (attempt?.active && attempt.key === key) setState({ key, data, busy: false, error: "", declined: false });
    } catch (error: unknown) {
      const failure = errorDetails(error);
      if (attempt?.active && attempt.key === key) {
        setState((value) =>
          value?.key === key ? { ...value, error: failure.message || "Không thể xác nhận quyền xử lý AI." } : value,
        );
        if (failure.code === "AI_DISCLOSURE_CHANGED") refresh();
      }
    } finally {
      if (attempt?.active && attempt.key === key)
        setState((value) => (value?.key === key ? { ...value, busy: false } : value));
    }
  }
  async function revoke() {
    if (busy || !disclosure) return;
    const attempt = request.current;
    setState((value) => (value?.key === key ? { ...value, busy: true, error: "" } : value));
    try {
      await aiSharingService.revoke(scope);
      if (attempt?.active && attempt.key === key)
        setState({
          key,
          data: { ...disclosure, accepted: false, acceptedAt: null },
          busy: false,
          error: "",
          declined: true,
        });
    } catch (error: unknown) {
      if (attempt?.active && attempt.key === key)
        setState((value) =>
          value?.key === key
            ? { ...value, error: errorDetails(error).message || "Không thể thu hồi quyền xử lý AI." }
            : value,
        );
    } finally {
      if (attempt?.active && attempt.key === key)
        setState((value) => (value?.key === key ? { ...value, busy: false } : value));
    }
  }
  const setDeclined = (declined: boolean) => setState((value) => (value?.key === key ? { ...value, declined } : value));
  return {
    disclosure,
    busy,
    error: current?.error || "",
    declined: current?.declined || false,
    accepted: Boolean(enabled && disclosure?.accepted),
    accept,
    revoke,
    refresh,
    decline: () => setDeclined(true),
    reconsider: () => setDeclined(false),
  };
}
